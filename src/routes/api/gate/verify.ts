import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gate/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleVerify } = await import("@/lib/portal/handlers.server");
        return handleVerify(request);
      },
    },
  },
});
