import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  checkAdminSession,
  createCredential,
  deleteCredential,
  getAdminState,
  removeSection,
  revokeAllSessions,
  revokeCredentialSessions,
  saveSection,
  scanSection,
  setGateEnabled,
  updateCredential,
  type AdminCredential,
} from "@/lib/portal/admin.functions";

export const Route = createFileRoute("/admin")({
  // Server-verified on every visit (SSR and client navigation). Non-admins never see this page.
  beforeLoad: async () => {
    const s = await checkAdminSession();
    if (!s.isAdmin) throw redirect({ to: "/" });
  },
  loader: () => getAdminState(),
  head: () => ({
    meta: [
      { title: "Admin — Access Control" },
      { name: "description", content: "Manage access passwords, permissions, sessions and sections for the portal." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin — Access Control" },
      { property: "og:description", content: "Portal administration dashboard." },
    ],
  }),
  headers: () => ({ "cache-control": "private, no-store" }),
  component: AdminPage,
  errorComponent: ({ error }) => (
    <div className="admin-shell p-10 text-sm text-destructive">Could not load the dashboard: {error.message}</div>
  ),
});

type Section = { slug: string; name: string; source_url: string; mode: "auto" | "proxy" | "frame"; sort_order: number };

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function toLocalInput(d: string | null) {
  if (!d) return "";
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (fn: () => Promise<unknown>, okMsg?: string) => {
      setBusy(true);
      try {
        await fn();
        if (okMsg) toast.success(okMsg);
        await router.invalidate();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
  };
}

function AdminPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const { busy, run } = useAction();
  const setGate = useServerFn(setGateEnabled);
  const revokeAll = useServerFn(revokeAllSessions);
  const permissionOptions = [...data.sections.map((s) => ({ slug: s.slug, name: s.name })), { slug: "admin", name: "Admin" }];

  async function signOut() {
    await fetch("/api/gate/logout", { method: "POST", credentials: "same-origin" });
    window.location.replace("/");
  }

  return (
    <div className="admin-shell min-h-screen">
      <Toaster position="bottom-right" />
      <header className="admin-header">
        <div>
          <p className="eyebrow">Portal</p>
          <h1 className="font-display text-2xl">Access Control</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.sections.map((s) => (
            <a key={s.slug} href={`/${s.slug}`} className="btn btn-ghost">
              {s.name}
            </a>
          ))}
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-main">
        {/* Global gate */}
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="panel-title">Global password gate</h2>
              <p className="muted">
                {data.gateEnabled
                  ? "ON — visitors must enter a password to open any section."
                  : "OFF — anyone can open the sections without a password. The admin dashboard still requires an admin password."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline"
                disabled={busy}
                onClick={() =>
                  confirm("Sign out every active session on every credential (including yours)?") &&
                  run(() => revokeAll(), "All sessions revoked").then(() => window.location.replace("/"))
                }
              >
                Revoke all sessions
              </button>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={data.gateEnabled}
                  disabled={busy}
                  onChange={(e) => run(() => setGate({ data: { enabled: e.target.checked } }), "Gate updated")}
                />
                <span className="switch-track" />
                <span className="switch-label">{data.gateEnabled ? "On" : "Off"}</span>
              </label>
            </div>
          </div>
        </section>

        {/* Credentials */}
        <section className="panel">
          <h2 className="panel-title">Access passwords</h2>
          <p className="muted mb-4">
            Each password only opens the sections ticked for it. Passwords are stored as one-way hashes and cannot be
            viewed after creation. The Doc Editor is always the entry gate and is not a permission.
          </p>
          <div className="grid gap-3">
            {data.credentials.map((c) => (
              <CredentialRow key={c.id} cred={c} options={permissionOptions} isMe={c.id === data.me.credentialId} />
            ))}
          </div>
          <NewCredential options={permissionOptions} />
        </section>

        {/* Sections */}
        <section className="panel">
          <h2 className="panel-title">Sections (source sites)</h2>
          <p className="muted mb-4">
            Each section is served live from its source site through this domain, so any change on the source (for
            example a new game on the Google Site) appears here automatically. Adding a section adds a new permission
            checkbox above.
          </p>
          <div className="grid gap-3">
            {data.sections.map((s) => (
              <SectionRow key={s.slug} section={s} />
            ))}
          </div>
          <NewSection />
        </section>
        <p className="muted text-center text-xs">
          Signed in as <strong>{data.me.label || "Administrator"}</strong>.{" "}
          <button className="link" onClick={() => router.invalidate()}>
            Refresh
          </button>
        </p>
      </main>
    </div>
  );
}

/* ---------------- credentials ---------------- */

function PermissionBoxes({
  options,
  value,
  onChange,
  idPrefix,
}: {
  options: { slug: string; name: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {options.map((o) => {
        const id = `${idPrefix}-${o.slug}`;
        return (
          <label key={o.slug} htmlFor={id} className="check">
            <input
              id={id}
              type="checkbox"
              checked={value.includes(o.slug)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, o.slug] : value.filter((v) => v !== o.slug))
              }
            />
            <span>{o.name}</span>
          </label>
        );
      })}
    </div>
  );
}

