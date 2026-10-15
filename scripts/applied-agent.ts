#!/usr/bin/env node
/**
 * Agent CLI — HTTP client for /api/agent/*.
 *
 * Source lives here; runtime uses the compiled bundle at bin/applied-agent.js.
 *
 * Build and run:
 *   pnpm build:cli              Compile standalone ESM bin (no tsx at runtime)
 *   pnpm applied:agent --help   pnpm script (auto-builds when source is stale)
 *   pnpm link                   From repo root — installs global `applied-agent` via pnpm bin
 *
 * Requires AGENT_API_TOKEN and a running applied.dev server.
 */

import learningPrompt from "virtual:learning-prompt";
import {
  addApplicationNote,
  createApplication,
  createCompany,
  fetchAgentDocs,
  getApplication,
  listApplications,
  listCompanies,
  setApplicationStatus,
  setCompanyIgnored,
  updateCompany,
  AgentCliRequestError,
} from "@/lib/agentCli/client";
import { AgentCliConfigError, normalizeAgentStatus, resolveAgentCliConfig } from "@/lib/agentCli/config";
import {
  printApplication,
  printApplications,
  printCompanies,
  printCompany,
  printJson,
  printMarkdown,
  printNote,
} from "@/lib/agentCli/output";

type GlobalOptions = {
  json: boolean;
  token?: string;
  baseUrl?: string;
  help: boolean;
};

type ParsedCommand =
  | { kind: "help" }
  | { kind: "docs"; options: GlobalOptions }
  | { kind: "learn"; options: GlobalOptions }
  | { kind: "applications-list"; search?: string; status?: string; options: GlobalOptions }
  | { kind: "applications-add"; url: string; status?: string; options: GlobalOptions }
  | { kind: "applications-get"; id: string; options: GlobalOptions }
  | { kind: "applications-set-status"; id: string; status: string; options: GlobalOptions }
  | { kind: "applications-add-note"; id: string; content: string; options: GlobalOptions }
  | { kind: "companies-list"; search?: string; ignored?: boolean; options: GlobalOptions }
  | { kind: "companies-add"; name: string; url?: string; linkedinUrl?: string; email?: string; options: GlobalOptions }
  | {
      kind: "companies-update";
      id: string;
      name?: string;
      url?: string;
      linkedinUrl?: string;
      email?: string;
      options: GlobalOptions;
    }
  | { kind: "companies-ignore"; id: string; options: GlobalOptions }
  | { kind: "companies-unignore"; id: string; options: GlobalOptions };

function printHelp(): void {
  process.stdout.write(`Usage:
  applied applications list [--search QUERY] [--status STATUS] [--json]
  applied applications add --url URL [--status STATUS] [--json]
  applied applications get --id ID [--json]
  applied applications set-status --id ID --status STATUS [--json]
  applied applications add-note --id ID --content "..." [--json]
  applied companies list [--search QUERY] [--ignored] [--json]
  applied companies add --name "Acme" [--url URL] [--linkedin URL] [--email EMAIL] [--json]
  applied companies update --id ID [--name NAME] [--url URL] [--linkedin URL] [--email EMAIL] [--json]
  applied companies ignore --id ID [--json]
  applied companies unignore --id ID [--json]
  applied posts add --url URL [--status STATUS] [--json]
  applied docs [--json]            Fetch the server's API reference (needs token + running server)
  applied learn [--json]           Print the agent learning prompt (offline, no token needed)

Aliases:
  apps …              Shorthand for applications (e.g. applied apps list)
  applied-agent …     Same commands (global npm bin)
  pnpm applied:agent …   From repo checkout (auto-builds when stale)

Environment (precedence: CLI flags, then shell exports such as ~/.zshrc, then .env files, then defaults):
  APPLIED_DEV_URL   Base URL (default http://localhost:3030; use your Vercel URL for production)
  APPLIED_DEV_DIR   Optional checkout path — load missing keys from that checkout's .env.local
  AGENT_API_TOKEN   Required bearer token for every request

Options:
  --token TOKEN     Override AGENT_API_TOKEN for this invocation
  --base-url URL    Override APPLIED_DEV_URL for this invocation
  --json            Print JSON responses
  -h, --help        Show this help

Build / install:
  pnpm build:cli        Compile bin/applied-agent.js (also runs automatically via pnpm applied:agent when stale)
  pnpm setup && pnpm add -g .   Install global applied-agent (from repo root)

Codex / agent workflow:
  The CLI is an HTTP client — run it from any directory against local or deployed hosts.
  Set APPLIED_DEV_URL for Vercel; set AGENT_API_TOKEN (or --token). Do not run pnpm run check or pnpm dev for agent tasks.

Status aliases on create/set-status:
  apply, to-apply, to_apply -> to_apply
`);
}

