import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { eventTypes } from "./eventos";

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // 'medica' | 'odontologica' | 'reunion' | 'otro'
    type: text("type").notNull().default("otro"),
    datetime: timestamp("datetime", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    travelBeforeMinutes: integer("travel_before_minutes"),
    travelAfterMinutes: integer("travel_after_minutes"),
    location: text("location"),
    doctorName: text("doctor_name"),
    reminder1At: timestamp("reminder_1_at", { withTimezone: true }),
    reminder2At: timestamp("reminder_2_at", { withTimezone: true }),
    // 'pendiente' | 'completada' | 'cancelada'
    status: text("status").notNull().default("pendiente"),
    eventTypeId: uuid("event_type_id").references(() => eventTypes.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userDatetimeIdx: index("appointments_user_datetime_idx").on(
      t.userId,
      t.datetime,
    ),
    typeCheck: check(
      "appointments_type_chk",
      sql`${t.type} IN ('medica','odontologica','reunion','otro')`,
    ),
    statusCheck: check(
      "appointments_status_chk",
      sql`${t.status} IN ('pendiente','completada','cancelada')`,
    ),
  }),
);
