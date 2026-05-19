import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const id = parseInt((await params).id);
  const { searchParams } = new URL(request.url);
  const inline = searchParams.get("inline") === "true";

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const fileRes = await fetch(doc.dateipfad, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });
    if (!fileRes.ok) return NextResponse.json({ error: "Datei nicht abrufbar" }, { status: 502 });

    const buffer = await fileRes.arrayBuffer();
    const disposition = inline
      ? `inline; filename*=UTF-8''${encodeURIComponent(doc.dateiname)}`
      : `attachment; filename*=UTF-8''${encodeURIComponent(doc.dateiname)}`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": doc.dateityp,
        "Content-Disposition": disposition,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Download fehlgeschlagen" }, { status: 500 });
  }
}
