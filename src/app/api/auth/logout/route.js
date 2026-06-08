import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma.mjs';
import { verifyToken } from '@/lib/jwt.mjs';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      await prisma.session.deleteMany({ where: { userId: payload.id } });
    }
  } catch {}
  return NextResponse.json({ success: true });
}
