import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { ADMIN_FALLBACK_LOCALE, routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // Arabic is for customers only: send staff to the French admin panel.
  const { pathname } = request.nextUrl;
  if (pathname === "/ar/admin" || pathname.startsWith("/ar/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${ADMIN_FALLBACK_LOCALE}${pathname.slice(3)}`;
    return NextResponse.redirect(url);
  }
  return intl(request);
}

export const config = {
  // Skip the API/media rewrites, Next internals and any file with an extension.
  matcher: ["/((?!api|media|_next|_vercel|.*\\..*).*)"],
};
