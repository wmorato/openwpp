# Plano de Evolução — ms-openwpp → Plataforma Premium

> Stack atual: Next.js 16.2 + Socket.io + Prisma 5.22/PostgreSQL 16 + whatsapp-web.js + JWT
> Status: **MVP operacional** — multi-workspace, auth, WhatsApp funcional
> URL: [https://chat.moratosolucoes.com.br](https://chat.moratosolucoes.com.br)

---

## ✅ Implementado (MVP)

| Item | Status |
|---|---|
| PostgreSQL 16 (Docker, porta 5433) | ✅ |
| Schema Prisma — 18 models (Workspace, User, Session, Channel, Conversation, Agent, Team, ApiKey, Article, Category, AutomationRule, CsatSurvey, AuditLog, Inbox + Message, Contact, Chat) | ✅ |
| Auth JWT (login, register, refresh, logout, me) | ✅ |
| Seed admin users (wil_mor_s@hotmail.com / wilsonmorato@gmail.com) | ✅ |
| Login page (/login) + Dashboard protegido (/dashboard) | ✅ |
| Proxy de rota (redireciona não-autenticados para /login) | ✅ |
| WhatsApp Web integrado (QR code + mensagens tempo real) | ✅ |
| Sync de contatos (697 salvos) + mensagens por chat (100msgs, configurável) | ✅ |
| Cache client-side de mensagens (troca de chat instantânea) | ✅ |
| Sistema de produção: systemd + Nginx + SSL (Let's Encrypt) | ✅ |
| ms-monitor registrado (container ms-openwpp-pg) | ✅ |
| Config sync: SYNC_DAYS, SYNC_CHATS, SYNC_LIMIT via env | ✅ |
| Corrigido: extensão de mídia com codecs (ogg; codecs=opus → ogg) | ✅ |
| Corrigido: openChatWindow para IDs @lid | ✅ |
| Media endpoint com fallback de extensão | ✅ |

---

## Fase 1 — Fundação Multi-Workspace (Semana 1-2)

**Objetivo**: Preparar o banco para multi-tenant e multi-canal

```
1.1. Migrar SQLite → PostgreSQL                         ✅
     - PostgreSQL 16 via Docker
     - Prisma v5.22.0 (v6 incompatível com Node v20→22)

1.2. Novo Schema (models adicionais):                   ✅
     - Workspace, User, Session, Channel, Conversation
     - Inbox, Agent, Team, ApiKey, Article, Category
     - AutomationRule, CsatSurvey, AuditLog
     - Message, Contact, Chat (com workspaceId)

1.3. Autenticação:                                       ✅
     - Login com email/senha (bcrypt + JWT)
     - Register, Refresh, Logout, Me
     - Proxy (middleware) protegendo rotas

1.4. Migrar rotas atuais para dentro de workspace:       ⏳ Pendente
     - GET /api/workspace/:id/chats
     - POST /api/workspace/:id/messages
     - Socket.io namespaces por workspace
```

---

## Fase 2 — Multi-Workspace + Multi-WhatsApp (Semanas 3-4)

**Objetivo**: Suporte a N contas WhatsApp por workspace

```
2.1. Refatorar WhatsAppService:                          ⏳ Pendente
     - De singleton para instância por canal
     - Map<channelId, WhatsAppService>

2.2. API de canais:                                      ⏳ Pendente

2.3. Encaminhamento de mensagens:                        ⏳ Pendente

2.4. Frontend: seletor de canal/inbox:                   ⏳ Pendente
```

---

## Fase 3 — Agentes + Fila de Conversas (Semanas 5-6)

**Objetivo**: Múltiplos agentes com atribuição e gestão de fila

```
3.1. Modelos:                                            ✅ (schema pronto)
     - Agent, Team, Conversation.status, assigneeId

3.2. Lógica de atribuição:                               ⏳ Pendente

3.3. Frontend:                                            ⏳ Pendente
     - Login page (✅ pronto)
     - Dashboard com abas e filtros (⏳ pendente)
```

---

## Fase 4 — API REST + Webhooks (Semana 7)

**Objetivo**: Interface para integração externa

```
4.1. API REST pública:                                   ⏳ Pendente
4.2. Webhooks de saída:                                  ⏳ Pendente
4.3. Rate limiting + validação:                          ⏳ Pendente
```

---

## Fase 5 — Telegram + Email (Semanas 8-9)

**Objetivo**: Primeiros canais além do WhatsApp — ⏳ Pendente

---

## Fase 6 — Automações + CSAT (Semanas 10-11)

**Objetivo**: Regras de automação e pesquisa de satisfação — ⏳ Pendente

---

## Fase 7 — IA + Respostas Inteligentes (Semanas 12-14)

**Objetivo**: Copiloto com sugestões de resposta e automação — ⏳ Pendente

---

## Fase 8 — Relatórios + Métricas (Semana 15)

**Objetivo**: Dashboard gerencial — ⏳ Pendente

---

## Fase 9 — Produção + Infra (Semana 16)

**Objetivo**: Preparar para produção

```
9.1. Dockerizar:                                         ✅ (parcial)
     - docker-compose.yml com PostgreSQL
     - Nginx reverse proxy + SSL (Let's Encrypt)
     - Dockerfile (⏳ pendente)

9.2. CI/CD:                                              ⏳ Pendente

9.3. Backup:                                             ⏳ Pendente

9.4. Monitoring:                                         ✅ (parcial)
     - ms-monitor registrado
     - Logs via journald
     - Prometheus/Grafana (⏳ pendente)
```

---

## Resumo de Esforço

| Fase | Status | Semanas | MVP? |
|---|---|---|---|
| Pré-F0 — Fundação Técnica | ✅ Completo | — | ✅ |
| F1 — Multi-Workspace | ✅ ~90% (falta 1.4) | 2 | ✅ |
| F2 — Multi-WhatsApp | ⏳ Pendente | 2 | ✅ |
| F3 — Agentes + Fila | ⏳ ~20% (models prontos) | 2 | ✅ |
| F4 — API + Webhooks | ⏳ Pendente | 1 | ❌ |
| F5 — Telegram + Email | ⏳ Pendente | 2 | ❌ |
| F6 — Automações + CSAT | ⏳ Pendente | 2 | ❌ |
| F7 — IA + Respostas | ⏳ Pendente | 3 | ❌ |
| F8 — Relatórios | ⏳ Pendente | 1 | ❌ |
| F9 — Produção | ✅ ~50% (infra pronta) | 1 | ❌ |

Primeira milestone utilizável: **MVP operacional** — autenticação + WhatsApp funcional. ✅
