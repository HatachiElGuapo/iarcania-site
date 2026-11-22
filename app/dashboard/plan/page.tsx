import { redirect } from "next/navigation";

// La vista de día de Plan se unificó con Rutinas (/dashboard, "Tu día") —
// mismos bloques, mismo ⋯ (PlanBlockMenu), más "Plan de la casa" y
// "Eventos del día" (ver app/dashboard/plan/household-section.tsx) para
// lo que solo vivía acá. La plantilla semanal (antes pestaña "Semana" de
// esta misma sección) sigue en /dashboard/plan/semana, alcanzable desde
// el botón "Editar semana" de Rutinas — ya no tiene entrada propia en el
// menú lateral (ver components/app/nav-groups.ts).
export default function PlanPage() {
  redirect("/dashboard");
}
