import type { ApplicationNote } from "@/types";

export interface ApplicationNoteRepository {
  listByApplicationId(applicationId: string): Promise<ApplicationNote[]>;
  create(applicationId: string, content: string): Promise<ApplicationNote>;
  delete(id: string): Promise<boolean>;
  deleteForApplication(applicationId: string, noteId: string): Promise<boolean>;
}
