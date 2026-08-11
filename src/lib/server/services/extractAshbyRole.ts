import { normalizeHost } from "@/lib/server/normalizeHost";
import { parseJsonLdScripts } from "@/lib/server/services/parseUtils";

const ASHBY_HOST = "jobs.ashbyhq.com";
const ASHBY_JOB_PATH = /^\/([^/]+)\/([0-9a-f-]{36})(?:\/|$)/i;
const GENERIC_ASHBY_TITLES = new Set(["jobs", "job board", "careers", "open roles", "open positions"]);

export type AshbyRole = {
  title: string;
  company: string | null;
  descriptionHtml: string | null;
};

export type AshbyJobPath = {
  boardName: string;
  jobPostingId: string;
};

export function isAshbyHost(hostname: string): boolean {
  return normalizeHost(hostname) === ASHBY_HOST;
}

export function parseAshbyJobUrl(url: URL): AshbyJobPath | null {
  if (!isAshbyHost(url.hostname)) return null;

  const match = url.pathname.match(ASHBY_JOB_PATH);
  if (!match?.[1] || !match?.[2]) return null;

  return {
    boardName: match[1],
    jobPostingId: match[2],
  };
}

export function isGenericAshbyTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  return GENERIC_ASHBY_TITLES.has(title.trim().toLowerCase());
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTitleAtCompany(text: string): Pick<AshbyRole, "title" | "company"> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const atSymbolMatch = trimmed.match(/^(.+?)\s+@\s+(.+)$/);
  if (atSymbolMatch?.[1] && atSymbolMatch?.[2]) {
    return { title: atSymbolMatch[1].trim(), company: atSymbolMatch[2].trim() };
  }

  return null;
}

function extractFromAppData(html: string): AshbyRole | null {
  const match = html.match(/window\.__appData\s*=\s*(\{.*?\});/s);
  if (!match?.[1]) return null;

  try {
    const data: unknown = JSON.parse(match[1]);
    if (!data || typeof data !== "object") return null;

    const posting = (data as { posting?: unknown }).posting;
    if (!posting || typeof posting !== "object") return null;

    const title = readString((posting as { title?: unknown }).title);
    if (!title || isGenericAshbyTitle(title)) return null;

    const organization = (data as { organization?: unknown }).organization;
    const company =
      organization && typeof organization === "object"
        ? readString((organization as { name?: unknown }).name) || null
        : null;

    const descriptionHtml = readString((posting as { descriptionHtml?: unknown }).descriptionHtml) || null;

    return { title, company, descriptionHtml };
  } catch {
    return null;
  }
}

function extractFromJsonLd(document: Document): AshbyRole | null {
  for (const record of parseJsonLdScripts(document)) {
    if (!record || typeof record !== "object") continue;

    const type = (record as { "@type"?: unknown })["@type"];
    const isJobPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
    if (!isJobPosting) continue;

    const title = readString((record as { title?: unknown }).title);
    if (!title || isGenericAshbyTitle(title)) continue;

    const hiringOrganization = (record as { hiringOrganization?: unknown }).hiringOrganization;
    const company =
      hiringOrganization && typeof hiringOrganization === "object"
        ? readString((hiringOrganization as { name?: unknown }).name) || null
        : null;

    const description = readString((record as { description?: unknown }).description) || null;

    return { title, company, descriptionHtml: description };
  }

  return null;
}

function getMetaContent(document: Document, selector: string): string | null {
  return document.querySelector(selector)?.getAttribute("content")?.trim() ?? null;
}

function extractFromMeta(document: Document): AshbyRole | null {
  const metaTitle = getMetaContent(document, 'meta[name="title"]');
  const fromMetaTitle = metaTitle ? parseTitleAtCompany(metaTitle) : null;
  if (fromMetaTitle && !isGenericAshbyTitle(fromMetaTitle.title)) {
    return { ...fromMetaTitle, descriptionHtml: null };
  }

  const ogTitle = getMetaContent(document, 'meta[property="og:title"]');
  if (ogTitle && !isGenericAshbyTitle(ogTitle)) {
    return { title: ogTitle, company: null, descriptionHtml: null };
  }

  const pageTitle = document.querySelector("title")?.textContent?.trim() ?? null;
  const fromPageTitle = pageTitle ? parseTitleAtCompany(pageTitle) : null;
  if (fromPageTitle && !isGenericAshbyTitle(fromPageTitle.title)) {
    return { ...fromPageTitle, descriptionHtml: null };
  }

  return null;
}

export function extractAshbyRole(document: Document, html: string): AshbyRole | null {
  return extractFromAppData(html) ?? extractFromJsonLd(document) ?? extractFromMeta(document);
}
