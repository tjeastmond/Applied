import type { CreateJobApplicationInput, JobApplication, ParseJobUrlResult } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function listApplications(): Promise<JobApplication[]> {
  return request<JobApplication[]>("/api/applications");
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
