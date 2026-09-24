// Server-only request handlers shared by the portal routes.
import { gatePageHtml } from "./gate-page.server";
import { buildNavHtml, framePage, proxyRequest, resolveMode, upstreamUrlFor } from "./proxy.server";
import {
  allowedSections,
  canAccessSection,
  clearSessionCookieHeader,
  createSessionCookieValue,
  findCredentialInText,
  getSessionState,
  landingPathFor,
  sessionSetCookieHeader,
} from "./session.server";
import { getGlobalSessionVersion, getSection, listCredentials } from "./store.server";

const NO_STORE = "private, no-store, max-age=0";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  return true;
}

function redirectHome(): Response {
  return new Response(null, { status: 302, headers: { location: "/", "cache-control": NO_STORE } });
}

/** GET /  and GET /editor — the Doc Editor gateway. */
export async function handleGatePage(request: Request): Promise<Response> {
  const state = await getSessionState(request.headers.get("cookie"));
  const sections = await allowedSections(state);
  const nav = state.authenticated || sections.length > 0 ? buildNavHtml(state, sections, "") : "";
  return new Response(gatePageHtml(nav), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": NO_STORE, "x-frame-options": "SAMEORIGIN" },
  });
}

/** POST /api/gate/verify — checks the editor text for a valid access password. */
export async function handleVerify(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!text.trim()) return Response.json({ ok: false });

  const cred = await findCredentialInText(text, await listCredentials());
  if (!cred) return Response.json({ ok: false }, { headers: { "cache-control": NO_STORE } });

  const cookie = await createSessionCookieValue(cred, await getGlobalSessionVersion());
  const state = await getSessionState(`portal_session=${encodeURIComponent(cookie)}`);
  const redirect = await landingPathFor(state);
  return Response.json(
    { ok: true, redirect },
    { headers: { "set-cookie": sessionSetCookieHeader(cookie, request.url), "cache-control": NO_STORE } },
  );
}

/** POST /api/gate/logout */
export async function handleLogout(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ ok: false }, { status: 403 });
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": clearSessionCookieHeader(request.url), "cache-control": NO_STORE } },
  );
}

/** GET|POST /:section and /:section/* — authorization + live proxy / frame. */
export async function handleSection(request: Request, slug: string, splat: string | undefined): Promise<Response> {
  const section = await getSection(slug);
  if (!section) return new Response("Not found", { status: 404, headers: { "cache-control": NO_STORE } });

  const state = await getSessionState(request.headers.get("cookie"));
  if (!(await canAccessSection(state, slug))) {
    // Not signed in, or signed in without this permission: back to the gateway.
    return redirectHome();
  }

  const url = new URL(request.url);
  const mode = await resolveMode(section);
  const isDocument = !splat || (request.headers.get("sec-fetch-dest") ?? "document") === "document";
  const nav = isDocument ? buildNavHtml(state, await allowedSections(state), slug) : "";

  if (mode === "frame") {
    if (splat) return new Response("Not found", { status: 404 });
    return new Response(framePage(section, nav), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": NO_STORE },
    });
  }

  const upstream = upstreamUrlFor(section, splat, url.search);
  return proxyRequest(request, section, upstream, nav);
}
