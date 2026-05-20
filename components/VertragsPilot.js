"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  CATEGORY_ICONS, CATEGORY_COLORS, toMonthly,
  formatCurrency, formatDate, getDaysUntil, getWarningLevel,
} from "@/lib/utils";
import {
  berechneAktuellesVertragsende,
  berechneNaechsteKuendigungsfrist,
  getVertragsStatus,
  getTagesBisKuendigungsfrist,
} from "@/lib/vertragslogik";

// ─── Helpers ─────────────────────────────────────────

function enrichContract(raw) {
  const berechnetsEnde = berechneAktuellesVertragsende(raw);
  const berechneteKuendigungsfrist = berechneNaechsteKuendigungsfrist(raw);

  let naechsteKuendigung = berechneteKuendigungsfrist
    ? berechneteKuendigungsfrist.toISOString()
    : (raw.naechsteKuendigung ?? null);

  // For monthly contracts with a manually-stored past deadline, advance to next month
  if (raw.zahlungsintervall === "monatlich" && !berechneteKuendigungsfrist && naechsteKuendigung) {
    const d = new Date(naechsteKuendigung);
    const now = new Date();
    if (d < now) {
      while (d < now) d.setMonth(d.getMonth() + 1);
      naechsteKuendigung = d.toISOString();
    }
  }

  return {
    ...raw,
    naechsteKuendigung,
    berechnetsVertragsende: berechnetsEnde ? berechnetsEnde.toISOString() : null,
    berechneterStatus: getVertragsStatus(raw),
    tagesBisKuendigungsfrist: getTagesBisKuendigungsfrist(raw),
  };
}

function formatLaufzeit(monate) {
  if (!monate) return null;
  const years = Math.floor(monate / 12);
  const months = monate % 12;
  if (years > 0 && months > 0) return `${years} Jahr${years > 1 ? "e" : ""} ${months} Monat${months !== 1 ? "e" : ""}`;
  if (years > 0) return `${years} Jahr${years > 1 ? "e" : ""}`;
  return `${months} Monat${months !== 1 ? "e" : ""}`;
}

// ─── Reusable Components ─────────────────────────────

