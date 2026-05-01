import { prisma } from "@/lib/prisma";
import VertragsPilot from "@/components/VertragsPilot";

export const dynamic = "force-dynamic";

export default async function Home() {
  const contracts = await prisma.contract.findMany({
    where: { archiviert: false },
    orderBy: { kategorie: "asc" },
  });
  const kategorien = await prisma.kategorie.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <VertragsPilot
      initialContracts={JSON.parse(JSON.stringify(contracts))}
      kategorien={JSON.parse(JSON.stringify(kategorien))}
    />
  );
}
