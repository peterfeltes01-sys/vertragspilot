'use client';
import { useState, useEffect } from 'react';

const CATEGORY_ICONS = {
  'Baufinanzierung': '🏠', 'Computer/Internet/Medien': '💻', 'Fernsehen / Internet': '📺',
  'Festnetz': '☎️', 'Fitnessstudio': '💪', 'Gas': '🔥', 'Gesundheit': '❤️',
  'Girokonto': '🏦', 'Hilfsorganisationen': '🤝', 'KFZ-Versicherung': '🚗',
  'Kreditkarte': '💳', 'Mobilfunk': '📱', 'Nebenkosten (Haus)': '🏡',
  'Pay-TV': '📡', 'Riester Rente': '👴', 'Sparplan': '💰',
  'Sport und Freizeit': '⚽', 'Strom': '⚡', 'Transport': '🚌',
  'Versicherung / Steuern': '🛡️', 'Wasser': '💧', 'Webservices': '🌐',
  'Zeitungen': '📰', 'Telefon': '📞',
};

function getDaysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toMonthly(cost, interval) {
  if (!cost) return null;
  if (interval === 'monatlich') return cost;
  if (interval === 'jährlich') return cost / 12;
  if (interval === 'vierteljährlich') return cost / 3;
  if (interval === 'halbjährlich') return cost / 6;
  return cost;
}

function urgencyClasses(days) {
  if (days <= 3) return { card: 'border-l-red-500 bg-red-500/5', badge: 'bg-red-500/20 text-red-400' };
  if (days <= 7) return { card: 'border-l-orange-500 bg-orange-500/5', badge: 'bg-orange-500/20 text-orange-400' };
  return { card: 'border-l-yellow-500 bg-yellow-500/5', badge: 'bg-yellow-500/20 text-yellow-400' };
}

