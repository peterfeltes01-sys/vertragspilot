import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const defaults = await prisma.reminderDefault.findMany({ orderBy: { vorlaufTage: "desc" } });
  return NextResponse.json(defaults);
}

export async function POST(request) {
  const data = await request.json();
  const def = await prisma.reminderDefault.create({
    data: {
      vorlaufTage: parseInt(data.vorlaufTage),
      bezeichnung: data.bezeichnung,
      typ: data.typ || "dashboard",
      aktiv: data.aktiv ?? true,
    },
  });
  return NextResponse.json(def, { status: 201 });
}

export async function PUT(request) {
  const data = await request.json();
  const def = await prisma.reminderDefault.update({
    where: { id: parseInt(data.id) },
    data: {
      vorlaufTage: parseInt(data.vorlaufTage),
      bezeichnung: data.bezeichnung,
      typ: data.typ,
      aktiv: data.aktiv,
    },
  });
  return NextResponse.json(def);
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id"));
  await prisma.reminderDefault.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
