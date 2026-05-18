'use client';
import { useState } from 'react';

export default function CalendarSyncButton({ contract, onSynced }) {
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(Boolean(contract.calendarSynced));

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      });
      const data = await res.json();
      const result = data.results?.[0];
      if (result?.success) {
        setSynced(true);
        onSynced?.();
      } else {
        const err = result?.error || 'Unbekannter Fehler';
        if (err.includes('Not authenticated')) {
          alert('Bitte zuerst Google Kalender verbinden.');
        } else {
          alert('Fehler beim Synchronisieren: ' + err);
        }
      }
    } catch (err) {
      alert('Netzwerkfehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!confirm('Kalendereintrag entfernen?')) return;
    setLoading(true);
    try {
      await fetch(`/api/calendar/sync/${contract.id}`, { method: 'DELETE' });
      setSynced(false);
      onSynced?.();
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-dark-700 text-gray-400 rounded-lg">
        <span className="animate-spin inline-block">⟳</span>
        Synchronisiere...
      </span>
    );
  }

  if (synced) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs text-green-400 px-2.5 py-1.5 bg-green-500/10 rounded-lg border border-green-500/20">
          📅 Im Kalender ✓
        </span>
        <button
          onClick={handleRemove}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors px-1.5 py-1.5"
          title="Aus Kalender entfernen"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSync}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-dark-800 hover:bg-dark-700 text-gray-400 hover:text-blue-400 rounded-lg border border-dark-600 hover:border-blue-500/50 transition-all"
    >
      📅 In Kalender eintragen
    </button>
  );
}
