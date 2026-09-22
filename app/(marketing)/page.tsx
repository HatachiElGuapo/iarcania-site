import { redirect } from "next/navigation";

// Landing pública pendiente de migrar desde index.html — mientras tanto,
// la raíz entra directo al dashboard, que manda a /login si no hay sesión
// (ver app/dashboard/layout.tsx). Antes esto era un placeholder estático
// sin ningún link, así que visitar el sitio sin ruta se sentía como una
// página vacía.
export default function HomePage() {
  redirect("/dashboard");
}
