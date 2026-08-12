import type { Client, Row } from "@tursodatabase/serverless/compat";
import type {
  AnalyticsRepository,
  AnalyticsRepositoryFilters,
  AnalyticsRepositorySnapshot,
} from "../repositories/analyticsRepository";
import {
  buildAnalyticsApplicationsQuery,
  COUNT_ALL_APPLICATIONS_SQL,
  rowToAnalyticsApplication,
  type AnalyticsRow,
} from "./analyticsRepositoryShared";
import { nullableString, requiredNumber, requiredString, tursoFirstRow, tursoRows } from "./tursoRowHelpers";

function rowToAnalyticsRow(row: Row): AnalyticsRow {
  return {
    id: requiredString(row, "id"),
    company: nullableString(row, "company"),
    applied_at: requiredString(row, "applied_at"),
    status: requiredString(row, "status"),
    created_at: requiredString(row, "created_at"),
    history_count: requiredNumber(row, "history_count"),
    ever_interviewing: requiredNumber(row, "ever_interviewing"),
    ever_offer: requiredNumber(row, "ever_offer"),
    initial_from_status: nullableString(row, "initial_from_status"),
    initial_to_status: nullableString(row, "initial_to_status"),
    initial_changed_at: nullableString(row, "initial_changed_at"),
  };
}

export class TursoAnalyticsRepository implements AnalyticsRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async loadSnapshot(filters: AnalyticsRepositoryFilters): Promise<AnalyticsRepositorySnapshot> {
    await this.ready;
    const query = buildAnalyticsApplicationsQuery(filters);
    const [countRow, rows] = await Promise.all([
      tursoFirstRow(this.client, COUNT_ALL_APPLICATIONS_SQL),
      tursoRows(this.client, query.sql, query.args),
    ]);

    return {
      allTimeApplicationCount: countRow ? requiredNumber(countRow, "count") : 0,
      applications: rows.map(rowToAnalyticsRow).map(rowToAnalyticsApplication),
    };
  }
}
