import type {
  ApplicationNote,
  ApplicationNoteMutationResult,
  ApplicationStatusHistoryEntry,
  AgentApiTokenSummary,
  AnalyticsResponse,
  Company,
  CreateAgentApiTokenResult,
  CreateCompanyInput,
  CreateJobApplicationInput,
  ImportAgentApiTokenResult,
  JobApplication,
  ParseJobUrlResult,
  User,
  UserProfile,
} from "./types";
import type { ChangePasswordInput } from "@/lib/schemas/auth";
import type { PatchCompanyInput } from "@/lib/schemas/company";
import type { UpdateUserProfileInput } from "@/lib/schemas/user";
import { notifyUnauthorized, UnauthorizedError } from "./lib/apiUnauthorized";

async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `${fallback} (${response.status})`;
}

async function fetchWithCredentials(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
  });

  if (response.status === 401) {
    notifyUnauthorized();
    throw new UnauthorizedError(await readApiError(response, "Unauthorized"));
  }

  return response;
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return request<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithCredentials(path, {
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

export function loginApp(accessToken: string): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/auth/login", "POST", { accessToken });
}

export function devLoginApp(): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/auth/dev-login", "POST");
}

export function setupApp(input: {
  email: string;
  password: string;
  displayName: string;
  accessToken?: string;
}): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/auth/setup", "POST", input);
}

export function passwordLoginApp(input: { email: string; password: string }): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/auth/password-login", "POST", input);
}

export function logoutApp(): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/auth/logout", "POST");
}

export function listApplications(): Promise<JobApplication[]> {
  return request<JobApplication[]>("/api/applications");
}

