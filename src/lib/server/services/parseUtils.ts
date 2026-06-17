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
      } else {
        records.push(data);
      }
    } catch {
      continue;
    }
  }

  return records;
}
