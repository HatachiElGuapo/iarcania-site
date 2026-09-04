import { and, asc, desc, eq, type InferSelectModel } from "drizzle-orm";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  books,
  bookChapters,
  bookCharacters,
  bookScenarios,
  bookNotes,
} from "@/lib/db/schema/libros";
import {
  PageHeader,
  Card,
  Segmented,
  Button,
  Badge,
  EmptyState,
  Input,
  Select,
  Textarea,
  cx,
} from "@/components/ui";
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

const STATUS_MAP: Record<string, { label: string; tone: "warm" | "success" | "neutral" }> = {
  leyendo: { label: "Leyendo", tone: "warm" },
  terminado: { label: "Terminado", tone: "success" },
  pendiente: { label: "Pendiente", tone: "neutral" },
};

const ROLE_COLOR: Record<string, string> = {
  protagonista: "text-accent-warm",
  antagonista: "text-danger",
  secundario: "text-accent",
  otro: "text-ink-muted",
};

const TABS = [
  { id: "capitulos", label: "Capítulos" },
  { id: "personajes", label: "Personajes" },
  { id: "escenarios", label: "Escenarios" },
  { id: "notas", label: "Notas" },
];

// Etiqueta + control apilados (equivalente nuevo del Field viejo).
function F({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim">{label}</span>
      {children}
    </label>
  );
}

