import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export class DatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async connect() {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });
    return this.db;
  }

  async init() {
    if (!this.db) await this.connect();

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chatId TEXT,
        sender TEXT,
        body TEXT,
        timestamp INTEGER,
        fromMe INTEGER
      )
    `);

    await this.ensureMessageColumns();
  }

  async ensureMessageColumns() {
    const columns = await this.db.all(`PRAGMA table_info(messages)`);
    const columnNames = new Set(columns.map((column) => column.name));

    const requiredColumns = [
      ['contentType', `ALTER TABLE messages ADD COLUMN contentType TEXT DEFAULT 'text'`],
      ['mediaMimeType', `ALTER TABLE messages ADD COLUMN mediaMimeType TEXT`],
      ['mediaFilename', `ALTER TABLE messages ADD COLUMN mediaFilename TEXT`],
      ['mediaUrl', `ALTER TABLE messages ADD COLUMN mediaUrl TEXT`],
      ['quotedMsgId', `ALTER TABLE messages ADD COLUMN quotedMsgId TEXT`],
      ['quotedMsgBody', `ALTER TABLE messages ADD COLUMN quotedMsgBody TEXT`],
      ['quotedMsgSender', `ALTER TABLE messages ADD COLUMN quotedMsgSender TEXT`],
    ];

    for (const [name, sql] of requiredColumns) {
      if (!columnNames.has(name)) {
        await this.db.exec(sql);
      }
    }
  }

  async loadStoredMessages(chatId, limit = 100) {
    return this.db.all(
      `SELECT id, chatId, sender, body, timestamp, fromMe, contentType, mediaMimeType, mediaFilename, mediaUrl, quotedMsgId, quotedMsgBody, quotedMsgSender
       FROM (
         SELECT rowid AS _rowid, id, chatId, sender, body, timestamp, fromMe, contentType, mediaMimeType, mediaFilename, mediaUrl, quotedMsgId, quotedMsgBody, quotedMsgSender
         FROM messages
         WHERE chatId = ?
         ORDER BY CASE WHEN timestamp > 0 THEN timestamp ELSE rowid END DESC
         LIMIT ?
       )
       ORDER BY CASE WHEN timestamp > 0 THEN timestamp ELSE _rowid END ASC`,
      [chatId, limit]
    );
  }

  async saveMessage(msgData, mediaData, normalizedBody) {
    try {
      return await this.db.run(
        `INSERT INTO messages (id, chatId, sender, body, timestamp, fromMe, contentType, mediaMimeType, mediaFilename, mediaUrl, quotedMsgId, quotedMsgBody, quotedMsgSender)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
           mediaUrl = COALESCE(excluded.mediaUrl, messages.mediaUrl),
           quotedMsgId = COALESCE(excluded.quotedMsgId, messages.quotedMsgId),
           quotedMsgBody = COALESCE(excluded.quotedMsgBody, messages.quotedMsgBody),
           quotedMsgSender = COALESCE(excluded.quotedMsgSender, messages.quotedMsgSender)`,
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
          msgData.quotedMsgId,
          msgData.quotedMsgBody,
          msgData.quotedMsgSender,
        ]
      );
    } catch (e) {
      console.error('Erro ao salvar no banco:', e.message);
      throw e;
    }
  }

  async getMessagesForBackfill() {
    return this.db.all(
      `SELECT id, body, contentType, mediaUrl, mediaMimeType
       FROM messages
       WHERE (contentType IS NULL OR contentType = 'text')
         AND (mediaUrl IS NULL OR mediaUrl = '')
         AND length(body) > 120`
    );
  }

  async updateMessageMedia(messageId, mediaData) {
    return this.db.run(
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
        messageId,
      ]
    );
  }

  async getMediaInfo(messageId) {
    return this.db.get(
      'SELECT mediaFilename, mediaMimeType FROM messages WHERE id = ?',
      [messageId]
    );
  }

  async getStatus() {
    const msgs = await this.db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 20');
    return {
      localDbCount: (await this.db.get('SELECT COUNT(*) as count FROM messages')).count,
      recent: msgs
    };
  }
}
