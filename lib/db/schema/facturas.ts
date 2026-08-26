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
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { financialAccounts } from "./dinero";

// Definición recurrente mensual de una factura.
export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    estimatedAmount: numeric("estimated_amount", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    dueDay: integer("due_day").notNull(),
    category: text("category"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("bills_user_idx").on(t.userId),
    dueDayCheck: check(
      "bills_due_day_chk",
      sql`${t.dueDay} BETWEEN 1 AND 28`,
    ),
  }),
);

// Pagos/cargos individuales contra una factura. "Pagada este mes" = existe
// una fila type='normal' con paid_date dentro del mes actual para ese bill.
export const billPayments = pgTable(
  "bill_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    paidDate: date("paid_date").notNull(),
    // 'normal' | 'cargo_extra'
    type: text("type").notNull().default("normal"),
    notes: text("notes"),
    notesExtra: text("notes_extra"),
    accountId: uuid("account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    billPaidDateIdx: index("bill_payments_bill_paid_date_idx").on(
      t.billId,
      t.paidDate,
    ),
    userIdx: index("bill_payments_user_idx").on(t.userId),
    typeCheck: check(
      "bill_payments_type_chk",
      sql`${t.type} IN ('normal','cargo_extra')`,
    ),
  }),
);
