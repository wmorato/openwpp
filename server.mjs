import { createServer } from 'http';
import { parse } from 'url';
import path from 'path';
import fs from 'fs/promises';
import next from 'next';
import { Server } from 'socket.io';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fetchChatMessagesWithFallback, mapWhatsAppMessage } from './src/lib/history-sync.mjs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const mediaDir = path.join(process.cwd(), '.media-cache');

// Tracking de sockets ativos por chat
const socketInterests = new Map(); // socket.id -> chatId
const syncQueue = new Set();
let isSyncing = false;
let chatsCachePromise = null;

async function loadStoredMessages(db, chatId, limit = 100) {
  return db.all(
    `SELECT id, chatId, sender, body, timestamp, fromMe, contentType, mediaMimeType, mediaFilename, mediaUrl
     FROM (
       SELECT rowid AS _rowid, id, chatId, sender, body, timestamp, fromMe, contentType, mediaMimeType, mediaFilename, mediaUrl
       FROM messages
       WHERE chatId = ?
       ORDER BY CASE WHEN timestamp > 0 THEN timestamp ELSE rowid END DESC
       LIMIT ?
     )
     ORDER BY CASE WHEN timestamp > 0 THEN timestamp ELSE _rowid END ASC`,
    [chatId, limit]
  );
}

async function getChatsCached(client) {
  if (chatsCachePromise) return chatsCachePromise;
  chatsCachePromise = client.getChats();
  try {
    const chats = await chatsCachePromise;
    return chats;
  } catch (e) {
    chatsCachePromise = null;
    throw e;
  }
}

// Banco de Dados Local
const dbPromise = open({
  filename: './openwpp.sqlite',
  driver: sqlite3.Database
});

async function ensureMessageColumns(db) {
  const columns = await db.all(`PRAGMA table_info(messages)`);
  const columnNames = new Set(columns.map((column) => column.name));

  const requiredColumns = [
    ['contentType', `ALTER TABLE messages ADD COLUMN contentType TEXT DEFAULT 'text'`],
    ['mediaMimeType', `ALTER TABLE messages ADD COLUMN mediaMimeType TEXT`],
    ['mediaFilename', `ALTER TABLE messages ADD COLUMN mediaFilename TEXT`],
    ['mediaUrl', `ALTER TABLE messages ADD COLUMN mediaUrl TEXT`],
  ];

  for (const [name, sql] of requiredColumns) {
    if (!columnNames.has(name)) {
      await db.exec(sql);
    }
  }
}

function isLikelyBase64(body = '') {
  if (!body || body.length < 120) return false;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(body)) return false;

  return (
    body.startsWith('/9j/') ||
    body.startsWith('iVBOR') ||
    body.startsWith('R0lGOD') ||
    body.startsWith('UklGR') ||
    body.startsWith('AAAAIGZ0')
  );
}

function inferMimeTypeFromBody(body = '') {
  if (body.startsWith('/9j/')) return 'image/jpeg';
  if (body.startsWith('iVBOR')) return 'image/png';
  if (body.startsWith('R0lGOD')) return 'image/gif';
  if (body.startsWith('UklGR')) return 'image/webp';
  if (body.startsWith('AAAAIGZ0')) return 'video/mp4';
  return 'application/octet-stream';
}

function extensionFromMimeType(mimeType = '') {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'application/pdf': 'pdf',
  };

  return map[mimeType] || mimeType.split('/')[1] || 'bin';
}

function contentTypeFromMimeType(mimeType = '', messageType = 'chat') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (messageType === 'sticker') return 'sticker';
  if (messageType === 'document') return 'document';
  return 'file';
}

