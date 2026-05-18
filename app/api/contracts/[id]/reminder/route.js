import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const body = await request.json();

  const data = {};
  if (body.reminderEnabled !== undefined) data.reminderEnabled = Boolean(body.reminderEnabled);
  if (body.reminderDismissed !== undefined) {
    data.reminderDismissed = body.reminderDismissed ? new Date(body.reminderDismissed) : null;
  }

  const contract = await prisma.contract.update({ where: { id }, data });
  return NextResponse.json(contract);
}
