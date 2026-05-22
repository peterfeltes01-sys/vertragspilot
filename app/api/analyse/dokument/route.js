import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANALYSE_SYSTEM_PROMPT, CLAUDE_MODEL, extractJSON } from "@/lib/analyse-prompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildContractsContext(contracts) {
  return contracts.map(c => ({
    id: c.id,
    kategorie: c.kategorie,
    vertrag: c.vertrag,
    anbieter: c.vertragspartner || "Unbekannt",
    kosten: c.kosten || 0,
    zahlungsintervall: c.zahlungsintervall || "monatlich",
    vertragsbeginn: c.vertragsbeginn?.toISOString().split("T")[0] || null,
    vertragsende: c.vertragsende?.toISOString().split("T")[0] || null,
    kuendigungsfrist: c.kuendigungsfrist || null,
    naechsteKuendigung: c.naechsteKuendigung?.toISOString().split("T")[0] || null,
    dokumente: (c.dokumente || []).map(d => ({
      id: d.id,
      dateiname: d.dateiname,
      kategorie: d.kategorie,
      uploadDatum: d.uploadDatum?.toISOString().split("T")[0],
    })),
  }));
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 503 });
  }

  try {
    const { documentId } = await request.json();

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { contract: true },
    });
    if (!doc) return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
    if (!doc.dateityp.includes("pdf")) {
      return NextResponse.json({ error: "Nur PDF-Dokumente können analysiert werden" }, { status: 400 });
    }

    const fileRes = await fetch(doc.dateipfad, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!fileRes.ok) return NextResponse.json({ error: "Datei nicht abrufbar" }, { status: 502 });

    const buffer = await fileRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const contracts = await prisma.contract.findMany({
      where: { archiviert: false },
      include: { dokumente: true },
    });

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      system: ANALYSE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: `MODUS: einzeldokument\n\nBESTEHENDER VERTRAGSBESTAND:\n${JSON.stringify(buildContractsContext(contracts), null, 2)}\n\nAnalysiere das hochgeladene Dokument. Berücksichtige den bestehenden Vertragsbestand für Anbieter-Analysen und Bündelungsrabatte.`,
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

    await prisma.document.update({
      where: { id: documentId },
      data: { analyseergebnis: analysis, analysiertAm: new Date() },
    });

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Dokument-Analyse Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
