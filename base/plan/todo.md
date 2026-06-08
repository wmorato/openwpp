# 🚀 OpenWPP: Roteiro de Evolução e Refatoração

Status: 🧪 Pronto para iniciar Fase 5

## Fase 1: Persistência de Dados e Tabela de Contatos (Inspirado no Evolution API) ✅ CONCLUÍDO
- [x] Instalar e inicializar o Prisma ORM (`npx prisma init`).
- [x] Definir o esquema (`schema.prisma`):
    - [x] Tabela `Contact`: id, name, pushname, number, photoUrl, isGroup, updatedAt.
    - [x] Tabela `Chat`: id, name, timestamp, unreadCount, lastMessageId.
    - [x] Tabela `Message`: (Migrar esquema atual do SQLite para o Prisma).
- [x] Criar script de migração para o banco SQLite atual.
- [x] Refatorar `DatabaseService.mjs` para usar os modelos do Prisma.

## Fase 2: Sincronismo Inteligente (Smart Sync) ✅ CONCLUÍDO
- [x] Criar módulo de "Contact Discovery":
    - [x] Implementado sincronismo via `getChats()` para garantir nomes reais e persistentes.
- [x] Implementar fila de sincronismo em segundo plano para nomes e fotos de perfil.
- [x] Adicionar lógica de "Retry" para contatos que retornaram `undefined` inicialmente.

## Fase 3: Local-First Search (Busca Instantânea) ✅ CONCLUÍDO
- [x] Alterar o `handleSearchContacts` para priorizar resultados do banco local (Prisma).
- [x] Exibir indicadores visual de quais contatos estão salvos vs quais estão no WhatsApp (Badge "LOCAL").
- [x] Implementar "Search-on-type" local sem overhead para contatos já conhecidos.

## Fase 4: Estética Clean e Refinamentos (Inspirado no MS-Chat/Chatwoot) ✅ CONCLUÍDO
- [x] Refinar Layout da Barra Lateral (Padding, Fontes "Outfit").
- [x] Adicionar seção de "Contatos" persistente na barra lateral (Tabs: Conversas/Contatos).
- [x] Implementar scroll infinito nativo (CSS scroll-behavior).
- [x] Melhorar visual dos balões de mensagem (Gradients sutis e Glassmorphism).

## Fase 5: Workflow de Atendimento (Open Source de Verdade)
- [ ] Adicionar status às conversas (Pendente, Em Atendimento, Resolvido).
- [ ] Implementar "Filtros rápidos" na barra lateral por status da conversa.
- [ ] Criar sistema de "Notas Internas" no banco Prisma (mensagens que só o atendente vê).
- [ ] Adicionar suporte a Etiquetas/Labels simples para categorizar chats.
