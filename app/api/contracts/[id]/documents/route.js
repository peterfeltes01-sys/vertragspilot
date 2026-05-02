import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const id = parseInt((await params).id);
  const docs = await prisma.document.findMany({
    where: { contractId: id },
    orderBy: { uploadDatum: "desc" },
  });
  return NextResponse.json(docs);
}