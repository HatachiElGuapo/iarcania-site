import { and, count, desc, eq, ilike, or, type InferSelectModel, type SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { recursos, recursosSensibles } from "@/lib/db/schema/recursos";
import {
  PageHeader,
  Table,
  TableHead,
  TableRow,
  Button,
  Badge,
  EmptyState,
  Input,
  Select,
  Textarea,
  Pagination,
  cx,
} from "@/components/ui";
import { createRecurso, updateRecurso, deleteRecurso } from "./actions";

type Recurso = InferSelectModel<typeof recursos>;

const TIPOS: Record<string, { label: string; icon: string }> = {
  curso: { label: "Curso", icon: "🎓" },
  sop: { label: "SOP", icon: "📋" },
  prompt: { label: "Prompt", icon: "💬" },
  workflow: { label: "Workflow", icon: "⚙️" },
  plantilla: { label: "Plantilla", icon: "📄" },
  entregable: { label: "Entregable", icon: "📦" },
  json: { label: "JSON", icon: "🔧" },
  video: { label: "Video", icon: "▶️" },
  procedimiento: { label: "Procedimiento", icon: "📜" },
};

const ESTADO_TONE: Record<string, "success" | "warm" | "neutral" | "danger"> = {
  vivo: "success",
  "en-progreso": "warm",
  pendiente: "neutral",
  archivado: "neutral",
};

const VISIBLE_PARA_OPTIONS = [
  { id: "admin", label: "Admin" },
  { id: "employee", label: "Equipo" },
  { id: "family", label: "Familia" },
  { id: "cliente", label: "Clientes" },
  { id: "estudiante", label: "Estudiantes" },
];

const PAGE_SIZE = 50;
const COLS = "minmax(0,1fr) 132px 104px 96px 90px";

// Biblioteca compartida: la consulta NO filtra por user_id (igual que el
// original). `userId` solo decide permisos de edición.
export default async function RecursosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; page?: string; edit?: string; nuevo?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const isAdmin = session!.user.role === "admin";
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const tipo = sp.tipo && TIPOS[sp.tipo] ? sp.tipo : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const search: SQL | undefined = q
    ? or(ilike(recursos.titulo, `%${q}%`), ilike(recursos.contenido, `%${q}%`))
    : undefined;
  const where = and(...(tipo ? [eq(recursos.tipo, tipo)] : []), ...(search ? [search] : []));

  const [totalRows, list, sensiblesRows] = await Promise.all([
    db.select({ total: count() }).from(recursos).where(where),
    db
      .select()
      .from(recursos)
      .where(where)
      .orderBy(desc(recursos.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    isAdmin ? db.select().from(recursosSensibles) : Promise.resolve([]),
  ]);

  const total = totalRows[0]?.total ?? 0;
  const sensibles = new Map(sensiblesRows.map((s) => [s.recursoId, s.contenido]));
  const editing = sp.edit ? list.find((r) => r.id === sp.edit) : undefined;
  const filtering = !!(q || tipo);

  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tipo) params.set("tipo", tipo);
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/dashboard/recursos?${s}` : "/dashboard/recursos";
  };

  return (
    <div className="p-8">
      <PageHeader
        icon="📦"
        title="Recursos"
        subtitle={`${total} recurso${total !== 1 ? "s" : ""}${filtering ? " (filtrado)" : ""}`}
        actions={<Button href={qs({ nuevo: "1" })}>+ Nuevo recurso</Button>}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3.5">
        {Object.entries(TIPOS).map(([key, t]) => {
          const active = tipo === key;
          return (
            <a
              key={key}
              href={qs({ tipo: active ? undefined : key, page: undefined })}
              className={cx(
                "rounded-ui border px-2.5 py-1 text-[11px] transition-colors duration-120",
                active
                  ? "border-line-strong bg-surface-2 text-ink"
                  : "border-line bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {t.icon} {t.label}
            </a>
          );
        })}
        <form method="get" action="/dashboard/recursos" className="ml-auto flex items-center gap-2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <Input type="search" name="q" defaultValue={q} placeholder="Buscar recursos…" className="w-56" />
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>
      </div>

      {(sp.nuevo || editing) && (
        <RecursoForm
          action={editing ? updateRecurso : createRecurso}
          recurso={editing}
          sensible={editing ? sensibles.get(editing.id) ?? null : null}
          isAdmin={isAdmin}
          cancelHref={qs({ edit: undefined, nuevo: undefined })}
        />
      )}

      <div className="mt-4">
        {list.length === 0 ? (
          filtering ? (
            <EmptyState icon="⌕">
              Ningún recurso coincide con {q ? <>«{q}»</> : "el filtro"}.{" "}
              <a href="/dashboard/recursos" className="text-ink underline">
                Quitar filtros
              </a>
            </EmptyState>
          ) : (
            <EmptyState icon="📦">
              La biblioteca está vacía. Crea el primer recurso con «+ Nuevo recurso».
            </EmptyState>
          )
        ) : (
          <>
            <Table>
              <TableHead cols={COLS}>
                <span>Recurso</span>
                <span>Tipo</span>
                <span>Estado</span>
                <span>Creado</span>
                <span className="text-right">Acciones</span>
              </TableHead>
              {list.map((r) => {
                const t = TIPOS[r.tipo] ?? { label: r.tipo, icon: "📄" };
                const canEdit = isAdmin || r.userId === userId;
                return (
                  <TableRow key={r.id} cols={COLS}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-ink">
                        {t.icon} {r.titulo}
                      </span>
                      {r.contenido && (
                        <span className="truncate text-[10.5px] text-ink-dim">{r.contenido}</span>
                      )}
                    </span>
                    <span className="text-[11.5px] text-ink-muted">{t.label}</span>
                    <span>
                      <Badge tone={ESTADO_TONE[r.estado] ?? "neutral"}>{r.estado}</Badge>
                    </span>
                    <span className="text-[11px] tabular-nums text-ink-dim">
                      {r.createdAt.toLocaleDateString("es-CO", {
                        timeZone: "America/Bogota",
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="flex justify-end text-[11px] text-ink-dim">
                      {canEdit ? (
                        <a href={qs({ edit: r.id })} className="hover:text-ink">
                          Editar
                        </a>
                      ) : (
                        <span className="text-ink-dim/50">—</span>
                      )}
                    </span>
                  </TableRow>
                );
              })}
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => qs({ page: String(p) })} />
          </>
        )}
      </div>
    </div>
  );
}

function RecursoForm({
  action,
  recurso,
  sensible,
  isAdmin,
  cancelHref,
}: {
  action: (formData: FormData) => void | Promise<void>;
  recurso?: Recurso;
  sensible: string | null;
  isAdmin: boolean;
  cancelHref: string;
}) {
  return (
    <form
      action={action}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-ui-lg border border-line bg-surface p-4"
    >
      {recurso && <input type="hidden" name="id" value={recurso.id} />}
      <span className="w-full text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
        {recurso ? `Editar · ${recurso.titulo}` : "Nuevo recurso"}
      </span>
      <Input name="titulo" defaultValue={recurso?.titulo} required placeholder="Título" aria-label="Título" className="w-64" />
      <Select name="tipo" defaultValue={recurso?.tipo ?? "curso"} aria-label="Tipo">
        {Object.entries(TIPOS).map(([key, t]) => (
          <option key={key} value={key}>
            {t.icon} {t.label}
          </option>
        ))}
      </Select>
      <Select name="estado" defaultValue={recurso?.estado ?? "vivo"} aria-label="Estado">
        <option value="vivo">Vivo</option>
        <option value="en-progreso">En progreso</option>
        <option value="pendiente">Pendiente</option>
        <option value="archivado">Archivado</option>
      </Select>
      <Input name="nivelMin" defaultValue={recurso?.nivelMin ?? ""} placeholder="Nivel mín." aria-label="Nivel mínimo" className="w-28" />

      <div className="flex w-full flex-wrap gap-3">
        {VISIBLE_PARA_OPTIONS.map((r) => (
          <label key={r.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <input type="checkbox" name={`vp_${r.id}`} defaultChecked={recurso?.visiblePara.includes(r.id)} />
            {r.label}
          </label>
        ))}
      </div>

      <Textarea name="contenido" defaultValue={recurso?.contenido ?? ""} placeholder="Contenido" rows={3} className="w-full" />

      {isAdmin && (
        <Textarea
          name="sensible"
          defaultValue={sensible ?? ""}
          placeholder="Contenido sensible (solo admin)"
          rows={3}
          className="w-full"
        />
      )}

      <div className="flex gap-2">
        <Button type="submit">Guardar</Button>
        <Button variant="secondary" href={cancelHref}>
          Cancelar
        </Button>
        {recurso && (
          <Button type="submit" variant="danger" formAction={deleteRecurso}>
            Eliminar
          </Button>
        )}
      </div>
    </form>
  );
}
