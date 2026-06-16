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
    
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    
    this.client = this.createClient();
    this.setupListeners();
  }

  createClient() {
    return new Client({
      authStrategy: new LocalAuth({ dataPath: '../.wwebjs_auth_openwpp' }),
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51.html',
      },
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', '--no-first-run',
          '--disable-default-apps', '--disable-background-networking'
        ],
        protocolTimeout: 120_000
      }
    });
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
      this.restartAttempts = 0;
      this.isReady = true;
      this.emit('ready');
      
      if (this.onReadyCallback) {
        await this.onReadyCallback();
      }
    });

    this.client.on('message_create', async (msg) => {
      await this.saveMessage(msg, true);
    });

    this.client.on('disconnected', async (reason) => {
      console.warn('--- WHATSAPP DISCONNECTED ---', reason);
      this.isReady = false;
      this.emit('disconnected', reason);
      await this.reconnect();
    });
  }

  async reconnect() {
    this.restartAttempts++;
    if (this.restartAttempts > this.maxRestartAttempts) {
      console.error(`--- MAX RECONNECT ATTEMPTS (${this.maxRestartAttempts}) REACHED. Giving up. ---`);
      process.exit(1);
    }
    const delay = Math.min(5000 * this.restartAttempts, 60000);
    console.log(`--- RECONNECTING in ${delay/1000}s (attempt ${this.restartAttempts}/${this.maxRestartAttempts}) ---`);
    await new Promise(r => setTimeout(r, delay));
    try {
      this.destroy();
      this.client = this.createClient();
      this.setupListeners();
      await this.initialize();
    } catch (e) {
      console.error('--- RECONNECT FAILED ---', e.message);
      await this.reconnect();
    }
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
    const mimeFallback = { image: 'image/jpeg', video: 'video/mp4', audio: 'audio/ogg', document: 'application/pdf', sticker: 'image/webp' };
    const mediaData = msgData.hasMedia
      ? {
          contentType: this.contentTypeFromMessageType(msgData.messageType),
          mediaMimeType: msgData.mimetype || mimeFallback[msgData.messageType] || 'application/octet-stream',
          mediaFilename: msgData.filename || null,
          mediaUrl: null,
        }
      : {
          contentType: 'text',
          mediaMimeType: null,
          mediaFilename: null,
          mediaUrl: null,
        };
    const normalizedBody = msgData.body;

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

  contentTypeFromMessageType(messageType) {
    const map = {
      'image': 'image',
      'video': 'video',
      'audio': 'audio',
      'ptt': 'audio',
      'document': 'document',
      'sticker': 'sticker',
      'contact': 'file',
      'location': 'file',
    };
    return map[messageType] || 'file';
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
    return contacts;
  }

  setOnReady(callback) {
    this.onReadyCallback = callback;
  }

  destroy() {
    if (this.client) {
      try { this.client.removeAllListeners(); this.client.destroy(); } catch (e) { console.error('Error destroying client:', e); }
    }
    this.isReady = false;
  }
}
