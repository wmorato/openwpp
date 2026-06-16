import { fetchChatMessagesWithFallback } from '../lib/history-sync.mjs';

const SYNC_DAYS = parseInt(process.env.SYNC_DAYS || '30', 10);
const SYNC_LIMIT = parseInt(process.env.SYNC_LIMIT || '100', 10);
const SECONDS_PER_DAY = 24 * 60 * 60;

export class SyncService {
  constructor(io, dbService, whatsappService) {
    this.io = io;
    this.dbService = dbService;
    this.whatsappService = whatsappService;
    this.syncQueue = new Set();
    this.isSyncing = false;
  }

  addToQueue(chats) {
    chats.forEach(c => this.syncQueue.add(c));
  }

  getSyncCutoff() {
    return Math.floor(Date.now() / 1000) - (SYNC_DAYS * SECONDS_PER_DAY);
  }

  shouldSyncMessage(msg) {
    if (!msg.timestamp) return true;
    return msg.timestamp >= this.getSyncCutoff();
  }

  async processQueue() {
    if (this.isSyncing || this.syncQueue.size === 0) return;
    this.isSyncing = true;
    console.log(`--- INICIANDO BACKGROUND SYNC (${this.syncQueue.size} chats na fila) ---`);
    
    // Converter para array para ordenar (priorizar não lidas)
    const queueArray = Array.from(this.syncQueue);
    queueArray.sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0));
    
    // Limpar o Set e re-inserir ordenado ou apenas processar o array
    const sortedTaskIds = queueArray.map(c => c.id._serialized);
    
    for (const chatId of sortedTaskIds) {
      if (!this.whatsappService.isReady) break;

      const chat = queueArray.find(c => c.id._serialized === chatId);
      this.syncQueue.delete(chat);
      
      let retries = 3;
      let success = false;
      const ONE_DAY_AGO = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

      while (retries > 0 && !success) {
        try {
          // Salvar Chat e Contato logo no início do sync do chat
          const contact = await chat.getContact();
          await this.dbService.saveContact({
            id: contact.id._serialized,
            name: contact.name || contact.pushname,
            pushname: contact.pushname,
            number: contact.number,
            photoUrl: await contact.getProfilePicUrl().catch(() => null),
            isGroup: chat.isGroup
          });

          await this.dbService.saveChat({
            id: chat.id._serialized,
            name: chat.name,
            timestamp: chat.timestamp,
            unreadCount: chat.unreadCount,
            lastMessageId: chat.lastMessage?.id?._serialized
          });

          await this.whatsappService.client.interface.openChatWindow(chatId).catch(() => {});
          await new Promise(r => setTimeout(r, 4000));

          const msgs = await fetchChatMessagesWithFallback({ 
            client: this.whatsappService.client, 
            chat, 
            chatId, 
            limit: SYNC_LIMIT 
          });

          let savedCount = 0;
          for (const m of msgs) {
            if (!this.shouldSyncMessage(m)) continue;
            await this.whatsappService.saveMessage(m, false, chatId);
            savedCount++;
          }
          
          const hasHistory = msgs.some(m => m.timestamp < ONE_DAY_AGO);
          const cutoffDate = new Date(this.getSyncCutoff() * 1000).toISOString().split('T')[0];
          console.log(`[SYNC-DONE] ${chatId} (${savedCount}/${msgs.length} msgs salvas, período: últimos ${SYNC_DAYS} dias desde ${cutoffDate}). Histórico antigo: ${hasHistory ? 'SIM ✅' : 'NÃO'}`);
          success = true;
        } catch (e) {
          retries--;
          console.warn(`[SYNC-RETRY] ${chatId}: ${e.message} (${retries} restantes)`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      
      this.io.emit('sync-status', { remaining: sortedTaskIds.length - (queueArray.indexOf(chat) + 1), syncing: true });
      await new Promise(r => setTimeout(r, 800));
    }

    this.isSyncing = false;
    this.io.emit('sync-status', { remaining: 0, syncing: false });
    console.log(`--- BACKGROUND SYNC CONCLUÍDO ---`);
  }

  async syncContactsIncremental() {
    if (!this.whatsappService.isReady) return;
    try {
      const chats = await this.whatsappService.client.getChats();
      const BATCH = 50;
      const DELAY_MS = 2000;
      let count = 0;

      for (let i = 0; i < chats.length; i += BATCH) {
        if (!this.whatsappService.isReady) break;
        const batch = chats.slice(i, i + BATCH);

        await Promise.allSettled(batch.map(async (chat) => {
          try {
            const existing = await this.dbService.prisma.contact.findUnique({ where: { id: chat.id._serialized } });
            if (existing) return;
            const contact = await chat.getContact();
            if (!contact?.id) return;
            await this.dbService.saveContact({
              id: contact.id._serialized,
              name: contact.name || contact.pushname || contact.id.user,
              pushname: contact.pushname,
              number: contact.number,
              photoUrl: null,
              isGroup: chat.isGroup,
            });
            count++;
          } catch { /* silencioso */ }
        }));

        if (count % 100 === 0) console.log(`[CONTACTS] ${Math.min(i + BATCH, chats.length)}/${chats.length} processados (${count} novos salvos)`);
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

      if (count > 0) console.log(`[CONTACTS] Sync incremental concluído: ${count} novos contatos salvos`);
    } catch (e) {
      console.error('Erro no syncContactsIncremental:', e.message);
    }
  }
}
