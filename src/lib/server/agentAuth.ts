import { bearerTokenFromRequest, constantTimeEquals } from "@/lib/server/bearerAuth";
import { jsonError } from "@/lib/server/applicationRouteHelpers";

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
