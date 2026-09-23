import { and, desc, eq, type InferSelectModel, type SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { scripts } from "@/lib/db/schema/guiones";
import { allBrandThemes } from "@/lib/guiones/brands";
import { PageHeader, Segmented, EmptyState } from "@/components/ui";
import { NewScriptForm } from "./new-script-form";
import { ScriptCard } from "./script-card";

export type Script = InferSelectModel<typeof scripts>;

const CANAL_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "iarcania", label: "IArcanIA" },
  { id: "voidstoic", label: "Void Stoic" },
];

const ESTADO_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "borrador", label: "Borrador" },
  { id: "en_progreso", label: "En progreso" },
  { id: "listo_grabar", label: "Listo" },
  { id: "grabado", label: "Grabado" },
  { id: "publicado", label: "Publicado" },
];

export default async function GuionesPage({
  searchParams,
}: {
  searchParams: Promise<{ canal?: string; estado?: string; open?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { canal, estado, open } = await searchParams;
  const canalF = CANAL_FILTERS.find((c) => c.id === canal)?.id ?? "all";
  const estadoF = ESTADO_FILTERS.find((e) => e.id === estado)?.id ?? "all";

  const conds: SQL[] = [eq(scripts.userId, userId)];
  if (canalF !== "all") conds.push(eq(scripts.canal, canalF));
  if (estadoF !== "all") conds.push(eq(scripts.status, estadoF));

  const [rows, themes] = await Promise.all([
    db
      .select()
      .from(scripts)
      .where(and(...conds))
      .orderBy(desc(scripts.createdAt)),
    allBrandThemes(),
  ]);

  const qs = (over: { canal?: string; estado?: string }) => {
    const c = over.canal ?? canalF;
    const e = over.estado ?? estadoF;
    const p = new URLSearchParams();
    if (c !== "all") p.set("canal", c);
    if (e !== "all") p.set("estado", e);
    const s = p.toString();
    return s ? `/dashboard/guiones?${s}` : "/dashboard/guiones";
  };

  return (
    <div className="p-8">
      <PageHeader
        icon="🎬"
        title="Guiones"
        subtitle={`${rows.length} ${rows.length === 1 ? "guión" : "guiones"}`}
        tabs={
          <Segmented
            className="border-0"
            options={CANAL_FILTERS.map((c) => ({
              label: c.label,
              href: qs({ canal: c.id }),
              active: canalF === c.id,
            }))}
          />
        }
      />

      <div className="mb-4">
        <Segmented
          options={ESTADO_FILTERS.map((e) => ({
            label: e.label,
            href: qs({ estado: e.id }),
            active: estadoF === e.id,
          }))}
        />
      </div>

      <div className="flex flex-col gap-6">
        <NewScriptForm />

        {rows.length === 0 ? (
          <EmptyState icon="🎬">
            Todavía no hay guiones con este filtro. Crea el primero, a mano o con la IA.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((s) => (
              <ScriptCard
                key={s.id}
                script={s}
                theme={themes[s.canal] ?? themes.iarcania}
                themes={themes}
                defaultExpanded={s.id === open}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
