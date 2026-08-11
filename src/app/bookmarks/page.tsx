import { AppPage } from "@/components/AppPage";
import { loadAuthenticatedAppPageProps } from "@/lib/server/loadAuthenticatedAppPageProps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const props = await loadAuthenticatedAppPageProps("bookmarks");

  return <AppPage {...props} />;
}
