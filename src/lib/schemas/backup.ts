import { z } from "zod";
import { applicationSalaryFieldSchemas } from "@/lib/schemas/application";
import { applicationStatusSchema } from "@/lib/schemas/common";

export const BACKUP_JSON_VERSION = 2 as const;
export const BACKUP_JSON_VERSION_LEGACY = 1 as const;

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
    pinned: z.boolean().optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .transform((application) => ({
    ...application,
    salaryRange: application.salaryRange ?? null,
    desiredSalary: application.desiredSalary ?? null,
    archived: application.archived ?? false,
    pinned: application.pinned ?? false,
  }));

const backupNoteSchema = z.strictObject({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  content: z.string().min(1),
  createdAt: z.string().min(1),
});

const backupUserSchema = z.strictObject({
  id: z.string().uuid(),
  displayName: z.string().min(1),
  email: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const backupStatusHistorySchema = z.strictObject({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  userId: z.string().uuid(),
  fromStatus: applicationStatusSchema.nullable(),
  toStatus: applicationStatusSchema,
  changedAt: z.string().min(1),
});

export const backupJsonSchema = z
  .strictObject({
    version: z.union([z.literal(BACKUP_JSON_VERSION), z.literal(BACKUP_JSON_VERSION_LEGACY)]),
    exportedAt: z.string().min(1),
    applications: z.array(backupApplicationSchema),
    notes: z.array(backupNoteSchema),
    users: z.array(backupUserSchema).optional(),
    statusHistory: z.array(backupStatusHistorySchema).optional(),
  })
  .transform((backup) => ({
    version: BACKUP_JSON_VERSION,
    exportedAt: backup.exportedAt,
    applications: backup.applications,
    notes: backup.notes,
    users: backup.users ?? [],
    statusHistory: backup.statusHistory ?? [],
  }));

export type BackupJson = z.infer<typeof backupJsonSchema>;

export const importModeSchema = z.enum(["replace", "upsert"]);

export type ImportMode = z.infer<typeof importModeSchema>;

export const backupFormatSchema = z.enum(["sql", "json"]);

export type BackupFormat = z.infer<typeof backupFormatSchema>;
