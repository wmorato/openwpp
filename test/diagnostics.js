import { DatabaseService } from '../src/services/DatabaseService.mjs';
import path from 'path';

async function runDiagnostics() {
    const dbPath = './openwpp.sqlite';
    const dbService = new DatabaseService(dbPath);
    await dbService.connect();

    console.log('--- RELATÓRIO DE DIAGNÓSTICO DO BANCO ---');

    // 1. Total de mensagens
    const msgCount = await dbService.db.get('SELECT COUNT(*) as count FROM messages');
    console.log(`Total de mensagens no banco: ${msgCount.count}`);

    // 2. Total de chats conhecidos (baseado nas mensagens)
    const chatStats = await dbService.db.all(`
        SELECT chatId, COUNT(*) as count, MAX(timestamp) as lastMsg 
        FROM messages 
        GROUP BY chatId 
        ORDER BY lastMsg DESC
    `);
    console.log(`Total de chats com mensagens faturadas: ${chatStats.length}`);

    // 3. Chat mais atual
    if (chatStats.length > 0) {
        const primary = chatStats[0];
        console.log(`Chat mais ativo (última mensagem): ${primary.chatId} (${new Date(primary.lastMsg * 1000).toLocaleString()})`);
    }

    // 4. Detalhamento por tipo (Geralmente grupos terminam em @g.us)
    const groups = chatStats.filter(c => c.chatId.endsWith('@g.us'));
    const individuals = chatStats.filter(c => c.chatId.endsWith('@c.us') || c.chatId.endsWith('@lid'));
    console.log(`Grupos no banco: ${groups.length}`);
    console.log(`Contatos individuais no banco: ${individuals.length}`);

    // 5. Simulação de Pesquisa (Filtro do Frontend)
    const mockSearchTerm = 'Familia'; // Exemplo
    const found = chatStats.filter(c => c.chatId.toLowerCase().includes(mockSearchTerm.toLowerCase()));
    console.log(`\nSimulação de pesquisa por "${mockSearchTerm}": ${found.length} resultados encontrados no banco.`);

    await dbService.db.close();
}

runDiagnostics().catch(console.error);
