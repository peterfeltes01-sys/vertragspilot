# 📑 VertragsPilot – Vertragsmanagement

Verwalte deine Verträge, behalte Kosten im Blick und verpasse keine Kündigungsfrist.

## 🚀 Setup in 4 Schritten

### Voraussetzungen
- **Node.js** (Version 18 oder höher) — [Download](https://nodejs.org/)
- Ein Terminal (z.B. CMD, PowerShell, oder Terminal auf Mac)

### 1. Projekt entpacken und öffnen
```bash
# ZIP entpacken, dann in den Ordner wechseln:
cd vertragspilot
```

### 2. Pakete installieren
```bash
npm install
```

### 3. Datenbank erstellen und mit deinen Verträgen befüllen
```bash
npm run setup
```
Dieser Befehl:
- Erstellt eine SQLite-Datenbank (`prisma/dev.db`)
- Legt alle 24 Kategorien an
- Importiert deine 45 Verträge aus dem Excel-Sheet

### 4. App starten
```bash
npm run dev
```
Öffne dann **http://localhost:3000** in deinem Browser.

---

## 📋 Features

| Feature | Beschreibung |
|---------|-------------|
| **Dashboard** | Gesamtübersicht mit Kosten, Warnungen, Kategorien |
| **Vertragsliste** | Suche, Filter, Sortierung aller Verträge |
| **Warnungen** | Automatische Warnung vor ablaufenden Fristen |
| **Kostenanalyse** | Aufschlüsselung nach Kategorie, Top 10, Intervalle |
| **Kalender** | Monatsübersicht aller Termine und Fristen |
| **CRUD** | Verträge anlegen, bearbeiten, löschen |
| **SQLite DB** | Persistente Datenspeicherung |

## 🗄️ Datenbank

Die App nutzt **SQLite** via Prisma – eine einfache Datei-Datenbank, die direkt im Projektordner liegt (`prisma/dev.db`). Keine separate Datenbank-Installation nötig.

### Nützliche Befehle
```bash
# Datenbank im Browser anschauen/bearbeiten:
npm run db:studio

# Datenbank zurücksetzen und neu befüllen:
npm run setup
```

## 🏗️ Projektstruktur

```
vertragspilot/
├── app/
│   ├── api/
│   │   ├── contracts/        # API: Verträge CRUD
│   │   └── kategorien/       # API: Kategorien
│   ├── globals.css
│   ├── layout.js
│   └── page.js               # Startseite (Server Component)
├── components/
│   └── VertragsPilot.js       # Haupt-UI (Client Component)
├── lib/
│   ├── prisma.js              # DB-Verbindung
│   └── utils.js               # Hilfsfunktionen
├── prisma/
│   ├── schema.prisma          # Datenbankmodell
│   └── seed.mjs               # Deine Vertragsdaten
└── package.json
```

## 🔧 Weiterentwicklung

Mögliche nächste Schritte:
- **E-Mail-Erinnerungen** (z.B. mit Cron-Job + Nodemailer)
- **Dokumente anhängen** (PDF-Upload pro Vertrag)
- **Export** (Excel/CSV-Export der Verträge)
- **Mehrbenutzer** (Login für Peter & Petra)
- **Deployment** (z.B. auf Vercel oder Raspberry Pi)
