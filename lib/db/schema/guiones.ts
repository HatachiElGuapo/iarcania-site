import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// El original modelaba el contenido del guión como "4 bloques" (b1-b4) solo
// en memoria del cliente; al guardar siempre se colapsaban a 3 columnas
// (hook, body, cta) — aquí se persiste directo en esas 3 columnas, sin el
// paso intermedio de bloques. Ver NOTES.md.
export const scripts = pgTable(
  "scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // 'iarcania' | 'voidstoic'
    canal: text("canal").notNull().default("iarcania"),
    // 'borrador' | 'en_progreso' | 'listo_grabar' | 'grabado' | 'publicado'
    status: text("status").notNull().default("borrador"),
    hook: text("hook"),
    body: text("body"),
    cta: text("cta"),
    notes: text("notes"),
    // Modo de edición preferido de este guión (Módulo Estudio): en el
    // cliente cambia solo la UX de escritura — los 3 modos colapsan igual a
    // hook/body/cta. 'libre' | 'bloques' | 'ia'
    modoPreferido: text("modo_preferido").notNull().default("bloques"),
    // Respuestas del wizard IA / notas de la última generación. Se guarda
    // aparte de `notes` (texto plano de producción) para no pisarlo.
    notasIa: text("notas_ia"),
    fechaGrabacion: date("fecha_grabacion"),
    fechaPublicacion: timestamp("fecha_publicacion", { withTimezone: true }),
    // Columnas de Planner (planner.html) — mismo `scripts` que Guiones, no
    // una tabla separada (leen/escriben el mismo SB_P.scripts en el
    // original). `fechaGrab` de Planner === `fechaGrabacion` de arriba, no
    // se duplica. Nullable/con default para no afectar el flujo de Guiones.
    formato: text("formato").notNull().default("Video largo"),
    // 'YouTube' | 'TikTok' | 'Instagram'
    plataformaOrigen: text("plataforma_origen").notNull().default("YouTube"),
    horaGrab: text("hora_grab"),
    horaPub: text("hora_pub"),
    videoUrl: text("video_url"),
    plataformas: text("plataformas").array().notNull().default([]),
    copyYtTitulo: text("copy_yt_titulo"),
    copyYtDescripcion: text("copy_yt_descripcion"),
    copyIgCaption: text("copy_ig_caption"),
    // {guion,imagenes,grabado,editado,thumbnail,publicado} booleanos
    checklist: jsonb("checklist").notNull().default({}),
    // {presentador:{html,filename}, audiencia:{html,filename}, generado_en}
    presData: jsonb("pres_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("scripts_user_idx").on(t.userId),
    canalCheck: check(
      "scripts_canal_chk",
      sql`${t.canal} IN ('iarcania','voidstoic')`,
    ),
    statusCheck: check(
      "scripts_status_chk",
      sql`${t.status} IN ('borrador','en_progreso','listo_grabar','grabado','publicado')`,
    ),
  }),
);

// Derivados (Planner) — piezas cortas recortadas de un guión largo (ej. un
// Short de TikTok cortado de un video de YouTube). El original las guardaba
// como array dentro de `scripts.notes` (JSON.stringify) junto con
// fechaGrab/horaGrab/steps/guion — overload de una columna de texto libre
// que además chocaba con el uso real de `notes` en Guiones (texto plano de
// producción). Aquí es una tabla propia, mismo criterio que Libros
// (capítulos/personajes/escenarios/notas como filas, no JSON embebido).
export const scriptDerivados = pgTable(
  "script_derivados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scriptId: uuid("script_id")
      .notNull()
      .references(() => scripts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 'YouTube' | 'TikTok' | 'Instagram'
    plataforma: text("plataforma").notNull(),
    formato: text("formato"),
    duracion: text("duracion"),
    // 'idea' | 'grabando' | 'editando' | 'publicado'
    estado: text("estado").notNull().default("idea"),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    scriptIdx: index("script_derivados_script_idx").on(t.scriptId),
    estadoCheck: check(
      "script_derivados_estado_chk",
      sql`${t.estado} IN ('idea','grabando','editando','publicado')`,
    ),
  }),
);

// Slides de un guión (Módulo Estudio). Deck visual que acompaña a la
// grabación / se muestra a la audiencia. `orden` es 0-based y contiguo
// (las server actions lo re-normalizan en cada mutación). `tipo` define el
// layout — ver lib/guiones/slides.ts y app/dashboard/guiones/slide-view.tsx.
export const scriptSlides = pgTable(
  "script_slides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scriptId: uuid("script_id")
      .notNull()
      .references(() => scripts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull().default(0),
    // 'portada' | 'punto' | 'cita' | 'dato' | 'cierre'
    tipo: text("tipo").notNull().default("punto"),
    textoPrincipal: text("texto_principal").notNull(),
    textoSecundario: text("texto_secundario"),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    scriptIdx: index("script_slides_script_idx").on(t.scriptId),
    tipoCheck: check(
      "script_slides_tipo_chk",
      sql`${t.tipo} IN ('portada','punto','cita','dato','cierre')`,
    ),
  }),
);
