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

// Dominio de agencia (SB_I del original) — proyecto Supabase distinto del
// personal/freelance (clientes.ts). Nombres reservados desde la nota
// "Dominios de datos con nombres duplicados" al inicio de la migración: se
// crean ahora para Cobros, el único lugar de la app que realmente usa este
// dominio (`SB_I.from('clients')`/`SB_I.from('payments')` en os.js — CRM y
// Planner, pese al nombre, resultaron ser SB_P personal, ver NOTES.md).
// El original (`saveClient`/`savePayment`) solo tenía insertar + leer, sin
// editar ni eliminar — se agregan aquí, mismo criterio de siempre.
export const agencyClients = pgTable(
  "crm_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    business: text("business"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    service: text("service"),
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    startDate: date("start_date"),
    // 'activo' | 'inactivo' | 'pausado' — mismo vocabulario que Clientes
    // (dominio personal), no existía en el original (nunca actualizaba
    // status tras el alta).
    status: text("status").notNull().default("activo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("crm_clients_user_idx").on(t.userId),
    statusCheck: check("crm_clients_status_chk", sql`${t.status} IN ('activo','inactivo','pausado')`),
  }),
);

export const agencyPayments = pgTable(
  "crm_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => agencyClients.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // 'pendiente' | 'pagado' | 'vencido'
    status: text("status").notNull().default("pendiente"),
    dueDate: date("due_date"),
    paidDate: date("paid_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clientIdx: index("crm_payments_client_idx").on(t.clientId),
    statusCheck: check("crm_payments_status_chk", sql`${t.status} IN ('pendiente','pagado','vencido')`),
  }),
);
