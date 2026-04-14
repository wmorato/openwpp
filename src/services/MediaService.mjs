import fs from 'fs/promises';
import path from 'path';

export class MediaService {
  constructor(mediaDir) {
    this.mediaDir = mediaDir;
  }

  isLikelyBase64(body = '') {
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

  inferMimeTypeFromBody(body = '') {
    if (body.startsWith('/9j/')) return 'image/jpeg';
    if (body.startsWith('iVBOR')) return 'image/png';
    if (body.startsWith('R0lGOD')) return 'image/gif';
    if (body.startsWith('UklGR')) return 'image/webp';
    if (body.startsWith('AAAAIGZ0')) return 'video/mp4';
    return 'application/octet-stream';
  }

  extensionFromMimeType(mimeType = '') {
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

  contentTypeFromMimeType(mimeType = '', messageType = 'chat') {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (messageType === 'sticker') return 'sticker';
    if (messageType === 'document') return 'document';
    return 'file';
  }

  async downloadMediaForRawMessage(client, messageId) {
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

  async resolveMediaPayload(client, msg, msgData) {
    if (typeof msg?.downloadMedia === 'function') {
      try {
        const media = await msg.downloadMedia();
        if (media?.data) {
          return {
            data: media.data,
            mimetype: media.mimetype || msgData.mimetype || this.inferMimeTypeFromBody(media.data),
            filename: media.filename || msgData.filename,
          };
        }
      } catch (error) {
        console.warn(`[MEDIA] downloadMedia falhou para ${msgData.id}: ${error.message}`);
      }
    }

    if (msgData.hasMedia) {
      try {
        const media = await this.downloadMediaForRawMessage(client, msgData.id);
        if (media?.data) {
          return {
            data: media.data,
            mimetype: media.mimetype || msgData.mimetype || this.inferMimeTypeFromBody(media.data),
            filename: media.filename || msgData.filename,
          };
        }
      } catch (error) {
        console.warn(`[MEDIA] downloadMedia raw falhou para ${msgData.id}: ${error.message}`);
      }
    }

    if (this.isLikelyBase64(msgData.body)) {
      return {
        data: msgData.body,
        mimetype: msgData.mimetype || this.inferMimeTypeFromBody(msgData.body),
        filename: msgData.filename,
      };
    }

    return null;
  }

  async persistMediaPayload(messageId, mediaPayload, messageType = 'chat') {
    if (!mediaPayload?.data) return null;

    await fs.mkdir(this.mediaDir, { recursive: true });

    const extension = this.extensionFromMimeType(mediaPayload.mimetype);
    const safeFilename = `${encodeURIComponent(messageId)}.${extension}`;
    const absolutePath = path.join(this.mediaDir, safeFilename);

    await fs.writeFile(absolutePath, Buffer.from(mediaPayload.data, 'base64'));

    return {
      contentType: this.contentTypeFromMimeType(mediaPayload.mimetype, messageType),
      mediaMimeType: mediaPayload.mimetype,
      mediaFilename: mediaPayload.filename || safeFilename,
      mediaUrl: `/api/media?id=${encodeURIComponent(messageId)}`,
    };
  }
}
