export function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}
