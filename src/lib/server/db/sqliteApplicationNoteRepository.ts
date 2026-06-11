import type Database from "better-sqlite3";
import type { ApplicationNote } from "@/types";
import type { ApplicationNoteRepository } from "../repositories/applicationNoteRepository";
import {
  buildNote,
  DELETE_NOTE_FOR_APPLICATION_SQL,
  DELETE_NOTE_SQL,
  GET_NOTE_FOR_APPLICATION_SQL,
  INSERT_NOTE_SQL,
  LIST_ALL_NOTES_SQL,
  LIST_NOTES_BY_APPLICATION_SQL,
  rowToNote,
  type NoteRow,
  trimRequiredNoteContent,
  UPDATE_NOTE_FOR_APPLICATION_SQL,
} from "./applicationNoteRepositoryShared";

export class SqliteApplicationNoteRepository implements ApplicationNoteRepository {
  private readonly listAllStmt;
  private readonly listByApplicationStmt;
  private readonly getForApplicationStmt;
  private readonly insertStmt;
  private readonly updateForApplicationStmt;
  private readonly deleteStmt;
  private readonly deleteForApplicationStmt;

  constructor(db: Database.Database) {
    this.listAllStmt = db.prepare(LIST_ALL_NOTES_SQL);
    this.listByApplicationStmt = db.prepare(LIST_NOTES_BY_APPLICATION_SQL);
    this.getForApplicationStmt = db.prepare(GET_NOTE_FOR_APPLICATION_SQL);
    this.insertStmt = db.prepare(INSERT_NOTE_SQL);
    this.updateForApplicationStmt = db.prepare(UPDATE_NOTE_FOR_APPLICATION_SQL);
    this.deleteStmt = db.prepare(DELETE_NOTE_SQL);
    this.deleteForApplicationStmt = db.prepare(DELETE_NOTE_FOR_APPLICATION_SQL);
  }

  async listAll(): Promise<ApplicationNote[]> {
    const rows = this.listAllStmt.all() as NoteRow[];
    return rows.map(rowToNote);
  }

  async listByApplicationId(applicationId: string): Promise<ApplicationNote[]> {
    const rows = this.listByApplicationStmt.all(applicationId) as NoteRow[];
    return rows.map(rowToNote);
  }

  async create(applicationId: string, content: string): Promise<ApplicationNote> {
    const note = buildNote(applicationId, content);

    this.insertStmt.run(note.id, note.applicationId, note.content, note.createdAt);

    return note;
  }

  async updateForApplication(applicationId: string, noteId: string, content: string): Promise<ApplicationNote | null> {
    const trimmed = trimRequiredNoteContent(content);

    const result = this.updateForApplicationStmt.run(trimmed, noteId, applicationId);
    if (result.changes === 0) {
      return null;
    }

    const row = this.getForApplicationStmt.get(noteId, applicationId) as NoteRow | undefined;
    return row ? rowToNote(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.deleteStmt.run(id);
    return result.changes > 0;
  }

  async deleteForApplication(applicationId: string, noteId: string): Promise<boolean> {
    const result = this.deleteForApplicationStmt.run(noteId, applicationId);
    return result.changes > 0;
  }
}
