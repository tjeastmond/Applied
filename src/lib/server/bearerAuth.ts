import { createHash, timingSafeEqual } from "node:crypto";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function constantTimeEquals(left: string, right: string): boolean {
  return timingSafeEqual(sha256(left), sha256(right));
}

export function bearerTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || header.split(" ").length !== 2) {
    return null;
  }

  return token;
}
