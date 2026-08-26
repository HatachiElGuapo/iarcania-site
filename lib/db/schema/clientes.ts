import {
  pgTable,
  uuid,
  text,
  numeric,
  date,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// Dominio personal/freelance — distinto del CRM de agencia (crm.ts,
// crm_clients/crm_payments) que vive en el otro Supabase del original. El
// original solo LEÍA de aquí (loadClientesDashboard) — la única función de
// guardado que existía (saveClient) escribía por error al proyecto de
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
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'activo' | 'completado'
    status: text("status").notNull().default("activo"),
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
