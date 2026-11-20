"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";

// Tras un deploy, el bundle viejo en el navegador referencia Server Actions
// que el server nuevo ya no conoce — Next.js lo reporta con este mensaje
// (mismo regex que SafeActionButton y el resto de los componentes que ya lo
// atrapan en su propio try/catch). El hueco real está en los botones que
// NO pasan por un try/catch de React: un <form action={serverAction}>
// plano hace una navegación/acción nativa del navegador, así que el error
// nunca llega a un catch de JS — aparece como un unhandledrejection o un
// error global. Este guard escucha esos dos eventos en TODO el dashboard,
// una sola vez, y recarga — red de seguridad para cualquier botón presente
// o futuro que se nos escape de migrar a SafeActionButton.
const STALE_ACTION_RE = /Failed to find Server Action/i;
const RELOAD_GUARD_KEY = "iarcania.staleAction.reloading";

function messageOf(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "";
}

export function StaleActionGuard() {
  const toast = useToast();
  const reloadedRef = useRef(false);

  useEffect(() => {
    // Si el guardado de la carga anterior sigue puesto pero ya pasó un
    // rato prudente, se limpia — así una recarga de verdad soluciona el
    // problema y una detección más adelante en la misma pestaña (otro
    // deploy, horas después) puede volver a disparar el aviso. Solo evita
    // el BUCLE inmediato (varias recargas en segundos).
    const clearGuardTimer = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {
        // sin sessionStorage — nada que limpiar.
      }
    }, 15_000);

    function reloadOnce() {
      if (reloadedRef.current) return;
      // Guarda también en sessionStorage: si el reload mismo volviera a
      // disparar el mismo error (bundle todavía no actualizado del lado
      // del CDN/caché), no hay que entrar en bucle de recargas.
      try {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY) === "1") return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      } catch {
        // sessionStorage no disponible — seguimos solo con el ref en memoria.
      }
      reloadedRef.current = true;
      toast.show({ message: "Hay una versión nueva, recargando…", tone: "error" });
      window.location.reload();
    }

    function onRejection(e: PromiseRejectionEvent) {
      if (STALE_ACTION_RE.test(messageOf(e.reason))) reloadOnce();
    }

    function onError(e: ErrorEvent) {
      if (STALE_ACTION_RE.test(messageOf(e.error) || e.message || "")) reloadOnce();
    }

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      clearTimeout(clearGuardTimer);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [toast]);

  return null;
}
