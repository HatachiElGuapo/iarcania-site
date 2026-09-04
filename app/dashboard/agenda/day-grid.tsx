"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { moveBlock, scheduleHabit, deleteBlock } from "./actions";

// Vista de día: rejilla FIJA de 00:00 a 24:00 con marcas cada 20 min (72),
// eventos posicionados en absoluto (top = minutos, alto = duración) dentro
// de un contenedor `relative` de altura natural (~2300 px). El scroll es el
// de la PÁGINA — este componente no tiene overflow propio. El encabezado es
// sticky para no perderse al bajar.
//
// Sin librería de drag: pointer events + setPointerCapture. React 18.3, así
// que el patrón optimista es estado local + startTransition (igual que
// components/app/optimistic-toggle-row.tsx), no useOptimistic.

const PX_PER_MIN = 1.6; // 10 min = 16 px, 1 h = 96 px, día completo = 2304 px
const SNAP = 10; // el arrastre ajusta a 10 min aunque las marcas sean de 20
const GUTTER = 46; // ancho de la columna de horas
const MIN_DUR = 20; // mínimo de actividad de la app
const MARK_STEP = 20; // una etiqueta cada 20 min
const V_START = 0;
const V_END = 24 * 60;

export type AgendaEvent = {
  key: string;
  kind: "block" | "habit";
  refId: string; // agenda_items.id (block) | activities.id (habit)
  itemType: string; // task | nota | cita | habito | habit
  start: number; // minutos desde 00:00
  duration: number;
  title: string;
  accent: string; // hex
  icon: string;
  badge: string;
  done: boolean;
  autoTime: boolean; // hábito sin hora fija
  editHref: string | null;
};

function fmt(min: number) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

type LaneInfo = { lane: number; lanes: number };

// Carriles lado a lado para eventos que se solapan. Agrupa en "clusters"
// conectados y dentro de cada uno reparte carriles de forma voraz.
function computeLanes(evs: { key: string; start: number; duration: number }[]) {
  const sorted = [...evs].sort((a, b) => a.start - b.start || a.duration - b.duration);
  const out = new Map<string, LaneInfo>();
  let cluster: typeof sorted = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const laneEnd: number[] = [];
    const laneOf = new Map<string, number>();
    for (const e of cluster) {
      let lane = laneEnd.findIndex((end) => end <= e.start);
      if (lane === -1) {
        lane = laneEnd.length;
        laneEnd.push(0);
      }
      laneEnd[lane] = e.start + e.duration;
      laneOf.set(e.key, lane);
    }
    for (const e of cluster) out.set(e.key, { lane: laneOf.get(e.key) ?? 0, lanes: laneEnd.length });
    cluster = [];
    clusterEnd = -1;
  };

  for (const e of sorted) {
    if (cluster.length && e.start >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.start + e.duration);
  }
  flush();
  return out;
}

type Draft = { key: string; start: number; duration: number } | null;

