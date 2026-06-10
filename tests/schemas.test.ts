import { describe, expect, it } from "vitest";
import { createJobApplicationSchema, patchJobApplicationSchema } from "@/lib/schemas/application";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { parseJobUrlRequestSchema } from "@/lib/schemas/parseJob";

describe("createJobApplicationSchema", () => {
  it("parses and sanitizes valid create payloads", () => {
    const parsed = createJobApplicationSchema.parse({
      url: "https://jobs.example.com/role",
      title: "Founding Engineer | Y Combinator",
      company: "Acme",
      appliedAt: "2026-06-01",
      contactEmail: "jane@acme.com",
    });

    expect(parsed.title).toBe("Founding Engineer");
    expect(parsed.contactEmail).toBe("jane@acme.com");
  });

  it("rejects unknown fields", () => {
    const result = createJobApplicationSchema.safeParse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      extra: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid status values", () => {
    const result = createJobApplicationSchema.safeParse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      status: "pending",
    });

    expect(result.success).toBe(false);
  });

  it("accepts to_apply status", () => {
    const parsed = createJobApplicationSchema.parse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      status: "to_apply",
    });

    expect(parsed.status).toBe("to_apply");
  });

  it("rejects recruiter fields when viaRecruiter is false", () => {
    const result = createJobApplicationSchema.safeParse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      viaRecruiter: false,
      recruiterName: "Jane Doe",
    });

    expect(result.success).toBe(false);
  });
});

describe("patchJobApplicationSchema", () => {
  it("allows partial updates", () => {
    const parsed = patchJobApplicationSchema.parse({
      status: "interviewing",
    });

    expect(parsed.status).toBe("interviewing");
  });

  it("accepts passed status", () => {
    const parsed = patchJobApplicationSchema.parse({
      status: "passed",
    });

    expect(parsed.status).toBe("passed");
  });

  it("rejects empty title values", () => {
    const result = patchJobApplicationSchema.safeParse({
      title: "   ",
    });

    expect(result.success).toBe(false);
  });
});

describe("parseJobUrlRequestSchema", () => {
  it("requires a valid URL", () => {
    expect(parseJobUrlRequestSchema.safeParse({ url: "https://example.com/jobs/1" }).success).toBe(true);
    expect(parseJobUrlRequestSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });
});

describe("createApplicationNoteSchema", () => {
  it("sanitizes note content", () => {
    const parsed = createApplicationNoteSchema.parse({
      content: "<script>alert(1)</script>Follow up tomorrow",
    });

    expect(parsed.content).toBe("Follow up tomorrow");
  });
});
