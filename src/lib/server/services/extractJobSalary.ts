import { collapseWhitespace, parseJsonLdScripts } from "@/lib/server/services/parseUtils";
import type { ParsedApplicationSalaryFields } from "@/types";

type QuantitativeValue = {
  minValue?: number;
  maxValue?: number;
  value?: number;
  unitText?: string;
};

type MonetaryAmount = {
  currency?: string;
  value?: QuantitativeValue | number;
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatUsdAmount(amount: number): string {
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMonetaryRange(amount: MonetaryAmount): string | null {
  const rawValue = amount.value;
  if (rawValue == null) return null;

  const quantitative: QuantitativeValue = typeof rawValue === "number" ? { value: rawValue } : rawValue;

  const min = quantitative.minValue ?? quantitative.value;
  const max = quantitative.maxValue ?? quantitative.value;
  if (min == null && max == null) return null;

  const currency = amount.currency?.toUpperCase() ?? "USD";
  const unit = quantitative.unitText?.toUpperCase() ?? "YEAR";

  const formatValue = (value: number): string => {
    if (currency === "USD") return formatUsdAmount(value);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  let range: string | null = null;
  if (min != null && max != null && min !== max) {
    range = `${formatValue(min)}–${formatValue(max)}`;
  } else {
    const single = min ?? max;
    if (single == null) return null;
    range = formatValue(single);
  }

  if (unit === "MONTH") {
    return `${range} / monthly`;
  }

  return range;
}

function salaryFromJsonLd(document: Document): string | null {
  for (const record of parseJsonLdScripts(document)) {
    if (!record || typeof record !== "object") continue;
    const baseSalary = (record as { baseSalary?: unknown }).baseSalary;
    if (!baseSalary || typeof baseSalary !== "object") continue;

    const formatted = formatMonetaryRange(baseSalary);
    if (formatted) return formatted;
  }

  return null;
}

function salaryRangeFromEmbeddedJson(html: string, jobId: string | null): string | null {
  const decoded = decodeHtmlEntities(html);

  if (jobId) {
    const scopedPattern = new RegExp(`"id"\\s*:\\s*"?${jobId}"?[^}]*"salaryRange"\\s*:\\s*"([^"]+)"`, "i");
    const scopedMatch = decoded.match(scopedPattern);
    if (scopedMatch?.[1]) {
      return collapseWhitespace(scopedMatch[1]);
    }
  }

  const genericMatch = decoded.match(/"salaryRange"\s*:\s*"([^"]+)"/i);
  return genericMatch?.[1] ? collapseWhitespace(genericMatch[1]) : null;
}

function jobIdFromUrl(url: URL): string | null {
  const workAtAStartupMatch = url.pathname.match(/\/jobs\/(\d+)\/?$/i);
  if (workAtAStartupMatch?.[1]) return workAtAStartupMatch[1];

  const ycMatch = url.pathname.match(/\/jobs\/([^/]+)\/?$/i);
  return ycMatch?.[1] ?? null;
}

const LABELED_SALARY_PATTERN =
  /\b(?:salary(?:\s+range)?|compensation(?:\s+range)?|pay\s+range)\b\s*[:\-–—]\s*([^\n|<]{3,80})/i;

function salaryFromLabeledText(document: Document): string | null {
  const text = collapseWhitespace(document.body?.textContent ?? "");
  const match = text.match(LABELED_SALARY_PATTERN);
  return match?.[1] ? collapseWhitespace(match[1]) : null;
}

export function extractJobSalary(url: URL, document: Document, html: string): ParsedApplicationSalaryFields {
  const prioritized = [
    salaryFromJsonLd(document),
    salaryRangeFromEmbeddedJson(html, jobIdFromUrl(url)),
    salaryFromLabeledText(document),
  ];

  for (const candidate of prioritized) {
    if (candidate) {
      return { salaryRange: candidate };
    }
  }

  return { salaryRange: null };
}
