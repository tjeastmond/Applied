import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { openDatabase } from "@/lib/server/db/migrate";
import { getRepository, getNoteRepository, useTestDatabase } from "@/lib/server/db";
import { GET as getNotes, POST as postNote } from "@/app/api/applications/[id]/notes/route";
import { DELETE as deleteNote, PATCH as patchNote } from "@/app/api/applications/[id]/notes/[noteId]/route";
import { PATCH as patchApplication } from "@/app/api/applications/[id]/route";
import { POST as bulkFetchApplicationsRoute } from "@/app/api/applications/bulk/route";
import { authorizedAppRequest, restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

const missingApplicationId = "00000000-0000-4000-a000-000000000099";
const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("application API routes", () => {
  beforeEach(() => {
    withTestAppAccessToken();
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
  });

  test("PATCH returns 404 for unknown application before validating body", async () => {
    const response = await patchApplication(
      authorizedAppRequest("/api/applications/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Should Not Apply" }),
      }),
      { params: Promise.resolve({ id: missingApplicationId }) },
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Application not found");
  });

  test("notes GET, POST, and scoped DELETE", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/live",
        title: "Live",
        company: "Co",
        appliedAt: "2026-06-02",
      }),
    );

    const listResponse = await getNotes(authorizedAppRequest("/api/applications"), {
      params: Promise.resolve({ id: app.id }),
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([]);

    const createResponse = await postNote(
      authorizedAppRequest("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Follow up Friday" }),
      }),
      { params: Promise.resolve({ id: app.id }) },
    );
    expect(createResponse.status).toBe(201);
    const note = (await createResponse.json()) as { id: string; content: string };
    expect(note.content).toBe("Follow up Friday");

    const patchResponse = await patchNote(
      authorizedAppRequest("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Follow up Monday" }),
      }),
      { params: Promise.resolve({ id: app.id, noteId: note.id }) },
    );
    expect(patchResponse.status).toBe(200);
    const updated = (await patchResponse.json()) as { id: string; content: string };
    expect(updated.content).toBe("Follow up Monday");

    const deleteResponse = await deleteNote(authorizedAppRequest("/api/applications", { method: "DELETE" }), {
      params: Promise.resolve({ id: app.id, noteId: note.id }),
    });
    expect(deleteResponse.status).toBe(204);
    expect(await getNoteRepository().listByApplicationId(app.id)).toHaveLength(0);

    const missingResponse = await deleteNote(authorizedAppRequest("/api/applications", { method: "DELETE" }), {
      params: Promise.resolve({ id: app.id, noteId: note.id }),
    });
    expect(missingResponse.status).toBe(404);
  });

  test("PATCH note bumps application updatedAt", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/note-touch",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-02",
      }),
    );
    const beforeUpdatedAt = app.updatedAt;

    const note = await getNoteRepository().create(app.id, "Initial note");

    const patchResponse = await patchNote(
      authorizedAppRequest("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Updated note" }),
      }),
      { params: Promise.resolve({ id: app.id, noteId: note.id }) },
    );

    expect(patchResponse.status).toBe(200);
    const body = (await patchResponse.json()) as { content: string; applicationUpdatedAt: string };
    expect(body.content).toBe("Updated note");
    expect(body.applicationUpdatedAt >= beforeUpdatedAt).toBe(true);

    const refreshed = await getRepository().getById(app.id);
    expect(refreshed?.updatedAt).toBe(body.applicationUpdatedAt);
    expect(refreshed?.updatedAt >= beforeUpdatedAt).toBe(true);
  });

  test("PATCH status change creates a status update note", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/status",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-02",
        status: "applied",
      }),
    );

    const response = await patchApplication(
      authorizedAppRequest("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "interviewing" }),
      }),
      { params: Promise.resolve({ id: app.id }) },
    );

    expect(response.status).toBe(200);

    const notes = await getNoteRepository().listByApplicationId(app.id);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toBe("Status Update: Interviewing");
  });

  test("PATCH without status change does not create a status update note", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/no-status-change",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-02",
        status: "applied",
      }),
    );

    const response = await patchApplication(
      authorizedAppRequest("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Senior Engineer" }),
      }),
      { params: Promise.resolve({ id: app.id }) },
    );

    expect(response.status).toBe(200);
    expect(await getNoteRepository().listByApplicationId(app.id)).toHaveLength(0);
  });

  test("bulk POST returns all applications when ids are omitted", async () => {
    const first = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/first",
        title: "First",
        company: "Acme",
        appliedAt: "2026-06-02",
      }),
    );
    const second = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/second",
        title: "Second",
        company: "Beta",
        appliedAt: "2026-06-03",
      }),
    );

    const allResponse = await bulkFetchApplicationsRoute(
      authorizedAppRequest("/api/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(allResponse.status).toBe(200);
    const allBody = (await allResponse.json()) as { applications: { id: string }[] };
    expect(allBody.applications.map((application) => application.id).sort()).toEqual([first.id, second.id].sort());

    const subsetResponse = await bulkFetchApplicationsRoute(
      authorizedAppRequest("/api/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [second.id] }),
      }),
    );
    expect(subsetResponse.status).toBe(200);
    const subsetBody = (await subsetResponse.json()) as { applications: { id: string }[] };
    expect(subsetBody.applications).toHaveLength(1);
    expect(subsetBody.applications[0]?.id).toBe(second.id);
  });

  test("bulk POST returns empty array when ids is an empty array", async () => {
    await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/only",
        title: "Only",
        company: "Acme",
        appliedAt: "2026-06-02",
      }),
    );

    const response = await bulkFetchApplicationsRoute(
      authorizedAppRequest("/api/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { applications: unknown[] };
    expect(body.applications).toEqual([]);
  });

  test("PATCH rejects recruiter fields when existing application is not via recruiter", async () => {
    const app = await getRepository().create(
      createJobApplicationSchema.parse({
        url: "https://jobs.example.com/recruiter",
        title: "Engineer",
        company: "Acme",
        appliedAt: "2026-06-02",
        viaRecruiter: false,
      }),
    );

    const response = await patchApplication(
      authorizedAppRequest("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiterName: "Jane Doe" }),
      }),
      { params: Promise.resolve({ id: app.id }) },
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("recruiter fields require viaRecruiter: true");
  });
});