function readFlagValue(args: string[], index: number, flag: string): { value: string; nextIndex: number } | null {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    process.stderr.write(`Missing value for ${flag}\n`);
    process.exit(1);
  }
  return { value, nextIndex: index + 1 };
}

function parseGlobalOptions(args: string[]): { options: GlobalOptions; rest: string[] } {
  const options: GlobalOptions = { json: false, help: false };
  const rest: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--token") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      options.token = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--base-url") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      options.baseUrl = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    rest.push(arg);
  }

  return { options, rest };
}

function normalizeResource(resource: string): string {
  if (resource === "apps") {
    return "applications";
  }
  return resource;
}

function parseCommand(argv: string[]): ParsedCommand {
  const { options, rest } = parseGlobalOptions(argv);

  if (options.help || rest.length === 0) {
    return { kind: "help" };
  }

  const [resource, action, ...tail] = rest;
  const normalizedResource = normalizeResource(resource ?? "");

  if (normalizedResource === "docs") {
    return { kind: "docs", options };
  }

  if (normalizedResource === "learn") {
    return { kind: "learn", options };
  }

  if (normalizedResource === "posts" && action === "add") {
    return parseApplicationsAdd(tail, options);
  }

  if (normalizedResource === "applications") {
    if (action === "list") {
      return parseApplicationsList(tail, options);
    }
    if (action === "add") {
      return parseApplicationsAdd(tail, options);
    }
    if (action === "get") {
      return parseApplicationsGet(tail, options);
    }
    if (action === "set-status") {
      return parseApplicationsSetStatus(tail, options);
    }
    if (action === "add-note") {
      return parseApplicationsAddNote(tail, options);
    }
  }

  if (normalizedResource === "companies") {
    if (action === "list") {
      return parseCompaniesList(tail, options);
    }
    if (action === "add") {
      return parseCompaniesAdd(tail, options);
    }
    if (action === "update") {
      return parseCompaniesUpdate(tail, options);
    }
    if (action === "ignore") {
      return parseCompaniesIgnore(tail, options, true);
    }
    if (action === "unignore") {
      return parseCompaniesIgnore(tail, options, false);
    }
  }

  process.stderr.write(`Unknown command: ${rest.join(" ")}\n`);
  printHelp();
  process.exit(1);
}

function parseApplicationsList(args: string[], options: GlobalOptions): ParsedCommand {
  let search: string | undefined;
  let status: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--search") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      search = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--status") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      status = normalizeAgentStatus(parsed.value);
      index = parsed.nextIndex;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }
  return { kind: "applications-list", search, status, options };
}

function parseApplicationsAdd(args: string[], options: GlobalOptions): ParsedCommand {
  let url: string | undefined;
  let status: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--url") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      url = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--status") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      status = normalizeAgentStatus(parsed.value);
      index = parsed.nextIndex;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }

  if (!url) {
    process.stderr.write("applications add requires --url\n");
    process.exit(1);
  }

  return { kind: "applications-add", url, status, options };
}

function parseApplicationsGet(args: string[], options: GlobalOptions): ParsedCommand {
  let id: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--id") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      id = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }

  if (!id) {
    process.stderr.write("applications get requires --id\n");
    process.exit(1);
  }

  return { kind: "applications-get", id, options };
}

function parseApplicationsSetStatus(args: string[], options: GlobalOptions): ParsedCommand {
  let id: string | undefined;
  let status: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--id") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      id = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--status") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      status = normalizeAgentStatus(parsed.value);
      index = parsed.nextIndex;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }

  if (!id || !status) {
    process.stderr.write("applications set-status requires --id and --status\n");
    process.exit(1);
  }

  return { kind: "applications-set-status", id, status, options };
}

function parseApplicationsAddNote(args: string[], options: GlobalOptions): ParsedCommand {
  let id: string | undefined;
  let content: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--id") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      id = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--content") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      content = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }

  if (!id || !content) {
    process.stderr.write("applications add-note requires --id and --content\n");
    process.exit(1);
  }

  return { kind: "applications-add-note", id, content, options };
}

function parseCompaniesList(args: string[], options: GlobalOptions): ParsedCommand {
  let search: string | undefined;
  let ignored = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--search") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      search = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--ignored") {
      ignored = true;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }
  return { kind: "companies-list", search, ignored, options };
}

function parseCompaniesAdd(args: string[], options: GlobalOptions): ParsedCommand {
  let name: string | undefined;
  let url: string | undefined;
  let linkedinUrl: string | undefined;
  let email: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--name") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      name = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--url") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      url = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--linkedin") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      linkedinUrl = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--email") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      email = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }

  if (!name) {
    process.stderr.write("companies add requires --name\n");
    process.exit(1);
  }

  return { kind: "companies-add", name, url, linkedinUrl, email, options };
}

