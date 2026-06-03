import { parseHTML } from "linkedom";
import { errorMessage } from "@/lib/errorMessage";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";
import type { ParseJobUrlResult } from "@/types";
import { buildFullJd } from "./extractFullJd";
import { extractJobCompany } from "./extractJobCompany";
import { extractParaformRole, isParaformHost } from "./extractParaformRole";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 8000;

function getMetaContent(document: Document, property: string): string | null {
  const byProperty = document.querySelector(`meta[property="${property}"]`);
  if (byProperty) {
    return byProperty.getAttribute("content")?.trim() ?? null;
  }

  const byName = document.querySelector(`meta[name="${property}"]`);
  return byName?.getAttribute("content")?.trim() ?? null;
}

function hostnameToCompany(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length === 0) return null;

  const commonSubdomains = new Set(["careers", "jobs", "job", "apply"]);
  let label = parts[0] ?? "";

  if (parts.length > 2 && commonSubdomains.has(parts[0] ?? "")) {
    label = parts[parts.length - 2] ?? label;
  } else if (parts.length >= 2) {
    label = parts[parts.length - 2] ?? label;
  }

  if (!label) return null;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export async function parseJobUrl(urlString: string): Promise<ParseJobUrlResult> {
  let url: URL;
  try {
    url = new URL(urlString.trim());
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "URL must use http or https" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return { ok: false, error: `Request failed with status ${response.status}` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { ok: false, error: "Response is not HTML" };
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    const paraformRole = isParaformHost(url.hostname) ? extractParaformRole(document) : null;

    const rawTitle =
      paraformRole?.title ??
      getMetaContent(document, "og:title") ??
      document.querySelector("title")?.textContent?.trim() ??
      document.querySelector("h1")?.textContent?.trim() ??
      null;
    const title = normalizeJobTitle(rawTitle);

    const company = extractJobCompany(url, document, {
      siteName: getMetaContent(document, "og:site_name"),
      applicationName: getMetaContent(document, "application-name"),
      hostnameFallback: hostnameToCompany(url),
    });

    const metaDescription =
      getMetaContent(document, "og:description") ?? getMetaContent(document, "description") ?? null;

    const fullJd = buildFullJd(document, metaDescription);

    return {
      ok: true,
      title,
      company,
      fullJd,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Request timed out" };
    }
    return {
      ok: false,
      error: errorMessage(error, "Failed to fetch URL"),
    };
  } finally {
    clearTimeout(timeout);
  }
}
