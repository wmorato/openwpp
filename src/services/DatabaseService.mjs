import { PrismaClient } from '@prisma/client';

export class DatabaseService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async init() {
    try {
      await this.prisma.$connect();
      console.log('--- DATABASE SERVICE (PRISMA) READY ---');
    } catch (e) {
      console.error('Falha ao conectar ao banco com Prisma:', e.message);
    }
  }

  async loadStoredMessages(chatId, limit = 100) {
    return this.prisma.message.findMany({
      where: { chatId },
      take: limit,
      orderBy: { timestamp: 'asc' }
    });
  }

  async saveMessage(msgData, mediaData, normalizedBody) {
    try {
      // Usamos upsert para evitar duplicatas e manter a lógica de atualização
      return await this.prisma.message.upsert({
        where: { id: msgData.id },
        update: {
          chatId: msgData.chatId,
          sender: msgData.sender === 'me' ? 'me' : msgData.sender,
          body: normalizedBody,
          timestamp: msgData.timestamp,
          fromMe: msgData.fromMe,
          contentType: mediaData.contentType,
          mediaMimeType: mediaData.mediaMimeType,
          mediaFilename: mediaData.mediaFilename,
          mediaUrl: mediaData.mediaUrl,
          quotedMsgId: msgData.quotedMsgId,
          quotedMsgBody: msgData.quotedMsgBody,
          quotedMsgSender: msgData.quotedMsgSender,
        },
        create: {
          id: msgData.id,
          chatId: msgData.chatId,
          sender: msgData.sender,
          body: normalizedBody,
          timestamp: msgData.timestamp,
          fromMe: msgData.fromMe,
          contentType: mediaData.contentType,
          mediaMimeType: mediaData.mediaMimeType,
          mediaFilename: mediaData.mediaFilename,
          mediaUrl: mediaData.mediaUrl,
          quotedMsgId: msgData.quotedMsgId,
          quotedMsgBody: msgData.quotedMsgBody,
          quotedMsgSender: msgData.quotedMsgSender,
        }
      });
    } catch (e) {
      console.error('Erro ao salvar no banco (Prisma):', e.message);
      throw e;
    }
  }

  // --- Novos Métodos da Fase 1 ---

  async saveContact(contactData) {
    return this.prisma.contact.upsert({
      where: { id: contactData.id },
      update: {
        name: contactData.name,
        pushname: contactData.pushname,
        number: contactData.number,
        photoUrl: contactData.photoUrl,
        isGroup: contactData.isGroup || false
      },
      create: {
        id: contactData.id,
        name: contactData.name,
        pushname: contactData.pushname,
        number: contactData.number,
        photoUrl: contactData.photoUrl,
        isGroup: contactData.isGroup || false
      }
    });
  }

  async saveChat(chatData) {
    return this.prisma.chat.upsert({
      where: { id: chatData.id },
      update: {
        name: chatData.name,
        timestamp: chatData.timestamp,
        unreadCount: chatData.unreadCount,
        lastMessageId: chatData.lastMessageId
      },
      create: {
        id: chatData.id,
        name: chatData.name,
        timestamp: chatData.timestamp,
        unreadCount: chatData.unreadCount,
        lastMessageId: chatData.lastMessageId
      }
    });
  }

  async searchContactsLocal(query) {
    const q = query.toLowerCase();
    return this.prisma.contact.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { pushname: { contains: q } },
          { id: { contains: q } }
        ]
      },
      take: 50
    });
  }

  async getMessagesForBackfill() {
    return this.prisma.message.findMany({
      where: {
        OR: [
          { contentType: null },
          { contentType: 'text' }
        ],
        AND: [
          { mediaUrl: null },
          { body: { not: null } }
        ]
      }
    });
  }

  async updateMessageMedia(messageId, mediaData) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        body: '',
        contentType: mediaData.contentType,
        mediaMimeType: mediaData.mediaMimeType,
        mediaFilename: mediaData.mediaFilename,
        mediaUrl: mediaData.mediaUrl
      }
    });
  }

  async getMediaInfo(messageId) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
      select: { mediaFilename: true, mediaMimeType: true }
    });
  }

  async getStatus() {
    const total = await this.prisma.message.count();
    const recent = await this.prisma.message.findMany({
      take: 20,
      orderBy: { timestamp: 'desc' }
    });
    return {
      localDbCount: total,
      recent
    };
  }
}
