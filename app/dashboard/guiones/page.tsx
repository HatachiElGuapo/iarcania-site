import { and, desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts } from "@/lib/db/schema/guiones";
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
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">🎬 Guiones</h1>

      <div className="flex gap-2 text-sm">
        {CANAL_FILTERS.map((c) => (
          <a
            key={c.id}
            href={c.id === "all" ? "/dashboard/guiones" : `/dashboard/guiones?canal=${c.id}`}
            className={`rounded-sm px-3 py-1.5 ${
              filter === c.id
                ? "bg-bg-card text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {c.label}
          </a>
        ))}
      </div>

      <NewScriptForm />

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">Sin guiones todavía — crea el primero</p>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <ScriptCard key={s.id} script={s} />
          ))}
        </div>
      )}
    </div>
  );
}
