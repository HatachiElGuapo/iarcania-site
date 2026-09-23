"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hexToRgba, type BrandTheme } from "@/lib/guiones/brand-theme";
import { SlideView } from "../../slide-view";
import type { SlideRow } from "../../slides-actions";

// Overlay a pantalla completa (fixed inset-0) — escapa del layout del
// dashboard. Teclado: → / Espacio avanza, ← retrocede, Esc sale.
// Puerto de js/estudio.js:1000 openPresenter().
export function Presenter({
  title,
  slides,
  theme,
}: {
  title: string;
  slides: SlideRow[];
  theme: BrandTheme;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);
  const fadingRef = useRef(false);

  const total = slides.length;

  const go = useCallback(
    (next: number) => {
      if (fadingRef.current) return;
      if (next < 0 || next >= total || next === idx) return;
      fadingRef.current = true;
      setShow(false);
      window.setTimeout(() => {
        setIdx(next);
        setShow(true);
        fadingRef.current = false;
      }, 160);
    },
    [idx, total],
  );

  const salir = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    router.push("/dashboard/guiones");
  }, [router]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(idx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(idx - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        salir();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, go, salir]);

  const pct = ((idx + 1) / total) * 100;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{
        background: theme.fondo,
        color: theme.texto,
        fontFamily: theme.tipografia ? `'${theme.tipografia}', sans-serif` : undefined,
      }}
      onClick={(e) => {
        // clic en la mitad derecha avanza, izquierda retrocede
        const x = e.clientX / window.innerWidth;
        go(x > 0.5 ? idx + 1 : idx - 1);
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          salir();
        }}
        className="absolute right-4 top-4 z-10 rounded-ui border px-3 py-1 text-[11px]"
        style={{ borderColor: hexToRgba(theme.texto, 0.25), color: hexToRgba(theme.texto, 0.7) }}
      >
        ✕ Salir
      </button>

      <div className="relative flex-1">
        <div
          className="absolute inset-0"
          style={{ opacity: show ? 1 : 0, transition: "opacity 150ms ease" }}
        >
          <SlideView slide={slides[idx]} theme={theme} variant="full" />
        </div>
      </div>

      <div className="relative h-1 flex-shrink-0" style={{ background: hexToRgba(theme.texto, 0.08) }}>
        <div className="h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: theme.primario }} />
        <span
          className="absolute bottom-2 right-4 text-[11px] tabular-nums"
          style={{ color: hexToRgba(theme.texto, 0.35) }}
        >
          {idx + 1} / {total}
        </span>
        <span
          className="absolute bottom-2 left-4 text-[11px]"
          style={{ color: hexToRgba(theme.texto, 0.25) }}
        >
          {title} · ← → Espacio · Esc salir
        </span>
      </div>
    </div>
  );
}
