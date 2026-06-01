import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CreateJobApplicationInput } from "../src/types";
import { migrate } from "./db/migrate";
import { SqliteJobApplicationRepository } from "./db/sqliteRepository";
import type { JobApplicationRepository } from "./repositories/jobApplicationRepository";
import { parseJobUrl } from "./services/parseJobUrl";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";
const IS_PROD = process.env.NODE_ENV === "production";
const DIST_DIR = join(import.meta.dir, "..", "dist");
const DB_PATH = process.env.DATABASE_PATH ?? join(import.meta.dir, "..", "data", "applied.db");

function createRepository(): JobApplicationRepository {
  if (!existsSync(join(import.meta.dir, "..", "data"))) {
    mkdirSync(join(import.meta.dir, "..", "data"), { recursive: true });
  }

  const db = new Database(DB_PATH);
  migrate(db);
  return new SqliteJobApplicationRepository(db);
}

const repository = createRepository();

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function validateCreateInput(body: Partial<CreateJobApplicationInput>): string | null {
  if (!body.url || typeof body.url !== "string" || body.url.trim().length === 0) {
    return "url is required";
  }
  if (!body.title || typeof body.title !== "string" || body.title.trim().length === 0) {
    return "title is required";
  }
  if (!body.company || typeof body.company !== "string" || body.company.trim().length === 0) {
    return "company is required";
  }
  if (!body.appliedAt || typeof body.appliedAt !== "string" || body.appliedAt.trim().length === 0) {
    return "appliedAt is required";
  }
  return null;
}

async function handleApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/api/jobs/parse" && request.method === "POST") {
    const body = await readJson<{ url?: string }>(request);
    if (!body?.url) {
      return badRequest("url is required");
    }
    const result = await parseJobUrl(body.url);
    return json(result);
  }

  if (pathname === "/api/applications" && request.method === "GET") {
    const applications = await repository.list();
    return json(applications);
  }

  if (pathname === "/api/applications" && request.method === "POST") {
    const body = await readJson<CreateJobApplicationInput>(request);
    if (!body) {
      return badRequest("Invalid JSON body");
    }
    const validationError = validateCreateInput(body);
    if (validationError) {
      return badRequest(validationError);
    }
    const application = await repository.create(body);
    return json(application, 201);
  }

  const patchMatch = pathname.match(/^\/api\/applications\/([^/]+)$/);
  if (patchMatch && request.method === "PATCH") {
    const id = patchMatch[1];
    const body = await readJson<Partial<CreateJobApplicationInput>>(request);
    if (!body) {
      return badRequest("Invalid JSON body");
    }
    if (body.url !== undefined && body.url.trim().length === 0) {
      return badRequest("url cannot be empty");
    }
    if (body.title !== undefined && (body.title === null || body.title.trim().length === 0)) {
      return badRequest("title cannot be empty");
    }
    if (body.company !== undefined && (body.company === null || body.company.trim().length === 0)) {
      return badRequest("company cannot be empty");
    }
    if (body.appliedAt !== undefined && body.appliedAt.trim().length === 0) {
      return badRequest("appliedAt cannot be empty");
    }
    const updated = await repository.update(id, body);
    if (!updated) {
      return json({ error: "Application not found" }, 404);
    }
    return json(updated);
  }

  if (patchMatch && request.method === "DELETE") {
    const id = patchMatch[1];
    const deleted = await repository.delete(id);
    if (!deleted) {
      return json({ error: "Application not found" }, 404);
    }
    return new Response(null, { status: 204 });
  }

  return json({ error: "Not found" }, 404);
}

function serveStatic(pathname: string): Response | null {
  if (!IS_PROD || !existsSync(DIST_DIR)) {
    return null;
  }

  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(DIST_DIR, safePath);

  if (!filePath.startsWith(DIST_DIR)) {
    return null;
  }

  if (safePath === "/index.html" && existsSync(join(DIST_DIR, "index.html"))) {
    return new Response(readFileSync(join(DIST_DIR, "index.html")), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  if (existsSync(filePath) && !filePath.endsWith("/")) {
    const file = readFileSync(filePath);
    const contentType = getContentType(filePath);
    return new Response(file, { headers: { "Content-Type": contentType } });
  }

  const indexPath = join(DIST_DIR, "index.html");
  if (existsSync(indexPath)) {
    return new Response(readFileSync(indexPath), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  return null;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith("/api/")) {
      return handleApi(request);
    }

    const staticResponse = serveStatic(pathname);
    if (staticResponse) {
      return staticResponse;
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Server running at http://${server.hostname}:${server.port}`);
