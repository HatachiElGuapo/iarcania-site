"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-sm border border-white/[0.08] px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-red-400/30 hover:text-red-400"
    >
      Cerrar sesión
    </button>
  );
}
