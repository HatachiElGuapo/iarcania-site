import { pgTable, uuid, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rawContent: text("raw_content").notNull(),
    // Pensado para enriquecimiento futuro por IA — no se genera todavía.
    processedContent: text("processed_content"),
    source: text("source").notNull().default("text"),
    // 'nueva' | 'procesada'
    status: text("status").notNull().default("nueva"),
    // Vocabulario compartido con CATS en el os.js original: iarcania,
    // contenido, proyectos, personal, infra, habitos. No forzado por CHECK
    // (igual criterio que category en expenses) para no bloquear categorías
    // nuevas que se agreguen desde la UI más adelante.
    category: text("category"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("ideas_user_idx").on(t.userId),
    statusCheck: check(
      "ideas_status_chk",
      sql`${t.status} IN ('nueva','procesada')`,
    ),
  }),
);
