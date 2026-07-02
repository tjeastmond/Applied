import { NextResponse } from "next/server";

// Centralized API auth will live here. For now, route handlers gate via
// requireAppAccess / withAppAccess so DB-stored dev tokens stay available.
// Proxy runs on the Node.js runtime (Next.js 16+), so future auth can use SQLite.
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
