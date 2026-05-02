import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(request, { params }) {
  const { comparisonId } = await params;
  const data = await request.json();

  const comparison = await prisma.priceComparison.update({
    where: { id: parseInt(comparisonId) },
    data: {
      anbieter: data.anbieter,
      marktpreis: parseFloat(data.marktpreis),
      zahlungsintervall: data.zahlungsintervall,
      leistung: data.leistung || null,
      quelle: data.quelle || null,
      gueltigBis: data.gueltigBis ? new Date(data.gueltigBis) : null,
      notizen: data.notizen || null,
    },
  });
  return NextResponse.json(comparison);
}

export async function DELETE(request, { params }) {
  const { comparisonId } = await params;
  await prisma.priceComparison.delete({ where: { id: parseInt(comparisonId) } });
  return NextResponse.json({ success: true });
}
