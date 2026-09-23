import { db } from "@/lib/db/client";
import { scripts } from "@/lib/db/schema/guiones";
import { desc, eq } from "drizzle-orm";

export type ScriptOption = {
  id: string;
  title: string;
  canal: string;
  hook: string | null;
  body: string | null;
  cta: string | null;
};

// Guiones del usuario, con contenido incluido — para el <select> de
// vincular Y para leer el contenido del ya vinculado ahí mismo, sin una
// segunda consulta (la lista de guiones de una persona es chica, no hace
// falta optimizar esto con un fetch aparte por id). Ver <ScriptLinkPanel>.
export function listScriptOptions(userId: string): Promise<ScriptOption[]> {
  return db
    .select({
      id: scripts.id,
      title: scripts.title,
      canal: scripts.canal,
      hook: scripts.hook,
      body: scripts.body,
      cta: scripts.cta,
    })
    .from(scripts)
    .where(eq(scripts.userId, userId))
    .orderBy(desc(scripts.createdAt));
}
