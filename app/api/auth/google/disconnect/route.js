import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revokeGoogleToken } from '@/lib/google-calendar';

export async function POST() {
  const auth = await prisma.googleAuth.findFirst();
  if (auth) {
    try {
      await revokeGoogleToken(auth.accessToken);
    } catch {}
    await prisma.googleAuth.deleteMany();
  }

  await prisma.contract.updateMany({
    data: {
      calendarSynced: false,
      calendarEventId: null,
      calendarSyncedVertragsende: false,
      calendarEventIdVertragsende: null,
    },
  });

  return NextResponse.json({ success: true });
}
