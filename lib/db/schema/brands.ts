import { pgTable, bigint, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// La tabla `brands` ya existe en la base (scripts/migrations/008-010). La app
// SOLO la lee — nunca inserta ni actualiza filas — así que aquí no se declara
// la estrategia de identidad de `id` (en la DB es `bigint generated always as
// identity`). Si en el futuro se administra desde Drizzle, regenerar con
// `db:generate` y revisar el diff (NO dejar que emita un CREATE TABLE nuevo).
//
// `tono_de_voz` NO está en la migración 008 original — lo agrega
// scripts/migrations/011 (ver ese archivo). Se declara aquí para tener el
// tipo disponible; si la columna aún no existe en tu DB, córrela primero.

export type BrandColores = {
  fondo?: string;
  primario?: string;
  texto?: string;
  acento?: string;
};

export const brands = pgTable("brands", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  nombre: text("nombre").notNull(),
  colores: jsonb("colores").$type<BrandColores>(),
  tipografia: text("tipografia"),
  logoUrl: text("logo_url"),
  tonoDeVoz: text("tono_de_voz"),
  config: jsonb("config").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
