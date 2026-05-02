import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const pending = await prisma.reminder.findMany({
    where: {
      status: "ausstehend",
      erinnerungsDatum: { lte: new Date() },
    },
    include: { contract: { select: { id: true, vertrag: true, kategorie: true, naechsteKuendigung: true } } },
    orderBy: { erinnerungsDatum: "asc" },
  });
  return NextResponse.json(pending);
}

export async function PATCH(request) {
  const { id, status } = await request.json();
  const reminder = await prisma.reminder.update({
    where: { id: parseInt(id) },
    data: { status, gesendetAm: status === "gesendet" ? new Date() : undefined },
  });
  return NextResponse.json(reminder);
}
