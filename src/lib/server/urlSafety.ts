import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeFetchUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeFetchUrlError";
  }
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return octets;
}

function isPrivateIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return false;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;

  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;

  return false;
}

function isPrivateIpAddress(address: string): boolean {
  const ipVersion = isIP(address);
  if (ipVersion === 4) {
    return isPrivateIpv4(address);
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(address);
  }
  return false;
}

export function assertPrivateIpAddressIsBlocked(address: string): void {
  if (isPrivateIpAddress(address)) {
    throw new UnsafeFetchUrlError("URL resolves to a private or restricted address");
  }
}

export async function assertSafeFetchUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeFetchUrlError("URL must use http or https");
  }

  const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  const literalIpVersion = isIP(hostname);
  if (literalIpVersion !== 0) {
    assertPrivateIpAddressIsBlocked(hostname);
    return;
  }

  const records = await lookup(hostname, { all: true });
  if (records.length === 0) {
    throw new UnsafeFetchUrlError("URL hostname could not be resolved");
  }

  for (const record of records) {
    assertPrivateIpAddressIsBlocked(record.address);
  }
}

export const MAX_FETCH_REDIRECTS = 5;

export function resolveRedirectUrl(currentUrl: URL, location: string): URL {
  return new URL(location, currentUrl);
}
