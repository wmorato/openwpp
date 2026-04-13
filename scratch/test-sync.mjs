import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '../.wwebjs_auth_openwpp'
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    }
});

const targetChats = [
    '5513988506358-1587171018@g.us',
    '5513981547965-1602775006@g.us',
    '41502352883779@lid'
];

client.on('ready', async () => {
    console.log('--- TESTE DE SINCRONISMO INICIADO ---');
    
    for (const id of targetChats) {
        console.log(`\nProbando chat: ${id}`);
        try {
            const chat = await client.getChatById(id);
            console.log(`Nome: ${chat.name}`);
            
            // Método 1: fetchMessages padrão
            const m1 = await chat.fetchMessages({ limit: 10 });
            console.log(`Método Padrão: ${m1.length} mensagens`);

            // Método 2: searchMessages (vazio)
            const m2 = await client.searchMessages('', { chatId: id, limit: 10 });
            console.log(`Método Search: ${m2.length} mensagens`);

            // Método 3: Pegando a última mensagem direta do objeto chat
            console.log(`Última mensagem em cache: ${chat.lastMessage?.body || 'Nenhuma'}`);

            if (m1.length > 0) {
                console.log('Exemplo de msg encontrada:', m1[0].body);
            }
        } catch (err) {
            console.error(`Erro no chat ${id}:`, err.message);
        }
    }
    
    console.log('\n--- FIM DO TESTE ---');
    process.exit(0);
});

client.on('qr', () => {
    console.log('Erro: Sessão não encontrada. Por favor, rode o app principal primeiro.');
    process.exit(1);
});

client.initialize();
