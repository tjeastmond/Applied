import { normalizeHost } from "@/lib/server/normalizeHost";
import { parseJsonLdScripts, readRoleFromJsonLdRecord } from "@/lib/server/services/parseUtils";

export function isLinkedInHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return host === "linkedin.com" || host.endsWith(".linkedin.com");
}

type LinkedInRole = { title: string; company: string };

function isJobPosting(record: object): boolean {
  const type = (record as { "@type"?: unknown })["@type"];
  if (type === "JobPosting") return true;
  if (Array.isArray(type) && type.includes("JobPosting")) return true;
  return false;
}

const LINKEDIN_TITLE_PATTERNS = [
  // Company hiring Title | Location | LinkedIn
  /^(.+?) hiring (.+?) \| .+ \| LinkedIn$/i,
  // Company hiring Title in Location | LinkedIn
  /^(.+?) hiring (.+?) in .+ \| LinkedIn$/i,
] as const;

export function parseLinkedInTitleLikeText(text: string): LinkedInRole | null {
  const trimmed = text.trim();

  for (const pattern of LINKEDIN_TITLE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1] && match?.[2]) {
      return { company: match[1].trim(), title: match[2].trim() };
    }
  }

  return null;
}

function extractFromJsonLd(document: Document): LinkedInRole | null {
  for (const record of parseJsonLdScripts(document)) {
    if (!record || typeof record !== "object") continue;
    if (!isJobPosting(record)) continue;

    const role = readRoleFromJsonLdRecord(record);
    if (role) return role;
  }

  return null;
}

function extractFromOgTitle(document: Document): LinkedInRole | null {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim();
  return ogTitle ? parseLinkedInTitleLikeText(ogTitle) : null;
}

function extractFromMetaTitle(document: Document): LinkedInRole | null {
  const metaTitle = document.querySelector('meta[name="title"]')?.getAttribute("content")?.trim();
  return metaTitle ? parseLinkedInTitleLikeText(metaTitle) : null;
}

function extractFromDocumentTitle(document: Document): LinkedInRole | null {
  const title = document.querySelector("title")?.textContent?.trim();
  return title ? parseLinkedInTitleLikeText(title) : null;
}

export function extractLinkedInRole(document: Document): LinkedInRole | null {
  return (
    extractFromJsonLd(document) ??
    extractFromOgTitle(document) ??
    extractFromMetaTitle(document) ??
    extractFromDocumentTitle(document)
  );
}
