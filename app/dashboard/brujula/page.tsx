import { and, asc, eq, isNull, ne, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lifeAreas, lifeProjects } from "@/lib/db/schema/brujula";
import { tasks } from "@/lib/db/schema/trabajo";
import { Field } from "@/components/ui/field";
import {
  createArea,
  updateArea,
  deleteArea,
  createProject,
  completeProject,
  createTaskInProject,
} from "./actions";
import { todayISO, addDaysISO } from "@/lib/date/bogota";
import { toggleTaskStatus } from "../actividades/actions";

type Area = InferSelectModel<typeof lifeAreas>;
type Project = InferSelectModel<typeof lifeProjects>;
type Task = InferSelectModel<typeof tasks>;

const AREA_COLORS = [
  "#E24B4A",
  "#378ADD",
  "#5DCAA5",
  "#EF9F27",
  "#8B6CF6",
  "#C9A84C",
  "#00C2FF",
  "#E07BA0",
  "#888888",
];

const DEPTH_LABELS = ["OBJETIVO", "PROYECTO", "SUB-PROYECTO"];

const DEFAULT_AREAS = [
  {
    nombre: "IArcanIA — Empresa",
    color: "#E24B4A",
    sortOrder: 0,
    enfoqueActual: "Conseguir los primeros clientes que paguen el OS",
    filosofia:
      "IArcanIA es una agencia de inteligencia artificial. El objetivo central es monetizar: que el OS se pague solo y que haya capacidad para ofrecerlo a clientes. Sin ingresos no hay operación. Cada acción debe acercar a un cliente o a un sistema que genere uno.",
  },
  {
    nombre: "IArcanIA — Marca",
    color: "#378ADD",
    sortOrder: 1,
    enfoqueActual: "Posicionar IArcanIA como referente de IA práctica en LATAM",
    filosofia:
      "La marca de IArcanIA es el canal de confianza que convierte audiencia en clientes. El contenido debe mostrar lo que realmente se construye — sin poses, sin teoría vacía. La credibilidad viene de demostrar, no de proclamar.",
  },
  {
    nombre: "Void Stoic",
    color: "#8B6CF6",
    sortOrder: 2,
    enfoqueActual: "Construir audiencia y encontrar los primeros compradores del curso",
    filosofia:
      "Void Stoic es la marca personal de Miguel. El espacio para hablar de desarrollo personal, filosofía y todo lo que importa más allá del trabajo. La meta es clara: encontrar personas que quieran un curso y usuarios que paguen por la interfaz mejorada del OS. La autenticidad es el único diferenciador.",
  },
  {
    nombre: "Memoria Vintage",
    color: "#C9A84C",
    sortOrder: 3,
    enfoqueActual: "Apoyar el crecimiento del negocio de mamá",
    filosofia:
      "Memoria Vintage es el negocio de ropa de segunda de mi madre. Mi rol aquí es de apoyo — no de operación. Aporto donde puedo (sistemas, visibilidad, orden) sin absorber el negocio como si fuera mío.",
  },
  {
    nombre: "Luna Angelical",
    color: "#E07BA0",
    sortOrder: 4,
    enfoqueActual: "Apoyar el negocio de tarot de la abuela",
    filosofia:
      "Luna Angelical es el negocio de tarot de mi abuela. Como en Memoria Vintage, mi rol es de apoyo puntual. Respeto su visión y su forma de trabajar.",
  },
  {
    nombre: "Familia & Amigos",
    color: "#5DCAA5",
    sortOrder: 5,
    enfoqueActual: "Mantener presencia real con las personas que importan",
    filosofia:
      "Las relaciones no se cultivan solas. La productividad sin vínculos es vacía. Esta área existe para recordar que hay que estar presente — no solo ocupado.",
  },
];

function tomorrowISO() {
  return addDaysISO(todayISO(), 1);
}

