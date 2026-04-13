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

const ONE_DAY_AGO = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

client.on('ready', async () => {
    console.log('\n--- TESTE DE HISTÓRICO EM CONTATOS INDIVIDUAIS ---');
    
    try {
        const chats = await client.getChats();
        const individualChats = chats.filter(c => !c.isGroup).slice(0, 5);
        
        console.log(`Testando ${individualChats.length} conversas privadas...`);
        
        for (const chat of individualChats) {
            console.log(`\nChat: ${chat.name} (${chat.id._serialized})`);
            try {
                // Força o carregamento do contato antes
                await chat.getContact();
                await new Promise(r => setTimeout(r, 2000));
                
                const messages = await chat.fetchMessages({ limit: 100 });
                console.log(`- Mensagens recuperadas: ${messages.length}`);

                const oldOnes = messages.filter(m => m.timestamp < ONE_DAY_AGO);
                if (oldOnes.length > 0) {
                    console.log(`✅ SUCESSO! Encontradas ${oldOnes.length} mensagens com mais de 24h.`);
                    console.log(`- Última msg de ontem: [${new Date(oldOnes[0].timestamp * 1000).toLocaleString()}] ${oldOnes[0].body.substring(0, 50)}`);
                } else {
                    console.log(`- Nenhuma mensagem antiga encontrada neste contato.`);
                }
            } catch (e) {
                console.log(`- Erro neste chat: ${e.message}`);
            }
        }
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        process.exit(0);
    }
});

client.initialize();
