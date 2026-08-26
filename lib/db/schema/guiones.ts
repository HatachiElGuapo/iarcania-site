import {
  pgTable,
  uuid,
  text,
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
    fechaGrabacion: date("fecha_grabacion"),
    fechaPublicacion: timestamp("fecha_publicacion", { withTimezone: true }),
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
