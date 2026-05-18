import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/google-calendar';

export async function POST(request) {
  const body = await request.json();
  const contractIds = body.contractId
    ? [Number(body.contractId)]
    : (body.contractIds || []).map(Number);

  if (contractIds.length === 0) {
    return NextResponse.json({ error: 'No contract IDs provided' }, { status: 400 });
  }

  const results = [];

  for (const id of contractIds) {
    try {
      const contract = await prisma.contract.findUnique({ where: { id } });
      if (!contract || !contract.naechsteKuendigung) {
        results.push({ id, success: false, error: 'Vertrag nicht gefunden oder kein Fristdatum' });
        continue;
      }

      const eventId = await createCalendarEvent({
        id: contract.id,
        vertrag: contract.vertrag,
        kategorie: contract.kategorie,
        naechsteKuendigung: contract.naechsteKuendigung,
        kosten: contract.kosten,
        zahlungsintervall: contract.zahlungsintervall,
        kuendigungsfrist: contract.kuendigungsfrist,
        kundennummer: contract.kundennummer,
      });

      await prisma.contract.update({
        where: { id },
        data: { calendarEventId: eventId, calendarSynced: true },
      });

      results.push({ id, success: true });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
}
