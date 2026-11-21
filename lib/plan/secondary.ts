// Hábitos/subhábitos SECUNDARIOS (activities.is_optional = true) de los
// bloques de Plan de un día — se sacan del árbol que ve el bloque (ahí
// solo quedan los principales) y se agrupan acá por franja horaria para
// el panel "Secundarios" del dashboard.
import type { PlanContext } from "./load";
import { toPlanData } from "./load";
import { resolvePlan } from "./resolve";
import { loadHabitTreesByBlock, type HabitNode } from "./sub-habits";
import { bandOf, groupSecondaryEntries, filterSecondaryGroupsForBlock, type SecondaryBand, type SecondaryEntry } from "./secondary-bands";

// Re-exportados tal cual — los tipos/helpers puros viven en secondary-
// bands.ts (sin imports de DB) para que los componentes "use client" los
// puedan importar sin arrastrar loadHabitTreesByBlock/lib/db/client.ts a
// su bundle. Este archivo (con DB real) los reexporta para no romper a
// quien ya los importaba de acá.
export { bandOf, groupSecondaryEntries, filterSecondaryGroupsForBlock, type SecondaryBand, type SecondaryEntry };

// Separa un árbol en { principal, secondary }: un nodo is_optional=true se
// saca ENTERO (con todo su propio subárbol tal cual, sin volver a
// filtrarlo adentro — si "Dientes" es secundario, sus hijos "Dientes
// mañana/tarde/noche" y "Seda dental" viajan con él) de donde esté, a
// cualquier profundidad. Un nodo principal se queda en su lugar, pero se
// recorren SUS hijos con la misma regla (puede tener hijos secundarios
// sueltos mezclados con hijos principales).
export function splitPrincipalSecondary(nodes: HabitNode[]): { principal: HabitNode[]; secondary: HabitNode[] } {
  const principal: HabitNode[] = [];
  const secondary: HabitNode[] = [];
  for (const n of nodes) {
    if (n.isOptional) {
      secondary.push(n);
    } else {
      const childSplit = splitPrincipalSecondary(n.children);
      principal.push({ ...n, children: childSplit.principal });
      secondary.push(...childSplit.secondary);
    }
  }
  return { principal, secondary };
}

// Todos los secundarios (principales de nivel 1 marcados is_optional, o
// cualquier hijo/nieto que lo sea) de los bloques de HOY de una persona
// — con su hora efectiva (propia, o la de fin del bloque si no tiene) y
// el bloque de origen, para mostrar "hora · bloque" en chico.
export async function getSecondaryHabitsForPerson(
  ctx: PlanContext,
  userId: string,
  personId: string,
  today: string,
): Promise<SecondaryEntry[]> {
  const planData = toPlanData(ctx);
  const [todayDay] = resolvePlan(planData, today, today);
  const blocks = todayDay?.blocksByPerson[personId] ?? [];
  if (blocks.length === 0) return [];

  const habitTreesByBlock = await loadHabitTreesByBlock(ctx.plan.id, userId, today);
  const out: SecondaryEntry[] = [];

  for (const b of blocks) {
    const tree = habitTreesByBlock.get(b.blockId) ?? [];
    const { secondary } = splitPrincipalSecondary(tree);
    const blockDueTime = b.endTime ?? b.startTime;
    for (const node of secondary) {
      out.push({
        node,
        dueTime: node.horaSugerida ?? blockDueTime,
        blockId: b.blockId,
        blockText: b.text,
        blockStartTime: b.startTime,
      });
    }
  }

  return out;
}
