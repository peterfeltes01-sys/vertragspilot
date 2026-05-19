import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(request, { params }) {
  try {
    const id = parseInt(params.id);
    await prisma.konto.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const id = parseInt(params.id);
    const { bezeichnung, iban } = await request.json();
    if (!bezeichnung?.trim()) return NextResponse.json({ error: "Bezeichnung erforderlich" }, { status: 400 });
    const konto = await prisma.konto.update({
      where: { id },
      data: { bezeichnung: bezeichnung.trim(), iban: iban?.trim() || null },
    });
    return NextResponse.json(konto);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
