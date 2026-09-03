// Vocabulario de categorías compartido entre Ideas, Trabajo y Actividades —
// calcado de la constante CATS global en el os.js original.
export const CATS: Record<string, { label: string; color: string }> = {
  iarcania: { label: "IArcanIA", color: "#E24B4A" },
  contenido: { label: "Contenido", color: "#378ADD" },
  proyectos: { label: "Proyectos", color: "#8B6CF6" },
  personal: { label: "Personal", color: "#5DCAA5" },
  infra: { label: "Infraestructura", color: "#EF9F27" },
  // Antes #9896b0 — chocaba con el token ink-muted (texto secundario) y se
  // veía como "sin color". Pasa a accent-warm, coherente con 5a (el dorado
  // es para «ahora», hábitos y categorías).
  habitos: { label: "Hábitos", color: "#E8A33D" },
};
