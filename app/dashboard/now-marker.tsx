"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fmtTime } from "@/lib/agenda/time";

// "Ahora" en America/Bogota, en minutos desde 00:00 — Intl.DateTimeFormat
// con timeZone explícito da la hora correcta sin importar la zona del
// dispositivo del usuario. Se recalcula cada minuto.
function nowMinutesBogota(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

// null si `enabled` es false (ej. no es hoy) — no tiene sentido mostrar
// "ahora" ni resaltar nada en un día pasado o futuro.
function useNowMinutes(enabled: boolean): number | null {
  const [now, setNow] = useState<number | null>(() => (enabled ? nowMinutesBogota() : null));
  useEffect(() => {
    if (!enabled) {
      setNow(null);
      return;
    }
    setNow(nowMinutesBogota());
    const id = setInterval(() => setNow(nowMinutesBogota()), 60_000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

// Franja entre dos puntos de la lista armada por DayTimeline (o antes del
// primer ítem / después del último, con el bound correspondiente en
// null) — se dibuja a sí misma solo si "ahora" cae adentro. Recibe solo
// datos serializables (números/boolean) desde el Server Component que
// arma la lista — nunca una función.
export function NowMarkerSlot({
  afterMin,
  beforeMin,
  isToday,
}: {
  afterMin: number | null;
  beforeMin: number | null;
  isToday: boolean;
}) {
  const now = useNowMinutes(isToday);
  if (now === null) return null;
  if (afterMin !== null && now <= afterMin) return null;
  if (beforeMin !== null && now > beforeMin) return null;
  return (
    <div className="flex items-center gap-2 px-3.5" aria-hidden>
      <span className="h-px flex-1 bg-accent/45" />
      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-accent">{fmtTime(now)} · ahora</span>
      <span className="h-px flex-1 bg-accent/45" />
    </div>
  );
}

// Envuelve el contenido YA renderizado de un bloque (children, un
// ReactNode armado en el servidor — eso sí puede cruzar la frontera
// server→client, solo las funciones no) y le agrega, en vivo: un borde de
// acento suave mientras está en curso, u opacidad reducida si ya pasó y
// no se marcó (`done`). Mismos datos serializables que NowMarkerSlot.
export function BlockTimelineState({
  start,
  end,
  done,
  isToday,
  children,
}: {
  start: number;
  end: number;
  done: boolean;
  isToday: boolean;
  children: ReactNode;
}) {
  const now = useNowMinutes(isToday);
  const isCurrent = now !== null && now >= start && now < end;
  const isOverdue = now !== null && now >= end && !done;
  const className = isCurrent ? "rounded-ui-lg ring-1 ring-accent/40" : isOverdue ? "opacity-80" : undefined;
  return <div className={className}>{children}</div>;
}
