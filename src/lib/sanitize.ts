// Strip ASCII control characters that should never appear in user text.
// eslint-disable-next-line no-control-regex -- intentional input sanitization
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SCRIPT_TAG = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const HTML_TAG = /<[^>]*>/g;

export function sanitizePlainText(value: string): string {
  return value.replace(CONTROL_CHARS, "").replace(SCRIPT_TAG, "").replace(HTML_TAG, "").trim();
}

export function sanitizeOptionalPlainText(value: string | null | undefined, maxLength: number): string | null {
  if (value == null) return null;
  const sanitized = sanitizePlainText(value).slice(0, maxLength);
  return sanitized.length > 0 ? sanitized : null;
}

export function sanitizeHttpUrl(value: string): string {
  const trimmed = value.trim().slice(0, 2048);
  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }
  return url.toString();
}

export function emptyToNull(value: unknown): unknown {
  if (value === "" || value === undefined) return null;
  return value;
}
