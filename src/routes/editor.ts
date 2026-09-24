import { createFileRoute } from "@tanstack/react-router";

// Alias of the gateway, kept for internal use.
export const Route = createFileRoute("/editor")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleGatePage } = await import("@/lib/portal/handlers.server");
        return handleGatePage(request);
      },
    },
  },
});
