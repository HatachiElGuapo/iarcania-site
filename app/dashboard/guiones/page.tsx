import { and, desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts } from "@/lib/db/schema/guiones";
import { PageHeader, Segmented, EmptyState } from "@/components/ui";
import { NewScriptForm } from "./new-script-form";
import { ScriptCard } from "./script-card";

export type Script = InferSelectModel<typeof scripts>;

const CANAL_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "iarcania", label: "IArcanIA" },
  { id: "voidstoic", label: "Void Stoic" },
];

export default async function GuionesPage({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { canal } = await searchParams;
  const filter = CANAL_FILTERS.find((c) => c.id === canal)?.id ?? "all";

  const rows = await db
    .select()
    .from(scripts)
    .where(
      filter === "all"
        ? eq(scripts.userId, userId)
        : and(eq(scripts.userId, userId), eq(scripts.canal, filter)),
    )
    .orderBy(desc(scripts.createdAt));

  return (
    <div className="p-8">
      <PageHeader
        icon="🎬"
        title="Guiones"
        tabs={
          <Segmented
            className="border-0"
            options={CANAL_FILTERS.map((c) => ({
              label: c.label,
              href: c.id === "all" ? "/dashboard/guiones" : `/dashboard/guiones?canal=${c.id}`,
              active: filter === c.id,
            }))}
          />
        }
      />

      <div className="flex flex-col gap-6">
        <NewScriptForm />

        {rows.length === 0 ? (
          <EmptyState icon="🎬">
            Todavía no has escrito ningún guión. Crea el primero, a mano o con la IA.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((s) => (
              <ScriptCard key={s.id} script={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
