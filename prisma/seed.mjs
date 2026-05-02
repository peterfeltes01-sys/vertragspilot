import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const kategorien = [
  { name: "Baufinanzierung", icon: "🏠" },
  { name: "Computer/Internet/Medien", icon: "💻" },
  { name: "Fernsehen / Internet", icon: "📺" },
  { name: "Festnetz", icon: "☎️" },
  { name: "Fitnessstudio", icon: "💪" },
  { name: "Gas", icon: "🔥" },
  { name: "Gesundheit", icon: "❤️" },
  { name: "Girokonto", icon: "🏦" },
  { name: "Hilfsorganisationen", icon: "🤝" },
  { name: "KFZ-Versicherung", icon: "🚗" },
  { name: "Kreditkarte", icon: "💳" },
  { name: "Mobilfunk", icon: "📱" },
  { name: "Nebenkosten (Haus)", icon: "🏡" },
  { name: "Pay-TV", icon: "📡" },
  { name: "Riester Rente", icon: "👴" },
  { name: "Sparplan", icon: "💰" },
  { name: "Sport und Freizeit", icon: "⚽" },
  { name: "Strom", icon: "⚡" },
  { name: "Transport", icon: "🚌" },
  { name: "Versicherung / Steuern", icon: "🛡️" },
  { name: "Wasser", icon: "💧" },
  { name: "Webservices", icon: "🌐" },
  { name: "Zeitungen", icon: "📰" },
  { name: "Telefon", icon: "📞" },
];

const d = (s) => (s ? new Date(s) : null);

