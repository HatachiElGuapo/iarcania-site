import { and, asc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { meals, nutritionTargets } from "@/lib/db/schema/nutricion";
import { Field } from "@/components/ui/field";
import { saveMeal, deleteMeal, saveTargets } from "./actions";
import { todayISO } from "@/lib/date/bogota";

type Meal = InferSelectModel<typeof meals>;
type MealTypeInfo = { id: string; label: string; icon: string };

const MEAL_TYPES: MealTypeInfo[] = [
  { id: "desayuno", label: "Desayuno", icon: "☕" },
  { id: "almuerzo", label: "Almuerzo", icon: "🍽️" },
  { id: "cena", label: "Cena", icon: "🌙" },
];

const SNACK_TYPE: MealTypeInfo = { id: "snack", label: "Snack", icon: "🍎" };

const DEFAULT_TARGETS = {
  kcalTarget: 2000,
  protTarget: 150,
  carbTarget: 200,
  fatTarget: 65,
};


export default async function NutricionPage() {
  const session = await auth();
  const userId = session!.user.id;
  const date = todayISO();

  const [dayMeals, [targets]] = await Promise.all([
    db
      .select()
      .from(meals)
      .where(and(eq(meals.userId, userId), eq(meals.date, date)))
      .orderBy(asc(meals.createdAt)),
    db
      .select()
      .from(nutritionTargets)
      .where(eq(nutritionTargets.userId, userId))
      .limit(1),
  ]);

  const targetValues = targets ?? DEFAULT_TARGETS;

  const totals = dayMeals.reduce(
    (acc, m) => {
      acc.cal += m.calories ?? 0;
      acc.prot += m.proteinG ?? 0;
      acc.carb += m.carbsG ?? 0;
      acc.fat += m.fatG ?? 0;
      return acc;
    },
    { cal: 0, prot: 0, carb: 0, fat: 0 },
  );

  const snacks = dayMeals.filter((m) => m.mealType === "snack");

  return (
    <div className="space-y-10 p-8">
      <div>
        <h1 className="font-display text-2xl text-text-primary">
          Nutrición
        </h1>
        <p className="mt-1 text-sm text-text-muted">{date}</p>
      </div>

      <MacroSummary totals={totals} targets={targetValues} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gold">
          Comidas
        </h2>
        {MEAL_TYPES.map((type) => (
          <MealForm
            key={type.id}
            type={type}
            date={date}
            meal={dayMeals.find((m) => m.mealType === type.id)}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gold">
          Snacks
        </h2>
        {snacks.length === 0 && (
          <p className="text-sm text-text-muted">
            Todavía no hay snacks hoy.
          </p>
        )}
        {snacks.map((meal) => (
          <MealForm key={meal.id} type={SNACK_TYPE} date={date} meal={meal} />
        ))}
        <MealForm type={SNACK_TYPE} date={date} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          Metas diarias
        </h2>
        <form
          action={saveTargets}
          className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-bg-card p-4"
        >
          <Field label="Calorías (kcal)">
            <input
              type="number"
              name="kcalTarget"
              defaultValue={targetValues.kcalTarget}
              className="input"
            />
          </Field>
          <Field label="Proteína (g)">
            <input
              type="number"
              step="0.1"
              name="protTarget"
              defaultValue={targetValues.protTarget}
              className="input"
            />
          </Field>
          <Field label="Carbs (g)">
            <input
              type="number"
              step="0.1"
              name="carbTarget"
              defaultValue={targetValues.carbTarget}
              className="input"
            />
          </Field>
          <Field label="Grasa (g)">
            <input
              type="number"
              step="0.1"
              name="fatTarget"
              defaultValue={targetValues.fatTarget}
              className="input"
            />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
          >
            Guardar metas
          </button>
        </form>
      </section>
    </div>
  );
}

function MacroSummary({
  totals,
  targets,
}: {
  totals: { cal: number; prot: number; carb: number; fat: number };
  targets: {
    kcalTarget: number;
    protTarget: number;
    carbTarget: number;
    fatTarget: number;
  };
}) {
  const boxes = [
    {
      label: "Calorías",
      value: Math.round(totals.cal),
      target: targets.kcalTarget,
      unit: "kcal",
      color: "#f0d060",
    },
    {
      label: "Proteína",
      value: Math.round(totals.prot),
      target: targets.protTarget,
      unit: "g",
      color: "#5DCAA5",
    },
    {
      label: "Carbs",
      value: Math.round(totals.carb),
      target: targets.carbTarget,
      unit: "g",
      color: "#378ADD",
    },
    {
      label: "Grasa",
      value: Math.round(totals.fat),
      target: targets.fatTarget,
      unit: "g",
      color: "#c084fc",
    },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {boxes.map((b) => {
        const pct = b.target
          ? Math.min(100, Math.round((b.value / b.target) * 100))
          : 0;
        return (
          <div
            key={b.label}
            className="min-w-[140px] flex-1 rounded-md border border-border bg-bg-card px-4 py-3"
          >
            <div className="text-lg font-bold text-text-primary">
              {b.value}
              <span className="ml-1 text-xs text-text-muted">{b.unit}</span>
            </div>
            <div className="text-xs text-text-muted">
              {b.label} · meta {b.target}
              {b.unit}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: b.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MealForm({
  type,
  date,
  meal,
}: {
  type: MealTypeInfo;
  date: string;
  meal?: Meal;
}) {
  return (
    <form
      action={saveMeal}
      className="space-y-2 rounded-md border border-border bg-bg-card p-4"
    >
      <input type="hidden" name="id" value={meal?.id ?? ""} />
      <input type="hidden" name="mealType" value={type.id} />
      <input type="hidden" name="date" value={date} />

      <div className="flex items-center gap-2">
        <span>{type.icon}</span>
        <span className="text-sm font-semibold text-text-primary">
          {type.label}
        </span>
        <select
          name="location"
          defaultValue={meal?.location ?? "casa"}
          className="input ml-auto w-28"
        >
          <option value="casa">🏠 Casa</option>
          <option value="fuera">🏪 Fuera</option>
        </select>
      </div>

      <input
        type="text"
        name="description"
        placeholder="¿Qué comiste?"
        defaultValue={meal?.description ?? ""}
        className="input w-full"
      />

      <div className="grid grid-cols-4 gap-2">
        <Field label="kcal">
          <input
            type="number"
            name="calories"
            defaultValue={meal?.calories ?? ""}
            className="input"
          />
        </Field>
        <Field label="proteína g">
          <input
            type="number"
            step="0.1"
            name="proteinG"
            defaultValue={meal?.proteinG ?? ""}
            className="input"
          />
        </Field>
        <Field label="carbs g">
          <input
            type="number"
            step="0.1"
            name="carbsG"
            defaultValue={meal?.carbsG ?? ""}
            className="input"
          />
        </Field>
        <Field label="grasa g">
          <input
            type="number"
            step="0.1"
            name="fatG"
            defaultValue={meal?.fatG ?? ""}
            className="input"
          />
        </Field>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
        >
          Guardar
        </button>
        {meal && (
          <button
            type="submit"
            formAction={deleteMeal}
            className="rounded-sm border border-border px-3 py-1.5 text-sm text-red-400 hover:border-red-400"
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}
