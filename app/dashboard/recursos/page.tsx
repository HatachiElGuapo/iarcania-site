import { desc, eq, type InferSelectModel } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { recursos, recursosSensibles } from "@/lib/db/schema/recursos";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/app/page-header";
import { createRecurso, updateRecurso, deleteRecurso } from "./actions";

type Recurso = InferSelectModel<typeof recursos>;

const RECURSOS_TIPOS: Record<string, { label: string; icon: string }> = {
  curso: { label: "Curso", icon: "🎓" },
  sop: { label: "SOP", icon: "📋" },
  prompt: { label: "Prompt", icon: "💬" },
  workflow: { label: "Workflow", icon: "⚙️" },
  plantilla: { label: "Plantilla", icon: "📄" },
  entregable: { label: "Entregable", icon: "📦" },
  json: { label: "JSON", icon: "🔧" },
  video: { label: "Video", icon: "▶️" },
  procedimiento: { label: "Procedimiento", icon: "📜" },
};

const ESTADO_COLOR: Record<string, string> = {
  vivo: "text-green-400",
  "en-progreso": "text-gold",
  pendiente: "text-text-muted",
  archivado: "text-text-dim",
};

const VISIBLE_PARA_OPTIONS = [
  { id: "admin", label: "Admin" },
  { id: "employee", label: "Equipo" },
  { id: "family", label: "Familia" },
  { id: "cliente", label: "Clientes" },
  { id: "estudiante", label: "Estudiantes" },
];

// Recursos es una biblioteca compartida (igual que en el original — la
// consulta nunca filtraba por user_id), no datos privados por usuario.
export default async function RecursosPage() {
  const session = await auth();
  const userId = session!.user.id;
  const isAdmin = session!.user.role === "admin";

  const list = await db.select().from(recursos).orderBy(desc(recursos.createdAt));

  const sensibles = isAdmin
    ? new Map(
        (await db.select().from(recursosSensibles)).map((s) => [s.recursoId, s.contenido]),
      )
    : new Map<string, string | null>();

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="Recursos" subtitle={`${list.length} recurso${list.length !== 1 ? "s" : ""}`} />

      {list.length === 0 ? (
        <p className="text-sm text-text-muted">Sin recursos todavía.</p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <RecursoRow
              key={r.id}
              recurso={r}
              canEdit={isAdmin || r.userId === userId}
              sensible={sensibles.get(r.id) ?? null}
              showSensible={isAdmin}
            />
          ))}
        </div>
      )}

      <details>
        <summary className="btn-secondary inline-flex w-fit cursor-pointer list-none">+ Nuevo recurso</summary>
        <RecursoForm action={createRecurso} isAdmin={isAdmin} />
      </details>
    </div>
  );
}

function RecursoRow({
  recurso,
  canEdit,
  sensible,
  showSensible,
}: {
  recurso: Recurso;
  canEdit: boolean;
  sensible: string | null;
  showSensible: boolean;
}) {
  const tipo = RECURSOS_TIPOS[recurso.tipo] ?? { label: recurso.tipo, icon: "📄" };
  const fecha = recurso.createdAt.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="card-glow p-4">
      <div className="flex items-center gap-3">
        <span className="text-lg">{tipo.icon}</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-primary">{recurso.titulo}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
            <span>{tipo.label}</span>
            <span className={ESTADO_COLOR[recurso.estado] ?? ""}>● {recurso.estado}</span>
            <span>Roles: {recurso.visiblePara.length ? recurso.visiblePara.join(", ") : "—"}</span>
            <span>{fecha}</span>
          </div>
        </div>
      </div>

      {recurso.contenido && (
        <p className="mt-2 whitespace-pre-wrap text-xs text-text-muted">{recurso.contenido}</p>
      )}

      {canEdit && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-text-muted">Editar</summary>
          <RecursoForm
            action={updateRecurso}
            recurso={recurso}
            sensible={sensible}
            isAdmin={showSensible}
          />
        </details>
      )}
    </div>
  );
}

function RecursoForm({
  action,
  recurso,
  sensible,
  isAdmin,
}: {
  action: (formData: FormData) => void;
  recurso?: Recurso;
  sensible?: string | null;
  isAdmin: boolean;
}) {
  return (
    <form action={action} className="card-glow mt-2 flex flex-wrap items-end gap-3 p-4">
      {recurso && <input type="hidden" name="id" value={recurso.id} />}
      <Field label="Título">
        <input type="text" name="titulo" defaultValue={recurso?.titulo} required className="input" />
      </Field>
      <Field label="Tipo">
        <select name="tipo" defaultValue={recurso?.tipo ?? "curso"} className="input">
          {Object.entries(RECURSOS_TIPOS).map(([key, t]) => (
            <option key={key} value={key}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Estado">
        <select name="estado" defaultValue={recurso?.estado ?? "vivo"} className="input">
          <option value="vivo">Vivo</option>
          <option value="en-progreso">En progreso</option>
          <option value="pendiente">Pendiente</option>
          <option value="archivado">Archivado</option>
        </select>
      </Field>
      <Field label="Nivel mínimo">
        <input type="text" name="nivelMin" defaultValue={recurso?.nivelMin ?? ""} className="input w-24" />
      </Field>

      <div className="flex w-full flex-wrap gap-3">
        {VISIBLE_PARA_OPTIONS.map((r) => (
          <label key={r.id} className="flex items-center gap-1.5 text-xs text-text-muted">
            <input
              type="checkbox"
              name={`vp_${r.id}`}
              defaultChecked={recurso?.visiblePara.includes(r.id)}
            />
            {r.label}
          </label>
        ))}
      </div>

      <textarea
        name="contenido"
        placeholder="Contenido"
        defaultValue={recurso?.contenido ?? ""}
        rows={3}
        className="input w-full"
      />

      {isAdmin && (
        <textarea
          name="sensible"
          placeholder="Contenido sensible (solo admin)"
          defaultValue={sensible ?? ""}
          rows={3}
          className="input w-full"
        />
      )}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Guardar
        </button>
        {recurso && (
          <button
            type="submit"
            formAction={deleteRecurso}
            className="rounded-sm border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:border-red-400"
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}
