"use client";

import type { ReactNode } from "react";

// Envuelve una fila de "Sin agendar" para poder arrastrarla dentro de la
// grilla (native HTML5 drag and drop — cruza de un componente cliente a
// otro sin compartir estado, con dataTransfer). El clic normal (que
// precarga el form de "+ Bloque") sigue funcionando igual.
export function DraggableTask({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}
