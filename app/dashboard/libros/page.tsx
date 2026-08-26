import { and, asc, desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  books,
  bookChapters,
  bookCharacters,
  bookScenarios,
  bookNotes,
} from "@/lib/db/schema/libros";
import { Field } from "@/components/ui/field";
import {
  createBook,
  updateBookStatus,
  deleteBook,
  createChapter,
  updateChapterNotes,
  deleteChapter,
  createCharacter,
  deleteCharacter,
  createScenario,
  updateScenario,
  deleteScenario,
  createNote,
  updateNote,
  deleteNote,
} from "./actions";

type Book = InferSelectModel<typeof books>;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  leyendo: { label: "Leyendo", color: "text-gold" },
  terminado: { label: "Terminado", color: "text-green-400" },
  pendiente: { label: "Pendiente", color: "text-text-muted" },
};

const ROLE_COLOR: Record<string, string> = {
  protagonista: "text-gold",
  antagonista: "text-red-400",
  secundario: "text-purple-light",
  otro: "text-text-muted",
};

const TABS = [
  { id: "capitulos", label: "Capítulos" },
  { id: "personajes", label: "Personajes" },
  { id: "escenarios", label: "Escenarios" },
  { id: "notas", label: "Notas" },
];

export default async function LibrosPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; tab?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { book: bookId, tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "capitulos";

  const allBooks = await db
    .select()
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(desc(books.createdAt));

  const activeBook = bookId ? allBooks.find((b) => b.id === bookId) : undefined;

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">Libros</h1>

      {allBooks.length === 0 ? (
        <p className="text-sm text-text-muted">
          Sin libros todavía — agrega tu primera lectura
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {allBooks.map((b) => {
            const st = STATUS_MAP[b.status] ?? STATUS_MAP.pendiente;
            return (
              <a
                key={b.id}
                href={`/dashboard/libros?book=${b.id}`}
                className={`flex items-center justify-between gap-2 rounded-md border p-3 ${
                  activeBook?.id === b.id
                    ? "border-purple-mid bg-bg-card"
                    : "border-border bg-bg-card hover:border-purple-mid/50"
                }`}
              >
                <div>
                  <div className="text-sm font-semibold text-text-primary">{b.title}</div>
                  {b.author && <div className="text-xs text-text-muted">{b.author}</div>}
                </div>
                <span className={`shrink-0 text-xs font-semibold ${st.color}`}>{st.label}</span>
              </a>
            );
          })}
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-xs text-text-muted">+ Nuevo libro</summary>
        <form
          action={createBook}
          className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Título">
            <input type="text" name="title" required className="input" />
          </Field>
          <Field label="Autor">
            <input type="text" name="author" className="input" />
          </Field>
          <Field label="Estado">
            <select name="status" defaultValue="leyendo" className="input">
              <option value="leyendo">Leyendo</option>
              <option value="terminado">Terminado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            Crear
          </button>
        </form>
      </details>

      {activeBook && (
        <div className="rounded-md border border-border bg-bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-text-primary">
              {activeBook.title}
              {activeBook.author ? ` — ${activeBook.author}` : ""}
            </h2>
            <form action={updateBookStatus} className="flex items-center gap-2">
              <input type="hidden" name="id" value={activeBook.id} />
              <select name="status" defaultValue={activeBook.status} className="input">
                <option value="leyendo">Leyendo</option>
                <option value="terminado">Terminado</option>
                <option value="pendiente">Pendiente</option>
              </select>
              <button
                type="submit"
                className="rounded-sm border border-border px-2 py-1 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
              >
                Guardar
              </button>
            </form>
          </div>

          <div className="mb-4 flex gap-2 border-b border-border pb-2 text-sm">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`/dashboard/libros?book=${activeBook.id}&tab=${t.id}`}
                className={`rounded-sm px-3 py-1.5 ${
                  tab === t.id
                    ? "bg-bg-deep text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {t.label}
              </a>
            ))}
          </div>

          {tab === "capitulos" && <ChaptersTab bookId={activeBook.id} userId={userId} />}
          {tab === "personajes" && <CharactersTab bookId={activeBook.id} userId={userId} />}
          {tab === "escenarios" && <ScenariosTab bookId={activeBook.id} userId={userId} />}
          {tab === "notas" && <NotesTab bookId={activeBook.id} userId={userId} />}

          <div className="mt-4 border-t border-border pt-4">
            <form action={deleteBook}>
              <input type="hidden" name="id" value={activeBook.id} />
              <button
                type="submit"
                className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:border-red-400"
              >
                Eliminar libro
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

async function ChaptersTab({ bookId, userId }: { bookId: string; userId: string }) {
  const chapters = await db
    .select()
    .from(bookChapters)
    .where(and(eq(bookChapters.bookId, bookId), eq(bookChapters.userId, userId)))
    .orderBy(asc(bookChapters.number));

  return (
    <div className="space-y-3">
      {chapters.length === 0 ? (
        <p className="text-xs text-text-muted">Sin capítulos todavía</p>
      ) : (
        <div className="space-y-2">
          {chapters.map((c) => (
            <details key={c.id} className="rounded-md border border-border bg-bg-deep/40 p-3">
              <summary className="flex cursor-pointer items-center gap-2">
                <span className="text-xs font-bold text-text-muted">C{c.number}</span>
                <span className="flex-1 text-sm text-text-primary">{c.title || "Sin título"}</span>
              </summary>
              {c.summary && <p className="mt-1 text-xs italic text-text-dim">{c.summary}</p>}
              <form action={updateChapterNotes} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={c.id} />
                <textarea
                  name="notes"
                  defaultValue={c.notes ?? ""}
                  placeholder="Notas del capítulo..."
                  rows={3}
                  className="input w-full"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-sm border border-border px-2 py-1 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
                  >
                    Guardar notas
                  </button>
                  <button
                    type="submit"
                    formAction={deleteChapter}
                    className="rounded-sm border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:border-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </form>
            </details>
          ))}
        </div>
      )}
      <form
        action={createChapter}
        className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
      >
        <input type="hidden" name="bookId" value={bookId} />
        <Field label="Nº">
          <input type="number" name="number" min={1} required className="input w-16" />
        </Field>
        <Field label="Título">
          <input type="text" name="title" className="input" />
        </Field>
        <Field label="Resumen">
          <input type="text" name="summary" className="input w-48" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Agregar
        </button>
      </form>
    </div>
  );
}

async function CharactersTab({ bookId, userId }: { bookId: string; userId: string }) {
  const chars = await db
    .select()
    .from(bookCharacters)
    .where(and(eq(bookCharacters.bookId, bookId), eq(bookCharacters.userId, userId)))
    .orderBy(asc(bookCharacters.name));

  return (
    <div className="space-y-3">
      {chars.length === 0 ? (
        <p className="text-xs text-text-muted">Sin personajes todavía</p>
      ) : (
        <div className="space-y-2">
          {chars.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-bg-deep/40 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">{c.name}</span>
                {c.role && (
                  <span className={`text-xs font-semibold ${ROLE_COLOR[c.role] ?? ""}`}>
                    {c.role}
                  </span>
                )}
                <form action={deleteCharacter} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-xs text-text-muted hover:text-red-400">
                    ×
                  </button>
                </form>
              </div>
              {c.description && <p className="mt-1 text-xs text-text-dim">{c.description}</p>}
            </div>
          ))}
        </div>
      )}
      <form
        action={createCharacter}
        className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
      >
        <input type="hidden" name="bookId" value={bookId} />
        <Field label="Nombre">
          <input type="text" name="name" required className="input" />
        </Field>
        <Field label="Rol">
          <select name="role" defaultValue="" className="input">
            <option value="">—</option>
            <option value="protagonista">Protagonista</option>
            <option value="antagonista">Antagonista</option>
            <option value="secundario">Secundario</option>
            <option value="otro">Otro</option>
          </select>
        </Field>
        <Field label="Descripción">
          <input type="text" name="description" className="input w-48" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Agregar
        </button>
      </form>
    </div>
  );
}

async function ScenariosTab({ bookId, userId }: { bookId: string; userId: string }) {
  const scenarios = await db
    .select()
    .from(bookScenarios)
    .where(and(eq(bookScenarios.bookId, bookId), eq(bookScenarios.userId, userId)))
    .orderBy(asc(bookScenarios.title));

  return (
    <div className="space-y-3">
      {scenarios.length === 0 ? (
        <p className="text-xs text-text-muted">Sin escenarios todavía</p>
      ) : (
        <div className="space-y-2">
          {scenarios.map((s) => (
            <details key={s.id} className="rounded-md border border-border bg-bg-deep/40 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                {s.title}
              </summary>
              <form action={updateScenario} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={s.id} />
                <textarea
                  name="description"
                  defaultValue={s.description ?? ""}
                  placeholder="Descripción del escenario..."
                  rows={2}
                  className="input w-full"
                />
                <textarea
                  name="notes"
                  defaultValue={s.notes ?? ""}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="input w-full"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-sm border border-border px-2 py-1 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
                  >
                    Guardar
                  </button>
                  <button
                    type="submit"
                    formAction={deleteScenario}
                    className="rounded-sm border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:border-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </form>
            </details>
          ))}
        </div>
      )}
      <form
        action={createScenario}
        className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
      >
        <input type="hidden" name="bookId" value={bookId} />
        <Field label="Título">
          <input type="text" name="title" required className="input" />
        </Field>
        <Field label="Descripción">
          <input type="text" name="description" className="input w-48" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Agregar
        </button>
      </form>
    </div>
  );
}

async function NotesTab({ bookId, userId }: { bookId: string; userId: string }) {
  const notes = await db
    .select()
    .from(bookNotes)
    .where(and(eq(bookNotes.bookId, bookId), eq(bookNotes.userId, userId)))
    .orderBy(desc(bookNotes.createdAt));

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        {notes.length} nota{notes.length !== 1 ? "s" : ""}
      </p>
      {notes.length === 0 ? (
        <p className="text-xs text-text-muted">Sin notas todavía — crea la primera</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <details key={n.id} className="rounded-md border border-border bg-bg-deep/40 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                {n.title || "Sin título"}
              </summary>
              <form action={updateNote} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={n.id} />
                <input
                  type="text"
                  name="title"
                  defaultValue={n.title ?? ""}
                  placeholder="Título (opcional)"
                  className="input w-full"
                />
                <textarea
                  name="content"
                  defaultValue={n.content ?? ""}
                  placeholder="Contenido..."
                  rows={4}
                  className="input w-full"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-sm border border-border px-2 py-1 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
                  >
                    Guardar
                  </button>
                  <button
                    type="submit"
                    formAction={deleteNote}
                    className="rounded-sm border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:border-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </form>
            </details>
          ))}
        </div>
      )}
      <form
        action={createNote}
        className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
      >
        <input type="hidden" name="bookId" value={bookId} />
        <Field label="Título">
          <input type="text" name="title" className="input" />
        </Field>
        <Field label="Contenido">
          <input type="text" name="content" className="input w-64" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Nueva nota
        </button>
      </form>
    </div>
  );
}