export default function ReminderModal() {
  const [contracts, setContracts] = useState([]);
  const [visible, setVisible] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState(null);
  const [syncingIds, setSyncingIds] = useState(new Set());
  const [syncedIds, setSyncedIds] = useState(new Set());
  const [bulkSyncing, setBulkSyncing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [contractsRes, googleRes] = await Promise.all([
          fetch('/api/contracts/upcoming-deadlines'),
          fetch('/api/auth/google/status'),
        ]);
        const allContracts = await contractsRes.json();
        const google = await googleRes.json();

        setGoogleConnected(google.connected);
        setGoogleEmail(google.email);

        if (!Array.isArray(allContracts) || allContracts.length === 0) return;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const relevant = allContracts.filter((c) => {
          if (!c.reminderDismissed) return true;
          return new Date(c.reminderDismissed) < todayStart;
        });

        if (relevant.length === 0) return;

        setContracts(relevant);
        setSyncedIds(new Set(relevant.filter((c) => c.calendarSynced).map((c) => c.id)));
        setVisible(true);
      } catch (err) {
        console.error('ReminderModal load error:', err);
      }
    }
    load();
  }, []);

  async function dismissAll() {
    const now = new Date().toISOString();
    await Promise.all(
      contracts.map((c) =>
        fetch(`/api/contracts/${c.id}/reminder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reminderDismissed: now }),
        })
      )
    );
    setVisible(false);
  }

  async function disableReminder(id) {
    await fetch(`/api/contracts/${id}/reminder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderEnabled: false }),
    });
    setContracts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) setVisible(false);
      return next;
    });
  }

  async function syncOne(contractId) {
    setSyncingIds((prev) => new Set([...prev, contractId]));
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      });
      const data = await res.json();
      if (data.results?.[0]?.success) {
        setSyncedIds((prev) => new Set([...prev, contractId]));
      } else {
        alert('Synchronisierung fehlgeschlagen: ' + (data.results?.[0]?.error || 'Unbekannter Fehler'));
      }
    } catch {
      alert('Netzwerkfehler bei der Synchronisierung.');
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(contractId);
        return next;
      });
    }
  }

  async function syncAll() {
    const toSync = contracts.filter((c) => !syncedIds.has(c.id)).map((c) => c.id);
    if (toSync.length === 0) return;
    setBulkSyncing(true);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractIds: toSync }),
      });
      const data = await res.json();
      const succeeded = new Set(
        (data.results || []).filter((r) => r.success).map((r) => r.id)
      );
      setSyncedIds((prev) => new Set([...prev, ...succeeded]));
    } catch {
      alert('Fehler beim Bulk-Sync.');
    } finally {
      setBulkSyncing(false);
    }
  }

  if (!visible) return null;

  const allSynced = contracts.every((c) => syncedIds.has(c.id));

  return (
    <div className="reminder-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="reminder-modal bg-dark-900 border border-dark-600 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-700 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">
                ⚠️ Kündigungsfristen in den nächsten 14 Tagen
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {contracts.length} {contracts.length === 1 ? 'Vertrag' : 'Verträge'} mit bevorstehender Frist
              </p>
            </div>
            <button
              onClick={dismissAll}
              className="text-gray-500 hover:text-gray-300 text-xl leading-none flex-shrink-0 mt-0.5"
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
        </div>

        {/* Contract list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {contracts.map((contract) => {
            const days = getDaysUntil(contract.naechsteKuendigung);
            const monthly = toMonthly(contract.kosten, contract.zahlungsintervall);
            const icon = CATEGORY_ICONS[contract.kategorie] || '📄';
            const isSynced = syncedIds.has(contract.id);
            const isSyncing = syncingIds.has(contract.id);
            const { card, badge } = urgencyClasses(days);
            const isMonthly = contract.zahlungsintervall === 'monatlich';

            return (
              <div
                key={contract.id}
                className={`rounded-xl border border-dark-600 border-l-4 p-4 ${card}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{contract.vertrag}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{contract.kategorie}</p>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
                        in {days} Tag{days !== 1 ? 'en' : ''} – {formatDate(contract.naechsteKuendigung)}
                      </span>
                      {monthly != null && (
                        <span className="text-xs text-gray-400">
                          {monthly.toFixed(2).replace('.', ',')} €/Monat
                        </span>
                      )}
                    </div>

                    {isMonthly && (
                      <p className="text-xs text-blue-400 mt-1.5">
                        💡 Monatsvertrag – jederzeit kündbar
                      </p>
                    )}
                  </div>
                </div>

                {/* Action row */}
                <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                  {/* Calendar button */}
                  {googleConnected ? (
                    isSyncing ? (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <span className="animate-spin inline-block">⟳</span> Synchronisiere…
                      </span>
                    ) : isSynced ? (
                      <span className="text-xs text-green-400 flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded-lg border border-green-500/20">
                        📅 Im Kalender ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => syncOne(contract.id)}
                        className="text-xs px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/30 transition-colors"
                      >
                        📅 In Google Kalender
                      </button>
                    )
                  ) : (
                    <a
                      href="/api/auth/google"
                      className="text-xs px-2.5 py-1 bg-dark-700 hover:bg-dark-600 text-gray-400 rounded-lg border border-dark-600 transition-colors"
                    >
                      🔗 Kalender verbinden
                    </a>
                  )}

                  {/* Disable toggle */}
                  <button
                    onClick={() => disableReminder(contract.id)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      isMonthly
                        ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10'
                        : 'border-dark-600 text-gray-500 hover:text-gray-300 hover:bg-dark-700'
                    }`}
                  >
                    Reminder deaktivieren
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Google status hint */}
        {googleConnected && (
          <div className="px-4 py-2 border-t border-dark-700 flex-shrink-0">
            <p className="text-xs text-gray-500">📅 Verbunden als {googleEmail}</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 flex gap-3 flex-shrink-0">
          {googleConnected && !allSynced && (
            <button
              onClick={syncAll}
              disabled={bulkSyncing}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
            >
              {bulkSyncing ? '⟳ Synchronisiere…' : '📅 Alle in Google Kalender'}
            </button>
          )}
          <button
            onClick={dismissAll}
            className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl text-sm font-medium transition-colors border border-dark-600"
          >
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}
