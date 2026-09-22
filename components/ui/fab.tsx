import type { ReactNode } from "react";
import { cx } from "./cx";

// Móvil · botón flotante de acción primaria. 54px, acento violeta, sombra —
// el "+" del centro del <BottomNav>. Server-safe (siempre navega a `href`;
// la pantalla de destino decide qué hacer con eso, p. ej. abrir un <Sheet>
// leyendo un query param).
export function Fab({
  href,
  label = "Agregar",
  icon,
  className,
}: {
  href: string;
  label?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className={cx(
        "focus-ring flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl bg-accent",
        "shadow-[0_6px_20px_rgba(139,92,246,0.35)] transition-colors duration-120 hover:bg-accent/90",
        className,
      )}
    >
      {icon ?? (
        <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
    </a>
  );
}