async function downloadMediaForRawMessage(client, messageId) {
  if (!client?.pupPage || !messageId) return null;

  const result = await client.pupPage.evaluate(async (msgId) => {
    const msg =
      window.require('WAWebCollections').Msg.get(msgId) ||
      (await window.require('WAWebCollections').Msg.getMessagesById([msgId]))?.messages?.[0];

    if (!msg || !msg.mediaData || msg.mediaData.mediaStage === 'REUPLOADING') {
      return null;
    }

    if (msg.mediaData.mediaStage !== 'RESOLVED') {
      await msg.downloadMedia({
        downloadEvenIfExpensive: true,
        rmrReason: 1,
      });
    }

    if (
      msg.mediaData.mediaStage.includes('ERROR') ||
      msg.mediaData.mediaStage === 'FETCHING'
    ) {
      return null;
    }

    const mockQpl = {
      addAnnotations() {
        return this;
      },
      addPoint() {
        return this;
      },
    };

    const decryptedMedia = await window
      .require('WAWebDownloadManager')
      .downloadManager.downloadAndMaybeDecrypt({
        directPath: msg.directPath,
        encFilehash: msg.encFilehash,
        filehash: msg.filehash,
        mediaKey: msg.mediaKey,
        mediaKeyTimestamp: msg.mediaKeyTimestamp,
        type: msg.type,
        signal: new AbortController().signal,
        downloadQpl: mockQpl,
      });

    const data = await window.WWebJS.arrayBufferToBase64Async(decryptedMedia);

    return {
      data,
      mimetype: msg.mimetype,
      filename: msg.filename,
    };
  }, messageId);

  return result || null;
}

async function resolveMediaPayload(client, msg, msgData) {
  if (typeof msg?.downloadMedia === 'function') {
    try {
      const media = await msg.downloadMedia();
      if (media?.data) {
        return {
          data: media.data,
          mimetype: media.mimetype || msgData.mimetype || inferMimeTypeFromBody(media.data),
          filename: media.filename || msgData.filename,
        };
      }
    } catch (error) {
      console.warn(`[MEDIA] downloadMedia falhou para ${msgData.id}: ${error.message}`);
    }
  }

  if (msgData.hasMedia) {
    try {
      const media = await downloadMediaForRawMessage(client, msgData.id);
      if (media?.data) {
        return {
          data: media.data,
          mimetype: media.mimetype || msgData.mimetype || inferMimeTypeFromBody(media.data),
          filename: media.filename || msgData.filename,
        };
      }
    } catch (error) {
      console.warn(`[MEDIA] downloadMedia raw falhou para ${msgData.id}: ${error.message}`);
    }
  }

  if (isLikelyBase64(msgData.body)) {
    return {
      data: msgData.body,
      mimetype: msgData.mimetype || inferMimeTypeFromBody(msgData.body),
      filename: msgData.filename,
    };
  }

  return null;
}

async function persistMediaPayload(messageId, mediaPayload, messageType = 'chat') {
  if (!mediaPayload?.data) return null;

  await fs.mkdir(mediaDir, { recursive: true });

  const extension = extensionFromMimeType(mediaPayload.mimetype);
  const safeFilename = `${encodeURIComponent(messageId)}.${extension}`;
  const absolutePath = path.join(mediaDir, safeFilename);

  await fs.writeFile(absolutePath, Buffer.from(mediaPayload.data, 'base64'));

  return {
    contentType: contentTypeFromMimeType(mediaPayload.mimetype, messageType),
    mediaMimeType: mediaPayload.mimetype,
    mediaFilename: mediaPayload.filename || safeFilename,
    mediaUrl: `/api/media?id=${encodeURIComponent(messageId)}`,
  };
}

async function backfillInlineBase64Media(db) {
  const rows = await db.all(
    `SELECT id, body, contentType, mediaUrl, mediaMimeType
     FROM messages
     WHERE (contentType IS NULL OR contentType = 'text')
       AND (mediaUrl IS NULL OR mediaUrl = '')
       AND length(body) > 120`
  );

  for (const row of rows) {
    if (!isLikelyBase64(row.body)) continue;

    const mediaPayload = {
      data: row.body,
      mimetype: row.mediaMimeType || inferMimeTypeFromBody(row.body),
      filename: null,
    };

    const mediaData = await persistMediaPayload(row.id, mediaPayload);
    if (!mediaData) continue;

    await db.run(
      `UPDATE messages
       SET body = '',
           contentType = ?,
           mediaMimeType = ?,
           mediaFilename = ?,
           mediaUrl = ?
       WHERE id = ?`,
      [
        mediaData.contentType,
        mediaData.mediaMimeType,
        mediaData.mediaFilename,
        mediaData.mediaUrl,
        row.id,
      ]
    );
  }
}

