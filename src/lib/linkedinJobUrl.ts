function normalizeHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

export function isLinkedInHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return host === "linkedin.com" || host.endsWith(".linkedin.com");
}

/** Strip tracking params from LinkedIn `/jobs/view/{id}/` URLs; leave other URLs unchanged. */
export function canonicalizeLinkedInJobUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    if (!isLinkedInHost(url.hostname)) return urlString;

    const match = url.pathname.match(/^\/jobs\/view\/(\d+)\/?$/i);
    if (!match?.[1]) return urlString;

    url.search = "";
    url.hash = "";
    url.pathname = `/jobs/view/${match[1]}/`;
    return url.toString();
  } catch {
    return urlString;
  }
}