export function listCompanies(search?: { search?: string; ignored?: boolean }): Promise<Company[]> {
  const params = new URLSearchParams();
  if (search?.search) {
    params.set("search", search.search);
  }
  if (search?.ignored !== undefined) {
    params.set("ignored", search.ignored ? "1" : "0");
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request<Company[]>(`/api/companies${query}`);
}

export function createCompany(input: CreateCompanyInput): Promise<Company> {
  return send<Company>("/api/companies", "POST", input);
}

export function patchCompany(id: string, input: PatchCompanyInput): Promise<Company> {
  return send<Company>(`/api/companies/${id}`, "PATCH", input);
}

export function setCompanyIgnored(id: string, ignored: boolean): Promise<Company> {
  return send<Company>(`/api/companies/${id}/ignore`, "PATCH", { ignored });
}

export function getAnalytics(searchParams: URLSearchParams, signal?: AbortSignal): Promise<AnalyticsResponse> {
  const query = searchParams.toString();
  return request<AnalyticsResponse>(`/api/analytics${query ? `?${query}` : ""}`, { signal });
}

export function getApplication(id: string): Promise<JobApplication> {
  return request<JobApplication>(`/api/applications/${id}`);
}

export function createApplication(input: CreateJobApplicationInput): Promise<JobApplication> {
  return send<JobApplication>("/api/applications", "POST", input);
}

export function updateApplication(id: string, input: Partial<CreateJobApplicationInput>): Promise<JobApplication> {
  return send<JobApplication>(`/api/applications/${id}`, "PATCH", input);
}

export function bulkArchiveApplications(
  statuses?: CreateJobApplicationInput["status"][],
): Promise<{ archivedCount: number; applications: JobApplication[] }> {
  return send<{ archivedCount: number; applications: JobApplication[] }>(
    "/api/applications/bulk-archive",
    "POST",
    statuses && statuses.length > 0 ? { statuses } : {},
  );
}

export function archiveStaleApplications(): Promise<{ archivedCount: number; applications: JobApplication[] }> {
  return send<{ archivedCount: number; applications: JobApplication[] }>("/api/applications/archive-stale", "POST");
}

export function deleteApplication(id: string): Promise<void> {
  return send<void>(`/api/applications/${id}`, "DELETE");
}

export function parseJobUrl(url: string): Promise<ParseJobUrlResult> {
  return send<ParseJobUrlResult>("/api/jobs/parse", "POST", { url });
}

export function listApplicationNotes(applicationId: string): Promise<ApplicationNote[]> {
  return request<ApplicationNote[]>(`/api/applications/${applicationId}/notes`);
}

export function listApplicationStatusHistory(applicationId: string): Promise<ApplicationStatusHistoryEntry[]> {
  return request<ApplicationStatusHistoryEntry[]>(`/api/applications/${applicationId}/status-history`);
}

export function createApplicationNote(applicationId: string, content: string): Promise<ApplicationNoteMutationResult> {
  return send<ApplicationNoteMutationResult>(`/api/applications/${applicationId}/notes`, "POST", { content });
}

export function updateApplicationNote(
  applicationId: string,
  noteId: string,
  content: string,
): Promise<ApplicationNoteMutationResult> {
  return send<ApplicationNoteMutationResult>(`/api/applications/${applicationId}/notes/${noteId}`, "PATCH", {
    content,
  });
}

export function deleteApplicationNote(applicationId: string, noteId: string): Promise<void> {
  return send<void>(`/api/applications/${applicationId}/notes/${noteId}`, "DELETE");
}

export type ImportBackupMode = "replace" | "upsert";

export type ImportBackupResult = {
  applications: JobApplication[];
  imported: {
    applications: number;
    notes: number;
  };
  emailsCleared?: number;
};

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

export async function exportBackup(format: "sql" | "json"): Promise<{ blob: Blob; filename: string }> {
  const response = await fetchWithCredentials(`/api/backup/export?format=${format}`);
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

  const response = await fetchWithCredentials("/api/backup/import", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Import failed"));
  }

  return (await response.json()) as ImportBackupResult;
}

export type TursoSyncResult = {
  mode?: "baseline" | "incremental";
  deleted?: Record<string, number>;
  batches?: number;
  payloadBytes?: number;
  imported: {
    applications: number;
    notes: number;
  };
  matches: boolean;
  differences: string[];
};

export async function syncTurso(mode: "incremental" | ImportBackupMode = "incremental"): Promise<TursoSyncResult> {
  return send<TursoSyncResult>("/api/backup/sync-turso", "POST", { mode });
}

export async function downloadDatabaseBackup(): Promise<{ blob: Blob; filename: string }> {
  const response = await fetchWithCredentials("/api/backup/database");
  if (!response.ok) {
    throw new Error(await readApiError(response, "Database backup failed"));
  }

  const blob = await response.blob();
  const filename = parseContentDispositionFilename(response.headers.get("Content-Disposition")) ?? "applied-backup.zip";

  return { blob, filename };
}

export type ListAgentTokensResult = {
  tokens: AgentApiTokenSummary[];
  envTokenConfigured: boolean;
  envTokenRegistered: boolean;
};

export function listAgentTokens(): Promise<ListAgentTokensResult> {
  return request<ListAgentTokensResult>("/api/admin/agent-tokens");
}

export function createAgentToken(name: string): Promise<CreateAgentApiTokenResult> {
  return send<CreateAgentApiTokenResult>("/api/admin/agent-tokens", "POST", { name });
}

export function importAgentTokenFromEnv(name: string): Promise<ImportAgentApiTokenResult> {
  return send<ImportAgentApiTokenResult>("/api/admin/agent-tokens/from-env", "POST", { name });
}

export function renameAgentToken(id: string, name: string): Promise<AgentApiTokenSummary> {
  return send<AgentApiTokenSummary>(`/api/admin/agent-tokens/${id}`, "PATCH", { name });
}

export function revokeAgentToken(id: string): Promise<void> {
  return send<void>(`/api/admin/agent-tokens/${id}`, "DELETE");
}

export function getCurrentUserProfile(): Promise<UserProfile> {
  return request<UserProfile>("/api/user/profile");
}

export function updateCurrentUserProfile(input: UpdateUserProfileInput): Promise<User> {
  return send<User>("/api/user/profile", "PATCH", input);
}

export function changeCurrentUserPassword(input: ChangePasswordInput): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/user/password", "POST", input);
}