async function saveMessageToDb(db, client, msg, io, isLive = false, requestedChatId = null) {
  const msgData = mapWhatsAppMessage(msg, requestedChatId);
  const mediaPayload = await resolveMediaPayload(client, msg, msgData);
  const mediaData = mediaPayload
    ? await persistMediaPayload(msgData.id, mediaPayload, msgData.messageType)
    : {
        contentType: 'text',
        mediaMimeType: null,
        mediaFilename: null,
        mediaUrl: null,
      };
  const normalizedBody = mediaPayload && isLikelyBase64(msgData.body) ? '' : msgData.body;

  try {
    const result = await db.run(
      `INSERT INTO messages (id, chatId, sender, body, timestamp, fromMe, contentType, mediaMimeType, mediaFilename, mediaUrl)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         chatId = excluded.chatId,
         sender = CASE
           WHEN messages.sender = 'me' THEN messages.sender
           WHEN excluded.sender = 'me' THEN excluded.sender
           WHEN messages.sender IS NULL OR messages.sender = '' OR messages.sender = '[object Object]' THEN excluded.sender
           ELSE messages.sender
         END,
         body = CASE
           WHEN excluded.contentType != 'text' THEN excluded.body
           WHEN excluded.body IS NOT NULL AND excluded.body != '' THEN excluded.body
           ELSE messages.body
         END,
         timestamp = CASE
           WHEN excluded.timestamp > 0 THEN excluded.timestamp
           ELSE messages.timestamp
         END,
         fromMe = CASE
           WHEN excluded.fromMe = 1 THEN 1
           ELSE messages.fromMe
         END,
         contentType = CASE
           WHEN excluded.contentType != 'text' THEN excluded.contentType
           ELSE messages.contentType
         END,
         mediaMimeType = COALESCE(excluded.mediaMimeType, messages.mediaMimeType),
         mediaFilename = COALESCE(excluded.mediaFilename, messages.mediaFilename),
         mediaUrl = COALESCE(excluded.mediaUrl, messages.mediaUrl)`,
      [
        msgData.id,
        msgData.chatId,
        msgData.sender,
        normalizedBody,
        msgData.timestamp,
        msgData.fromMe,
        mediaData.contentType,
        mediaData.mediaMimeType,
        mediaData.mediaFilename,
        mediaData.mediaUrl,
      ]
    );

    // Só emite 'new-message' se for uma mensagem em tempo real
    if (isLive && result.changes > 0) {
      for (const [socketId, interestChatId] of socketInterests.entries()) {
        if (interestChatId === msgData.chatId) {
          io.to(socketId).emit('new-message', {
            ...msgData,
            ...mediaData,
            body: normalizedBody,
            from: msg.from,
            to: msg.to,
          });
        }
      }
    }
  } catch (e) {
    console.error('Erro ao salvar no banco:', e.message);
  }
}

