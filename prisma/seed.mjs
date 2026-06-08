import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Morato@2026', 10);

  const workspace = await prisma.workspace.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Morato Soluções',
      domain: 'moratosolucoes.com.br',
      plan: 'enterprise',
    },
  });

  const users = [
    { email: 'wil_mor_s@hotmail.com', name: 'Wilson Morato', role: 'admin' },
    { email: 'wilsonmorato@gmail.com', name: 'Wilson Morato', role: 'dev' },
  ];

  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        role: u.role,
        workspaceId: workspace.id,
      },
    });

    await prisma.agent.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        workspaceId: workspace.id,
        status: 'online',
      },
    });

    console.log(`Seeded: ${u.email} (${u.role})`);
  }

  const inboxName = 'WhatsApp Principal';
  await prisma.inbox.upsert({
    where: { id: 'default-whatsapp' },
    update: {},
    create: {
      id: 'default-whatsapp',
      name: inboxName,
      channelType: 'whatsapp',
      workspaceId: workspace.id,
    },
  });

  console.log('Seed completo.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
