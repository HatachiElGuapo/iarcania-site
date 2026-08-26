// Todas las fechas de negocio de la app son locales a Bogotá (Colombia, sin
// horario de verano, offset fijo -05:00) — el usuario y (hoy) el servidor de
// desarrollo están ahí, pero un contenedor Docker suele arrancar en UTC por
// defecto. `new Date().toISOString().slice(0,10)` para "hoy" es sensible a
// la timezone del *proceso Node*, no la de Bogotá — cerca de medianoche
// (Bogotá va 5h detrás de UTC) puede devolver el día equivocado. Usar
// siempre estos helpers en vez de construir fechas "a mano".
export const BOGOTA_OFFSET = "-05:00";
const TZ = "America/Bogota";

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function nowHHMM(): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Suma/resta días a una fecha "YYYY-MM-DD" sin pasar por interpretación de
// timezone del proceso — usa mediodía + offset fijo para evitar cualquier
// riesgo de cruce de medianoche, y aritmética UTC pura para el resto.
export function addDaysISO(dateISO: string, delta: number): string {
  const d = new Date(`${dateISO}T12:00:00${BOGOTA_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Primer y último día del mes actual (Bogotá), sin arrastrar Date local.
export function currentMonthRangeISO(): { from: string; to: string } {
  const today = todayISO();
  const [y, m] = today.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}
