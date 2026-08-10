import { ApiReference } from "@scalar/nextjs-api-reference";

export const runtime = "nodejs";

export const GET = ApiReference({
  url: "/api/agent/openapi",
  pageTitle: "Applied.dev Agent API",
});
