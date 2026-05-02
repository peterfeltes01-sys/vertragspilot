import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const id = parseInt((await params).id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function DELETE(request, { params }) {
  const id = parseInt((await params).id);
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    await del(doc.dateipfad);
  } catch {
    // Blob-Löschung ignorieren falls bereits weg
  }

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
