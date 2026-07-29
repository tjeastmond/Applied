import type { AgentApplicationSummary, AgentNoteSummary } from "@/lib/schemas/agent";
import type { AgentCliConfig } from "@/lib/agentCli/config";

export class AgentCliRequestError extends Error {
  readonly exitCode = 1;
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ErrorBody = { error?: string };

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody;
    if (body.error) {
      return body.error;
    }
  } catch {
    // fall through
  }
  return response.statusText || "Request failed";
}

async function request<T>(config: AgentCliConfig, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new AgentCliRequestError(`Cannot reach ${config.baseUrl}. Is applied.dev running?`, 1);
  }

  if (!response.ok) {
    throw new AgentCliRequestError(await parseErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/markdown")) {
    return (await response.text()) as T;
  }

  return (await response.json()) as T;
}

export async function fetchAgentDocs(config: AgentCliConfig): Promise<string> {
  return request<string>(config, "/api/agent/docs", {
    headers: { Accept: "text/markdown" },
  });
}

export async function listApplications(
  config: AgentCliConfig,
  search?: string,
): Promise<{ applications: AgentApplicationSummary[] }> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request(config, `/api/agent/applications${query}`);
}

export async function getApplication(config: AgentCliConfig, id: string): Promise<AgentApplicationSummary> {
  return request(config, `/api/agent/applications/${id}`);
}

export async function createApplication(
  config: AgentCliConfig,
  url: string,
  status?: string,
): Promise<AgentApplicationSummary> {
  return request(config, "/api/agent/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, ...(status ? { status } : {}) }),
  });
}

export async function setApplicationStatus(
  config: AgentCliConfig,
  id: string,
  status: string,
): Promise<AgentApplicationSummary> {
  return request(config, `/api/agent/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function listCompanies(config: AgentCliConfig, search?: string): Promise<{ companies: string[] }> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return request(config, `/api/agent/companies${query}`);
}

export async function addApplicationNote(
  config: AgentCliConfig,
  id: string,
  content: string,
): Promise<AgentNoteSummary & { applicationUpdatedAt: string }> {
  return request(config, `/api/agent/applications/${id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function listApplicationNotes(config: AgentCliConfig, id: string): Promise<{ notes: AgentNoteSummary[] }> {
  return request(config, `/api/agent/applications/${id}/notes`);
}
