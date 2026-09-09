import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { clients, projects } from "./clientes";

// A diferencia del original (3 cuentas hardcodeadas en el cliente:
// Bolsillo/Nequi/Bancolombia), aquí son gestionables por el usuario —
// mismo criterio que Cuerpo (ejercicios) y Trabajo (tareas): siempre dar un
// formulario de alta en vez de fijar valores en el código.
// Nombrada financialAccounts (no "accounts") para no chocar con el símbolo
// `accounts` que ya exporta auth.ts para la tabla OAuth de NextAuth
// ("account") — un `export *` con dos bindings del mismo nombre se
// descarta en silencio y drizzle-kit deja de ver la tabla.
export const financialAccounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon"),
    color: text("color"),
    balance: numeric("balance", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("accounts_user_idx").on(t.userId),
  }),
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // Categorías sugeridas en la UI (mercado/restaurantes/transporte/
    // servicios/salud/tecnologia/hogar/otros), no forzadas por CHECK — igual
    // que en el original, donde vivían solo del lado cliente.
    category: text("category").notNull(),
    description: text("description"),
    date: date("date").notNull(),
    accountId: uuid("account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index("expenses_user_date_idx").on(t.userId, t.date),
  }),
);

export const income = pgTable(
  "income",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    source: text("source").notNull(),
    description: text("description"),
    date: date("date").notNull(),
    accountId: uuid("account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    // Vínculo con CRM/Pipeline (crm.ts) — un ingreso puede venir de un pago
    // de cliente/deal registrado desde Pipeline. Nullable: el flujo normal
    // de Dinero (botón "+ Ingreso" en Gastos) no los usa.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    // true una vez que Presupuesto (crm.ts) repartió este ingreso entre
    // categorías vía budget_distributions.
    distributionApplied: boolean("distribution_applied").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index("income_user_date_idx").on(t.userId, t.date),
  }),
);

// ─────────────────────────────────────────────────────────────────────────
// Presupuesto v2 — modelo "categoría viva". Convive con el trío de crm.ts
// (budgets/budget_distributions/debts, por mes/año) hasta que se decida el
// modelo nuevo (objetivo de Brújula "Repensar la arquitectura de Dinero").
// Por eso los nombres son propios: no chocan con crm.ts en el barrel ni en
// SQL.
// ─────────────────────────────────────────────────────────────────────────

// Categoría de presupuesto con meta mensual + gasto corrido del mes. A
// diferencia de crm.budgets (una fila por mes/año), acá es una sola fila
// viva por categoría; `current_month_spent` se reinicia por proceso, no por
// fila nueva.
export const budgetCategories = pgTable(
  "budget_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // 'income' | 'expense'
    type: text("type").notNull().default("expense"),
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    currentMonthSpent: numeric("current_month_spent", { precision: 12, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    // 1 = más urgente.
    priority: integer("priority").notNull().default(10),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("budget_categories_user_idx").on(t.userId),
  }),
);

// Reparto de un ingreso entre categorías de presupuesto v2. Equivalente a
// crm.budgetDistributions pero apuntando a budget_categories en vez de
// budgets.
export const budgetCategoryDistributions = pgTable(
  "budget_category_distributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incomeId: uuid("income_id")
      .notNull()
      .references(() => income.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => budgetCategories.id, { onDelete: "cascade" }),
    amountAssigned: numeric("amount_assigned", { precision: 12, scale: 2, mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    incomeIdx: index("budget_category_distributions_income_idx").on(t.incomeId),
  }),
);

// Deudas personales/del hogar. Cercana a crm.debts pero sin `debtor` (acá el
// deudor siempre es la casa) ni CHECK sobre status.
export const personalDebts = pgTable(
  "personal_debts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // A quién se le debe.
    creditor: text("creditor").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    remainingAmount: numeric("remaining_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // Cuota mensual, si aplica.
    monthlyPayment: numeric("monthly_payment", { precision: 12, scale: 2, mode: "number" }),
    // Fecha límite, si aplica.
    dueDate: date("due_date"),
    // 'active' | 'paid'
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("personal_debts_user_idx").on(t.userId),
  }),
);
