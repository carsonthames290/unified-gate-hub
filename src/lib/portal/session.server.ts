// Server-only: password hashing, signed session cookies, and access checks.
// Sessions never contain a raw password — only a credential id and version
// counters that are re-validated against the database on every request.
import {
  getCredentialById,
  getGlobalSessionVersion,
  isGateEnabled,
  listSections,
  touchCredential,
  type Credential,
} from "./store.server";

export const SESSION_COOKIE = "portal_session";
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours
const PBKDF2_ITERATIONS = 50000;
export const ADMIN_PERMISSION = "admin";

const enc = new TextEncoder();

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64url = (s: string) => s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/* ---------------- password hashing ---------------- */

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Passwords are matched case-insensitively, like the original Doc Editor gate. */
export function normalizePassword(pw: string): string {
  return pw.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(normalizePassword(password), salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(candidate: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = unb64(parts[2]!);
  const expected = unb64(parts[3]!);
  const actual = await pbkdf2(normalizePassword(candidate), salt, iterations);
  return constantTimeEqual(actual, expected);
}

/* ---------------- signed session cookie ---------------- */

type SessionPayload = { cid: string; v: number; gv: number; exp: number };

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env["PORTAL_SESSION_SECRET"];
  if (!secret) throw new Error("PORTAL_SESSION_SECRET is not configured");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function sign(data: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(data));
  return b64url(b64(sig));
}

export async function createSessionCookieValue(cred: Credential, globalVersion: number): Promise<string> {
  const payload: SessionPayload = {
    cid: cred.id,
    v: cred.session_version,
    gv: globalVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const body = b64url(b64(enc.encode(JSON.stringify(payload))));
  return `${body}.${await sign(body)}`;
}

async function parseSessionCookieValue(value: string | undefined): Promise<SessionPayload | null> {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = await sign(body);
  if (!constantTimeEqual(enc.encode(expected), enc.encode(sig))) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(unb64(unb64url(body)))) as SessionPayload;
    if (typeof payload.cid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function sessionSetCookieHeader(value: string, requestUrl: string): string {
  const secure = requestUrl.startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

export function clearSessionCookieHeader(requestUrl: string): string {
  const secure = requestUrl.startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/* ---------------- session state ---------------- */

export type SessionState = {
  authenticated: boolean;
  credentialId: string | null;
  label: string;
  permissions: string[];
  isAdmin: boolean;
};

const ANONYMOUS: SessionState = { authenticated: false, credentialId: null, label: "", permissions: [], isAdmin: false };

export function credentialIsUsable(cred: Credential | null | undefined): cred is Credential {
  if (!cred || !cred.enabled) return false;
  if (cred.expires_at && new Date(cred.expires_at).getTime() < Date.now()) return false;
  return true;
}

/** Re-validates the cookie against the database (enabled, expiry, revocation). */
export async function getSessionState(cookieHeader: string | null | undefined): Promise<SessionState> {
  const payload = await parseSessionCookieValue(readCookie(cookieHeader, SESSION_COOKIE));
  if (!payload) return ANONYMOUS;
  const [cred, globalVersion] = await Promise.all([getCredentialById(payload.cid), getGlobalSessionVersion()]);
  if (!credentialIsUsable(cred)) return ANONYMOUS;
  if (cred.session_version !== payload.v || globalVersion !== payload.gv) return ANONYMOUS;
  return {
    authenticated: true,
    credentialId: cred.id,
    label: cred.label,
    permissions: cred.permissions,
    isAdmin: cred.permissions.includes(ADMIN_PERMISSION),
  };
}

/** Sections this session may open. With the global gate off, every section is open to everyone. */
export async function allowedSections(state: SessionState) {
  const [sections, gateEnabled] = await Promise.all([listSections(), isGateEnabled()]);
  return sections.filter((s) => !gateEnabled || state.permissions.includes(s.slug));
}

export async function canAccessSection(state: SessionState, slug: string): Promise<boolean> {
  if (!(await isGateEnabled())) return true;
  return state.permissions.includes(slug);
}

/** Where a freshly authenticated credential should land. */
export async function landingPathFor(state: SessionState): Promise<string> {
  const sections = await listSections();
  const first = sections.find((s) => state.permissions.includes(s.slug));
  if (first) return `/${first.slug}`;
  if (state.isAdmin) return "/admin";
  return "/";
}

/**
 * Checks the text typed into the Doc Editor for a valid access password.
 * Only whole words are compared (case-insensitive), against enabled, unexpired credentials.
 */
export async function findCredentialInText(text: string, credentials: Credential[]): Promise<Credential | null> {
  const usable = credentials.filter(credentialIsUsable);
  if (usable.length === 0) return null;
  const words = text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && w.length <= 64);
  const candidates = Array.from(new Set([...words.slice(-8).reverse(), text.trim()].map(normalizePassword))).filter(
    (w) => w.length >= 3 && w.length <= 64,
  );
  for (const candidate of candidates) {
    for (const cred of usable) {
      if (await verifyPassword(candidate, cred.password_hash)) {
        await touchCredential(cred.id);
        return cred;
      }
    }
  }
  return null;
}
