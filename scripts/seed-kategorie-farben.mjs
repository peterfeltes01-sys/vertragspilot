import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#06B6D4",
  "#84CC16", "#A855F7", "#F43F5E", "#22C55E", "#EAB308",
  "#0EA5E9", "#D946EF", "#FB923C", "#34D399", "#60A5FA",
];

async function main() {
  const kategorien = await prisma.kategorie.findMany();
  let updated = 0;

  for (const kat of kategorien) {
    if (kat.color === "#6366F1" || !kat.color) {
      const color = PALETTE[updated % PALETTE.length];
      await prisma.kategorie.update({
        where: { id: kat.id },
        data: { color },
      });
      console.log(`${kat.icon} ${kat.name} → ${color}`);
      updated++;
    }
  }

  console.log(`\n✓ ${updated} Kategorien aktualisiert`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
