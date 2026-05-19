import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function toMonthly(kosten, intervall) {
  if (!kosten) return 0;
  if (intervall === "monatlich") return kosten;
  if (intervall === "jährlich") return kosten / 12;
  if (intervall === "vierteljährlich") return kosten / 3;
  if (intervall === "halbjährlich") return kosten / 6;
  return kosten;
}

export async function GET() {
  const contracts = await prisma.contract.findMany({
    select: {
      kosten: true,
      zahlungsintervall: true,
      vertragsbeginn: true,
      aktuellerBeginn: true,
      vertragsende: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const months = [];

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

    const label = monthStart.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });

    const total = contracts
      .filter(c => {
        const trackStart = c.aktuellerBeginn
          ? new Date(c.aktuellerBeginn)
          : c.vertragsbeginn
            ? new Date(c.vertragsbeginn)
            : new Date(c.createdAt);
        const trackEnd = c.vertragsende ? new Date(c.vertragsende) : null;
        return trackStart <= monthEnd && (!trackEnd || trackEnd >= monthStart);
      })
      .reduce((sum, c) => sum + toMonthly(c.kosten, c.zahlungsintervall), 0);

    months.push({ label, total });
  }

  return NextResponse.json({ months });
}
