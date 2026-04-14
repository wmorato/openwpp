import { fetchChatMessagesWithFallback } from '../lib/history-sync.mjs';

export class SocketHandler {
  constructor(io, whatsappService, dbService, syncService) {
    this.io = io;
    this.whatsappService = whatsappService;
    this.dbService = dbService;
    this.syncService = syncService;
    this.socketInterests = new Map(); // socket.id -> chatId

    this.setupListeners();
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

      // 2. Sync live
      if (this.whatsappService.isReady) {
        try {
          const chat = await this.whatsappService.client.getChatById(chatId);
          await this.whatsappService.client.interface.openChatWindow(chatId).catch((openErr) => {
            console.log(`[LIVE-SYNC] ${chatId} openChatWindow falhou: ${openErr.message}`);
          });
          await new Promise(r => setTimeout(r, 2000));

          const wppMsgs = await fetchChatMessagesWithFallback({ 
            client: this.whatsappService.client, 
            chat, 
            chatId, 
            limit: 100 
          });

          for (const m of wppMsgs) {
            await this.whatsappService.saveMessage(m, false, chatId);
          }
          
          // Refresh após sync live
          const updatedMsgs = await this.dbService.loadStoredMessages(chatId, 100);
          socket.emit('messages', { 
            chatId, 
            messages: updatedMsgs.map(m => ({ ...m, fromMe: !!m.fromMe })) 
          });
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
            // Prioridade 1: Mensagens não lidas
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
            
            // Prioridade 2: Timestamp (mais recente primeiro)
            return (b.timestamp || 0) - (a.timestamp || 0);
          })
          .slice(0, 100);

        socket.emit('chats', filtered.map(c => ({ 
          id: c.id._serialized, 
          name: c.name || c.id.user, 
          unreadCount: c.unreadCount, 
          timestamp: c.timestamp,
          isGroup: c.isGroup 
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
        
        // 1. Buscar nos Contatos
        const contacts = await this.whatsappService.getContacts();
        const contactResults = contacts
          .filter(c => c && c.id && (
            (c.name || '').toLowerCase().includes(q) || 
            (c.pushname || '').toLowerCase().includes(q)
          ))
          .slice(0, 30)
          .map(c => ({
            id: c.id._serialized,
            name: c.name || c.pushname || c.id.user,
            type: 'contact'
          }));
        
        // 2. Buscar nas Mensagens (Filtro por nome do chat embutido no client.searchMessages)
        // Isso encontra mensagens QUE CONTÉM a palavra, ou de chats QUE CONTÉM o nome
        const messages = await this.whatsappService.client.searchMessages(query, { limit: 20 });
        const messageChatResults = await Promise.all(
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

        // Combinar e remover duplicatas por ID
        const combined = [...contactResults];
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
