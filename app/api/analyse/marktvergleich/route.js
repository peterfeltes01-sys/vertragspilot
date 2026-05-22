import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MARKTVERGLEICH_SYSTEM_PROMPT, CLAUDE_MODEL, extractJSON } from "@/lib/analyse-prompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET() {
  const latest = await prisma.marktVergleich.findFirst({ orderBy: { createdAt: "desc" } });
  if (!latest) return NextResponse.json(null);
  return NextResponse.json({ ...latest.ergebnis, _id: latest.id, _createdAt: latest.createdAt });
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }, { status: 503 });
  }

  try {
    const { documents, contractId } = await request.json();

    const contentBlocks = [];
    const fileNames = [];

    if (contractId) {
      const docs = await prisma.document.findMany({
        where: { contractId: Number(contractId), dateityp: { contains: "pdf" } },
        orderBy: { uploadDatum: "desc" },
        take: 3,
      });

      if (docs.length === 0) {
        return NextResponse.json({ error: "Keine PDF-Dokumente für diesen Vertrag gefunden" }, { status: 400 });
      }

      for (const doc of docs) {
        try {
          const fileRes = await fetch(doc.dateipfad, {
            headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
          });
          if (fileRes.ok) {
            const buffer = await fileRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } });
            fileNames.push(doc.dateiname);
          }
        } catch {
          // skip inaccessible files
        }
      }

      if (contentBlocks.length === 0) {
        return NextResponse.json({ error: "PDFs konnten nicht geladen werden" }, { status: 502 });
      }
    } else if (documents?.length) {
      for (const doc of documents.slice(0, 3)) {
        if (!doc.base64) continue;
        contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.base64 } });
        fileNames.push(doc.name);
      }
    }

    if (contentBlocks.length === 0) {
      return NextResponse.json({ error: "Keine Dokumente übermittelt" }, { status: 400 });
    }

    contentBlocks.push({
      type: "text",
      text: `Analysiere ${fileNames.length === 1 ? "das folgende Dokument" : "die folgenden Dokumente"} (${fileNames.join(", ")}) und vergleiche die Konditionen mit dem deutschen Markt. Extrahiere alle Vertragsdaten und gib eine klare Bewertung ob der Preis marktgerecht ist.`,
    });

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: MARKTVERGLEICH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const rawText = response.content[0].text.trim();
    let analysis;
    try {
      analysis = extractJSON(rawText);
    } catch {
      return NextResponse.json({ error: "KI-Antwort konnte nicht geparst werden", raw: rawText.slice(0, 500) }, { status: 500 });
    }

    // Overwrite: delete all previous results, keep only latest
    await prisma.marktVergleich.deleteMany();
    const saved = await prisma.marktVergleich.create({ data: { ergebnis: analysis } });

    return NextResponse.json({ ...analysis, _id: saved.id, _createdAt: saved.createdAt });
  } catch (err) {
    console.error("Marktvergleich Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
