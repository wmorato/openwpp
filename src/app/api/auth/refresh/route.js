import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma.mjs';
import { verifyRefreshToken, signToken, signRefreshToken } from '@/lib/jwt.mjs';

export async function POST(req) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json({ error: 'refreshToken required' }, { status: 400 });
    }

    const payload = verifyRefreshToken(refreshToken);
    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.session.delete({ where: { id: session.id } });

    const newToken = signToken({ id: user.id, email: user.email, role: user.role, workspaceId: user.workspaceId });
    const newRefreshToken = signRefreshToken({ id: user.id });

    await prisma.session.create({
      data: { userId: user.id, token: newToken, refreshToken: newRefreshToken, expiresAt: new Date(Date.now() + 7 * 86400000) },
    });

    return NextResponse.json({ token: newToken, refreshToken: newRefreshToken });
  } catch {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }
}
