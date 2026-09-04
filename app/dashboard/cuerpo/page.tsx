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
                className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-line bg-surface p-4"
              >
                <input type="hidden" name="exerciseId" value={exercise.id} />
                <input type="hidden" name="date" value={date} />
                <div className="mr-auto">
                  <p className="font-medium text-ink">{exercise.name}</p>
                  <p className="text-xs text-ink-dim">
                    {TYPE_LABEL[exercise.type]}
                    {exercise.muscleGroup ? ` · ${exercise.muscleGroup}` : ""}
                  </p>
                </div>
                {exercise.type === "cardio" ? (
                  <>
                    <Labeled label="Duración (min)">
                      <Input type="number" step="0.1" name="durationMin" className="w-28" />
                    </Labeled>
                    <Labeled label="Distancia (km)">
                      <Input type="number" step="0.01" name="distanceKm" className="w-28" />
                    </Labeled>
                  </>
                ) : (
                  <>
                    <Labeled label="Reps">
                      <Input type="number" name="reps" className="w-20" />
                    </Labeled>
                    <Labeled label="Peso (kg)">
                      <Input type="number" step="0.1" name="weight" className="w-24" />
                    </Labeled>
                  </>
                )}
                <Button type="submit">Registrar</Button>
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
