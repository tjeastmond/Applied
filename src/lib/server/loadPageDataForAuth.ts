import { DEFAULT_USER_DISPLAY_NAME, DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import { loadInitialPageData, type InitialPageData } from "@/lib/server/loadInitialPageData";

const EMPTY_PAGE_DATA: InitialPageData = {
  applications: [],
  notesByApplicationId: {},
  currentUser: {
    id: DEFAULT_USER_ID,
    displayName: DEFAULT_USER_DISPLAY_NAME,
    email: null,
    createdAt: "",
    updatedAt: "",
  },
};

export async function loadPageDataForAuth(authenticated: boolean): Promise<InitialPageData> {
  if (!authenticated) {
    return EMPTY_PAGE_DATA;
  }

  return loadInitialPageData();
}
