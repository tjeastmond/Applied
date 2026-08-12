import { applicationStatusSchema } from "@/lib/schemas/common";
import type { AnalyticsApplicationRecord, AnalyticsRepositoryFilters } from "../repositories/analyticsRepository";

export type AnalyticsRow = {
  id: string;
  company: string | null;
  applied_at: string;
  status: string;
  created_at: string;
  history_count: number;
  ever_interviewing: number;
  ever_offer: number;
  initial_from_status: string | null;
  initial_to_status: string | null;
  initial_changed_at: string | null;
};

export const COUNT_ALL_APPLICATIONS_SQL = `SELECT COUNT(*) AS count FROM applications`;

const ANALYTICS_APPLICATIONS_SELECT = `SELECT
  a.id,
  a.company,
  a.applied_at,
  a.status,
  a.created_at,
  COUNT(h.id) AS history_count,
  MAX(CASE WHEN h.to_status = 'interviewing' THEN 1 ELSE 0 END) AS ever_interviewing,
  MAX(CASE WHEN h.to_status = 'offer' THEN 1 ELSE 0 END) AS ever_offer,
  MAX(CASE WHEN h.changed_at = first_history.first_changed_at THEN h.from_status END) AS initial_from_status,
  MAX(CASE WHEN h.changed_at = first_history.first_changed_at THEN h.to_status END) AS initial_to_status,
  first_history.first_changed_at AS initial_changed_at
FROM applications a
LEFT JOIN application_status_history h ON h.application_id = a.id
LEFT JOIN (
  SELECT application_id, MIN(changed_at) AS first_changed_at
  FROM application_status_history
  GROUP BY application_id
) first_history ON first_history.application_id = a.id`;

export function buildAnalyticsApplicationsQuery(filters: AnalyticsRepositoryFilters): {
  sql: string;
  args: (string | number)[];
} {
  const clauses: string[] = [];
  const args: (string | number)[] = [];

  if (filters.from) {
    clauses.push("a.applied_at >= ?");
    args.push(filters.from);
  }
  if (filters.to) {
    clauses.push("a.applied_at <= ?");
    args.push(filters.to);
  }
  if (!filters.includeArchived) {
    clauses.push("a.archived = 0");
  }
  if (filters.companies.length > 0) {
    clauses.push(
      `COALESCE(NULLIF(TRIM(a.company), ''), 'Unknown Company') IN (${filters.companies.map(() => "?").join(", ")})`,
    );
    args.push(...filters.companies);
  }
  if (filters.statuses.length > 0) {
    clauses.push(`a.status IN (${filters.statuses.map(() => "?").join(", ")})`);
    args.push(...filters.statuses);
  }

  return {
    sql: `${ANALYTICS_APPLICATIONS_SELECT}
${clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""}
GROUP BY a.id, a.company, a.applied_at, a.status, a.created_at, first_history.first_changed_at
ORDER BY a.applied_at ASC, a.id ASC`,
    args,
  };
}

function optionalStatus(value: string | null) {
  if (value === null) {
    return null;
  }
  return applicationStatusSchema.parse(value);
}

export function rowToAnalyticsApplication(row: AnalyticsRow): AnalyticsApplicationRecord {
  return {
    id: row.id,
    company: row.company,
    appliedAt: row.applied_at,
    status: applicationStatusSchema.parse(row.status),
    createdAt: row.created_at,
    historyCount: Number(row.history_count),
    everInterviewing: Number(row.ever_interviewing) === 1,
    everOffer: Number(row.ever_offer) === 1,
    initialFromStatus: optionalStatus(row.initial_from_status),
    initialToStatus: optionalStatus(row.initial_to_status),
    initialChangedAt: row.initial_changed_at,
  };
}
