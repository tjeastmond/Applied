import { agentCreateApplicationSchema } from "@/lib/schemas/agent";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { requireAgentAuth } from "@/lib/server/agentAuth";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import {
  createApplicationFromUrlForAgent,
  listApplicationsForAgent,
} from "@/lib/server/services/agentApplicationInterface";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = requireAgentAuth(request);
  if (authError) return authError;

  const applications = await listApplicationsForAgent();
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const authError = requireAgentAuth(request);
  if (authError) return authError;

  const parsed = await parseRequestBody(request, agentCreateApplicationSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const result = await createApplicationFromUrlForAgent(parsed.data.url);
  if (!result.ok) {
    return badRequestResponse(result.error);
  }

  return NextResponse.json(result.application, { status: 201 });
}
