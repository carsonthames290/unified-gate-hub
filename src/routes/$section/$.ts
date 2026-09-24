import { createFileRoute } from "@tanstack/react-router";

// Sub-pages and assets of a proxied section (e.g. /games/moto-x3m, /games/~/_/...).
export const Route = createFileRoute("/$section/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleSection } = await import("@/lib/portal/handlers.server");
        return handleSection(request, params.section, params._splat);
      },
      POST: async ({ request, params }) => {
        const { handleSection } = await import("@/lib/portal/handlers.server");
        return handleSection(request, params.section, params._splat);
      },
    },
  },
});
