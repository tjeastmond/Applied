import { sortApplications } from "@/lib/applicationsList";
import { sortCompanies } from "@/lib/companies";
import { getCompanyRepository, getNoteRepository, getRepository, getUserRepository } from "@/lib/server/db";
import type { ApplicationNote, Company, JobApplication, User } from "@/types";

export type InitialPageData = {
  applications: JobApplication[];
  companies: Company[];
  notesByApplicationId: Record<string, ApplicationNote[]>;
  currentUser: User;
};

function groupNotesByApplicationId(notes: ApplicationNote[]): Record<string, ApplicationNote[]> {
  const grouped: Record<string, ApplicationNote[]> = {};

  for (const note of notes) {
    const existing = grouped[note.applicationId];
    if (existing) {
      existing.push(note);
    } else {
      grouped[note.applicationId] = [note];
    }
  }

  return grouped;
}

export async function loadInitialPageData(): Promise<InitialPageData> {
  const [applications, companies, notes, currentUser] = await Promise.all([
    getRepository().list(),
    getCompanyRepository().list(),
    getNoteRepository().listAll(),
    getUserRepository().ensureDefaultUser(),
  ]);
  const sortedApplications = sortApplications(applications);
  const sortedCompanies = sortCompanies(companies);
  const groupedNotes = groupNotesByApplicationId(notes);

  return {
    applications: sortedApplications,
    companies: sortedCompanies,
    notesByApplicationId: Object.fromEntries(
      sortedApplications.map((application) => [application.id, groupedNotes[application.id] ?? []]),
    ),
    currentUser,
  };
}
