# Google Calendar Integration – Setup-Anleitung

## 1. Google Cloud Project erstellen

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/)
2. Klicke oben auf **"Projekt auswählen"** → **"Neues Projekt"**
3. Projektname: `VertragsPilot` → **"Erstellen"**

## 2. Google Calendar API aktivieren

1. Im Menü: **APIs & Dienste** → **Bibliothek**
2. Suche nach `Google Calendar API`
3. Klicke darauf → **"Aktivieren"**

## 3. OAuth 2.0 Credentials erstellen

1. **APIs & Dienste** → **Anmeldedaten** → **"Anmeldedaten erstellen"** → **"OAuth-Client-ID"**
2. Falls noch nicht konfiguriert: Klicke auf **"Einwilligungsbildschirm konfigurieren"**
   - User Type: **Extern**
   - App-Name: `VertragsPilot`
   - Deine E-Mail als Support-Kontakt eintragen
   - Speichern
3. Zurück zu **"Anmeldedaten erstellen"** → **"OAuth-Client-ID"**
   - Anwendungstyp: **Webanwendung**
   - Name: `VertragsPilot Web`
   - **Autorisierte Weiterleitungs-URIs** hinzufügen:
     - `https://vertragspilot-psi.vercel.app/api/auth/google/callback`
     - `http://localhost:3000/api/auth/google/callback`
4. **"Erstellen"** → Client-ID und Client-Secret notieren

## 4. Umgebungsvariablen setzen

### Lokal (.env.local)

```env
GOOGLE_CLIENT_ID=deine-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-dein-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### Vercel (Production)

```bash
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REDIRECT_URI
# GOOGLE_REDIRECT_URI = https://vertragspilot-psi.vercel.app/api/auth/google/callback
```

Oder im Vercel Dashboard: **Project Settings** → **Environment Variables**

## 5. Test des OAuth-Flows

1. App starten: `npm run dev`
2. In den App-Einstellungen auf **"Mit Google Kalender verbinden"** klicken
3. Google-Konto auswählen und Berechtigungen erteilen
4. Weiterleitung zurück zur App – Verbindungsstatus sollte grün sein
5. Einen Vertrag mit `naechsteKuendigung` öffnen und **"In Kalender eintragen"** klicken

## Hinweise

- Die App benötigt nur den Scope `calendar.events` (Lesen/Schreiben von Events), keinen vollen Kalender-Zugriff
- Tokens werden verschlüsselt in der Datenbank gespeichert (kein Client-Zugriff)
- Bei abgelaufenem Access Token wird automatisch der Refresh Token verwendet
- Um die Verbindung zu trennen: Einstellungen → **"Verbindung trennen"** (revokiert auch den Token bei Google)
