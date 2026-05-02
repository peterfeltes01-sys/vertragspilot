import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const id = parseInt((await params).id);
  const reminders = await prisma.reminder.findMany({
    where: { contractId: id },
    orderBy: { erinnerungsDatum: "asc" },
  });
  return NextResponse.json(reminders);
}

export async function POST(request, { params }) {
  const id = parseInt((await params).id);
  const body = await request.json();

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return NextResponse.json({ error: "Vertrag nicht gefunden" }, { status: 404 });

  const { bezeichnung, vorlaufTage, erinnerungsDatum } = body;
  if (!vorlaufTage || !erinnerungsDatum) {
    return NextResponse.json({ error: "vorlaufTage und erinnerungsDatum erforderlich" }, { status: 400 });
  }

  const reminder = await prisma.reminder.create({
    data: {
      contractId: id,
      bezeichnung: bezeichnung || null,
      vorlaufTage: parseInt(vorlaufTage),
      erinnerungsDatum: new Date(erinnerungsDatum),
      status: "ausstehend",
    },
  });

  return NextResponse.json(reminder, { status: 201 });
}

export async function DELETE(request, { params }) {
  await params;
  const { searchParams } = new URL(request.url);
  const reminderId = parseInt(searchParams.get("id"));
  if (!reminderId) return NextResponse.json({ error: "id erforderlich" }, { status: 400 });

  const reminder = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!reminder) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.reminder.delete({ where: { id: reminderId } });
  return NextResponse.json({ success: true });
}