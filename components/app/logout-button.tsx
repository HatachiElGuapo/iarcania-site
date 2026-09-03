"use client";

import { signOut } from "next-auth/react";

// Shell del dashboard (4c): texto plano, sin borde ni fondo; a rojo (danger)
// al hover.
export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-[11px] text-ink-muted transition-colors duration-120 hover:text-danger"
    >
      Cerrar sesión
    </button>
  );
}
