export function formatZodError(error: { issues: Array<{ message: string }> }): string {
  const messages = error.issues.map((issue) => issue.message).filter(Boolean);
  return messages[0] ?? "Invalid request body";
}
