import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// El original tenía un sistema de roles (admin/employee/family/cliente/
// estudiante) para visible_para y permisos de edición, pensado para un
// equipo/clientes reales que no existen todavía en este schema (solo hay
// users.role='admin'|'usuario'). Se simplifica: puede editar el dueño del
// recurso o un admin — ver actions.ts. visible_para se conserva como
// metadata informativa/filtrable, no como control de acceso real todavía.
export const recursos = pgTable(
  "recursos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titulo: text("titulo").notNull(),
    // 'curso' | 'sop' | 'prompt' | 'workflow' | 'plantilla' | 'entregable'
    tipo: text("tipo").notNull().default("curso"),
    // 'vivo' | 'en-progreso' | 'pendiente' | 'archivado'
    estado: text("estado").notNull().default("vivo"),
    nivelMin: text("nivel_min"),
    visiblePara: text("visible_para").array().notNull().default([]),
    contenido: text("contenido"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("recursos_user_idx").on(t.userId),
    tipoCheck: check(
      "recursos_tipo_chk",
      sql`${t.tipo} IN ('curso','sop','prompt','workflow','plantilla','entregable')`,
    ),
    estadoCheck: check(
      "recursos_estado_chk",
      sql`${t.estado} IN ('vivo','en-progreso','pendiente','archivado')`,
    ),
  }),
);

// 1:1 con recursos — contenido visible solo para admins.
export const recursosSensibles = pgTable("recursos_sensibles", {
  recursoId: uuid("recurso_id")
    .primaryKey()
    .references(() => recursos.id, { onDelete: "cascade" }),
  contenido: text("contenido"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
