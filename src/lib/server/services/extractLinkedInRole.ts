import { normalizeHost } from "@/lib/server/normalizeHost";
import { parseJsonLdScripts } from "@/lib/server/services/parseUtils";

export function isLinkedInHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return host === "linkedin.com" || host.endsWith(".linkedin.com");
}

type LinkedInRole = { title: string; company: string };

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isJobPosting(record: object): boolean {
  const type = (record as { "@type"?: unknown })["@type"];
  if (type === "JobPosting") return true;
  if (Array.isArray(type) && type.includes("JobPosting")) return true;
  return false;
}

export function parseLinkedInTitleLikeText(text: string): LinkedInRole | null {
  const match = text.trim().match(/^(.+?) hiring (.+?) \| .+ \| LinkedIn$/i);
  if (!match?.[1] || !match?.[2]) return null;

  return { company: match[1].trim(), title: match[2].trim() };
}

function extractFromJsonLd(document: Document): LinkedInRole | null {
  for (const record of parseJsonLdScripts(document)) {
    if (!record || typeof record !== "object") continue;
    if (!isJobPosting(record)) continue;

    const title = readString((record as { title?: unknown }).title);
    const hiringOrganization = (record as { hiringOrganization?: unknown }).hiringOrganization;
    const company =
      hiringOrganization && typeof hiringOrganization === "object"
        ? readString((hiringOrganization as { name?: unknown }).name)
        : "";

    if (title && company) {
      return { title, company };
    }
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
