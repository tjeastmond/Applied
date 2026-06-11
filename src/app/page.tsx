import { AppPage } from "@/components/AppPage";
import { loadInitialPageData } from "@/lib/server/loadInitialPageData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const { applications, notesByApplicationId } = await loadInitialPageData();

  return <AppPage initialApplications={applications} initialNotesByApplicationId={notesByApplicationId} />;
}