export default async function BrujulaPage() {
  const session = await auth();
  const userId = session!.user.id;

  let areas = await db
    .select()
    .from(lifeAreas)
    .where(eq(lifeAreas.userId, userId))
    .orderBy(asc(lifeAreas.sortOrder), asc(lifeAreas.createdAt));

  if (areas.length === 0) {
    areas = await db
      .insert(lifeAreas)
      .values(DEFAULT_AREAS.map((a) => ({ ...a, userId })))
      .returning();
  }

  const [allProjects, projectTasks, tomorrowTasks] = await Promise.all([
    db
      .select()
      .from(lifeProjects)
      .where(eq(lifeProjects.userId, userId))
      .orderBy(asc(lifeProjects.sortOrder)),
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, "archivada"))),
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.dueDate, tomorrowISO()),
          ne(tasks.status, "completada"),
        ),
      ),
  ]);

  const tasksByProject = new Map<string, Task[]>();
  for (const t of projectTasks) {
    if (!t.projectId) continue;
    const list = tasksByProject.get(t.projectId) ?? [];
    list.push(t);
    tasksByProject.set(t.projectId, list);
  }

  const tomorrowByArea = new Map<string, Task[]>();
  for (const t of tomorrowTasks) {
    const key = t.areaId ?? "__sin_area__";
    const list = tomorrowByArea.get(key) ?? [];
    list.push(t);
    tomorrowByArea.set(key, list);
  }

  return (
    <div className="space-y-8 p-8">
      <h1 className="font-display text-2xl text-text-primary">Brújula</h1>

      {tomorrowByArea.size > 0 && (
        <section className="rounded-md border border-border bg-bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
            Mañana
          </h2>
          <div className="space-y-3">
            {[...tomorrowByArea.entries()].map(([areaId, list]) => {
              const area = areas.find((a) => a.id === areaId);
              return (
                <div key={areaId}>
                  <div
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: area?.color ?? "#555" }}
                  >
                    {area?.nombre ?? "Sin área"}
                  </div>
                  {list.map((t) => (
                    <div key={t.id} className="py-1 text-sm text-text-primary">
                      {t.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="space-y-3">
        {areas.map((area) => {
          const rootProjects = allProjects.filter(
            (p) => p.areaId === area.id && !p.parentId && p.status === "activo",
          );
          return (
            <details
              key={area.id}
              className="rounded-md border border-border bg-bg-card p-4"
            >
              <summary className="flex cursor-pointer items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: area.color }}
                />
                <span className="font-display text-base font-bold text-text-primary">
                  {area.nombre}
                </span>
                {rootProjects.length > 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: area.color + "22", color: area.color }}
                  >
                    {rootProjects.length} obj.
                  </span>
                )}
              </summary>

              {area.enfoqueActual && (
                <p className="mt-2 pl-6 text-xs" style={{ color: area.color }}>
                  {area.enfoqueActual}
                </p>
              )}
              {area.filosofia && (
                <p className="mt-1 pl-6 text-xs text-text-muted">{area.filosofia}</p>
              )}

              <div className="mt-3 space-y-2 pl-6">
                {rootProjects.map((p) => (
                  <ProjectNode
                    key={p.id}
                    project={p}
                    depth={0}
                    areaColor={area.color}
                    allProjects={allProjects}
                    tasksByProject={tasksByProject}
                  />
                ))}

                <form action={createProject} className="flex items-end gap-2">
                  <input type="hidden" name="areaId" value={area.id} />
                  <input
                    type="text"
                    name="name"
                    placeholder="+ Nuevo objetivo"
                    required
                    className="input flex-1"
                  />
                  <button
                    type="submit"
                    className="rounded-sm border border-border px-2 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
                  >
                    Crear
                  </button>
                </form>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-text-muted">
                    Editar área
                  </summary>
                  <form
                    action={updateArea}
                    className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
                  >
                    <input type="hidden" name="id" value={area.id} />
                    <Field label="Nombre">
                      <input
                        type="text"
                        name="nombre"
                        defaultValue={area.nombre}
                        required
                        className="input"
                      />
                    </Field>
                    <Field label="Color">
                      <div className="flex gap-1.5">
                        {AREA_COLORS.map((c) => (
                          <label key={c}>
                            <input
                              type="radio"
                              name="color"
                              value={c}
                              defaultChecked={c === area.color}
                              className="peer sr-only"
                            />
                            <span
                              className="block h-5 w-5 cursor-pointer rounded-full ring-2 ring-transparent peer-checked:ring-white"
                              style={{ background: c }}
                            />
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Enfoque actual">
                      <input
                        type="text"
                        name="enfoqueActual"
                        defaultValue={area.enfoqueActual ?? ""}
                        className="input w-64"
                      />
                    </Field>
                    <button
                      type="submit"
                      className="rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
                    >
                      Guardar
                    </button>
                    <button
                      type="submit"
                      formAction={deleteArea}
                      className="rounded-sm border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:border-red-400"
                    >
                      Eliminar área
                    </button>
                  </form>
                </details>
              </div>
            </details>
          );
        })}
      </div>

      <form
        action={createArea}
        className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
      >
        <Field label="Nombre">
          <input type="text" name="nombre" required className="input" />
        </Field>
        <Field label="Color">
          <div className="flex gap-1.5">
            {AREA_COLORS.map((c, i) => (
              <label key={c}>
                <input
                  type="radio"
                  name="color"
                  value={c}
                  defaultChecked={i === 0}
                  className="peer sr-only"
                />
                <span
                  className="block h-5 w-5 cursor-pointer rounded-full ring-2 ring-transparent peer-checked:ring-white"
                  style={{ background: c }}
                />
              </label>
            ))}
          </div>
        </Field>
        <Field label="Enfoque actual">
          <input type="text" name="enfoqueActual" className="input w-64" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-4 py-2 text-sm text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          + Nueva área
        </button>
      </form>
    </div>
  );

  function ProjectNode({
    project,
    depth,
    areaColor,
    allProjects,
    tasksByProject,
  }: {
    project: Project;
    depth: number;
    areaColor: string;
    allProjects: Project[];
    tasksByProject: Map<string, Task[]>;
  }) {
    const children = allProjects.filter(
      (p) => p.parentId === project.id && p.status === "activo",
    );
    const projTasks = tasksByProject.get(project.id) ?? [];
    const pending = projTasks.filter((t) => t.status !== "completada");
    const done = projTasks.filter((t) => t.status === "completada");
    const pct =
      pending.length + done.length > 0
        ? Math.round((done.length / (pending.length + done.length)) * 100)
        : null;
    const depthLabel = DEPTH_LABELS[Math.min(depth, 2)];

    return (
      <details
        style={{ marginLeft: depth * 14 }}
        className="rounded-md border border-border/60 bg-bg-deep/40 p-3"
      >
        <summary className="flex cursor-pointer items-center gap-2">
          <span
            className="text-[9px] font-bold tracking-wide opacity-70"
            style={{ color: areaColor }}
          >
            {depthLabel}
          </span>
          <span className="flex-1 text-sm font-bold text-text-primary">
            {project.name}
          </span>
          {pct !== null && <span className="text-xs text-text-muted">{pct}%</span>}
        </summary>

        {project.description && (
          <p className="mt-1 text-xs text-text-muted">{project.description}</p>
        )}

        <div className="mt-2 space-y-2">
          <form action={completeProject}>
            <input type="hidden" name="id" value={project.id} />
            <button
              type="submit"
              className="rounded-sm border border-green-500/30 px-2 py-1 text-xs text-green-400 hover:border-green-400"
            >
              ✓ Completar
            </button>
          </form>

          {children.length > 0 ? (
            <>
              {children.map((c) => (
                <ProjectNode
                  key={c.id}
                  project={c}
                  depth={depth + 1}
                  areaColor={areaColor}
                  allProjects={allProjects}
                  tasksByProject={tasksByProject}
                />
              ))}
              <form action={createProject} className="flex items-end gap-2">
                <input type="hidden" name="areaId" value={project.areaId} />
                <input type="hidden" name="parentId" value={project.id} />
                <input
                  type="text"
                  name="name"
                  placeholder="+ Sub-proyecto"
                  required
                  className="input flex-1"
                />
                <button
                  type="submit"
                  className="rounded-sm border border-border px-2 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
                >
                  Crear
                </button>
              </form>
            </>
          ) : (
            <>
              {projTasks.length === 0 ? (
                <p className="text-xs text-text-muted">
                  Sin tareas — agrega una para arrancar
                </p>
              ) : (
                <div className="space-y-1">
                  {projTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm">
                      <form action={toggleTaskStatus}>
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          type="hidden"
                          name="nextStatus"
                          value={t.status === "completada" ? "pendiente" : "completada"}
                        />
                        <button
                          type="submit"
                          className={`h-3.5 w-3.5 rounded border ${t.status === "completada" ? "border-purple-mid bg-purple-mid" : "border-border"}`}
                          aria-label="Cambiar estado"
                        />
                      </form>
                      <span
                        className={
                          t.status === "completada"
                            ? "text-text-dim line-through"
                            : "text-text-primary"
                        }
                      >
                        {t.title}
                      </span>
                      <span className="ml-auto text-xs text-text-muted">
                        {t.dueDate ?? "backlog"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <form action={createTaskInProject} className="flex items-end gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="areaId" value={project.areaId} />
                <input
                  type="text"
                  name="title"
                  placeholder="+ Tarea"
                  required
                  className="input flex-1"
                />
                <input type="date" name="dueDate" className="input" />
                <button
                  type="submit"
                  className="rounded-sm border border-border px-2 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
                >
                  Agregar
                </button>
              </form>
            </>
          )}
        </div>
      </details>
    );
  }
}
