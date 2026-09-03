import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const destination=request.nextUrl.clone();destination.pathname="/workspace";destination.searchParams.set("from","legacy-admin");
  return NextResponse.redirect(destination);
}
export const config = { matcher: ["/admin/:path*"] };
