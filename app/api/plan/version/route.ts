import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { activityLogs } from "@/lib/db/schema/habitos";
import { tasks, dailyFocus } from "@/lib/db/schema/trabajo";
import { planChecks, planPeople } from "@/lib/db/schema/plan";

export const dynamic = "force-dynamic";

// Endpoint liviano para AutoRefresh: una sola marca de tiempo (la más
// reciente entre hábitos, tareas, enfoque diario y checks de plan de este
// usuario) para que el cliente decida si vale la pena pedir router.refresh()
// en vez de hacerlo a ciegas cada 30s. plan_checks no tiene userId directo,
// solo personId → se filtra vía planPeople.userId.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ version: null }, { status: 401 });

  const [actRow, taskRow, focusRow, checkRow] = await Promise.all([
    db
      .select({ max: sql<string | null>`max(${activityLogs.createdAt})` })
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId)),
    db
      .select({ max: sql<string | null>`max(${tasks.createdAt})` })
      .from(tasks)
      .where(eq(tasks.userId, userId)),
    db
      .select({ max: sql<string | null>`max(${dailyFocus.createdAt})` })
      .from(dailyFocus)
      .where(eq(dailyFocus.userId, userId)),
    db
      .select({ max: sql<string | null>`max(${planChecks.checkedAt})` })
      .from(planChecks)
      .innerJoin(planPeople, eq(planPeople.id, planChecks.personId))
      .where(eq(planPeople.userId, userId)),
  ]);

  const dates = [actRow[0]?.max, taskRow[0]?.max, focusRow[0]?.max, checkRow[0]?.max]
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime());

  const version = dates.length ? Math.max(...dates) : 0;
  return NextResponse.json({ version });
}
