import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(request, { params }) {
  try {
    const id = parseInt(params.id);
    const { name, icon } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
    const kat = await prisma.kategorie.update({
      where: { id },
      data: { name: name.trim(), icon: icon?.trim() || "📄" },
    });
    return NextResponse.json(kat);
  } catch (err) {
    if (err.code === "P2002") return NextResponse.json({ error: "Kategorie existiert bereits" }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const id = parseInt(params.id);
    await prisma.kategorie.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
