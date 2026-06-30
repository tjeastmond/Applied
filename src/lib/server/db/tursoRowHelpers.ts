import type { Client, InValue, Row } from "@tursodatabase/serverless/compat";

export type NamedArgs = Record<string, InValue>;

function rowValue(row: Row, column: string): InValue | undefined {
  return row[column];
}

export function requiredString(row: Row, column: string): string {
  const value = rowValue(row, column);
  if (value === null || value === undefined) {
    throw new Error(`Missing required database column: ${column}`);
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  throw new Error(`Unsupported value for database column: ${column}`);
}

export function nullableString(row: Row, column: string): string | null {
  const value = rowValue(row, column);
  if (value === null || value === undefined) return null;
  return requiredString(row, column);
}

export function requiredNumber(row: Row, column: string): number {
  const value = rowValue(row, column);
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  throw new Error(`Unsupported numeric value for database column: ${column}`);
}

export async function tursoRows(client: Client, sql: string, args?: InValue[] | NamedArgs): Promise<Row[]> {
  const result = args === undefined ? await client.execute(sql) : await client.execute({ sql, args });
  return result.rows;
}

export async function tursoFirstRow(client: Client, sql: string, args?: InValue[] | NamedArgs): Promise<Row | null> {
  const result = await tursoRows(client, sql, args);
  return result[0] ?? null;
}
