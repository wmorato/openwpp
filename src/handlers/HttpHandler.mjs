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

      if (pathname === '/api/health') {
        return await this.handleHealth(req, res);
      }

      if (pathname === '/api/qrcode') {
        return await this.handleQrCode(req, res);
      }

      if (pathname === '/api/media') {
        return await this.handleMedia(req, res, query);
      }

      return await this.nextHandle(req, res, parsedUrl);
    } catch (error) {
      console.error(`[HttpHandler] Error on ${req.url}:`, error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }

  async handleHealth(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: this.whatsappService.isReady ? 'Conectado' : 'Aguardando',
      hasQrCode: !!this.whatsappService.qrCodeUrl,
      timestamp: new Date().toISOString()
    }));
  }

  async handleQrCode(req, res) {
    const qr = this.whatsappService.qrCodeUrl;
    if (!qr) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'QR code not available yet. Try again in a few seconds.' }));
      return;
    }
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.query.format === 'image') {
      const base64Data = qr.replace(/^data:image\/png;base64,/, '');
      res.setHeader('Content-Type', 'image/png');
      res.end(Buffer.from(base64Data, 'base64'));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ qrCodeUrl: qr }));
    }
  }

  async handleMedia(req, res, query) {
    const messageId = typeof query.id === 'string' ? query.id : '';
    if (!messageId) {
      res.statusCode = 400;
      res.end('missing id');
      return;
    }

    const row = await this.dbService.getMediaInfo(messageId);

    if (!row?.mediaMimeType) {
      res.statusCode = 404;
      res.end('media not found');
      return;
    }

    const result = await this.whatsappService.mediaService.getMediaFileOrDownload(
      this.whatsappService.client, messageId, row.mediaMimeType, row.contentType
    );

    if (!result) {
      res.statusCode = 404;
      res.end('media not available');
      return;
    }

    // Update DB if media was just downloaded (first access)
    if (!result.fromCache && result.persistResult) {
      try {
        await this.dbService.updateMessageMedia(messageId, result.persistResult);
      } catch { /* non-critical */ }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(result.file);
  }


}
