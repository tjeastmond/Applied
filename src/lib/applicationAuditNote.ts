export type ApplicationAuditAction = "created" | "updated";

export type ApplicationAuditChannel = "app" | "cli" | "api";

const CHANNEL_LABELS: Record<ApplicationAuditChannel, string> = {
  app: "app",
  cli: "CLI",
  api: "API",
};

export function formatApplicationAuditNote(
  action: ApplicationAuditAction,
  actorName: string,
  channel: ApplicationAuditChannel,
): string {
  const verb = action === "created" ? "Created" : "Updated";
  return `${verb} by ${actorName}, via ${CHANNEL_LABELS[channel]}`;
}
