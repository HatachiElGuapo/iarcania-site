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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index("income_user_date_idx").on(t.userId, t.date),
  }),
);