function Badge({ bg, color, children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

function StatusBadge({ berechneterStatus, tage, reminderEnabled = true }) {
  if (berechneterStatus === "gekuendigt")
    return <Badge bg="rgba(71,85,105,0.2)" color="#94A3B8">⚫ Gekündigt</Badge>;
  if (berechneterStatus === "ausgelaufen")
    return <Badge bg="rgba(71,85,105,0.15)" color="#64748B">⚫ Ausgelaufen</Badge>;
  if (berechneterStatus === "kuendigungsfrist_laeuft") {
    if (!reminderEnabled && tage !== null && tage < 0)
      return <Badge bg="rgba(16,185,129,0.15)" color="#34D399">🟢 Aktiv</Badge>;
    return tage !== null && tage < 0
      ? <Badge bg="rgba(220,38,38,0.2)" color="#F87171">🔴 Frist verpasst!</Badge>
      : <Badge bg="rgba(220,38,38,0.15)" color="#F87171">🔴 Frist läuft!</Badge>;
  }
  if (tage == null)
    return <Badge bg="rgba(16,185,129,0.15)" color="#34D399">🟢 Aktiv</Badge>;
  if (tage < 0)
    return <Badge bg="rgba(220,38,38,0.15)" color="#F87171">🔴 Überfällig</Badge>;
  if (tage < 30)
    return <Badge bg="rgba(220,38,38,0.15)" color="#F87171">{`🔴 ${tage}d`}</Badge>;
  if (tage <= 60)
    return <Badge bg="rgba(217,119,6,0.15)" color="#FBBF24">{`🟡 ${tage}d`}</Badge>;
  return <Badge bg="rgba(16,185,129,0.15)" color="#34D399">{`🟢 ${tage}d`}</Badge>;
}

function WarningBadge({ level }) {
  const config = {
    critical: { bg: "rgba(220,38,38,0.15)", color: "#F87171", label: "🔴 Kritisch" },
    warning: { bg: "rgba(217,119,6,0.15)", color: "#FBBF24", label: "🟡 Bald" },
    info: { bg: "rgba(59,130,246,0.15)", color: "#60A5FA", label: "🔵 Demnächst" },
    expired: { bg: "rgba(147,51,234,0.15)", color: "#C084FC", label: "⚫ Abgelaufen" },
  };
  const c = config[level];
  if (!c) return null;
  return <Badge bg={c.bg} color={c.color}>{c.label}</Badge>;
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#0F172A" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color || "#3B82F6" }} />
    </div>
  );
}

function BarChart({ data, total, colors }) {
  const max = data[0]?.[1] || 1;
  return (
    <div className="flex flex-col gap-3">
      {data.map(([cat, value]) => {
        const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
        const share = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
        const color = (colors || CATEGORY_COLORS)[cat] || "#6366F1";
        return (
          <div key={cat}>
            <div className="flex justify-between mb-1 gap-2">
              <span className="text-xs truncate" style={{ color: "#CBD5E1" }}>
                {CATEGORY_ICONS[cat] || "📄"} {cat}
              </span>
              <span className="text-xs font-bold shrink-0" style={{ color: "#F8FAFC" }}>
                {formatCurrency(value)}/Mo
              </span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "#0F172A" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KostenLineChart({ months }) {
  if (!months || months.length < 2) return null;

  const W = 480, H = 84;
  const PL = 4, PR = 4, PT = 6, PB = 20;
  const CW = W - PL - PR, CH = H - PT - PB;

  const values = months.map(m => m.total);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const isFlat = maxV === minV;
  const range = isFlat ? 1 : maxV - minV;

  const px = (i) => PL + (i / (months.length - 1)) * CW;
  const py = (v) => isFlat ? PT + CH / 2 : PT + CH - ((v - minV) / range) * CH;

  const pts = months.map((m, i) => ({ x: px(i), y: py(m.total), label: m.label, total: m.total }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length-1].x.toFixed(1)},${(H-PB).toFixed(1)} L${pts[0].x.toFixed(1)},${(H-PB).toFixed(1)} Z`;

  const first = values[0], last = values[values.length - 1];
  const diff = first > 0.1 ? ((last - first) / first * 100) : 0;
  const trendColor = diff > 3 ? "#F87171" : diff < -3 ? "#34D399" : "#64748B";
  const trendLabel = Math.abs(diff) < 1 ? "→ stabil" : diff > 0 ? `↑ +${diff.toFixed(0)}%` : `↓ ${diff.toFixed(0)}%`;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  return (
    <>
      <div className="flex justify-between text-xs mb-2">
        <span style={{ color: "#64748B" }}>{formatCurrency(first)}/Mo → {formatCurrency(last)}/Mo · Ø {formatCurrency(avg)}/Mo</span>
        <span style={{ color: trendColor, fontWeight: 700 }}>{trendLabel}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map(t => (
          <line key={t} x1={PL} y1={PT + t * CH} x2={W - PR} y2={PT + t * CH} stroke="#334155" strokeWidth="0.5" />
        ))}
        <path d={area} fill="url(#cg)" />
        <path d={line} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 3}
            fill={i === pts.length - 1 ? "#60A5FA" : "#3B82F6"} stroke="#0F172A" strokeWidth="1.5">
            <title>{`${p.label}: ${formatCurrency(p.total)}/Mo`}</title>
          </circle>
        ))}
        {pts.map((p, i) => (
          (i % 2 === 0 || i === pts.length - 1) ? (
            <text key={i} x={p.x} y={H - 1} textAnchor="middle" fontSize="9" fill="#475569">{p.label}</text>
          ) : null
        ))}
      </svg>
    </>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-xl p-3 md:p-5 border" style={{ background: `linear-gradient(135deg, ${color}12, #1E293B 60%)`, borderColor: `${color}30` }}>
      <p className="text-[9px] md:text-[11px] uppercase tracking-wider font-semibold leading-tight" style={{ color: "#64748B" }}>{label}</p>
      <p className="text-sm md:text-2xl font-extrabold mt-1 tracking-tight leading-tight break-all" style={{ color: "#F8FAFC" }}>{value}</p>
      {sub && <p className="text-[9px] md:text-xs mt-0.5 leading-tight" style={{ color: "#94A3B8" }}>{sub}</p>}
    </div>
  );
}

function Card({ children, className = "", ...props }) {
  return (
    <div className={`rounded-xl p-4 md:p-5 border border-dark-600 card-hover ${className}`} style={{ background: "#1E293B" }} {...props}>
      {children}
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", ...props }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>{label}</label>
      {type === "textarea" ? (
        <textarea
          className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none resize-y min-h-[80px]"
          style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
          value={value || ""} onChange={e => onChange(e.target.value)} {...props}
        />
      ) : (
        <input
          className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
          style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
          type={type} value={value || ""} onChange={e => onChange(e.target.value)} {...props}
        />
      )}
    </div>
  );
}

// ─── Notizen-Checkliste ──────────────────────────────

function NotizenChecklist() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vp_checklist") || "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");

  useEffect(() => {
    localStorage.setItem("vp_checklist", JSON.stringify(items));
  }, [items]);

  const add = () => {
    const text = input.trim();
    if (!text) return;
    setItems(prev => [...prev, { id: Date.now(), text, done: false }]);
    setInput("");
  };

  const toggle = (id) => setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const remove = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const clearDone = () => setItems(prev => prev.filter(i => !i.done));

  const doneCount = items.filter(i => i.done).length;

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold" style={{ color: "#F8FAFC" }}>📝 Notizen & Aufgaben</h3>
        {doneCount > 0 && (
          <button onClick={clearDone} className="text-[11px] font-semibold" style={{ color: "#475569" }}>
            {doneCount} erledigt löschen
          </button>
        )}
      </div>
      <div className="flex gap-2 mb-3">
        <input
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
          placeholder="Neue Aufgabe… (Enter)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}
        >+</button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-center py-6" style={{ color: "#475569" }}>Noch keine Einträge</p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 260 }}>
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 group"
              style={{ background: "#0F172A", border: "1px solid #1E293B" }}
            >
              <button
                onClick={() => toggle(item.id)}
                className="shrink-0 w-4 h-4 rounded flex items-center justify-center"
                style={{
                  border: `1.5px solid ${item.done ? "#3B82F6" : "#475569"}`,
                  background: item.done ? "#1D4ED8" : "transparent",
                }}
              >
                {item.done && <span className="text-[9px] text-white font-black leading-none">✓</span>}
              </button>
              <span
                className="flex-1 text-sm leading-snug"
                style={{ color: item.done ? "#475569" : "#CBD5E1", textDecoration: item.done ? "line-through" : "none" }}
              >
                {item.text}
              </span>
              <button
                onClick={() => remove(item.id)}
                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                style={{ color: "#475569" }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Dashboard ───────────────────────────────────────

function Dashboard({ contracts, navigate, katColors }) {
  const activeContracts = contracts.filter(c => c.berechneterStatus !== "gekuendigt" && c.berechneterStatus !== "ausgelaufen");
  const totalMonthly = activeContracts.reduce((s, c) => s + toMonthly(c.kosten, c.zahlungsintervall), 0);
  const [pendingReminders, setPendingReminders] = useState([]);
  const [savings, setSavings] = useState([]);

  useEffect(() => {
    fetch("/api/reminders/pending").then(r => r.ok ? r.json() : []).then(setPendingReminders).catch(() => {});
    fetch("/api/comparisons/savings").then(r => r.ok ? r.json() : []).then(setSavings).catch(() => {});
  }, []);

  const urgentContracts = useMemo(() =>
    contracts
      .filter(c => c.berechneterStatus !== "gekuendigt" && c.berechneterStatus !== "ausgelaufen")
      .map(c => ({ ...c, days: c.tagesBisKuendigungsfrist ?? getDaysUntil(c.naechsteKuendigung) }))
      .filter(c => c.days !== null && c.days <= 90)
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999)),
    [contracts]
  );

  const catCosts = useMemo(() => {
    const map = {};
    activeContracts.forEach(c => { map[c.kategorie] = (map[c.kategorie] || 0) + toMonthly(c.kosten, c.zahlungsintervall); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [activeContracts]);

  const staleContracts = contracts.filter(c => {
    if (!c.lastCheck) return true;
    return getDaysUntil(c.lastCheck) < -180;
  });

  const zuPruefenContracts = contracts.filter(c => c.zuPruefen);

  const urgentRed = urgentContracts.filter(c => (c.days ?? 999) < 30);
  const urgentYellow = urgentContracts.filter(c => { const d = c.days ?? 999; return d >= 30 && d <= 60; });

  function getDaysBorderColor(days) {
    if (days == null) return "rgba(59,130,246,0.15)";
    if (days < 30) return "rgba(220,38,38,0.3)";
    if (days <= 60) return "rgba(217,119,6,0.25)";
    return "rgba(59,130,246,0.15)";
  }

  function getDaysBg(days) {
    if (days == null) return "rgba(59,130,246,0.06)";
    if (days < 30) return "rgba(220,38,38,0.06)";
    if (days <= 60) return "rgba(217,119,6,0.04)";
    return "rgba(59,130,246,0.04)";
  }

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Dashboard</h1>
      <p className="text-sm mb-4 md:mb-6" style={{ color: "#64748B" }}>Übersicht aller Verträge und Kosten</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <StatCard label="Aktive Verträge" value={activeContracts.length} sub={`in ${catCosts.length} Kategorien`} color="#3B82F6" />
        <StatCard label="Monatliche Kosten" value={formatCurrency(totalMonthly)} sub="Gesamt pro Monat" color="#10B981" />
        <StatCard label="Jährliche Kosten" value={formatCurrency(totalMonthly * 12)} sub="Hochrechnung" color="#F59E0B" />
        <StatCard
          label="Dringende Fristen"
          value={urgentRed.length}
          sub={`${urgentYellow.length} in 30–60 Tagen`}
          color={urgentRed.length > 0 ? "#EF4444" : urgentYellow.length > 0 ? "#F59E0B" : "#10B981"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
        <Card>
          <h3 className="text-sm md:text-[15px] font-bold mb-3 md:mb-4" style={{ color: "#F8FAFC" }}>⏰ Kündigungsfristen</h3>
          {urgentContracts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-semibold" style={{ color: "#34D399" }}>Alles im grünen Bereich!</p>
              <p className="text-xs mt-1" style={{ color: "#64748B" }}>Keine Fristen in den nächsten 90 Tagen</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {urgentContracts.slice(0, 6).map(w => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer"
                  style={{ background: getDaysBg(w.days), border: `1px solid ${getDaysBorderColor(w.days)}` }}
                  onClick={() => navigate("detail", w)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: "#F8FAFC" }}>{w.vertrag}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                      {w.days !== null
                        ? (w.days < 0 ? `${Math.abs(w.days)} Tage überfällig` : `Noch ${w.days} Tage`)
                        : "prüfen"}
                      {" · "}{formatDate(w.naechsteKuendigung)}
                      {w.berechnetsVertragsende && ` · Ende: ${formatDate(w.berechnetsVertragsende)}`}
                    </div>
                  </div>
                  <StatusBadge berechneterStatus={w.berechneterStatus} tage={w.days} reminderEnabled={w.reminderEnabled} />
                </div>
              ))}
              {urgentContracts.length > 6 && (
                <button className="text-xs font-semibold mt-1" style={{ color: "#60A5FA" }} onClick={() => navigate("warnings")}>
                  Alle {urgentContracts.length} anzeigen →
                </button>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-[15px] font-bold mb-3" style={{ color: "#F8FAFC" }}>💸 Kosten nach Kategorie</h3>
          <BarChart data={catCosts.slice(0, 5)} total={totalMonthly} colors={katColors} />
        </Card>

        <NotizenChecklist />
      </div>

      {zuPruefenContracts.length > 0 && (
        <Card className="mb-4">
          <h3 className="text-[15px] font-bold mb-2" style={{ color: "#F8FAFC" }}>🔎 Zu prüfen ({zuPruefenContracts.length})</h3>
          <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Manuell zur Prüfung markiert:</p>
          <div className="flex flex-col gap-2">
            {zuPruefenContracts.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer"
                style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}
                onClick={() => navigate("detail", c)}
              >
                <span className="text-base shrink-0">🔎</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#F8FAFC" }}>{c.vertrag}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#94A3B8" }}>{c.kategorie}{c.kosten != null ? ` · ${formatCurrency(toMonthly(c.kosten, c.zahlungsintervall))}/Mo` : ""}</p>
                </div>
                <Badge bg="rgba(245,158,11,0.15)" color="#FBBF24">Zu prüfen</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {staleContracts.length > 0 && (
        <Card className="mb-4">
          <h3 className="text-[15px] font-bold mb-2" style={{ color: "#F8FAFC" }}>🔍 Überprüfung fällig</h3>
          <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>Seit über 6 Monaten nicht geprüft:</p>
          <div className="flex flex-wrap gap-2">
            {staleContracts.slice(0, 12).map(c => (
              <span key={c.id} className="cursor-pointer" onClick={() => navigate("detail", c)}>
                <Badge bg="#334155" color="#CBD5E1">{c.vertrag} · {c.lastCheck ? formatDate(c.lastCheck) : "nie"}</Badge>
              </span>
            ))}
          </div>
        </Card>
      )}

      {pendingReminders.length > 0 && (
        <Card className="mb-4">
          <h3 className="text-[15px] font-bold mb-3" style={{ color: "#F8FAFC" }}>🔔 Fällige Erinnerungen ({pendingReminders.length})</h3>
          <div className="flex flex-col gap-2">
            {pendingReminders.slice(0, 5).map(rem => {
              const days = Math.ceil((new Date(rem.erinnerungsDatum) - new Date()) / (1000 * 60 * 60 * 24));
              const color = days < -3 ? "#F87171" : days < 0 ? "#F87171" : days <= 3 ? "#F59E0B" : "#60A5FA";
              return (
                <div key={rem.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer"
                  style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)" }}
                  onClick={() => navigate("detail", { id: rem.contractId, vertrag: rem.contract?.vertrag, kategorie: rem.contract?.kategorie })}
                >
                  <span className="text-base">{days < 0 ? "🔴" : days <= 3 ? "🟡" : "🔵"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#F8FAFC" }}>{rem.contract?.vertrag || "Vertrag"}</p>
                    <p className="text-[11px]" style={{ color: "#64748B" }}>{rem.bezeichnung || `${rem.vorlaufTage} Tage Vorlauf`} · {formatDate(rem.erinnerungsDatum)}</p>
                  </div>
                  <span className="text-xs font-bold shrink-0" style={{ color }}>{days < 0 ? `${Math.abs(days)}d überfällig` : days === 0 ? "Heute" : `${days}d`}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {savings.length > 0 && (
        <Card>
          <h3 className="text-[15px] font-bold mb-1" style={{ color: "#F8FAFC" }}>💡 Einsparpotenziale</h3>
          <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>
            Gesamt: {formatCurrency(savings.reduce((s, r) => s + r.einsparpotenzialMonatlich, 0))}/Mo · {formatCurrency(savings.reduce((s, r) => s + r.einsparpotenzialJaehrlich, 0))}/Jahr
          </p>
          <div className="flex flex-col gap-2">
            {savings.slice(0, 5).map(s => (
              <div key={s.contractId} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#F8FAFC" }}>{s.vertrag}</p>
                  <p className="text-[11px]" style={{ color: "#64748B" }}>{s.guenstigsterAnbieter?.anbieter} · {formatCurrency(s.guenstigsterPreis)}/Mo</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color: "#F87171" }}>-{formatCurrency(s.einsparpotenzialMonatlich)}/Mo</p>
                  <p className="text-[11px]" style={{ color: "#64748B" }}>{formatCurrency(s.einsparpotenzialJaehrlich)}/Jahr</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function checkColor(lastCheck) {
  if (!lastCheck) return "#F87171";
  const days = getDaysUntil(lastCheck); // negative = vergangenheit
  if (days > -90) return "#34D399";
  if (days > -180) return "#FBBF24";
  return "#F87171";
}

// ─── Contract List ───────────────────────────────────

function ContractList({ contracts, navigate, onDelete, katColors }) {
  const cc = (name) => (katColors || CATEGORY_COLORS)[name] || "#6366F1";
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterInterval, setFilterInterval] = useState("all");
  const [filterMinKosten, setFilterMinKosten] = useState("");
  const [filterMaxKosten, setFilterMaxKosten] = useState("");
  const [filterDeadlineDays, setFilterDeadlineDays] = useState("all");
  const [sortBy, setSortBy] = useState("kategorie");
  const [sortDir, setSortDir] = useState("asc");

  const usedCats = [...new Set(contracts.map(c => c.kategorie))].sort();

  const filtered = useMemo(() => {
    let list = [...contracts];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.vertrag.toLowerCase().includes(s) || c.kategorie.toLowerCase().includes(s) || (c.kundennummer || "").toLowerCase().includes(s));
    }
    if (filterCat !== "all") list = list.filter(c => c.kategorie === filterCat);
    if (filterInterval !== "all") list = list.filter(c => c.zahlungsintervall === filterInterval);
    if (filterMinKosten !== "") {
      const min = parseFloat(filterMinKosten);
      if (!isNaN(min)) list = list.filter(c => toMonthly(c.kosten, c.zahlungsintervall) >= min);
    }
    if (filterMaxKosten !== "") {
      const max = parseFloat(filterMaxKosten);
      if (!isNaN(max)) list = list.filter(c => toMonthly(c.kosten, c.zahlungsintervall) <= max);
    }
    if (filterDeadlineDays === "none") {
      list = list.filter(c => !c.naechsteKuendigung);
    } else if (filterDeadlineDays !== "all") {
      const days = parseInt(filterDeadlineDays);
      list = list.filter(c => {
        const tage = c.tagesBisKuendigungsfrist;
        return tage !== null && tage >= 0 && tage <= days;
      });
    }
    list.sort((a, b) => {
      let va, vb;
      if (sortBy === "kosten") { va = toMonthly(a.kosten, a.zahlungsintervall); vb = toMonthly(b.kosten, b.zahlungsintervall); }
      else if (sortBy === "naechsteKuendigung") {
        va = a.tagesBisKuendigungsfrist ?? (a.naechsteKuendigung ? getDaysUntil(a.naechsteKuendigung) : 9999);
        vb = b.tagesBisKuendigungsfrist ?? (b.naechsteKuendigung ? getDaysUntil(b.naechsteKuendigung) : 9999);
      }
      else if (sortBy === "lastCheck") {
        va = a.lastCheck ? new Date(a.lastCheck).getTime() : 0;
        vb = b.lastCheck ? new Date(b.lastCheck).getTime() : 0;
      }
      else { va = (a[sortBy] || "zzz").toString(); vb = (b[sortBy] || "zzz").toString(); }
      return sortDir === "asc" ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
    });
    return list;
  }, [contracts, search, filterCat, filterInterval, filterMinKosten, filterMaxKosten, filterDeadlineDays, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };
  const arrow = (col) => sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const totalFiltered = filtered.reduce((s, c) => s + toMonthly(c.kosten, c.zahlungsintervall), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-0.5" style={{ color: "#F8FAFC" }}>Verträge</h1>
          <p className="text-xs md:text-sm" style={{ color: "#64748B" }}>{filtered.length} Verträge · {formatCurrency(totalFiltered)}/Mo</p>
        </div>
        <button
          className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #1D4ED8, #7C3AED)" }}
          onClick={() => navigate("form")}
        >
          + Neu
        </button>
      </div>

      {/* Filter row */}
      <div className="mb-4 flex flex-col gap-2">
        <input
          className="rounded-lg px-3.5 py-3 text-sm outline-none w-full"
          style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
          placeholder="🔍 Suchen…" value={search} onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none cursor-pointer min-w-0"
            style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
            value={filterCat} onChange={e => setFilterCat(e.target.value)}
          >
            <option value="all">Alle Kategorien</option>
            {usedCats.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
          </select>
          <select
            className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none cursor-pointer min-w-0"
            style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
            value={filterInterval} onChange={e => setFilterInterval(e.target.value)}
          >
            <option value="all">Alle Intervalle</option>
            <option value="monatlich">Monatlich</option>
            <option value="vierteljährlich">Vierteljährl.</option>
            <option value="jährlich">Jährlich</option>
          </select>
          <button
            className="shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold"
            style={{ background: sortBy === "naechsteKuendigung" ? "rgba(239,68,68,0.15)" : "#0F172A", border: "1px solid #334155", color: sortBy === "naechsteKuendigung" ? "#F87171" : "#94A3B8" }}
            onClick={() => { setSortBy("naechsteKuendigung"); setSortDir("asc"); }}
          >
            ⏰
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="number" min="0" step="0.01" placeholder="Min €/Mo"
            className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
            value={filterMinKosten} onChange={e => setFilterMinKosten(e.target.value)}
          />
          <input
            type="number" min="0" step="0.01" placeholder="Max €/Mo"
            className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
            value={filterMaxKosten} onChange={e => setFilterMaxKosten(e.target.value)}
          />
          <select
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none cursor-pointer min-w-0"
            style={{ background: "#0F172A", border: "1px solid #334155", color: filterDeadlineDays !== "all" ? "#F87171" : "#E2E8F0" }}
            value={filterDeadlineDays} onChange={e => setFilterDeadlineDays(e.target.value)}
          >
            <option value="all">Alle Fristen</option>
            <option value="14">Fällig in 14 Tagen</option>
            <option value="30">Fällig in 30 Tagen</option>
            <option value="60">Fällig in 60 Tagen</option>
            <option value="90">Fällig in 90 Tagen</option>
            <option value="none">Ohne Frist</option>
          </select>
        </div>
      </div>

      {/* ── Mobile: Kartenliste ── */}
      <div className="md:hidden flex flex-col gap-2">
        {filtered.map(c => {
          const tage = c.tagesBisKuendigungsfrist;
          const deadlineColor = tage == null ? "#64748B" : tage < 30 ? "#F87171" : tage <= 60 ? "#FBBF24" : "#64748B";
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer active:opacity-70"
              style={{ background: "#1E293B", border: "1px solid #334155" }}
              onClick={() => navigate("detail", c)}
            >
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: cc(c.kategorie) + "20" }}
              >
                {CATEGORY_ICONS[c.kategorie] || "📄"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: "#F8FAFC" }}>{c.vertrag}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs" style={{ color: "#94A3B8" }}>
                    {c.kosten != null ? formatCurrency(toMonthly(c.kosten, c.zahlungsintervall)) + "/Mo" : "—"}
                  </span>
                  {c.naechsteKuendigung && (
                    <span className="text-xs font-medium" style={{ color: deadlineColor }}>
                      {tage != null ? `⏰ ${tage}d` : `📅 ${formatDate(c.naechsteKuendigung)}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: checkColor(c.lastCheck) }}
                  />
                  <span className="text-[11px]" style={{ color: "#64748B" }}>
                    {c.lastCheck ? `Geprüft: ${formatDate(c.lastCheck)}` : "Nie geprüft"}
                  </span>
                </div>
              </div>
              <StatusBadge berechneterStatus={c.berechneterStatus} tage={tage} reminderEnabled={c.reminderEnabled} />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-sm" style={{ color: "#64748B" }}>Keine Verträge gefunden</p>
        )}
      </div>

      {/* ── Desktop: Tabelle ── */}
      <Card className="!p-0 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }}></th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("vertrag")}>Vertrag{arrow("vertrag")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("kategorie")}>Kategorie{arrow("kategorie")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("kosten")}>Kosten/Mo{arrow("kosten")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }}>Vertragsende</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("naechsteKuendigung")}>Kündigung bis{arrow("naechsteKuendigung")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("lastCheck")}>Letzter Check{arrow("lastCheck")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="contract-row cursor-pointer" onClick={() => navigate("detail", c)}>
                  <td className="p-3 border-b text-base" style={{ borderColor: "#1E293B15" }}>{CATEGORY_ICONS[c.kategorie] || "📄"}</td>
                  <td className="p-3 border-b font-semibold text-sm" style={{ borderColor: "#1E293B15", color: "#F8FAFC" }}>{c.vertrag}</td>
                  <td className="p-3 border-b text-sm" style={{ borderColor: "#1E293B15" }}>
                    <Badge bg={cc(c.kategorie) + "20"} color={cc(c.kategorie)}>{c.kategorie}</Badge>
                  </td>
                  <td className="p-3 border-b text-sm font-semibold tabular-nums" style={{ borderColor: "#1E293B15" }}>{c.kosten != null ? formatCurrency(toMonthly(c.kosten, c.zahlungsintervall)) : "—"}</td>
                  <td className="p-3 border-b text-sm" style={{ borderColor: "#1E293B15", color: "#94A3B8" }}>
                    {c.berechnetsVertragsende ? formatDate(c.berechnetsVertragsende) : (c.vertragsende ? formatDate(c.vertragsende) : "—")}
                  </td>
                  <td className="p-3 border-b text-sm" style={{ borderColor: "#1E293B15" }}>
                    {c.naechsteKuendigung ? (
                      <span>
                        <span style={{ color: "#F8FAFC" }}>{formatDate(c.naechsteKuendigung)}</span>
                        {c.tagesBisKuendigungsfrist != null && (
                          <span className="ml-2 text-xs" style={{ color: c.tagesBisKuendigungsfrist < 30 ? "#F87171" : c.tagesBisKuendigungsfrist <= 60 ? "#FBBF24" : "#64748B" }}>
                            ({c.tagesBisKuendigungsfrist}d)
                          </span>
                        )}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-3 border-b text-sm" style={{ borderColor: "#1E293B15" }}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: checkColor(c.lastCheck) }} />
                      <span style={{ color: "#CBD5E1" }}>{c.lastCheck ? formatDate(c.lastCheck) : "—"}</span>
                    </span>
                  </td>
                  <td className="p-3 border-b" style={{ borderColor: "#1E293B15" }}>
                    <StatusBadge berechneterStatus={c.berechneterStatus} tage={c.tagesBisKuendigungsfrist} reminderEnabled={c.reminderEnabled} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Detail Tab Components ────────────────────────────

function TabDocuments({ contractId }) {
  const [docs, setDocs] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form, setForm] = useState({ bezeichnung: "", kategorie: "sonstiges" });

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/documents`)
      .then(r => r.ok ? r.json() : [])
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [contractId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      alert("Dateien über 4 MB werden derzeit nicht unterstützt. Bitte eine kleinere Datei wählen.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    setUploadProgress(30);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("contractId", contractId);
    fd.append("bezeichnung", form.bezeichnung);
    fd.append("kategorie", form.kategorie);
    try {
      setUploadProgress(60);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      setUploadProgress(100);
      if (res.ok) {
        const doc = await res.json();
        setDocs(d => [doc, ...(d || [])]);
        setForm({ bezeichnung: "", kategorie: "sonstiges" });
      } else {
        const text = await res.text();
        let msg = "Upload fehlgeschlagen";
        try { msg = JSON.parse(text).error || msg; } catch { msg = text.slice(0, 120) || msg; }
        if (res.status === 413) msg = "Datei zu groß – maximal 4 MB erlaubt.";
        alert(msg);
      }
    } catch (err) {
      alert("Upload fehlgeschlagen: " + err.message);
    }
    setUploading(false);
    setTimeout(() => setUploadProgress(0), 800);
    e.target.value = "";
  };

  const handleDelete = async (id) => {
    if (!confirm("Dokument wirklich löschen?")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) setDocs(d => d.filter(x => x.id !== id));
  };

  const docIcon = (typ) => {
    if (typ?.includes("pdf")) return "📄";
    if (typ?.includes("image")) return "🖼️";
    return "📎";
  };

  const docKatLabel = { vertrag: "Vertrag", rechnung: "Rechnung", kuendigung: "Kündigung", nachweis: "Nachweis", sonstiges: "Sonstiges" };

  const formatBytes = (b) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <Card className="mb-4">
        <h3 className="text-sm font-bold mb-3" style={{ color: "#F8FAFC" }}>📎 Dokument hochladen</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Bezeichnung</label>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
              value={form.bezeichnung} onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))}
              placeholder="z.B. Kündigungsbestätigung"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Kategorie</label>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
              style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
              value={form.kategorie} onChange={e => setForm(f => ({ ...f, kategorie: e.target.value }))}
            >
              {Object.entries(docKatLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {uploadProgress > 0 && (
          <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "#0F172A" }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%`, background: "linear-gradient(90deg,#3B82F6,#7C3AED)" }} />
          </div>
        )}
        <label className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`} style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}>
          {uploading ? "⏳ Hochladen…" : "📤 Datei auswählen"}
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleUpload} disabled={uploading} />
        </label>
        <p className="text-[11px] mt-2" style={{ color: "#475569" }}>PDF, JPEG, PNG oder WEBP · max. 4 MB</p>
      </Card>

      {docs === null ? (
        <p className="text-sm text-center py-6" style={{ color: "#64748B" }}>Lade…</p>
      ) : docs.length === 0 ? (
        <Card className="text-center !py-10">
          <p className="text-3xl mb-2">📂</p>
          <p className="text-sm" style={{ color: "#64748B" }}>Noch keine Dokumente angehängt</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "#1E293B", border: "1px solid #334155" }}>
              <span className="text-2xl shrink-0">{docIcon(doc.dateityp)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#F8FAFC" }}>{doc.bezeichnung || doc.dateiname}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "#64748B" }}>
                  {doc.dateiname} · {formatBytes(doc.dateigroesse)} · {docKatLabel[doc.kategorie] || doc.kategorie} · {formatDate(doc.uploadDatum)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={`/api/documents/${doc.id}/download?inline=true`} target="_blank" rel="noopener noreferrer" className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold" style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA" }}>Öffnen</a>
                <a href={`/api/documents/${doc.id}/download`} className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold" style={{ background: "rgba(16,185,129,0.15)", color: "#34D399" }}>↓</a>
                <button onClick={() => handleDelete(doc.id)} className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold" style={{ background: "rgba(220,38,38,0.15)", color: "#F87171" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabHistory({ contractId }) {
  const [entries, setEntries] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ datum: new Date().toISOString().split("T")[0], wirksamAb: "", typ: "sonstiges", titel: "", beschreibung: "", feldAlt: "", feldNeu: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/history`)
      .then(r => r.ok ? r.json() : [])
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [contractId]);

  const handleSave = async () => {
    if (!form.titel) { alert("Bitte Titel angeben"); return; }
    setSaving(true);
    const res = await fetch(`/api/contracts/${contractId}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const entry = await res.json();
      setEntries(e => [entry, ...(e || [])]);
      setShowForm(false);
      setForm({ datum: new Date().toISOString().split("T")[0], wirksamAb: "", typ: "sonstiges", titel: "", beschreibung: "", feldAlt: "", feldNeu: "" });
    }
    setSaving(false);
  };

  const handleDeleteEntry = async (id) => {
    if (!confirm("Eintrag löschen?")) return;
    const res = await fetch(`/api/contracts/${contractId}/history/${id}`, { method: "DELETE" });
    if (res.ok) setEntries(e => e.filter(x => x.id !== id));
  };

  const typConfig = {
    preisaenderung: { icon: "💰", color: "#F59E0B", label: "Preisänderung" },
    tarifwechsel: { icon: "🔄", color: "#3B82F6", label: "Tarifwechsel" },
    verlaengerung: { icon: "📅", color: "#8B5CF6", label: "Verlängerung" },
    kuendigung: { icon: "✋", color: "#EF4444", label: "Kündigung" },
    vertragsbeginn: { icon: "🚀", color: "#10B981", label: "Vertragsbeginn" },
    sonstiges: { icon: "📝", color: "#64748B", label: "Sonstiges" },
  };

  const parseFieldChange = (alt, neu) => {
    try {
      const a = alt ? JSON.parse(alt) : null;
      const n = neu ? JSON.parse(neu) : null;
      if (!a && !n) return null;
      const key = a ? Object.keys(a)[0] : Object.keys(n)[0];
      const aVal = a?.[key];
      const nVal = n?.[key];
      if (key === "kosten") {
        const diff = (parseFloat(nVal) || 0) - (parseFloat(aVal) || 0);
        return { aVal: `${parseFloat(aVal || 0).toFixed(2)} €`, nVal: `${parseFloat(nVal || 0).toFixed(2)} €`, up: diff > 0 };
      }
      return { aVal: String(aVal ?? "—"), nVal: String(nVal ?? "—"), up: null };
    } catch { return null; }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold" style={{ color: "#F8FAFC" }}>Vertragsverlauf</h3>
        <button onClick={() => setShowForm(v => !v)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}>
          {showForm ? "Abbrechen" : "+ Eintrag"}
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Datum</label>
              <input type="date" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Typ</label>
              <select className="w-full rounded-lg px-3 py-2 text-sm outline-none cursor-pointer" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}>
                {Object.entries(typConfig).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Titel *</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} placeholder="z.B. Preiserhöhung auf 45€/Monat" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Alter Wert</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.feldAlt} onChange={e => setForm(f => ({ ...f, feldAlt: e.target.value }))} placeholder='z.B. {"kosten":29.99}' />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Neuer Wert</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.feldNeu} onChange={e => setForm(f => ({ ...f, feldNeu: e.target.value }))} placeholder='z.B. {"kosten":44.99}' />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Beschreibung</label>
              <textarea className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0", minHeight: 60 }} value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))} />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}>
            {saving ? "Speichern…" : "💾 Speichern"}
          </button>
        </Card>
      )}

      {entries === null ? (
        <p className="text-sm text-center py-6" style={{ color: "#64748B" }}>Lade…</p>
      ) : entries.length === 0 ? (
        <Card className="text-center !py-10">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm" style={{ color: "#64748B" }}>Noch keine Historieneinträge</p>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ background: "#1E293B" }} />
          <div className="flex flex-col gap-3">
            {entries.map(entry => {
              const cfg = typConfig[entry.typ] || typConfig.sonstiges;
              const change = parseFieldChange(entry.feldAlt, entry.feldNeu);
              return (
                <div key={entry.id} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg z-10" style={{ background: cfg.color + "20", border: `2px solid ${cfg.color}40` }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 rounded-xl px-4 py-3" style={{ background: "#1E293B", border: "1px solid #334155" }}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{entry.titel}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#64748B" }}>
                          {formatDate(entry.datum)}
                          {entry.wirksamAb && ` · Wirksam ab: ${formatDate(entry.wirksamAb)}`}
                          {" · "}<span style={{ color: cfg.color }}>{cfg.label}</span>
                        </p>
                      </div>
                      <button onClick={() => handleDeleteEntry(entry.id)} className="text-[11px] shrink-0" style={{ color: "#475569" }}>✕</button>
                    </div>
                    {change && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.1)", color: "#F87171" }}>{change.aVal}</span>
                        <span style={{ color: change.up === true ? "#F87171" : change.up === false ? "#34D399" : "#64748B" }}>→</span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.1)", color: "#34D399" }}>{change.nVal}</span>
                      </div>
                    )}
                    {entry.beschreibung && <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>{entry.beschreibung}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TabReminders({ contractId, naechsteKuendigung }) {
  const [reminders, setReminders] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ bezeichnung: "", vorlaufTage: "14", erinnerungsDatum: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/reminders`)
      .then(r => r.ok ? r.json() : [])
      .then(setReminders)
      .catch(() => setReminders([]));
  }, [contractId]);

  const calcErinnerungsDatum = (vorlaufTage) => {
    if (!naechsteKuendigung) return "";
    const d = new Date(naechsteKuendigung);
    d.setDate(d.getDate() - parseInt(vorlaufTage || 0));
    return d.toISOString().split("T")[0];
  };

  const handleVorlaufChange = (val) => {
    setForm(f => ({ ...f, vorlaufTage: val, erinnerungsDatum: calcErinnerungsDatum(val) }));
  };

  const handleSave = async () => {
    if (!form.vorlaufTage || !form.erinnerungsDatum) { alert("Bitte Vorlauf und Datum angeben"); return; }
    setSaving(true);
    const res = await fetch(`/api/contracts/${contractId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const rem = await res.json();
      setReminders(r => [...(r || []), rem].sort((a, b) => new Date(a.erinnerungsDatum) - new Date(b.erinnerungsDatum)));
      setShowForm(false);
      setForm({ bezeichnung: "", vorlaufTage: "14", erinnerungsDatum: "" });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const res = await fetch(`/api/contracts/${contractId}/reminders?id=${id}`, { method: "DELETE" });
    if (res.ok) setReminders(r => r.filter(x => x.id !== id));
  };

  const statusConfig = {
    ausstehend: { color: "#F59E0B", label: "Ausstehend" },
    gesendet: { color: "#3B82F6", label: "Gesendet" },
    gelesen: { color: "#10B981", label: "Gelesen" },
    ignoriert: { color: "#64748B", label: "Ignoriert" },
  };

  const getDayDiff = (dateStr) => {
    const d = new Date(dateStr) - new Date();
    return Math.ceil(d / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-sm font-bold" style={{ color: "#F8FAFC" }}>Erinnerungen</h3>
          {naechsteKuendigung && <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>Frist: {formatDate(naechsteKuendigung)}</p>}
        </div>
        <button onClick={() => setShowForm(v => !v)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}>
          {showForm ? "Abbrechen" : "+ Erinnerung"}
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Vorlauf (Tage)</label>
              <input type="number" min="1" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.vorlaufTage} onChange={e => handleVorlaufChange(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Erinnerungsdatum</label>
              <input type="date" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.erinnerungsDatum} onChange={e => setForm(f => ({ ...f, erinnerungsDatum: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Bezeichnung</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.bezeichnung} onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))} placeholder="z.B. Letzte Chance" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}>
            {saving ? "Speichern…" : "💾 Speichern"}
          </button>
        </Card>
      )}

      {reminders === null ? (
        <p className="text-sm text-center py-6" style={{ color: "#64748B" }}>Lade…</p>
      ) : reminders.length === 0 ? (
        <Card className="text-center !py-10">
          <p className="text-3xl mb-2">🔔</p>
          <p className="text-sm" style={{ color: "#64748B" }}>Keine Erinnerungen konfiguriert</p>
          {!naechsteKuendigung && <p className="text-xs mt-1" style={{ color: "#475569" }}>Tipp: Vertragsbeginn + Laufzeit + Kündigungsfrist hinterlegen, damit Erinnerungen automatisch erstellt werden.</p>}
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {reminders.map(rem => {
            const days = getDayDiff(rem.erinnerungsDatum);
            const sCfg = statusConfig[rem.status] || statusConfig.ausstehend;
            const urgency = days < 0 ? "rgba(220,38,38,0.06)" : days <= 3 ? "rgba(220,38,38,0.04)" : days <= 14 ? "rgba(217,119,6,0.04)" : "rgba(59,130,246,0.04)";
            const urgencyBorder = days < 0 ? "rgba(220,38,38,0.3)" : days <= 3 ? "rgba(220,38,38,0.2)" : days <= 14 ? "rgba(217,119,6,0.2)" : "rgba(59,130,246,0.15)";
            return (
              <div key={rem.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: urgency, border: `1px solid ${urgencyBorder}` }}>
                <span className="text-xl shrink-0">{days < 0 ? "🔴" : days <= 3 ? "🔴" : days <= 14 ? "🟡" : "🔵"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{rem.bezeichnung || `${rem.vorlaufTage} Tage Vorlauf`}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#64748B" }}>
                    {formatDate(rem.erinnerungsDatum)} · {days < 0 ? `${Math.abs(days)} Tage überfällig` : `Noch ${days} Tage`}
                  </p>
                </div>
                <Badge bg={sCfg.color + "20"} color={sCfg.color}>{sCfg.label}</Badge>
                <button onClick={() => handleDelete(rem.id)} className="text-[11px]" style={{ color: "#475569" }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabComparisons({ contractId, eigeneKosten, eignesIntervall }) {
  const [comparisons, setComparisons] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ anbieter: "", marktpreis: "", zahlungsintervall: "monatlich", leistung: "", quelle: "", gueltigBis: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/comparisons`)
      .then(r => r.ok ? r.json() : [])
      .then(setComparisons)
      .catch(() => setComparisons([]));
  }, [contractId]);

  const toMonthlyLocal = (preis, interval) => {
    if (interval === "monatlich") return preis;
    if (interval === "jährlich" || interval === "jaehrlich") return preis / 12;
    if (interval === "vierteljährlich") return preis / 3;
    return preis;
  };

  const eigeneMonatlich = toMonthlyLocal(eigeneKosten || 0, eignesIntervall || "monatlich");
  const guenstigster = comparisons?.length > 0
    ? comparisons.reduce((b, v) => toMonthlyLocal(v.marktpreis, v.zahlungsintervall) < toMonthlyLocal(b.marktpreis, b.zahlungsintervall) ? v : b)
    : null;
  const guenstigsterMonatlich = guenstigster ? toMonthlyLocal(guenstigster.marktpreis, guenstigster.zahlungsintervall) : null;
  const ersparnis = guenstigsterMonatlich !== null ? eigeneMonatlich - guenstigsterMonatlich : null;

  const handleSave = async () => {
    if (!form.anbieter || !form.marktpreis) { alert("Bitte Anbieter und Preis angeben"); return; }
    setSaving(true);
    const res = await fetch(`/api/contracts/${contractId}/comparisons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const comp = await res.json();
      setComparisons(c => [comp, ...(c || [])]);
      setShowForm(false);
      setForm({ anbieter: "", marktpreis: "", zahlungsintervall: "monatlich", leistung: "", quelle: "", gueltigBis: "" });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Vergleich löschen?")) return;
    const res = await fetch(`/api/contracts/${contractId}/comparisons/${id}`, { method: "DELETE" });
    if (res.ok) setComparisons(c => c.filter(x => x.id !== id));
  };

  const savingsColor = ersparnis === null ? "#64748B" : ersparnis > 5 ? "#EF4444" : ersparnis > 0 ? "#F59E0B" : "#10B981";
  const savingsLabel = ersparnis === null ? "Kein Vergleich" : ersparnis > 0 ? `${formatCurrency(ersparnis)}/Mo günstiger möglich` : "Günstigster Anbieter";

  return (
    <div>
      {guenstigster && (
        <Card className="mb-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#64748B" }}>Einsparpotenzial</p>
              <p className="text-xl font-extrabold mt-1" style={{ color: savingsColor }}>{savingsLabel}</p>
              {ersparnis !== null && ersparnis > 0 && (
                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                  = {formatCurrency(ersparnis * 12)}/Jahr · günstigster: {guenstigster.anbieter} ({formatCurrency(guenstigsterMonatlich)}/Mo)
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px]" style={{ color: "#64748B" }}>Aktuell</p>
              <p className="text-lg font-bold" style={{ color: "#F8FAFC" }}>{formatCurrency(eigeneMonatlich)}/Mo</p>
            </div>
          </div>
          {guenstigsterMonatlich !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] mb-1" style={{ color: "#64748B" }}>
                <span>{guenstigster.anbieter} ({formatCurrency(guenstigsterMonatlich)}/Mo)</span>
                <span>Aktuell ({formatCurrency(eigeneMonatlich)}/Mo)</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "#0F172A" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (guenstigsterMonatlich / eigeneMonatlich) * 100)}%`, background: "linear-gradient(90deg,#10B981,#3B82F6)" }} />
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold" style={{ color: "#F8FAFC" }}>Preisvergleiche</h3>
        <button onClick={() => setShowForm(v => !v)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}>
          {showForm ? "Abbrechen" : "+ Vergleich"}
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Anbieter *</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.anbieter} onChange={e => setForm(f => ({ ...f, anbieter: e.target.value }))} placeholder="z.B. 1&1" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Preis *</label>
              <input type="number" step="0.01" min="0" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.marktpreis} onChange={e => setForm(f => ({ ...f, marktpreis: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Intervall</label>
              <select className="w-full rounded-lg px-3 py-2 text-sm outline-none cursor-pointer" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.zahlungsintervall} onChange={e => setForm(f => ({ ...f, zahlungsintervall: e.target.value }))}>
                <option value="monatlich">Monatlich</option>
                <option value="jährlich">Jährlich</option>
                <option value="vierteljährlich">Vierteljährlich</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Quelle</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.quelle} onChange={e => setForm(f => ({ ...f, quelle: e.target.value }))} placeholder="z.B. check24.de" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Leistung</label>
              <input className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.leistung} onChange={e => setForm(f => ({ ...f, leistung: e.target.value }))} placeholder="z.B. 100 Mbit/s, Flat" />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Gültig bis</label>
              <input type="date" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.gueltigBis} onChange={e => setForm(f => ({ ...f, gueltigBis: e.target.value }))} />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}>
            {saving ? "Speichern…" : "💾 Speichern"}
          </button>
        </Card>
      )}

      {comparisons === null ? (
        <p className="text-sm text-center py-6" style={{ color: "#64748B" }}>Lade…</p>
      ) : comparisons.length === 0 ? (
        <Card className="text-center !py-10">
          <p className="text-3xl mb-2">💡</p>
          <p className="text-sm" style={{ color: "#64748B" }}>Noch keine Preisvergleiche erfasst</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {comparisons.map(comp => {
            const compMonatlich = toMonthlyLocal(comp.marktpreis, comp.zahlungsintervall);
            const diff = eigeneMonatlich - compMonatlich;
            const isGuenstigster = guenstigster?.id === comp.id;
            return (
              <div key={comp.id} className="rounded-xl px-4 py-3" style={{ background: "#1E293B", border: `1px solid ${isGuenstigster ? "rgba(16,185,129,0.4)" : "#334155"}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{comp.anbieter}</p>
                      {isGuenstigster && <Badge bg="rgba(16,185,129,0.15)" color="#34D399">Günstigster</Badge>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                      {formatCurrency(compMonatlich)}/Mo
                      {comp.leistung && ` · ${comp.leistung}`}
                      {comp.quelle && ` · ${comp.quelle}`}
                      {" · "}{formatDate(comp.erfasstAm)}
                    </p>
                    {diff > 0 && <p className="text-xs mt-1 font-semibold" style={{ color: "#F87171" }}>Einsparpotenzial: {formatCurrency(diff)}/Mo ({formatCurrency(diff * 12)}/Jahr)</p>}
                    {diff <= 0 && <p className="text-xs mt-1 font-semibold" style={{ color: "#34D399" }}>Günstiger als Markt ({formatCurrency(Math.abs(diff))}/Mo)</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-base font-bold" style={{ color: diff > 0 ? "#F87171" : "#34D399" }}>{formatCurrency(compMonatlich)}</p>
                    <button onClick={() => handleDelete(comp.id)} className="text-[11px]" style={{ color: "#475569" }}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Kalender ───────────────────────────────────

function TabCalendar({ contract }) {
  const [googleStatus, setGoogleStatus] = useState(null);
  const [kSynced, setKSynced] = useState(Boolean(contract.calendarSynced));
  const [vSynced, setVSynced] = useState(Boolean(contract.calendarSyncedVertragsende));
  const [kLoading, setKLoading] = useState(false);
  const [vLoading, setVLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/google/status").then(r => r.json()).then(setGoogleStatus);
  }, []);

  const vertragsendeDatum = contract.berechnetsVertragsende || contract.vertragsende;
  const hasKuendigung = Boolean(contract.naechsteKuendigung);
  const hasVertragsende = Boolean(vertragsendeDatum);

  async function syncEvent(type, setSynced, setLoading, extraDate) {
    setLoading(true);
    try {
      const body = { contractId: contract.id, type };
      if (extraDate) body.date = extraDate;
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.results?.[0]?.success) setSynced(true);
      else alert("Fehler: " + (data.results?.[0]?.error || "Unbekannt"));
    } catch (err) {
      alert("Fehler: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeEvent(type, setSynced, setLoading) {
    if (!confirm("Kalendereintrag entfernen?")) return;
    setLoading(true);
    try {
      await fetch(`/api/calendar/sync/${contract.id}?type=${type}`, { method: "DELETE" });
      setSynced(false);
    } catch (err) {
      alert("Fehler: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function CalendarRow({ label, date, synced, loading, onSync, onRemove, accentColor }) {
    return (
      <div className="flex items-center justify-between gap-3 p-4 rounded-xl" style={{ background: "#0F172A", border: "1px solid #1E293B" }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            {date ? formatDate(date) : "Kein Datum hinterlegt"}
          </p>
        </div>
        {googleStatus?.connected && date && (
          loading ? (
            <span className="text-xs shrink-0" style={{ color: "#64748B" }}>⟳ …</span>
          ) : synced ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium" style={{ color: "#34D399" }}>📅 Im Kalender ✓</span>
              <button onClick={onRemove} className="text-xs" style={{ color: "#475569" }} title="Entfernen">✕</button>
            </div>
          ) : (
            <button
              onClick={onSync}
              className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: accentColor }}
            >
              📅 Eintragen
            </button>
          )
        )}
        {googleStatus?.connected && !date && (
          <span className="text-xs shrink-0" style={{ color: "#475569" }}>—</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-[15px] font-bold mb-1" style={{ color: "#F8FAFC" }}>Google Kalender</h3>
        <p className="text-xs mb-4" style={{ color: "#64748B" }}>
          Trage Kündigungsfristen und Vertragsenden als Termine in deinen Google Kalender ein.
        </p>

        {/* Verbindungsstatus */}
        {googleStatus === null ? (
          <div className="h-10 rounded-lg mb-4 animate-pulse" style={{ background: "#1E293B" }} />
        ) : googleStatus.connected ? (
          <div className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-lg" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
            <span style={{ color: "#34D399" }}>✅</span>
            <span className="text-sm flex-1 truncate" style={{ color: "#94A3B8" }}>Verbunden als {googleStatus.email}</span>
            <button
              onClick={async () => {
                if (!confirm("Google Kalender-Verbindung trennen?")) return;
                await fetch("/api/auth/google/disconnect", { method: "POST" });
                setGoogleStatus({ connected: false, email: null });
                setKSynced(false);
                setVSynced(false);
              }}
              className="text-xs shrink-0"
              style={{ color: "#F87171" }}
            >
              Trennen
            </button>
          </div>
        ) : (
          <div className="mb-5">
            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #1D4ED8, #7C3AED)" }}
            >
              🔗 Mit Google Kalender verbinden
            </a>
            <p className="text-xs mt-2" style={{ color: "#475569" }}>
              Du wirst zu Google weitergeleitet und kehrst danach hierher zurück.
            </p>
          </div>
        )}

        {/* Event-Einträge */}
        <div className="space-y-3">
          <CalendarRow
            label="⏰ Kündigungsfrist"
            date={contract.naechsteKuendigung}
            synced={kSynced}
            loading={kLoading}
            onSync={() => syncEvent("kuendigung", setKSynced, setKLoading)}
            onRemove={() => removeEvent("kuendigung", setKSynced, setKLoading)}
            accentColor="rgba(239,68,68,0.7)"
          />
          <CalendarRow
            label="📋 Vertragsende"
            date={vertragsendeDatum}
            synced={vSynced}
            loading={vLoading}
            onSync={() => syncEvent("vertragsende", setVSynced, setVLoading, vertragsendeDatum)}
            onRemove={() => removeEvent("vertragsende", setVSynced, setVLoading)}
            accentColor="rgba(139,92,246,0.7)"
          />
        </div>

        {!googleStatus?.connected && (
          <p className="text-xs mt-4 leading-relaxed" style={{ color: "#475569" }}>
            Hinweis: Kündigungsfrist und Vertragsende werden als ganztägige Termine eingetragen.
            Google sendet automatisch Erinnerungen per E-Mail und Popup.
          </p>
        )}
      </Card>
    </div>
  );
}

// ─── Contract Detail ─────────────────────────────────

function ContractDetail({ contract, konten = [], navigate, onDelete, katColors }) {
  const cc = (name) => (katColors || CATEGORY_COLORS)[name] || "#6366F1";
  if (!contract) return null;
  const kontoName = contract.kontoId ? (konten.find(k => k.id === contract.kontoId)?.bezeichnung ?? null) : null;
  const monthly = toMonthly(contract.kosten, contract.zahlungsintervall);
  const yearly = monthly * 12;
  const tage = contract.tagesBisKuendigungsfrist ?? getDaysUntil(contract.naechsteKuendigung);
  const [activeTab, setActiveTab] = useState("uebersicht");
  const [reminderEnabled, setReminderEnabled] = useState(contract.reminderEnabled ?? true);

  const handleDelete = async () => {
    if (!confirm("Vertrag wirklich löschen?")) return;
    const res = await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
    if (res.ok) onDelete(contract.id);
  };

  const handleToggleReminder = async () => {
    const newVal = !reminderEnabled;
    setReminderEnabled(newVal);
    await fetch(`/api/contracts/${contract.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderEnabled: newVal }),
    });
  };

  const tabs = [
    { id: "uebersicht", label: "Übersicht", icon: "📋" },
    { id: "kalender", label: "Kalender", icon: "📅" },
    { id: "erinnerungen", label: "Erinnerungen", icon: "🔔" },
    { id: "dokumente", label: "Dokumente", icon: "📎" },
    { id: "verlauf", label: "Verlauf", icon: "📈" },
    { id: "preisvergleich", label: "Preisvergleich", icon: "💡" },
  ];

  return (
    <div>
      <button className="text-xs border rounded-md px-3 py-1.5 mb-5" style={{ borderColor: "#334155", color: "#94A3B8" }} onClick={() => navigate("list")}>← Zurück</button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-xl flex items-center justify-center text-2xl md:text-3xl" style={{ background: cc(contract.kategorie) + "20" }}>
          {CATEGORY_ICONS[contract.kategorie] || "📄"}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-extrabold tracking-tight truncate" style={{ color: "#F8FAFC" }}>{contract.vertrag}</h1>
          <Badge bg={cc(contract.kategorie) + "20"} color={cc(contract.kategorie)}>{contract.kategorie}</Badge>
        </div>
        <StatusBadge berechneterStatus={contract.berechneterStatus} tage={tage} reminderEnabled={reminderEnabled} />
      </div>

      {/* Kündigungsfrist verpasst Banner */}
      {contract.berechneterStatus === "kuendigungsfrist_laeuft" && tage !== null && tage < 0 && reminderEnabled && (
        <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)" }}>
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-bold" style={{ color: "#F87171" }}>Kündigungsfrist verpasst!</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#94A3B8" }}>
              Die Frist zur Kündigung lief am <strong style={{ color: "#E2E8F0" }}>{formatDate(contract.naechsteKuendigung)}</strong> ab ({Math.abs(tage)} Tage her).
              {contract.berechnetsVertragsende && <> Der Vertrag verlängert sich bis <strong style={{ color: "#E2E8F0" }}>{formatDate(contract.berechnetsVertragsende)}</strong>.</>}
            </p>
          </div>
        </div>
      )}

      {/* Mobile: kompakte horizontale Metrik-Leiste */}
      <div className="sm:hidden flex rounded-xl overflow-hidden mb-4" style={{ background: "#1E293B", border: "1px solid #334155" }}>
        {[
          { label: "Monatlich", value: formatCurrency(monthly), color: "#60A5FA" },
          { label: "Jährlich", value: formatCurrency(yearly), color: "#34D399" },
          { label: "Frist", value: tage !== null ? `${tage}d` : "—", color: tage !== null && tage < 30 ? "#F87171" : tage !== null && tage <= 60 ? "#FBBF24" : "#A78BFA" },
        ].map((m, i, arr) => (
          <div key={m.label} className="flex-1 text-center py-3" style={{ borderRight: i < arr.length - 1 ? "1px solid #334155" : "none" }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748B" }}>{m.label}</p>
            <p className="text-sm font-bold mt-0.5 px-1 break-all" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Desktop: StatCards */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4 mb-4">
        <StatCard label="Kosten / Monat" value={formatCurrency(monthly)} color="#3B82F6" />
        <StatCard label="Kosten / Jahr" value={formatCurrency(yearly)} color="#10B981" />
        <StatCard
          label="Kündigung bis"
          value={tage !== null ? `${tage} Tage` : "—"}
          sub={formatDate(contract.naechsteKuendigung)}
          color={tage !== null && tage < 30 ? "#EF4444" : tage !== null && tage <= 60 ? "#F59E0B" : "#8B5CF6"}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1" style={{ borderBottom: "1px solid #1E293B" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-t-lg transition-colors"
            style={{
              background: activeTab === tab.id ? "#1E293B" : "transparent",
              color: activeTab === tab.id ? "#F8FAFC" : "#64748B",
              borderBottom: activeTab === tab.id ? "2px solid #3B82F6" : "2px solid transparent",
            }}
          >
            <span>{tab.icon}</span>
            <span className="hidden xs:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Übersicht */}
      {activeTab === "uebersicht" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-[15px] font-bold mb-4" style={{ color: "#F8FAFC" }}>Vertragsdetails</h3>
            {[
              ["Vertragspartner", contract.vertragspartner],
              ["Kundennummer", contract.kundennummer],
              ["Vertragsbeginn", formatDate(contract.vertragsbeginn)],
              ["Berechnetes Vertragsende", formatDate(contract.berechnetsVertragsende || contract.vertragsende)],
              ["Laufzeit", formatLaufzeit(contract.laufzeitMonate) || contract.laufzeit],
              ["Kündigungsfrist", contract.kuendigungsfristMonate ? `${contract.kuendigungsfristMonate} Monate` : contract.kuendigungsfrist],
              ["Auto-Verlängerung", contract.autoVerlaengerung ? `Ja${contract.verlaengerungMonate ? `, +${formatLaufzeit(contract.verlaengerungMonate)}` : ""}` : "Nein"],
              ["Status", contract.berechneterStatus === "gekuendigt" ? "Gekündigt" : contract.berechneterStatus === "ausgelaufen" ? "Ausgelaufen" : contract.berechneterStatus === "kuendigungsfrist_laeuft" ? "Kündigungsfrist läuft!" : "Aktiv"],
              ["Kündigung am", formatDate(contract.kuendigungsDatum)],
              ["Zahlungsintervall", contract.zahlungsintervall],
              ["Zahlungskonto", kontoName],
              ["Kosten (Original)", contract.kosten != null ? `${formatCurrency(contract.kosten)} ${contract.zahlungsintervall || ""}` : null],
              ["Letzter Check", formatDate(contract.lastCheck)],
              ["Zu prüfen", contract.zuPruefen ? "Ja" : null],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-sm" style={{ color: "#94A3B8" }}>{label}</span>
                <span className="text-sm font-medium text-right max-w-[60%] break-words" style={{ color: "#E2E8F0" }}>{val || "—"}</span>
              </div>
            ))}
            <div className="flex justify-between items-center py-2">
              <span className="text-sm" style={{ color: "#94A3B8" }}>Frist-Reminder</span>
              <button
                onClick={handleToggleReminder}
                className="text-xs font-semibold rounded-md px-2.5 py-1"
                style={{ background: reminderEnabled ? "rgba(16,185,129,0.15)" : "rgba(71,85,105,0.2)", color: reminderEnabled ? "#34D399" : "#94A3B8" }}
              >
                {reminderEnabled ? "🔔 Aktiv" : "🔕 Deaktiviert"}
              </button>
            </div>
          </Card>
          <Card>
            <h3 className="text-[15px] font-bold mb-4" style={{ color: "#F8FAFC" }}>Links & Notizen</h3>
            {contract.web && (
              <div className="mb-4">
                <p className="text-[11px] uppercase font-semibold mb-1" style={{ color: "#64748B" }}>Website / Email</p>
                <a href={contract.web.startsWith("http") ? contract.web : `https://${contract.web}`} target="_blank" rel="noopener noreferrer" className="text-sm break-all" style={{ color: "#60A5FA" }}>{contract.web}</a>
              </div>
            )}
            <div className="mb-6">
              <p className="text-[11px] uppercase font-semibold mb-1" style={{ color: "#64748B" }}>Notizen</p>
              <p className="text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>{contract.notizen || "Keine Notizen"}</p>
            </div>
            <div className="flex gap-3">
              <button className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #1D4ED8, #7C3AED)" }} onClick={() => navigate("form", contract)}>✏️ Bearbeiten</button>
              <button className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #DC2626, #991B1B)" }} onClick={handleDelete}>🗑️ Löschen</button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "kalender" && <TabCalendar contract={contract} />}
      {activeTab === "dokumente" && <TabDocuments contractId={contract.id} />}
      {activeTab === "verlauf" && <TabHistory contractId={contract.id} />}
      {activeTab === "erinnerungen" && <TabReminders contractId={contract.id} naechsteKuendigung={contract.naechsteKuendigung} />}
      {activeTab === "preisvergleich" && <TabComparisons contractId={contract.id} eigeneKosten={contract.kosten} eignesIntervall={contract.zahlungsintervall} />}
    </div>
  );
}

// ─── Contract Form ───────────────────────────────────

function ContractForm({ contract, kategorien, konten = [], onKontoAdded, navigate, onSave }) {
  const isEdit = !!contract;
  const toDateInput = (d) => d ? new Date(d).toISOString().split("T")[0] : "";

  const [newKonto, setNewKonto] = useState({ show: false, bezeichnung: "", iban: "" });

  const [form, setForm] = useState({
    kategorie: contract?.kategorie || "",
    vertrag: contract?.vertrag || "",
    vertragspartner: contract?.vertragspartner || "",
    web: contract?.web || "",
    kundennummer: contract?.kundennummer || "",
    kontoId: contract?.kontoId ?? "",
    vertragsbeginn: toDateInput(contract?.vertragsbeginn),
    vertragsende: toDateInput(contract?.vertragsende),
    laufzeit: contract?.laufzeit || "",
    laufzeitJahre: contract?.laufzeitMonate != null ? Math.floor(contract.laufzeitMonate / 12) || "" : "",
    laufzeitMonateAnteil: contract?.laufzeitMonate != null ? contract.laufzeitMonate % 12 : "",
    kuendigungsfrist: contract?.kuendigungsfrist || "",
    kuendigungsfristMonate: contract?.kuendigungsfristMonate ?? "",
    autoVerlaengerung: contract?.autoVerlaengerung ?? true,
    verlaengerungMonate: contract?.verlaengerungMonate ?? "",
    naechsteKuendigung: toDateInput(contract?.naechsteKuendigung),
    naechsteErinnerung: toDateInput(contract?.naechsteErinnerung),
    kosten: contract?.kosten ?? "",
    zahlungsintervall: contract?.zahlungsintervall || "monatlich",
    gekuendigt: contract?.gekuendigt ?? false,
    kuendigungsDatum: toDateInput(contract?.kuendigungsDatum),
    notizen: contract?.notizen || "",
    lastCheck: toDateInput(contract?.lastCheck) || new Date().toISOString().split("T")[0],
    zuPruefen: contract?.zuPruefen ?? false,
  });
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.vertrag || !form.kategorie) { alert("Bitte Vertrag und Kategorie angeben!"); return; }
    setSaving(true);
    try {
      const laufzeitTotal = ((parseInt(form.laufzeitJahre) || 0) * 12 + (parseInt(form.laufzeitMonateAnteil) || 0)) || null;
      const { laufzeitJahre, laufzeitMonateAnteil, ...rest } = form;
      const payload = { ...rest, laufzeitMonate: laufzeitTotal };

      const url = isEdit ? `/api/contracts/${contract.id}` : "/api/contracts";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        onSave(saved, isEdit);
      } else {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Serverfehler ${res.status}`);
      }
    } catch (err) {
      alert("Fehler beim Speichern: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button className="text-xs border rounded-md px-3 py-1.5 mb-5" style={{ borderColor: "#334155", color: "#94A3B8" }} onClick={() => navigate(isEdit ? "detail" : "list", contract)}>← Zurück</button>
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>{isEdit ? "Vertrag bearbeiten" : "Neuer Vertrag"}</h1>
      <p className="text-sm mb-4 md:mb-6" style={{ color: "#64748B" }}>{isEdit ? `${form.vertrag} bearbeiten` : "Neuen Vertrag erfassen"}</p>

      <Card className="md:max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <InputField label="Vertragsname *" value={form.vertrag} onChange={v => update("vertrag", v)} />
          </div>
          <div className="sm:col-span-2">
            <InputField label="Vertragspartner" value={form.vertragspartner} onChange={v => update("vertragspartner", v)} placeholder="z.B. Telekom, Stadtwerke München" />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Kategorie *</label>
            <select className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none cursor-pointer" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.kategorie} onChange={e => update("kategorie", e.target.value)}>
              <option value="">Bitte wählen…</option>
              {kategorien.map(k => <option key={k.id} value={k.name}>{k.icon} {k.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Zahlungsintervall</label>
            <select className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none cursor-pointer" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={form.zahlungsintervall} onChange={e => update("zahlungsintervall", e.target.value)}>
              <option value="">Keine Angabe</option>
              <option value="monatlich">Monatlich</option>
              <option value="vierteljährlich">Vierteljährlich</option>
              <option value="jährlich">Jährlich</option>
            </select>
          </div>
          <InputField label="Kosten" value={form.kosten} onChange={v => update("kosten", v)} type="number" step="0.01" />
          <InputField label="Kundennummer" value={form.kundennummer} onChange={v => update("kundennummer", v)} />
          <div className="sm:col-span-2">
            <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Zahlungskonto</label>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-lg px-3.5 py-2.5 text-sm outline-none cursor-pointer"
                style={{ background: "#0F172A", border: "1px solid #334155", color: form.kontoId ? "#E2E8F0" : "#64748B" }}
                value={form.kontoId}
                onChange={e => update("kontoId", e.target.value)}
              >
                <option value="">— Kein Konto —</option>
                {konten.map(k => (
                  <option key={k.id} value={k.id}>{k.bezeichnung}{k.iban ? ` (${k.iban})` : ""}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNewKonto(s => ({ ...s, show: !s.show }))}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold"
                style={{ background: "#1E293B", border: "1px solid #334155", color: "#94A3B8" }}
              >
                {newKonto.show ? "✕" : "+ Konto"}
              </button>
            </div>
            {newKonto.show && (
              <div className="mt-2 p-3 rounded-lg flex flex-col gap-2" style={{ background: "#0F172A", border: "1px solid #334155" }}>
                <input
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "#1E293B", border: "1px solid #334155", color: "#E2E8F0" }}
                  placeholder="Name *  z.B. Girokonto DKB, PayPal"
                  value={newKonto.bezeichnung}
                  onChange={e => setNewKonto(s => ({ ...s, bezeichnung: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "#1E293B", border: "1px solid #334155", color: "#E2E8F0" }}
                  placeholder="IBAN / PayPal / VISA / Google Pay … (optional)"
                  value={newKonto.iban}
                  onChange={e => setNewKonto(s => ({ ...s, iban: e.target.value }))}
                />
                <button
                  type="button"
                  className="self-start rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}
                  onClick={async () => {
                    if (!newKonto.bezeichnung.trim()) return;
                    const res = await fetch("/api/konten", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bezeichnung: newKonto.bezeichnung, iban: newKonto.iban }),
                    });
                    if (res.ok) {
                      const k = await res.json();
                      onKontoAdded?.(k);
                      update("kontoId", k.id);
                      setNewKonto({ show: false, bezeichnung: "", iban: "" });
                    }
                  }}
                >
                  Konto speichern
                </button>
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <InputField label="Website / Email" value={form.web} onChange={v => update("web", v)} />
          </div>
          <InputField label="Vertragsbeginn" value={form.vertragsbeginn} onChange={v => update("vertragsbeginn", v)} type="date" />
          <InputField label="Vertragsende" value={form.vertragsende} onChange={v => update("vertragsende", v)} type="date" />
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Laufzeit</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none pr-14"
                  style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
                  type="number" min="0" placeholder="0"
                  value={form.laufzeitJahre}
                  onChange={e => update("laufzeitJahre", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: "#64748B" }}>Jahre</span>
              </div>
              <div className="flex-1 relative">
                <input
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none pr-16"
                  style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
                  type="number" min="0" max="11" placeholder="0"
                  value={form.laufzeitMonateAnteil}
                  onChange={e => update("laufzeitMonateAnteil", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: "#64748B" }}>Monate</span>
              </div>
            </div>
            {((parseInt(form.laufzeitJahre) || 0) + (parseInt(form.laufzeitMonateAnteil) || 0)) > 0 && (
              <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>
                = {formatLaufzeit((parseInt(form.laufzeitJahre) || 0) * 12 + (parseInt(form.laufzeitMonateAnteil) || 0))}
              </p>
            )}
          </div>
          <InputField label="Kündigungsfrist (Monate)" value={form.kuendigungsfristMonate} onChange={v => update("kuendigungsfristMonate", v)} type="number" min="0" placeholder="z.B. 3" />
          <InputField label="Verlängerung (Monate)" value={form.verlaengerungMonate} onChange={v => update("verlaengerungMonate", v)} type="number" min="1" placeholder="z.B. 12" />
          <div className="flex items-center gap-3 rounded-lg px-3.5 py-2.5" style={{ background: "#0F172A", border: "1px solid #334155" }}>
            <input type="checkbox" id="autoVerl" checked={!!form.autoVerlaengerung} onChange={e => update("autoVerlaengerung", e.target.checked)} className="w-4 h-4 cursor-pointer accent-blue-500" />
            <label htmlFor="autoVerl" className="text-sm cursor-pointer" style={{ color: "#E2E8F0" }}>Automatische Verlängerung</label>
          </div>
          <div className="flex items-center gap-3 rounded-lg px-3.5 py-2.5" style={{ background: "#0F172A", border: "1px solid #334155" }}>
            <input type="checkbox" id="gekuendigt" checked={!!form.gekuendigt} onChange={e => update("gekuendigt", e.target.checked)} className="w-4 h-4 cursor-pointer accent-red-500" />
            <label htmlFor="gekuendigt" className="text-sm cursor-pointer" style={{ color: "#E2E8F0" }}>Vertrag gekündigt</label>
          </div>
          {form.gekuendigt && (
            <InputField label="Kündigungsdatum" value={form.kuendigungsDatum} onChange={v => update("kuendigungsDatum", v)} type="date" />
          )}
          <div className="flex items-center gap-3 rounded-lg px-3.5 py-2.5" style={{ background: "#0F172A", border: "1px solid #334155" }}>
            <input type="checkbox" id="zuPruefen" checked={!!form.zuPruefen} onChange={e => update("zuPruefen", e.target.checked)} className="w-4 h-4 cursor-pointer accent-yellow-500" />
            <label htmlFor="zuPruefen" className="text-sm cursor-pointer" style={{ color: "#E2E8F0" }}>Zu prüfen</label>
          </div>
          <InputField label="Letzter Check" value={form.lastCheck} onChange={v => update("lastCheck", v)} type="date" />
          <div className="sm:col-span-2">
            <InputField label="Notizen" value={form.notizen} onChange={v => update("notizen", v)} type="textarea" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #1D4ED8, #7C3AED)" }} onClick={handleSave} disabled={saving}>
            {saving ? "Speichern…" : `💾 ${isEdit ? "Speichern" : "Vertrag anlegen"}`}
          </button>
          <button className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "#475569" }} onClick={() => navigate(isEdit ? "detail" : "list", contract)}>Abbrechen</button>
        </div>
      </Card>
    </div>
  );
}

// ─── Kosten-Übersicht ────────────────────────────────

function KostenUebersicht({ contracts, katColors }) {
  const aktiv = contracts.filter(c => c.berechneterStatus !== "gekuendigt" && c.berechneterStatus !== "ausgelaufen");

  const totalMonthly = aktiv.reduce((s, c) => s + toMonthly(c.kosten, c.zahlungsintervall), 0);

  const [costHistory, setCostHistory] = useState(null);
  useEffect(() => {
    fetch("/api/analytics/cost-history")
      .then(r => r.ok ? r.json() : { months: [] })
      .then(d => setCostHistory(d.months))
      .catch(() => setCostHistory([]));
  }, []);

  const catData = useMemo(() => {
    const map = {};
    aktiv.forEach(c => {
      if (!map[c.kategorie]) map[c.kategorie] = { count: 0, monthly: 0 };
      map[c.kategorie].count++;
      map[c.kategorie].monthly += toMonthly(c.kosten, c.zahlungsintervall);
    });
    return Object.entries(map).sort((a, b) => b[1].monthly - a[1].monthly);
  }, [aktiv]);

  const topContracts = useMemo(() =>
    [...aktiv].filter(c => c.kosten).sort((a, b) => toMonthly(b.kosten, b.zahlungsintervall) - toMonthly(a.kosten, a.zahlungsintervall)).slice(0, 10),
    [aktiv]
  );
  const maxContract = topContracts[0] ? toMonthly(topContracts[0].kosten, topContracts[0].zahlungsintervall) : 1;

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Kosten-Übersicht</h1>
      <p className="text-sm mb-4 md:mb-6" style={{ color: "#64748B" }}>Aufschlüsselung aller aktiven Vertragskosten</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
        <StatCard label="Monatlich gesamt" value={formatCurrency(totalMonthly)} sub={`${aktiv.length} aktive Verträge`} color="#10B981" />
        <StatCard label="Jährlich gesamt" value={formatCurrency(totalMonthly * 12)} sub="Hochrechnung" color="#3B82F6" />
        <StatCard label="Ø pro Vertrag" value={formatCurrency(totalMonthly / (aktiv.filter(c => c.kosten).length || 1))} sub="Monatsdurchschnitt" color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="text-[15px] font-bold mb-5" style={{ color: "#F8FAFC" }}>📊 Kosten nach Kategorie</h3>
          <BarChart data={catData.map(([k, v]) => [k, v.monthly])} total={totalMonthly} colors={katColors} />
        </Card>

        <Card>
          <h3 className="text-[15px] font-bold mb-5" style={{ color: "#F8FAFC" }}>🏆 Top 10 teuerste Verträge</h3>
          {topContracts.map((c, i) => {
            const m = toMonthly(c.kosten, c.zahlungsintervall);
            return (
              <div key={c.id} className="mb-3.5">
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "#CBD5E1" }}>
                    <span className="font-bold mr-1.5" style={{ color: "#64748B" }}>#{i + 1}</span>{c.vertrag}
                  </span>
                  <span className="text-xs font-bold" style={{ color: "#F8FAFC" }}>{formatCurrency(m)}/Mo</span>
                </div>
                <MiniBar value={m} max={maxContract} color={i < 3 ? "#EF4444" : "#3B82F6"} />
              </div>
            );
          })}
        </Card>
      </div>

      <Card className="mb-4">
        <h3 className="text-[15px] font-bold mb-1" style={{ color: "#F8FAFC" }}>📈 Kostenentwicklung (12 Monate)</h3>
        {costHistory === null ? (
          <p className="text-xs py-4 text-center" style={{ color: "#64748B" }}>Lade…</p>
        ) : (
          <KostenLineChart months={costHistory} />
        )}
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold mb-4" style={{ color: "#F8FAFC" }}>Nach Zahlungsintervall</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(() => {
            const map = {};
            aktiv.forEach(c => {
              const iv = c.zahlungsintervall || "Unbekannt";
              if (!map[iv]) map[iv] = { count: 0, monthly: 0 };
              map[iv].count++;
              map[iv].monthly += toMonthly(c.kosten, c.zahlungsintervall);
            });
            return Object.entries(map).map(([interval, data]) => (
              <div key={interval} className="text-center p-4 rounded-xl" style={{ background: "#0F172A" }}>
                <p className="text-xl font-extrabold" style={{ color: "#F8FAFC" }}>{data.count}</p>
                <p className="text-[11px] capitalize mt-0.5" style={{ color: "#94A3B8" }}>{interval}</p>
                <p className="text-sm font-bold mt-2" style={{ color: "#60A5FA" }}>{formatCurrency(data.monthly)}/Mo</p>
              </div>
            ));
          })()}
        </div>
      </Card>
    </div>
  );
}

// ─── Warnings ────────────────────────────────────────

function Warnings({ contracts, navigate }) {
  const all = useMemo(() =>
    contracts
      .filter(c => c.berechneterStatus !== "gekuendigt" && c.berechneterStatus !== "ausgelaufen")
      .map(c => ({
        ...c,
        level: getWarningLevel(c),
        days: c.tagesBisKuendigungsfrist ?? getDaysUntil(c.naechsteKuendigung),
      }))
      .filter(c => c.level !== "none")
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999)),
    [contracts]
  );

  const groups = [
    { key: "expired", title: "Überfällig", icon: "⚫", items: all.filter(w => w.level === "expired") },
    { key: "critical", title: "Kritisch (unter 14 Tage)", icon: "🔴", items: all.filter(w => w.level === "critical") },
    { key: "warning", title: "Bald fällig (unter 30 Tage)", icon: "🟡", items: all.filter(w => w.level === "warning") },
    { key: "info", title: "Demnächst (unter 90 Tage)", icon: "🔵", items: all.filter(w => w.level === "info") },
  ];

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Warnungen & Fristen</h1>
      <p className="text-sm mb-4 md:mb-6" style={{ color: "#64748B" }}>{all.length} Verträge mit anstehenden Fristen</p>

      {all.length === 0 ? (
        <Card className="text-center !py-12">
          <p className="text-5xl mb-3">✅</p>
          <p className="text-base font-semibold" style={{ color: "#F8FAFC" }}>Alles im grünen Bereich!</p>
          <p className="text-sm" style={{ color: "#64748B" }}>Keine anstehenden Kündigungsfristen</p>
        </Card>
      ) : (
        groups.filter(g => g.items.length > 0).map(g => (
          <div key={g.key} className="mb-6">
            <h3 className="text-sm font-bold mb-3" style={{ color: "#CBD5E1" }}>{g.icon} {g.title} ({g.items.length})</h3>
            <div className="flex flex-col gap-2">
              {g.items.map(w => (
                <div key={w.id} className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer" style={{ background: `rgba(${w.level === "critical" ? "220,38,38" : w.level === "expired" ? "147,51,234" : w.level === "warning" ? "217,119,6" : "59,130,246"},0.06)`, border: `1px solid rgba(${w.level === "critical" ? "220,38,38" : w.level === "expired" ? "147,51,234" : w.level === "warning" ? "217,119,6" : "59,130,246"},0.2)` }} onClick={() => navigate("detail", w)}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: "#F8FAFC" }}>{w.vertrag}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                      {w.kategorie} · {w.days < 0 ? `${Math.abs(w.days)} Tage überfällig` : `Noch ${w.days} Tage`} · {formatDate(w.naechsteKuendigung)}
                      {w.berechnetsVertragsende && ` · Ende: ${formatDate(w.berechnetsVertragsende)}`}
                      {w.kosten != null && ` · ${formatCurrency(toMonthly(w.kosten, w.zahlungsintervall))}/Mo`}
                    </div>
                  </div>
                  <StatusBadge berechneterStatus={w.berechneterStatus} tage={w.days} reminderEnabled={w.reminderEnabled} />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Calendar ────────────────────────────────────────

function CalendarView({ contracts }) {
  const year = new Date().getFullYear();
  const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  const events = useMemo(() =>
    contracts
      .filter(c => c.berechneterStatus !== "gekuendigt" && c.berechneterStatus !== "ausgelaufen")
      .filter(c => c.naechsteKuendigung || c.berechnetsVertragsende || c.vertragsende)
      .map(c => {
        const dateStr = c.naechsteKuendigung || c.berechnetsVertragsende || c.vertragsende;
        const d = new Date(dateStr);
        return { ...c, date: d, month: d.getMonth(), year: d.getFullYear() };
      }).filter(e => e.year === year || e.year === year + 1),
    [contracts, year]
  );

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Kalender {year}</h1>
      <p className="text-sm mb-4 md:mb-6" style={{ color: "#64748B" }}>Übersicht aller Fristen und Termine</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((name, i) => {
          const monthEvents = events.filter(e => e.month === i && e.year === year);
          const isCurrentMonth = new Date().getMonth() === i;
          return (
            <Card key={i} className={isCurrentMonth ? "!border-blue-500/30" : ""}>
              <div className="flex justify-between mb-2.5">
                <span className={`text-sm font-bold ${isCurrentMonth ? "text-blue-400" : ""}`} style={{ color: isCurrentMonth ? undefined : "#F8FAFC" }}>{name} {isCurrentMonth && "← Aktuell"}</span>
                {monthEvents.length > 0 && <Badge bg="rgba(59,130,246,0.15)" color="#60A5FA">{monthEvents.length}</Badge>}
              </div>
              {monthEvents.length === 0 ? (
                <p className="text-[11px]" style={{ color: "#475569" }}>Keine Fristen</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {monthEvents.map(e => (
                    <div key={e.id} className="text-[11px] px-2 py-1 rounded-md" style={{ background: (CATEGORY_COLORS[e.kategorie] || "#6366F1") + "15", color: "#CBD5E1" }}>
                      <span className="font-bold">{e.date.getDate()}.</span> {e.vertrag}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hilfe ───────────────────────────────────────────

function Hilfe() {
  const [open, setOpen] = useState(null);

  const sections = [
    {
      id: "uebersicht",
      icon: "📋",
      title: "Verträge verwalten",
      items: [
        { q: "Neuen Vertrag anlegen", a: "Klicke in der Vertragsliste auf \"+ Neu\". Pflichtfelder sind Vertragsname und Kategorie. Alle anderen Felder sind optional." },
        { q: "Vertrag bearbeiten", a: "Öffne einen Vertrag per Klick und wechsle zum Tab \"Übersicht\". Dort gibt es den Button \"✏️ Bearbeiten\"." },
        { q: "Vertrag löschen", a: "Im Detail-Tab \"Übersicht\" → \"🗑️ Löschen\". Achtung: alle zugehörigen Dokumente, Erinnerungen und Verlaufsdaten werden mitgelöscht." },
        { q: "Vertragspartner & Zahlungskonto", a: "Im Formular können ein Vertragspartner (z.B. Telekom) und ein Zahlungskonto (Girokonto, PayPal, VISA …) hinterlegt werden. Konten werden unter ⚙️ Einstellungen verwaltet." },
      ],
    },
    {
      id: "kuendigungsfristen",
      icon: "⏰",
      title: "Kündigungsfristen & Status",
      items: [
        { q: "Wie werden Fristen berechnet?", a: "Aus Vertragsbeginn + Laufzeit ergibt sich das Vertragsende. Aus Vertragsende − Kündigungsfrist ergibt sich die Kündigungsfrist. Diese Berechnung läuft automatisch, sobald du Laufzeit und Kündigungsfrist (in Monaten) eingibst." },
        { q: "Status-Farben", a: "🟢 Aktiv – mehr als 60 Tage bis zur Frist\n🟡 Bald – 30–60 Tage\n🔴 Kritisch – unter 30 Tage\n🔴 Frist verpasst! – Frist bereits überschritten\n⚫ Gekündigt / Ausgelaufen" },
        { q: "Auto-Verlängerung", a: "Ist die Option aktiv, verlängert sich der Vertrag nach Ablauf automatisch um die eingestellten Monate. Das neue Vertragsende und die neue Kündigungsfrist werden automatisch berechnet." },
        { q: "Vertrag als gekündigt markieren", a: "Im Formular die Checkbox \"Vertrag gekündigt\" aktivieren und das Kündigungsdatum eintragen. Der Status wechselt auf ⚫ Gekündigt." },
      ],
    },
    {
      id: "erinnerungen",
      icon: "🔔",
      title: "Erinnerungen",
      items: [
        { q: "Erinnerungen einrichten", a: "Im Detail-Tab \"Erinnerungen\" können individuelle Erinnerungen mit Vorlaufzeit angelegt werden (z.B. 14 Tage vor der Kündigungsfrist)." },
        { q: "Frist-Reminder deaktivieren", a: "Im Tab \"Übersicht\" gibt es den Button \"🔔 Aktiv\" / \"🔕 Deaktiviert\". Damit wird der Warn-Status für diesen Vertrag unterdrückt." },
        { q: "Dashboard-Erinnerungen", a: "Das Dashboard zeigt alle Erinnerungen, deren Datum heute oder früher liegt. Sie verschwinden, sobald du sie als gelesen markierst." },
      ],
    },
    {
      id: "dokumente",
      icon: "📎",
      title: "Dokumente",
      items: [
        { q: "Welche Dateien können hochgeladen werden?", a: "PDF, JPEG, PNG und WEBP – jeweils bis zu 4 MB." },
        { q: "Dokument hochladen", a: "Im Detail-Tab \"Dokumente\" → Bezeichnung und Kategorie wählen → \"📤 Datei auswählen\". Die Datei wird sicher in der Cloud gespeichert." },
        { q: "Dokument herunterladen", a: "Im Dokumenten-Tab auf den Dateinamen oder den Download-Button klicken. Private Dateien sind nur über den generierten Link zugänglich." },
      ],
    },
    {
      id: "kosten",
      icon: "💸",
      title: "Kosten-Übersicht",
      items: [
        { q: "Wie werden Kosten umgerechnet?", a: "Alle Kosten werden intern auf monatliche Basis normiert. Jährliche Kosten ÷ 12, Vierteljährliche ÷ 3. So ist der direkte Vergleich möglich." },
        { q: "Preisvergleich", a: "Im Detail-Tab \"Preisvergleich\" können Marktpreise anderer Anbieter erfasst werden. Das Einsparpotenzial wird automatisch berechnet." },
        { q: "Verlauf", a: "Jede Preisänderung oder Tarifänderung kann im Tab \"Verlauf\" manuell eingetragen werden, um die Geschichte des Vertrags nachzuvollziehen." },
      ],
    },
    {
      id: "kalender",
      icon: "📅",
      title: "Kalender & Google",
      items: [
        { q: "Google Kalender verbinden", a: "Unter ⚙️-Tab im Vertrag-Detail → Google-Konto verbinden. Danach können Kündigungsfrist und Vertragsende als Kalendertermine synchronisiert werden." },
        { q: "Kalenderübersicht", a: "Im Hauptmenü unter \"Kalender\" siehst du alle anstehenden Fristen monatsweise auf einen Blick." },
      ],
    },
    {
      id: "einstellungen",
      icon: "⚙️",
      title: "Einstellungen",
      items: [
        { q: "Kategorien anlegen & umbenennen", a: "Unter ⚙️ Einstellungen → linke Spalte. Wähle ein Emoji als Icon und gib einen Namen ein. Bestehende Kategorien können per ✏️ umbenannt werden." },
        { q: "Zahlungskonten verwalten", a: "Unter ⚙️ Einstellungen → rechte Spalte. Konten (Girokonto, PayPal, VISA …) können mit optionaler IBAN/Kennung angelegt und dann beim Vertrag ausgewählt werden." },
      ],
    },
  ];

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Hilfe & Dokumentation</h1>
      <p className="text-sm mb-6" style={{ color: "#64748B" }}>Anleitung und häufige Fragen zum VertragsPilot</p>

      {/* Schnellübersicht */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setOpen(open === s.id ? null : s.id)}
            className="flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-colors"
            style={{
              background: open === s.id ? "linear-gradient(135deg,rgba(29,78,216,0.3),rgba(124,58,237,0.3))" : "#1E293B",
              border: `1px solid ${open === s.id ? "rgba(59,130,246,0.5)" : "#334155"}`,
            }}
          >
            <span className="text-2xl">{s.icon}</span>
            <span className="text-[11px] font-semibold leading-tight" style={{ color: open === s.id ? "#93C5FD" : "#CBD5E1" }}>{s.title}</span>
          </button>
        ))}
      </div>

      {/* FAQ-Bereich */}
      <div className="flex flex-col gap-3">
        {sections.filter(s => open === null || s.id === open).map(s => (
          <Card key={s.id}>
            <div
              className="flex items-center gap-2 cursor-pointer mb-0"
              onClick={() => setOpen(open === s.id ? null : s.id)}
            >
              <span className="text-xl">{s.icon}</span>
              <h2 className="text-sm font-bold flex-1" style={{ color: "#F8FAFC" }}>{s.title}</h2>
              <span className="text-xs" style={{ color: "#64748B" }}>{open === s.id ? "▲" : "▼"}</span>
            </div>
            {(open === null || open === s.id) && (
              <div className="flex flex-col gap-1 mt-4">
                {s.items.map((item, i) => (
                  <details key={i} className="group rounded-lg overflow-hidden" style={{ background: "#0F172A", border: "1px solid #1E293B" }}>
                    <summary
                      className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-semibold list-none"
                      style={{ color: "#E2E8F0" }}
                    >
                      <span>{item.q}</span>
                      <span className="text-xs shrink-0 ml-2" style={{ color: "#64748B" }}>▸</span>
                    </summary>
                    <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-line" style={{ color: "#94A3B8", borderTop: "1px solid #1E293B" }}>
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>
          <strong style={{ color: "#64748B" }}>VertragsPilot</strong> — Alle Daten werden sicher in einer PostgreSQL-Datenbank (Neon) gespeichert. Dokumente liegen verschlüsselt im Vercel Blob-Speicher. Es werden keine Daten an Dritte weitergegeben.
        </p>
      </Card>
    </div>
  );
}

// ─── Einstellungen ───────────────────────────────────

function Einstellungen({ kategorien, setKategorien, konten, setKonten, setContracts }) {
  const [katForm, setKatForm] = useState({ name: "", icon: "📄", color: "#6366F1" });
  const [editKat, setEditKat] = useState(null);
  const [kontoForm, setKontoForm] = useState({ bezeichnung: "", iban: "" });
  const [editKonto, setEditKonto] = useState(null);
  const [saving, setSaving] = useState(false);

  const ICON_SUGGESTIONS = ["📄","💡","🚗","🏠","📱","💳","🎵","🎮","🏋️","🌍","💼","🐾","🍕","✈️","🔧","🎓","🏥","⚡"];

  const saveKat = async () => {
    const data = editKat || katForm;
    if (!data.name.trim()) return;
    setSaving(true);
    if (editKat) {
      const oldName = kategorien.find(k => k.id === editKat.id)?.name;
      const res = await fetch(`/api/kategorien/${editKat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editKat.name, icon: editKat.icon, color: editKat.color || "#6366F1" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setKategorien(ks => ks.map(k => k.id === updated.id ? updated : k));
        if (oldName && oldName !== updated.name) {
          setContracts(cs => cs.map(c => c.kategorie === oldName ? { ...c, kategorie: updated.name } : c));
        }
        setEditKat(null);
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } else {
      const res = await fetch("/api/kategorien", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(katForm),
      });
      if (res.ok) {
        const neu = await res.json();
        setKategorien(ks => [...ks, neu].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const err = await res.json();
        alert(err.error);
      }
    }
    setKatForm({ name: "", icon: "📄", color: "#6366F1" });
    setSaving(false);
  };

  const deleteKat = async (id) => {
    if (!confirm("Kategorie löschen? Bestehende Verträge behalten die Bezeichnung.")) return;
    const res = await fetch(`/api/kategorien/${id}`, { method: "DELETE" });
    if (res.ok) setKategorien(ks => ks.filter(k => k.id !== id));
  };

  const saveKonto = async () => {
    if (!kontoForm.bezeichnung.trim()) return;
    setSaving(true);
    if (editKonto) {
      const res = await fetch(`/api/konten/${editKonto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kontoForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setKonten(ks => ks.map(k => k.id === updated.id ? updated : k));
        setEditKonto(null);
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } else {
      const res = await fetch("/api/konten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kontoForm),
      });
      if (res.ok) {
        const neu = await res.json();
        setKonten(ks => [...ks, neu].sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung)));
      } else {
        const err = await res.json();
        alert(err.error);
      }
    }
    setKontoForm({ bezeichnung: "", iban: "" });
    setSaving(false);
  };

  const deleteKonto = async (id) => {
    if (!confirm("Konto löschen?")) return;
    const res = await fetch(`/api/konten/${id}`, { method: "DELETE" });
    if (res.ok) setKonten(ks => ks.filter(k => k.id !== id));
  };

  const inputStyle = { background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" };

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Einstellungen</h1>
      <p className="text-sm mb-6" style={{ color: "#64748B" }}>Kategorien und Konten verwalten</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Kategorien */}
        <div>
          <Card className="mb-4">
            <h2 className="text-sm font-bold mb-4" style={{ color: "#F8FAFC" }}>
              {editKat ? `✏️ Kategorie bearbeiten: ${editKat.name}` : "➕ Neue Kategorie"}
            </h2>
            <div className="flex gap-2 mb-3">
              <div className="w-16">
                <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Icon</label>
                <input
                  className="w-full rounded-lg px-2 py-2.5 text-center text-lg outline-none"
                  style={inputStyle}
                  value={editKat ? editKat.icon : katForm.icon}
                  onChange={e => editKat
                    ? setEditKat(k => ({ ...k, icon: e.target.value }))
                    : setKatForm(f => ({ ...f, icon: e.target.value }))
                  }
                  maxLength={4}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Name *</label>
                <input
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                  placeholder="z.B. Sport & Fitness"
                  value={editKat ? editKat.name : katForm.name}
                  onChange={e => editKat
                    ? setEditKat(k => ({ ...k, name: e.target.value }))
                    : setKatForm(f => ({ ...f, name: e.target.value }))
                  }
                  onKeyDown={e => e.key === "Enter" && saveKat()}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ICON_SUGGESTIONS.map(ico => (
                <button
                  key={ico}
                  type="button"
                  className="text-lg rounded-md px-1.5 py-0.5 transition-colors"
                  style={{ background: (editKat ? editKat.icon : katForm.icon) === ico ? "rgba(59,130,246,0.3)" : "#0F172A", border: "1px solid #334155" }}
                  onClick={() => editKat
                    ? setEditKat(k => ({ ...k, icon: ico }))
                    : setKatForm(f => ({ ...f, icon: ico }))
                  }
                >{ico}</button>
              ))}
            </div>
            <div className="mb-3">
              <label className="block text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: "#94A3B8" }}>Schriftfarbe</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  className="w-9 h-9 rounded cursor-pointer shrink-0"
                  style={{ background: "transparent", border: "1px solid #334155", padding: "2px" }}
                  value={editKat ? (editKat.color || "#6366F1") : (katForm.color || "#6366F1")}
                  onChange={e => editKat
                    ? setEditKat(k => ({ ...k, color: e.target.value }))
                    : setKatForm(f => ({ ...f, color: e.target.value }))
                  }
                />
                {["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316","#6366F1","#64748B"].map(c => {
                  const current = editKat ? (editKat.color || "#6366F1") : (katForm.color || "#6366F1");
                  return (
                    <button
                      key={c}
                      type="button"
                      className="w-5 h-5 rounded-full shrink-0 transition-transform hover:scale-110"
                      style={{ background: c, border: `2px solid ${current === c ? "#F8FAFC" : "transparent"}`, outline: current === c ? "1px solid #64748B" : "none" }}
                      onClick={() => editKat
                        ? setEditKat(k => ({ ...k, color: c }))
                        : setKatForm(f => ({ ...f, color: c }))
                      }
                    />
                  );
                })}
                <span
                  className="text-xs px-2.5 py-1 rounded-md font-semibold ml-1"
                  style={{ background: (editKat ? editKat.color : katForm.color) + "20", color: editKat ? editKat.color : katForm.color }}
                >
                  Vorschau
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveKat}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}
              >
                {saving ? "Speichern…" : editKat ? "💾 Umbenennen" : "➕ Anlegen"}
              </button>
              {editKat && (
                <button
                  onClick={() => { setEditKat(null); setKatForm({ name: "", icon: "📄", color: "#6366F1" }); }}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ background: "#475569", color: "#F8FAFC" }}
                >
                  Abbrechen
                </button>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-bold mb-3" style={{ color: "#F8FAFC" }}>Kategorien ({kategorien.length})</h2>
            <div className="flex flex-col gap-1.5">
              {kategorien.map(kat => (
                <div key={kat.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#0F172A", border: "1px solid #1E293B" }}>
                  <span className="text-base w-6 shrink-0">{kat.icon}</span>
                  <span className="flex-1 text-sm" style={{ color: kat.color || CATEGORY_COLORS[kat.name] || "#E2E8F0" }}>{kat.name}</span>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: kat.color || CATEGORY_COLORS[kat.name] || "#6366F1" }} />
                  <button onClick={() => { setEditKat({ ...kat }); }} className="text-[11px] px-2 py-0.5 rounded" style={{ color: "#94A3B8", background: "#1E293B" }}>✏️</button>
                  <button onClick={() => deleteKat(kat.id)} className="text-[11px] px-2 py-0.5 rounded" style={{ color: "#F87171", background: "#1E293B" }}>✕</button>
                </div>
              ))}
              {kategorien.length === 0 && <p className="text-sm py-4 text-center" style={{ color: "#64748B" }}>Noch keine Kategorien</p>}
            </div>
          </Card>
        </div>

        {/* Konten */}
        <div>
          <Card className="mb-4">
            <h2 className="text-sm font-bold mb-4" style={{ color: "#F8FAFC" }}>
              {editKonto ? `✏️ Konto bearbeiten: ${editKonto.bezeichnung}` : "➕ Neues Konto"}
            </h2>
            <div className="flex flex-col gap-3 mb-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>Bezeichnung *</label>
                <input
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                  placeholder="z.B. Girokonto DKB, PayPal"
                  value={editKonto ? editKonto.bezeichnung : kontoForm.bezeichnung}
                  onChange={e => editKonto
                    ? setEditKonto(k => ({ ...k, bezeichnung: e.target.value }))
                    : setKontoForm(f => ({ ...f, bezeichnung: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "#94A3B8" }}>IBAN / PayPal / VISA … (optional)</label>
                <input
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                  style={inputStyle}
                  placeholder="z.B. DE12 3456 …, paypal@beispiel.de"
                  value={editKonto ? editKonto.iban ?? "" : kontoForm.iban}
                  onChange={e => editKonto
                    ? setEditKonto(k => ({ ...k, iban: e.target.value }))
                    : setKontoForm(f => ({ ...f, iban: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveKonto}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#1D4ED8,#7C3AED)" }}
              >
                {saving ? "Speichern…" : editKonto ? "💾 Speichern" : "➕ Anlegen"}
              </button>
              {editKonto && (
                <button
                  onClick={() => { setEditKonto(null); setKontoForm({ bezeichnung: "", iban: "" }); }}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ background: "#475569", color: "#F8FAFC" }}
                >
                  Abbrechen
                </button>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-bold mb-3" style={{ color: "#F8FAFC" }}>Konten ({konten.length})</h2>
            <div className="flex flex-col gap-1.5">
              {konten.map(k => (
                <div key={k.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#0F172A", border: "1px solid #1E293B" }}>
                  <span className="text-base shrink-0">💳</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: "#E2E8F0" }}>{k.bezeichnung}</p>
                    {k.iban && <p className="text-[11px]" style={{ color: "#64748B" }}>{k.iban}</p>}
                  </div>
                  <button onClick={() => setEditKonto({ ...k })} className="text-[11px] px-2 py-0.5 rounded shrink-0" style={{ color: "#94A3B8", background: "#1E293B" }}>✏️</button>
                  <button onClick={() => deleteKonto(k.id)} className="text-[11px] px-2 py-0.5 rounded shrink-0" style={{ color: "#F87171", background: "#1E293B" }}>✕</button>
                </div>
              ))}
              {konten.length === 0 && <p className="text-sm py-4 text-center" style={{ color: "#64748B" }}>Noch keine Konten</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────

export default function VertragsPilot({ initialContracts, kategorien: initialKategorien, initialKonten = [] }) {
  const [contracts, setContracts] = useState(initialContracts);
  const [kategorien, setKategorien] = useState(initialKategorien);
  const [konten, setKonten] = useState(initialKonten);
  const [page, setPage] = useState("dashboard");
  const [selectedContract, setSelectedContract] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Prevent background scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const navigate = useCallback((target, contract = null) => {
    setPage(target);
    setSidebarOpen(false);
    setSelectedContract(contract);
  }, []);

  const handleDelete = useCallback((id) => {
    setContracts(cs => cs.filter(c => c.id !== id));
    setPage("list");
    setSelectedContract(null);
    setSidebarOpen(false);
  }, []);

  const handleSave = useCallback((saved, isEdit) => {
    const enriched = enrichContract(saved);
    if (isEdit) {
      setContracts(cs => cs.map(c => c.id === enriched.id ? enriched : c));
      setSelectedContract(enriched);
      setPage("detail");
    } else {
      setContracts(cs => [...cs, enriched]);
      setPage("list");
    }
    setSidebarOpen(false);
  }, []);

  const activeContracts = contracts.filter(c => c.berechneterStatus !== "gekuendigt" && c.berechneterStatus !== "ausgelaufen");
  const warningCount = activeContracts.filter(c => getWarningLevel(c) !== "none").length;
  const totalMonthly = activeContracts.reduce((s, c) => s + toMonthly(c.kosten, c.zahlungsintervall), 0);

  const katColors = useMemo(() => {
    const map = { ...CATEGORY_COLORS };
    kategorien.forEach(k => { if (k.color) map[k.name] = k.color; });
    return map;
  }, [kategorien]);

  const navItems = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "list", icon: "📋", label: "Verträge / Periodische Zahlung" },
    { id: "warnings", icon: "⚠️", label: `Warnungen${warningCount > 0 ? ` (${warningCount})` : ""}` },
    { id: "kosten", icon: "💸", label: "Kosten-Übersicht" },
    { id: "calendar", icon: "📅", label: "Kalender" },
    { id: "einstellungen", icon: "⚙️", label: "Einstellungen" },
    { id: "hilfe", icon: "❓", label: "Hilfe" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#0B0F19" }}>

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile top bar ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{ background: "#111827", borderBottom: "1px solid #1E293B", height: "56px" }}
      >
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ color: "#94A3B8" }}
          onClick={() => setSidebarOpen(true)}
          aria-label="Menü öffnen"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect y="3" width="20" height="2" rx="1" />
            <rect y="9" width="20" height="2" rx="1" />
            <rect y="15" width="20" height="2" rx="1" />
          </svg>
        </button>
        <span className="text-[15px] font-extrabold tracking-tight" style={{ color: "#F8FAFC" }}>
          📑 VertragsPilot
        </span>
        {warningCount > 0 ? (
          <button
            className="relative flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ color: "#F87171" }}
            onClick={() => navigate("warnings")}
            aria-label={`${warningCount} Warnungen`}
          >
            <span className="text-lg">⚠️</span>
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: "#EF4444", color: "#fff" }}
            >
              {warningCount}
            </span>
          </button>
        ) : (
          <div style={{ width: 36 }} />
        )}
      </header>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[260px] flex flex-col z-50 transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ background: "#111827", borderRight: "1px solid #1E293B" }}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4" style={{ borderBottom: "1px solid #1E293B" }}>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight" style={{ color: "#F8FAFC" }}>📑 VertragsPilot</h1>
            <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>Vertragsmanagement</p>
          </div>
          {/* Close button – only visible on mobile */}
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ color: "#64748B" }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Menü schließen"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.7 3.3a1 1 0 0 0-1.4 0L8 6.6 4.7 3.3a1 1 0 0 0-1.4 1.4L6.6 8l-3.3 3.3a1 1 0 0 0 1.4 1.4L8 9.4l3.3 3.3a1 1 0 0 0 1.4-1.4L9.4 8l3.3-3.3a1 1 0 0 0 0-1.4z" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              className="sidebar-item w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[13.5px] text-left mb-0.5"
              style={{
                background: page === item.id ? "linear-gradient(135deg, #1D4ED8, #7C3AED)" : "transparent",
                color: page === item.id ? "#FFF" : "#94A3B8",
                fontWeight: page === item.id ? 600 : 400,
              }}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
            >
              <span className="text-base">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 text-[11px]" style={{ borderTop: "1px solid #1E293B", color: "#475569" }}>
          {activeContracts.length} aktive Verträge · {formatCurrency(totalMonthly)}/Mo
        </div>
      </aside>

      {/* ── Main content ── */}
      {/* pt-14 = height of mobile top bar; md:pt-0 resets on desktop */}
      <main className="md:ml-[260px] pt-14 md:pt-0 p-4 md:p-6 lg:p-8 min-h-screen">
        {page === "dashboard" && <Dashboard contracts={contracts} navigate={navigate} katColors={katColors} />}
        {page === "list" && <ContractList contracts={contracts} navigate={navigate} onDelete={handleDelete} katColors={katColors} />}
        {page === "detail" && <ContractDetail contract={selectedContract} konten={konten} navigate={navigate} onDelete={handleDelete} katColors={katColors} />}
        {page === "form" && <ContractForm contract={selectedContract} kategorien={kategorien} konten={konten} onKontoAdded={k => setKonten(ks => [...ks, k].sort((a,b) => a.bezeichnung.localeCompare(b.bezeichnung)))} navigate={navigate} onSave={handleSave} />}
        {page === "warnings" && <Warnings contracts={contracts} navigate={navigate} />}
        {page === "kosten" && <KostenUebersicht contracts={contracts} katColors={katColors} />}
        {page === "calendar" && <CalendarView contracts={contracts} />}
        {page === "einstellungen" && <Einstellungen kategorien={kategorien} setKategorien={setKategorien} konten={konten} setKonten={setKonten} setContracts={setContracts} />}
        {page === "hilfe" && <Hilfe />}
      </main>
    </div>
  );
}
