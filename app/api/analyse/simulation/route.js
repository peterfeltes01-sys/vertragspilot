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

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 503 });
  }

  try {
    const { contractId, frage } = await request.json();

    const targetContract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { dokumente: true },
    });
    if (!targetContract) return NextResponse.json({ error: "Vertrag nicht gefunden" }, { status: 404 });

    const allContracts = await prisma.contract.findMany({
      where: { archiviert: false },
      include: { dokumente: true },
    });

    const contractsFormatted = allContracts.map(c => ({
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

    const simulationFrage = frage || `Was passiert, wenn ich den Vertrag "${targetContract.vertrag}" (${targetContract.vertragspartner || "Unbekannter Anbieter"}) kündige?`;

    const contentBlocks = [];

    // Include PDFs of the target contract (max 3, only PDFs)
    const pdfDocs = targetContract.dokumente.filter(d => d.dateityp?.includes("pdf")).slice(0, 3);
    for (const doc of pdfDocs) {
      try {
        const fileRes = await fetch(doc.dateipfad, {
          headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
        });
        if (fileRes.ok) {
          const buffer = await fileRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          contentBlocks.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          });
        }
      } catch {
        // Skip if file not accessible
      }
    }

    contentBlocks.push({
      type: "text",
      text: `MODUS: simulation\n\nBESTEHENDER VERTRAGSBESTAND:\n${JSON.stringify(contractsFormatted, null, 2)}\n\nSIMULATION: ${simulationFrage}\n\nBerechne:\n1. Direkte Ersparnis\n2. Auswirkung auf Bündelungsrabatte bei anderen ${targetContract.vertragspartner || "Anbieter"}-Verträgen\n3. Entstehende Deckungslücken\n4. Alternative Szenarien (z.B. Anbieterwechsel statt Kündigung)`,
    });

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      system: ANALYSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const rawText = response.content[0].text.trim();
    let analysis;
    try {
      analysis = extractJSON(rawText);
    } catch {
      return NextResponse.json({ error: "KI-Antwort konnte nicht geparst werden", raw: rawText.slice(0, 500) }, { status: 500 });
    }

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Simulations-Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
