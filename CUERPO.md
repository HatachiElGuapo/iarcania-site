# Módulo Cuerpo — IArcanIA OS

---

## 1. Esquema (canónico, verificado en information_schema)

### `exercises`
| column_name  | data_type | notas |
|---|---|---|
| id           | text      | PK, patrón `'ex_'+Date.now()+'_'+random` |
| user_id      | text      | slug del usuario (u1, u2) |
| name         | text      | nombre del ejercicio |
| type         | text      | `'fuerza'` \| `'cardio'` \| `'peso_corporal'` |
| muscle_group | text      | grupo muscular, opcional |
| is_active    | boolean   | desactivar en vez de borrar |
| sort_order   | integer   | orden en la lista |
| created_at   | timestamptz | |

### `workout_logs`
| column_name  | data_type | notas |
|---|---|---|
| id           | text      | PK, patrón `'wl_'+Date.now()+'_'+random` |
| user_id      | text      | slug del usuario |
| exercise_id  | text      | FK conceptual a exercises.id |
| date         | date      | fecha de la sesión |
| set_number   | integer   | número de serie (auto-incrementa por ejercicio+fecha); null para cardio |
| reps         | integer   | repeticiones; null para cardio |
| weight       | numeric   | peso en kg; null para cardio o peso corporal |
| duration_min | numeric   | minutos; solo cardio |
| distance_km  | numeric   | distancia; solo cardio |
| notes        | text      | opcional |
| created_at   | timestamptz | |

> Una fila por serie. Tres series de press banca = tres filas con set_number 1, 2, 3.

### `body_metrics`
| column_name  | data_type | notas |
|---|---|---|
| id           | text      | PK, patrón `'bm_'+Date.now()+'_'+random` |
| user_id      | text      | slug del usuario |
| date         | date      | |
| weight_kg    | numeric   | |
| sleep_hours  | numeric   | horas de sueño |
| body_fat_pct | numeric   | porcentaje de grasa, opcional |
| notes        | text      | opcional |
| created_at   | timestamptz | |

> **UNIQUE(user_id, date)** — un registro de métricas por usuario por día. El front hace INSERT si no existe, UPDATE si ya hay fila (detectado en `_cTodayMetric`). No usa `upsert()` de Supabase para evitar depender del constraint name en el SDK.

---

## 2. Seguridad / RLS

**Flujo de autenticación:**

1. `doLogin()` llama `SB_P.auth.signInWithPassword()` (os.html:1956).
2. El SDK guarda el JWT de sesión en `localStorage` automáticamente.
3. Desde ese momento, todas las llamadas a `SB_P` llevan `Authorization: Bearer <session_token>` — no la anon key, sino el token de usuario autenticado.
4. `auth.uid()` en Supabase toma valor (UUID del usuario en Supabase Auth).
5. `loadCurrentUserSlug()` (os.html:1982) resuelve ese UUID → slug corto: `USER_ID = data.id` (os.html:2000). `USER_ID` no está hardcodeado.

**Políticas RLS aplicadas a las 3 tablas:**

```sql
-- Patrón idéntico al resto del schema (activity_logs, etc.)
-- Reemplazar TABLE_NAME por exercises / workout_logs / body_metrics

ALTER TABLE TABLE_NAME ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_data" ON TABLE_NAME
  FOR ALL
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
```

- `exercises` usa el mismo patrón: `user_id` en exercises es el slug del dueño, no un catálogo global.
- Sin policy explícita de INSERT/UPDATE/DELETE separadas: `FOR ALL` cubre las cuatro operaciones con la misma condición.
- La anon key sola (sin sesión activa) devuelve `[]` en todas las tablas — correcto, RLS bloquea todo sin `auth.uid()`.

---

## 3. Arquitectura

**Estructura de archivos:**

```
os.html          → contenedor + nav + <script> solamente (3 líneas quirúrgicas)
js/cuerpo.js     → toda la lógica del módulo (estado, fetches, render, CRUD)
```

**Las 3 líneas en os.html:**
- Línea 425: botón de nav `showSection('cuerpo', this)`
- Línea 1248: `<div class="section" id="section-cuerpo"></div>`
- Línea 2129: hook en `showSection()` → `if(id === 'cuerpo') loadCuerpo()`
- Línea 8700: `<script src="js/cuerpo.js"></script>` (antes de slides.js)

**`js/cuerpo.js` es un script global (no `type="module"`):**  
Ve todos los globals de os.html (`SB_P`, `USER_ID`, `showToast`, `TODAY`, `selectedDate`) directamente vía `window`. No hay `import`/`export`. Mismo mecanismo que `js/slides.js`.

**Patrón a replicar para sacar peso del monolito:**  
Cualquier sección nueva (Alimentación con macros, Finanzas avanzada, etc.) debe seguir este mismo corte: os.html solo pone el contenedor vacío + entrada de nav + hook en `showSection()` + `<script src="js/nombre.js">`. Toda la lógica va en el `.js` separado.

**Principio de diseño:**  
Secciones de vida = data configurable por el usuario (qué ejercicios existen, qué métricas registrar).  
Motores de tracking = código reutilizable en el `.js` (cómo registrar series, cómo hacer UPSERT, cómo renderizar el sparkline).

---

## 4. Lecciones aprendidas

**`CREATE TABLE IF NOT EXISTS` miente.**  
Si la tabla ya existe con un esquema diferente, Supabase reporta "Success" sin tocar nada. Si se corre el SQL de creación sobre una tabla pre-existente con columnas distintas, el esquema real no cambia. Siempre verificar con:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'nombre_tabla'
ORDER BY ordinal_position;
```

Nunca confiar en el "Success" del SQL Editor como confirmación de esquema.

**Sin FKs declaradas a `users`.**  
El campo `user_id` en las 3 tablas es `text` sin foreign key declarada, igual que en el resto del schema (activity_logs, tasks, etc.). La integridad referencial la garantiza el RLS (un usuario solo puede escribir su propio `user_id`) y la lógica de app.

---

## 5. Pendientes

- **MCP tools con service key** (no anon) para que el agente de WhatsApp CEO pueda registrar entrenamientos por voz directamente en `workout_logs` y `body_metrics` sin pasar por el browser.
- **Conectar calorías/proteína** cuando la sección Alimentación se migre a su propio módulo. Hoy es completamente binaria: activity `a15` ("Alimentacion consciente") en `activity_logs`, campo `notes` con formato `"meal_type|descripción_libre"`. Sin columnas numéricas de macros en ninguna tabla.
