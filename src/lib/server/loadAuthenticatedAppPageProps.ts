import { cookies } from "next/headers";
import type { AppView } from "@/lib/appView";
import {
  APPLICATION_PAGE_SIZE_STORAGE_KEY,
  DEFAULT_APPLICATION_PAGE_SIZE,
  parseApplicationPageSize,
} from "@/lib/applicationPagination";
import { getAuthStatus, requestFromCookieHeader } from "@/lib/server/authStatus";
import { loadPageDataForAuth } from "@/lib/server/loadPageDataForAuth";
import { isTursoSyncAvailable } from "@/lib/server/services/databaseTransferService";

export async function loadAuthenticatedAppPageProps(routeAppView?: AppView) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  const authStatus = await getAuthStatus(requestFromCookieHeader(cookieHeader || undefined));
  const { applications, notesByApplicationId, currentUser } = await loadPageDataForAuth(authStatus.authenticated);
  const storedPageSize = parseApplicationPageSize(cookieStore.get(APPLICATION_PAGE_SIZE_STORAGE_KEY)?.value);

  return {
    initialApplications: applications,
    initialNotesByApplicationId: notesByApplicationId,
    initialCurrentUser: currentUser,
    initialPageSize: storedPageSize ?? DEFAULT_APPLICATION_PAGE_SIZE,
    initialPageSizeFromPreference: storedPageSize !== null,
    tursoSyncAvailable: isTursoSyncAvailable(),
    authStatus,
    routeAppView,
  };
}
