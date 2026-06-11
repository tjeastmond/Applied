import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const APPLICATION_LEGACY_COLUMNS = ["full_jd", "salary_range", "desired_salary"] as const;

export function readSchemaSql(): string {
  return readFileSync(join(__dirname, "schema.sql"), "utf-8");
}
