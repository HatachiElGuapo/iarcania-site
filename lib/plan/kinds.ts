// Vocabulario de plan_blocks.kind / plan_events.kind — ver
// docs/plan/plan-iarcania-spec.md. Colores reutilizados de tailwind.config.ts
// (mismo patrón que lib/constants/cats.ts).
export const PLAN_KINDS: Record<string, { label: string; color: string; icon: string }> = {
  ingresos: { label: "Ingresos", color: "#E8A33D", icon: "💰" },
  juntos: { label: "Juntos", color: "#5DCAA5", icon: "🤝" },
  cuidado: { label: "Cuidado", color: "#F87171", icon: "💆" },
  comida: { label: "Comida", color: "#EF9F27", icon: "🍽️" },
  casa: { label: "Casa", color: "#8B5CF6", icon: "🏠" },
  rutina: { label: "Rutina", color: "#5A5870", icon: "🔁" },
  descanso: { label: "Descanso", color: "#378ADD", icon: "🌙" },
  cita: { label: "Cita", color: "#E24B4A", icon: "📞" },
};

export function kindInfo(kind: string | null) {
  return (kind && PLAN_KINDS[kind]) || { label: kind ?? "—", color: "#3A3A42", icon: "•" };
}
