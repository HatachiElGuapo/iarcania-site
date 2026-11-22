"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Tab = "hoy" | "manana";

type Ctx = {
  open: boolean;
  tab: Tab;
  openModal: (tab: Tab) => void;
  close: () => void;
  setTab: (tab: Tab) => void;
};

const ActionsModalContext = createContext<Ctx | null>(null);

// Comparte el estado de abierto/cerrado + pestaña activa del modal de
// "Acciones" entre el botón "+ Acción" del encabezado y la tarjeta
// compacta de la grilla — ambos están en lugares distintos del árbol de
// page.tsx, así que necesitan un estado común en vez de que cada uno
// maneje el suyo. Envuelve la parte de la página que contiene a los dos.
export function ActionsModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("hoy");

  function openModal(nextTab: Tab) {
    setTab(nextTab);
    setOpen(true);
  }

  return (
    <ActionsModalContext.Provider value={{ open, tab, openModal, close: () => setOpen(false), setTab }}>
      {children}
    </ActionsModalContext.Provider>
  );
}

export function useActionsModal(): Ctx {
  const ctx = useContext(ActionsModalContext);
  if (!ctx) throw new Error("useActionsModal debe usarse dentro de ActionsModalProvider");
  return ctx;
}
