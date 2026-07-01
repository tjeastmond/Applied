import { parseHTML } from "linkedom";
import { errorMessage } from "@/lib/errorMessage";
import { canonicalizeLinkedInJobUrl } from "@/lib/linkedinJobUrl";
import { log } from "@/lib/server/logging/logger";
import { hostFromUrl } from "@/lib/server/logging/sanitize";
import { parseParsedApplicationSalaryFields } from "@/lib/schemas/application";
import { parseJobUrlResultSchema, type ParseJobUrlResult } from "@/lib/schemas/parseJob";
import {
  assertSafeFetchUrl,
  MAX_FETCH_REDIRECTS,
  resolveRedirectUrl,
  UnsafeFetchUrlError,
} from "@/lib/server/urlSafety";
import { buildFullJd } from "./extractFullJd";
import { extractJobCompany } from "./extractJobCompany";
import { extractLinkedInRole, isLinkedInHost } from "./extractLinkedInRole";
import { extractJobSalary } from "./extractJobSalary";
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
  urlString = canonicalizeLinkedInJobUrl(urlString.trim());

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "URL must use http or https" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "URL must use http or https" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let currentUrl = url;
    let response: Response | null = null;

    for (let hop = 0; hop <= MAX_FETCH_REDIRECTS; hop += 1) {
      await assertSafeFetchUrl(currentUrl);
      const nextResponse = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
      });

      if (nextResponse.status >= 300 && nextResponse.status < 400) {
        const location = nextResponse.headers.get("location");
        if (!location) {
          return { ok: false, error: `Redirect missing location header (${nextResponse.status})` };
        }
        if (hop === MAX_FETCH_REDIRECTS) {
          return { ok: false, error: "Too many redirects" };
        }
        currentUrl = resolveRedirectUrl(currentUrl, location);
        continue;
      }

      response = nextResponse;
      break;
    }

    if (!response) {
      return { ok: false, error: "Failed to fetch URL" };
    }

    if (!response.ok) {
      return { ok: false, error: `Request failed with status ${response.status}` };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { ok: false, error: "Response is not HTML" };
    }

    const html = await response.text();
    const { document } = parseHTML(html);

    const paraformRole = isParaformHost(currentUrl.hostname) ? extractParaformRole(document) : null;
    const linkedInRole = isLinkedInHost(currentUrl.hostname) ? extractLinkedInRole(document) : null;

    const title =
      linkedInRole?.title ??
      paraformRole?.title ??
      getMetaContent(document, "og:title") ??
      document.querySelector("title")?.textContent?.trim() ??
      document.querySelector("h1")?.textContent?.trim() ??
      null;

    const company =
      linkedInRole?.company ??
      extractJobCompany(currentUrl, document, {
        siteName: getMetaContent(document, "og:site_name"),
        applicationName: getMetaContent(document, "application-name"),
        hostnameFallback: hostnameToCompany(currentUrl),
      });

    const metaDescription =
      getMetaContent(document, "og:description") ?? getMetaContent(document, "description") ?? null;

    const fullJd = buildFullJd(document, metaDescription);
    const { salaryRange } = parseParsedApplicationSalaryFields(extractJobSalary(currentUrl, document, html));

    log.debug("job metadata extracted", {
      host: currentUrl.hostname,
      hasTitle: Boolean(title),
      hasCompany: Boolean(company),
      hasSalary: Boolean(salaryRange),
      hasFullJd: Boolean(fullJd),
    });

    return parseJobUrlResultSchema.parse({
      ok: true,
      title,
      company,
      salaryRange,
      fullJd,
    });
  } catch (error) {
    const host = hostFromUrl(urlString);
    if (error instanceof UnsafeFetchUrlError) {
      log.warn("job url parse blocked", { host, error: error.message });
      return { ok: false, error: error.message };
    }
    if (error instanceof Error && error.name === "AbortError") {
      log.warn("job url parse failed", { host, error: "Request timed out" });
      return { ok: false, error: "Request timed out" };
    }
    const message = errorMessage(error, "Failed to fetch URL");
    log.warn("job url parse failed", { host, error: message });
    return {
      ok: false,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
