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
const hostname = '127.0.0.1';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const mediaDir = path.join(process.cwd(), '.media-cache');

let httpServer;
let io;
let dbService;
let mediaService;
let whatsappService;
let syncService;

app.prepare().then(async () => {
  dbService = new DatabaseService();
  await dbService.init();

  mediaService = new MediaService(mediaDir);
  whatsappService = new WhatsAppService(dbService, mediaService);
  syncService = new SyncService(null, dbService, whatsappService);

  httpServer = createServer((req, res) => {
    const httpHandler = new HttpHandler(handle, dbService, whatsappService, mediaDir);
    httpHandler.handleRequest(req, res).catch(err => {
      console.error('--- HTTP REQUEST ERROR ---', err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  });

  io = new Server(httpServer);
  syncService.io = io;

  new SocketHandler(io, whatsappService, dbService, syncService);

  const SYNC_CHATS = parseInt(process.env.SYNC_CHATS || '200', 10);

  whatsappService.setOnReady(() => {
    console.log('--- INICIANDO PROCESSAMENTO DE SYNC EM SEGUNDO PLANO ---');
    whatsappService.getChatsCached().then(chats => {
        console.log(`--- ${chats.length} CHATS ENCONTRADOS. INICIANDO PROCESSAMENTO (max ${SYNC_CHATS})... ---`);
        const sorted = chats.sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0));
        syncService.addToQueue(sorted.slice(0, SYNC_CHATS));
        syncService.processQueue();
    }).catch(e => console.error('Erro ao buscar chats iniciais:', e));
  });

  whatsappService.initialize();

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Local: http://localhost:${port}`);
  });
}).catch(err => {
  console.error('--- FATAL SERVER ERROR UNCAUGHT ---', err);
  process.exit(1);
});

// Graceful Shutdown
function shutdown(signal) {
  console.log(`\n--- ${signal} RECEIVED. Shutting down gracefully... ---`);
  if (whatsappService) {
    try { whatsappService.destroy(); } catch (e) { console.error('Error destroying WhatsApp:', e); }
  }
  if (io) {
    try { io.close(); } catch (e) { console.error('Error closing Socket.io:', e); }
  }
  if (httpServer) {
    httpServer.close(() => {
      console.log('--- HTTP server closed ---');
      if (dbService) {
        dbService.prisma.$disconnect().then(() => {
          console.log('--- Database disconnected ---');
          process.exit(0);
        }).catch(() => process.exit(1));
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
  }
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
