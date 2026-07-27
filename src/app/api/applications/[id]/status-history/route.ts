import { withAppAccess } from "@/lib/server/appAuth";
import { getStatusHistoryRepository } from "@/lib/server/db";
import { type ApplicationIdRouteContext, requireApplicationRouteContext } from "@/lib/server/applicationRouteHelpers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAppAccess<ApplicationIdRouteContext>(async (_request: Request, context) => {
  const routeContext = await requireApplicationRouteContext(context);
  if (routeContext instanceof Response) {
    return routeContext;
  }

  const history = await getStatusHistoryRepository().listByApplicationId(routeContext.id);
  return NextResponse.json(history);
});
