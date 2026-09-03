import type { ReactNode } from "react";
import { cx } from "./cx";

// 4b · 11 — Progress (barra con label + valor) y MetricCard (número Playfair
// + label en mayúsculas + barra opcional). Un solo acento por pantalla: el
// tono lo elige el llamador.
type Tone = "accent" | "warm" | "success" | "danger" | "primary";

const BAR: Record<Tone, string> = {
  accent: "bg-accent",
  warm: "bg-accent-warm",
  success: "bg-success",
  danger: "bg-danger",
  primary: "bg-ink",
};

const NUM: Record<Tone, string> = {
  accent: "text-accent",
  warm: "text-accent-warm",
  success: "text-success",
  danger: "text-danger",
  primary: "text-ink",
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function Progress({
  label,
  value,
  pct,
  tone = "accent",
  className,
}: {
  label?: ReactNode;
  value?: ReactNode;
  pct: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center gap-2.5 text-[11.5px] text-ink-muted", className)}>
      {label != null && <span className="min-w-0 flex-1 truncate">{label}</span>}
      <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-line">
        <span className={cx("block h-full rounded-full", BAR[tone])} style={{ width: `${clamp(pct)}%` }} />
      </span>
      {value != null && <span className="min-w-[3rem] text-right text-[11px] text-ink-dim">{value}</span>}
    </div>
  );
}

export function MetricCard({
  value,
  label,
  sub,
  pct,
  tone = "primary",
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  pct?: number;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cx("rounded-ui-lg border border-line bg-surface p-3.5", className)}>
      <div className="flex items-baseline gap-1.5">
        <span className={cx("font-display text-[22px] font-bold", NUM[tone])}>{value}</span>
        {sub != null && <span className="text-[11px] text-ink-dim">{sub}</span>}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-muted">{label}</div>
      {pct != null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <span className={cx("block h-full rounded-full", BAR[tone])} style={{ width: `${clamp(pct)}%` }} />
        </div>
      )}
    </div>
  );
}
