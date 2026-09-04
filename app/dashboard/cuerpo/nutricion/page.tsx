import { and, asc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { meals, nutritionTargets } from "@/lib/db/schema/nutricion";
import { MetricCard, Button, Labeled, Input, Select, cx } from "@/components/ui";
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
const DEFAULT_TARGETS = { kcalTarget: 2000, protTarget: 150, carbTarget: 200, fatTarget: 65 };

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
    db.select().from(nutritionTargets).where(eq(nutritionTargets.userId, userId)).limit(1),
  ]);

  const t = targets ?? DEFAULT_TARGETS;
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

  const macros: { label: string; value: number; target: number; unit: string; tone: "warm" | "success" | "accent" | "primary" }[] = [
    { label: "Calorías", value: Math.round(totals.cal), target: t.kcalTarget, unit: "kcal", tone: "warm" },
    { label: "Proteína", value: Math.round(totals.prot), target: t.protTarget, unit: "g", tone: "success" },
    { label: "Carbs", value: Math.round(totals.carb), target: t.carbTarget, unit: "g", tone: "accent" },
    { label: "Grasa", value: Math.round(totals.fat), target: t.fatTarget, unit: "g", tone: "primary" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <p className="text-xs text-ink-dim">{date}</p>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {macros.map((m) => (
          <MetricCard
            key={m.label}
            value={m.value}
            sub={m.unit}
            label={`${m.label} · meta ${m.target}${m.unit}`}
            tone={m.tone}
            pct={m.target ? (m.value / m.target) * 100 : 0}
          />
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Comidas</h2>
        {MEAL_TYPES.map((type) => (
          <MealForm key={type.id} type={type} date={date} meal={dayMeals.find((m) => m.mealType === type.id)} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Snacks</h2>
        {snacks.length === 0 && <p className="text-sm text-ink-muted">Todavía no hay snacks hoy.</p>}
        {snacks.map((meal) => (
          <MealForm key={meal.id} type={SNACK_TYPE} date={date} meal={meal} />
        ))}
        <MealForm type={SNACK_TYPE} date={date} />
      </section>

      <section>
        <h2 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Metas diarias
        </h2>
        <form
          action={saveTargets}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-line bg-surface p-4"
        >
          <Labeled label="Calorías (kcal)">
            <Input type="number" name="kcalTarget" defaultValue={t.kcalTarget} className="w-28" />
          </Labeled>
          <Labeled label="Proteína (g)">
            <Input type="number" step="0.1" name="protTarget" defaultValue={t.protTarget} className="w-28" />
          </Labeled>
          <Labeled label="Carbs (g)">
            <Input type="number" step="0.1" name="carbTarget" defaultValue={t.carbTarget} className="w-28" />
          </Labeled>
          <Labeled label="Grasa (g)">
            <Input type="number" step="0.1" name="fatTarget" defaultValue={t.fatTarget} className="w-28" />
          </Labeled>
          <Button type="submit">Guardar metas</Button>
        </form>
      </section>
    </div>
  );
}

function MealForm({ type, date, meal }: { type: MealTypeInfo; date: string; meal?: Meal }) {
  return (
    <form action={saveMeal} className="flex flex-col gap-2 rounded-ui-lg border border-line bg-surface p-4">
      <input type="hidden" name="id" value={meal?.id ?? ""} />
      <input type="hidden" name="mealType" value={type.id} />
      <input type="hidden" name="date" value={date} />

      <div className="flex items-center gap-2">
        <span>{type.icon}</span>
        <span className="text-sm font-semibold text-ink">{type.label}</span>
        <Select name="location" defaultValue={meal?.location ?? "casa"} className="ml-auto w-28">
          <option value="casa">🏠 Casa</option>
          <option value="fuera">🏪 Fuera</option>
        </Select>
      </div>

      <Input name="description" placeholder="¿Qué comiste?" defaultValue={meal?.description ?? ""} className="w-full" />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Labeled label="kcal">
          <Input type="number" name="calories" defaultValue={meal?.calories ?? ""} />
        </Labeled>
        <Labeled label="proteína g">
          <Input type="number" step="0.1" name="proteinG" defaultValue={meal?.proteinG ?? ""} />
        </Labeled>
        <Labeled label="carbs g">
          <Input type="number" step="0.1" name="carbsG" defaultValue={meal?.carbsG ?? ""} />
        </Labeled>
        <Labeled label="grasa g">
          <Input type="number" step="0.1" name="fatG" defaultValue={meal?.fatG ?? ""} />
        </Labeled>
      </div>

      <div className={cx("flex gap-2 pt-1", meal ? "" : "")}>
        <Button type="submit" className="flex-1">
          Guardar
        </Button>
        {meal && (
          <Button type="submit" variant="danger" formAction={deleteMeal}>
            Eliminar
          </Button>
        )}
      </div>
    </form>
  );
}
