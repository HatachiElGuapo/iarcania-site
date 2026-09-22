import { redirect } from "next/navigation";

// No hay landing pública todavía (queda para más adelante, en iarcania.com
// raíz) — la raíz del sitio entra directo al dashboard, que a su vez manda
// a /login si no hay sesión (ver app/dashboard/layout.tsx).
export default function RootPage() {
  redirect("/dashboard");
}
