import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { exercises, workoutLogs, bodyMetrics } from "@/lib/db/schema/cuerpo";
import {
  Card,
  Section,
  Table,
  TableHead,
  TableRow,
  Button,
  EmptyState,
  Labeled,
  Input,
  Select,
  ListCard,
} from "@/components/ui";
import { createExercise, logSet, upsertBodyMetrics } from "./actions";
import { todayISO } from "@/lib/date/bogota";

const TYPE_LABEL: Record<string, string> = {
  fuerza: "Fuerza",
  cardio: "Cardio",
  peso_corporal: "Peso corporal",
};
const LOG_COLS = "minmax(0,1fr) 64px 64px 88px 96px 96px";

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
    <div className="flex flex-col gap-8">
      <p className="text-xs text-ink-dim">{date}</p>

      <Section title="Registrado hoy">
        {todayLogs.length === 0 ? (
          <EmptyState icon="🏋️">Todavía no has registrado nada hoy. Anota una serie o un cardio desde la lista de ejercicios de abajo.</EmptyState>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHead cols={LOG_COLS}>
                  <span>Ejercicio</span>
                  <span>Serie</span>
                  <span>Reps</span>
                  <span>Peso kg</span>
                  <span>Dur. min</span>
                  <span>Dist. km</span>
                </TableHead>
                {todayLogs.map((log) => (
                  <TableRow key={log.id} cols={LOG_COLS}>
                    <span className="truncate text-ink">{log.exerciseName}</span>
                    <span className="text-meta text-ink-muted">{log.setNumber ?? "—"}</span>
                    <span className="text-meta text-ink-muted">{log.reps ?? "—"}</span>
                    <span className="text-meta text-ink-muted">{log.weight ?? "—"}</span>
                    <span className="text-meta text-ink-muted">{log.durationMin ?? "—"}</span>
                    <span className="text-meta text-ink-muted">{log.distanceKm ?? "—"}</span>
                  </TableRow>
                ))}
              </Table>
            </div>
            <div className="flex flex-col gap-1.5 md:hidden">
              {todayLogs.map((log) => (
                <ListCard key={log.id}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-ink">{log.exerciseName}</div>
                    <div className="mt-0.5 text-[11px] text-ink-dim">
                      {log.setNumber != null && `serie ${log.setNumber}`}
                      {log.reps != null && ` · ${log.reps} reps`}
                      {log.weight != null && ` · ${log.weight} kg`}
                      {log.durationMin != null && ` · ${log.durationMin} min`}
                      {log.distanceKm != null && ` · ${log.distanceKm} km`}
                    </div>
                  </div>
                </ListCard>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title="Ejercicios">
        {userExercises.length === 0 ? (
          <EmptyState icon="🏋️">Sin ejercicios. Agrega el primero abajo para empezar a registrar series.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {userExercises.map((exercise) => (
              <form
                key={exercise.id}
                action={logSet}
                className="flex flex-col gap-3 rounded-ui-lg border border-line bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end"
              >
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <input type="hidden" name="date" value={date} />
                <div className="sm:mr-auto">
                  <p className="font-medium text-ink">{exercise.name}</p>
                  <p className="text-xs text-ink-dim">
                    {TYPE_LABEL[exercise.type]}
                    {exercise.muscleGroup ? ` · ${exercise.muscleGroup}` : ""}
                  </p>
                </div>
                {exercise.type === "cardio" ? (
                  <div className="flex gap-3">
                    <Labeled label="Duración (min)" className="flex-1 sm:flex-none">
                      <Input type="number" step="0.1" name="durationMin" className="min-h-11 w-full sm:w-28" />
                    </Labeled>
                    <Labeled label="Distancia (km)" className="flex-1 sm:flex-none">
                      <Input type="number" step="0.01" name="distanceKm" className="min-h-11 w-full sm:w-28" />
                    </Labeled>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Labeled label="Reps" className="flex-1 sm:flex-none">
                      <Input type="number" name="reps" className="min-h-11 w-full sm:w-20" />
                    </Labeled>
                    <Labeled label="Peso (kg)" className="flex-1 sm:flex-none">
                      <Input type="number" step="0.1" name="weight" className="min-h-11 w-full sm:w-24" />
                    </Labeled>
                  </div>
                )}
                <Button type="submit" className="min-h-11 w-full sm:w-auto">
                  Registrar
                </Button>
              </form>
            ))}
          </div>
        )}

        <form
          action={createExercise}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
        >
          <Labeled label="Nombre">
            <Input name="name" required className="w-44" />
          </Labeled>
          <Labeled label="Tipo">
            <Select name="type" required>
              <option value="fuerza">Fuerza</option>
              <option value="cardio">Cardio</option>
              <option value="peso_corporal">Peso corporal</option>
            </Select>
          </Labeled>
          <Labeled label="Grupo muscular">
            <Input name="muscleGroup" className="w-40" />
          </Labeled>
          <Button type="submit" variant="secondary">
            + Nuevo ejercicio
          </Button>
        </form>
      </Section>

      <Section title="Métricas de hoy">
        <form
          action={upsertBodyMetrics}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-line bg-surface p-4"
        >
          <input type="hidden" name="date" value={date} />
          <Labeled label="Peso (kg)">
            <Input type="number" step="0.1" name="weightKg" defaultValue={todayMetrics?.weightKg ?? ""} className="w-28" />
          </Labeled>
          <Labeled label="Horas de sueño">
            <Input type="number" step="0.1" name="sleepHours" defaultValue={todayMetrics?.sleepHours ?? ""} className="w-28" />
          </Labeled>
          <Labeled label="% Grasa corporal">
            <Input type="number" step="0.1" name="bodyFatPct" defaultValue={todayMetrics?.bodyFatPct ?? ""} className="w-28" />
          </Labeled>
          <Button type="submit">Guardar</Button>
        </form>
      </Section>
    </div>
  );
}
