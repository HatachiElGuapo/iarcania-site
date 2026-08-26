import { and, asc, desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { courses, lessons, students } from "@/lib/db/schema/escuela";
import { Field } from "@/components/ui/field";
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

const TIER_COLOR: Record<string, string> = {
  gratis: "text-text-muted",
  plus: "text-gold",
  pro: "text-purple-light",
  founder: "text-gold",
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
      ? db
          .select()
          .from(students)
          .where(eq(students.userId, userId))
          .orderBy(desc(students.createdAt))
      : Promise.resolve([] as Student[]),
  ]);

  const counts: Record<string, number> = { gratis: 0, plus: 0, pro: 0, founder: 0 };
  for (const s of allStudents) {
    counts[s.isFounder ? "founder" : s.tier] = (counts[s.isFounder ? "founder" : s.tier] ?? 0) + 1;
  }

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-display text-2xl text-text-primary">🎓 Escuela</h1>

      <div className="flex gap-2 text-sm">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={`/dashboard/escuela?tab=${t.id}`}
            className={`rounded-sm px-3 py-1.5 ${
              tab === t.id
                ? "bg-bg-card text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label} ({t.id === "cursos" ? allCourses.length : allStudents.length})
          </a>
        ))}
      </div>

      {tab === "cursos" ? (
        <div className="space-y-4">
          {allCourses.length === 0 ? (
            <p className="text-sm text-text-muted">Sin cursos todavía — crea el primero</p>
          ) : (
            <div className="space-y-2">
              {allCourses.map((c) => (
                <CourseRow key={c.id} course={c} defaultOpen={c.id === courseId} />
              ))}
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-xs text-text-muted">+ Nuevo curso</summary>
            <form
              action={createCourse}
              className="mt-2 flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-4"
            >
              <Field label="Título">
                <input type="text" name="title" required className="input" />
              </Field>
              <Field label="Canal">
                <select name="canal" defaultValue="iarcania" className="input">
                  <option value="iarcania">IArcanIA</option>
                  <option value="voidstoic">Void Stoic</option>
                </select>
              </Field>
              <Field label="Descripción">
                <input type="text" name="description" className="input w-64" />
              </Field>
              <button
                type="submit"
                className="rounded-sm bg-gradient-cta px-4 py-2 text-sm font-semibold text-white shadow-glow-purple"
              >
                Crear
              </button>
            </form>
          </details>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(counts).map(([tier, n]) => (
              <div key={tier} className="rounded-md border border-border bg-bg-card p-4">
                <div className={`font-display text-2xl font-bold ${TIER_COLOR[tier]}`}>{n}</div>
                <div className="text-xs text-text-muted">{TIER_LABEL[tier]}</div>
              </div>
            ))}
          </div>

          {allStudents.length === 0 ? (
            <p className="text-sm text-text-muted">Sin estudiantes todavía</p>
          ) : (
            <div className="space-y-2">
              {allStudents.map((s) => {
                const tierKey = s.isFounder ? "founder" : s.tier;
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-bg-card p-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        {s.name || s.email}
                      </div>
                      <div className="text-xs text-text-muted">
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
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${TIER_COLOR[tierKey]}`}>
                        {TIER_LABEL[tierKey]}
                      </span>
                      <form action={changeStudentTier} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={s.id} />
                        <select name="tier" defaultValue="" className="input">
                          <option value="">Cambiar tier</option>
                          <option value="gratis">Gratis</option>
                          <option value="plus">Plus</option>
                          <option value="pro">Pro</option>
                          <option value="founder">Fundador</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-sm border border-border px-2 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
                        >
                          Aplicar
                        </button>
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

  const canalColor = course.canal === "voidstoic" ? "text-purple-light" : "text-red-400";
  const canalLabel = course.canal === "voidstoic" ? "Void Stoic" : "IArcanIA";

  return (
    <details open={defaultOpen} className="rounded-md border border-border bg-bg-card p-4">
      <summary className="flex cursor-pointer items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-primary">{course.title}</div>
          <div className="mt-1 flex gap-2 text-xs">
            <span className={`font-semibold ${canalColor}`}>{canalLabel}</span>
            <span className={course.active ? "text-green-400" : "text-text-muted"}>
              {course.active ? "● Activo" : "○ Inactivo"}
            </span>
          </div>
        </div>
      </summary>

      <div className="mt-4 space-y-4 border-t border-border pt-4">
        <form
          action={updateCourse}
          className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border p-3"
        >
          <input type="hidden" name="id" value={course.id} />
          <Field label="Título">
            <input type="text" name="title" defaultValue={course.title} required className="input" />
          </Field>
          <Field label="Canal">
            <select name="canal" defaultValue={course.canal} className="input">
              <option value="iarcania">IArcanIA</option>
              <option value="voidstoic">Void Stoic</option>
            </select>
          </Field>
          <Field label="Estado">
            <select name="active" defaultValue={String(course.active)} className="input">
              <option value="true">Activo (visible)</option>
              <option value="false">Inactivo (oculto)</option>
            </select>
          </Field>
          <Field label="Thumbnail URL">
            <input type="text" name="thumbnailUrl" defaultValue={course.thumbnailUrl ?? ""} className="input w-48" />
          </Field>
          <Field label="Orden">
            <input type="number" name="orden" defaultValue={course.orden} className="input w-16" />
          </Field>
          <Field label="Descripción">
            <input type="text" name="description" defaultValue={course.description ?? ""} className="input w-64" />
          </Field>
          <button
            type="submit"
            className="rounded-sm bg-gradient-cta px-3 py-1.5 text-sm font-semibold text-white shadow-glow-purple"
          >
            Guardar curso
          </button>
          <button
            type="submit"
            formAction={deleteCourse}
            className="rounded-sm border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:border-red-400"
          >
            Eliminar
          </button>
        </form>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Clases ({courseLessons.length})
          </h3>
          {courseLessons.length === 0 ? (
            <p className="text-xs text-text-muted">Sin clases todavía</p>
          ) : (
            <div className="space-y-2">
              {courseLessons.map((l, i) => (
                <LessonRow key={l.id} lesson={l} index={i} />
              ))}
            </div>
          )}
          <form
            action={createLesson}
            className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3"
          >
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Título de la clase">
              <input type="text" name="title" required className="input" />
            </Field>
            <Field label="Video (Drive)">
              <input type="url" name="videoUrl" className="input w-48" />
            </Field>
            <Field label="Tier">
              <select name="tierRequired" defaultValue="gratis" className="input">
                <option value="gratis">Gratis</option>
                <option value="plus">Plus</option>
                <option value="pro">Pro</option>
              </select>
            </Field>
            <Field label="Min">
              <input type="number" name="durationMin" className="input w-16" />
            </Field>
            <button
              type="submit"
              className="rounded-sm border border-border px-3 py-1.5 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
            >
              + Agregar clase
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}

