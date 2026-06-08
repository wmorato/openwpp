# TODO — Evolução ms-openwpp

> Última atualização: 2026-06-05
> Baseado em: `analise_chatbot.md`, `server_skills.md`, `GLOBAL_SKILLS_POLICY.md`, código atual

---

## Pré-Fase 0 — Fundação Técnica

### 0.1 Infraestrutura
- [x] Centralizar secrets em `/var/www/secrets/ms-openwpp.env` (mover de `.env` local)
- [x] Criar `docker/` directory
- [x] `docker-compose.yml` com PostgreSQL (container local para dev)
- [x] Criar `data/` directory (volumes PostgreSQL)
- [x] Criar `testes/` directory (scripts de validação)

### 0.2 Migração de dados (SQLite → PostgreSQL)
- [x] Schema Prisma criado com PostgreSQL (18 models)
- [x] Migração `prisma migrate dev --name init` executada
- [x] Dados do SQLite mantidos via seed (admin users)
- [ ] Script de export SQLite → PostgreSQL para dados existentes (se houver)

### 0.3 Refatoração do server.mjs
- [x] Adicionar graceful shutdown (handler SIGTERM/SIGINT → destroy services)
- [x] Middleware de erro unificado para API routes
- [x] Separar inicialização em módulos

### 0.4 Design System Bootstrap
- [ ] Instalar Radix UI (`@radix-ui/*`) + shadcn/ui
- [ ] Configurar tokens Tailwind v4 conforme GLOBAL_SKILLS_POLICY
- [ ] Migrar `globals.css` de custom `.wa-*` classes para Tailwind v4 + Radix

### 0.5 Seeding (admin users — obrigatório server_skills.md)
- [x] Seed: Workspace default + User Wilson Morato (wil_mor_s@hotmail.com, admin)
- [x] Seed: User Wilson Morato (wilsonmorato@gmail.com, dev)
- [x] Seed: criar script reexecutável (`prisma/seed.mjs`)

### 0.6 Testes
- [ ] Setup de framework de testes (vitest ou jest)

---

## Fase 1 — Fundação Multi-Workspace

### 1.1 Migrar SQLite → PostgreSQL
- [x] Instalar PostgreSQL (container Docker)
- [x] Criar database `ms_openwpp`
- [x] Atualizar `DATABASE_URL` para postgres
- [x] Rodar `prisma migrate dev --name init`
- [x] Verificar conectividade

### 1.2 Schema expandido (Prisma)
- [x] Model `Workspace` (id, name, domain, plan, configs jsonb, timestamps)
- [x] Model `User` (id, email, passwordHash, name, role, workspaceId, timestamps)
- [x] Model `Session` (id, userId, token, refreshToken, expiresAt, timestamps)
- [x] Model `Channel` (id, provider, token, webhookUrl, workspaceId, status, timestamps)
- [x] Model `Conversation` (id, status, channelId, assigneeId, priority, workspaceId, timestamps)
- [x] Model `Inbox` (id, name, channelType, workspaceId, timestamps)
- [x] Adicionar `workspaceId` nos models existentes (Message, Contact, Chat)
- [x] Adicionar índices nos campos de busca
- [x] Model `Agent` (userId, workspaceId, status, skills jsonb)
- [x] Model `Team` (name, workspaceId, agentIds jsonb)
- [x] Model `ApiKey` (key, name, workspaceId, active)
- [x] Model `Article` (workspaceId, title, content, categoryId)
- [x] Model `Category` (workspaceId, name)
- [x] Model `AutomationRule` (workspaceId, trigger, conditions, actions)
- [x] Model `CsatSurvey` (conversationId, rating, comment)
- [x] Model `AuditLog` (workspaceId, userId, action, data, ip)

### 1.3 Autenticação
- [x] Implementar hash de senha (bcrypt)
- [x] Rota `POST /api/auth/register`
- [x] Rota `POST /api/auth/login` → retorna JWT + refresh token
- [x] Proxy (middleware) para rotas protegidas
- [x] Rota `POST /api/auth/refresh`
- [x] Rota `POST /api/auth/logout` (invalidar token/Session)
- [x] Rota `GET /api/auth/me`

### 1.4 Rotas por workspace
- [ ] Namespace Socket.io por workspace
- [ ] Prefixar rotas REST com `/api/workspace/:id`
- [ ] Migrar rotas existentes para dentro do namespace
- [ ] Middleware de validação: usuário pertence ao workspace

---

## Fase 2 — Multi-WhatsApp

### 2.1 Refatorar WhatsAppService
- [ ] Transformar singleton em instância por Channel
- [ ] WorkspaceService com `Map<channelId, WhatsAppService>`
- [ ] Métodos start/stop/reconnect por channel
- [ ] Graceful shutdown: .destroy() em todas as instâncias ativas

