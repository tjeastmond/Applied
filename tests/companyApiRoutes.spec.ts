import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { openDatabase } from "@/lib/server/db/migrate";
import { getCompanyRepository, useTestDatabase } from "@/lib/server/db";
import { GET as listCompanies, POST as createCompanyRoute } from "@/app/api/companies/route";
import { PATCH as patchCompanyRoute } from "@/app/api/companies/[id]/route";
import { PATCH as setCompanyIgnoredRoute } from "@/app/api/companies/[id]/ignore/route";
import { authorizedAppRequest, emptyRouteContext, restoreAppAccessToken, withTestAppAccessToken } from "./testAppAuth";

const originalAppAccessToken = process.env.APP_ACCESS_TOKEN;

describe("company API routes", () => {
  beforeEach(() => {
    withTestAppAccessToken();
    useTestDatabase(openDatabase(":memory:"));
  });

  afterEach(() => {
    restoreAppAccessToken(originalAppAccessToken);
  });

  test("GET, POST, PATCH, and ignore toggle", async () => {
    const emptyResponse = await listCompanies(authorizedAppRequest("/api/companies"), emptyRouteContext);
    expect(emptyResponse.status).toBe(200);
    expect(await emptyResponse.json()).toEqual([]);

    const createResponse = await createCompanyRoute(
      authorizedAppRequest("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Acme",
          url: "https://acme.example",
          linkedinUrl: "https://linkedin.com/company/acme",
          email: "hello@acme.example",
        }),
      }),
      emptyRouteContext,
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      name: string;
      url: string;
      linkedinUrl: string;
      email: string;
      ignored: boolean;
    };
    expect(created.name).toBe("Acme");
    expect(created.url).toBe("https://acme.example/");
    expect(created.linkedinUrl).toBe("https://linkedin.com/company/acme");
    expect(created.email).toBe("hello@acme.example");
    expect(created.ignored).toBe(false);

    const duplicateResponse = await createCompanyRoute(
      authorizedAppRequest("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "acme" }),
      }),
      emptyRouteContext,
    );
    expect(duplicateResponse.status).toBe(409);

    const patchResponse = await patchCompanyRoute(
      authorizedAppRequest("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Acme Corp", email: "contact@acme.example" }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(patchResponse.status).toBe(200);
    const patched = (await patchResponse.json()) as { name: string; email: string };
    expect(patched.name).toBe("Acme Corp");
    expect(patched.email).toBe("contact@acme.example");

    const ignoreResponse = await setCompanyIgnoredRoute(
      authorizedAppRequest("/api/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignored: true }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(ignoreResponse.status).toBe(200);
    const ignored = (await ignoreResponse.json()) as { ignored: boolean };
    expect(ignored.ignored).toBe(true);

    const activeListResponse = await listCompanies(authorizedAppRequest("/api/companies?ignored=0"), emptyRouteContext);
    expect(await activeListResponse.json()).toEqual([]);

    const ignoredListResponse = await listCompanies(
      authorizedAppRequest("/api/companies?ignored=1"),
      emptyRouteContext,
    );
    const ignoredList = (await ignoredListResponse.json()) as { name: string }[];
    expect(ignoredList).toHaveLength(1);
    expect(ignoredList[0]?.name).toBe("Acme Corp");
  });

  test("creates companies through repository", async () => {
    const repository = getCompanyRepository();
    await repository.create({ name: "Manual Co" });
    const companies = await repository.list();
    expect(companies.some((company) => company.name === "Manual Co")).toBe(true);
  });
});
