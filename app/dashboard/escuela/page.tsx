import { and, asc, desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { courses, lessons, students } from "@/lib/db/schema/escuela";
import {
  PageHeader,
  Segmented,
  MetricCard,
  Badge,
  EmptyState,
  Labeled,
  Input,
  Select,
  Button,
  cx,
} from "@/components/ui";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  createLesson,
  updateLesson,
  deleteLesson,
  changeStudentTier,
} from "./actions";

type Course = InferSelectModel<typeof courses>;
type Lesson = InferSelectModel<typeof lessons>;
type Student = InferSelectModel<typeof students>;

const TIER_LABEL: Record<string, string> = {
  gratis: "Gratis",
  plus: "Plus",
  pro: "Pro",
  founder: "👑 Fundador",
};

const TIER_TONE: Record<string, "neutral" | "warm" | "accent"> = {
  gratis: "neutral",
  plus: "warm",
  pro: "accent",
  founder: "warm",
};

const TIER_METRIC_TONE: Record<string, "primary" | "warm" | "accent"> = {
  gratis: "primary",
  plus: "warm",
  pro: "accent",
  founder: "warm",
};

const TABS = [
  { id: "cursos", label: "Cursos" },
  { id: "estudiantes", label: "Estudiantes" },
];

export default async function EscuelaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; course?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const { tab: tabParam, course: courseId } = await searchParams;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "cursos";

  const [allCourses, allStudents] = await Promise.all([
    db.select().from(courses).where(eq(courses.userId, userId)).orderBy(asc(courses.orden)),
    tab === "estudiantes"
      ? db.select().from(students).where(eq(students.userId, userId)).orderBy(desc(students.createdAt))
      : Promise.resolve([] as Student[]),
  ]);

  const counts: Record<string, number> = { gratis: 0, plus: 0, pro: 0, founder: 0 };
  for (const s of allStudents) {
    counts[s.isFounder ? "founder" : s.tier] = (counts[s.isFounder ? "founder" : s.tier] ?? 0) + 1;
  }

  return (
    <div className="p-8">
      <PageHeader
        icon="🎓"
        title="Escuela"
        tabs={
          <Segmented
            className="border-0"
            options={TABS.map((t) => ({
              label: `${t.label} (${t.id === "cursos" ? allCourses.length : allStudents.length})`,
              href: `/dashboard/escuela?tab=${t.id}`,
              active: tab === t.id,
            }))}
          />
        }
      />

      {tab === "cursos" ? (
        <div className="flex flex-col gap-4">
          {allCourses.length === 0 ? (
            <EmptyState icon="🎓">
              Todavía no has creado ningún curso. Crea el primero abajo y agrégale clases.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {allCourses.map((c) => (
                <CourseRow key={c.id} course={c} defaultOpen={c.id === courseId} />
              ))}
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">+ Nuevo curso</summary>
            <form
              action={createCourse}
              className="mt-2 flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-4"
            >
              <Labeled label="Título">
                <Input name="title" required className="w-52" />
              </Labeled>
              <Labeled label="Canal">
                <Select name="canal" defaultValue="iarcania">
                  <option value="iarcania">IArcanIA</option>
                  <option value="voidstoic">Void Stoic</option>
                </Select>
              </Labeled>
              <Labeled label="Descripción">
                <Input name="description" className="w-64" />
              </Labeled>
              <Button type="submit">Crear</Button>
            </form>
          </details>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Object.entries(counts).map(([tier, n]) => (
              <MetricCard key={tier} value={n} label={TIER_LABEL[tier]} tone={TIER_METRIC_TONE[tier]} />
            ))}
          </div>

          {allStudents.length === 0 ? (
            <EmptyState icon="🧑‍🎓">Todavía no se ha registrado ningún estudiante.</EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {allStudents.map((s) => {
                const tierKey = s.isFounder ? "founder" : s.tier;
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-ui-lg border border-line bg-surface p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink">{s.name || s.email}</div>
                      <div className="text-meta text-ink-dim">
                        {s.email} ·{" "}
                        {s.createdAt.toLocaleDateString("es-CO", {
                          timeZone: "America/Bogota",
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={TIER_TONE[tierKey] ?? "neutral"}>{TIER_LABEL[tierKey]}</Badge>
                      <form action={changeStudentTier} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={s.id} />
                        <Select name="tier" defaultValue="">
                          <option value="">Cambiar tier</option>
                          <option value="gratis">Gratis</option>
                          <option value="plus">Plus</option>
                          <option value="pro">Pro</option>
                          <option value="founder">Fundador</option>
                        </Select>
                        <Button type="submit" variant="secondary" size="sm">
                          Aplicar
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

async function CourseRow({ course, defaultOpen }: { course: Course; defaultOpen: boolean }) {
  const courseLessons = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.courseId, course.id), eq(lessons.userId, course.userId)))
    .orderBy(asc(lessons.orden));

  const canalColor = course.canal === "voidstoic" ? "text-ink-muted" : "text-accent";
  const canalLabel = course.canal === "voidstoic" ? "Void Stoic" : "IArcanIA";

  return (
    <details open={defaultOpen} className="rounded-ui-lg border border-line bg-surface p-4">
      <summary className="flex cursor-pointer items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">{course.title}</div>
          <div className="mt-1 flex gap-2 text-meta">
            <span className={cx("font-semibold", canalColor)}>{canalLabel}</span>
            <span className={course.active ? "text-success" : "text-ink-muted"}>
              {course.active ? "● Activo" : "○ Inactivo"}
            </span>
          </div>
        </div>
      </summary>

      <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
        <form
          action={updateCourse}
          className="flex flex-wrap items-end gap-3 rounded-ui-lg border border-dashed border-line p-3"
        >
          <input type="hidden" name="id" value={course.id} />
          <Labeled label="Título">
            <Input name="title" defaultValue={course.title} required className="w-52" />
          </Labeled>
          <Labeled label="Canal">
            <Select name="canal" defaultValue={course.canal}>
              <option value="iarcania">IArcanIA</option>
              <option value="voidstoic">Void Stoic</option>
            </Select>
          </Labeled>
          <Labeled label="Estado">
            <Select name="active" defaultValue={String(course.active)}>
              <option value="true">Activo (visible)</option>
              <option value="false">Inactivo (oculto)</option>
            </Select>
          </Labeled>
          <Labeled label="Thumbnail URL">
            <Input name="thumbnailUrl" defaultValue={course.thumbnailUrl ?? ""} className="w-48" />
          </Labeled>
          <Labeled label="Orden">
            <Input type="number" name="orden" defaultValue={course.orden} className="w-16" />
          </Labeled>
          <Labeled label="Descripción">
            <Input name="description" defaultValue={course.description ?? ""} className="w-64" />
          </Labeled>
          <Button type="submit">Guardar curso</Button>
          <Button type="submit" formAction={deleteCourse} variant="danger" size="sm">
            Eliminar
          </Button>
        </form>

        <div>
          <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Clases ({courseLessons.length})
          </h3>
          {courseLessons.length === 0 ? (
            <p className="text-meta text-ink-muted">Todavía no has agregado clases a este curso.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {courseLessons.map((l, i) => (
                <LessonRow key={l.id} lesson={l} index={i} />
              ))}
            </div>
          )}
          <form
            action={createLesson}
            className="mt-2 flex flex-wrap items-end gap-2 rounded-ui-lg border border-dashed border-line p-3"
          >
            <input type="hidden" name="courseId" value={course.id} />
            <Labeled label="Título de la clase">
              <Input name="title" required className="w-52" />
            </Labeled>
            <Labeled label="Video (Drive)">
              <Input type="url" name="videoUrl" className="w-48" />
            </Labeled>
            <Labeled label="Tier">
              <Select name="tierRequired" defaultValue="gratis">
                <option value="gratis">Gratis</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
              </Select>
            </Labeled>
            <Labeled label="Min">
              <Input type="number" name="durationMin" className="w-16" />
            </Labeled>
            <Button type="submit" variant="secondary" size="sm">
              + Agregar clase
            </Button>
          </form>
        </div>
      </div>
    </details>
  );
}

function LessonRow({ lesson, index }: { lesson: Lesson; index: number }) {
  return (
    <details className="rounded-ui-lg border border-line bg-surface-sunken p-3">
      <summary className="flex cursor-pointer items-center gap-2">
        <span className="w-5 text-meta tabular-nums text-ink-muted">{index + 1}.</span>
        <div className="flex-1">
          <div className="text-body text-ink">{lesson.title}</div>
          <div className="mt-0.5 flex gap-2 text-meta text-ink-muted">
            <span>{lesson.tierRequired}</span>
            {lesson.durationMin && <span>· {lesson.durationMin} min</span>}
            {lesson.videoUrl ? (
              <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="text-accent">
                · ver video ↗
              </a>
            ) : (
              <span>· sin video</span>
            )}
          </div>
        </div>
      </summary>
      <form action={updateLesson} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={lesson.id} />
        <Labeled label="Título">
          <Input name="title" defaultValue={lesson.title} required className="w-52" />
        </Labeled>
        <Labeled label="Video (Drive)">
          <Input type="url" name="videoUrl" defaultValue={lesson.videoUrl ?? ""} className="w-48" />
        </Labeled>
        <Labeled label="Tier">
          <Select name="tierRequired" defaultValue={lesson.tierRequired}>
            <option value="gratis">Gratis</option>
            <option value="plus">Plus</option>
            <option value="pro">Pro</option>
          </Select>
        </Labeled>
        <Labeled label="Min">
          <Input type="number" name="durationMin" defaultValue={lesson.durationMin ?? ""} className="w-16" />
        </Labeled>
        <Labeled label="Orden">
          <Input type="number" name="orden" defaultValue={lesson.orden} className="w-16" />
        </Labeled>
        <Button type="submit" variant="secondary" size="sm">
          Guardar
        </Button>
        <Button type="submit" formAction={deleteLesson} variant="danger" size="sm">
          Eliminar
        </Button>
      </form>
    </details>
  );
}
