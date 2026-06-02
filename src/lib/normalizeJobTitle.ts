const Y_COMBINATOR_TITLE_SUFFIX = " | Y Combinator";

export function normalizeJobTitle(title: string | null | undefined): string | null {
  if (title == null) return null;

  const trimmed = title.trim();
  if (!trimmed.endsWith(Y_COMBINATOR_TITLE_SUFFIX)) {
    return trimmed;
  }

  return trimmed.slice(0, -Y_COMBINATOR_TITLE_SUFFIX.length).trimEnd();
}
