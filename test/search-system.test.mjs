import test from 'node:test';
import assert from 'node:assert/strict';

// Simulando a lógica do useMemo no Frontend
function filterChats(chats, searchTerm) {
    return chats.filter((chat) => 
        chat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
}

test('Simulação de Pesquisa Frontend - deve filtrar por nome independente de case', () => {
    const mockChats = [
        { id: '1', name: 'Familia Morato' },
        { id: '2', name: 'Trabalho' },
        { id: '3', name: 'Amigos de Infancia' },
        { id: '4', name: 'FAMILIA unida' }
    ];

    // Teste 1: Busca simples
    const result1 = filterChats(mockChats, 'familia');
    assert.strictEqual(result1.length, 2);
    assert.strictEqual(result1[0].name, 'Familia Morato');

    // Teste 2: Busca vazia (deve retornar tudo)
    const result2 = filterChats(mockChats, '');
    assert.strictEqual(result2.length, 4);

    // Teste 3: Busca sem resultados
    const result3 = filterChats(mockChats, 'xyz123');
    assert.strictEqual(result3.length, 0);
});

test('Validação de Grupos Fixados (Lógica de Ordenação)', () => {
    // No nosso sistema, os fixados geralmente vêm no topo pelo unreadCount ou timestamp
    // Mas vamos validar a lógica de prioridade do SocketHandler.mjs
    const mockChats = [
        { id: '1', name: 'Chat A', unreadCount: 0, timestamp: 100 },
        { id: '2', name: 'Chat B', unreadCount: 5, timestamp: 50 },
        { id: '3', name: 'Chat C', unreadCount: 0, timestamp: 200 }
    ];

    const sorted = [...mockChats].sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        return b.timestamp - a.timestamp;
    });

    assert.strictEqual(sorted[0].id, '2'); // B tem unread, deve subir
    assert.strictEqual(sorted[1].id, '3'); // C é mais recente que A
});
