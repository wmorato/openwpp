import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma.mjs';
import { verifyToken } from '@/lib/jwt.mjs';

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = verifyToken(authHeader.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, workspaceId: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
