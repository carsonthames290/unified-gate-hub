// Server-only data access for the portal (service role; these tables are not exposed to browsers).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Section = {
  slug: string;
  name: string;
  source_url: string;
  mode: "auto" | "proxy" | "frame";
  sort_order: number;
  created_at: string;
};

export type Credential = {
  id: string;
  label: string;
  password_hash: string;
  enabled: boolean;
  permissions: string[];
  expires_at: string | null;
  last_used_at: string | null;
  session_version: number;
  created_at: string;
  updated_at: string;
};

export const RESERVED_SLUGS = new Set(["admin", "editor", "api", "_serverFn", "assets", "gate", "favicon.ico", "robots.txt"]);

/* small in-memory cache for hot, rarely-changing rows (sections + settings) */
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL = 10_000;
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}
export function invalidateCache() {
  cache.clear();
}

/* ---------- sections ---------- */

export async function listSections(): Promise<Section[]> {
  return cached("sections", async () => {
    const { data, error } = await supabaseAdmin.from("portal_sections").select("*").order("sort_order").order("created_at");
    if (error) throw error;
    return (data ?? []) as Section[];
  });
}

export async function getSection(slug: string): Promise<Section | null> {
  return (await listSections()).find((s) => s.slug === slug) ?? null;
}

export async function upsertSection(section: Omit<Section, "created_at">) {
  const { error } = await supabaseAdmin.from("portal_sections").upsert(section, { onConflict: "slug" });
  if (error) throw error;
  invalidateCache();
}

export async function deleteSection(slug: string) {
  const { error } = await supabaseAdmin.from("portal_sections").delete().eq("slug", slug);
  if (error) throw error;
  invalidateCache();
}

/* ---------- settings ---------- */

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  return cached(`setting:${key}`, async () => {
    const { data, error } = await supabaseAdmin.from("portal_settings").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return (data?.value as T | undefined) ?? fallback;
  });
}

export async function setSetting(key: string, value: unknown) {
  const { error } = await supabaseAdmin
    .from("portal_settings")
    .upsert({ key, value: value as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  invalidateCache();
}

export const isGateEnabled = () => getSetting<boolean>("password_gate_enabled", true);
export const getGlobalSessionVersion = () => getSetting<number>("global_session_version", 1);

/* ---------- credentials ---------- */

export async function listCredentials(): Promise<Credential[]> {
  const { data, error } = await supabaseAdmin.from("portal_credentials").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as Credential[];
}

export async function getCredentialById(id: string): Promise<Credential | null> {
  const { data, error } = await supabaseAdmin.from("portal_credentials").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Credential | null) ?? null;
}

export async function touchCredential(id: string) {
  await supabaseAdmin.from("portal_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", id);
}

export async function insertCredential(row: {
  label: string;
  password_hash: string;
  permissions: string[];
  enabled: boolean;
  expires_at: string | null;
}) {
  const { error } = await supabaseAdmin.from("portal_credentials").insert(row);
  if (error) throw error;
}

export async function updateCredential(
  id: string,
  patch: Partial<Pick<Credential, "label" | "password_hash" | "permissions" | "enabled" | "expires_at">> & {
    bumpSession?: boolean;
  },
) {
  const { bumpSession, ...fields } = patch;
  const update: Partial<Credential> = { ...fields, updated_at: new Date().toISOString() };
  if (bumpSession) {
    const current = await getCredentialById(id);
    if (current) update.session_version = current.session_version + 1;
  }
  const { error } = await supabaseAdmin.from("portal_credentials").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteCredential(id: string) {
  const { error } = await supabaseAdmin.from("portal_credentials").delete().eq("id", id);
  if (error) throw error;
}
