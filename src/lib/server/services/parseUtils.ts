export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
        records.push(...data);
      } else {
        records.push(data);
      }
    } catch {
      continue;
    }
  }

  return records;
}
