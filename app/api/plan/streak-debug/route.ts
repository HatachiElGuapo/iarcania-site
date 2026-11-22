import { NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { planChecks } from "@/lib/db/schema/plan";
import { findPlanPersonForUser, loadPlanContextById, toPlanData } from "@/lib/plan/load";
import { resolvePlan } from "@/lib/plan/resolve";
import { excludeTodayInProgress, simulateStreak } from "@/lib/plan/streak-pure";
import { todayISO } from "@/lib/date/bogota";

export const dynamic = "force-dynamic";

// Diagnóstico de la racha de Plan del usuario logueado — SOLO para él
// mismo (findPlanPersonForUser(userId), la misma función que usa Tu día
// para elegir qué persona del plan mostrar; nunca "la primera" del plan
// ni una por defecto). Útil para verificar en producción, día por día
// desde plan.startDate hasta hoy, cuántos mínimos había, cuántos quedaron
// done y si ese día cuenta como cumplido — sin tener que correr SQL a
// mano. No muta nada, solo lee.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const planPerson = await findPlanPersonForUser(userId);
  if (!planPerson) return NextResponse.json({ error: "No tenés un plan" }, { status: 404 });

  const ctx = await loadPlanContextById(planPerson.planId);
  const today = todayISO();
  const planData = toPlanData(ctx);

  if (today < ctx.plan.startDate) {
    return NextResponse.json({
      personId: planPerson.personId,
      planId: planPerson.planId,
      planStartDate: ctx.plan.startDate,
      today,
      days: [],
      streakResult: { streak: 0, protectors: 0, best: 0 },
      note: "hoy es anterior a plan.startDate — no hay nada que resolver todavía",
    });
  }

  const resolved = resolvePlan(planData, ctx.plan.startDate, today, today);

  const checks = await db
    .select({ blockId: planChecks.blockId, date: planChecks.date, status: planChecks.status })
    .from(planChecks)
    .where(
      and(
        eq(planChecks.planId, ctx.plan.id),
        eq(planChecks.personId, planPerson.personId),
        gte(planChecks.date, ctx.plan.startDate),
        lte(planChecks.date, today),
      ),
    );
  const doneSet = new Set(checks.filter((c) => c.status === "done").map((c) => `${c.date}:${c.blockId}`));

  const days = resolved.map((day) => {
    const minimums = (day.blocksByPerson[planPerson.personId] ?? []).filter((b) => b.isMinimum);
    const doneCount = minimums.filter((b) => doneSet.has(`${day.date}:${b.blockId}`)).length;
    return {
      date: day.date,
      minimumBlocks: minimums.map((b) => ({ blockId: b.blockId, text: b.text })),
      totalMinimums: minimums.length,
      doneCount,
      allDone: minimums.length > 0 && doneCount === minimums.length,
    };
  });

  const dayCompletions = excludeTodayInProgress(
    days.map((d) => ({ hasMinimums: d.totalMinimums > 0, allDone: d.allDone })),
    today,
    today,
  );
  const streakResult = simulateStreak(dayCompletions);

  return NextResponse.json({
    personId: planPerson.personId,
    planId: planPerson.planId,
    planStartDate: ctx.plan.startDate,
    today,
    days,
    streakResult,
  });
}