async function processSyncQueue(db, client, io) {
  if (isSyncing || syncQueue.size === 0) return;
  isSyncing = true;
  console.log(`--- INICIANDO BACKGROUND SYNC (${syncQueue.size} chats na fila) ---`);
  
  while (syncQueue.size > 0) {
    const chat = syncQueue.values().next().value;
    syncQueue.delete(chat);
    const chatId = chat.id._serialized;
    
    let retries = 3;
    let success = false;
    const ONE_DAY_AGO = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

    while (retries > 0 && !success) {
      try {
        // TÉCNICA MARTELO: Força o browser a abrir a janela do chat
        await client.interface.openChatWindow(chatId).catch(() => {});
        await new Promise(r => setTimeout(r, 4000)); // Espera o browser renderizar

        const msgs = await fetchChatMessagesWithFallback({ client, chat, chatId, limit: 100 });
        for (const m of msgs) {
          await saveMessageToDb(db, client, m, io, false, chatId);
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
    
    io.emit('sync-status', { remaining: syncQueue.size, syncing: true });
    await new Promise(r => setTimeout(r, 2000));
  }
  isSyncing = false;
  io.emit('sync-status', { remaining: 0, syncing: false });
  console.log(`--- BACKGROUND SYNC CONCLUÍDO ---`);
}

app.prepare().then(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT,
      sender TEXT,
      body TEXT,
      timestamp INTEGER,
      fromMe INTEGER
    )
  `);
  await ensureMessageColumns(db);
  await backfillInlineBase64Media(db);

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname, query } = parsedUrl;

      if (pathname === '/api/debug') {
        const msgs = await db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 20');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: isReady ? 'Conectado' : 'Aguardando', localDbCount: msgs.length, recent: msgs }, null, 2));
        return;
      }

      if (pathname === '/api/media') {
        const messageId = typeof query.id === 'string' ? query.id : '';
        if (!messageId) {
          res.statusCode = 400;
          res.end('missing id');
          return;
        }

        const row = await db.get(
          'SELECT mediaFilename, mediaMimeType FROM messages WHERE id = ?',
          [messageId]
        );

        if (!row?.mediaFilename || !row?.mediaMimeType) {
          res.statusCode = 404;
          res.end('media not found');
          return;
        }

        const extension = extensionFromMimeType(row.mediaMimeType);
        const absolutePath = path.join(mediaDir, `${encodeURIComponent(messageId)}.${extension}`);

        try {
          const file = await fs.readFile(absolutePath);
          res.statusCode = 200;
          res.setHeader('Content-Type', row.mediaMimeType);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.end(file);
          return;
        } catch {
          res.statusCode = 404;
          res.end('media file missing');
          return;
        }
      }

      if (pathname === '/api/debug/chat') {
        const chatId = typeof query.chatId === 'string' ? query.chatId : '';
        if (!chatId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'chatId is required' }, null, 2));
          return;
        }

        try {
          const inspection = await client.pupPage.evaluate(async (targetChatId) => {
            const out = {
              chatId: targetChatId,
              wid: null,
              foundInCollection: false,
              findOrCreateResultKeys: [],
              chatExistsAfterFind: false,
              msgsCountBeforeOpen: null,
              msgsCountAfterOpen: null,
              msgLoadState: null,
              lastMsgKey: null,
              searchEmptyCount: null,
              searchHelloCount: null,
              openChatResult: null,
              openChatError: null,
              fetchError: null,
              availableMsgMethods: [],
            };

            const wid = window.require('WAWebWidFactory').createWid(targetChatId);
            out.wid = wid?._serialized || targetChatId;

            let chat = window.require('WAWebCollections').Chat.get(wid);
            out.foundInCollection = !!chat;

            if (!chat) {
              const findResult = await window.require('WAWebFindChatAction').findOrCreateLatestChat(wid);
              out.findOrCreateResultKeys = findResult ? Object.keys(findResult) : [];
              chat = findResult?.chat || null;
            }

            out.chatExistsAfterFind = !!chat;

            if (chat) {
              out.availableMsgMethods = Object.keys(chat.msgs || {}).sort();
              out.msgsCountBeforeOpen = chat.msgs?.getModelsArray?.().length ?? null;
              out.msgLoadState = chat.msgs?._last?._value?.id?._serialized || null;

              try {
                out.openChatResult = await window.require('WAWebCmd').Cmd.openChatBottom({ chat });
              } catch (error) {
                out.openChatError = error?.message || String(error);
              }

              out.msgsCountAfterOpen = chat.msgs?.getModelsArray?.().length ?? null;
              const lastMsg = chat.msgs?.getModelsArray?.()?.slice(-1)?.[0] || null;
              out.lastMsgKey = lastMsg?.id?._serialized || null;
            }

            try {
              const emptySearch = await window.require('WAWebCollections').Msg.search('', undefined, 20, targetChatId);
              out.searchEmptyCount = emptySearch?.messages?.length ?? null;
            } catch (error) {
              out.searchEmptyCount = `ERR: ${error?.message || String(error)}`;
            }

            try {
              const helloSearch = await window.require('WAWebCollections').Msg.search('a', undefined, 20, targetChatId);
              out.searchHelloCount = helloSearch?.messages?.length ?? null;
            } catch (error) {
              out.searchHelloCount = `ERR: ${error?.message || String(error)}`;
            }

            try {
              if (chat) {
                await window.require('WAWebChatLoadMessages').loadEarlierMsgs(chat, chat.msgs);
              }
            } catch (error) {
              out.fetchError = error?.message || String(error);
            }

            return out;
          }, chatId);

          const localRows = await loadStoredMessages(db, chatId, 10);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ inspection, localRows }, null, 2));
          return;
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }, null, 2));
          return;
        }
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer);
  let qrCodeUrl = null;
  let isReady = false;

  const client = new Client({
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

  client.on('qr', (qr) => {
    console.log('--- QR RECEIVED ---');
    qrcode.toDataURL(qr, (err, url) => {
      qrCodeUrl = url;
      io.emit('qr', url);
    });
  });

  client.on('ready', async () => {
    console.log('--- WHATSAPP IS READY (DB ACTIVE) ---');
    isReady = true;
    io.emit('ready');

    // Inicia Backfill de Histórico
    console.log('--- BUSCANDO CHATS PARA SINCRONISMO INICIAL... ---');
    const chats = await getChatsCached(client);
    console.log(`--- ${chats.length} CHATS ENCONTRADOS. INICIANDO PROCESSAMENTO... ---`);
    chats.slice(0, 40).forEach(c => syncQueue.add(c));
    processSyncQueue(db, client, io);
  });

  client.on('message_create', async (msg) => {
    await saveMessageToDb(db, client, msg, io, true);
  });

  client.initialize();

  io.on('connection', (socket) => {
    if (isReady) socket.emit('ready');
    else if (qrCodeUrl) socket.emit('qr', qrCodeUrl);

    socket.on('get-messages', async (chatId) => {
      socketInterests.set(socket.id, chatId);
      console.log('--- BUSCA DB + SYNC PRIORITÁRIO ---', chatId);
      try {
        socket.emit('loading-messages', true);
        
        // 1. Snapshot Local imediato
        const localMsgs = await loadStoredMessages(db, chatId, 100);
        socket.emit('messages', { chatId, messages: localMsgs.map(m => ({ ...m, fromMe: !!m.fromMe })) });

        // 2. Garante que este chat seja o próximo na fila de sync ou force agora
        try {
          const chat = await client.getChatById(chatId);
          await client.interface.openChatWindow(chatId).catch((openErr) => {
            console.log(`[LIVE-SYNC] ${chatId} openChatWindow falhou: ${openErr.message}`);
          });
          await new Promise(r => setTimeout(r, 2000));

          const wppMsgs = await fetchChatMessagesWithFallback({ client, chat, chatId, limit: 100 });
          for (const m of wppMsgs) {
            await saveMessageToDb(db, client, m, io, false, chatId);
          }
          
          // Refresh após sync live
          const updatedMsgs = await loadStoredMessages(db, chatId, 100);
          socket.emit('messages', { chatId, messages: updatedMsgs.map(m => ({ ...m, fromMe: !!m.fromMe })) });
        } catch (syncErr) {
          console.log(`[LIVE-SYNC-ERR] ${chatId}: ${syncErr.message}`);
        }
      } catch (err) {
        console.error('Erro na Busca:', err.message);
      } finally {
        socket.emit('loading-messages', false);
      }
    });

    socket.on('get-chats', async () => {
      if (isReady) {
        try {
          const chats = await getChatsCached(client);
          const filtered = chats
            .filter(c => !c.archived && c.id._serialized !== 'status@broadcast')
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 100);
          socket.emit('chats', filtered.map(c => ({ 
            id: c.id._serialized, 
            name: c.name || c.id.user, 
            unreadCount: c.unreadCount, 
            timestamp: c.timestamp,
            isGroup: c.isGroup 
          })));
        } catch (e) { console.log('Erro ao pegar chats'); }
      }
    });

    socket.on('disconnect', () => {
      socketInterests.delete(socket.id);
    });

    socket.on('send-message', async (data) => {
      if (isReady) {
        try { await client.sendMessage(data.to, data.body); } catch (e) { socket.emit('error', 'Falha ao enviar'); }
      }
    });
  });

  httpServer.listen(port, hostname, () => console.log(`> Ready on http://${hostname}:${port}`));
});
