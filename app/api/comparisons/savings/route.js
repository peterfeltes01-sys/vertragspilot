import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function toMonthly(preis, intervall) {
  if (intervall === "monatlich") return preis;
  if (intervall === "jährlich" || intervall === "jaehrlich") return preis / 12;
  if (intervall === "vierteljährlich" || intervall === "quartalsweise") return preis / 3;
  return preis;
}

export async function GET() {
  const contracts = await prisma.contract.findMany({
    where: { archiviert: false, preisvergleiche: { some: {} } },
    select: {
      id: true, vertrag: true, kategorie: true, kosten: true, zahlungsintervall: true,
      preisvergleiche: true,
    },
  });

  const results = contracts
    .filter(c => c.kosten != null)
    .map(c => {
      const eigeneKostenMonatlich = toMonthly(c.kosten, c.zahlungsintervall || "monatlich");
      const guenstigster = c.preisvergleiche.reduce((best, v) => {
        if (!best) return v;
        return toMonthly(v.marktpreis, v.zahlungsintervall) < toMonthly(best.marktpreis, best.zahlungsintervall) ? v : best;
      }, null);
      const guenstigsterMonatlich = guenstigster ? toMonthly(guenstigster.marktpreis, guenstigster.zahlungsintervall) : 0;
      const einsparpotenzialMonatlich = Math.max(0, eigeneKostenMonatlich - guenstigsterMonatlich);
      return {
        contractId: c.id,
        vertrag: c.vertrag,
        kategorie: c.kategorie,
        eigeneKosten: eigeneKostenMonatlich,
        guenstigsterPreis: guenstigsterMonatlich,
        einsparpotenzialMonatlich,
        einsparpotenzialJaehrlich: einsparpotenzialMonatlich * 12,
        guenstigsterAnbieter: guenstigster,
      };
    })
    .filter(r => r.einsparpotenzialMonatlich > 0)
    .sort((a, b) => b.einsparpotenzialMonatlich - a.einsparpotenzialMonatlich);

  return NextResponse.json(results);
}
