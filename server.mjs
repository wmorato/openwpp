import { createServer } from 'http';
import path from 'path';
import next from 'next';
import { Server } from 'socket.io';

import { DatabaseService } from './src/services/DatabaseService.mjs';
import { MediaService } from './src/services/MediaService.mjs';
import { WhatsAppService } from './src/services/WhatsAppService.mjs';
import { SyncService } from './src/services/SyncService.mjs';
import { HttpHandler } from './src/handlers/HttpHandler.mjs';
import { SocketHandler } from './src/handlers/SocketHandler.mjs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const mediaDir = path.join(process.cwd(), '.media-cache');
const dbPath = './openwpp.sqlite';

app.prepare().then(async () => {
  // 1. Inicia Serviços Core
  const dbService = new DatabaseService(dbPath);
  await dbService.init();

  const mediaService = new MediaService(mediaDir);
  
  // 2. Inicia Serviço de WhatsApp
  // Note: Dependency Injection de db e media
  const whatsappService = new WhatsAppService(dbService, mediaService);

  // 3. Inicia Serviço de Sincronismo
  const syncService = new SyncService(null, dbService, whatsappService); 

  // 4. Cria o Servidor HTTP e Handlers
  const httpServer = createServer((req, res) => {
    const httpHandler = new HttpHandler(handle, dbService, whatsappService, mediaDir);
    httpHandler.handleRequest(req, res).catch(err => {
      console.error('--- HTTP REQUEST ERROR ---', err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  });

  const io = new Server(httpServer);
  
  // 5. Injeta o IO nos serviços (Inversão de Controle ou via Propriedade)
  syncService.io = io; 
  
  // 6. Handlers de Eventos de Rede
  new SocketHandler(io, whatsappService, dbService, syncService);

  // 7. Lógica de Inicialização pós-WhatsApp Ready
  whatsappService.setOnReady(() => {
    // Roda em segundo plano sem travar a inicialização do sistema
    console.log('--- INICIANDO PROCESSAMENTO DE BACKFILL E SYNC EM SEGUNDO PLANO ---');
    
    // Backfill de mídia (não bloqueante)
    syncService.backfillMedia().catch(e => console.error('Erro no backfillMedia:', e));
    
    // Sincronismo inicial de chats (não bloqueante)
    whatsappService.getChatsCached().then(chats => {
        console.log(`--- ${chats.length} CHATS ENCONTRADOS. INICIANDO PROCESSAMENTO... ---`);
        syncService.addToQueue(chats.slice(0, 40));
        syncService.processQueue();
    }).catch(e => console.error('Erro ao buscar chats iniciais:', e));
  });

  // 8. Start Client
  whatsappService.initialize();

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Local: http://localhost:${port}`);
  });
}).catch(err => {
  console.error('--- FATAL SERVER ERROR UNCAUGHT ---', err);
  process.exit(1);
});
