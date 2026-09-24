import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/* Every function below re-verifies the caller's session server-side and
   requires the Admin permission. No password hashes ever leave the server. */

async function requireAdmin() {
  const { getSessionState } = await import("./session.server");
  const state = await getSessionState(getRequestHeader("cookie"));
  if (!state.isAdmin) throw new Error("Forbidden");
  return state;
}

export type AdminCredential = {
  id: string;
  label: string;
  enabled: boolean;
  permissions: string[];
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  session_version: number;
};

export const checkAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionState } = await import("./session.server");
  const state = await getSessionState(getRequestHeader("cookie"));
  return { isAdmin: state.isAdmin, label: state.label };
});

export const getAdminState = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireAdmin();
  const store = await import("./store.server");
  const [credentials, sections, gateEnabled] = await Promise.all([
    store.listCredentials(),
    store.listSections(),
    store.isGateEnabled(),
  ]);
  return {
    me: { credentialId: me.credentialId, label: me.label },
    gateEnabled,
    sections,
    credentials: credentials.map<AdminCredential>((c) => ({
      id: c.id,
      label: c.label,
      enabled: c.enabled,
      permissions: c.permissions,
      expires_at: c.expires_at,
      last_used_at: c.last_used_at,
      created_at: c.created_at,
      session_version: c.session_version,
    })),
  };
});

const permissionsSchema = z.array(z.string().regex(/^[a-z0-9-]+$/)).max(50);
const passwordSchema = z.string().trim().min(4, "Password must be at least 4 characters").max(64);

async function validPermissions(perms: string[]) {
  const store = await import("./store.server");
  const slugs = new Set((await store.listSections()).map((s) => s.slug));
  slugs.add("admin");
  return Array.from(new Set(perms.filter((p) => slugs.has(p))));
}

async function assertNotLastAdmin(excludeId: string, nextPerms?: string[], nextEnabled?: boolean) {
  const store = await import("./store.server");
  const { credentialIsUsable } = await import("./session.server");
  const admins = (await store.listCredentials()).filter(
    (c) => c.id !== excludeId && credentialIsUsable(c) && c.permissions.includes("admin"),
  );
  const stillAdmin = nextEnabled !== false && (nextPerms ?? ["admin"]).includes("admin");
  if (admins.length === 0 && !stillAdmin) {
    throw new Error("This is the only working administrator credential. Add another admin first.");
  }
}

export const createCredential = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().trim().max(80).default(""),
        password: passwordSchema,
        permissions: permissionsSchema,
        expiresAt: z.string().nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const store = await import("./store.server");
    const { hashPassword, verifyPassword } = await import("./session.server");
    for (const c of await store.listCredentials()) {
      if (await verifyPassword(data.password, c.password_hash)) throw new Error("That password is already in use.");
    }
    await store.insertCredential({
      label: data.label,
      password_hash: await hashPassword(data.password),
      permissions: await validPermissions(data.permissions),
      enabled: true,
      expires_at: data.expiresAt ? new Date(data.expiresAt).toISOString() : null,
    });
    return { ok: true };
  });

export const updateCredential = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().trim().max(80).optional(),
        password: passwordSchema.optional(),
        permissions: permissionsSchema.optional(),
        enabled: z.boolean().optional(),
        expiresAt: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const store = await import("./store.server");
    const { hashPassword, verifyPassword } = await import("./session.server");
    await assertNotLastAdmin(data.id, data.permissions, data.enabled);
    const patch: Parameters<typeof store.updateCredential>[1] = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.permissions) patch.permissions = await validPermissions(data.permissions);
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.expiresAt !== undefined) patch.expires_at = data.expiresAt ? new Date(data.expiresAt).toISOString() : null;
    if (data.password) {
      for (const c of await store.listCredentials()) {
        if (c.id !== data.id && (await verifyPassword(data.password, c.password_hash)))
          throw new Error("That password is already in use.");
      }
      patch.password_hash = await hashPassword(data.password);
      patch.bumpSession = true;
    }
    // Permission or status changes take effect immediately for active sessions.
    if (data.permissions || data.enabled === false) patch.bumpSession = true;
    await store.updateCredential(data.id, patch);
    return { ok: true };
  });

export const deleteCredential = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const me = await requireAdmin();
    if (me.credentialId === data.id) throw new Error("You cannot delete the credential you are signed in with.");
    await assertNotLastAdmin(data.id, [], false);
    const store = await import("./store.server");
    await store.deleteCredential(data.id);
    return { ok: true };
  });

export const revokeCredentialSessions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const store = await import("./store.server");
    await store.updateCredential(data.id, { bumpSession: true });
    return { ok: true };
  });

export const revokeAllSessions = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const store = await import("./store.server");
  await store.setSetting("global_session_version", (await store.getGlobalSessionVersion()) + 1);
  return { ok: true };
});

export const setGateEnabled = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const store = await import("./store.server");
    await store.setSetting("password_gate_enabled", data.enabled);
    return { ok: true };
  });

export const saveSection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9][a-z0-9-]{0,40}$/, "Use letters, numbers and dashes only"),
        name: z.string().trim().min(1).max(60),
        sourceUrl: z.string().trim().url(),
        mode: z.enum(["auto", "proxy", "frame"]),
        sortOrder: z.number().int().min(0).max(999).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const store = await import("./store.server");
    if (store.RESERVED_SLUGS.has(data.slug) || data.slug === "admin") throw new Error("That address is reserved.");
    if (!/^https?:$/.test(new URL(data.sourceUrl).protocol)) throw new Error("Source must be an http(s) address.");
    await store.upsertSection({
      slug: data.slug,
      name: data.name,
      source_url: data.sourceUrl,
      mode: data.mode,
      sort_order: data.sortOrder,
    });
    return { ok: true };
  });

export const removeSection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const store = await import("./store.server");
    await store.deleteSection(data.slug);
    return { ok: true };
  });

export const scanSection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const store = await import("./store.server");
    const { resolveMode, sourceParts } = await import("./proxy.server");
    const section = await store.getSection(data.slug);
    if (!section) throw new Error("Section not found");
    const mode = await resolveMode(section);
    let status = 0;
    let title = "";
    let pages: string[] = [];
    try {
      const res = await fetch(section.source_url, { headers: { "user-agent": "Mozilla/5.0" } });
      status = res.status;
      const html = await res.text();
      title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
      const { origin, basePath } = sourceParts(section);
      const found = new Set<string>();
      const re = /href="([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) {
        const href = m[1]!;
        let p = "";
        if (href.startsWith(basePath)) p = href.slice(basePath.length);
        else if (href.startsWith(origin + basePath)) p = href.slice((origin + basePath).length);
        else continue;
        p = p.split(/[?#]/)[0]!;
        if (p) found.add(p);
      }
      pages = Array.from(found).sort();
    } catch (err) {
      console.error("[portal] scan failed", err);
    }
    return { mode, status, title, pages, scannedAt: new Date().toISOString() };
  });
