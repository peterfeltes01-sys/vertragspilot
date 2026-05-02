import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(request, { params }) {
  const entryId = parseInt((await params).entryId);
  const entry = await prisma.contractHistory.findUnique({ where: { id: entryId } });
  if (!entry) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.contractHistory.delete({ where: { id: entryId } });
  return NextResponse.json({ success: true });
}