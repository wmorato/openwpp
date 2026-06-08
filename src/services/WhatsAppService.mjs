import { EventEmitter } from 'events';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode';
import { mapWhatsAppMessage } from '../lib/history-sync.mjs';

export class WhatsAppService extends EventEmitter {
  constructor(dbService, mediaService) {
    super();
    this.dbService = dbService;
    this.mediaService = mediaService;
    this.qrCodeUrl = null;
    this.isReady = false;
    this.chatsCachePromise = null;
    
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: '../.wwebjs_auth_openwpp' }),
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51.html',
      },
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.setupListeners();
  }

  setupListeners() {
    this.client.on('qr', (qr) => {
      console.log('--- QR RECEIVED ---');
      qrcode.toDataURL(qr, (err, url) => {
        this.qrCodeUrl = url;
        this.emit('qr', url);
      });
    });

    this.client.on('ready', async () => {
      console.log('--- WHATSAPP IS READY (DB ACTIVE) ---');
      this.isReady = true;
      this.emit('ready');
      
      if (this.onReadyCallback) {
        await this.onReadyCallback();
      }
    });

    this.client.on('message_create', async (msg) => {
      await this.saveMessage(msg, true);
    });
  }

  async initialize() {
    return this.client.initialize();
  }

  async saveMessage(msg, isLive = false, requestedChatId = null) {
    const hasQuoted = msg.hasQuotedMsg || msg._data?.quotedStanzaID || msg.quotedMsgId;
    if (hasQuoted && !msg._data?.quotedMsg?.body && !msg._data?.quotedMsgBody && !msg.quotedMsg?.body) {
      try {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg) {
          msg._data = msg._data || {};
          msg._data.quotedMsg = msg._data.quotedMsg || {};
          msg._data.quotedMsg.body = quotedMsg.body || quotedMsg.caption || '';
          msg._data.quotedMsg.author = quotedMsg.author || quotedMsg.from;
          if (!msg._data.quotedStanzaID) {
            msg._data.quotedStanzaID = quotedMsg.id?._serialized || quotedMsg.id?.id;
          }
        }
      } catch (err) {
        // Ignorar se não puder buscar
      }
    }

    const msgData = mapWhatsAppMessage(msg, requestedChatId);
    const mediaPayload = await this.mediaService.resolveMediaPayload(this.client, msg, msgData);
    const mediaData = mediaPayload
      ? await this.mediaService.persistMediaPayload(msgData.id, mediaPayload, msgData.messageType)
      : {
          contentType: 'text',
          mediaMimeType: null,
          mediaFilename: null,
          mediaUrl: null,
        };
    const normalizedBody = mediaPayload && this.mediaService.isLikelyBase64(msgData.body) ? '' : msgData.body;

    try {
      const result = await this.dbService.saveMessage(msgData, mediaData, normalizedBody);

      if (result) {
        const fullMessage = {
          ...msgData,
          ...mediaData,
          body: normalizedBody,
        };
        this.emit('message-saved', { message: fullMessage, isLive });
      }
    } catch (e) {
      console.error('WhatsAppService Error saving:', e.message);
    }
  }

  async getChatsCached() {
    if (this.chatsCachePromise) return this.chatsCachePromise;
    this.chatsCachePromise = this.client.getChats();
    try {
      const chats = await this.chatsCachePromise;
      return chats;
    } catch (e) {
      this.chatsCachePromise = null;
      throw e;
    }
  }

  clearChatsCache() {
    this.chatsCachePromise = null;
  }

  async sendMedia(to, base64data, mimetype, filename, caption, asSticker = false) {
    if (!this.isReady) throw new Error('Client not ready');
    const media = new MessageMedia(mimetype, base64data, filename);
    return this.client.sendMessage(to, media, { caption, sendMediaAsSticker: asSticker });
  }

  async sendContact(to, contactId) {
    if (!this.isReady) throw new Error('Client not ready');
    const contact = await this.client.getContactById(contactId);
    return this.client.sendMessage(to, contact);
  }

  async getContacts() {
    if (!this.isReady) throw new Error('Client not ready');
    const contacts = await this.client.getContacts();
    const realPeople = contacts.filter(c => c && c.id && c.isUser && !c.isStatus && !c.isGroup);
    console.log(`[CONTACTS] Total: ${contacts.length} (Pessoas reais filtradas: ${realPeople.length})`);
    
    const targets = ['gustavo', 'dikamor'];
    
    // Debug: ver primeiros nomes para entender a lista de 17k
    console.log('[SEARCH-DEBUG] Primeiros 20 nomes na lista de 17k:', 
      contacts.slice(0, 20).map(c => `${c.name || c.pushname || 'S/N'} (${c.id?._serialized})`).join(', ')
    );

    targets.forEach(t => {
      const found = contacts.filter(c => 
        (c.name || '').toLowerCase().includes(t) || 
        (c.pushname || '').toLowerCase().includes(t) ||
        (c.id?._serialized || '').toLowerCase().includes(t)
      );
      if (found.length > 0) {
        console.log(`[SEARCH-DEBUG] Encontrado alvo "${t}" em CONTATOS:`, found.map(f => ({ n: f.name, p: f.pushname, id: f.id?._serialized, isUser: f.isUser })));
      }
    });

    const chats = await this.client.getChats();
    targets.forEach(t => {
      const found = chats.filter(c => (c.name || '').toLowerCase().includes(t));
      if (found.length > 0) {
        console.log(`[SEARCH-DEBUG] Encontrado alvo "${t}" em CHATS:`, found.map(f => ({ n: f.name, id: f.id?._serialized })));
      }
    });

    return contacts;
  }

  setOnReady(callback) {
    this.onReadyCallback = callback;
  }

  destroy() {
    if (this.client) {
      try { this.client.destroy(); } catch (e) { console.error('Error destroying client:', e); }
    }
    this.removeAllListeners();
    this.isReady = false;
  }
}
