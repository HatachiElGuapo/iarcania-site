"use client";

import { signOut } from "next-auth/react";

// Ver os.css .btn-logout — texto plano, sin borde ni fondo.
export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-[11px] text-text-muted transition-colors hover:text-red-400"
    >
      Cerrar sesión
    </button>
  );
}
