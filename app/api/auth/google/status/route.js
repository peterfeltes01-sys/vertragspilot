import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await prisma.googleAuth.findFirst();
  if (!auth) return NextResponse.json({ connected: false, email: null });
  return NextResponse.json({ connected: true, email: auth.email });
}
