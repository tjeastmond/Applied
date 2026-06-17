import { NextResponse } from "next/server";

// App API auth runs in Node route handlers via requireAppAccess, which can hydrate
// DB-stored dev tokens. Edge middleware cannot read SQLite, so we do not gate here.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
