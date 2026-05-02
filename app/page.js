import { prisma } from "@/lib/prisma";
import VertragsPilot from "@/components/VertragsPilot";
import {
  berechneAktuellesVertragsende,
  berechneNaechsteKuendigungsfrist,
  getVertragsStatus,
  getTagesBisKuendigungsfrist,
} from "@/lib/vertragslogik";

export const dynamic = "force-dynamic";

export default async function Home() {
  const contracts = await prisma.contract.findMany({
    where: { archiviert: false },
    orderBy: { kategorie: "asc" },
  });
  const kategorien = await prisma.kategorie.findMany({
    orderBy: { name: "asc" },
  });

  const enriched = contracts.map((c) => {
    const berechnetsEnde = berechneAktuellesVertragsende(c);
    const berechneteKuendigungsfrist = berechneNaechsteKuendigungsfrist(c);
    const berechneterStatus = getVertragsStatus(c);
    const tagesBisKuendigungsfrist = getTagesBisKuendigungsfrist(c);
    return {
      ...c,
      naechsteKuendigung: berechneteKuendigungsfrist ?? c.naechsteKuendigung,
      berechnetsVertragsende: berechnetsEnde ?? null,
      berechneterStatus,
      tagesBisKuendigungsfrist,
    };
  });

  return (
    <VertragsPilot
      initialContracts={JSON.parse(JSON.stringify(enriched))}
      kategorien={JSON.parse(JSON.stringify(kategorien))}
    />
  );
}
