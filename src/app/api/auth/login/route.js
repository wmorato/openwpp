import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma.mjs';
import { signToken, signRefreshToken } from '@/lib/jwt.mjs';

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, workspaceId: user.workspaceId });
    const refreshToken = signRefreshToken({ id: user.id });

    await prisma.session.create({
      data: { userId: user.id, token, refreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) },
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspaceId },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
