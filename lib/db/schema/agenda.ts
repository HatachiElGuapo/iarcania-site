import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// Bloques de 10 minutos. item_id es una referencia polimórfica opcional (por
// ahora solo a tasks.id — cuando se migren Citas/Hábitos, item_type sumará
// 'cita'/'habito' apuntando a esas tablas). Sin CHECK en item_type a
// propósito: es un campo extensible, igual que en el original (Supabase
// tampoco lo forzaba).
export const agendaItems = pgTable(
  "agenda_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    // "HH:MM", slot de 10 min
    blockTime: text("block_time").notNull(),
    itemId: uuid("item_id"),
    // 'task' | 'nota' hoy — 'cita' | 'habito' cuando se migren esas secciones
    itemType: text("item_type").notNull().default("nota"),
    duration: integer("duration").notNull().default(20),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDateIdx: index("agenda_items_user_date_idx").on(t.userId, t.date),
    noDuplicateItem: uniqueIndex("agenda_items_unique_slot_item_idx").on(
      t.userId,
      t.date,
      t.blockTime,
      t.itemId,
    ),
  }),
);
