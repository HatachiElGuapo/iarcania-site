import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ideas } from "@/lib/db/schema/ideas";
import { Field } from "@/components/ui/field";
import { CATS } from "@/lib/constants/cats";
import { createIdea, deleteIdea, createTaskFromIdea } from "./actions";

export default async function IdeasPage() {
  const session = await auth();
  const userId = session!.user.id;

  const userIdeas = await db
    .select()
    .from(ideas)
    .where(eq(ideas.userId, userId))
    .orderBy(desc(ideas.createdAt));

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">Ideas</h1>

      <form
        action={createIdea}
        className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-bg-card p-4"
      >
        <Field label="Nueva idea">
          <input type="text" name="rawContent" required className="input w-96" />
        </Field>
        <Field label="Categoría (opcional)">
          <select name="category" defaultValue="" className="input">
            <option value="">Sin categoría</option>
            {Object.entries(CATS).map(([key, c]) => (
              <option key={key} value={key}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="submit"
          className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
        >
          + Agregar
        </button>
      </form>

      {userIdeas.length === 0 ? (
        <p className="text-sm text-text-muted">No hay ideas todavía.</p>
      ) : (
        <div className="space-y-2">
          {userIdeas.map((idea) => {
            const cat = idea.category ? CATS[idea.category] : null;
            return (
              <div
                key={idea.id}
                className="rounded-md border border-border bg-bg-card p-4"
              >
                <p className="text-sm text-text-primary">{idea.rawContent}</p>
                {idea.processedContent && (
                  <p className="mt-1 text-sm text-text-muted">
                    {idea.processedContent}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      idea.status === "procesada"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-purple-mid/10 text-purple-light"
                    }`}
                  >
                    {idea.status}
                  </span>
                  {cat && (
                    <span style={{ color: cat.color }} className="font-semibold">
                      {cat.label}
                    </span>
                  )}
                  <span>
                    · {idea.createdAt.toLocaleDateString("en-CA", { timeZone: "America/Bogota" })}
                  </span>

                  <form action={createTaskFromIdea} className="ml-auto">
                    <input type="hidden" name="id" value={idea.id} />
                    <button
                      type="submit"
                      className="rounded-sm border border-border px-2 py-1 text-text-muted hover:border-purple-mid hover:text-text-primary"
                    >
                      → Crear tarea
                    </button>
                  </form>
                  <form action={deleteIdea}>
                    <input type="hidden" name="id" value={idea.id} />
                    <button
                      type="submit"
                      className="rounded-sm border border-red-500/30 px-2 py-1 text-red-400 hover:border-red-400"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
