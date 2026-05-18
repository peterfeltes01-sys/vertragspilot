'use client';
import { useState, useEffect } from 'react';

export default function GoogleCalendarConnect({ compact = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/google/status')
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected')) {
      fetch('/api/auth/google/status').then((r) => r.json()).then(setStatus);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function disconnect() {
    if (!confirm('Google Kalender-Verbindung trennen? Alle Sync-Status werden zurückgesetzt.')) return;
    setLoading(true);
    await fetch('/api/auth/google/disconnect', { method: 'POST' });
    setStatus({ connected: false, email: null });
    setLoading(false);
  }

  if (loading) {
    return compact ? (
      <span className="w-5 h-5 inline-block rounded-full bg-dark-700 animate-pulse" />
    ) : (
      <div className="animate-pulse h-12 bg-dark-800 rounded-lg w-64" />
    );
  }

  if (compact) {
    return (
      <span title={status?.connected ? `Google Kalender: ${status.email}` : 'Google Kalender verbinden'}>
        {status?.connected ? (
          <span className="text-xl cursor-default select-none">📅</span>
        ) : (
          <a href="/api/auth/google" className="opacity-30 hover:opacity-60 transition-opacity text-xl">
            📅
          </a>
        )}
      </span>
    );
  }

  if (status?.connected) {
    return (
      <div className="flex items-center gap-3 p-3 bg-dark-800 rounded-xl border border-green-500/30">
        <span className="text-green-400 text-lg">✅</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-400">Google Kalender verbunden</p>
          <p className="text-xs text-gray-400 truncate">{status.email}</p>
        </div>
        <button
          onClick={disconnect}
          className="text-xs text-red-400 hover:text-red-300 underline whitespace-nowrap"
        >
          Trennen
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/auth/google"
      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
    >
      <span>🔗</span>
      Mit Google Kalender verbinden
    </a>
  );
}
