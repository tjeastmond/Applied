import { normalizeHost } from "@/lib/server/normalizeHost";

export function isParaformHost(hostname: string): boolean {
  return normalizeHost(hostname) === "paraform.com";
}

type ParaformRole = { title: string; company: string };

type NextPageProps = {
  initialRoleData?: { name?: unknown; company?: { name?: unknown } };
  baseRole?: { name?: unknown };
  baseCompany?: { name?: unknown };
  page_title?: unknown;
  company_name?: unknown;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTitleAtCompany(text: string): ParaformRole | null {
  const match = text.trim().match(/^(.+?) at (.+)$/i);
  if (!match?.[1] || !match?.[2]) return null;

  return { title: match[1].trim(), company: match[2].trim() };
}

function readNextPageProps(document: Document): NextPageProps | null {
  const script = document.querySelector("script#__NEXT_DATA__");
  const text = script?.textContent?.trim();
  if (!text) return null;

  try {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== "object") return null;
    return (data as { props?: { pageProps?: NextPageProps } }).props?.pageProps ?? null;
  } catch {
    return null;
  }
}

function extractFromNextData(document: Document): ParaformRole | null {
  const pageProps = readNextPageProps(document);
  if (!pageProps) return null;

  const shareTitle = readString(pageProps.initialRoleData?.name);
  const shareCompany = readString(pageProps.initialRoleData?.company?.name);
  if (shareTitle && shareCompany) {
    return { title: shareTitle, company: shareCompany };
  }

  const baseRoleTitle = readString(pageProps.baseRole?.name);
  const baseCompanyName = readString(pageProps.baseCompany?.name);
  if (baseRoleTitle && baseCompanyName) {
    return { title: baseRoleTitle, company: baseCompanyName };
  }

  const pageTitle = readString(pageProps.page_title);
  const parsedPageTitle = pageTitle ? parseTitleAtCompany(pageTitle) : null;
  if (parsedPageTitle) return parsedPageTitle;

  const companyName = readString(pageProps.company_name);
  if (baseRoleTitle && companyName) {
    return { title: baseRoleTitle, company: companyName };
  }

  return null;
}

function extractFromDocumentTitle(document: Document): ParaformRole | null {
  const title = document.querySelector("title")?.textContent?.trim();
  return title ? parseTitleAtCompany(title) : null;
}

function extractFromJsonLd(document: Document): ParaformRole | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (!text) continue;

    try {
      const data: unknown = JSON.parse(text);
      const records = Array.isArray(data) ? data : [data];

      for (const record of records) {
        if (!record || typeof record !== "object") continue;
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
    } catch {
      continue;
    }
  }

  return null;
}

function extractFromOgTitle(document: Document): ParaformRole | null {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim();
  return ogTitle ? parseTitleAtCompany(ogTitle) : null;
}

function extractFromRoleHeader(document: Document): ParaformRole | null {
  const titleElement = document.querySelector(".text-2xl.font-book");
  const title = titleElement?.textContent?.trim();
  if (!titleElement || !title) return null;

  const companyElement = titleElement.previousElementSibling;
  const company = companyElement?.textContent?.trim();
  if (!company) return null;

  return { title, company };
}

export function extractParaformRole(document: Document): ParaformRole | null {
  return (
    extractFromNextData(document) ??
    extractFromDocumentTitle(document) ??
    extractFromJsonLd(document) ??
    extractFromOgTitle(document) ??
    extractFromRoleHeader(document)
  );
}
