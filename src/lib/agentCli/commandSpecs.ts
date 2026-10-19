/** Single source for CLI usage lines; help, discovery, and drift tests all read this list. */
export const AGENT_CLI_COMMAND_SPECS = [
  { usage: "applications list [--search QUERY] [--status STATUS] [--json]" },
  { usage: "applications add --url URL [--status STATUS] [--json]" },
  { usage: "applications get --id ID [--json]" },
  { usage: "applications set-status --id ID --status STATUS [--json]" },
  {
    usage: "applications archive-stale [--dry-run] [--json]",
    note: "Mark applications with no update in 2 months as no_response and archive them",
  },
  { usage: 'applications add-note --id ID --content "..." [--json]' },
  { usage: "companies list [--search QUERY] [--ignored] [--json]" },
  { usage: "companies add --name NAME [--url URL] [--linkedin URL] [--email EMAIL] [--json]" },
  { usage: "companies update --id ID [--name NAME] [--url URL] [--linkedin URL] [--email EMAIL] [--json]" },
  { usage: "companies ignore --id ID [--json]" },
  { usage: "companies unignore --id ID [--json]" },
  { usage: "posts add --url URL [--status STATUS] [--json]" },
  { usage: "docs [--json]", note: "Fetch the server's API reference (needs token + running server)" },
  { usage: "learn [--json]", note: "Print the agent learning prompt (offline, no token needed)" },
] as const satisfies readonly { usage: string; note?: string }[];
