import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(request, { params }) {
  const { id, historyId } = await params;
  const data = await request.json();

  const entry = await prisma.contractHistory.update({
    where: { id: parseInt(historyId) },
    data: {
      datum: data.datum ? new Date(data.datum) : undefined,
      wirksamAb: data.wirksamAb ? new Date(data.wirksamAb) : null,
      typ: data.typ,
      titel: data.titel,
      beschreibung: data.beschreibung || null,
      feldAlt: data.feldAlt || null,
      feldNeu: data.feldNeu || null,
    },
  });
  return NextResponse.json(entry);
}

export async function DELETE(request, { params }) {
  const { historyId } = await params;
  await prisma.contractHistory.delete({ where: { id: parseInt(historyId) } });
  return NextResponse.json({ success: true });
}
