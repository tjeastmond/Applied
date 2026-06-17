import { cookies } from "next/headers";
import { AppPage } from "@/components/AppPage";
import {
  APPLICATION_PAGE_SIZE_STORAGE_KEY,
  DEFAULT_APPLICATION_PAGE_SIZE,
  parseApplicationPageSize,
} from "@/lib/applicationPagination";
import { getAuthStatus, requestFromCookieHeader } from "@/lib/server/authStatus";
import { loadPageDataForAuth } from "@/lib/server/loadPageDataForAuth";
import { isTursoSyncAvailable } from "@/lib/server/services/databaseTransferService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const authStatus = await getAuthStatus(requestFromCookieHeader(cookieHeader || undefined));
  const { applications, notesByApplicationId } = await loadPageDataForAuth(authStatus.authenticated);
  const storedPageSize = parseApplicationPageSize(cookieStore.get(APPLICATION_PAGE_SIZE_STORAGE_KEY)?.value);

  return (
    <AppPage
      initialApplications={applications}
      initialNotesByApplicationId={notesByApplicationId}
      initialPageSize={storedPageSize ?? DEFAULT_APPLICATION_PAGE_SIZE}
      initialPageSizeFromPreference={storedPageSize !== null}
      tursoSyncAvailable={isTursoSyncAvailable()}
      authStatus={authStatus}
    />
  );
}
