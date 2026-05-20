import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(request, { params }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const { name, icon, color } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });

    const existing = await prisma.kategorie.findUnique({ where: { id } });
    const oldName = existing?.name;

    const kat = await prisma.kategorie.update({
      where: { id },
      data: { name: name.trim(), icon: icon?.trim() || "📄", color: color?.trim() || "#6366F1" },
    });

    if (oldName && oldName !== kat.name) {
      await prisma.contract.updateMany({
        where: { kategorie: oldName },
        data: { kategorie: kat.name },
      });
    }

    return NextResponse.json(kat);
  } catch (err) {
    if (err.code === "P2002") return NextResponse.json({ error: "Kategorie existiert bereits" }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    await prisma.kategorie.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
