// Server-only: serves a section's source site through this domain.
// "proxy" mode fetches the source HTML live and rewrites links so navigation stays here;
// "frame" mode embeds the source in a full-window frame; "auto" picks based on the
// source's frame-embedding headers.
import type { Section } from "./store.server";
import type { SessionState } from "./session.server";

type SourceParts = { origin: string; basePath: string; entryPath: string };

export function sourceParts(section: Section): SourceParts {
  const u = new URL(section.source_url);
  const path = u.pathname;
  const dir = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
  return { origin: u.origin, basePath: dir, entryPath: path + u.search };
}

/* ---------- mode detection (auto) ---------- */

const frameCheck = new Map<string, { at: number; frameable: boolean }>();

async function sourceIsFrameable(url: string): Promise<boolean> {
  const hit = frameCheck.get(url);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.frameable;
  let frameable = true;
  try {
    const res = await fetch(url, { method: "GET", headers: { "user-agent": UA }, redirect: "follow" });
    const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
    const csp = (res.headers.get("content-security-policy") ?? "").toLowerCase();
    if (xfo.includes("deny") || xfo.includes("sameorigin")) frameable = false;
    if (/frame-ancestors\s+[^;]*/.test(csp) && !/frame-ancestors\s+[^;]*\*/.test(csp)) frameable = false;
    await res.body?.cancel();
  } catch {
    frameable = false;
  }
  frameCheck.set(url, { at: Date.now(), frameable });
  return frameable;
}

export async function resolveMode(section: Section): Promise<"proxy" | "frame"> {
  if (section.mode === "proxy" || section.mode === "frame") return section.mode;
  return (await sourceIsFrameable(section.source_url)) ? "frame" : "proxy";
}

