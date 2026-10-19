export { collapseWhitespace } from "@/lib/collapseWhitespace";

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseJsonLdScripts(document: Document): unknown[] {
  const records: unknown[] = [];
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (!text) continue;

    try {
      const data: unknown = JSON.parse(text);
      if (Array.isArray(data)) {
        for (const item of data) {
          records.push(item);
        }
      } else if (data && typeof data === "object" && Array.isArray((data as { "@graph"?: unknown })["@graph"])) {
        for (const item of (data as { "@graph": unknown[] })["@graph"]) {
          records.push(item);
        }
      } else {
        records.push(data);
      }
    } catch {
      continue;
    }
  }

  return records;
}

export function readRoleFromJsonLdRecord(record: object): { title: string; company: string } | null {
  const { title, hiringOrganization } = record as { title?: unknown; hiringOrganization?: unknown };
  const name =
    hiringOrganization && typeof hiringOrganization === "object"
      ? (hiringOrganization as { name?: unknown }).name
      : undefined;
  const roleTitle = typeof title === "string" ? title.trim() : "";
  const company = typeof name === "string" ? name.trim() : "";
  return roleTitle && company ? { title: roleTitle, company } : null;
}
