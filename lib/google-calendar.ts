import { prisma } from './prisma';

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleUserInfo {
  email: string;
  name?: string;
}

export interface CalendarEventPayload {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  colorId?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

export interface ContractForSync {
  id: number;
  vertrag: string;
  kategorie: string;
  naechsteKuendigung?: Date | null;
  vertragsende?: Date | null;
  kosten?: number | null;
  zahlungsintervall?: string | null;
  kuendigungsfrist?: string | null;
  kundennummer?: string | null;
}

export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function getValidToken(): Promise<string> {
  const auth = await prisma.googleAuth.findFirst();
  if (!auth) throw new Error('Not authenticated with Google');

  if (auth.tokenExpiry < new Date()) {
    const data = await refreshAccessToken(auth.refreshToken);
    const updated = await prisma.googleAuth.update({
      where: { id: auth.id },
      data: {
        accessToken: data.access_token,
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      },
    });
    return updated.accessToken;
  }
  return auth.accessToken;
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildKuendigungsEventPayload(contract: ContractForSync): CalendarEventPayload {
  const date = toDateString(contract.naechsteKuendigung!);
  const kostenStr = contract.kosten
    ? `${contract.kosten.toFixed(2)} € (${contract.zahlungsintervall || 'monatlich'})`
    : '—';
  return {
    summary: `⚠️ Kündigungsfrist: ${contract.vertrag}`,
    description: [
      `Kategorie: ${contract.kategorie}`,
      `Kosten: ${kostenStr}`,
      contract.kuendigungsfrist ? `Kündigungsfrist: ${contract.kuendigungsfrist}` : '',
      contract.kundennummer ? `Kundennummer: ${contract.kundennummer}` : '',
      '',
      'Verwaltet in VertragsPilot: https://vertragspilot-psi.vercel.app/',
    ]
      .filter(Boolean)
      .join('\n'),
    start: { date },
    end: { date },
    colorId: '11',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 14 * 24 * 60 },
        { method: 'popup', minutes: 7 * 24 * 60 },
        { method: 'popup', minutes: 24 * 60 },
      ],
    },
  };
}

function buildVertragsEndeEventPayload(contract: ContractForSync): CalendarEventPayload {
  const date = toDateString(contract.vertragsende!);
  const kostenStr = contract.kosten
    ? `${contract.kosten.toFixed(2)} € (${contract.zahlungsintervall || 'monatlich'})`
    : '—';
  return {
    summary: `📋 Vertragsende: ${contract.vertrag}`,
    description: [
      `Kategorie: ${contract.kategorie}`,
      `Kosten: ${kostenStr}`,
      contract.kundennummer ? `Kundennummer: ${contract.kundennummer}` : '',
      '',
      'Verwaltet in VertragsPilot: https://vertragspilot-psi.vercel.app/',
    ]
      .filter(Boolean)
      .join('\n'),
    start: { date },
    end: { date },
    colorId: '5',
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 30 * 24 * 60 },
        { method: 'popup', minutes: 14 * 24 * 60 },
        { method: 'popup', minutes: 7 * 24 * 60 },
      ],
    },
  };
}

/** @deprecated use buildKuendigungsEventPayload */
function buildEventPayload(contract: ContractForSync): CalendarEventPayload {
  return buildKuendigungsEventPayload(contract);
}

async function calendarRequest(
  endpoint: string,
  method: string,
  body?: object
): Promise<any> {
  const token = await getValidToken();
  const auth = await prisma.googleAuth.findFirst();
  const calendarId = encodeURIComponent(auth?.calendarId ?? 'primary');
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events${endpoint}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar API error (${res.status}): ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function createCalendarEvent(contract: ContractForSync): Promise<string> {
  const data = await calendarRequest('', 'POST', buildKuendigungsEventPayload(contract));
  return data.id;
}

export async function createVertragsEndeCalendarEvent(contract: ContractForSync): Promise<string> {
  const data = await calendarRequest('', 'POST', buildVertragsEndeEventPayload(contract));
  return data.id;
}

export async function updateCalendarEvent(
  eventId: string,
  contract: ContractForSync
): Promise<void> {
  await calendarRequest(`/${eventId}`, 'PUT', buildKuendigungsEventPayload(contract));
}

export async function updateVertragsEndeCalendarEvent(
  eventId: string,
  contract: ContractForSync
): Promise<void> {
  await calendarRequest(`/${eventId}`, 'PUT', buildVertragsEndeEventPayload(contract));
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await calendarRequest(`/${eventId}`, 'DELETE');
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  });
}
