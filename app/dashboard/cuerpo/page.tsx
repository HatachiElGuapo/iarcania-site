import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { exercises, workoutLogs, bodyMetrics } from "@/lib/db/schema/cuerpo";
import { Field } from "@/components/ui/field";
import { createExercise, logSet, upsertBodyMetrics } from "./actions";
import { todayISO } from "@/lib/date/bogota";

const TYPE_LABEL: Record<string, string> = {
  fuerza: "Fuerza",
  cardio: "Cardio",
  peso_corporal: "Peso corporal",
};

export default async function CuerpoPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();

  const [userExercises, todayLogs, [todayMetrics]] = await Promise.all([
    db
      .select()
      .from(exercises)
      .where(and(eq(exercises.userId, userId), eq(exercises.isActive, true)))
      .orderBy(asc(exercises.sortOrder), asc(exercises.name)),
    db
      .select({
        id: workoutLogs.id,
        exerciseName: exercises.name,
        setNumber: workoutLogs.setNumber,
        reps: workoutLogs.reps,
        weight: workoutLogs.weight,
        durationMin: workoutLogs.durationMin,
        distanceKm: workoutLogs.distanceKm,
      })
      .from(workoutLogs)
      .innerJoin(exercises, eq(workoutLogs.exerciseId, exercises.id))
      .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.date, date))),
    db
      .select()
      .from(bodyMetrics)
      .where(and(eq(bodyMetrics.userId, userId), eq(bodyMetrics.date, date)))
      .limit(1),
  ]);

  return (
    <div className="space-y-10 p-8">
      <div>
        <h1 className="font-display text-2xl text-text-primary">Cuerpo</h1>
        <p className="mt-1 text-sm text-text-muted">{date}</p>
      </div>

      {/* Registrado hoy */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Registrado hoy
        </h2>
        {todayLogs.length === 0 ? (
          <p className="text-sm text-text-muted">
            Todavía no hay series ni cardio registrado hoy.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="text-text-muted">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium">Ejercicio</th>
                  <th className="px-3 py-2 font-medium">Serie</th>
                  <th className="px-3 py-2 font-medium">Reps</th>
                  <th className="px-3 py-2 font-medium">Peso (kg)</th>
                  <th className="px-3 py-2 font-medium">Duración (min)</th>
                  <th className="px-3 py-2 font-medium">Distancia (km)</th>
                </tr>
              </thead>
              <tbody>
                {todayLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-text-primary">
                      {log.exerciseName}
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {log.setNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {log.reps ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {log.weight ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {log.durationMin ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-text-muted">
                      {log.distanceKm ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ejercicios + registrar serie */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Ejercicios
        </h2>

        {userExercises.length === 0 ? (
          <p className="mb-4 text-sm text-text-muted">
            Todavía no tienes ejercicios. Agrega el primero abajo.
          </p>
        ) : (
          <div className="space-y-3">
            {userExercises.map((exercise) => (
              <form
                key={exercise.id}
                action={logSet}
                className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-bg-card p-4"
              >
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <input type="hidden" name="date" value={date} />

                <div className="mr-auto">
                  <p className="font-medium text-text-primary">
                    {exercise.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {TYPE_LABEL[exercise.type]}
                    {exercise.muscleGroup ? ` · ${exercise.muscleGroup}` : ""}
                  </p>
                </div>

                {exercise.type === "cardio" ? (
                  <>
                    <Field label="Duración (min)">
                      <input
                        type="number"
                        step="0.1"
                        name="durationMin"
                        className="input"
                      />
                    </Field>
                    <Field label="Distancia (km)">
                      <input
                        type="number"
                        step="0.01"
                        name="distanceKm"
                        className="input"
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Reps">
                      <input type="number" name="reps" className="input" />
                    </Field>
                    <Field label="Peso (kg)">
                      <input
                        type="number"
                        step="0.1"
                        name="weight"
                        className="input"
                      />
                    </Field>
                  </>
                )}

                <button
                  type="submit"
                  className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
                >
                  Registrar
                </button>
              </form>
            ))}
          </div>
        )}

        <form
          action={createExercise}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
        >
          <Field label="Nombre">
            <input type="text" name="name" required className="input" />
          </Field>
          <Field label="Tipo">
            <select name="type" required className="input">
              <option value="fuerza">Fuerza</option>
              <option value="cardio">Cardio</option>
              <option value="peso_corporal">Peso corporal</option>
            </select>
          </Field>
          <Field label="Grupo muscular">
            <input type="text" name="muscleGroup" className="input" />
          </Field>
          <button
            type="submit"
            className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
          >
            + Nuevo ejercicio
          </button>
        </form>
      </section>

      {/* Métricas corporales de hoy */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Métricas de hoy
        </h2>
        <form
          action={upsertBodyMetrics}
          className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-bg-card p-4"
        >
          <input type="hidden" name="date" value={date} />
          <Field label="Peso (kg)">
            <input
              type="number"
              step="0.1"
              name="weightKg"
              defaultValue={todayMetrics?.weightKg ?? ""}
              className="input"
            />
          </Field>
          <Field label="Horas de sueño">
            <input
              type="number"
              step="0.1"
              name="sleepHours"
              defaultValue={todayMetrics?.sleepHours ?? ""}
              className="input"
            />
          </Field>
          <Field label="% Grasa corporal">
            <input
              type="number"
              step="0.1"
              name="bodyFatPct"
              defaultValue={todayMetrics?.bodyFatPct ?? ""}
              className="input"
            />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            Guardar
          </button>
        </form>
      </section>
    </div>
  );
}
