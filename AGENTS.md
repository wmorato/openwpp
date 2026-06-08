# ms-openwpp — Knowledge Items

## Stack
- **Runtime**: Node.js v22.22.3 (não usar v20 — `stream/Stream` incompatível com effect/fast-check)
- **Framework**: Next.js 16 (Turbopack, proxy em vez de middleware)
- **ORM**: Prisma v5.22.0 (v6+ requer Node >=22 e tem problema com effect)
- **Banco**: PostgreSQL 16 (container Docker na porta `127.0.0.1:5433`)
- **Auth**: JWT + bcrypt + refresh tokens
- **WhatsApp**: whatsapp-web.js com Puppeteer/Chrome headless

## Arquitetura
- `/prisma/schema.prisma` — 18 models (Workspace, User, Session, Channel, Conversation, Message, Contact, Chat, Agent, Team, ApiKey, Article, Category, AutomationRule, CsatSurvey, AuditLog, Inbox)
- Auth: `/src/app/api/auth/{login,register,refresh,logout,me}/route.js`
- Frontend: `/login` (auth), `/dashboard` (WhatsApp chat)
- Server: `server.mjs` com graceful shutdown (SIGTERM/SIGINT)

## Comandos Essenciais
```bash
npm run dev        # Desenvolvimento (node server.mjs)
npm run build      # Build Next.js production
npm run seed       # Seed admin users (wil_mor_s@hotmail.com / wilsonmorato@gmail.com)
npm start          # Produção (NODE_ENV=production node server.mjs)
```

## Serviço systemd
- Nome: `ms-openwpp` (auto-start habilitado)
- Logs: `journalctl -u ms-openwpp.service -f`
- Nginx: `chat.moratosolucoes.com.br` → 190.83.85.138 (SSL Let's Encrypt)

## Infra
- Secrets: `/var/www/secrets/ms-openwpp.env`
- PostgreSQL: container `ms-openwpp-pg` (porta `127.0.0.1:5433`, volume bind em `/var/www/ms-openwpp/data`)
- Monitorado via ms-monitor (container `ms-openwpp-pg`)
- WhatsApp auth: `/var/www/.wwebjs_auth_openwpp/`

## Observações
- Prisma v5 usado por compatibilidade (v6 depende de effect/fast-check que quebra no Node v22)
- Polyfill `stream/Stream` removido após downgrade para Prisma v5
- Middleware → Proxy (Next.js 16 renomeou o conceito)
- Servidor HTTP na porta 3000, Nginx faz proxy reverso com suporte a WebSocket
