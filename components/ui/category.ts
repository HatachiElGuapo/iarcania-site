// Color de categoría — lib/constants/cats.ts es la única fuente. Aquí solo
// se resuelve la clave a { label, color } con el fallback documentado en 5a:
// categoría nula o desconocida → gris "sin clasificar" (category-none), no un
// color inventado ni un hash. Al agregar una categoría, se agrega en cats.ts.
import { CATS } from "@/lib/constants/cats";

const NONE = { label: "Sin categoría", color: "#3A3A42" }; // = token category-none

export function catInfo(key?: string | null): { label: string; color: string } {
  return (key && CATS[key]) || NONE;
}
