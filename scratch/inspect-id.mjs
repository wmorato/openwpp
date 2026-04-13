import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '../.wwebjs_auth_openwpp'
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

const TARGET_ID = '41502352883779@lid';

client.on('ready', async () => {
    console.log(`\n--- INSPEÇÃO DE PRECISÃO: ${TARGET_ID} ---`);
    
    try {
        const chat = await client.getChatById(TARGET_ID);
        console.log(`Chat encontrado: ${chat.name}`);
        console.log(`Tipo de ID do Chat: ${chat.id._serialized}`);
        
        console.log('Tentando carregar mensagens com force-wait...');
        // Tenta forçar o carregamento abrindo o chat explicitamente no estado do browser
        await client.interface.openChatWindow(TARGET_ID).catch(() => {});
        await new Promise(r => setTimeout(r, 5000));
        
        const messages = await chat.fetchMessages({ limit: 5 });
        console.log(`Total de mensagens recuperadas agora: ${messages.length}`);

        if (messages.length > 0) {
            const msg = messages[0];
            console.log('\n--- ESTRUTURA DA MENSAGEM ---');
            console.log(`Message from: ${msg.from}`);
            console.log(`Message to: ${msg.to}`);
            console.log(`Message author: ${msg.author}`);
            console.log(`Message ID: ${msg.id._serialized}`);
            console.log(`Corpo: ${msg.body}`);
        } else {
            console.log('Nenhuma mensagem retornada pelo fetchMessages ainda.');
        }

    } catch (err) {
        console.error('Erro na inspeção:', err.message);
    } finally {
        process.exit(0);
    }
});

client.initialize();
