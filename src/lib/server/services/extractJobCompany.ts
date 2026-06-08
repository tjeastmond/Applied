import { normalizeHost } from "@/lib/server/normalizeHost";
import { extractParaformRole, isParaformHost } from "./extractParaformRole";

const JOB_BOARD_HOSTS = new Set(["ycombinator.com", "jobs.ashbyhq.com", "paraform.com"]);

const JOB_BOARD_SITE_NAMES = new Set(
  ["y combinator", "ashby", "ashbyhq", "paraform"].map((name) => name.toLowerCase()),
);

const YC_COMPANY_PATH = /^\/companies\/([^/]+)(?:\/|$)/i;
const ASHBY_BOARD_PATH = /^\/([^/]+)(?:\/|$)/;
const PARAFORM_COMPANY_PATH = /^\/(?:share|company)\/([^/]+)(?:\/|$)/i;

export function isJobBoardHost(hostname: string): boolean {
  return JOB_BOARD_HOSTS.has(normalizeHost(hostname));
}

function isJobBoardSiteName(siteName: string | null): boolean {
  if (!siteName) return false;
  return JOB_BOARD_SITE_NAMES.has(siteName.trim().toLowerCase());
}

function slugToDisplayName(slug: string): string {
  const decoded = decodeURIComponent(slug).trim();
  if (!decoded) return "";

  return decoded
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function companyFromUrl(url: URL): string | null {
  const host = normalizeHost(url.hostname);

  if (host === "ycombinator.com") {
    const match = url.pathname.match(YC_COMPANY_PATH);
    if (match?.[1]) return slugToDisplayName(match[1]);
  }

  if (host === "jobs.ashbyhq.com") {
    const match = url.pathname.match(ASHBY_BOARD_PATH);
    const slug = match?.[1];
    if (slug && !/^[0-9a-f-]{36}$/i.test(slug)) {
      return slugToDisplayName(slug);
    }
  }

  if (host === "paraform.com") {
    const match = url.pathname.match(PARAFORM_COMPANY_PATH);
    if (match?.[1]) return slugToDisplayName(match[1]);
  }

  return null;
}

function companyFromTitleLikeText(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const atMatch = trimmed.match(/\s+at\s+(.+?)(?:\s*\|\s*|$)/i);
  if (atMatch?.[1]) {
    return atMatch[1].trim();
  }

  const atSuffixMatch = trimmed.match(/\s+at\s+(.+)$/i);
  if (atSuffixMatch?.[1]) {
    return atSuffixMatch[1].trim();
  }

  const atSymbolMatch = trimmed.match(/\s+@\s+(.+?)$/);
  if (atSymbolMatch?.[1]) {
    return atSymbolMatch[1].trim();
  }

  const jobsSuffixMatch = trimmed.match(/^(.+?)\s+jobs$/i);
  if (jobsSuffixMatch?.[1]) {
    return jobsSuffixMatch[1].trim();
  }

  return null;
}

function readJsonLdOrganization(scriptText: string): string | null {
  try {
    const data: unknown = JSON.parse(scriptText);
    const records = Array.isArray(data) ? data : [data];

    for (const record of records) {
      if (!record || typeof record !== "object") continue;
      const hiringOrganization = (record as { hiringOrganization?: unknown }).hiringOrganization;
      if (!hiringOrganization || typeof hiringOrganization !== "object") continue;

      const name = (hiringOrganization as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) {
        return name.trim();
      }
    }
  } catch {
    return null;
  }

  return null;
}

function companyFromJsonLd(document: Document): string | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (!text) continue;
    const company = readJsonLdOrganization(text);
    if (company) return company;
  }
  return null;
}

function getMetaContent(document: Document, selector: string, attribute: string): string | null {
  const element = document.querySelector(selector);
  return element?.getAttribute(attribute)?.trim() ?? null;
}

function companyFromDocumentMeta(document: Document): string | null {
  const metaTitle = getMetaContent(document, 'meta[name="title"]', "content");
  const fromMetaTitle = companyFromTitleLikeText(metaTitle);
  if (fromMetaTitle) return fromMetaTitle;

  const ogTitle = getMetaContent(document, 'meta[property="og:title"]', "content");
  const fromOgTitle = companyFromTitleLikeText(ogTitle);
  if (fromOgTitle) return fromOgTitle;

  const pageTitle = document.querySelector("title")?.textContent?.trim() ?? null;
  return companyFromTitleLikeText(pageTitle);
}

export function extractJobCompany(
  url: URL,
  document: Document,
  genericCandidates: {
    siteName: string | null;
    applicationName: string | null;
    hostnameFallback: string | null;
  },
): string | null {
  const onJobBoard = isJobBoardHost(url.hostname);
  const paraformRole = isParaformHost(url.hostname) ? extractParaformRole(document) : null;

  const prioritized = [
    paraformRole?.company ?? null,
    companyFromJsonLd(document),
    companyFromDocumentMeta(document),
    onJobBoard ? null : genericCandidates.siteName,
    onJobBoard ? null : genericCandidates.applicationName,
    companyFromUrl(url),
    onJobBoard ? null : genericCandidates.hostnameFallback,
  ];

  for (const candidate of prioritized) {
    if (!candidate) continue;
    if (isJobBoardSiteName(candidate)) continue;
    return candidate;
  }

  return null;
}