const contracts = [
  { lastCheck: d("2024-04-01"), kategorie: "Baufinanzierung", vertrag: "Sparkasse Trier", web: "https://www.sparkasse-trier.de/", kundennummer: "Kreditkonto 1 (30.10.2021) - 690059639", kosten: 600, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Baufinanzierung", vertrag: "Sparkasse Trier", web: "https://www.sparkasse-trier.de/", kundennummer: "Kreditkonto 2 (30.02.2022) - 690068838", kosten: 500, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Baufinanzierung", vertrag: "Sparkasse Trier", web: "https://www.sparkasse-trier.de/", kundennummer: "Kreditkonto 3A (ab 20.11.2014 - 30.10.2024) 690157896", kosten: 305, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-02-16"), kategorie: "Fernsehen / Internet", vertrag: "Amazon Prime", web: "https://www.amazon.de/", kundennummer: "peter@feltes-online.de", kuendigungsfrist: "3 Tage vor Abbuchung", naechsteKuendigung: d("2023-01-08"), kosten: 89.90, zahlungsintervall: "jährlich" },
  { lastCheck: d("2024-02-03"), kategorie: "Fernsehen / Internet", vertrag: "Digital River (Kaspersky)", web: "kaspersky.de.cs@commerce.digitalriver.com", kundennummer: "Bestellnr: 34909276962", vertragsbeginn: d("2018-02-06"), naechsteKuendigung: d("2025-01-22"), kosten: 39.95, zahlungsintervall: "jährlich" },
  { lastCheck: d("2024-02-03"), kategorie: "Fernsehen / Internet", vertrag: "E.ON Highspeed 250", web: "https://eon-highspeed.com/", kundennummer: "FBN-00417433", kosten: 54.89, zahlungsintervall: "monatlich" },
  { lastCheck: d("2025-09-21"), kategorie: "Fernsehen / Internet", vertrag: "Google Payment Ireland", kundennummer: "069745331695191700", vertragsbeginn: d("2024-09-20"), kuendigungsfrist: "?", kosten: 19.99, zahlungsintervall: "jährlich", notizen: "100 GB" },
  { lastCheck: d("2024-06-15"), kategorie: "Fernsehen / Internet", vertrag: "Magenta (Telekom)", web: "https://www.telekom.de/", kundennummer: "peter@feltes-online.de / 73 0105 7289", vertragsbeginn: d("2023-12-09"), vertragsende: d("2025-12-08"), kuendigungsfrist: "1 Monat", naechsteKuendigung: d("2025-11-07"), kosten: 14.99, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Fernsehen / Internet", vertrag: "Rundfunkgebühren Peter", kosten: 55.08, zahlungsintervall: "vierteljährlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Fernsehen / Internet", vertrag: "Rundfunkgebühren Petra", kosten: 18.36, zahlungsintervall: "vierteljährlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Fernsehen / Internet", vertrag: "Spotify", naechsteKuendigung: d("2022-08-27"), kosten: 17.99, zahlungsintervall: "monatlich" },
  { kategorie: "Fernsehen / Internet", vertrag: "Strato - Peter" },
  { kategorie: "Fernsehen / Internet", vertrag: "Strato - Petra" },
  { lastCheck: d("2024-02-16"), kategorie: "Festnetz", vertrag: "1&1", vertragsende: d("2025-02-09"), naechsteKuendigung: d("2025-02-09"), kosten: 44.99, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Girokonto", vertrag: "Förderverein Gymnasium Konz", kosten: 25, zahlungsintervall: "jährlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Girokonto", vertrag: "Miete Pauline", kosten: 570, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Girokonto", vertrag: "Taschengeld Hannah", kosten: 120, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Girokonto", vertrag: "Taschengeld Pauline", kosten: 350, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Hilfsorganisationen", vertrag: "Plan International", kosten: 28, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-02-16"), kategorie: "Mobilfunk", vertrag: "1&1", vertragsende: d("2024-11-29"), naechsteKuendigung: d("2024-10-29"), kosten: 14.99, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-02-16"), kategorie: "Mobilfunk", vertrag: "1&1", naechsteKuendigung: d("2026-04-13"), kosten: 0, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Mobilfunk", vertrag: "Alditalk - Kombi-Paket M 12 GB", kosten: 14.99, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Mobilfunk", vertrag: "Alditalk - Kombi-Paket M 12 GB", kosten: 14.99, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Mobilfunk", vertrag: "Alditalk - Kombi-Paket S 4 GB", vertragsende: d("2024-02-26"), kosten: 7.99, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Nebenkosten (Haus)", vertrag: "123energie", naechsteKuendigung: d("2025-10-12"), kosten: 177, zahlungsintervall: "monatlich" },
  { kategorie: "Nebenkosten (Haus)", vertrag: "A.R.T. Abfall" },
  { lastCheck: d("2024-04-01"), kategorie: "Nebenkosten (Haus)", vertrag: "Grundsteuer", kosten: 252, zahlungsintervall: "jährlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Nebenkosten (Haus)", vertrag: "SWT Stadtwerke Trier", kosten: 220, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Sparplan", vertrag: "Comdirect", kosten: 25, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Sparplan", vertrag: "Comdirect", kosten: 25, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Sparplan", vertrag: "Deka", kosten: 300, zahlungsintervall: "monatlich" },
  { kategorie: "Sparplan", vertrag: "Monatlich 100 EUR Lux" },
  { kategorie: "Sport und Freizeit", vertrag: "Junetko - Tanzen" },
  { lastCheck: d("2024-04-01"), kategorie: "Sport und Freizeit", vertrag: "TG Konz / Peter", kosten: 61.5, zahlungsintervall: "vierteljährlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Sport und Freizeit", vertrag: "TG Konz / Petra", kosten: 49.5, zahlungsintervall: "vierteljährlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Sport und Freizeit", vertrag: "ZWIFT", kosten: 14.99, zahlungsintervall: "monatlich" },
  { kategorie: "Versicherung / Steuern", vertrag: "Allianz Direct - Reiseversicherung" },
  { lastCheck: d("2024-04-01"), kategorie: "Versicherung / Steuern", vertrag: "DEVK - Elementar", naechsteKuendigung: d("2023-09-30"), kosten: 20.16, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Versicherung / Steuern", vertrag: "DEVK - Haftpflicht", naechsteKuendigung: d("2023-09-30"), kosten: 9.10, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Versicherung / Steuern", vertrag: "DEVK - Hausrat", naechsteKuendigung: d("2023-09-30"), kosten: 36.30, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Versicherung / Steuern", vertrag: "DEVK - Rechtsschutz", naechsteKuendigung: d("2023-09-30"), kosten: 18.72, zahlungsintervall: "monatlich" },
  { lastCheck: d("2024-04-01"), kategorie: "Versicherung / Steuern", vertrag: "DEVK - Wohngebäude", naechsteKuendigung: d("2023-09-30"), kosten: 72.21, zahlungsintervall: "monatlich" },
  { kategorie: "Versicherung / Steuern", vertrag: "Fahrradversicherung - Peter" },
  { lastCheck: d("2024-04-01"), kategorie: "Versicherung / Steuern", vertrag: "Fahrradversicherung - Petra", vertragsende: d("2025-04-25"), naechsteKuendigung: d("2025-03-24"), kosten: 92.76, zahlungsintervall: "jährlich" },
  { kategorie: "Versicherung / Steuern", vertrag: "Steuern Auto" },
];

const reminderDefaults = [
  { vorlaufTage: 90, bezeichnung: "3 Monate vorher", typ: "dashboard", aktiv: true },
  { vorlaufTage: 42, bezeichnung: "6 Wochen vorher", typ: "dashboard", aktiv: true },
  { vorlaufTage: 14, bezeichnung: "2 Wochen vorher", typ: "dashboard", aktiv: true },
  { vorlaufTage: 3, bezeichnung: "3 Tage vorher – letzte Chance", typ: "dashboard", aktiv: true },
];

async function main() {
  console.log("🌱 Seeding Kategorien...");
  for (const kat of kategorien) {
    await prisma.kategorie.upsert({
      where: { name: kat.name },
      update: { icon: kat.icon },
      create: kat,
    });
  }

  console.log("📑 Seeding Verträge...");
  await prisma.contract.deleteMany();

  for (const c of contracts) {
    await prisma.contract.create({ data: c });
  }

  console.log("🔔 Seeding Standard-Erinnerungen...");
  await prisma.reminderDefault.deleteMany();
  for (const rd of reminderDefaults) {
    await prisma.reminderDefault.create({ data: rd });
  }

  console.log(`✅ ${kategorien.length} Kategorien, ${contracts.length} Verträge und ${reminderDefaults.length} Standard-Erinnerungen angelegt.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
