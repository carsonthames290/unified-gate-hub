import { createFileRoute } from "@tanstack/react-router";

// The Doc Editor password gateway. Served as plain HTML so the original
// editor UI and behaviour are preserved exactly.
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleGatePage } = await import("@/lib/portal/handlers.server");
        return handleGatePage(request);
      },
    },
  },
});
