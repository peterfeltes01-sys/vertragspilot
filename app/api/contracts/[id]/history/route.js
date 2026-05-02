import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const id = parseInt((await params).id);
  const entries = await prisma.contractHistory.findMany({
    where: { contractId: id },
    orderBy: { datum: "desc" },
  });
  return NextResponse.json(entries);
}

export async function POST(request, { params }) {
  const id = parseInt((await params).id);
  const body = await request.json();

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return NextResponse.json({ error: "Vertrag nicht gefunden" }, { status: 404 });

  const { datum, wirksamAb, typ, titel, beschreibung, feldAlt, feldNeu } = body;
  if (!titel) return NextResponse.json({ error: "Titel erforderlich" }, { status: 400 });

  const entry = await prisma.contractHistory.create({
    data: {
      contractId: id,
      datum: datum ? new Date(datum) : new Date(),
      wirksamAb: wirksamAb ? new Date(wirksamAb) : null,
      typ: typ || "sonstiges",
      titel,
      beschreibung: beschreibung || null,
      feldAlt: feldAlt || null,
      feldNeu: feldNeu || null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}