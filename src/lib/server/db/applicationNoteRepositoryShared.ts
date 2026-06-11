import type { ApplicationNote } from "@/types";
import { nowIso } from "./applicationRepositoryShared";

export type NoteRow = {
  id: string;
  application_id: string;
  content: string;
  created_at: string;
};

export const LIST_ALL_NOTES_SQL = `SELECT * FROM application_notes ORDER BY application_id, created_at DESC, rowid DESC`;
export const LIST_NOTES_BY_APPLICATION_SQL = `SELECT * FROM application_notes WHERE application_id = ? ORDER BY created_at DESC, rowid DESC`;
export const INSERT_NOTE_SQL = `INSERT INTO application_notes (id, application_id, content, created_at) VALUES (?, ?, ?, ?)`;
export const GET_NOTE_FOR_APPLICATION_SQL = `SELECT * FROM application_notes WHERE id = ? AND application_id = ?`;
export const UPDATE_NOTE_FOR_APPLICATION_SQL = `UPDATE application_notes SET content = ? WHERE id = ? AND application_id = ?`;
export const DELETE_NOTE_SQL = `DELETE FROM application_notes WHERE id = ?`;
export const DELETE_NOTE_FOR_APPLICATION_SQL = `DELETE FROM application_notes WHERE id = ? AND application_id = ?`;

export function rowToNote(row: NoteRow): ApplicationNote {
  return {
    id: row.id,
    applicationId: row.application_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function buildNote(applicationId: string, content: string): ApplicationNote {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error("Note content is required");
  }

  return {
    id: crypto.randomUUID(),
    applicationId,
    content: trimmed,
    createdAt: nowIso(),
  };
}

export function trimRequiredNoteContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error("Note content is required");
  }
  return trimmed;
}
