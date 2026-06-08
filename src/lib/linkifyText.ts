import { isProbablyHttpUrl } from "@/lib/applicationForm";

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

export type LinkifySegment = { type: "text"; value: string } | { type: "link"; href: string; label: string };

function normalizeDetectedUrl(raw: string): { href: string | null; trailing: string } {
  const trimmed = raw.replace(/[.,;:!?)}\]'»]+$/, "");
  if (isProbablyHttpUrl(trimmed)) {
    return { href: trimmed, trailing: raw.slice(trimmed.length) };
  }
  return { href: null, trailing: "" };
}

export function splitTextWithUrls(text: string): LinkifySegment[] {
  const segments: LinkifySegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const raw = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    const { href, trailing } = normalizeDetectedUrl(raw);
    if (href) {
      segments.push({ type: "link", href, label: href });
      if (trailing) {
        segments.push({ type: "text", value: trailing });
      }
    } else {
      segments.push({ type: "text", value: raw });
    }

    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}
