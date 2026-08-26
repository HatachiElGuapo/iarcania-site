"use client";

import { useEffect, useRef, useState } from "react";

type Tab = "crono" | "timer" | "count" | "alarmas";

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
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">Reloj</h1>

      <div className="flex gap-2 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-sm px-3 py-1.5 ${
              tab === t.id
                ? "bg-bg-card text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
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

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="max-w-sm space-y-4 rounded-md border border-border bg-bg-card p-6 text-center">
      <div className="font-display text-4xl text-text-primary">{fmtMs(ms)}</div>
      <div className="flex justify-center gap-3">
        <button
          onClick={toggle}
          className="rounded-sm bg-gradient-cta px-6 py-2 text-sm font-semibold text-white shadow-glow-purple"
        >
          {running ? "⏸ Pausar" : "▶ Iniciar"}
        </button>
        {running && (
          <button
            onClick={() => setLaps((l) => [ms, ...l])}
            className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            Vuelta
          </button>
        )}
        <button
          onClick={reset}
          className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          Reset
        </button>
      </div>
      {laps.length > 0 && (
        <div className="space-y-1 text-left">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between text-xs text-text-muted">
              <span>Vuelta {laps.length - i}</span>
              <span>{fmtMs(l)}</span>
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

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const pct = total ? left / total : 0;
  const m = Math.floor(left / 60);
  const s = left % 60;

  return (
    <div className="max-w-sm space-y-4 rounded-md border border-border bg-bg-card p-6 text-center">
      <div
        className="font-display text-4xl"
        style={{ color: pct > 0.33 ? "#EF9F27" : "#E24B4A" }}
      >
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </div>
      <div className="flex justify-center gap-2">
        {[1, 5, 10, 25].map((min) => (
          <button
            key={min}
            onClick={() => set(min * 60)}
            className="rounded-sm border border-border px-3 py-1 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            {min}m
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        <input
          type="number"
          placeholder="min"
          value={customMin}
          onChange={(e) => setCustomMin(e.target.value)}
          className="input w-16"
        />
        <input
          type="number"
          placeholder="seg"
          value={customSec}
          onChange={(e) => setCustomSec(e.target.value)}
          className="input w-16"
        />
        <button
          onClick={() => set((Number(customMin) || 0) * 60 + (Number(customSec) || 0))}
          className="rounded-sm border border-border px-3 py-1 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          Fijar
        </button>
      </div>
      <div className="flex justify-center gap-3">
        <button
          onClick={toggle}
          className="rounded-sm bg-gradient-cta px-6 py-2 text-sm font-semibold text-white shadow-glow-purple"
        >
          {running ? "⏸ Pausar" : "▶ Iniciar"}
        </button>
        <button
          onClick={() => set(total)}
          className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
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
    <div className="max-w-sm space-y-4 rounded-md border border-border bg-bg-card p-6 text-center">
      <div className="font-display text-4xl text-text-primary">{val.toLocaleString()}</div>
      <p className="text-xs text-text-muted">Total acumulado: {total.toLocaleString()}</p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => add(-1)}
          className="rounded-sm border border-border px-6 py-2 text-lg text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          −
        </button>
        <button
          onClick={() => add(1)}
          className="rounded-sm bg-gradient-cta px-6 py-2 text-lg font-semibold text-white shadow-glow-purple"
        >
          +
        </button>
      </div>
      <button
        onClick={() => {
          setVal(0);
          setTotal(0);
        }}
        className="rounded-sm border border-border px-4 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
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
      // localStorage no disponible — sin alarmas guardadas.
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
    <div className="max-w-sm space-y-4 rounded-md border border-border bg-bg-card p-6">
      <p className="text-xs text-text-muted">
        Suena solo mientras esta pestaña esté abierta — no es una alarma del sistema.
      </p>
      {alarmas.length === 0 ? (
        <p className="text-sm text-text-muted">Sin alarmas todavía.</p>
      ) : (
        <div className="space-y-2">
          {alarmas.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md bg-bg-deep/40 px-3 py-2 text-sm">
              <button
                onClick={() =>
                  setAlarmas((list) =>
                    list.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)),
                  )
                }
                className={`h-4 w-4 rounded border ${a.enabled ? "border-purple-mid bg-purple-mid" : "border-border"}`}
                aria-label="Activar/desactivar"
              />
              <span className="font-semibold text-text-primary">{a.time}</span>
              <span className="flex-1 text-text-muted">{a.label}</span>
              <button
                onClick={() => setAlarmas((list) => list.filter((x) => x.id !== a.id))}
                className="text-text-muted hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
        <input
          type="text"
          placeholder="Etiqueta"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="input flex-1"
        />
        <button
          onClick={addAlarma}
          className="rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
        >
          + Agregar
        </button>
      </div>
    </div>
  );
}
