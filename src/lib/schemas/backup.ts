import { z } from "zod";
import { applicationSalaryFieldSchemas } from "@/lib/schemas/application";
import { applicationStatusSchema } from "@/lib/schemas/common";

export const BACKUP_JSON_VERSION = 1 as const;

const backupApplicationSchema = z
  .strictObject({
    id: z.string().uuid(),
    url: z.string().min(1),
    linkedinUrl: z.string().nullable(),
    title: z.string().nullable(),
    company: z.string().nullable(),
    appliedAt: z.string().min(1),
    viaRecruiter: z.boolean(),
    recruiterName: z.string().nullable(),
    recruiterFirm: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    salaryRange: applicationSalaryFieldSchemas.salaryRange.optional(),
    desiredSalary: applicationSalaryFieldSchemas.desiredSalary.optional(),
    fullJd: z.string().nullable(),
    status: applicationStatusSchema,
    archived: z.boolean().optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .transform((application) => ({
    ...application,
    salaryRange: application.salaryRange ?? null,
    desiredSalary: application.desiredSalary ?? null,
    archived: application.archived ?? false,
  }));

const backupNoteSchema = z.strictObject({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  content: z.string().min(1),
  createdAt: z.string().min(1),
});

export const backupJsonSchema = z.strictObject({
  version: z.literal(BACKUP_JSON_VERSION),
  exportedAt: z.string().min(1),
  applications: z.array(backupApplicationSchema),
  notes: z.array(backupNoteSchema),
});

export type BackupJson = z.infer<typeof backupJsonSchema>;

export const importModeSchema = z.enum(["replace", "upsert"]);

export type ImportMode = z.infer<typeof importModeSchema>;

export const backupFormatSchema = z.enum(["sql", "json"]);

export type BackupFormat = z.infer<typeof backupFormatSchema>;
