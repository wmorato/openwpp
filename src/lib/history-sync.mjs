export function getMessageStorageId(msg) {
  return msg?.id?._serialized || msg?.id?.id || null;
}

function inferFromMe(msg) {
  if (typeof msg?.fromMe === 'boolean') return msg.fromMe;
  if (typeof msg?.id?.fromMe === 'boolean') return msg.id.fromMe;

  const serializedId = getMessageStorageId(msg);
  if (typeof serializedId === 'string') {
    if (serializedId.startsWith('true_')) return true;
    if (serializedId.startsWith('false_')) return false;
  }

  return false;
}

function serializeWid(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._serialized) return value._serialized;
  return String(value);
}

export function resolveMessageChatId(msg, requestedChatId = null) {
  const remoteChatId = msg?.id?.remote;
  const fromMe = inferFromMe(msg);
  const directionalChatId = fromMe ? serializeWid(msg?.to) : serializeWid(msg?.from);

  if (requestedChatId) {
    if (!remoteChatId || remoteChatId !== requestedChatId) {
      return requestedChatId;
    }
  }

  return remoteChatId || directionalChatId || requestedChatId || null;
}

export function mapWhatsAppMessage(msg, requestedChatId = null) {
  const id = getMessageStorageId(msg);
  const chatId = resolveMessageChatId(msg, requestedChatId);
  const fromMe = inferFromMe(msg);
  const messageType = msg?.type || 'chat';

  if (!id || !chatId) {
    throw new Error('Mensagem sem identificador persistivel');
  }

  return {
    id,
    chatId,
    sender: fromMe ? 'me' : (serializeWid(msg.author) || serializeWid(msg.from) || ''),
    body: msg.body || msg.caption || '',
    timestamp: msg.timestamp || msg.t || 0,
    fromMe: fromMe ? 1 : 0,
    from: serializeWid(msg.from),
    to: serializeWid(msg.to),
    messageType,
    mimetype: msg?.mimetype || null,
    filename: msg?.filename || null,
    hasMedia: Boolean(msg?.hasMedia || msg?.directPath),
    quotedMsgId: msg?._data?.quotedStanzaID || msg?.quotedMsgId?._serialized || msg?.quotedMsg?._serialized || msg?._data?.quotedMsg?.id?._serialized || null,
    quotedMsgBody: msg?._data?.quotedMsg?.body || msg?.quotedMsg?.body || msg?._data?.quotedMsgBody || null,
    quotedMsgSender: serializeWid(msg?._data?.quotedMsg?.author) || serializeWid(msg?._data?.quotedMsg?.from) || serializeWid(msg?.quotedMsg?.author) || serializeWid(msg?.quotedMsg?.from) || null,
  };
}

function sortMessagesChronologically(messages) {
  return [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

async function fetchCachedChatMessages({ client, chatId, limit }) {
  if (!client?.pupPage) return [];

  const cached = await client.pupPage.evaluate(
    async (targetChatId, targetLimit) => {
      const chat = await window.WWebJS.getChat(targetChatId, {
        getAsModel: false,
      });

      if (!chat?.msgs?.getModelsArray) return [];

      const models = chat.msgs
        .getModelsArray()
        .sort((a, b) => {
          const ta = a?.t || 0;
          const tb = b?.t || 0;
          if (ta !== tb) return ta - tb;
          const ida = a?.id?._serialized || a?.id?.id || '';
          const idb = b?.id?._serialized || b?.id?.id || '';
          return String(ida).localeCompare(String(idb));
        })
        .slice(-targetLimit);
      return models.map((message) => window.WWebJS.getMessageModel(message));
    },
    chatId,
    limit,
  );

  return cached || [];
}

export async function fetchChatMessagesWithFallback({
  client,
  chat,
  chatId,
  limit = 100,
  logger = console,
}) {
  const collected = [];
  const seen = new Set();

  const pushUnique = (messages, source) => {
    for (const message of messages) {
      const id = getMessageStorageId(message);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      collected.push(message);
    }
    logger.log(`[CHAT-SYNC] ${chatId} ${source}: ${messages.length} mensagens`);
  };

  try {
    const fetched = await chat.fetchMessages({ limit });
    pushUnique(fetched, 'fetchMessages');
  } catch (error) {
    if (error.message.includes('waitForChatLoading')) {
      logger.log(`[CHAT-SYNC] ${chatId} fetchMessages: aguardando carregamento do chat (fallback ativo)`);
    } else {
      logger.warn(`[CHAT-SYNC] ${chatId} fetchMessages falhou: ${error.message}`);
    }
  }

  if (collected.length === 0) {
    try {
      const searched = await client.searchMessages('', { chatId, limit });
      pushUnique(searched, 'searchMessages');
    } catch (error) {
      logger.warn(`[CHAT-SYNC] ${chatId} searchMessages falhou: ${error.message}`);
    }
  }

  if (collected.length === 0) {
    try {
      const cached = await fetchCachedChatMessages({ client, chatId, limit });
      pushUnique(cached, 'cachedMessages');
    } catch (error) {
      logger.warn(`[CHAT-SYNC] ${chatId} cachedMessages falhou: ${error.message}`);
    }
  }

  return sortMessagesChronologically(collected);
}
