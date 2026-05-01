import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const kategorien = await prisma.kategorie.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(kategorien);
}
