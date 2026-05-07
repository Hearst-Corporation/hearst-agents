import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(_req: NextRequest) {
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized({ token }) {
        return token !== null;
      },
    },
  },
);

export const config = {
  matcher: [
    // Toutes les pages utilisateur
    "/(user)/:path*",
    // Toutes les API v2 sauf les routes publiques
    "/api/v2/:path*",
    // API orchestrate
    "/api/orchestrate/:path*",
  ],
};
