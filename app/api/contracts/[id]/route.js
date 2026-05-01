import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function prepareDates(data) {
  const dateFields = [
    "lastCheck", "vertragsbeginn", "aktuellerBeginn",
    "vertragsende", "naechsteKuendigung", "naechsteErinnerung",
  ];
  for (const field of dateFields) {
    if (data[field] === "" || data[field] === undefined) data[field] = null;
    else if (data[field]) data[field] = new Date(data[field]);
  }
  if (data.kosten === "" || data.kosten === undefined) data.kosten = null;
  else if (data.kosten != null) data.kosten = parseFloat(data.kosten);
  return data;
}

export async function GET(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(contract);
}

export async function PUT(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const data = await request.json();
  prepareDates(data);

  delete data.id;
  delete data.createdAt;

  const contract = await prisma.contract.update({ where: { id }, data });
  return NextResponse.json(contract);
}

export async function DELETE(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  await prisma.contract.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
