import { cookies } from "next/headers";
import { AppPage } from "@/components/AppPage";
import {
  APPLICATION_PAGE_SIZE_STORAGE_KEY,
  DEFAULT_APPLICATION_PAGE_SIZE,
  parseApplicationPageSize,
} from "@/lib/applicationPagination";
import { loadInitialPageData } from "@/lib/server/loadInitialPageData";
import { isTursoSyncAvailable } from "@/lib/server/services/databaseTransferService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const { applications, notesByApplicationId } = await loadInitialPageData();
  const cookieStore = await cookies();
  const storedPageSize = parseApplicationPageSize(cookieStore.get(APPLICATION_PAGE_SIZE_STORAGE_KEY)?.value);

  return (
    <AppPage
      initialApplications={applications}
      initialNotesByApplicationId={notesByApplicationId}
      initialPageSize={storedPageSize ?? DEFAULT_APPLICATION_PAGE_SIZE}
      initialPageSizeFromPreference={storedPageSize !== null}
      tursoSyncAvailable={isTursoSyncAvailable()}
    />
  );
}
