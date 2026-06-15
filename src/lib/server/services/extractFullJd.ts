import { parseHTML } from "linkedom";

import { collapseWhitespace } from "@/lib/server/services/parseUtils";

const ALLOWED_TAGS = new Set(["p", "ul", "ol", "li", "h2", "h3", "h4", "strong", "em", "br"]);
const REMOVED_TAGS = new Set([
  "script",
  "style",
  "nav",
  "header",
  "footer",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "meta",
  "link",
]);
const BOILERPLATE_PATTERN =
  /\b(equal opportunity|eeo|privacy policy|cookie|apply now|share this job|©|all rights reserved)\b/i;

const DESCRIPTION_SELECTORS = [
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[class*="job_description"]',
  '[id*="job-description"]',
  '[class*="posting-description"]',
  '[class*="description"]',
  "article",
  '[role="main"]',
  "main",
];

function extractSentences(text: string, maxSentences = 3): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && !BOILERPLATE_PATTERN.test(s));
  return sentences.slice(0, maxSentences).join(" ");
}

function stripDisallowedTags(element: Element): void {
  const children = [...element.children];
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (REMOVED_TAGS.has(tag)) {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = child.parentElement;
      if (!parent) continue;
      while (child.firstChild) {
        parent.insertBefore(child.firstChild, child);
      }
      child.remove();
      continue;
    }
    for (const attr of [...child.attributes]) {
      child.removeAttribute(attr.name);
    }
    stripDisallowedTags(child);
  }
}

const TEXT_NODE = 3;

function serializeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return "";

  const text = collapseWhitespace(el.textContent ?? "");
  if (!text && tag !== "br") return "";
  if (BOILERPLATE_PATTERN.test(text) && text.length < 120) return "";

  if (tag === "br") return "<br>";

  const inner = [...el.childNodes]
    .map((child) => {
      if (child.nodeType === TEXT_NODE) {
        return collapseWhitespace(child.textContent ?? "");
      }
      if (child.nodeType === 1) {
        return serializeElement(child as Element);
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");

  return `<${tag}>${inner || text}</${tag}>`;
}

function elementToMinimalHtml(element: Element): string {
  stripDisallowedTags(element);
  const parts: string[] = [];

  for (const child of element.children) {
    const html = serializeElement(child);
    if (html) parts.push(html);
  }

  const seen = new Set<string>();
  return parts
    .filter((part) => {
      const key = part.replace(/<\/?[^>]+>/g, "").toLowerCase();
      if (key.length < 8 || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40)
    .join("\n");
}

function findDescriptionRoot(document: Document): Element | null {
  for (const selector of DESCRIPTION_SELECTORS) {
    const match = document.querySelector(selector);
    if (match && collapseWhitespace(match.textContent ?? "").length > 120) {
      return match;
    }
  }
  return document.body;
}

export function buildFullJd(document: Document, metaDescription: string | null): string | null {
  const root = findDescriptionRoot(document);
  if (!root) return null;

  const plainText = collapseWhitespace(root.textContent ?? "");
  const summarySource = plainText.length > 40 ? plainText : (metaDescription ?? "");
  const summary = extractSentences(summarySource);

  let bodyHtml = elementToMinimalHtml(root);
  if (!bodyHtml && metaDescription) {
    bodyHtml = `<p>${metaDescription.trim()}</p>`;
  }
  if (!bodyHtml && plainText.length > 40) {
    const paragraphs = plainText
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
      .map((p) => collapseWhitespace(p))
      .filter((p) => p.length > 40 && !BOILERPLATE_PATTERN.test(p))
      .slice(0, 12)
      .map((p) => `<p>${p}</p>`);
    bodyHtml = paragraphs.join("\n");
  }

  if (!summary && !bodyHtml) return null;

  const sections: string[] = [];
  if (summary) {
    sections.push(`<p><strong>Summary</strong> ${summary}</p>`);
  }
  if (bodyHtml) {
    sections.push(bodyHtml);
  }

  const html = sections.join("\n").trim();
  return html.length > 0 ? html : null;
}

export function sanitizeStoredHtml(html: string): string | null {
  const { document } = parseHTML(`<div id="sanitize-root">${html}</div>`);
  const root = document.getElementById("sanitize-root");
  if (!root) return null;

  stripDisallowedTags(root);
  const cleaned = root.innerHTML.trim();
  return cleaned.length > 0 ? cleaned : null;
}
