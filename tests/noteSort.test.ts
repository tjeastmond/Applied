import { describe, expect, it } from "vitest";
import { sortNotes } from "@/lib/noteSort";
import type { ApplicationNote } from "@/types";

function note(id: string, createdAt: string): ApplicationNote {
  return {
    id,
    applicationId: "app-1",
    content: `Note ${id}`,
    createdAt,
  };
}

describe("sortNotes", () => {
  const notes = [
    note("b", "2026-06-02T10:00:00.000Z"),
    note("a", "2026-06-01T10:00:00.000Z"),
    note("c", "2026-06-03T10:00:00.000Z"),
  ];

  it("sorts newest first by default order", () => {
    expect(sortNotes(notes, "newest").map((item) => item.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts oldest first when requested", () => {
    expect(sortNotes(notes, "oldest").map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("uses id as a stable tiebreaker", () => {
    const tied = [note("z", "2026-06-01T10:00:00.000Z"), note("a", "2026-06-01T10:00:00.000Z")];
    expect(sortNotes(tied, "newest").map((item) => item.id)).toEqual(["z", "a"]);
    expect(sortNotes(tied, "oldest").map((item) => item.id)).toEqual(["a", "z"]);
  });
});
