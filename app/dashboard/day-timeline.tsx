"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fmtTime, fmtDuration } from "@/lib/agenda/time";

export type TimelineMeta = {
  isCurrent: boolean;
  isPast: boolean;
  overlapWithTitle: string | null;
};

// "Ahora" en America/Bogota, en minutos desde 00:00 — Intl.DateTimeFormat
// con timeZone explícito da la hora correcta sin importar la zona del
// dispositivo del usuario (mismo criterio que lib/date/bogota en el
// servidor, pero esto corre en el cliente).
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

// null si `enabled` es false (ej. no es hoy — no tiene sentido mostrar
// "ahora" en un día pasado o futuro). Se recalcula cada minuto.
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

export function TimelineGapRow({ startMin, endMin }: { startMin: number; endMin: number }) {
  const minutes = endMin - startMin;
  if (minutes < 1) return null;
  return (
    <div className="flex items-center gap-2 px-3.5 py-1 text-[10.5px] text-ink-dim">
      <span className="h-px flex-1 bg-line" />
      <span className="shrink-0">
        Libre · {fmtTime(startMin)}–{fmtTime(endMin)} · {fmtDuration(minutes)}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function NowMarkerRow({ atMin }: { atMin: number }) {
  return (
    <div className="flex items-center gap-2 px-3.5" aria-hidden>
      <span className="h-px flex-1 bg-accent/45" />
      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-accent">{fmtTime(atMin)} · ahora</span>
      <span className="h-px flex-1 bg-accent/45" />
    </div>
  );
}

export function OverlapNotice({ withTitle }: { withTitle: string }) {
  return <div className="mt-0.5 truncate text-[10px] text-ink-dim">⚠ se cruza con {withTitle}</div>;
}

type TimelineItem = { key: string; start: number; end: number; title: string };

// Dada una lista YA ordenada por `start` ascendente, calcula huecos libres
// entre ítems, solapamientos (un ítem que empieza antes de que termine el
// de mayor `end` visto hasta el momento — no asume que la lista no se
// pise) y dónde cae "ahora" relativo a esos huecos.
function computeAnnotations(items: TimelineItem[], nowMin: number | null) {
  const overlapWithTitle = new Map<string, string>();
  const gapBefore = new Map<string, { start: number; end: number }>();
  let maxEndSoFar: number | null = null;
  let maxEndTitle = "";
  let nowBeforeKey: string | null = null;

  for (const item of items) {
    if (maxEndSoFar !== null) {
      if (item.start < maxEndSoFar) overlapWithTitle.set(item.key, maxEndTitle);
      else if (item.start > maxEndSoFar) gapBefore.set(item.key, { start: maxEndSoFar, end: item.start });
    }
    if (nowMin !== null && nowBeforeKey === null) {
      const afterPrevious = maxEndSoFar === null ? nowMin <= item.start : nowMin > maxEndSoFar && nowMin <= item.start;
      if (afterPrevious) nowBeforeKey = item.key;
    }
    if (maxEndSoFar === null || item.end > maxEndSoFar) {
      maxEndSoFar = item.end;
      maxEndTitle = item.title;
    }
  }
  const nowAfterLast = nowMin !== null && nowBeforeKey === null && (maxEndSoFar === null || nowMin > maxEndSoFar);

  return { overlapWithTitle, gapBefore, nowBeforeKey, nowAfterLast };
}

// Envuelve una lista de bloques/eventos ya ordenada por hora con huecos
// libres, la línea de "ahora" (solo si `isToday`, se actualiza sola cada
// minuto) y anota cada ítem con si está en curso, ya pasó, o se cruza con
// otro — sin tocar el renderizado propio de cada fila (`renderItem`).
export function DayTimeline<T extends TimelineItem>({
  items,
  isToday,
  renderItem,
}: {
  items: T[];
  isToday: boolean;
  renderItem: (item: T, meta: TimelineMeta) => ReactNode;
}) {
  const nowMin = useNowMinutes(isToday);
  const { overlapWithTitle, gapBefore, nowBeforeKey, nowAfterLast } = computeAnnotations(items, nowMin);

  return (
    <>
      {items.map((item) => {
        const gap = gapBefore.get(item.key);
        const isCurrent = nowMin !== null && nowMin >= item.start && nowMin < item.end;
        const isPast = nowMin !== null && nowMin >= item.end;
        return (
          <div key={item.key}>
            {gap && <TimelineGapRow startMin={gap.start} endMin={gap.end} />}
            {nowBeforeKey === item.key && nowMin !== null && <NowMarkerRow atMin={nowMin} />}
            {renderItem(item, { isCurrent, isPast, overlapWithTitle: overlapWithTitle.get(item.key) ?? null })}
          </div>
        );
      })}
      {nowAfterLast && nowMin !== null && <NowMarkerRow atMin={nowMin} />}
    </>
  );
}
