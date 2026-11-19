import type { ReactNode } from "react";
import { fmtTime, fmtDuration } from "@/lib/agenda/time";
import { NowMarkerSlot, BlockTimelineState } from "./now-marker";

// Server Component a propósito: NO lleva "use client". Recibe `node` ya
// renderizado (un ReactNode puede cruzar la frontera servidor→cliente sin
// problema, es contenido, no código) — lo que NO puede pasar es una
// función (ver NowMarkerSlot/BlockTimelineState más abajo, los únicos dos
// componentes cliente de este archivo, y solo reciben números/boolean +
// children).
export type TimelineBlockItem = { key: string; start: number; end: number; done: boolean; node: ReactNode };

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

// Dada una lista YA ordenada por `start` ascendente, inserta entre los
// ítems: huecos libres (si hay tiempo sin ocupar entre el máximo `end`
// visto hasta el momento y el siguiente `start` — no asume que la lista
// no se pise), una marca si dos bloques se cruzan, y la línea de "ahora"
// en el punto que corresponde (solo hoy, vía NowMarkerSlot). El
// resaltado de "en curso"/"vencido" de cada bloque lo decide
// BlockTimelineState, en vivo, alrededor del `node` ya renderizado.
export function DayTimeline({ items, isToday }: { items: TimelineBlockItem[]; isToday: boolean }) {
  const rows: ReactNode[] = [];
  let runningEnd: number | null = null;

  for (const item of items) {
    rows.push(<NowMarkerSlot key={`now-${item.key}`} afterMin={runningEnd} beforeMin={item.start} isToday={isToday} />);
    if (runningEnd !== null) {
      if (item.start < runningEnd) {
        rows.push(
          <div key={`ov-${item.key}`} className="px-3.5 pb-0.5 text-[10px] text-ink-dim">
            ⚠ se cruza con otro bloque
          </div>,
        );
      } else if (item.start > runningEnd) {
        rows.push(<TimelineGapRow key={`gap-${item.key}`} startMin={runningEnd} endMin={item.start} />);
      }
    }
    rows.push(
      <BlockTimelineState key={item.key} start={item.start} end={item.end} done={item.done} isToday={isToday}>
        {item.node}
      </BlockTimelineState>,
    );
    if (runningEnd === null || item.end > runningEnd) runningEnd = item.end;
  }

  rows.push(<NowMarkerSlot key="now-end" afterMin={runningEnd} beforeMin={null} isToday={isToday} />);
  return <>{rows}</>;
}
