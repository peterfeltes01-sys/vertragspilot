import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const kategorien = await prisma.kategorie.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(kategorien);
}

export async function POST(request) {
  try {
    const { name, icon, color } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
    const kat = await prisma.kategorie.create({ data: { name: name.trim(), icon: icon?.trim() || "📄", color: color?.trim() || "#6366F1" } });
    return NextResponse.json(kat, { status: 201 });
  } catch (err) {
    if (err.code === "P2002") return NextResponse.json({ error: "Kategorie existiert bereits" }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
