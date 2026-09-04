import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { ideas } from "@/lib/db/schema/ideas";
import { CATS } from "@/lib/constants/cats";
import {
  PageHeader,
  Table,
  TableHead,
  TableRow,
  Badge,
  CategoryDot,
  EmptyState,
  QuickCapture,
  Select,
  Input,
  Pagination,
  catInfo,
  cx,
} from "@/components/ui";
import { createIdea, deleteIdea, createTaskFromIdea } from "./actions";

// Arquetipo 1 + listas largas (5d): búsqueda y página en searchParams, tabla
// con encabezado, "sin resultados" que nombra el filtro. Reutiliza las
// Server Actions de ./actions.
const PAGE_SIZE = 50;
const STATUS_TABS = [
  { id: "todas", label: "Todas" },
  { id: "nueva", label: "Nuevas" },
  { id: "procesada", label: "Procesadas" },
];
const STATUS_TONE = { nueva: "info", procesada: "success" } as const;
const COLS = "minmax(0,1fr) 128px 104px 92px 132px";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; cat?: string; page?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const estado = sp.estado === "nueva" || sp.estado === "procesada" ? sp.estado : "";
  const cat = sp.cat && CATS[sp.cat] ? sp.cat : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const search: SQL | undefined = q
    ? or(ilike(ideas.rawContent, `%${q}%`), ilike(ideas.processedContent, `%${q}%`))
    : undefined;

  const noStatus = and(
    eq(ideas.userId, userId),
    ...(cat ? [eq(ideas.category, cat)] : []),
    ...(search ? [search] : []),
  );
  const where = and(noStatus, ...(estado ? [eq(ideas.status, estado)] : []));

  const [tabRows, totalRows, rows] = await Promise.all([
    db.select({ status: ideas.status, n: count() }).from(ideas).where(noStatus).groupBy(ideas.status),
    db.select({ total: count() }).from(ideas).where(where),
    db
      .select()
      .from(ideas)
      .where(where)
      .orderBy(desc(ideas.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = totalRows[0]?.total ?? 0;
  const tabCounts: Record<string, number> = { todas: 0, nueva: 0, procesada: 0 };
  for (const r of tabRows) {
    tabCounts[r.status] = r.n;
    tabCounts.todas += r.n;
  }

  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado) params.set("estado", estado);
    if (cat) params.set("cat", cat);
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/dashboard/ideas?${s}` : "/dashboard/ideas";
  };

  const filtering = !!(q || estado || cat);

  return (
    <div className="p-8">
      <PageHeader
        icon="💡"
        title="Ideas"
        subtitle={`${tabCounts.todas} capturada${tabCounts.todas !== 1 ? "s" : ""} · ${tabCounts.nueva} sin procesar`}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3.5">
        {STATUS_TABS.map((t) => {
          const active = (estado || "todas") === t.id;
          return (
            <a
              key={t.id}
              href={qs({ estado: t.id === "todas" ? undefined : t.id, page: undefined })}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-ui border px-3 py-1.5 text-xs transition-colors duration-120",
                active
                  ? "border-line-strong bg-surface-2 text-ink"
                  : "border-line bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
              <span className={active ? "text-accent-warm" : "text-ink-dim"}>{tabCounts[t.id] ?? 0}</span>
            </a>
          );
        })}
        <form method="get" action="/dashboard/ideas" className="ml-auto flex items-center gap-2">
          {estado && <input type="hidden" name="estado" value={estado} />}
          {cat && <input type="hidden" name="cat" value={cat} />}
          <Input type="search" name="q" defaultValue={q} placeholder="Buscar ideas…" className="w-52" />
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Object.keys(CATS).map((key) => {
          const c = catInfo(key);
          const active = cat === key;
          return (
            <a
              key={key}
              href={qs({ cat: active ? undefined : key, page: undefined })}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors duration-120"
              style={{
                borderColor: active ? c.color : `${c.color}2e`,
                background: active ? `${c.color}24` : `${c.color}12`,
                color: c.color,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: c.color }} />
              {c.label}
            </a>
          );
        })}
        {(cat || q) && (
          <a href="/dashboard/ideas" className="text-[11px] text-ink-dim hover:text-ink">
            limpiar
          </a>
        )}
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          filtering ? (
            <EmptyState icon="⌕">
              Ninguna idea coincide con {q ? <>«{q}»</> : "los filtros activos"}.{" "}
              <a href="/dashboard/ideas" className="text-ink underline">
                Quitar filtros
              </a>
            </EmptyState>
          ) : (
            <EmptyState icon="💡">
              Todavía no capturaste ninguna idea. Escribe la primera en la barra de abajo.
            </EmptyState>
          )
        ) : (
          <>
            <Table>
              <TableHead cols={COLS}>
                <span>Idea</span>
                <span>Categoría</span>
                <span>Estado</span>
                <span>Capturada</span>
                <span className="text-right">Acciones</span>
              </TableHead>
              {rows.map((idea) => {
                const c = idea.category ? catInfo(idea.category) : null;
                return (
                  <TableRow key={idea.id} cols={COLS} category={idea.category}>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-ink">{idea.rawContent}</span>
                      {idea.processedContent && (
                        <span className="truncate text-[10.5px] text-ink-dim">{idea.processedContent}</span>
                      )}
                    </span>
                    {c ? (
                      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: c.color }}>
                        <CategoryDot category={idea.category} />
                        {c.label}
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-dim">—</span>
                    )}
                    <span>
                      <Badge tone={STATUS_TONE[idea.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {idea.status}
                      </Badge>
                    </span>
                    <span className="text-[11px] tabular-nums text-ink-dim">
                      {idea.createdAt.toLocaleDateString("es-CO", {
                        timeZone: "America/Bogota",
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="flex justify-end gap-2.5 text-[11px] text-ink-dim">
                      <form action={createTaskFromIdea}>
                        <input type="hidden" name="id" value={idea.id} />
                        <button type="submit" className="hover:text-ink">
                          → Tarea
                        </button>
                      </form>
                      <form action={deleteIdea}>
                        <input type="hidden" name="id" value={idea.id} />
                        <button type="submit" className="hover:text-danger">
                          Eliminar
                        </button>
                      </form>
                    </span>
                  </TableRow>
                );
              })}
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => qs({ page: String(p) })} />
          </>
        )}
      </div>

      <div className="mt-4">
        <QuickCapture
          action={createIdea}
          name="rawContent"
          placeholder="Captura una idea…"
          extras={
            <Select name="category" defaultValue="" aria-label="Categoría">
              <option value="">Sin categoría</option>
              {Object.entries(CATS).map(([key, c]) => (
                <option key={key} value={key}>
                  {c.label}
                </option>
              ))}
            </Select>
          }
        />
      </div>
    </div>
  );
}
