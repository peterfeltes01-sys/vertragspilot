import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function prepareDates(data) {
  const dateFields = [
    "lastCheck", "vertragsbeginn", "aktuellerBeginn",
    "vertragsende", "naechsteKuendigung", "naechsteErinnerung", "kuendigungsDatum",
  ];
  for (const field of dateFields) {
    if (data[field] === "" || data[field] === undefined) data[field] = null;
    else if (data[field]) data[field] = new Date(data[field]);
  }
  if (data.kosten === "" || data.kosten === undefined) data.kosten = null;
  else if (data.kosten != null) data.kosten = parseFloat(data.kosten);
  const intFields = ["laufzeitMonate", "kuendigungsfristMonate", "verlaengerungMonate"];
  for (const field of intFields) {
    if (data[field] === "" || data[field] === undefined || data[field] === null) data[field] = null;
    else data[field] = parseInt(data[field]);
  }
  if (typeof data.autoVerlaengerung === "string") data.autoVerlaengerung = data.autoVerlaengerung === "true";
  if (typeof data.gekuendigt === "string") data.gekuendigt = data.gekuendigt === "true";
  if (typeof data.zuPruefen === "string") data.zuPruefen = data.zuPruefen === "true";
  delete data.berechnetsVertragsende;
  delete data.berechneterStatus;
  delete data.tagesBisKuendigungsfrist;
  return data;
}

export async function GET(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(contract);
}

const TRACKED_FIELDS = ["kosten", "zahlungsintervall", "vertragsende", "laufzeitMonate", "kuendigungsfristMonate", "autoVerlaengerung", "vertragsbeginn"];

function formatFieldValue(key, val) {
  if (val == null) return "—";
  if (key === "kosten") return `${parseFloat(val).toFixed(2)} €`;
  if (val instanceof Date) return val.toLocaleDateString("de-DE");
  return String(val);
}

export async function PUT(request, { params }) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const data = await request.json();

    const old = await prisma.contract.findUnique({ where: { id } });
    if (!old) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    prepareDates(data);
    delete data.id;
    delete data.createdAt;

    const contract = await prisma.contract.update({ where: { id }, data });

    // Auto-history für geänderte Felder
    for (const field of TRACKED_FIELDS) {
      const altVal = old[field];
      const neuVal = contract[field];
      const altStr = altVal instanceof Date ? altVal.toISOString() : String(altVal ?? "");
      const neuStr = neuVal instanceof Date ? neuVal.toISOString() : String(neuVal ?? "");
      if (altStr !== neuStr) {
        const labels = {
          kosten: "Kosten",
          zahlungsintervall: "Zahlungsintervall",
          vertragsende: "Vertragsende",
          laufzeitMonate: "Laufzeit (Monate)",
          kuendigungsfristMonate: "Kündigungsfrist (Monate)",
          autoVerlaengerung: "Auto-Verlängerung",
          vertragsbeginn: "Vertragsbeginn",
        };
        await prisma.contractHistory.create({
          data: {
            contractId: id,
            typ: field === "kosten" ? "preisaenderung" : "sonstiges",
            titel: `${labels[field] || field} geändert`,
            feldAlt: JSON.stringify({ [field]: altVal }),
            feldNeu: JSON.stringify({ [field]: neuVal }),
          },
        });
      }
    }

    // Erinnerungen bei Kündigungsfrist-Änderung neu berechnen
    if (contract.naechsteKuendigung) {
      await aktualisierErinnerungen(id, contract.naechsteKuendigung);
    }

    return NextResponse.json(contract);
  } catch (err) {
    console.error("PUT /api/contracts/[id] error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function aktualisierErinnerungen(contractId, naechsteKuendigung) {
  const defaults = await prisma.reminderDefault.findMany({ where: { aktiv: true } });
  if (defaults.length === 0) return;

  await prisma.reminder.deleteMany({ where: { contractId, status: "ausstehend" } });

  const kuendigungsDatum = new Date(naechsteKuendigung);
  for (const def of defaults) {
    const erinnerungsDatum = new Date(kuendigungsDatum);
    erinnerungsDatum.setDate(erinnerungsDatum.getDate() - def.vorlaufTage);
    if (erinnerungsDatum > new Date()) {
      await prisma.reminder.create({
        data: {
          contractId,
          bezeichnung: def.bezeichnung,
          vorlaufTage: def.vorlaufTage,
          erinnerungsDatum,
          typ: def.typ,
          status: "ausstehend",
        },
      });
    }
  }
}

export async function DELETE(request, { params }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  await prisma.contract.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
