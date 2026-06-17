import { getAuthStatus } from "@/lib/server/authStatus";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const status = await getAuthStatus(request);
  return NextResponse.json(status);
}
