import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gate/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleLogout } = await import("@/lib/portal/handlers.server");
        return handleLogout(request);
      },
    },
  },
});
