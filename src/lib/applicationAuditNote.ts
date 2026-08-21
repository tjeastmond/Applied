export type ApplicationAuditAction = "created" | "updated";

export type ApplicationAuditChannel = "app" | "cli" | "api";

const CHANNEL_LABELS: Record<ApplicationAuditChannel, string> = {
  app: "APP",
  cli: "CLI",
  api: "API",
};

export function formatApplicationAuditNote(
  action: ApplicationAuditAction,
  actorName: string,
  channel: ApplicationAuditChannel,
): string {
  if (action === "created") {
    return `Saved by ${actorName}: ${CHANNEL_LABELS[channel]}`;
  }
  return `Updated by ${actorName}, via ${CHANNEL_LABELS[channel]}`;
}
