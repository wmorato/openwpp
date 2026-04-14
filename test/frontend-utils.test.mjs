import test from 'node:test';
import assert from 'node:assert/strict';
import { getInitials, formatChatListTime, formatDateDivider } from '../src/lib/frontend-utils.ts';

test('getInitials - deve extrair iniciais corretamente', () => {
    assert.strictEqual(getInitials('Wilson Morato'), 'WM');
    assert.strictEqual(getInitials('OpenWPP Inbox App'), 'OI'); // Limite de 2
    assert.strictEqual(getInitials('WhatsApp'), 'W');
    assert.strictEqual(getInitials(''), 'WA');
});

test('formatChatListTime - deve formatar hora para hoje', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatChatListTime(now);
    // Deve conter ":" já que é hoje
    assert.ok(result.includes(':') || result === 'agora');
});

test('formatDateDivider - deve formatar data por extenso', () => {
    const fixedTimestamp = 1713024000; // Alguma data fixa
    const result = formatDateDivider(fixedTimestamp);
    assert.ok(result.length > 5);
    assert.ok(isNaN(Number(result))); // Deve ser texto
});
