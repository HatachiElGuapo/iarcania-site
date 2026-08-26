import type { NextAuthConfig } from "next-auth";

// Config apta para Edge Runtime — sin adapter ni providers que toquen la DB
// (postgres/drizzle usan módulos de Node como fs/os/stream, no soportados en
// Edge). middleware.ts usa SOLO este archivo. lib/auth.ts la extiende con el
// adapter de Drizzle y el provider Credentials para el resto de la app
// (route handlers y Server Components, que sí corren en Node.js runtime).
export const authConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      if (isOnDashboard) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
