import { db } from "@/lib/db/client";
import { scripts } from "@/lib/db/schema/guiones";
import { recursos } from "@/lib/db/schema/recursos";
import { desc, eq } from "drizzle-orm";

// Opciones para vincular un guion o un recurso (guía/SOP) a una tarea,
// hábito, bloque de Plan o cita — ver ResourceLinksForm.
export function listScriptOptions(userId: string) {
  return db
    .select({ id: scripts.id, title: scripts.title, canal: scripts.canal })
    .from(scripts)
    .where(eq(scripts.userId, userId))
    .orderBy(desc(scripts.createdAt));
}

// recursos es biblioteca compartida (no se filtra por userId, igual que
// app/dashboard/recursos/page.tsx).
export function listRecursoOptions() {
  return db
    .select({ id: recursos.id, titulo: recursos.titulo, tipo: recursos.tipo })
    .from(recursos)
    .orderBy(recursos.titulo);
}
