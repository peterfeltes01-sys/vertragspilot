import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const contractId = parseInt(formData.get("contractId"));
    const bezeichnung = formData.get("bezeichnung") || null;
    const kategorie = formData.get("kategorie") || "sonstiges";

    if (!file || !contractId) {
      return NextResponse.json({ error: "Datei und contractId erforderlich" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Nicht erlaubter Dateityp. Erlaubt: PDF, JPEG, PNG, WEBP" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Datei zu groß (max. 10 MB)" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) {
      return NextResponse.json({ error: "Vertrag nicht gefunden" }, { status: 404 });
    }

    const blob = await put(`contracts/${contractId}/${Date.now()}-${file.name}`, file, {
      access: "private",
    });

    const doc = await prisma.document.create({
      data: {
        contractId,
        dateiname: file.name,
        dateipfad: blob.url,
        dateityp: file.type,
        dateigroesse: file.size,
        bezeichnung,
        kategorie,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error("Upload-Fehler:", err);
    return NextResponse.json({ error: "Upload fehlgeschlagen: " + err.message }, { status: 500 });
  }
}
