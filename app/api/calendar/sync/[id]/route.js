import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  updateCalendarEvent,
  updateVertragsEndeCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/google-calendar';

export async function PUT(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const body = await request.json().catch(() => ({}));
  const type = body.type || 'kuendigung';

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: 'Vertrag nicht gefunden' }, { status: 404 });
  }

  try {
    if (type === 'vertragsende') {
      if (!contract.calendarEventIdVertragsende) {
        return NextResponse.json({ error: 'Kein Vertragsende-Event vorhanden' }, { status: 404 });
      }
      const vertragsendeDate = body.date ? new Date(body.date) : contract.vertragsende;
      if (!vertragsendeDate) {
        return NextResponse.json({ error: 'Kein Vertragsende-Datum' }, { status: 400 });
      }
      await updateVertragsEndeCalendarEvent(contract.calendarEventIdVertragsende, {
        id: contract.id,
        vertrag: contract.vertrag,
        kategorie: contract.kategorie,
        vertragsende: vertragsendeDate,
        kosten: contract.kosten,
        zahlungsintervall: contract.zahlungsintervall,
        kundennummer: contract.kundennummer,
      });
    } else {
      if (!contract.calendarEventId || !contract.naechsteKuendigung) {
        return NextResponse.json({ error: 'Kein Kündigungsfrist-Event vorhanden' }, { status: 404 });
      }
      await updateCalendarEvent(contract.calendarEventId, {
        id: contract.id,
        vertrag: contract.vertrag,
        kategorie: contract.kategorie,
        naechsteKuendigung: contract.naechsteKuendigung,
        kosten: contract.kosten,
        zahlungsintervall: contract.zahlungsintervall,
        kuendigungsfrist: contract.kuendigungsfrist,
        kundennummer: contract.kundennummer,
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'kuendigung';

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: 'Vertrag nicht gefunden' }, { status: 404 });
  }

  if (type === 'vertragsende') {
    if (contract.calendarEventIdVertragsende) {
      try {
        await deleteCalendarEvent(contract.calendarEventIdVertragsende);
      } catch (err) {
        console.error('Calendar delete vertragsende (non-fatal):', err.message);
      }
    }
    await prisma.contract.update({
      where: { id },
      data: { calendarSyncedVertragsende: false, calendarEventIdVertragsende: null },
    });
  } else {
    if (contract.calendarEventId) {
      try {
        await deleteCalendarEvent(contract.calendarEventId);
      } catch (err) {
        console.error('Calendar delete kuendigung (non-fatal):', err.message);
      }
    }
    await prisma.contract.update({
      where: { id },
      data: { calendarSynced: false, calendarEventId: null },
    });
  }

  return NextResponse.json({ success: true });
}
