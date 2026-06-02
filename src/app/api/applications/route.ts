import { getRepository } from "@/lib/server/db";
import { validateCreateInput } from "@/lib/server/validation";
import type { CreateJobApplicationInput } from "@/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  const applications = await getRepository().list();
  return NextResponse.json(applications);
}

export async function POST(request: Request) {
  const body = await readJson<CreateJobApplicationInput>(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validationError = validateCreateInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }
  const application = await getRepository().create(body);
  return NextResponse.json(application, { status: 201 });
}
