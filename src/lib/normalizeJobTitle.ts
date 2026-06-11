const Y_COMBINATOR_TITLE_SUFFIX = /\s*\|\s*Y Combinator.*$/i;

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeJobTitle(title: string | null | undefined): string | null {
  if (title == null) return null;

  const withoutSuffix = title.replace(Y_COMBINATOR_TITLE_SUFFIX, "");
  return collapseWhitespace(withoutSuffix);
}
