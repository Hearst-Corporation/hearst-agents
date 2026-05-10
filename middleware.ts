import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/api/auth",
  "/api/health",
  "/login",
  "/auth",
  "/_next",
  "/favicon",
  "/hearst-logo",
  "/monitoring",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Pas de session → redirect signin
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/auth/signin";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Session sans refreshToken Google → le token Google n'est pas en base,
  // l'app ne peut pas appeler Gmail/Calendar/Drive. On redirige vers le
  // flow signin pour forcer une reconnexion Google avec les scopes complets.
  if (!token.refreshToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/auth/signin";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    url.searchParams.set("reason", "token_missing");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|hearst-logo\\.svg|monitoring).*)",
  ],
};
