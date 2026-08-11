import { AppPage } from "@/components/AppPage";
import { loadAuthenticatedAppPageProps } from "@/lib/server/loadAuthenticatedAppPageProps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const props = await loadAuthenticatedAppPageProps();

  return (
    <>
      <AppPage {...props} />
      {children}
    </>
  );
}
