import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in14Days = new Date(today);
  in14Days.setDate(in14Days.getDate() + 14);
  in14Days.setHours(23, 59, 59, 999);

  const contracts = await prisma.contract.findMany({
    where: {
      naechsteKuendigung: { gte: today, lte: in14Days },
      reminderEnabled: true,
      archiviert: false,
      gekuendigt: false,
    },
    orderBy: { naechsteKuendigung: 'asc' },
    select: {
      id: true,
      vertrag: true,
      kategorie: true,
      naechsteKuendigung: true,
      kosten: true,
      zahlungsintervall: true,
      kuendigungsfrist: true,
      calendarSynced: true,
      reminderDismissed: true,
    },
  });

  return NextResponse.json(contracts);
}
