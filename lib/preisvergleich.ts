import type { PriceComparison, SavingsResult } from "./types";

function toMonthlyPrice(preis: number, intervall: string): number {
  if (intervall === "monatlich") return preis;
  if (intervall === "jaehrlich" || intervall === "jährlich") return preis / 12;
  if (intervall === "vierteljährlich" || intervall === "quartalsweise") return preis / 3;
  return preis;
}

export function getGuenstigsterAnbieter(vergleiche: PriceComparison[]): PriceComparison | null {
  if (!vergleiche || vergleiche.length === 0) return null;
  return vergleiche.reduce((best, v) => {
    const bestMonthly = toMonthlyPrice(best.marktpreis, best.zahlungsintervall);
    const vMonthly = toMonthlyPrice(v.marktpreis, v.zahlungsintervall);
    return vMonthly < bestMonthly ? v : best;
  });
}

export function istVergleichAktuell(vergleich: PriceComparison): boolean {
  const now = new Date();
  if (vergleich.gueltigBis && new Date(vergleich.gueltigBis) < now) return false;
  const sechsMonate = 6 * 30 * 24 * 60 * 60 * 1000;
  if (new Date(vergleich.erfasstAm).getTime() < now.getTime() - sechsMonate) return false;
  return true;
}

export function berechneEinsparpotenzial(
  eigeneKostenMonatlich: number,
  vergleiche: PriceComparison[]
): { monatlich: number; jaehrlich: number; guenstigster: PriceComparison | null } {
  const guenstigster = getGuenstigsterAnbieter(vergleiche);
  if (!guenstigster) return { monatlich: 0, jaehrlich: 0, guenstigster: null };
  const guenstigsterMonatlich = toMonthlyPrice(guenstigster.marktpreis, guenstigster.zahlungsintervall);
  const monatlich = Math.max(0, eigeneKostenMonatlich - guenstigsterMonatlich);
  return { monatlich, jaehrlich: monatlich * 12, guenstigster };
}