/* ---------- link rewriting ---------- */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const jsonEscape = (s: string) => s.replace(/\//g, "\\/");

/**
 * Rewrites every reference to the source site into a path on this domain:
 *   origin + basePath + x   ->  /slug/x
 *   origin + /other         ->  /slug/~/other
 *   "basePath + x" (root-relative, quoted) -> /slug/x
 *   attribute="/other"      ->  /slug/~/other   (html only)
 */
export function rewriteSourceUrls(text: string, section: Section, isHtml: boolean): string {
  const { origin, basePath } = sourceParts(section);
  const slug = section.slug;
  const baseNoSlash = basePath.replace(/\/$/, "");
  let out = text;

  out = out.replace(new RegExp(escapeRe(origin + basePath), "g"), `/${slug}/`);
  out = out.replace(new RegExp(escapeRe(jsonEscape(origin + basePath)), "g"), jsonEscape(`/${slug}/`));
  if (baseNoSlash) {
    out = out.replace(new RegExp(escapeRe(origin + baseNoSlash) + `(?=["'?#\\s<])`, "g"), `/${slug}`);
  }
  out = out.replace(new RegExp(escapeRe(origin) + "/", "g"), `/${slug}/~/`);
  out = out.replace(new RegExp(escapeRe(jsonEscape(origin)) + "\\\\/", "g"), jsonEscape(`/${slug}/~/`));
  out = out.replace(new RegExp(escapeRe(origin) + `(?=["'\\s<])`, "g"), `/${slug}`);

  if (baseNoSlash) {
    out = out.replace(new RegExp(`(["'])${escapeRe(basePath)}`, "g"), `$1/${slug}/`);
    out = out.replace(new RegExp(`(["'])${escapeRe(jsonEscape(basePath))}`, "g"), `$1${jsonEscape(`/${slug}/`)}`);
    out = out.replace(new RegExp(`(["'])${escapeRe(baseNoSlash)}(?=["'?#])`, "g"), `$1/${slug}`);
  }

  if (isHtml) {
    // Root-relative attribute URLs that are not already ours -> proxy through /slug/~/
    out = out.replace(
      new RegExp(`(\\s(?:src|href|action|poster|data-src|data-url|content)=["'])/(?!/|${escapeRe(slug)}/)`, "g"),
      `$1/${slug}/~/`,
    );
    out = out.replace(/url\((["']?)\/(?!\/)/g, (m, q: string) => (m.includes(`/${slug}/`) ? m : `url(${q}/${slug}/~/`));
    // Neutralize <base href> so relative URLs resolve against our path
    out = out.replace(/<base\s[^>]*>/gi, "");
  }
  return out;
}

/** Maps an upstream Location header (absolute or relative) to a local path when possible. */
export function mapRedirectLocation(location: string, section: Section, requestedUpstream: URL): string {
  let abs: URL;
  try {
    abs = new URL(location, requestedUpstream);
  } catch {
    return `/${section.slug}`;
  }
  const { origin, basePath } = sourceParts(section);
  if (abs.origin !== origin) return abs.toString();
  if (abs.pathname.startsWith(basePath)) return `/${section.slug}/${abs.pathname.slice(basePath.length)}${abs.search}`;
  return `/${section.slug}/~${abs.pathname}${abs.search}`;
}

/* ---------- fetching ---------- */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const STRIP_RESPONSE_HEADERS = new Set([
  "content-security-policy",
  "content-security-policy-report-only",
  "x-frame-options",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
  "report-to",
  "nel",
  "set-cookie",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "alt-svc",
  "strict-transport-security",
  "link",
]);

export function upstreamUrlFor(section: Section, splat: string | undefined, search: string): URL {
  const { origin, basePath, entryPath } = sourceParts(section);
  if (!splat) return new URL(entryPath + (search && !entryPath.includes("?") ? search : ""), origin);
  if (splat.startsWith("~/")) return new URL("/" + splat.slice(2) + search, origin);
  return new URL(basePath + splat + search, origin);
}

export async function proxyRequest(request: Request, section: Section, upstream: URL, navHtml: string): Promise<Response> {
  const headers = new Headers();
  for (const h of ["accept", "accept-language", "range", "content-type", "if-none-match", "if-modified-since"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("user-agent", UA);
  headers.set("referer", upstream.origin + "/");
  headers.set("accept-encoding", "identity");

  const method = request.method.toUpperCase();
  const init: RequestInit = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") init.body = await request.arrayBuffer();

  let res: Response;
  try {
    res = await fetch(upstream, init);
  } catch (err) {
    console.error(`[portal] upstream fetch failed for ${upstream}:`, err);
    return new Response(unavailablePage(section), {
      status: 502,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
    const target = mapRedirectLocation(res.headers.get("location")!, section, upstream);
    return new Response(null, { status: res.status === 301 ? 301 : 302, headers: { location: target, "cache-control": "no-store" } });
  }

  const out = new Headers();
  res.headers.forEach((v, k) => {
    if (!STRIP_RESPONSE_HEADERS.has(k.toLowerCase())) out.set(k, v);
  });

  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const isHtml = ct.includes("text/html");
  const isText = isHtml || ct.includes("javascript") || ct.includes("text/css") || ct.includes("json") || ct.includes("xml");

  if (!isText || res.status === 304) {
    return new Response(res.body, { status: res.status, headers: out });
  }

  let body = rewriteSourceUrls(await res.text(), section, isHtml);
  if (isHtml) {
    body = injectNav(body, navHtml);
    out.set("cache-control", "private, no-store");
  }
  return new Response(body, { status: res.status, headers: out });
}

/* ---------- frame mode ---------- */

export function framePage(section: Section, navHtml: string): string {
  const src = section.source_url.replace(/"/g, "&quot;");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(section.name)}</title><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe src="${src}" title="${escapeHtml(section.name)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen referrerpolicy="no-referrer"></iframe>${navHtml}</body></html>`;
}

/* ---------- portal navigation pill (injected into every section page) ---------- */

export function buildNavHtml(state: SessionState, sections: Section[], current: string): string {
  const links: string[] = [];
  for (const s of sections) {
    links.push(
      `<a href="/${s.slug}"${s.slug === current ? ' data-active="1"' : ""}>${escapeHtml(s.name)}</a>`,
    );
  }
  if (state.isAdmin) links.push(`<a href="/admin"${current === "admin" ? ' data-active="1"' : ""}>Admin</a>`);
  const signOut = state.authenticated
    ? `<button type="button" id="__portal_signout">Sign out</button>`
    : `<a href="/">Sign in</a>`;
  return `<style>#__portal_nav{all:initial;position:fixed;right:14px;bottom:14px;z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:rgba(20,20,24,.92);box-shadow:0 6px 24px rgba(0,0,0,.35);font:500 12px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#eee;backdrop-filter:blur(8px)}#__portal_nav a,#__portal_nav button{all:initial;cursor:pointer;padding:8px 12px;border-radius:999px;color:#ddd;font:inherit;white-space:nowrap}#__portal_nav a:hover,#__portal_nav button:hover{background:rgba(255,255,255,.12);color:#fff}#__portal_nav a[data-active="1"]{background:rgba(255,255,255,.2);color:#fff}#__portal_nav button{color:#f7b0a8}@media print{#__portal_nav{display:none}}</style><nav id="__portal_nav" aria-label="Portal navigation">${links.join("")}${signOut}</nav><script>(function(){var b=document.getElementById("__portal_signout");if(!b)return;b.addEventListener("click",function(){fetch("/api/gate/logout",{method:"POST",credentials:"same-origin"}).finally(function(){location.replace("/")})})})();</script>`;
}

export function injectNav(html: string, navHtml: string): string {
  if (!navHtml) return html;
  const i = html.lastIndexOf("</body>");
  return i === -1 ? html + navHtml : html.slice(0, i) + navHtml + html.slice(i);
}

function unavailablePage(section: Section): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(section.name)} unavailable</title></head><body style="font-family:system-ui;padding:40px;text-align:center"><h1>${escapeHtml(section.name)} is temporarily unavailable</h1><p>The source site could not be reached. Please try again in a moment.</p><p><a href="/">Back</a></p></body></html>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
