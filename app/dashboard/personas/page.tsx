import { and, asc, count, eq, ilike, or, type InferSelectModel, type SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { people, importantDates } from "@/lib/db/schema/personas";
import {
  PageHeader,
  Card,
  Table,
  TableHead,
  TableRow,
  Button,
  EmptyState,
  NoResults,
  QuickCapture,
  Input,
  Select,
  Pagination,
  Section,
  cx,
} from "@/components/ui";
import {
  createPersona,
  updatePersona,
  deletePersona,
  createImportantDate,
  deleteImportantDate,
} from "./actions";
import { todayISO, BOGOTA_OFFSET } from "@/lib/date/bogota";

type ImportantDate = InferSelectModel<typeof importantDates>;

const REL_LABELS: Record<string, string> = {
  yo: "🪞 Yo",
  amigo: "👤 Amigo/a",
  familia: "👨‍👩‍👧 Familia",
  conocido: "🤝 Conocido/a",
  trabajo: "💼 Trabajo",
};

const FECHA_TIPOS: Record<string, string> = {
  cumpleanos: "🎂 Cumpleaños",
  especial: "⭐ Especial",
  aniversario: "💜 Aniversario",
  cita: "🏥 Cita",
  pago: "💰 Pago",
  evento: "🎉 Evento",
};

const PAGE_SIZE = 50;
const COLS = "minmax(0,1fr) 150px 116px 120px";

function daysUntil(day: number, month: number) {
  const [y] = todayISO().split("-").map(Number);
  const today = new Date(`${todayISO()}T00:00:00${BOGOTA_OFFSET}`);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  let next = new Date(`${y}-${mm}-${dd}T00:00:00${BOGOTA_OFFSET}`);
  if (next < today) next = new Date(`${y + 1}-${mm}-${dd}T00:00:00${BOGOTA_OFFSET}`);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function nearLabel(days: number) {
  return days === 0 ? "¡Hoy!" : days === 1 ? "Mañana" : `${days} días`;
}

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rel?: string; page?: string; edit?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const rel = sp.rel && REL_LABELS[sp.rel] ? sp.rel : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const search: SQL | undefined = q
    ? or(ilike(people.name, `%${q}%`), ilike(people.notes, `%${q}%`))
    : undefined;
  const where = and(
    eq(people.userId, userId),
    ...(rel ? [eq(people.relationship, rel)] : []),
    ...(search ? [search] : []),
  );

  const [totalRows, rows, allDates] = await Promise.all([
    db.select({ total: count() }).from(people).where(where),
    db
      .select()
      .from(people)
      .where(where)
      .orderBy(asc(people.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select().from(importantDates).where(eq(importantDates.userId, userId)),
  ]);

  const total = totalRows[0]?.total ?? 0;
  const birthdayByPersonId = new Map(
    allDates.filter((d) => d.personId).map((d) => [d.personId as string, d]),
  );
  const looseDates = allDates
    .filter((d) => !d.personId)
    .sort((a, b) => daysUntil(a.day, a.month) - daysUntil(b.day, b.month));

  const editing = sp.edit ? rows.find((p) => p.id === sp.edit) : undefined;
  const editingBday = editing ? birthdayByPersonId.get(editing.id) : undefined;

  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (rel) params.set("rel", rel);
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/dashboard/personas?${s}` : "/dashboard/personas";
  };

  const filtering = !!(q || rel);

  return (
    <div className="p-8">
      <PageHeader
        icon="👥"
        title="Personas"
        subtitle={`${total} registro${total !== 1 ? "s" : ""}${q || rel ? " (filtrado)" : ""}`}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3.5">
        {Object.entries(REL_LABELS).map(([key, label]) => {
          const active = rel === key;
          return (
            <a
              key={key}
              href={qs({ rel: active ? undefined : key, page: undefined })}
              className={cx(
                "rounded-ui border px-3 py-1.5 text-xs transition-colors duration-120",
                active
                  ? "border-line-strong bg-surface-2 text-ink"
                  : "border-line bg-surface text-ink-muted hover:text-ink",
              )}
            >
              {label}
            </a>
          );
        })}
        <form method="get" action="/dashboard/personas" className="ml-auto flex items-center gap-2">
          {rel && <input type="hidden" name="rel" value={rel} />}
          <Input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre…" className="w-56" />
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </form>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          filtering ? (
            <NoResults
              query={q || undefined}
              context={rel ? <>en la relación «{REL_LABELS[rel]}»</> : undefined}
              clearHref="/dashboard/personas"
            />
          ) : (
            <EmptyState icon="👥">
              Tu gente: familia, amigos, contactos de trabajo. Todavía no has agregado a nadie —
              crea la primera persona en la barra de abajo para tener sus fechas a mano.
            </EmptyState>
          )
        ) : (
          <>
            <Table>
              <TableHead cols={COLS}>
                <span>Persona</span>
                <span>Relación</span>
                <span>Cumpleaños</span>
                <span className="text-right">Acciones</span>
              </TableHead>
              {rows.map((p) => {
                const bday = birthdayByPersonId.get(p.id);
                const days = bday ? daysUntil(bday.day, bday.month) : null;
                return (
                  <TableRow key={p.id} cols={COLS} highlighted={editing?.id === p.id}>
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-ink">{p.name}</span>
                        {days !== null && days <= 7 && (
                          <span className="shrink-0 rounded-full bg-accent-warm/15 px-1.5 text-[10px] text-accent-warm">
                            {nearLabel(days)}
                          </span>
                        )}
                      </span>
                      {p.notes && <span className="truncate text-[10.5px] text-ink-dim">{p.notes}</span>}
                    </span>
                    <span className="text-meta text-ink-muted">
                      {REL_LABELS[p.relationship] ?? p.relationship}
                    </span>
                    <span className="text-meta tabular-nums text-ink-dim">
                      {bday ? `${bday.day}/${bday.month}` : "—"}
                    </span>
                    <span className="flex justify-end gap-2.5 text-meta text-ink-dim">
                      <a href={qs({ edit: p.id })} className="hover:text-ink">
                        Editar
                      </a>
                      <form action={deletePersona}>
                        <input type="hidden" name="id" value={p.id} />
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

      {editing && (
        <form
          action={updatePersona}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-ui-lg border border-line bg-surface p-4"
        >
          <input type="hidden" name="id" value={editing.id} />
          <span className="w-full text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
            Editar · {editing.name}
          </span>
          <Input name="name" defaultValue={editing.name} required aria-label="Nombre" className="w-48" />
          <Select name="relationship" defaultValue={editing.relationship} aria-label="Relación">
            {Object.entries(REL_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            name="bdayDay"
            min={1}
            max={31}
            defaultValue={editingBday?.day ?? ""}
            placeholder="Día"
            aria-label="Cumpleaños · día"
            className="w-20"
          />
          <Input
            type="number"
            name="bdayMonth"
            min={1}
            max={12}
            defaultValue={editingBday?.month ?? ""}
            placeholder="Mes"
            aria-label="Cumpleaños · mes"
            className="w-20"
          />
          <Input
            name="notes"
            defaultValue={editing.notes ?? ""}
            placeholder="Notas"
            aria-label="Notas"
            className="w-48"
          />
          <Button type="submit">Guardar</Button>
          <Button variant="secondary" href={qs({ edit: undefined })}>
            Cancelar
          </Button>
        </form>
      )}

      <div className="mt-4">
        <QuickCapture
          action={createPersona}
          name="name"
          placeholder="Nombre de la persona…"
          submitLabel="+ Persona"
          extras={
            <>
              <Select name="relationship" defaultValue="amigo" aria-label="Relación">
                {Object.entries(REL_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input type="number" name="bdayDay" min={1} max={31} placeholder="Día" aria-label="Cumpleaños · día" className="w-16" />
              <Input type="number" name="bdayMonth" min={1} max={12} placeholder="Mes" aria-label="Cumpleaños · mes" className="w-16" />
              <Input name="notes" placeholder="Notas" aria-label="Notas" className="w-40" />
            </>
          }
        />
      </div>

      <Section title="Fechas importantes" className="mt-8">
        <Card flush>
          {looseDates.length === 0 ? (
            <p className="px-3.5 py-4 text-meta text-ink-muted">
              Cumpleaños, pagos y aniversarios que no cuelgan de una persona. Todavía no has
              guardado ninguno — agrega el primero abajo.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {looseDates.map((d) => {
                const days = daysUntil(d.day, d.month);
                return (
                  <div key={d.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                    <span>{FECHA_TIPOS[d.type] ?? d.type}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
                    <span className="shrink-0 text-meta tabular-nums text-ink-dim">
                      {d.day}/{d.month}
                      {days <= 7 ? ` · ${nearLabel(days)}` : ""}
                    </span>
                    <form action={deleteImportantDate}>
                      <input type="hidden" name="id" value={d.id} />
                      <button type="submit" className="text-meta text-ink-dim hover:text-danger">
                        Eliminar
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <div className="mt-3">
          <QuickCapture
            action={createImportantDate}
            name="name"
            placeholder="Nombre de la fecha…"
            submitLabel="+ Fecha"
            extras={
              <>
                <Select name="type" defaultValue="evento" aria-label="Tipo">
                  {Object.entries(FECHA_TIPOS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Input type="number" name="day" min={1} max={31} required placeholder="Día" aria-label="Día" className="w-16" />
                <Input type="number" name="month" min={1} max={12} required placeholder="Mes" aria-label="Mes" className="w-16" />
              </>
            }
          />
        </div>
      </Section>
    </div>
  );
}
