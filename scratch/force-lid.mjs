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
    console.log(`\n--- OPERAÇÃO MARTELO: FORÇANDO ${TARGET_ID} ---`);
    
    let attempts = 1;
    let success = false;

    while (attempts <= 15 && !success) {
        console.log(`\nTentativa ${attempts} de 15...`);
        try {
            const chat = await client.getChatById(TARGET_ID);
            
            // Força o WhatsApp Web a "abrir" a conversa visualmente no headless
            await client.interface.openChatWindow(TARGET_ID).catch(() => {});
            
            console.log('Aguardando 5s para carregamento interno...');
            await new Promise(r => setTimeout(r, 5000));
            
            const messages = await chat.fetchMessages({ limit: 50 });
            
            if (messages && messages.length > 0) {
                console.log(`✅ SUCESSO! Recuperadas ${messages.length} mensagens.`);
                for (const m of messages) {
                    console.log(`[${new Date(m.timestamp * 1000).toLocaleString()}] ${m.id.remote}: ${m.body.substring(0, 30)}`);
                }
                success = true;
            } else {
                console.log('Ainda retornando 0 mensagens. Tentando novo "wake-up"...');
                await chat.getContact().catch(() => {});
            }
        } catch (err) {
            console.warn(`Erro na tentativa ${attempts}: ${err.message}`);
        }
        attempts++;
        await new Promise(r => setTimeout(r, 2000));
    }

    if (!success) console.log('\n❌ Não foi possível carregar as mensagens após 15 tentativas.');
    process.exit(0);
});

client.initialize();
