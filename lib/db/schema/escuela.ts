import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    // 'iarcania' | 'voidstoic'
    canal: text("canal").notNull().default("iarcania"),
    active: boolean("active").notNull().default(false),
    thumbnailUrl: text("thumbnail_url"),
    orden: integer("orden").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("courses_user_idx").on(t.userId),
    canalCheck: check(
      "courses_canal_chk",
      sql`${t.canal} IN ('iarcania','voidstoic')`,
    ),
  }),
);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    videoUrl: text("video_url"),
    // 'gratis' | 'plus' | 'pro'
    tierRequired: text("tier_required").notNull().default("gratis"),
    durationMin: integer("duration_min"),
    orden: integer("orden").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    courseIdx: index("lessons_course_idx").on(t.courseId),
    tierCheck: check(
      "lessons_tier_chk",
      sql`${t.tierRequired} IN ('gratis','plus','pro')`,
    ),
  }),
);

// Alumnos de los cursos — el registro real ocurre desde la página pública
// (escuela.html, pendiente de consolidar); esta tabla y la vista admin solo
// gestionan el tier de estudiantes ya existentes, igual que el original.
export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    email: text("email").notNull(),
    // 'gratis' | 'plus' | 'pro'
    tier: text("tier").notNull().default("gratis"),
    isFounder: boolean("is_founder").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("students_user_idx").on(t.userId),
    tierCheck: check(
      "students_tier_chk",
      sql`${t.tier} IN ('gratis','plus','pro')`,
    ),
  }),
);
