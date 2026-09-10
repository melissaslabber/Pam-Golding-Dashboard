import { cookies } from "next/headers";
import crypto from "node:crypto";

const SESSION_COOKIE = "pg_google_calendar";
const STATE_COOKIE = "pg_google_calendar_state";

export type GoogleSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  profileId: string;
};

function key() {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not configured.");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(value: GoogleSession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

function decrypt(value?: string): GoogleSession | null {
  if (!value) return null;
  try {
    const [iv, tag, encrypted] = value.split(".").map(part => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

export function googleRedirectUri(origin: string) {
  return `${origin}/api/google/callback`;
}

export function googleClientId() {
  const value = process.env.GOOGLE_CLIENT_ID;
  if (!value) throw new Error("GOOGLE_CLIENT_ID is not configured.");
  return value;
}

export async function saveState(state: string, profileId: string) {
  const jar = await cookies();
  jar.set(STATE_COOKIE, `${state}.${Buffer.from(profileId).toString("base64url")}`, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
}

export async function consumeState(state: string) {
  const jar = await cookies();
  const stored = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!stored) return null;
  const dot = stored.indexOf(".");
  if (dot < 1 || stored.slice(0, dot) !== state) return null;
  try { return Buffer.from(stored.slice(dot + 1), "base64url").toString("utf8"); } catch { return null; }
}

export async function saveSession(session: GoogleSession) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encrypt(session), {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 180, path: "/",
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession(profileId?: string) {
  const session = decrypt((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || (profileId && session.profileId !== profileId)) return null;
  return session;
}

export async function accessToken(profileId: string) {
  const session = await readSession(profileId);
  if (!session) throw new Error("Google Calendar is not connected for this profile.");
  if (session.expiresAt > Date.now() + 60_000) return session.accessToken;
  if (!session.refreshToken) throw new Error("Google Calendar needs to be reconnected.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId(), client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: session.refreshToken, grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || "Google Calendar authorization expired.");
  const refreshed = { ...session, accessToken: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
  await saveSession(refreshed);
  return refreshed.accessToken;
}

export async function googleRequest(profileId: string, path: string, init?: RequestInit) {
  const token = await accessToken(profileId);
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || "Google Calendar request failed.");
  return result;
}