function parseCompaniesUpdate(args: string[], options: GlobalOptions): ParsedCommand {
  let id: string | undefined;
  let name: string | undefined;
  let url: string | undefined;
  let linkedinUrl: string | undefined;
  let email: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--id") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      id = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--name") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      name = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--url") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      url = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--linkedin") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      linkedinUrl = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (arg === "--email") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      email = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }

  if (!id) {
    process.stderr.write("companies update requires --id\n");
    process.exit(1);
  }
  if (!name && !url && !linkedinUrl && !email) {
    process.stderr.write("companies update requires at least one of --name, --url, --linkedin, or --email\n");
    process.exit(1);
  }

  return { kind: "companies-update", id, name, url, linkedinUrl, email, options };
}

function parseCompaniesIgnore(args: string[], options: GlobalOptions, ignored: boolean): ParsedCommand {
  let id: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--id") {
      const parsed = readFlagValue(args, index, arg);
      if (!parsed) process.exit(1);
      id = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    process.stderr.write(`Unknown option: ${arg}\n`);
    process.exit(1);
  }

  if (!id) {
    process.stderr.write(`companies ${ignored ? "ignore" : "unignore"} requires --id\n`);
    process.exit(1);
  }

  return ignored ? { kind: "companies-ignore", id, options } : { kind: "companies-unignore", id, options };
}

async function runCommand(command: ParsedCommand): Promise<void> {
  if (command.kind === "help") {
    printHelp();
    return;
  }

  if (command.kind === "learn") {
    if (command.options.json) {
      printJson({ markdown: learningPrompt });
    } else {
      printMarkdown(learningPrompt);
    }
    return;
  }

  const config = resolveAgentCliConfig({
    tokenOverride: command.options.token,
    baseUrlOverride: command.options.baseUrl,
  });

  switch (command.kind) {
    case "docs": {
      const markdown = await fetchAgentDocs(config);
      if (command.options.json) {
        printJson({ markdown });
      } else {
        printMarkdown(markdown);
      }
      return;
    }
    case "applications-list": {
      const result = await listApplications(config, {
        search: command.search,
        status: command.status,
      });
      if (command.options.json) {
        printJson(result);
      } else {
        printApplications(result.applications);
      }
      return;
    }
    case "applications-add": {
      const application = await createApplication(config, command.url, command.status);
      if (command.options.json) {
        printJson(application);
      } else {
        printApplication(application);
      }
      return;
    }
    case "applications-get": {
      const application = await getApplication(config, command.id);
      if (command.options.json) {
        printJson(application);
      } else {
        printApplication(application);
      }
      return;
    }
    case "applications-set-status": {
      const application = await setApplicationStatus(config, command.id, command.status);
      if (command.options.json) {
        printJson(application);
      } else {
        printApplication(application);
      }
      return;
    }
    case "applications-add-note": {
      const note = await addApplicationNote(config, command.id, command.content);
      if (command.options.json) {
        printJson(note);
      } else {
        printNote(note);
      }
      return;
    }
    case "companies-list": {
      const result = await listCompanies(config, {
        search: command.search,
        ignored: command.ignored,
      });
      if (command.options.json) {
        printJson(result);
      } else {
        printCompanies(result.companies);
      }
      return;
    }
    case "companies-add": {
      const company = await createCompany(config, {
        name: command.name,
        ...(command.url ? { url: command.url } : {}),
        ...(command.linkedinUrl ? { linkedinUrl: command.linkedinUrl } : {}),
        ...(command.email ? { email: command.email } : {}),
      });
      if (command.options.json) {
        printJson(company);
      } else {
        printCompany(company);
      }
      return;
    }
    case "companies-update": {
      const company = await updateCompany(config, command.id, {
        ...(command.name ? { name: command.name } : {}),
        ...(command.url ? { url: command.url } : {}),
        ...(command.linkedinUrl ? { linkedinUrl: command.linkedinUrl } : {}),
        ...(command.email ? { email: command.email } : {}),
      });
      if (command.options.json) {
        printJson(company);
      } else {
        printCompany(company);
      }
      return;
    }
    case "companies-ignore": {
      const company = await setCompanyIgnored(config, command.id, true);
      if (command.options.json) {
        printJson(company);
      } else {
        printCompany(company);
      }
      return;
    }
    case "companies-unignore": {
      const company = await setCompanyIgnored(config, command.id, false);
      if (command.options.json) {
        printJson(company);
      } else {
        printCompany(company);
      }
      return;
    }
    default: {
      const neverCommand: never = command;
      throw new Error(`Unhandled command: ${String(neverCommand)}`);
    }
  }
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv.slice(2));
  if (command.kind === "help") {
    printHelp();
    process.exit(0);
  }

  try {
    await runCommand(command);
  } catch (error) {
    if (error instanceof AgentCliConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.exitCode);
    }
    if (error instanceof AgentCliRequestError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(error.exitCode);
    }
    const message = error instanceof Error ? error.message : "Command failed";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

void main();
