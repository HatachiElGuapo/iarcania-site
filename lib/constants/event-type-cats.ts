// Categorías de tipos de evento — compartidas entre Eventos y Citas
// (Citas puede vincularse opcionalmente a un tipo de evento).
export const EVENT_TYPE_CATS: Record<string, { label: string; icon: string; color: string }> = {
  cultural: { label: "Cultural", icon: "🎭", color: "#8B6CF6" },
  familia: { label: "Familia", icon: "👨‍👩‍👧", color: "#5DCAA5" },
  amigos: { label: "Amigos", icon: "👥", color: "#378ADD" },
  visita: { label: "Visita", icon: "🏠", color: "#EF9F27" },
};
