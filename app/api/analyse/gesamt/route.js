import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANALYSE_SYSTEM_PROMPT, CLAUDE_MODEL, extractJSON } from "@/lib/analyse-prompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function toMonthly(kosten, intervall) {
  if (!kosten) return 0;
  const map = { monatlich: 1, vierteljährlich: 3, halbjährlich: 6, jährlich: 12 };
  return kosten / (map[intervall] || 1);
}

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 503 });
  }

  try {
    const contracts = await prisma.contract.findMany({
      where: { archiviert: false },
      include: { dokumente: true },
    });

    const contractsFormatted = contracts.map(c => ({
      id: c.id,
      kategorie: c.kategorie,
      vertrag: c.vertrag,
      anbieter: c.vertragspartner || "Unbekannt",
      kosten: c.kosten || 0,
      zahlungsintervall: c.zahlungsintervall || "monatlich",
      kosten_monatlich: toMonthly(c.kosten, c.zahlungsintervall),
      vertragsbeginn: c.vertragsbeginn?.toISOString().split("T")[0] || null,
      vertragsende: c.vertragsende?.toISOString().split("T")[0] || null,
      kuendigungsfrist: c.kuendigungsfrist || null,
      naechsteKuendigung: c.naechsteKuendigung?.toISOString().split("T")[0] || null,
      gekuendigt: c.gekuendigt || false,
      dokumente: (c.dokumente || []).map(d => ({
        id: d.id,
        dateiname: d.dateiname,
        kategorie: d.kategorie,
        uploadDatum: d.uploadDatum?.toISOString().split("T")[0],
      })),
    }));

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 12000,
      system: ANALYSE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `MODUS: gesamtanalyse\n\nBESTEHENDER VERTRAGSBESTAND:\n${JSON.stringify(contractsFormatted, null, 2)}\n\nErstelle eine vollständige Analyse aller Verträge.\nBerücksichtige Bündelungsrabatte, Deckungslücken, Doppelversicherungen und Kostenoptimierung.\nDie Analyse basiert ausschließlich auf den strukturierten Vertragsdaten (keine PDFs verfügbar).`,
            },
          ],
        },
      ],
    });

    const rawText = response.content[0].text.trim();
    let analysis;
    try {
      analysis = extractJSON(rawText);
    } catch {
      return NextResponse.json({ error: "KI-Antwort konnte nicht geparst werden", raw: rawText.slice(0, 500) }, { status: 500 });
    }

    const saved = await prisma.gesamtAnalyse.create({ data: { ergebnis: analysis } });

    return NextResponse.json({ ...analysis, _id: saved.id, _createdAt: saved.createdAt });
  } catch (err) {
    console.error("Gesamtanalyse Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  const latest = await prisma.gesamtAnalyse.findFirst({ orderBy: { createdAt: "desc" } });
  if (!latest) return NextResponse.json(null);
  return NextResponse.json({ ...latest.ergebnis, _id: latest.id, _createdAt: latest.createdAt });
}
