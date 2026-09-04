"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader, Input, cx } from "@/components/ui";

type Tab = "crono" | "timer" | "count" | "alarmas";

const card = "max-w-sm rounded-ui-lg border border-line bg-surface p-6";
const primaryBtn =
  "focus-ring rounded-ui bg-accent px-6 py-2 text-sm font-medium text-white transition-colors duration-120 hover:bg-accent/90";
const ghostBtn =
  "focus-ring rounded-ui border border-line px-4 py-2 text-sm text-ink-muted transition-colors duration-120 hover:border-line-strong hover:text-ink";
const chipBtn =
  "focus-ring rounded-ui border border-line px-3 py-1 text-xs text-ink-muted transition-colors duration-120 hover:border-line-strong hover:text-ink";

function fmtMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Web Audio no disponible — sin sonido, sin romper la app.
  }
}

const TABS: { id: Tab; label: string }[] = [
  { id: "crono", label: "Cronómetro" },
  { id: "timer", label: "Temporizador" },
  { id: "count", label: "Contador" },
  { id: "alarmas", label: "Alarmas" },
];

export default function RelojPage() {
  const [tab, setTab] = useState<Tab>("crono");

  return (
    <div className="p-8">
      <PageHeader icon="⏱️" title="Reloj" />

      <div className="mb-6 inline-flex items-stretch overflow-hidden rounded-ui border border-line bg-canvas text-meta">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              "px-3 py-1.5 transition-colors duration-120",
              i > 0 && "border-l border-line",
              tab === t.id ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "crono" && <Cronometro />}
      {tab === "timer" && <Temporizador />}
      {tab === "count" && <Contador />}
      {tab === "alarmas" && <Alarmas />}
    </div>
  );
}

function Cronometro() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const startRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function toggle() {
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
    } else {
      startRef.current = Date.now() - ms;
      intervalRef.current = setInterval(() => setMs(Date.now() - startRef.current), 50);
      setRunning(true);
    }
  }
  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setMs(0);
    setLaps([]);
  }
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  return (
    <div className={cx(card, "space-y-4 text-center")}>
      <div className="font-display text-4xl text-ink">{fmtMs(ms)}</div>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={toggle} className={primaryBtn}>
          {running ? "⏸ Pausar" : "▶ Iniciar"}
        </button>
        {running && (
          <button type="button" onClick={() => setLaps((l) => [ms, ...l])} className={ghostBtn}>
            Vuelta
          </button>
        )}
        <button type="button" onClick={reset} className={ghostBtn}>
          Reset
        </button>
      </div>
      {laps.length > 0 && (
        <div className="space-y-1 text-left">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between text-xs text-ink-muted">
              <span>Vuelta {laps.length - i}</span>
              <span className="tabular-nums">{fmtMs(l)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Temporizador() {
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [customMin, setCustomMin] = useState("");
  const [customSec, setCustomSec] = useState("");
  const endRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function set(secs: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
    setTotal(secs);
    setLeft(secs);
  }
  function toggle() {
    if (!left) return;
    if (running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRunning(false);
    } else {
      endRef.current = Date.now() + left * 1000;
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
        setLeft(remaining);
        if (remaining <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          playBeep();
        }
      }, 250);
      setRunning(true);
    }
  }
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  const pct = total ? left / total : 0;
  const m = Math.floor(left / 60);
  const s = left % 60;

  return (
    <div className={cx(card, "space-y-4 text-center")}>
      <div className="font-display text-4xl tabular-nums" style={{ color: pct > 0.33 ? "#E8A33D" : "#F87171" }}>
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </div>
      <div className="flex justify-center gap-2">
        {[1, 5, 10, 25].map((min) => (
          <button key={min} type="button" onClick={() => set(min * 60)} className={chipBtn}>
            {min}m
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        <Input
          type="number"
          placeholder="min"
          value={customMin}
          onChange={(e) => setCustomMin(e.target.value)}
          className="w-16"
        />
        <Input
          type="number"
          placeholder="seg"
          value={customSec}
          onChange={(e) => setCustomSec(e.target.value)}
          className="w-16"
        />
        <button
          type="button"
          onClick={() => set((Number(customMin) || 0) * 60 + (Number(customSec) || 0))}
          className={chipBtn}
        >
          Fijar
        </button>
      </div>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={toggle} className={primaryBtn}>
          {running ? "⏸ Pausar" : "▶ Iniciar"}
        </button>
        <button type="button" onClick={() => set(total)} className={ghostBtn}>
          Reset
        </button>
      </div>
    </div>
  );
}

function Contador() {
  const [val, setVal] = useState(0);
  const [total, setTotal] = useState(0);

  function add(n: number) {
    setVal((v) => Math.max(0, v + n));
    if (n > 0) setTotal((t) => t + n);
  }

  return (
    <div className={cx(card, "space-y-4 text-center")}>
      <div className="font-display text-4xl tabular-nums text-ink">{val.toLocaleString()}</div>
      <p className="text-xs text-ink-dim">Total acumulado: {total.toLocaleString()}</p>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={() => add(-1)} className={cx(ghostBtn, "px-6 text-lg")}>
          −
        </button>
        <button type="button" onClick={() => add(1)} className={cx(primaryBtn, "text-lg")}>
          +
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setVal(0);
          setTotal(0);
        }}
        className={cx(chipBtn, "mx-auto block")}
      >
        Reset
      </button>
    </div>
  );
}

type Alarma = { id: string; time: string; label: string; enabled: boolean };

function Alarmas() {
  const [alarmas, setAlarmas] = useState<Alarma[]>([]);
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");
  const lastRung = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("os_alarmas");
      if (raw) setAlarmas(JSON.parse(raw));
    } catch {
      // localStorage no disponible.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("os_alarmas", JSON.stringify(alarmas));
    } catch {
      // sin persistencia — no rompe la UI.
    }
  }, [alarmas]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm === lastRung.current) return;
      const match = alarmas.find((a) => a.enabled && a.time === hhmm);
      if (match) {
        lastRung.current = hhmm;
        playBeep();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [alarmas]);

  function addAlarma() {
    if (!time) return;
    setAlarmas((a) => [...a, { id: crypto.randomUUID(), time, label, enabled: true }]);
    setTime("");
    setLabel("");
  }

  return (
    <div className={cx(card, "space-y-4")}>
      <p className="text-xs text-ink-dim">
        Solo suena con la pestaña Alarmas abierta y si el navegador permite el audio — no es una alarma del sistema.
      </p>
      {alarmas.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin alarmas. Pon una hora y una etiqueta abajo.</p>
      ) : (
        <div className="space-y-2">
          {alarmas.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-ui bg-canvas px-3 py-2 text-sm">
              <button
                type="button"
                onClick={() =>
                  setAlarmas((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)))
                }
                aria-label="Activar/desactivar"
                className={cx(
                  "h-4 w-4 rounded border",
                  a.enabled ? "border-accent bg-accent" : "border-line-strong",
                )}
              />
              <span className="font-semibold tabular-nums text-ink">{a.time}</span>
              <span className="flex-1 text-ink-muted">{a.label}</span>
              <button
                type="button"
                onClick={() => setAlarmas((list) => list.filter((x) => x.id !== a.id))}
                className="text-ink-dim hover:text-danger"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32" />
        <Input
          type="text"
          placeholder="Etiqueta"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="flex-1"
        />
        <button type="button" onClick={addAlarma} className={cx(primaryBtn, "px-3 py-1.5")}>
          + Agregar
        </button>
      </div>
    </div>
  );
}
