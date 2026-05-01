"use client";

import { useState, useMemo, useCallback } from "react";
import {
  CATEGORY_ICONS, CATEGORY_COLORS, toMonthly,
  formatCurrency, formatDate, getDaysUntil, getWarningLevel,
} from "@/lib/utils";

// ─── Reusable Components ─────────────────────────────

function Badge({ bg, color, children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
      {children}
    </span>
  );
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

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-xl p-5 border" style={{ background: `linear-gradient(135deg, ${color}12, #1E293B 60%)`, borderColor: `${color}30` }}>
      <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "#64748B" }}>{label}</p>
      <p className="text-2xl font-extrabold mt-1 tracking-tight" style={{ color: "#F8FAFC" }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{sub}</p>}
    </div>
  );
}

function Card({ children, className = "", ...props }) {
  return (
    <div className={`rounded-xl p-5 border border-dark-600 card-hover ${className}`} style={{ background: "#1E293B" }} {...props}>
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

// ─── Dashboard ───────────────────────────────────────

function Dashboard({ contracts, navigate }) {
  const totalMonthly = contracts.reduce((s, c) => s + toMonthly(c.kosten, c.zahlungsintervall), 0);
  const activeCount = contracts.length;

  const warnings = useMemo(() =>
    contracts
      .map(c => ({ ...c, level: getWarningLevel(c), days: getDaysUntil(c.naechsteKuendigung) }))
      .filter(c => c.level !== "none")
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999)),
    [contracts]
  );

  const catCosts = useMemo(() => {
    const map = {};
    contracts.forEach(c => { map[c.kategorie] = (map[c.kategorie] || 0) + toMonthly(c.kosten, c.zahlungsintervall); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [contracts]);
  const maxCat = catCosts[0]?.[1] || 1;

  const staleContracts = contracts.filter(c => {
    if (!c.lastCheck) return true;
    return getDaysUntil(c.lastCheck) < -180;
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Dashboard</h1>
      <p className="text-sm mb-6" style={{ color: "#64748B" }}>Übersicht aller Verträge und Kosten</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Aktive Verträge" value={activeCount} sub={`in ${catCosts.length} Kategorien`} color="#3B82F6" />
        <StatCard label="Monatliche Kosten" value={formatCurrency(totalMonthly)} sub="Gesamt pro Monat" color="#10B981" />
        <StatCard label="Jährliche Kosten" value={formatCurrency(totalMonthly * 12)} sub="Hochrechnung" color="#F59E0B" />
        <StatCard label="Warnungen" value={warnings.length} sub={`${warnings.filter(w => w.level === "critical").length} kritisch`} color={warnings.some(w => w.level === "critical") ? "#EF4444" : "#8B5CF6"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="text-[15px] font-bold mb-4" style={{ color: "#F8FAFC" }}>⚠️ Kündigungsfristen</h3>
          {warnings.length === 0 ? (
            <p className="text-sm" style={{ color: "#64748B" }}>Keine anstehenden Fristen</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {warnings.slice(0, 6).map(w => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer"
                  style={{ background: getWarningLevel(w) === "critical" ? "rgba(220,38,38,0.08)" : "rgba(59,130,246,0.06)", border: `1px solid ${getWarningLevel(w) === "critical" ? "rgba(220,38,38,0.2)" : "rgba(59,130,246,0.15)"}` }}
                  onClick={() => navigate("detail", w)}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: "#F8FAFC" }}>{w.vertrag}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                      {w.days !== null ? (w.days < 0 ? `${Math.abs(w.days)} Tage überfällig` : `${w.days} Tage verbleibend`) : "prüfen"} · {formatDate(w.naechsteKuendigung)}
                    </div>
                  </div>
                  <WarningBadge level={w.level} />
                </div>
              ))}
              {warnings.length > 6 && (
                <button className="text-xs font-semibold mt-1" style={{ color: "#60A5FA" }} onClick={() => navigate("warnings")}>
                  Alle {warnings.length} anzeigen →
                </button>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-[15px] font-bold mb-4" style={{ color: "#F8FAFC" }}>📊 Kosten nach Kategorie</h3>
          <div className="flex flex-col gap-3">
            {catCosts.slice(0, 8).map(([cat, cost]) => (
              <div key={cat}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs" style={{ color: "#CBD5E1" }}>{CATEGORY_ICONS[cat] || "📄"} {cat}</span>
                  <span className="text-xs font-bold" style={{ color: "#F8FAFC" }}>{formatCurrency(cost)}/Mo</span>
                </div>
                <MiniBar value={cost} max={maxCat} color={CATEGORY_COLORS[cat] || "#6366F1"} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {staleContracts.length > 0 && (
        <Card>
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
    </div>
  );
}

// ─── Contract List ───────────────────────────────────

function ContractList({ contracts, navigate, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterInterval, setFilterInterval] = useState("all");
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
    list.sort((a, b) => {
      let va, vb;
      if (sortBy === "kosten") { va = toMonthly(a.kosten, a.zahlungsintervall); vb = toMonthly(b.kosten, b.zahlungsintervall); }
      else if (sortBy === "naechsteKuendigung") { va = a.naechsteKuendigung || "9999"; vb = b.naechsteKuendigung || "9999"; }
      else { va = (a[sortBy] || "zzz").toString(); vb = (b[sortBy] || "zzz").toString(); }
      return sortDir === "asc" ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
    });
    return list;
  }, [contracts, search, filterCat, filterInterval, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };
  const arrow = (col) => sortBy === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const totalFiltered = filtered.reduce((s, c) => s + toMonthly(c.kosten, c.zahlungsintervall), 0);

  return (
    <div>
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Verträge</h1>
          <p className="text-sm" style={{ color: "#64748B" }}>{filtered.length} Verträge · {formatCurrency(totalFiltered)}/Monat</p>
        </div>
        <button className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #1D4ED8, #7C3AED)" }} onClick={() => navigate("form")}>
          + Neuer Vertrag
        </button>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          className="rounded-lg px-3.5 py-2.5 text-sm outline-none max-w-[280px]"
          style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }}
          placeholder="🔍 Suchen…" value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="rounded-lg px-3.5 py-2.5 text-sm outline-none cursor-pointer" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">Alle Kategorien</option>
          {usedCats.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
        </select>
        <select className="rounded-lg px-3.5 py-2.5 text-sm outline-none cursor-pointer" style={{ background: "#0F172A", border: "1px solid #334155", color: "#E2E8F0" }} value={filterInterval} onChange={e => setFilterInterval(e.target.value)}>
          <option value="all">Alle Intervalle</option>
          <option value="monatlich">Monatlich</option>
          <option value="vierteljährlich">Vierteljährlich</option>
          <option value="jährlich">Jährlich</option>
        </select>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }}></th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("vertrag")}>Vertrag{arrow("vertrag")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("kategorie")}>Kategorie{arrow("kategorie")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("kosten")}>Kosten/Mo{arrow("kosten")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }}>Intervall</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b cursor-pointer" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }} onClick={() => toggleSort("naechsteKuendigung")}>Kündigung{arrow("naechsteKuendigung")}</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-wider border-b" style={{ color: "#64748B", borderColor: "#334155", background: "#1E293B" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="contract-row cursor-pointer" onClick={() => navigate("detail", c)}>
                  <td className="p-3 border-b text-base" style={{ borderColor: "#1E293B15" }}>{CATEGORY_ICONS[c.kategorie] || "📄"}</td>
                  <td className="p-3 border-b font-semibold text-sm" style={{ borderColor: "#1E293B15", color: "#F8FAFC" }}>{c.vertrag}</td>
                  <td className="p-3 border-b text-sm" style={{ borderColor: "#1E293B15" }}>
                    <Badge bg={(CATEGORY_COLORS[c.kategorie] || "#6366F1") + "20"} color={CATEGORY_COLORS[c.kategorie] || "#6366F1"}>{c.kategorie}</Badge>
                  </td>
                  <td className="p-3 border-b text-sm font-semibold tabular-nums" style={{ borderColor: "#1E293B15" }}>{c.kosten != null ? formatCurrency(toMonthly(c.kosten, c.zahlungsintervall)) : "—"}</td>
                  <td className="p-3 border-b text-sm" style={{ borderColor: "#1E293B15" }}>{c.zahlungsintervall || "—"}</td>
                  <td className="p-3 border-b text-sm" style={{ borderColor: "#1E293B15" }}>{formatDate(c.naechsteKuendigung)}</td>
                  <td className="p-3 border-b" style={{ borderColor: "#1E293B15" }}><WarningBadge level={getWarningLevel(c)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Contract Detail ─────────────────────────────────

function ContractDetail({ contract, navigate, onDelete }) {
  if (!contract) return null;
  const monthly = toMonthly(contract.kosten, contract.zahlungsintervall);
  const yearly = monthly * 12;
  const level = getWarningLevel(contract);
  const days = getDaysUntil(contract.naechsteKuendigung);

  const handleDelete = async () => {
    if (!confirm("Vertrag wirklich löschen?")) return;
    const res = await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
    if (res.ok) onDelete(contract.id);
  };

  return (
    <div>
      <button className="text-xs border rounded-md px-3 py-1.5 mb-5" style={{ borderColor: "#334155", color: "#94A3B8" }} onClick={() => navigate("list")}>← Zurück</button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl" style={{ background: (CATEGORY_COLORS[contract.kategorie] || "#6366F1") + "20" }}>
          {CATEGORY_ICONS[contract.kategorie] || "📄"}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#F8FAFC" }}>{contract.vertrag}</h1>
          <Badge bg={(CATEGORY_COLORS[contract.kategorie] || "#6366F1") + "20"} color={CATEGORY_COLORS[contract.kategorie] || "#6366F1"}>{contract.kategorie}</Badge>
        </div>
        <WarningBadge level={level} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Kosten / Monat" value={formatCurrency(monthly)} color="#3B82F6" />
        <StatCard label="Kosten / Jahr" value={formatCurrency(yearly)} color="#10B981" />
        <StatCard label="Nächste Kündigung" value={days !== null ? `${days} Tage` : "—"} sub={formatDate(contract.naechsteKuendigung)} color={level === "critical" ? "#EF4444" : "#8B5CF6"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="text-[15px] font-bold mb-4" style={{ color: "#F8FAFC" }}>Vertragsdetails</h3>
          {[
            ["Kundennummer", contract.kundennummer],
            ["Vertragsbeginn", formatDate(contract.vertragsbeginn)],
            ["Vertragsende", formatDate(contract.vertragsende)],
            ["Laufzeit", contract.laufzeit],
            ["Kündigungsfrist", contract.kuendigungsfrist],
            ["Zahlungsintervall", contract.zahlungsintervall],
            ["Kosten (Original)", contract.kosten != null ? `${formatCurrency(contract.kosten)} ${contract.zahlungsintervall || ""}` : null],
            ["Letzter Check", formatDate(contract.lastCheck)],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-sm" style={{ color: "#94A3B8" }}>{label}</span>
              <span className="text-sm font-medium text-right max-w-[60%] break-words" style={{ color: "#E2E8F0" }}>{val || "—"}</span>
            </div>
          ))}
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
    </div>
  );
}

// ─── Contract Form ───────────────────────────────────

function ContractForm({ contract, kategorien, navigate, onSave }) {
  const isEdit = !!contract;
  const toDateInput = (d) => d ? new Date(d).toISOString().split("T")[0] : "";

  const [form, setForm] = useState({
    kategorie: contract?.kategorie || "",
    vertrag: contract?.vertrag || "",
    web: contract?.web || "",
    kundennummer: contract?.kundennummer || "",
    vertragsbeginn: toDateInput(contract?.vertragsbeginn),
    vertragsende: toDateInput(contract?.vertragsende),
    laufzeit: contract?.laufzeit || "",
    kuendigungsfrist: contract?.kuendigungsfrist || "",
    naechsteKuendigung: toDateInput(contract?.naechsteKuendigung),
    naechsteErinnerung: toDateInput(contract?.naechsteErinnerung),
    kosten: contract?.kosten ?? "",
    zahlungsintervall: contract?.zahlungsintervall || "monatlich",
    notizen: contract?.notizen || "",
    lastCheck: toDateInput(contract?.lastCheck) || new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.vertrag || !form.kategorie) { alert("Bitte Vertrag und Kategorie angeben!"); return; }
    setSaving(true);
    try {
      const url = isEdit ? `/api/contracts/${contract.id}` : "/api/contracts";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const saved = await res.json();
        onSave(saved, isEdit);
      }
    } catch (err) {
      alert("Fehler beim Speichern: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <button className="text-xs border rounded-md px-3 py-1.5 mb-5" style={{ borderColor: "#334155", color: "#94A3B8" }} onClick={() => navigate(isEdit ? "detail" : "list", contract)}>← Zurück</button>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>{isEdit ? "Vertrag bearbeiten" : "Neuer Vertrag"}</h1>
      <p className="text-sm mb-6" style={{ color: "#64748B" }}>{isEdit ? `${form.vertrag} bearbeiten` : "Neuen Vertrag erfassen"}</p>

      <Card className="max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <InputField label="Vertragsname *" value={form.vertrag} onChange={v => update("vertrag", v)} />
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
            <InputField label="Website / Email" value={form.web} onChange={v => update("web", v)} />
          </div>
          <InputField label="Vertragsbeginn" value={form.vertragsbeginn} onChange={v => update("vertragsbeginn", v)} type="date" />
          <InputField label="Vertragsende" value={form.vertragsende} onChange={v => update("vertragsende", v)} type="date" />
          <InputField label="Kündigungsfrist" value={form.kuendigungsfrist} onChange={v => update("kuendigungsfrist", v)} />
          <InputField label="Nächste Kündigung" value={form.naechsteKuendigung} onChange={v => update("naechsteKuendigung", v)} type="date" />
          <InputField label="Laufzeit" value={form.laufzeit} onChange={v => update("laufzeit", v)} />
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

// ─── Analytics ───────────────────────────────────────

function Analytics({ contracts }) {
  const catData = useMemo(() => {
    const map = {};
    contracts.forEach(c => {
      if (!map[c.kategorie]) map[c.kategorie] = { count: 0, monthly: 0 };
      map[c.kategorie].count++;
      map[c.kategorie].monthly += toMonthly(c.kosten, c.zahlungsintervall);
    });
    return Object.entries(map).sort((a, b) => b[1].monthly - a[1].monthly);
  }, [contracts]);

  const totalMonthly = catData.reduce((s, [, d]) => s + d.monthly, 0);

  const topContracts = useMemo(() =>
    [...contracts].filter(c => c.kosten).sort((a, b) => toMonthly(b.kosten, b.zahlungsintervall) - toMonthly(a.kosten, a.zahlungsintervall)).slice(0, 10),
    [contracts]
  );
  const maxContract = topContracts[0] ? toMonthly(topContracts[0].kosten, topContracts[0].zahlungsintervall) : 1;

  const intervalData = useMemo(() => {
    const map = {};
    contracts.forEach(c => {
      const iv = c.zahlungsintervall || "Unbekannt";
      if (!map[iv]) map[iv] = { count: 0, monthly: 0 };
      map[iv].count++;
      map[iv].monthly += toMonthly(c.kosten, c.zahlungsintervall);
    });
    return Object.entries(map);
  }, [contracts]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Kostenanalyse</h1>
      <p className="text-sm mb-6" style={{ color: "#64748B" }}>Detaillierte Aufschlüsselung deiner Ausgaben</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Gesamt Monatlich" value={formatCurrency(totalMonthly)} color="#10B981" />
        <StatCard label="Gesamt Jährlich" value={formatCurrency(totalMonthly * 12)} color="#3B82F6" />
        <StatCard label="Ø pro Vertrag" value={formatCurrency(totalMonthly / (contracts.filter(c => c.kosten).length || 1))} color="#F59E0B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="text-[15px] font-bold mb-5" style={{ color: "#F8FAFC" }}>Kosten nach Kategorie</h3>
          {catData.map(([cat, data]) => (
            <div key={cat} className="mb-3.5">
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: "#CBD5E1" }}>{CATEGORY_ICONS[cat]} {cat} ({data.count})</span>
                <span className="text-xs font-bold" style={{ color: "#F8FAFC" }}>{formatCurrency(data.monthly)}/Mo · {(totalMonthly > 0 ? data.monthly / totalMonthly * 100 : 0).toFixed(1)}%</span>
              </div>
              <MiniBar value={data.monthly} max={catData[0][1].monthly} color={CATEGORY_COLORS[cat] || "#6366F1"} />
            </div>
          ))}
        </Card>

        <Card>
          <h3 className="text-[15px] font-bold mb-5" style={{ color: "#F8FAFC" }}>Top 10 teuerste Verträge</h3>
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

      <Card>
        <h3 className="text-[15px] font-bold mb-4" style={{ color: "#F8FAFC" }}>Nach Zahlungsintervall</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {intervalData.map(([interval, data]) => (
            <div key={interval} className="text-center p-4 rounded-xl" style={{ background: "#0F172A" }}>
              <p className="text-xl font-extrabold" style={{ color: "#F8FAFC" }}>{data.count}</p>
              <p className="text-[11px] capitalize mt-0.5" style={{ color: "#94A3B8" }}>{interval}</p>
              <p className="text-sm font-bold mt-2" style={{ color: "#60A5FA" }}>{formatCurrency(data.monthly)}/Mo</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Warnings ────────────────────────────────────────

function Warnings({ contracts, navigate }) {
  const all = useMemo(() =>
    contracts
      .map(c => ({ ...c, level: getWarningLevel(c), days: getDaysUntil(c.naechsteKuendigung) }))
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
      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Warnungen & Fristen</h1>
      <p className="text-sm mb-6" style={{ color: "#64748B" }}>{all.length} Verträge mit Fristen</p>

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
                  <div className="flex-1">
                    <div className="font-semibold text-sm" style={{ color: "#F8FAFC" }}>{w.vertrag}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                      {w.kategorie} · {w.days < 0 ? `${Math.abs(w.days)} Tage überfällig` : `Noch ${w.days} Tage`} · {formatDate(w.naechsteKuendigung)}
                      {w.kosten != null && ` · ${formatCurrency(toMonthly(w.kosten, w.zahlungsintervall))}/Mo`}
                    </div>
                  </div>
                  <WarningBadge level={w.level} />
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
    contracts.filter(c => c.naechsteKuendigung || c.vertragsende).map(c => {
      const d = new Date(c.naechsteKuendigung || c.vertragsende);
      return { ...c, date: d, month: d.getMonth(), year: d.getFullYear() };
    }).filter(e => e.year === year || e.year === year + 1),
    [contracts, year]
  );

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight mb-1" style={{ color: "#F8FAFC" }}>Kalender {year}</h1>
      <p className="text-sm mb-6" style={{ color: "#64748B" }}>Übersicht aller Fristen und Termine</p>

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

// ─── Main App ────────────────────────────────────────

export default function VertragsPilot({ initialContracts, kategorien }) {
  const [contracts, setContracts] = useState(initialContracts);
  const [page, setPage] = useState("dashboard");
  const [selectedContract, setSelectedContract] = useState(null);

  const navigate = useCallback((target, contract = null) => {
    setPage(target);
    if (contract) setSelectedContract(contract);
  }, []);

  const handleDelete = useCallback((id) => {
    setContracts(cs => cs.filter(c => c.id !== id));
    setPage("list");
    setSelectedContract(null);
  }, []);

  const handleSave = useCallback((saved, isEdit) => {
    if (isEdit) {
      setContracts(cs => cs.map(c => c.id === saved.id ? saved : c));
      setSelectedContract(saved);
      setPage("detail");
    } else {
      setContracts(cs => [...cs, saved]);
      setPage("list");
    }
  }, []);

  const warningCount = contracts.filter(c => getWarningLevel(c) !== "none").length;
  const totalMonthly = contracts.reduce((s, c) => s + toMonthly(c.kosten, c.zahlungsintervall), 0);

  const navItems = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "list", icon: "📋", label: "Verträge" },
    { id: "warnings", icon: "⚠️", label: `Warnungen${warningCount > 0 ? ` (${warningCount})` : ""}` },
    { id: "analytics", icon: "📈", label: "Kostenanalyse" },
    { id: "calendar", icon: "📅", label: "Kalender" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#0B0F19" }}>
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 bottom-0 w-[260px] flex flex-col z-50" style={{ background: "#111827", borderRight: "1px solid #1E293B" }}>
        <div className="px-5 pt-6 pb-4" style={{ borderBottom: "1px solid #1E293B" }}>
          <h1 className="text-xl font-extrabold tracking-tight" style={{ color: "#F8FAFC" }}>📑 VertragsPilot</h1>
          <p className="text-[11px] mt-1" style={{ color: "#64748B" }}>Vertragsmanagement</p>
        </div>
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
              onClick={() => setPage(item.id)}
            >
              <span className="text-base">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 text-[11px]" style={{ borderTop: "1px solid #1E293B", color: "#475569" }}>
          {contracts.length} Verträge · {formatCurrency(totalMonthly)}/Mo
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[260px] p-6 lg:p-8 min-h-screen">
        {page === "dashboard" && <Dashboard contracts={contracts} navigate={navigate} />}
        {page === "list" && <ContractList contracts={contracts} navigate={navigate} onDelete={handleDelete} />}
        {page === "detail" && <ContractDetail contract={selectedContract} navigate={navigate} onDelete={handleDelete} />}
        {page === "form" && <ContractForm contract={selectedContract} kategorien={kategorien} navigate={navigate} onSave={handleSave} />}
        {page === "warnings" && <Warnings contracts={contracts} navigate={navigate} />}
        {page === "analytics" && <Analytics contracts={contracts} />}
        {page === "calendar" && <CalendarView contracts={contracts} />}
      </main>
    </div>
  );
}
