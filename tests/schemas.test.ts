import { describe, expect, it } from "vitest";
import {
  applicationSalaryFieldsSchema,
  createJobApplicationSchema,
  parseParsedApplicationSalaryFields,
  patchJobApplicationSchema,
} from "@/lib/schemas/application";
import { createApplicationNoteSchema } from "@/lib/schemas/note";
import { parseJobUrlRequestSchema, parseJobUrlResultSchema, parseJobUrlSuccessSchema } from "@/lib/schemas/parseJob";

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

  it("accepts omitted salary fields", () => {
    const parsed = createJobApplicationSchema.parse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
    });

    expect(parsed.salaryRange ?? null).toBeNull();
    expect(parsed.desiredSalary ?? null).toBeNull();
  });

  it("normalizes empty and null salary fields to null", () => {
    const parsed = createJobApplicationSchema.parse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      salaryRange: "",
      desiredSalary: null,
    });

    expect(parsed.salaryRange).toBeNull();
    expect(parsed.desiredSalary).toBeNull();
  });

  it("parses optional salary fields", () => {
    const parsed = createJobApplicationSchema.parse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      salaryRange: "$150K - $250K",
      desiredSalary: "$200K",
    });

    expect(parsed.salaryRange).toBe("$150K - $250K");
    expect(parsed.desiredSalary).toBe("$200K");
  });

  it("rejects salary fields longer than 100 characters", () => {
    const result = createJobApplicationSchema.safeParse({
      url: "https://jobs.example.com/role",
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      salaryRange: "x".repeat(101),
    });

    expect(result.success).toBe(false);
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

  it("validates salary-only patches", () => {
    const parsed = patchJobApplicationSchema.parse({
      salaryRange: "  $150K - $250K  ",
      desiredSalary: " $175K ",
    });

    expect(parsed.salaryRange).toBe("$150K - $250K");
    expect(parsed.desiredSalary).toBe("$175K");
  });
});

describe("parseJobUrlRequestSchema", () => {
  it("requires a valid URL", () => {
    expect(parseJobUrlRequestSchema.safeParse({ url: "https://example.com/jobs/1" }).success).toBe(true);
    expect(parseJobUrlRequestSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });
});

describe("applicationSalaryFieldsSchema", () => {
  it("accepts an empty object", () => {
    const parsed = applicationSalaryFieldsSchema.parse({});
    expect(parsed.salaryRange ?? null).toBeNull();
    expect(parsed.desiredSalary ?? null).toBeNull();
  });

  it("sanitizes salary field input", () => {
    const parsed = applicationSalaryFieldsSchema.parse({
      salaryRange: "  $150K - $250K  ",
      desiredSalary: " $200K ",
    });

    expect(parsed.salaryRange).toBe("$150K - $250K");
    expect(parsed.desiredSalary).toBe("$200K");
  });
});

describe("parseParsedApplicationSalaryFields", () => {
  it("defaults missing salaryRange to null", () => {
    expect(parseParsedApplicationSalaryFields({})).toEqual({ salaryRange: null });
  });

  it("normalizes empty salaryRange to null", () => {
    expect(parseParsedApplicationSalaryFields({ salaryRange: "" })).toEqual({ salaryRange: null });
    expect(parseParsedApplicationSalaryFields({ salaryRange: "   " })).toEqual({ salaryRange: null });
  });

  it("truncates extracted salary ranges before persistence", () => {
    const parsed = parseParsedApplicationSalaryFields({
      salaryRange: `$${"9".repeat(120)}`,
    });

    expect(parsed.salaryRange).toHaveLength(100);
  });
});

describe("parseJobUrlResultSchema", () => {
  it("accepts parse payloads without salaryRange", () => {
    const parsed = parseJobUrlSuccessSchema.parse({
      ok: true,
      title: "Engineer",
      company: "Acme",
      fullJd: null,
    });

    expect(parsed.salaryRange).toBeNull();
  });

  it("accepts successful parse payloads with salaryRange", () => {
    const parsed = parseJobUrlSuccessSchema.parse({
      ok: true,
      title: "Engineer",
      company: "Acme",
      salaryRange: "$150K - $250K",
      fullJd: null,
    });

    expect(parsed.salaryRange).toBe("$150K - $250K");
    expect(parseJobUrlResultSchema.safeParse(parsed).success).toBe(true);
  });

  it("truncates oversized salaryRange values in parse responses", () => {
    const parsed = parseJobUrlSuccessSchema.parse({
      ok: true,
      title: "Engineer",
      company: "Acme",
      salaryRange: "x".repeat(101),
      fullJd: null,
    });

    expect(parsed.salaryRange).toHaveLength(100);
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
