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
import { income } from "./dinero";

// Presupuesto (pestaña "Presupuesto" de crm.html/js/crm.js) — categorías
// con prioridad + meta mensual. Cada ingreso nuevo se reparte automáticamente
// entre las categorías con déficit, en orden de prioridad (ver
// budgetDistributions). El original guardaba una fila de `budgets` por
// mes/año (no reutilizaba la del mes anterior), así que se conserva ese
// mismo modelo — "editar" un presupuesto es crear una fila nueva del
// mes/año activos, no mutar la de un mes pasado.
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    priority: integer("priority").notNull().default(1),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userMonthIdx: index("budgets_user_month_idx").on(t.userId, t.year, t.month),
  }),
);

// Reparto real de un ingreso entre presupuestos — se genera automáticamente
// al confirmar un ingreso (Presupuesto o Pipeline), nunca a mano.
export const budgetDistributions = pgTable(
  "budget_distributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    incomeId: uuid("income_id")
      .notNull()
      .references(() => income.id, { onDelete: "cascade" }),
    amountAssigned: numeric("amount_assigned", { precision: 12, scale: 2, mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    budgetIdx: index("budget_distributions_budget_idx").on(t.budgetId),
    incomeIdx: index("budget_distributions_income_idx").on(t.incomeId),
  }),
);

// Deudas personales (pestaña "Deudas"). El original solo mostraba deudas
// `status='active'` sin ningún formulario de alta/pago visible en
// crm.html/js/crm.js — se agregan create/registrar-pago/delete aquí, mismo
// criterio usado en todo el resto de la migración ("siempre dar un
// formulario de alta" — Cuentas, chore_types, etc.).
export const debts = pgTable(
  "debts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    creditor: text("creditor").notNull(),
    debtor: text("debtor").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    remainingAmount: numeric("remaining_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2, mode: "number" }),
    dueDate: date("due_date"),
    notes: text("notes"),
    // 'active' | 'paid'
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("debts_user_idx").on(t.userId),
    statusCheck: check("debts_status_chk", sql`${t.status} IN ('active','paid')`),
  }),
);