function CredentialRow({
  cred,
  options,
  isMe,
}: {
  cred: AdminCredential;
  options: { slug: string; name: string }[];
  isMe: boolean;
}) {
  const { busy, run } = useAction();
  const update = useServerFn(updateCredential);
  const del = useServerFn(deleteCredential);
  const revoke = useServerFn(revokeCredentialSessions);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(cred.label);
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState<string[]>(cred.permissions);
  const [expires, setExpires] = useState(toLocalInput(cred.expires_at));
  const expired = !!cred.expires_at && new Date(cred.expires_at).getTime() < Date.now();

  async function save() {
    await run(
      () =>
        update({
          data: {
            id: cred.id,
            label,
            permissions: perms,
            expiresAt: expires ? new Date(expires).toISOString() : null,
            ...(password ? { password } : {}),
          },
        }),
      "Credential updated",
    );
    setPassword("");
    setEditing(false);
  }

  return (
    <div className={`row ${!cred.enabled || expired ? "row-disabled" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{cred.label || "Untitled credential"}</span>
            {isMe && <span className="tag tag-accent">you</span>}
            <span className={`tag ${cred.enabled && !expired ? "tag-ok" : "tag-off"}`}>
              {!cred.enabled ? "disabled" : expired ? "expired" : "enabled"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {cred.permissions.length === 0 && <span className="tag">no access</span>}
            {cred.permissions.map((p) => (
              <span key={p} className="tag">
                {options.find((o) => o.slug === p)?.name ?? p}
              </span>
            ))}
          </div>
          <p className="muted mt-2 text-xs">
            Created {fmt(cred.created_at)} · Last used {fmt(cred.last_used_at)} · Expires{" "}
            {cred.expires_at ? fmt(cred.expires_at) : "never"} · Sessions v{cred.session_version}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn btn-outline" disabled={busy} onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </button>
          <button
            className="btn btn-outline"
            disabled={busy}
            onClick={() =>
              run(() => update({ data: { id: cred.id, enabled: !cred.enabled } }), cred.enabled ? "Disabled" : "Enabled")
            }
          >
            {cred.enabled ? "Disable" : "Enable"}
          </button>
          <button
            className="btn btn-outline"
            disabled={busy}
            onClick={() => run(() => revoke({ data: { id: cred.id } }), "Sessions revoked")}
          >
            Revoke sessions
          </button>
          <button
            className="btn btn-danger"
            disabled={busy || isMe}
            onClick={() => confirm(`Delete "${cred.label || "this credential"}"?`) && run(() => del({ data: { id: cred.id } }), "Deleted")}
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="edit-grid">
          <label className="field">
            <span>Label</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Games access" />
          </label>
          <label className="field">
            <span>New password (leave blank to keep)</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="enter password"
            />
          </label>
          <label className="field">
            <span>Expires (optional)</span>
            <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
          <div className="field">
            <span>Access</span>
            <PermissionBoxes options={options} value={perms} onChange={setPerms} idPrefix={`p-${cred.id}`} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              Save changes
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewCredential({ options }: { options: { slug: string; name: string }[] }) {
  const { busy, run } = useAction();
  const create = useServerFn(createCredential);
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [expires, setExpires] = useState("");

  return (
    <form
      className="subpanel mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            create({
              data: { label, password, permissions: perms, expiresAt: expires ? new Date(expires).toISOString() : null },
            }),
          "Credential created",
        ).then(() => {
          setLabel("");
          setPassword("");
          setPerms([]);
          setExpires("");
        });
      }}
    >
      <h3 className="font-semibold">Add a password</h3>
      <div className="edit-grid">
        <label className="field">
          <span>Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Who is this for?" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="enter password"
          />
        </label>
        <label className="field">
          <span>Expires (optional)</span>
          <input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </label>
        <div className="field">
          <span>Access</span>
          <PermissionBoxes options={options} value={perms} onChange={setPerms} idPrefix="new" />
        </div>
        <div className="sm:col-span-2">
          <button className="btn btn-primary" disabled={busy || !password}>
            Create password
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------------- sections ---------------- */

function SectionRow({ section }: { section: Section }) {
  const { busy, run } = useAction();
  const save = useServerFn(saveSection);
  const remove = useServerFn(removeSection);
  const scan = useServerFn(scanSection);
  const [mode, setMode] = useState(section.mode);
  const [scanResult, setScanResult] = useState<null | { mode: string; status: number; title: string; pages: string[] }>(
    null,
  );

  return (
    <div className="row">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{section.name}</span>
            <code className="tag">/{section.slug}</code>
          </div>
          <p className="muted mt-1 break-all text-xs">{section.source_url}</p>
          {scanResult && (
            <p className="muted mt-2 text-xs">
              Scan: HTTP {scanResult.status || "error"} · served via <strong>{scanResult.mode}</strong>
              {scanResult.title ? ` · "${scanResult.title}"` : ""}
              {scanResult.pages.length > 0 ? ` · ${scanResult.pages.length} pages found: ${scanResult.pages.join(", ")}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            className="select"
            value={mode}
            disabled={busy}
            onChange={(e) => {
              const m = e.target.value as Section["mode"];
              setMode(m);
              run(
                () =>
                  save({
                    data: {
                      slug: section.slug,
                      name: section.name,
                      sourceUrl: section.source_url,
                      mode: m,
                      sortOrder: section.sort_order,
                    },
                  }),
                "Section updated",
              );
            }}
          >
            <option value="auto">Auto-detect</option>
            <option value="proxy">Proxy (rewrite links)</option>
            <option value="frame">Embed (frame)</option>
          </select>
          <button
            className="btn btn-outline"
            disabled={busy}
            onClick={() =>
              run(async () => {
                setScanResult(await scan({ data: { slug: section.slug } }));
              })
            }
          >
            Scan now
          </button>
          <button
            className="btn btn-danger"
            disabled={busy}
            onClick={() =>
              confirm(`Remove the "${section.name}" section? Its permission will disappear from all credentials.`) &&
              run(() => remove({ data: { slug: section.slug } }), "Section removed")
            }
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function NewSection() {
  const { busy, run } = useAction();
  const save = useServerFn(saveSection);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Section["mode"]>("auto");

  return (
    <form
      className="subpanel mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => save({ data: { slug, name, sourceUrl: url, mode, sortOrder: 99 } }), "Section added").then(() => {
          setName("");
          setSlug("");
          setUrl("");
        });
      }}
    >
      <h3 className="font-semibold">Add a section</h3>
      <div className="edit-grid">
        <label className="field">
          <span>Name</span>
          <input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
            }}
            placeholder="e.g. Movies"
          />
        </label>
        <label className="field">
          <span>Address on this site</span>
          <div className="flex items-center gap-1">
            <span className="muted">/</span>
            <input required pattern="[a-z0-9][a-z0-9-]*" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="movies" />
          </div>
        </label>
        <label className="field sm:col-span-2">
          <span>Source website</span>
          <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        <label className="field">
          <span>How to serve it</span>
          <select className="select" value={mode} onChange={(e) => setMode(e.target.value as Section["mode"])}>
            <option value="auto">Auto-detect</option>
            <option value="proxy">Proxy (rewrite links)</option>
            <option value="frame">Embed (frame)</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="btn btn-primary" disabled={busy}>
            Add section
          </button>
        </div>
      </div>
    </form>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
