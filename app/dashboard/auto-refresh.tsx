"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isBusy } from "./busy-guard";
import { isAnyModalOpen } from "./modal-stack";

const POLL_INTERVAL_MS = 30_000;
const BUSY_RETRY_MS = 2_000;

// Montado una vez en el layout del dashboard: mantiene el tablero al día
// entre dispositivos sin F5. En vez de refrescar a ciegas, primero consulta
// /api/plan/version (barato) y solo pide router.refresh() si cambió desde la
// última vez vista. Nunca refresca mientras haya un drag en curso, un modal
// abierto o una Server Action pendiente (busy-guard / modal-stack) — espera
// y reintenta hasta que esté libre, para no pisarle al usuario lo que está
// haciendo.
export function AutoRefresh() {
  const router = useRouter();
  const lastVersionRef = useRef<number | null>(null);
  const pendingRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearRetry() {
      if (pendingRetryRef.current) {
        clearTimeout(pendingRetryRef.current);
        pendingRetryRef.current = null;
      }
    }

    function refreshWhenFree() {
      clearRetry();
      if (isBusy() || isAnyModalOpen()) {
        pendingRetryRef.current = setTimeout(refreshWhenFree, BUSY_RETRY_MS);
        return;
      }
      router.refresh();
    }

    async function checkVersionAndRefresh() {
      try {
        const res = await fetch("/api/plan/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const version = typeof data.version === "number" ? data.version : null;
        if (version === null) return;
        if (lastVersionRef.current === null) {
          lastVersionRef.current = version;
          return;
        }
        if (version !== lastVersionRef.current) {
          lastVersionRef.current = version;
          refreshWhenFree();
        }
      } catch {
        // Sin red o endpoint caído — se reintenta en el próximo disparador.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") checkVersionAndRefresh();
    }
    function onFocus() {
      checkVersionAndRefresh();
    }
    function onOnline() {
      checkVersionAndRefresh();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    let interval: ReturnType<typeof setInterval> | null = null;
    function startInterval() {
      if (!interval) {
        interval = setInterval(() => {
          if (document.visibilityState === "visible") checkVersionAndRefresh();
        }, POLL_INTERVAL_MS);
      }
    }
    function stopInterval() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }
    function onVisibilityForInterval() {
      if (document.visibilityState === "visible") startInterval();
      else stopInterval();
    }
    document.addEventListener("visibilitychange", onVisibilityForInterval);
    if (document.visibilityState === "visible") startInterval();

    checkVersionAndRefresh();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("visibilitychange", onVisibilityForInterval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      stopInterval();
      clearRetry();
    };
  }, [router]);

  return null;
}
