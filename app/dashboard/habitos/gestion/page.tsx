import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities } from "@/lib/db/schema/habitos";
import {
  Table,
  TableHead,
  TableRow,
  Button,
  EmptyState,
  Labeled,
  Input,
  Select,
} from "@/components/ui";
import {
  createActivity,
  updateActivity,
  archiveActivity,
  unarchiveActivity,
  deleteActivity,
} from "../actions";

const FREQ_OPTIONS = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "unica", label: "Única" },
  { value: "recurrente", label: "Recurrente" },
];
const COLS = "minmax(0,1fr) 140px 116px 80px 90px";

export default async function GestionHabitosPage({
  searchParams,
}: {
  searchParams: Promise<{ archivadas?: string; edit?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;
  const showArchived = sp.archivadas === "1";

  const list = await db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.isActive, !showArchived)))
    .orderBy(asc(activities.sortOrder), asc(activities.name));

  const editing = sp.edit ? list.find((a) => a.id === sp.edit) : undefined;
  const base = showArchived ? "/dashboard/habitos/gestion?archivadas=1" : "/dashboard/habitos/gestion";

  return (
    <div className="flex flex-col gap-4">
      <a
        href={showArchived ? "/dashboard/habitos/gestion" : "/dashboard/habitos/gestion?archivadas=1"}
        className="text-xs text-ink-muted hover:text-ink"
      >
        {showArchived ? "← Ver activos" : "Ver archivados"}
      </a>

      {list.length === 0 ? (
        <EmptyState icon="🔥">
          {showArchived ? "No has archivado ningún hábito." : "Todavía no tienes hábitos. Define el primero abajo — nombre, frecuencia y hora sugerida."}
        </EmptyState>
      ) : (
        <Table>
          <TableHead cols={COLS}>
            <span>Nombre</span>
            <span>Categoría</span>
            <span>Frecuencia</span>
            <span>Hora</span>
            <span className="text-right">Acciones</span>
          </TableHead>
          {list.map((a) => (
            <TableRow key={a.id} cols={COLS} highlighted={editing?.id === a.id}>
              <span className="truncate text-ink">{a.name}</span>
              <span className="text-meta text-ink-muted">{a.category ?? "—"}</span>
              <span className="text-meta text-ink-muted">{a.frequency}</span>
              <span className="text-meta tabular-nums text-ink-dim">{a.horaSugerida ?? "—"}</span>
              <span className="flex justify-end text-meta text-ink-dim">
                <a href={`${base}${base.includes("?") ? "&" : "?"}edit=${a.id}`} className="hover:text-ink">
                  Editar
                </a>
              </span>
            </TableRow>
          ))}
        </Table>
      )}

      {editing && (
        <form
          action={updateActivity}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-line bg-surface p-4"
        >
          <input type="hidden" name="id" value={editing.id} />
          <span className="w-full text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
            Editar · {editing.name}
          </span>
          <Labeled label="Nombre">
            <Input name="name" defaultValue={editing.name} required className="w-48" />
          </Labeled>
          <Labeled label="Categoría">
            <Input name="category" defaultValue={editing.category ?? ""} className="w-36" />
          </Labeled>
          <Labeled label="Frecuencia">
            <Select name="frequency" defaultValue={editing.frequency}>
              {FREQ_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Hora sugerida">
            <Input type="time" name="horaSugerida" defaultValue={editing.horaSugerida ?? ""} className="w-32" />
          </Labeled>
          <Button type="submit">Guardar</Button>
          {showArchived ? (
            <Button
              type="submit"
              variant="secondary"
              formAction={unarchiveActivity}
              className="border-success/40 text-success hover:border-success"
            >
              Restaurar
            </Button>
          ) : (
            <Button type="submit" variant="secondary" formAction={archiveActivity}>
              Archivar
            </Button>
          )}
          <Button type="submit" variant="danger" formAction={deleteActivity}>
            Eliminar
          </Button>
          <Button variant="secondary" href={base}>
            Cancelar
          </Button>
        </form>
      )}

      {!showArchived && (
        <form
          action={createActivity}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
        >
          <Labeled label="Nombre">
            <Input name="name" required className="w-48" />
          </Labeled>
          <Labeled label="Categoría">
            <Input name="category" className="w-36" />
          </Labeled>
          <Labeled label="Frecuencia">
            <Select name="frequency" defaultValue="diaria">
              {FREQ_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Hora sugerida">
            <Input type="time" name="horaSugerida" className="w-32" />
          </Labeled>
          <Button type="submit">+ Nuevo hábito</Button>
        </form>
      )}
    </div>
  );
}
