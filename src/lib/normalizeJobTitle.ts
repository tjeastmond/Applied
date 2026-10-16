import { collapseWhitespace } from "@/lib/collapseWhitespace";

const Y_COMBINATOR_TITLE_SUFFIX = /\s*\|\s*Y Combinator.*$/i;
const SIMPLIFY_TITLE_SUFFIX = /\s*\|\s*Simplify\s*$/i;
const AT_COMPANY_TITLE_SUFFIX = /\s+at\s+[A-Za-z0-9][\w\s.,'&-]*$/i;
const JOB_APPLICATION_TITLE_PREFIX = /^job application for\s+/i;
const TITLE_COMPANY_SEPARATORS = "[-\\u2013\\u2014|:]";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strips `Company - ` / `Company | ` prefixes and ` - Company` suffixes when they match the company exactly. */
function stripCompanyAffix(title: string, company: string): string {
  const name = escapeRegExp(company.trim());
  if (!name) return title;

  const withoutPrefix = title.replace(new RegExp(`^${name}\\s*${TITLE_COMPANY_SEPARATORS}\\s+`, "i"), "");
  const withoutSuffix = withoutPrefix.replace(new RegExp(`\\s+${TITLE_COMPANY_SEPARATORS}\\s*${name}\\s*$`, "i"), "");
  return withoutSuffix.trim() === "" ? title : withoutSuffix;
}

export function normalizeJobTitle(title: string | null | undefined, company?: string | null): string | null {
  if (title == null) return null;

  const withoutSuffix = title
    .replace(JOB_APPLICATION_TITLE_PREFIX, "")
    .replace(Y_COMBINATOR_TITLE_SUFFIX, "")
    .replace(SIMPLIFY_TITLE_SUFFIX, "")
    .replace(AT_COMPANY_TITLE_SUFFIX, "");
  const collapsed = collapseWhitespace(withoutSuffix);
  return company ? collapseWhitespace(stripCompanyAffix(collapsed, company)) : collapsed;
}
