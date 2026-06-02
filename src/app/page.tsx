import { AppPage } from "@/components/AppPage";
import { getRepository } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const initialApplications = await getRepository().list();
  return <AppPage initialApplications={initialApplications} />;
}
