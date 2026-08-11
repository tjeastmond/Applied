import { AppPage } from "@/components/AppPage";
import { loadAuthenticatedAppPageProps } from "@/lib/server/loadAuthenticatedAppPageProps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  const props = await loadAuthenticatedAppPageProps("archived");

  return <AppPage {...props} />;
}
