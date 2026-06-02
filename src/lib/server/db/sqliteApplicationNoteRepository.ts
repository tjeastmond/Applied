import type Database from "better-sqlite3";
import type { ApplicationNote } from "@/types";
import type { ApplicationNoteRepository } from "../repositories/applicationNoteRepository";

type NoteRow = {
  id: string;
  application_id: string;
  content: string;
  created_at: string;
};

function rowToNote(row: NoteRow): ApplicationNote {
  return {
    id: row.id,
    applicationId: row.application_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

const LIST_BY_APPLICATION_SQL = `SELECT * FROM application_notes WHERE application_id = ? ORDER BY created_at DESC`;
const INSERT_SQL = `INSERT INTO application_notes (id, application_id, content, created_at) VALUES (?, ?, ?, ?)`;
const DELETE_SQL = `DELETE FROM application_notes WHERE id = ?`;

export class SqliteApplicationNoteRepository implements ApplicationNoteRepository {
  private readonly listByApplicationStmt;
  private readonly insertStmt;
  private readonly deleteStmt;

  constructor(db: Database.Database) {
    this.listByApplicationStmt = db.prepare(LIST_BY_APPLICATION_SQL);
    this.insertStmt = db.prepare(INSERT_SQL);
    this.deleteStmt = db.prepare(DELETE_SQL);
  }

  async listByApplicationId(applicationId: string): Promise<ApplicationNote[]> {
    const rows = this.listByApplicationStmt.all(applicationId) as NoteRow[];
    return rows.map(rowToNote);
  }

  async create(applicationId: string, content: string): Promise<ApplicationNote> {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new Error("Note content is required");
    }

    const id = crypto.randomUUID();
    const createdAt = nowIso();

    this.insertStmt.run(id, applicationId, trimmed, createdAt);

    return {
      id,
      applicationId,
      content: trimmed,
      createdAt,
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = this.deleteStmt.run(id);
    return result.changes > 0;
  }
}
