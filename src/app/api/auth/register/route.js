import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma.mjs';
import { signToken, signRefreshToken } from '@/lib/jwt.mjs';

export async function POST(req) {
  try {
    const { email, password, name, workspaceId } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'email, password, name required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const wid = workspaceId || 'default';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, passwordHash, name, workspaceId: wid },
    });

    await prisma.agent.create({
      data: { userId: user.id, workspaceId: wid },
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role, workspaceId: user.workspaceId });
    const refreshToken = signRefreshToken({ id: user.id });

    await prisma.session.create({
      data: { userId: user.id, token, refreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) },
    });

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token, refreshToken });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
