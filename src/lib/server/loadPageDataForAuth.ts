import { loadInitialPageData, type InitialPageData } from "@/lib/server/loadInitialPageData";

const EMPTY_PAGE_DATA: InitialPageData = {
  applications: [],
  notesByApplicationId: {},
};

export async function loadPageDataForAuth(authenticated: boolean): Promise<InitialPageData> {
  if (!authenticated) {
    return EMPTY_PAGE_DATA;
  }

  return loadInitialPageData();
}
