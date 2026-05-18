import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar';

export async function PUT(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract || !contract.naechsteKuendigung || !contract.calendarEventId) {
    return NextResponse.json({ error: 'Vertrag nicht gefunden oder nicht synchronisiert' }, { status: 404 });
  }

  try {
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
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: 'Vertrag nicht gefunden' }, { status: 404 });
  }

  if (contract.calendarEventId) {
    try {
      await deleteCalendarEvent(contract.calendarEventId);
    } catch (err) {
      console.error('Calendar delete error (non-fatal):', err.message);
    }
  }

  await prisma.contract.update({
    where: { id },
    data: { calendarSynced: false, calendarEventId: null },
  });

  return NextResponse.json({ success: true });
}
