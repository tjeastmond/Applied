import type { ApplicationNote, CreateJobApplicationInput, JobApplication, ParseJobUrlResult } from "./types";

async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `${fallback} (${response.status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Request failed"));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function listApplications(): Promise<JobApplication[]> {
  return request<JobApplication[]>("/api/applications");
}

export function bulkFetchApplications(ids?: string[]): Promise<JobApplication[]> {
  return request<{ applications: JobApplication[] }>("/api/applications/bulk", {
    method: "POST",
    body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
  }).then((result) => result.applications);
}

export function createApplication(input: CreateJobApplicationInput): Promise<JobApplication> {
  return request<JobApplication>("/api/applications", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateApplication(id: string, input: Partial<CreateJobApplicationInput>): Promise<JobApplication> {
  return request<JobApplication>(`/api/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteApplication(id: string): Promise<void> {
  return request<void>(`/api/applications/${id}`, {
    method: "DELETE",
  });
}

export function parseJobUrl(url: string): Promise<ParseJobUrlResult> {
  return request<ParseJobUrlResult>("/api/jobs/parse", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function listApplicationNotes(applicationId: string): Promise<ApplicationNote[]> {
  return request<ApplicationNote[]>(`/api/applications/${applicationId}/notes`);
}

export function createApplicationNote(applicationId: string, content: string): Promise<ApplicationNote> {
  return request<ApplicationNote>(`/api/applications/${applicationId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function updateApplicationNote(
  applicationId: string,
  noteId: string,
  content: string,
): Promise<ApplicationNote> {
  return request<ApplicationNote>(`/api/applications/${applicationId}/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

export function deleteApplicationNote(applicationId: string, noteId: string): Promise<void> {
  return request<void>(`/api/applications/${applicationId}/notes/${noteId}`, {
    method: "DELETE",
  });
}

export type ImportBackupMode = "replace" | "upsert";

export type ImportBackupResult = {
  applications: JobApplication[];
  imported: {
    applications: number;
    notes: number;
  };
};

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

export async function exportBackup(format: "sql" | "json"): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`/api/backup/export?format=${format}`);
  if (!response.ok) {
    throw new Error(await readApiError(response, "Export failed"));
  }

  const blob = await response.blob();
  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ??
    `applied-backup.${format === "sql" ? "sql" : "json"}`;

  return { blob, filename };
}

export async function importBackup(file: File, mode: ImportBackupMode): Promise<ImportBackupResult> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("mode", mode);

  const response = await fetch("/api/backup/import", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Import failed"));
  }

  return (await response.json()) as ImportBackupResult;
}

export async function downloadDatabaseBackup(): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch("/api/backup/database");
  if (!response.ok) {
    throw new Error(await readApiError(response, "Database backup failed"));
  }

  const blob = await response.blob();
  const filename = parseContentDispositionFilename(response.headers.get("Content-Disposition")) ?? "applied-backup.zip";

  return { blob, filename };
}
