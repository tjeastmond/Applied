export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
