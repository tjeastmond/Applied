import type { AgentApplicationSummary, AgentCompanySummary, AgentNoteSummary } from "@/lib/schemas/agent";

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printApplications(applications: AgentApplicationSummary[]): void {
  if (applications.length === 0) {
    process.stdout.write("No applications found.\n");
    return;
  }

  for (const application of applications) {
    process.stdout.write(
      `${application.id}  ${application.status.padEnd(14)}  ${application.company ?? "?"}  ${application.title ?? "?"}\n`,
    );
  }
}

export function printApplication(application: AgentApplicationSummary): void {
  process.stdout.write(`${application.id}\n`);
  process.stdout.write(`  Status: ${application.status}\n`);
  process.stdout.write(`  Company: ${application.company ?? ""}\n`);
  process.stdout.write(`  Title: ${application.title ?? ""}\n`);
  process.stdout.write(`  URL: ${application.url}\n`);
  process.stdout.write(`  Applied: ${application.appliedAt}\n`);
  process.stdout.write(`  Updated: ${application.updatedAt}\n`);
}

export function printCompanies(companies: AgentCompanySummary[]): void {
  if (companies.length === 0) {
    process.stdout.write("No companies found.\n");
    return;
  }

  for (const company of companies) {
    process.stdout.write(
      `${company.id}  ${company.ignored ? "ignored".padEnd(8) : "active".padEnd(8)}  ${company.name}\n`,
    );
  }
}

export function printCompany(company: AgentCompanySummary): void {
  process.stdout.write(`${company.id}\n`);
  process.stdout.write(`  Name: ${company.name}\n`);
  if (company.url) {
    process.stdout.write(`  URL: ${company.url}\n`);
  }
  if (company.linkedinUrl) {
    process.stdout.write(`  LinkedIn: ${company.linkedinUrl}\n`);
  }
  if (company.email) {
    process.stdout.write(`  Email: ${company.email}\n`);
  }
  process.stdout.write(`  Ignored: ${company.ignored ? "yes" : "no"}\n`);
  process.stdout.write(`  Created: ${company.createdAt}\n`);
  process.stdout.write(`  Updated: ${company.updatedAt}\n`);
}

export function printNote(note: AgentNoteSummary & { applicationUpdatedAt?: string }): void {
  process.stdout.write(`${note.id}  ${note.createdAt}\n`);
  process.stdout.write(`${note.content}\n`);
}

export function printNotes(notes: AgentNoteSummary[]): void {
  if (notes.length === 0) {
    process.stdout.write("No notes found.\n");
    return;
  }

  for (const note of notes) {
    printNote(note);
    process.stdout.write("\n");
  }
}

export function printMarkdown(markdown: string): void {
  process.stdout.write(markdown.endsWith("\n") ? markdown : `${markdown}\n`);
}