function LessonRow({ lesson, index }: { lesson: Lesson; index: number }) {
  return (
    <details className="rounded-md border border-border bg-bg-deep/40 p-3">
      <summary className="flex cursor-pointer items-center gap-2">
        <span className="w-5 text-xs text-text-muted">{index + 1}.</span>
        <div className="flex-1">
          <div className="text-sm text-text-primary">{lesson.title}</div>
          <div className="mt-0.5 flex gap-2 text-xs text-text-muted">
            <span className={TIER_COLOR[lesson.tierRequired]}>{lesson.tierRequired}</span>
            {lesson.durationMin && <span>· {lesson.durationMin} min</span>}
            {lesson.videoUrl ? (
              <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="text-purple-light">
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
        <Field label="Título">
          <input type="text" name="title" defaultValue={lesson.title} required className="input" />
        </Field>
        <Field label="Video (Drive)">
          <input type="url" name="videoUrl" defaultValue={lesson.videoUrl ?? ""} className="input w-48" />
        </Field>
        <Field label="Tier">
          <select name="tierRequired" defaultValue={lesson.tierRequired} className="input">
            <option value="gratis">Gratis</option>
            <option value="plus">Plus</option>
            <option value="pro">Pro</option>
          </select>
        </Field>
        <Field label="Min">
          <input type="number" name="durationMin" defaultValue={lesson.durationMin ?? ""} className="input w-16" />
        </Field>
        <Field label="Orden">
          <input type="number" name="orden" defaultValue={lesson.orden} className="input w-16" />
        </Field>
        <button
          type="submit"
          className="rounded-sm border border-border px-2 py-1 text-xs text-text-muted hover:border-purple-mid hover:text-text-primary"
        >
          Guardar
        </button>
        <button
          type="submit"
          formAction={deleteLesson}
          className="rounded-sm border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:border-red-400"
        >
          Eliminar
        </button>
      </form>
    </details>
  );
}
