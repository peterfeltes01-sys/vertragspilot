export interface Document {
  id: number;
  contractId: number;
  dateiname: string;
  dateipfad: string;
  dateityp: string;
  dateigroesse: number;
  bezeichnung?: string | null;
  kategorie: string;
  uploadDatum: string;
  createdAt: string;
}

export interface ContractHistory {
  id: number;
  contractId: number;
  datum: string;
  wirksamAb?: string | null;
  typ: string;
  titel: string;
  beschreibung?: string | null;
  feldAlt?: string | null;
  feldNeu?: string | null;
  createdAt: string;
}

export interface Reminder {
  id: number;
  contractId: number;
  bezeichnung?: string | null;
  vorlaufTage: number;
  erinnerungsDatum: string;
  typ: string;
  status: string;
  gesendetAm?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderDefault {
  id: number;
  vorlaufTage: number;
  bezeichnung: string;
  typ: string;
  aktiv: boolean;
}

export interface PriceComparison {
  id: number;
  contractId: number;
  anbieter: string;
  marktpreis: number;
  zahlungsintervall: string;
  leistung?: string | null;
  quelle?: string | null;
  gueltigBis?: string | null;
  notizen?: string | null;
  erfasstAm: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsResult {
  contractId: number;
  vertrag: string;
  kategorie: string;
  eigeneKosten: number;
  guenstigsterPreis: number;
  einsparpotenzialMonatlich: number;
  einsparpotenzialJaehrlich: number;
  guenstigsterAnbieter: PriceComparison | null;
}
