import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function prepareDates(data) {
  const dateFields = [
    "lastCheck", "vertragsbeginn", "aktuellerBeginn",
    "vertragsende", "naechsteKuendigung", "naechsteErinnerung", "kuendigungsDatum",
  ];
  for (const field of dateFields) {
    if (data[field] === "" || data[field] === undefined) data[field] = null;
    else if (data[field]) data[field] = new Date(data[field]);
  }
  if (data.kosten === "" || data.kosten === undefined) data.kosten = null;
  else if (data.kosten != null) data.kosten = parseFloat(data.kosten);
  const intFields = ["laufzeitMonate", "kuendigungsfristMonate", "verlaengerungMonate", "kontoId"];
  for (const field of intFields) {
    if (data[field] === "" || data[field] === undefined || data[field] === null) data[field] = null;
    else data[field] = parseInt(data[field]);
  }
  if (typeof data.autoVerlaengerung === "string") data.autoVerlaengerung = data.autoVerlaengerung === "true";
  if (typeof data.gekuendigt === "string") data.gekuendigt = data.gekuendigt === "true";
  if (typeof data.zuPruefen === "string") data.zuPruefen = data.zuPruefen === "true";
  // Remove computed enrichment fields (not stored in DB)
  delete data.berechnetsVertragsende;
  delete data.berechneterStatus;
  delete data.tagesBisKuendigungsfrist;
  return data;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const archiviert = searchParams.get("archiviert") === "true";
  const kategorie = searchParams.get("kategorie");
  const search = searchParams.get("search");

  const where = { archiviert };
  if (kategorie) where.kategorie = kategorie;
  if (search) {
    where.OR = [
      { vertrag: { contains: search } },
      { kategorie: { contains: search } },
      { kundennummer: { contains: search } },
      { notizen: { contains: search } },
    ];
  }

  const contracts = await prisma.contract.findMany({
    where,
    orderBy: { kategorie: "asc" },
  });

  return NextResponse.json(contracts);
}

export async function POST(request) {
  try {
    const data = await request.json();
    prepareDates(data);

    delete data.id;
    data.archiviert = data.archiviert ?? false;

    const contract = await prisma.contract.create({ data });
    return NextResponse.json(contract, { status: 201 });
  } catch (err) {
    console.error("POST /api/contracts error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
