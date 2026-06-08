import { fetchChatMessagesWithFallback } from '../lib/history-sync.mjs';

const SYNC_DAYS = parseInt(process.env.SYNC_DAYS || '30', 10);
const CACHE_TTL_MS = 30000;

function getSyncCutoff() {
  return Math.floor(Date.now() / 1000) - (SYNC_DAYS * 86400);
}

export class SocketHandler {
  constructor(io, whatsappService, dbService, syncService) {
    this.io = io;
    this.whatsappService = whatsappService;
    this.dbService = dbService;
    this.syncService = syncService;
    this.socketInterests = new Map(); // socket.id -> chatId
    this.syncedChats = new Map(); // chatId -> timestamp

    this.setupListeners();
  }

  wasRecentlySynced(chatId) {
    const lastSync = this.syncedChats.get(chatId);
    if (!lastSync) return false;
    return Date.now() - lastSync < CACHE_TTL_MS;
  }

  markSynced(chatId) {
    this.syncedChats.set(chatId, Date.now());
  }

  setupListeners() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    this.whatsappService.on('qr', (url) => {
      this.io.emit('qr', url);
    });

    this.whatsappService.on('ready', () => {
      this.io.emit('ready');
    });

    this.whatsappService.on('message-saved', async ({ message, isLive }) => {
      if (!isLive) return;
      
      // Emitir a mensagem para a conversa aberta
      this.io.emit('new-message', message);

      // Emitir atualização do chat para a lista lateral
      setTimeout(async () => {
        try {
          const chat = await this.whatsappService.client.getChatById(message.chatId);
          if (chat) {
            this.io.emit('chat-update', {
              id: chat.id._serialized,
              name: chat.name || chat.id.user,
              unreadCount: chat.unreadCount,
              timestamp: chat.timestamp,
              isGroup: chat.isGroup,
              lastMessage: chat.lastMessage ? { body: chat.lastMessage.body, timestamp: chat.lastMessage.timestamp } : null
            });
          }
        } catch (e) {
          console.warn('Erro ao buscar chat para atualização:', e.message);
        }
      }, 500);
    });
  }

  handleConnection(socket) {
    if (this.whatsappService.isReady) socket.emit('ready');
    else if (this.whatsappService.qrCodeUrl) socket.emit('qr', this.whatsappService.qrCodeUrl);

    socket.on('mark-read', (chatId) => this.handleMarkRead(chatId));
    socket.on('get-messages', (chatId) => this.handleGetMessages(socket, chatId));
    socket.on('get-chats', () => this.handleGetChats(socket));
    socket.on('search-contacts', (query) => this.handleSearchContacts(socket, query));
    socket.on('send-message', (data) => this.handleSendMessage(socket, data));
    socket.on('send-media', (data) => this.handleSendMedia(socket, data));
    socket.on('send-contact', (data) => this.handleSendContact(socket, data));
    socket.on('get-contacts', () => this.handleGetContacts(socket));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  async handleGetMessages(socket, chatId) {
    this.socketInterests.set(socket.id, chatId);
    this.whatsappService.clearChatsCache();
    console.log('--- BUSCA DB + SYNC PRIORITÁRIO ---', chatId);
    
    try {
      socket.emit('loading-messages', true);
      
      // 1. Snapshot Local imediato
      const localMsgs = await this.dbService.loadStoredMessages(chatId, 100);
      socket.emit('messages', { 
        chatId, 
        messages: localMsgs.map(m => ({ ...m, fromMe: !!m.fromMe })) 
      });

      // 2. Sync live (apenas se não foi sincronizado recentemente)
      const recentlySynced = this.wasRecentlySynced(chatId);
      if (this.whatsappService.isReady && !recentlySynced) {
        try {
          const chat = await this.whatsappService.client.getChatById(chatId);

          if (chatId.endsWith('@c.us') || chatId.endsWith('@g.us')) {
            await this.whatsappService.client.interface.openChatWindow(chatId).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));
          }

          const wppMsgs = await fetchChatMessagesWithFallback({ 
            client: this.whatsappService.client, 
            chat, 
            chatId, 
            limit: 100 
          });

          const cutoff = getSyncCutoff();
          for (const m of wppMsgs) {
            if (!m.timestamp || m.timestamp >= cutoff) {
              await this.whatsappService.saveMessage(m, false, chatId);
            }
          }
          
          // Refresh após sync live
          const updatedMsgs = await this.dbService.loadStoredMessages(chatId, 100);
          socket.emit('messages', { 
            chatId, 
            messages: updatedMsgs.map(m => ({ ...m, fromMe: !!m.fromMe })) 
          });

          this.markSynced(chatId);
        } catch (syncErr) {
          console.log(`[LIVE-SYNC-ERR] ${chatId}: ${syncErr.message}`);
        }
      }
    } catch (err) {
      console.error('Erro na Busca:', err.message);
    } finally {
      socket.emit('loading-messages', false);
    }
  }

  async handleGetChats(socket) {
    if (this.whatsappService.isReady) {
      try {
        const chats = await this.whatsappService.getChatsCached();
        const filtered = chats
          .filter(c => !c.archived && c.id._serialized !== 'status@broadcast')
          .sort((a, b) => {
            // Prioridade 0: Pinned
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;

            // Prioridade 1: Timestamp (mais recente primeiro)
            return (b.timestamp || 0) - (a.timestamp || 0);
          })
          .slice(0, 100);

        socket.emit('chats', filtered.map(c => ({ 
          id: c.id._serialized, 
          name: c.name || c.id.user, 
          unreadCount: c.unreadCount, 
          timestamp: c.timestamp,
          isGroup: c.isGroup,
          pinned: !!c.pinned
        })));
      } catch (e) { 
        console.log('Erro ao pegar chats'); 
      }
    }
  }

  async handleSendMessage(socket, data) {
    if (this.whatsappService.isReady) {
      try { 
        const options = data.quotedMsgId ? { quotedMessageId: data.quotedMsgId } : {};
        await this.whatsappService.client.sendMessage(data.to, data.body, options); 
      } catch (e) { 
        console.error('Error sending message:', e.message);
        socket.emit('error', 'Falha ao enviar mensagem'); 
      }
    }
  }

  async handleSendMedia(socket, { to, data, mimetype, filename, caption, asSticker }) {
    if (this.whatsappService.isReady) {
      try {
        await this.whatsappService.sendMedia(to, data, mimetype, filename, caption, asSticker);
      } catch (e) {
        socket.emit('error', 'Falha ao enviar mídia');
      }
    }
  }

  async handleSendContact(socket, { to, contactId }) {
    if (this.whatsappService.isReady) {
      try {
        await this.whatsappService.sendContact(to, contactId);
      } catch (e) {
        socket.emit('error', 'Falha ao compartilhar contato');
      }
    }
  }

  async handleGetContacts(socket) {
    if (this.whatsappService.isReady) {
      try {
        const contacts = await this.whatsappService.getContacts();
        socket.emit('contacts', contacts
          .filter(c => c && c.id)
          .map(c => ({
            id: c.id._serialized,
            name: c.name || c.pushname || c.id.user
          })));
      } catch (e) {
        console.error('Erro ao pegar contatos:', e.message);
      }
    }
  }

  async handleSearchContacts(socket, query) {
    if (this.whatsappService.isReady && query) {
      try {
        const q = query.toLowerCase();
        
        // 1. Buscar no Banco Local (Prisma) - Rápido e persistente
        const localContacts = await this.dbService.searchContactsLocal(query);
        const contactResults = localContacts.map(c => ({
          id: c.id,
          name: c.name || c.pushname || c.id.split('@')[0],
          type: 'contact',
          isSaved: true
        }));
        
        // 2. Buscar em todos os chats cacheados (Inclui Grupos)
        const allChats = await this.whatsappService.getChatsCached();
        const chatMatches = allChats
            .filter(c => (c.name || '').toLowerCase().includes(q) && c.id._serialized !== 'status@broadcast')
            .map(c => ({
                id: c.id._serialized,
                name: c.name || c.id.user,
                type: 'chat'
            }));

        // 3. Buscar nas Mensagens (Filtro por nome do chat embutido no client.searchMessages)
        // Isso encontra mensagens QUE CONTÉM a palavra, ou de chats QUE CONTÉM o nome
        let messageChatResults = [];
        try {
          const messages = await this.whatsappService.client.searchMessages(query, { limit: 20 });
          messageChatResults = await Promise.all(
            Array.from(new Set(messages.map(m => m.chatId))).map(async (cid) => {
              try {
                const chat = await this.whatsappService.client.getChatById(cid);
                return {
                  id: chat.id._serialized,
                  name: chat.name || chat.id.user,
                  type: 'chat'
                };
              } catch { return null; }
            })
          );
        } catch (errSearch) {
          console.warn('Busca nas mensagens falhou ou retornou erro, ignorando...', errSearch.message);
        }

        // Combinar e remover duplicatas por ID
        const combined = [...contactResults];
        
        chatMatches.forEach(chat => {
          if (chat && !combined.find(c => c.id === chat.id)) {
            combined.push(chat);
          }
        });

        messageChatResults.forEach(chat => {
          if (chat && !combined.find(c => c.id === chat.id)) {
            combined.push(chat);
          }
        });
        
        socket.emit('search-results', combined.slice(0, 50));
      } catch (e) {
        console.error('Erro na pesquisa universal:', e.message);
      }
    }
  }

  async handleMarkRead(chatId) {
    if (this.whatsappService.isReady) {
      try {
        const chat = await this.whatsappService.client.getChatById(chatId);
        await chat.sendSeen();
        this.whatsappService.clearChatsCache();
        
        // Notificar o frontend para atualizar o contador localmente
        this.io.emit('chat-update', {
          id: chatId,
          unreadCount: 0
        });
      } catch (e) {
        console.warn('Erro ao marcar como lido:', chatId, e.message);
      }
    }
  }

  handleDisconnect(socket) {
    this.socketInterests.delete(socket.id);
  }
}
