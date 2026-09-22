import type { ReactNode } from "react";
import { cx } from "./cx";
import { Progress } from "./progress";

// Móvil · cabecera de pantalla (reemplaza a <PageHeader> en el layout de
// una sola columna, <768px). Eyebrow en dorado + título serif 26px + barra
// de progreso opcional — mismos tokens que el resto del sistema, solo sube
// la escala de texto (ver docs de diseño "App Movil" · nota final).
export function SectionHeader({
  eyebrow,
  title,
  action,
  progress,
  className,
}: {
  eyebrow?: ReactNode;
  title: string;
  action?: ReactNode;
  progress?: { value: ReactNode; pct: number };
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow != null && (
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent-warm">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-[7px] font-display text-[26px] font-bold leading-tight text-ink">{title}</h1>
        </div>
        {action && <div className="shrink-0 pt-0.5">{action}</div>}
      </div>
      {progress && <Progress pct={progress.pct} value={progress.value} tone="success" />}
    </div>
  );
}
