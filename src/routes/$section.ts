import { createFileRoute } from "@tanstack/react-router";

// /games, /sports, and any section added later in the admin dashboard.
// Every request is authorized on the server before any content is served.
export const Route = createFileRoute("/$section")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleSection } = await import("@/lib/portal/handlers.server");
        return handleSection(request, params.section, undefined);
      },
      POST: async ({ request, params }) => {
        const { handleSection } = await import("@/lib/portal/handlers.server");
        return handleSection(request, params.section, undefined);
      },
    },
  },
});
