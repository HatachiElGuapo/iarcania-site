// Aparte de day-events.ts a propósito: ese módulo importa lib/db/client
// (postgres, código solo de servidor) — si fmtTime viviera ahí, cualquier
// Client Component que la use (day-event-row.tsx) arrastraría esa cadena
// al bundle del navegador y el build falla ("Can't resolve 'net'/'tls'/
// 'fs'", los módulos de Node que usa `postgres`). Este archivo no importa
// nada, así que es seguro desde cliente y servidor.

// Minutos desde 00:00 a "HH:MM".
export function fmtTime(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Minutos a "20 min" / "1 h" / "1 h 20 min" — para duración de bloques y
// huecos libres en la línea de tiempo.
export function fmtDuration(min: number) {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
