"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { setCheck } from "./actions";

// Nota de hoy de un bloque — texto libre, por eso no puede ser un
// SafeActionButton de campos fijos (hay que leer el input al enviar).
// Guardar nota marca el bloque hecho si no tenía ningún estado, o conserva
// el que ya tenía (saltado sigue saltado, con su nota).
export function NoteForm({
  date,
  blockId,
  currentStatus,
  defaultNote,
}: {
  date: string;
  blockId: string;
  currentStatus: string | undefined;
  defaultNote: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState(defaultNote);
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("date", date);
        fd.set("blockId", blockId);
        fd.set("status", currentStatus || "done");
        fd.set("note", note);
        await setCheck(fd);
        router.refresh();
      } catch (err) {
        toast.show({ message: err instanceof Error ? err.message : "No se pudo guardar la nota.", tone: "error" });
      }
    });
  }

  return (
    <div className="flex flex-1 min-w-[180px] items-center gap-1.5">
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota — ¿qué hiciste?"
        className="min-w-0 flex-1 rounded-ui border border-line bg-canvas px-2 py-1 text-meta text-ink"
      />
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={handleSubmit}>
        Nota
      </Button>
    </div>
  );
}
