import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(request, { params }) {
  const compId = parseInt((await params).compId);
  const comparison = await prisma.priceComparison.findUnique({ where: { id: compId } });
  if (!comparison) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.priceComparison.delete({ where: { id: compId } });
  return NextResponse.json({ success: true });
}