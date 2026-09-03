import type { ReactNode } from "react";
import { cx } from "./cx";

// 4b · 12 — Estados. El estado vacío SIEMPRE es una frase en prosa, en
// segunda persona, más una acción. Nunca «No hay datos».
export function EmptyState({
  icon = "🗒️",
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-ui-lg border border-dashed border-line bg-canvas px-4 py-8 text-center",
        className,
      )}
    >
      <div className="text-[17px]">{icon}</div>
      <div className="mx-auto mt-2 max-w-[38ch] text-[12.5px] leading-relaxed text-ink-muted">
        {children}
      </div>
      {action && <div className="mt-3 inline-flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

// Skeleton por card, no de página completa — se envuelve en <Suspense>.
const W = ["72%", "94%", "58%", "80%", "66%", "88%"];
export function Skeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <span
          key={i}
          className="h-[11px] animate-pulse rounded-[3px] bg-surface-2"
          style={{ width: W[i % W.length] }}
        />
      ))}
    </div>
  );
}