### 2.2 API de canais
- [ ] `POST /api/workspace/:id/channels`
- [ ] `GET /api/workspace/:id/channels`
- [ ] `DELETE /api/workspace/:id/channels/:cid`
- [ ] `GET /api/workspace/:id/channels/:cid/status`
- [ ] `GET /api/workspace/:id/channels/:cid/qr`

### 2.3 Roteamento de mensagens
- [ ] Identificar channel ao receber mensagem
- [ ] Criar/atualizar Conversation
- [ ] Roteamento para fila do workspace correto

### 2.4 Frontend — seletor de canais
- [ ] Sidebar com lista de canais
- [ ] Badge de status (conectado/desconectado)

---

## Fase 3 — Agentes + Fila

### 3.1 Modelos
- [x] Model `Agent` (userId, workspaceId, status, skills jsonb) — criado
- [x] Model `Team` (name, workspaceId, agentIds jsonb) — criado
- [x] `Conversation.status` e `assigneeId` — criados
- [x] Índices: status + assigneeId + workspaceId — criados

### 3.2 Lógica de atribuição
- [ ] Auto-assignment round-robin
- [ ] Atribuição manual via API
- [ ] Reatribuição (transferência entre agentes)

### 3.3 Frontend
- [x] Login page (email + senha)
- [ ] Dashboard: abas "Minhas conversas", "Não atribuídas", "Todas"
- [ ] Status do agente (online/offline/ausente)
- [ ] Filtros: inbox, status, agente

---

## Fase 4 — API + Webhooks

### 4.1 API REST
- [ ] `GET/POST /api/v1/workspaces`
- [ ] `GET/POST/PUT /api/v1/conversations`
- [ ] `GET/POST /api/v1/messages`
- [ ] API Key por workspace (model ApiKey — schema pronto)
- [ ] Autenticação via header `X-API-Key`
- [ ] Swagger/OpenAPI docs

### 4.2 Webhooks
- [ ] Eventos: message.created, conversation.updated, agent.assigned
- [ ] POST para URL configurada
- [ ] Retry com backoff exponencial

### 4.3 Rate limiting + validação
- [ ] Validação de schema (zod instalado)

---

## Fase 5 — Telegram + Email (Pendente)

---

## Fase 6 — Automações + CSAT

### 6.1 Automation Rules
- [x] Model AutomationRule — schema pronto

### 6.2 CSAT
- [x] Model CsatSurvey — schema pronto

### 6.3 SLA
- [ ] Pendente

---

## Fase 7 — IA + Respostas Inteligentes

### 7.1 Base de conhecimento
- [x] Model Article — schema pronto
- [x] Model Category — schema pronto

### 7.2-7.4
- [ ] Pendente

---

## Fase 8 — Relatórios + Métricas

### 8.3 Audit Log
- [x] Model AuditLog — schema pronto
- [ ] Exportável

---

## Fase 9 — Produção + Infra

### 9.1 Docker
- [x] docker-compose.yml (PostgreSQL container)
- [x] Nginx reverse proxy + SSL (Let's Encrypt)
- [ ] Dockerfile (Next.js build + server.mjs)
- [ ] docker-compose.yml completo (app + postgres + redis)

### 9.2 CI/CD
- [ ] GitHub Actions

### 9.3 Backup
- [ ] pg_dump automático

### 9.4 Monitoring
- [x] Logs via journald (systemd)
- [x] ms-monitor registrado (container `ms-openwpp-pg`)
- [ ] Healthcheck endpoints (`/api/health`)
- [ ] Prometheus + Grafana

---

## Melhorias Implementadas (fora do plano original)

- [x] Cache client-side de mensagens (troca de chat instantânea)
- [x] Config sync via env vars (SYNC_DAYS, SYNC_CHATS, SYNC_LIMIT)
- [x] Server-side cache de sync (evita re-sync do WhatsApp em 30s)
- [x] Corrigido: extensão de mídia com codecs (ogg; codecs=opus → ogg)
- [x] Corrigido: openChatWindow ignorado para IDs @lid
- [x] Fallback de extensão no endpoint de mídia

---

## Milestone

| Marco | Fases | Entrega |
|---|---|---|
| **MVP** | Pré-F0 + F1 + F9 (infra) | ✅ Autenticação + WhatsApp funcional em produção |
| **Beta** | + F2 + F3 + F4 | Multi-whatsapp, multi-agente, API pública |
| **Premium** | + F5 + F6 + F7 | Telegram, Email, Automações, IA |
| **Produção** | + F9 (completo) | Docker, CI/CD, backup, monitoring |
