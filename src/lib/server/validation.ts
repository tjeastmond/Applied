import type { CreateJobApplicationInput } from "@/types";

export function validateCreateInput(body: Partial<CreateJobApplicationInput>): string | null {
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

export function validatePatchInput(body: Partial<CreateJobApplicationInput>): string | null {
  if (body.url !== undefined && body.url.trim().length === 0) {
    return "url cannot be empty";
  }
  if (body.title !== undefined && (body.title === null || body.title.trim().length === 0)) {
    return "title cannot be empty";
  }
  if (body.company !== undefined && (body.company === null || body.company.trim().length === 0)) {
    return "company cannot be empty";
  }
  if (body.appliedAt !== undefined && body.appliedAt.trim().length === 0) {
    return "appliedAt cannot be empty";
  }
  return null;
}
