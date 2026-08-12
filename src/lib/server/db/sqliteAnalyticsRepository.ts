import type Database from "better-sqlite3";
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

export class SqliteAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly db: Database.Database) {}

  loadSnapshot(filters: AnalyticsRepositoryFilters): Promise<AnalyticsRepositorySnapshot> {
    const countRow = this.db.prepare(COUNT_ALL_APPLICATIONS_SQL).get() as { count: number };
    const query = buildAnalyticsApplicationsQuery(filters);
    const rows = this.db.prepare(query.sql).all(...query.args) as AnalyticsRow[];

    return Promise.resolve({
      allTimeApplicationCount: Number(countRow.count),
      applications: rows.map(rowToAnalyticsApplication),
    });
  }
}
