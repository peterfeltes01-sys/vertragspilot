import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCalendarEvent, createVertragsEndeCalendarEvent } from '@/lib/google-calendar';

export async function POST(request) {
  const body = await request.json();
  const type = body.type || 'kuendigung'; // 'kuendigung' | 'vertragsende'
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
      if (!contract) {
        results.push({ id, success: false, error: 'Vertrag nicht gefunden' });
        continue;
      }

      if (type === 'vertragsende') {
        // Use date sent from client (computed vertragsende), fallback to stored
        const vertragsendeDate = body.date
          ? new Date(body.date)
          : contract.vertragsende;

        if (!vertragsendeDate) {
          results.push({ id, success: false, error: 'Kein Vertragsende-Datum vorhanden' });
          continue;
        }

        const eventId = await createVertragsEndeCalendarEvent({
          id: contract.id,
          vertrag: contract.vertrag,
          kategorie: contract.kategorie,
          vertragsende: vertragsendeDate,
          kosten: contract.kosten,
          zahlungsintervall: contract.zahlungsintervall,
          kundennummer: contract.kundennummer,
        });

        await prisma.contract.update({
          where: { id },
          data: { calendarEventIdVertragsende: eventId, calendarSyncedVertragsende: true },
        });
        results.push({ id, success: true });
      } else {
        // Kündigungsfrist
        if (!contract.naechsteKuendigung) {
          results.push({ id, success: false, error: 'Kein Kündigungsfrist-Datum vorhanden' });
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
      }
    } catch (err) {
      results.push({ id, success: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
}
