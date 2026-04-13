import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchChatMessagesWithFallback,
  getMessageStorageId,
  mapWhatsAppMessage,
  resolveMessageChatId,
} from '../src/lib/history-sync.mjs';

function createMessage({
  serialized = 'true_41502352883779@lid_ABC123',
  id = 'ABC123',
  remote = '5511999999999@c.us',
  from = '5511999999999@c.us',
  to = 'me@lid',
  fromMe = false,
  timestamp = 10,
  body = 'oi',
  author,
}) {
  return {
    id: {
      _serialized: serialized,
      id,
      remote,
      fromMe,
    },
    from,
    to,
    fromMe,
    timestamp,
    body,
    author,
    hasMedia: false,
  };
}

test('resolveMessageChatId prioriza o chat solicitado quando o remote diverge', () => {
  const msg = createMessage({
    remote: '5511999999999@c.us',
    from: '5511999999999@c.us',
  });

  assert.equal(resolveMessageChatId(msg, '41502352883779@lid'), '41502352883779@lid');
});

test('mapWhatsAppMessage usa id serializado e persiste no chat solicitado', () => {
  const msg = createMessage({
    serialized: 'false_5511999999999@c.us_DEF456',
    id: 'DEF456',
    remote: '5511999999999@c.us',
    from: '5511999999999@c.us',
    timestamp: 42,
  });

  const mapped = mapWhatsAppMessage(msg, '41502352883779@lid');

  assert.equal(mapped.id, 'false_5511999999999@c.us_DEF456');
  assert.equal(mapped.chatId, '41502352883779@lid');
  assert.equal(mapped.sender, '5511999999999@c.us');
  assert.equal(mapped.timestamp, 42);
});

test('mapWhatsAppMessage normaliza wid em objeto e timestamp bruto', () => {
  const msg = {
    id: {
      _serialized: 'false_41502352883779@lid_RAW001',
      id: 'RAW001',
      remote: '41502352883779@lid',
      fromMe: false,
    },
    from: { _serialized: '41502352883779@lid' },
    to: { _serialized: 'me@lid' },
    author: { _serialized: '41502352883779@lid' },
    fromMe: false,
    t: 123,
    body: 'mensagem crua',
    hasMedia: false,
  };

  const mapped = mapWhatsAppMessage(msg, '41502352883779@lid');

  assert.equal(mapped.sender, '41502352883779@lid');
  assert.equal(mapped.from, '41502352883779@lid');
  assert.equal(mapped.to, 'me@lid');
  assert.equal(mapped.timestamp, 123);
});

test('mapWhatsAppMessage infere fromMe pelo id serializado quando o campo nao existe', () => {
  const msg = {
    id: {
      _serialized: 'true_41502352883779@lid_RAW002',
      id: 'RAW002',
      remote: '41502352883779@lid',
    },
    from: { _serialized: 'me@lid' },
    to: { _serialized: '41502352883779@lid' },
    body: 'mensagem minha',
    t: 456,
    hasMedia: false,
  };

  const mapped = mapWhatsAppMessage(msg, '41502352883779@lid');

  assert.equal(mapped.fromMe, 1);
  assert.equal(mapped.sender, 'me');
});

test('fetchChatMessagesWithFallback usa searchMessages quando fetchMessages retorna zero', async () => {
  const fromSearch = createMessage({
    serialized: 'false_41502352883779@lid_XYZ999',
    id: 'XYZ999',
    remote: '5511999999999@c.us',
    from: '5511999999999@c.us',
    timestamp: 100,
  });

  const chat = {
    async fetchMessages() {
      return [];
    },
  };

  const client = {
    async searchMessages(query, options) {
      assert.equal(query, '');
      assert.equal(options.chatId, '41502352883779@lid');
      assert.equal(options.limit, 100);
      return [fromSearch];
    },
  };

  const messages = await fetchChatMessagesWithFallback({
    client,
    chat,
    chatId: '41502352883779@lid',
    logger: { log() {}, warn() {} },
  });

  assert.equal(messages.length, 1);
  assert.equal(getMessageStorageId(messages[0]), 'false_41502352883779@lid_XYZ999');
});

test('fetchChatMessagesWithFallback remove duplicatas por id serializado', async () => {
  const duplicated = createMessage({
    serialized: 'false_41502352883779@lid_DUP001',
    id: 'DUP001',
    remote: '41502352883779@lid',
    from: '41502352883779@lid',
    timestamp: 20,
  });

  const older = createMessage({
    serialized: 'false_41502352883779@lid_OLD001',
    id: 'OLD001',
    remote: '41502352883779@lid',
    from: '41502352883779@lid',
    timestamp: 10,
  });

  const chat = {
    async fetchMessages() {
      return [duplicated, older];
    },
  };

  const client = {
    async searchMessages() {
      return [duplicated];
    },
  };

  const messages = await fetchChatMessagesWithFallback({
    client,
    chat,
    chatId: '41502352883779@lid',
    logger: { log() {}, warn() {} },
  });

  assert.deepEqual(
    messages.map((message) => getMessageStorageId(message)),
    ['false_41502352883779@lid_OLD001', 'false_41502352883779@lid_DUP001'],
  );
});

test('fetchChatMessagesWithFallback usa cache da pagina quando fetch e search falham', async () => {
  const cachedMessage = createMessage({
    serialized: 'true_41502352883779@lid_CACHE001',
    id: 'CACHE001',
    remote: '41502352883779@lid',
    from: '41502352883779@lid',
    timestamp: 77,
  });

  const chat = {
    async fetchMessages() {
      throw new Error('waitForChatLoading');
    },
  };

  const client = {
    async searchMessages() {
      return [];
    },
    pupPage: {
      async evaluate(fn, chatId, limit) {
        assert.equal(typeof fn, 'function');
        assert.equal(chatId, '41502352883779@lid');
        assert.equal(limit, 100);
        return [cachedMessage];
      },
    },
  };

  const messages = await fetchChatMessagesWithFallback({
    client,
    chat,
    chatId: '41502352883779@lid',
    logger: { log() {}, warn() {} },
  });

  assert.equal(messages.length, 1);
  assert.equal(getMessageStorageId(messages[0]), 'true_41502352883779@lid_CACHE001');
});

test('fetchChatMessagesWithFallback prioriza as mensagens mais recentes do cache', async () => {
  const mk = (n, t) => createMessage({
    serialized: `true_41502352883779@lid_CACHE${n}`,
    id: `CACHE${n}`,
    remote: '41502352883779@lid',
    from: '41502352883779@lid',
    timestamp: t,
    body: `msg-${n}`,
  });

  const chat = {
    async fetchMessages() {
      throw new Error('waitForChatLoading');
    },
  };

  const client = {
    async searchMessages() {
      return [];
    },
    pupPage: {
      async evaluate(fn, chatId, limit) {
        assert.equal(typeof fn, 'function');
        assert.equal(chatId, '41502352883779@lid');
        assert.equal(limit, 2);

        const unordered = [mk(1, 10), mk(2, 30), mk(3, 20)];
        return unordered.sort((a, b) => {
          const ta = a?.t || a?.timestamp || 0;
          const tb = b?.t || b?.timestamp || 0;
          if (ta !== tb) return ta - tb;
          return String(a.id._serialized).localeCompare(String(b.id._serialized));
        }).slice(-limit);
      },
    },
  };

  const messages = await fetchChatMessagesWithFallback({
    client,
    chat,
    chatId: '41502352883779@lid',
    limit: 2,
    logger: { log() {}, warn() {} },
  });

  assert.deepEqual(
    messages.map((message) => message.body),
    ['msg-3', 'msg-2'],
  );
});
