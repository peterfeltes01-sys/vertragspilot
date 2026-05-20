export type VertragStatus = "aktiv" | "kuendigungsfrist_laeuft" | "gekuendigt" | "ausgelaufen";

interface VertragInput {
  vertragsbeginn?: Date | string | null;
  laufzeitMonate?: number | null;
  kuendigungsfristMonate?: number | null;
  autoVerlaengerung?: boolean | null;
  verlaengerungMonate?: number | null;
  gekuendigt?: boolean | null;
  zahlungsintervall?: string | null;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function berechneAktuellesVertragsende(vertrag: VertragInput): Date | null {
  if (!vertrag.vertragsbeginn || !vertrag.laufzeitMonate) return null;

  const beginn = new Date(vertrag.vertragsbeginn);
  const laufzeit = vertrag.laufzeitMonate;
  const verlaengerung = vertrag.verlaengerungMonate || laufzeit;
  const now = new Date();

  let ende = addMonths(beginn, laufzeit);

  if (vertrag.autoVerlaengerung !== false) {
    while (ende < now) {
      ende = addMonths(ende, verlaengerung);
    }
  }

  return ende;
}

export function berechneNaechsteKuendigungsfrist(vertrag: VertragInput): Date | null {
  if (!vertrag.laufzeitMonate || vertrag.kuendigungsfristMonate == null) return null;
  const ende = berechneAktuellesVertragsende(vertrag);
  if (!ende) return null;

  let frist = addMonths(ende, -vertrag.kuendigungsfristMonate);
  const now = new Date();

  // For monthly auto-renewing contracts, advance frist if it already passed
  if (
    vertrag.zahlungsintervall === "monatlich" &&
    vertrag.autoVerlaengerung !== false &&
    frist < now
  ) {
    const verlaengerung = vertrag.verlaengerungMonate || vertrag.laufzeitMonate;
    while (frist < now) {
      frist = addMonths(frist, verlaengerung);
    }
  }

  return frist;
}

export function getVertragsStatus(vertrag: VertragInput): VertragStatus {
  if (vertrag.gekuendigt) return "gekuendigt";

  const now = new Date();
  const ende = berechneAktuellesVertragsende(vertrag);

  if (ende && ende < now && !vertrag.autoVerlaengerung) return "ausgelaufen";

  const frist = berechneNaechsteKuendigungsfrist(vertrag);
  if (frist && frist <= now) return "kuendigungsfrist_laeuft";

  return "aktiv";
}

export function getTagesBisKuendigungsfrist(vertrag: VertragInput): number | null {
  const frist = berechneNaechsteKuendigungsfrist(vertrag);
  if (!frist) return null;
  return Math.ceil((frist.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
