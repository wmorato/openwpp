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
    console.log('\n--- INICIANDO TESTE DE HISTÓRICO (PROCURANDO MSGS > 24H) ---');
    
    try {
        const chats = await client.getChats();
        console.log(`Total de chats encontrados: ${chats.length}`);
        
        let foundHistorical = false;

        // Vamos testar os primeiros 20 chats
        for (const chat of chats.slice(0, 20)) {
            console.log(`\nVerificando histórico de: ${chat.name} (${chat.id._serialized})`);
            
            try {
                // Pequena espera para o chat "assentar"
                await new Promise(r => setTimeout(r, 2000));
                
                // Tentativa de busca
                const messages = await chat.fetchMessages({ limit: 100 });
                console.log(`- Mensagens recuperadas: ${messages.length}`);

                const historicalMsgs = messages.filter(m => m.timestamp < ONE_DAY_AGO);
                
                if (historicalMsgs.length > 0) {
                    foundHistorical = true;
                    console.log(`✅ SUCESSO! Encontradas ${historicalMsgs.length} mensagens com mais de 1 dia.`);
                    console.log(`- Mensagem de: ${new Date(historicalMsgs[0].timestamp * 1000).toLocaleString()}`);
                    console.log(`- Conteúdo: "${historicalMsgs[0].body.substring(0, 50)}..."`);
                } else {
                    console.log(`- Apenas mensagens recentes encontradas neste chat.`);
                }
            } catch (chatErr) {
                console.log(`- Erro ao ler este chat especificamente (pulando): ${chatErr.message}`);
            }
        }

        if (foundHistorical) {
            console.log('\n--- CONCLUSÃO: TESTE PASSOU. É POSSÍVEL BUSCAR HISTÓRICO ANTIGO ---');
        } else {
            console.log('\n--- CONCLUSÃO: TESTE FALHOU. NENHUMA MSG ANTIGA LOCALIZADA NOS TOP 15 CHATS ---');
        }

    } catch (err) {
        console.error('Erro durante o teste:', err);
    } finally {
        console.log('Finalizando processo de teste...');
        process.exit(0);
    }
});

client.on('qr', () => {
    console.log('Erro: Sessão não encontrada. Rode o app principal e conecte primeiro.');
    process.exit(1);
});

client.initialize();
