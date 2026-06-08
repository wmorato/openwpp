import { parse } from 'url';
import path from 'path';
import fs from 'fs/promises';

export class HttpHandler {
  constructor(nextHandle, dbService, whatsappService, mediaDir) {
    this.nextHandle = nextHandle;
    this.dbService = dbService;
    this.whatsappService = whatsappService;
    this.mediaDir = mediaDir;
  }

  async handleRequest(req, res) {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname, query } = parsedUrl;

      if (pathname === '/api/debug') {
        return await this.handleDebug(req, res);
      }

      if (pathname === '/api/media') {
        return await this.handleMedia(req, res, query);
      }

      if (pathname === '/api/debug/chat') {
        return await this.handleDebugChat(req, res, query);
      }

      return await this.nextHandle(req, res, parsedUrl);
    } catch (error) {
      console.error(`[HttpHandler] Error on ${req.url}:`, error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }

  async handleDebug(req, res) {
    const status = await this.dbService.getStatus();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: this.whatsappService.isReady ? 'Conectado' : 'Aguardando', 
      ...status 
    }, null, 2));
  }

  async handleMedia(req, res, query) {
    const messageId = typeof query.id === 'string' ? query.id : '';
    if (!messageId) {
      res.statusCode = 400;
      res.end('missing id');
      return;
    }

    const row = await this.dbService.getMediaInfo(messageId);

    if (!row?.mediaFilename || !row?.mediaMimeType) {
      res.statusCode = 404;
      res.end('media not found');
      return;
    }

    const extension = this.whatsappService.mediaService.extensionFromMimeType(row.mediaMimeType);
    const absolutePath = path.join(this.mediaDir, `${encodeURIComponent(messageId)}.${extension}`);

    try {
      const file = await fs.readFile(absolutePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', row.mediaMimeType.split(';')[0].trim());
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(file);
    } catch {
      // Fallback: extensão antiga com params (ex: .ogg; codecs=opus)
      const oldExt = row.mediaMimeType.split('/')[1] || 'bin';
      if (oldExt !== extension) {
        const oldPath = path.join(this.mediaDir, `${encodeURIComponent(messageId)}.${oldExt}`);
        try {
          const file = await fs.readFile(oldPath);
          res.statusCode = 200;
          res.setHeader('Content-Type', row.mediaMimeType.split(';')[0].trim());
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.end(file);
          return;
        } catch {}
      }
      res.statusCode = 404;
      res.end('media file missing');
    }
  }

  async handleDebugChat(req, res, query) {
    const chatId = typeof query.chatId === 'string' ? query.chatId : '';
    if (!chatId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'chatId is required' }, null, 2));
      return;
    }

    try {
      const inspection = await this.whatsappService.client.pupPage.evaluate(async (targetChatId) => {
        // ... (the same inspection logic from server.mjs)
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

      const localRows = await this.dbService.loadStoredMessages(chatId, 10);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ inspection, localRows }, null, 2));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message }, null, 2));
    }
  }
}
