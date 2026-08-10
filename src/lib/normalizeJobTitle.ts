import { collapseWhitespace } from "@/lib/collapseWhitespace";

const Y_COMBINATOR_TITLE_SUFFIX = /\s*\|\s*Y Combinator.*$/i;
const SIMPLIFY_TITLE_SUFFIX = /\s*\|\s*Simplify\s*$/i;
const AT_COMPANY_TITLE_SUFFIX = /\s+at\s+[A-Za-z0-9][\w\s.'&-]*$/i;

export function normalizeJobTitle(title: string | null | undefined): string | null {
  if (title == null) return null;

  const withoutSuffix = title
    .replace(Y_COMBINATOR_TITLE_SUFFIX, "")
    .replace(SIMPLIFY_TITLE_SUFFIX, "")
    .replace(AT_COMPANY_TITLE_SUFFIX, "");
  return collapseWhitespace(withoutSuffix);
}