export function DayGrid({
  date,
  isToday,
  nowMinutes,
  events: initial,
}: {
  date: string;
  isToday: boolean;
  nowMinutes: number;
  events: AgendaEvent[];
}) {
  const sig = initial.map((e) => `${e.key}:${e.start}:${e.duration}`).join("|");
  const [events, setEvents] = useState<AgendaEvent[]>(initial);
  useEffect(() => setEvents(initial), [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [isPending, startTransition] = useTransition();

  const draftRef = useRef<Draft>(null);
  draftRef.current = draft;
  const drag = useRef<
    { key: string; mode: "move" | "resize"; y: number; start: number; dur: number } | null
  >(null);
  const didDrag = useRef(false);

  const display = events.map((e) =>
    draft && draft.key === e.key ? { ...e, start: draft.start, duration: draft.duration } : e,
  );

  // Ventana fija de día completo.
  const vStart = V_START;
  const vEnd = V_END;
  const bodyH = (vEnd - vStart) * PX_PER_MIN;

  const laneSig = display.map((e) => `${e.key}:${e.start}:${e.duration}`).join("|");
  const lanes = useMemo(() => computeLanes(display), [laneSig]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(key: string, start: number, duration: number) {
    const ev = events.find((e) => e.key === key);
    if (!ev) return;
    if (start === ev.start && duration === ev.duration) return;
    setEvents((prev) => prev.map((e) => (e.key === key ? { ...e, start, duration } : e)));
    startTransition(async () => {
      try {
        if (ev.kind === "habit") {
          await scheduleHabit({ activityId: ev.refId, date, blockTime: fmt(start), duration });
        } else {
          await moveBlock({ id: ev.refId, blockTime: fmt(start), duration });
        }
      } catch {
        setEvents((prev) =>
          prev.map((e) => (e.key === key ? { ...e, start: ev.start, duration: ev.duration } : e)),
        );
      }
    });
  }

  function onPointerDown(e: React.PointerEvent, ev: AgendaEvent, mode: "move" | "resize") {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (mode === "resize") e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { key: ev.key, mode, y: e.clientY, start: ev.start, dur: ev.duration };
    didDrag.current = false;
    setDraft({ key: ev.key, start: ev.start, duration: ev.duration });
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientY - d.y) > 3) didDrag.current = true;
    const delta = Math.round((e.clientY - d.y) / PX_PER_MIN / SNAP) * SNAP;
    if (d.mode === "move") {
      setDraft({ key: d.key, start: clamp(d.start + delta, 0, 1440 - d.dur), duration: d.dur });
    } else {
      setDraft({ key: d.key, start: d.start, duration: clamp(d.dur + delta, MIN_DUR, 1440 - d.start) });
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    const df = draftRef.current;
    setDraft(null);
    if (d && df) commit(d.key, df.start, df.duration);
  }

  function onCardClick(e: React.MouseEvent, key: string) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setSel((cur) => (cur === key ? null : key));
  }

  function nudge(ev: AgendaEvent, dStart: number, dDur: number) {
    const start = clamp(ev.start + dStart, 0, 1440 - ev.duration);
    const duration = clamp(ev.duration + dDur, MIN_DUR, 1440 - start);
    commit(ev.key, start, duration);
  }

  function remove(ev: AgendaEvent) {
    setEvents((prev) => prev.filter((e) => e.key !== ev.key));
    setSel(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", ev.refId);
      try {
        await deleteBlock(fd);
      } catch {
        setEvents((prev) => [...prev, ev]);
      }
    });
  }

  // 72 marcas: 00:00, 00:20, 00:40 … 23:20, 23:40.
  const marks: number[] = [];
  for (let m = vStart; m < vEnd; m += MARK_STEP) marks.push(m);

  return (
    <div className="rounded-ui-lg border border-line bg-surface">
      <div className="sticky top-0 z-40 flex items-center gap-2 rounded-t-ui-lg border-b border-line bg-surface-2 px-3.5 py-2.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Rejilla del día
        </span>
        <span className="hidden text-[10.5px] text-ink-dim sm:inline">
          00:00–24:00 · arrastra para mover · tira del borde para durar
        </span>
      </div>

      <div
        className={`relative ${drag.current ? "select-none" : ""}`}
        style={{ height: bodyH + 16, touchAction: "pan-y" }}
      >
        {/* Regla: marca cada 20 min. La hora en punto pesa más (texto más
            claro y grande, línea sólida); :20 y :40 quedan tenues para no
            competir. */}
        {marks.map((m) => {
          const onHour = m % 60 === 0;
          const y = (m - vStart) * PX_PER_MIN;
          return (
            <div key={`m-${m}`}>
              <div
                className={`absolute text-right tabular-nums leading-none ${
                  onHour ? "text-[10.5px] text-ink-muted" : "text-[9px] text-ink-dim"
                }`}
                style={{ top: y - (onHour ? 5 : 4), left: 0, width: GUTTER - 8 }}
              >
                {fmt(m)}
              </div>
              <div
                className={`absolute ${onHour ? "border-t border-line" : "border-t border-dotted"}`}
                style={{ top: y, left: GUTTER, right: 8, ...(onHour ? null : { borderColor: "#1C1C21" }) }}
              />
            </div>
          );
        })}

        {/* Línea de "ahora" */}
        {isToday && nowMinutes >= vStart && nowMinutes <= vEnd && (
          <div
            className="pointer-events-none absolute z-30"
            style={{ top: (nowMinutes - vStart) * PX_PER_MIN, left: GUTTER - 4, right: 8 }}
          >
            <div className="border-t border-accent-warm" />
            <span className="absolute -top-2 -left-1 rounded-[3px] bg-accent-warm px-1 text-[9px] font-semibold text-canvas">
              {fmt(nowMinutes)}
            </span>
          </div>
        )}

        {display.length === 0 && (
          <div
            className="absolute inset-x-0 text-center text-xs text-ink-muted"
            style={{ top: bodyH / 2 - 8 }}
          >
            Nada agendado este día.
          </div>
        )}

        {/* Eventos */}
        <div className="absolute" style={{ left: GUTTER, right: 8, top: 0, bottom: 0 }}>
          {display.map((ev) => {
            const li = lanes.get(ev.key) ?? { lane: 0, lanes: 1 };
            const top = (ev.start - vStart) * PX_PER_MIN;
            const h = Math.max(15, ev.duration * PX_PER_MIN - 2);
            const selected = sel === ev.key;
            const compact = h < 40;
            const a = ev.accent;
            return (
              <div
                key={ev.key}
                onPointerDown={(e) => onPointerDown(e, ev, "move")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onClick={(e) => onCardClick(e, ev.key)}
                style={{
                  position: "absolute",
                  top,
                  height: selected ? "auto" : h,
                  minHeight: h,
                  left: `${(li.lane / li.lanes) * 100}%`,
                  width: `calc(${100 / li.lanes}% - 3px)`,
                  borderColor: selected ? a : `${a}44`,
                  background: `${a}14`,
                  borderLeftColor: a,
                  borderStyle: ev.autoTime ? "dashed" : "solid",
                  zIndex: selected ? 25 : 10,
                  cursor: "grab",
                  touchAction: "none",
                }}
                className={`group overflow-hidden rounded-ui border border-l-[3px] px-2 py-1 ${
                  ev.done ? "opacity-45" : ""
                } ${isPending ? "opacity-70" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-[11px]">{ev.icon}</span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[12px] ${
                      ev.done ? "text-ink-dim line-through" : "text-ink"
                    }`}
                  >
                    {ev.title}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-1.5 text-[9px]"
                    style={{ background: `${a}22`, color: a }}
                  >
                    {ev.badge}
                  </span>
                </div>
                {!compact && (
                  <div className="mt-0.5 text-[10px] tabular-nums text-ink-muted">
                    {fmt(ev.start)} – {fmt(ev.start + ev.duration)} · {ev.duration} min
                  </div>
                )}

                {selected && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-line pt-1.5">
                    <span className="text-[9.5px] tabular-nums text-ink-dim">
                      {fmt(ev.start)}–{fmt(ev.start + ev.duration)}
                    </span>
                    <button type="button" onClick={() => nudge(ev, -30, 0)} className={btn}>
                      −30
                    </button>
                    <button type="button" onClick={() => nudge(ev, -10, 0)} className={btn}>
                      −10
                    </button>
                    <button type="button" onClick={() => nudge(ev, 10, 0)} className={btn}>
                      +10
                    </button>
                    <button type="button" onClick={() => nudge(ev, 30, 0)} className={btn}>
                      +30
                    </button>
                    <span className="ml-1 text-[9.5px] text-ink-dim">dur</span>
                    <button type="button" onClick={() => nudge(ev, 0, -10)} className={btn}>
                      −
                    </button>
                    <button type="button" onClick={() => nudge(ev, 0, 10)} className={btn}>
                      +
                    </button>
                    {ev.editHref && (
                      <a href={ev.editHref} className={`${btn} no-underline`}>
                        Editar
                      </a>
                    )}
                    {ev.kind === "habit" ? (
                      <a href="/dashboard/habitos" className={`${btn} no-underline`}>
                        Hábito
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => remove(ev)}
                        className="rounded border border-line px-1.5 text-[10px] text-ink-dim hover:border-danger/50 hover:text-danger"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                <div
                  onPointerDown={(e) => onPointerDown(e, ev, "resize")}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                  style={{ touchAction: "none" }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const btn =
  "rounded border border-line px-1.5 text-[10px] tabular-nums text-ink-muted hover:border-line-strong hover:text-ink";
