import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  date,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// Dominio personal/freelance (SB_P del original). Corrección tras leer
// crm.html/js/crm.js completos: NO son el CRM de agencia como se asumió al
// migrar Clientes — crm.js conecta al mismo SB_P y reutiliza estas mismas
// tablas (clients/projects/income), agregando Pipeline (embudo de ventas,
// ver columnas de stage abajo) y Presupuesto (ver crm.ts). El nombre
// "crm_clients/crm_payments" reservado en una nota anterior nunca llegó a
// crearse como tabla — no hace falta, es el mismo dominio.
// El original solo LEÍA de aquí (loadClientesDashboard) — la única función
// de guardado que existía (saveClient) escribía por error al proyecto de
// agencia. Se construye CRUD completo real, no un dashboard de solo lectura.
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    business: text("business"),
    service: text("service"),
    // 'activo' | 'inactivo' | 'pausado'
    status: text("status").notNull().default("activo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("clients_user_idx").on(t.userId),
    statusCheck: check(
      "clients_status_chk",
      sql`${t.status} IN ('activo','inactivo','pausado')`,
    ),
  }),
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Nullable a diferencia del resto de FKs a clients: Pipeline (CRM)
    // permite crear un deal sin cliente asignado todavía ("Sin cliente" en
    // el original) — Clientes (createProject) siempre provee uno igual.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'activo' | 'completado' — ciclo de vida visto desde Clientes, no tiene
    // relación con `stage` (embudo de ventas, ver CRM/Pipeline más abajo):
    // un deal "ganado" no cambia esto automáticamente, y "completar" un
    // proyecto tampoco mueve el stage. Son dos ejes independientes sobre la
    // misma fila — el original (crm.js) no tenía este campo, se agregó
    // durante la migración de Clientes antes de que existiera Pipeline.
    status: text("status").notNull().default("activo"),
    // Columnas de Pipeline (CRM) — el `projects` del original crm.js no
    // tenía `status`, pero sí este embudo de ventas. Nullable/con default
    // para no afectar los proyectos ya creados desde Clientes.
    // 'contacted' | 'demo' | 'proposal' | 'negotiation' | 'won' | 'lost'
    stage: text("stage").notNull().default("contacted"),
    value: numeric("value", { precision: 12, scale: 2, mode: "number" }),
    // 'custom_agent' | 'family_os'
    serviceType: text("service_type"),
    anticipoPct: integer("anticipo_pct").notNull().default(50),
    anticipoPaid: boolean("anticipo_paid").notNull().default(false),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clientIdx: index("projects_client_idx").on(t.clientId),
    statusCheck: check(
      "projects_status_chk",
      sql`${t.status} IN ('activo','completado')`,
    ),
    stageCheck: check(
      "projects_stage_chk",
      sql`${t.stage} IN ('contacted','demo','proposal','negotiation','won','lost')`,
    ),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // 'pagado' | 'pendiente' | 'vencido'
    status: text("status").notNull().default("pendiente"),
    dueDate: date("due_date"),
    paidDate: date("paid_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clientIdx: index("payments_client_idx").on(t.clientId),
    statusCheck: check(
      "payments_status_chk",
      sql`${t.status} IN ('pagado','pendiente','vencido')`,
    ),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // 'pendiente' | 'vencido' | 'pagado'
    status: text("status").notNull().default("pendiente"),
    dueDate: date("due_date").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clientIdx: index("invoices_client_idx").on(t.clientId),
    statusCheck: check(
      "invoices_status_chk",
      sql`${t.status} IN ('pendiente','vencido','pagado')`,
    ),
  }),
);
