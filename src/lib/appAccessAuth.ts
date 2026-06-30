import { bearerTokenFromRequest } from "@/lib/server/bearerAuth";

export const APP_SESSION_COOKIE = "applied-session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function getAppAccessToken(): string | undefined {
  const token = process.env.APP_ACCESS_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function hmacSha256Base64Url(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function signSessionCookie(secret: string, expiresAt: number): Promise<string> {
  const payload = `v1.${expiresAt}`;
  const signature = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifySessionCookie(secret: string, value: string | undefined): Promise<boolean> {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [version, expiresAtRaw, signature] = parts;
  if (version !== "v1" || !expiresAtRaw || !signature) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const payload = `v1.${expiresAtRaw}`;
  const expected = await hmacSha256Base64Url(secret, payload);
  return constantTimeEqual(signature, expected);
}

export function isBearerTokenValid(request: Request, configuredToken: string): boolean {
  const token = bearerTokenFromRequest(request);
  if (!token) return false;

  if (token.length !== configuredToken.length) return false;

  let result = 0;
  for (let index = 0; index < token.length; index += 1) {
    result |= token.charCodeAt(index) ^ configuredToken.charCodeAt(index);
  }
  return result === 0;
}

export function sessionCookieFromRequest(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === APP_SESSION_COOKIE) {
      return valueParts.join("=");
    }
  }

  return undefined;
}

export async function isAppAccessAuthorized(request: Request): Promise<boolean> {
  const configuredToken = getAppAccessToken();
  if (!configuredToken) return false;

  if (isBearerTokenValid(request, configuredToken)) {
    return true;
  }

  return verifySessionCookie(configuredToken, sessionCookieFromRequest(request));
}

export function buildSessionSetCookieHeader(value: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${APP_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function buildSessionClearCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${APP_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
