# OpenWPP — Multi-Workspace Central de Atendimento

> Plataforma de atendimento multi-canal com suporte a WhatsApp, agentes, automações e IA.

**URL**: [https://chat.moratosolucoes.com.br](https://chat.moratosolucoes.com.br)

---

## Credenciais de Acesso

| Email | Senha | Perfil |
|---|---|---|
| `wil_mor_s@hotmail.com` | `Morato@2026` | Admin |
| `wilsonmorato@gmail.com` | `Morato@2026` | Dev |

---

## Stack

| Camada | Tecnologia |
|---|---|
| **Runtime** | Node.js v22.22.3 |
| **Framework** | Next.js 16 (Turbopack) |
| **ORM** | Prisma v5.22.0 |
| **Banco** | PostgreSQL 16 (Docker, porta 5433) |
| **Auth** | JWT + bcrypt + refresh tokens |
| **WhatsApp** | whatsapp-web.js + Puppeteer/Chrome |
| **Frontend** | React 19 + Tailwind CSS v4 |
| **Proxy** | Nginx + SSL (Let's Encrypt) |

---

## Comandos

```bash
npm run dev     # Desenvolvimento
npm run build   # Build production
npm run seed    # Seed admin users
npm start       # Produção
```

## Infraestrutura

- **Serviço**: `ms-openwpp` (systemd, auto-start)
- **Logs**: `journalctl -u ms-openwpp.service -f`
- **Secrets**: `/var/www/secrets/ms-openwpp.env`
- **PostgreSQL**: container `ms-openwpp-pg` (porta 5433)
- **WhatsApp auth**: `/var/www/.wwebjs_auth_openwpp/`
- **Monitoramento**: ms-monitor (container `ms-openwpp-pg`)

---

## Roadmap

- [x] PostgreSQL + Schema 18 models
- [x] Auth JWT (login, register, refresh, logout)
- [x] Login page + Dashboard protegido
- [x] WhatsApp Web integration
- [x] Produção (systemd, Nginx, SSL, monitor)
- [ ] Multi-WhatsApp (N contas por workspace)
- [ ] Multi-agente (fila, atribuição round-robin)
- [ ] API REST pública + Webhooks
- [ ] Canais Telegram + Email
- [ ] Automações + CSAT + SLA
- [ ] IA + Base de conhecimento
