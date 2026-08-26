import { and, asc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activities } from "@/lib/db/schema/habitos";
import { Field } from "@/components/ui/field";
import {
  createActivity,
  updateActivity,
  archiveActivity,
  unarchiveActivity,
  deleteActivity,
} from "../actions";

type Activity = InferSelectModel<typeof activities>;

const FREQ_OPTIONS = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "unica", label: "Única" },
  { value: "recurrente", label: "Recurrente" },
];

export default async function GestionHabitosPage({
  searchParams,
}: {
  searchParams: Promise<{ archivadas?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { archivadas } = await searchParams;
  const showArchived = archivadas === "1";

  const list = await db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.isActive, !showArchived)))
    .orderBy(asc(activities.sortOrder), asc(activities.name));

  return (
    <div className="space-y-6">
      <a
        href={showArchived ? "/dashboard/habitos/gestion" : "/dashboard/habitos/gestion?archivadas=1"}
        className="text-xs text-text-muted hover:text-text-primary"
      >
        {showArchived ? "← Ver activos" : "Ver archivados"}
      </a>

      {list.length === 0 ? (
        <p className="text-sm text-text-muted">
          {showArchived ? "No hay hábitos archivados." : "No hay hábitos todavía."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="text-text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 font-medium">Frecuencia</th>
                <th className="px-3 py-2 font-medium">Hora</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} showArchived={showArchived} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!showArchived && (
        <form
          action={createActivity}
          className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Nombre">
            <input type="text" name="name" required className="input" />
          </Field>
          <Field label="Categoría">
            <input type="text" name="category" className="input" />
          </Field>
          <Field label="Frecuencia">
            <select name="frequency" defaultValue="diaria" className="input">
              {FREQ_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hora sugerida">
            <input type="time" name="horaSugerida" className="input" />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            + Nuevo hábito
          </button>
        </form>
      )}
    </div>
  );
}

function ActivityRow({
  activity,
  showArchived,
}: {
  activity: Activity;
  showArchived: boolean;
}) {
  return (
    <tr className="border-b border-border align-top last:border-0">
      <td className="px-3 py-2 text-text-primary">{activity.name}</td>
      <td className="px-3 py-2 text-text-muted">{activity.category ?? "—"}</td>
      <td className="px-3 py-2 text-text-muted">{activity.frequency}</td>
      <td className="px-3 py-2 text-text-muted">{activity.horaSugerida ?? "—"}</td>
      <td className="px-3 py-2">
        <details>
          <summary className="cursor-pointer text-xs text-text-muted">Editar</summary>
          <form
            action={updateActivity}
            className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
          >
            <input type="hidden" name="id" value={activity.id} />
            <Field label="Nombre">
              <input type="text" name="name" defaultValue={activity.name} required className="input" />
            </Field>
            <Field label="Categoría">
              <input type="text" name="category" defaultValue={activity.category ?? ""} className="input" />
            </Field>
            <Field label="Frecuencia">
              <select name="frequency" defaultValue={activity.frequency} className="input">
                {FREQ_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hora sugerida">
              <input
                type="time"
                name="horaSugerida"
                defaultValue={activity.horaSugerida ?? ""}
                className="input"
              />
            </Field>
            <button
              type="submit"
              className="rounded-sm bg-gradient-cta px-3 py-1.5 text-xs font-semibold text-white shadow-glow-purple"
            >
              Guardar
            </button>
            {showArchived ? (
              <button
                type="submit"
                formAction={unarchiveActivity}
                className="rounded-sm border border-green-500/30 px-3 py-1.5 text-xs text-green-400 hover:border-green-400"
              >
                Restaurar
              </button>
            ) : (
              <button
                type="submit"
                formAction={archiveActivity}
                className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
              >
                Archivar
              </button>
            )}
            <button
              type="submit"
              formAction={deleteActivity}
              className="rounded-sm border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:border-red-400"
            >
              Eliminar
            </button>
          </form>
        </details>
      </td>
    </tr>
  );
}
