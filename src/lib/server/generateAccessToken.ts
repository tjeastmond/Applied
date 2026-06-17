import { randomBytes } from "node:crypto";

export function generateAccessToken(): string {
  return randomBytes(32).toString("base64url");
}
