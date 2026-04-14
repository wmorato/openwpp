import { fetchChatMessagesWithFallback } from '../lib/history-sync.mjs';

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
          await this.whatsappService.client.interface.openChatWindow(chatId).catch(() => {});
          await new Promise(r => setTimeout(r, 4000));

          const msgs = await fetchChatMessagesWithFallback({ 
            client: this.whatsappService.client, 
            chat, 
            chatId, 
            limit: 100 
          });

          for (const m of msgs) {
            await this.whatsappService.saveMessage(m, false, chatId);
          }
          
          const hasHistory = msgs.some(m => m.timestamp < ONE_DAY_AGO);
          console.log(`[SYNC-DONE] ${chatId} (${msgs.length} msgs). Histórico antigo: ${hasHistory ? 'SIM ✅' : 'NÃO'}`);
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

  async backfillMedia() {
    const rows = await this.dbService.getMessagesForBackfill();

    for (const row of rows) {
      if (!this.whatsappService.mediaService.isLikelyBase64(row.body)) continue;

      const mediaPayload = {
        data: row.body,
        mimetype: row.mediaMimeType || this.whatsappService.mediaService.inferMimeTypeFromBody(row.body),
        filename: null,
      };

      const mediaData = await this.whatsappService.mediaService.persistMediaPayload(row.id, mediaPayload);
      if (!mediaData) continue;

      await this.dbService.updateMessageMedia(row.id, mediaData);
    }
  }
}
