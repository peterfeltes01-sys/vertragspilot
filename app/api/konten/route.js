import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const konten = await prisma.konto.findMany({ orderBy: { bezeichnung: "asc" } });
  return NextResponse.json(konten);
}

export async function POST(request) {
  try {
    const { bezeichnung, iban } = await request.json();
    if (!bezeichnung?.trim()) return NextResponse.json({ error: "Bezeichnung erforderlich" }, { status: 400 });
    const konto = await prisma.konto.create({ data: { bezeichnung: bezeichnung.trim(), iban: iban?.trim() || null } });
    return NextResponse.json(konto, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
