import { createHash, timingSafeEqual } from "node:crypto";
import { jsonError } from "@/lib/server/applicationRouteHelpers";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function constantTimeEquals(left: string, right: string): boolean {
  return timingSafeEqual(sha256(left), sha256(right));
}

function bearerTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || header.split(" ").length !== 2) {
    return null;
  }

  return token;
}

export function requireAgentAuth(request: Request): Response | null {
  const configuredToken = process.env.AGENT_API_TOKEN;
  if (!configuredToken) {
    return jsonError("Agent API token is not configured", 503);
  }

  const token = bearerTokenFromRequest(request);
  if (!token || !constantTimeEquals(token, configuredToken)) {
    return jsonError("Unauthorized", 401);
  }

  return null;
}
