import { and, asc, eq, ne, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lifeAreas, lifeProjects } from "@/lib/db/schema/brujula";
import { tasks } from "@/lib/db/schema/trabajo";
import { PageHeader, Card, Labeled, Input, Button, cx } from "@/components/ui";
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
    <div className="p-8">
      <PageHeader icon="🧭" title="Brújula" subtitle={`${areas.length} áreas de vida`} />

      <div className="flex flex-col gap-8">
        {tomorrowByArea.size > 0 && (
          <Card title="Mañana">
            <div className="flex flex-col gap-3">
              {[...tomorrowByArea.entries()].map(([areaId, list]) => {
                const area = areas.find((a) => a.id === areaId);
                return (
                  <div key={areaId}>
                    <div
                      className="text-[10px] font-bold uppercase tracking-[0.1em]"
                      style={{ color: area?.color ?? "#5A5870" }}
                    >
                      {area?.nombre ?? "Sin área"}
                    </div>
                    {list.map((t) => (
                      <div key={t.id} className="py-1 text-body text-ink">
                        {t.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {areas.map((area) => {
            const rootProjects = allProjects.filter(
              (p) => p.areaId === area.id && !p.parentId && p.status === "activo",
            );
            return (
              <details key={area.id} className="rounded-ui-lg border border-line bg-surface p-4">
                <summary className="flex cursor-pointer items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: area.color }}
                  />
                  <span className="font-display text-base font-bold text-ink">{area.nombre}</span>
                  {rootProjects.length > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: area.color + "22", color: area.color }}
                    >
                      {rootProjects.length} obj.
                    </span>
                  )}
                </summary>

                {area.enfoqueActual && (
                  <p className="mt-2 pl-6 text-meta" style={{ color: area.color }}>
                    {area.enfoqueActual}
                  </p>
                )}
                {area.filosofia && (
                  <p className="mt-1 pl-6 text-meta text-ink-muted">{area.filosofia}</p>
                )}

                <div className="mt-3 flex flex-col gap-2 pl-6">
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
                    <Input name="name" placeholder="+ Nuevo objetivo" required className="flex-1" />
                    <Button type="submit" variant="secondary" size="sm">
                      Crear
                    </Button>
                  </form>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
                      Editar área
                    </summary>
                    <form
                      action={updateArea}
                      className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-3"
                    >
                      <input type="hidden" name="id" value={area.id} />
                      <Labeled label="Nombre">
                        <Input name="nombre" defaultValue={area.nombre} required className="w-52" />
                      </Labeled>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
                          Color
                        </span>
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
                                className="block h-5 w-5 cursor-pointer rounded-full ring-2 ring-transparent peer-checked:ring-ink"
                                style={{ background: c }}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                      <Labeled label="Enfoque actual">
                        <Input
                          name="enfoqueActual"
                          defaultValue={area.enfoqueActual ?? ""}
                          className="w-64"
                        />
                      </Labeled>
                      <Button type="submit">Guardar</Button>
                      <Button type="submit" formAction={deleteArea} variant="danger" size="sm">
                        Eliminar área
                      </Button>
                    </form>
                  </details>
                </div>
              </details>
            );
          })}
        </div>

        <form
          action={createArea}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
        >
          <Labeled label="Nombre">
            <Input name="nombre" required className="w-52" />
          </Labeled>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-dim">
              Color
            </span>
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
                    className="block h-5 w-5 cursor-pointer rounded-full ring-2 ring-transparent peer-checked:ring-ink"
                    style={{ background: c }}
                  />
                </label>
              ))}
            </div>
          </div>
          <Labeled label="Enfoque actual">
            <Input name="enfoqueActual" className="w-64" />
          </Labeled>
          <Button type="submit" variant="secondary">
            + Nueva área
          </Button>
        </form>
      </div>
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
        className="rounded-ui-lg border border-line bg-surface-sunken p-3"
      >
        <summary className="flex cursor-pointer items-center gap-2">
          <span
            className="text-[9px] font-bold tracking-wide opacity-70"
            style={{ color: areaColor }}
          >
            {depthLabel}
          </span>
          <span className="flex-1 text-body font-bold text-ink">{project.name}</span>
          {pct !== null && <span className="text-meta tabular-nums text-ink-muted">{pct}%</span>}
        </summary>

        {project.description && (
          <p className="mt-1 text-meta text-ink-muted">{project.description}</p>
        )}

        <div className="mt-2 flex flex-col gap-2">
          <form action={completeProject}>
            <input type="hidden" name="id" value={project.id} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="border-success/30 text-success hover:border-success"
            >
              ✓ Completar
            </Button>
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
                <Input name="name" placeholder="+ Sub-proyecto" required className="flex-1" />
                <Button type="submit" variant="secondary" size="sm">
                  Crear
                </Button>
              </form>
            </>
          ) : (
            <>
              {projTasks.length === 0 ? (
                <p className="text-meta text-ink-muted">Sin tareas — agrega una para arrancar.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {projTasks.map((t) => {
                    const taskDone = t.status === "completada";
                    return (
                      <div key={t.id} className="flex items-center gap-2 text-body">
                        <form action={toggleTaskStatus} className="flex">
                          <input type="hidden" name="id" value={t.id} />
                          <input
                            type="hidden"
                            name="nextStatus"
                            value={taskDone ? "pendiente" : "completada"}
                          />
                          <button
                            type="submit"
                            className={cx(
                              "focus-ring h-3.5 w-3.5 rounded-ui-sm border transition-colors duration-120",
                              taskDone
                                ? "border-accent bg-accent"
                                : "border-line-strong hover:border-ink-dim",
                            )}
                            aria-label="Cambiar estado"
                          />
                        </form>
                        <span className={taskDone ? "text-ink-dim line-through" : "text-ink"}>
                          {t.title}
                        </span>
                        <span className="ml-auto text-meta tabular-nums text-ink-muted">
                          {t.dueDate ?? "backlog"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <form action={createTaskInProject} className="flex items-end gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="areaId" value={project.areaId} />
                <Input name="title" placeholder="+ Tarea" required className="flex-1" />
                <Input type="date" name="dueDate" className="w-40" />
                <Button type="submit" variant="secondary" size="sm">
                  Agregar
                </Button>
              </form>
            </>
          )}
        </div>
      </details>
    );
  }
}
