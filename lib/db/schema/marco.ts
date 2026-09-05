import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

// Los documentos personales de Marco (Misión, Propósito, Compromisos de
// vida, Filosofías): pensados para leerse a diario y para imprimirse. El
// texto lleva marcas inline {color:frase} — ver app/dashboard/marco/marked.tsx
// para el parser y los 6 colores válidos (rojo/verde/azul/morado/rosa/
// naranja). `format` decide cómo se renderiza `content`: 'prosa' es un
// bloque corrido, 'lista' es una línea por ítem.
export const marcoDocuments = pgTable(
  "marco_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 'mision' | 'proposito' | 'compromisos' | 'filosofias'
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // 'prosa' | 'lista'
    format: text("format").notNull().default("prosa"),
    // Lead-in opcional antes de una lista (ej. "Me comprometo a:").
    intro: text("intro"),
    content: text("content").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("marco_documents_user_idx").on(t.userId),
    userSlugIdx: uniqueIndex("marco_documents_user_slug_idx").on(
      t.userId,
      t.slug,
    ),
    formatCheck: check(
      "marco_documents_format_chk",
      sql`${t.format} IN ('prosa','lista')`,
    ),
  }),
);
