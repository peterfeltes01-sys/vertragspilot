import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const id = parseInt((await params).id);
  const comparisons = await prisma.priceComparison.findMany({
    where: { contractId: id },
    orderBy: { erfasstAm: "desc" },
  });
  return NextResponse.json(comparisons);
}

export async function POST(request, { params }) {
  const id = parseInt((await params).id);
  const body = await request.json();

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return NextResponse.json({ error: "Vertrag nicht gefunden" }, { status: 404 });

  const { anbieter, marktpreis, zahlungsintervall, leistung, quelle, gueltigBis, notizen } = body;
  if (!anbieter || marktpreis == null) {
    return NextResponse.json({ error: "anbieter und marktpreis erforderlich" }, { status: 400 });
  }

  const comparison = await prisma.priceComparison.create({
    data: {
      contractId: id,
      anbieter,
      marktpreis: parseFloat(marktpreis),
      zahlungsintervall: zahlungsintervall || "monatlich",
      leistung: leistung || null,
      quelle: quelle || null,
      gueltigBis: gueltigBis ? new Date(gueltigBis) : null,
      notizen: notizen || null,
    },
  });

  return NextResponse.json(comparison, { status: 201 });
}