const dashedForm = "flex flex-wrap items-end gap-2 rounded-ui-lg border border-dashed border-line p-3";
const subCard = "rounded-ui-lg border border-line bg-canvas p-3";

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
    <div className="p-8">
      <PageHeader
        icon="📚"
        title="Libros"
        subtitle={`${allBooks.length} libro${allBooks.length !== 1 ? "s" : ""}`}
      />

      {allBooks.length === 0 ? (
        <EmptyState icon="📚">Lo que estás leyendo y lo que quieres leer. Todavía no has agregado ningún libro — agrega tu primera lectura abajo.</EmptyState>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {allBooks.map((b) => {
            const st = STATUS_MAP[b.status] ?? STATUS_MAP.pendiente;
            return (
              <a
                key={b.id}
                href={`/dashboard/libros?book=${b.id}`}
                className={cx(
                  "flex items-center justify-between gap-2 rounded-ui-lg border bg-surface p-3 transition-colors duration-120",
                  activeBook?.id === b.id ? "border-accent" : "border-line hover:border-line-strong",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{b.title}</div>
                  {b.author && <div className="truncate text-xs text-ink-dim">{b.author}</div>}
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </a>
            );
          })}
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">+ Nuevo libro</summary>
        <form action={createBook} className={cx(dashedForm, "mt-2")}>
          <F label="Título">
            <Input name="title" required className="w-56" />
          </F>
          <F label="Autor">
            <Input name="author" className="w-44" />
          </F>
          <F label="Estado">
            <Select name="status" defaultValue="leyendo">
              <option value="leyendo">Leyendo</option>
              <option value="terminado">Terminado</option>
              <option value="pendiente">Pendiente</option>
            </Select>
          </F>
          <Button type="submit">Crear</Button>
        </form>
      </details>

      {activeBook && (
        <Card className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg text-ink">
              {activeBook.title}
              {activeBook.author ? ` — ${activeBook.author}` : ""}
            </h2>
            <form action={updateBookStatus} className="flex items-center gap-2">
              <input type="hidden" name="id" value={activeBook.id} />
              <Select name="status" defaultValue={activeBook.status}>
                <option value="leyendo">Leyendo</option>
                <option value="terminado">Terminado</option>
                <option value="pendiente">Pendiente</option>
              </Select>
              <Button type="submit" variant="secondary">
                Guardar
              </Button>
            </form>
          </div>

          <div className="mb-4 border-b border-line">
            <Segmented
              options={TABS.map((t) => ({
                label: t.label,
                href: `/dashboard/libros?book=${activeBook.id}&tab=${t.id}`,
                active: tab === t.id,
              }))}
            />
          </div>

          {tab === "capitulos" && <ChaptersTab bookId={activeBook.id} userId={userId} />}
          {tab === "personajes" && <CharactersTab bookId={activeBook.id} userId={userId} />}
          {tab === "escenarios" && <ScenariosTab bookId={activeBook.id} userId={userId} />}
          {tab === "notas" && <NotesTab bookId={activeBook.id} userId={userId} />}

          <div className="mt-4 border-t border-line pt-4">
            <form action={deleteBook}>
              <input type="hidden" name="id" value={activeBook.id} />
              <Button type="submit" variant="danger" size="sm">
                Eliminar libro
              </Button>
            </form>
          </div>
        </Card>
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
        <p className="text-xs text-ink-muted">Sin capítulos. Agrega el primero abajo para tomar notas por capítulo.</p>
      ) : (
        <div className="space-y-2">
          {chapters.map((c) => (
            <details key={c.id} className={subCard}>
              <summary className="flex cursor-pointer items-center gap-2">
                <span className="text-xs font-bold text-ink-muted">C{c.number}</span>
                <span className="flex-1 text-sm text-ink">{c.title || "Sin título"}</span>
              </summary>
              {c.summary && <p className="mt-1 text-xs italic text-ink-dim">{c.summary}</p>}
              <form action={updateChapterNotes} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={c.id} />
                <Textarea name="notes" defaultValue={c.notes ?? ""} placeholder="Notas del capítulo…" rows={3} className="w-full" />
                <div className="flex gap-2">
                  <Button type="submit" variant="secondary" size="sm">
                    Guardar notas
                  </Button>
                  <Button type="submit" variant="danger" size="sm" formAction={deleteChapter}>
                    Eliminar
                  </Button>
                </div>
              </form>
            </details>
          ))}
        </div>
      )}
      <form action={createChapter} className={dashedForm}>
        <input type="hidden" name="bookId" value={bookId} />
        <F label="Nº">
          <Input type="number" name="number" min={1} required className="w-16" />
        </F>
        <F label="Título">
          <Input name="title" className="w-48" />
        </F>
        <F label="Resumen">
          <Input name="summary" className="w-56" />
        </F>
        <Button type="submit" variant="secondary">
          + Agregar
        </Button>
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
        <p className="text-xs text-ink-muted">Sin personajes. Anota quién es quién a medida que aparecen.</p>
      ) : (
        <div className="space-y-2">
          {chars.map((c) => (
            <div key={c.id} className={subCard}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{c.name}</span>
                {c.role && (
                  <span className={cx("text-xs font-semibold", ROLE_COLOR[c.role] ?? "text-ink-muted")}>
                    {c.role}
                  </span>
                )}
                <form action={deleteCharacter} className="ml-auto">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-xs text-ink-dim hover:text-danger">
                    ×
                  </button>
                </form>
              </div>
              {c.description && <p className="mt-1 text-xs text-ink-dim">{c.description}</p>}
            </div>
          ))}
        </div>
      )}
      <form action={createCharacter} className={dashedForm}>
        <input type="hidden" name="bookId" value={bookId} />
        <F label="Nombre">
          <Input name="name" required className="w-44" />
        </F>
        <F label="Rol">
          <Select name="role" defaultValue="">
            <option value="">—</option>
            <option value="protagonista">Protagonista</option>
            <option value="antagonista">Antagonista</option>
            <option value="secundario">Secundario</option>
            <option value="otro">Otro</option>
          </Select>
        </F>
        <F label="Descripción">
          <Input name="description" className="w-56" />
        </F>
        <Button type="submit" variant="secondary">
          + Agregar
        </Button>
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
        <p className="text-xs text-ink-muted">Sin escenarios. Registra los lugares donde pasa la historia.</p>
      ) : (
        <div className="space-y-2">
          {scenarios.map((s) => (
            <details key={s.id} className={subCard}>
              <summary className="cursor-pointer text-sm font-semibold text-ink">{s.title}</summary>
              <form action={updateScenario} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={s.id} />
                <Textarea name="description" defaultValue={s.description ?? ""} placeholder="Descripción del escenario…" rows={2} className="w-full" />
                <Textarea name="notes" defaultValue={s.notes ?? ""} placeholder="Notas adicionales…" rows={2} className="w-full" />
                <div className="flex gap-2">
                  <Button type="submit" variant="secondary" size="sm">
                    Guardar
                  </Button>
                  <Button type="submit" variant="danger" size="sm" formAction={deleteScenario}>
                    Eliminar
                  </Button>
                </div>
              </form>
            </details>
          ))}
        </div>
      )}
      <form action={createScenario} className={dashedForm}>
        <input type="hidden" name="bookId" value={bookId} />
        <F label="Título">
          <Input name="title" required className="w-56" />
        </F>
        <F label="Descripción">
          <Input name="description" className="w-56" />
        </F>
        <Button type="submit" variant="secondary">
          + Agregar
        </Button>
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
      <p className="text-xs text-ink-muted">
        {notes.length} nota{notes.length !== 1 ? "s" : ""}
      </p>
      {notes.length === 0 ? (
        <p className="text-xs text-ink-muted">Sin notas sueltas de este libro todavía. Crea la primera abajo.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <details key={n.id} className={subCard}>
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                {n.title || "Sin título"}
              </summary>
              <form action={updateNote} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={n.id} />
                <Input name="title" defaultValue={n.title ?? ""} placeholder="Título (opcional)" className="w-full" />
                <Textarea name="content" defaultValue={n.content ?? ""} placeholder="Contenido…" rows={4} className="w-full" />
                <div className="flex gap-2">
                  <Button type="submit" variant="secondary" size="sm">
                    Guardar
                  </Button>
                  <Button type="submit" variant="danger" size="sm" formAction={deleteNote}>
                    Eliminar
                  </Button>
                </div>
              </form>
            </details>
          ))}
        </div>
      )}
      <form action={createNote} className={dashedForm}>
        <input type="hidden" name="bookId" value={bookId} />
        <F label="Título">
          <Input name="title" className="w-44" />
        </F>
        <F label="Contenido">
          <Input name="content" className="w-72" />
        </F>
        <Button type="submit" variant="secondary">
          + Nueva nota
        </Button>
      </form>
    </div>
  );
}
