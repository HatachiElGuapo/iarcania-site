# Auditoría 2026-11-19 — solo lectura

Dos auditorías de solo lectura, sin cambios de código ni de datos: (1) caminos para
"agregar actividades para otro día" y (2) estado del esquema de base de datos. El SQL de
la sección 2.6 queda propuesto, **no ejecutado**.

---

## 1. Agregar actividades para otro día

### 1.1 Resumen del terreno

No existe un camino literal llamado "Agregar varias" en el Plan. Lo más parecido es
`replaceQueueItems` (`app/dashboard/plan/fases/actions.ts:294-335`), un textarea que
reescribe toda una cola de `plan_queue_items` — gestiona la *plantilla recurrente* de una
cola, no "elegir 3 acciones puntuales para mañana".

"Mover" sí existe tal cual, en dos variantes de UI casi idénticas que llaman a las mismas
Server Actions. `plan_overrides`, `plan_queues`/`plan_queue_items`, `tasks.due_date` y
`agenda_items` existen y se usan activamente; todas convergen en `lib/agenda/day-events.ts`.

### 1.2 Camino por camino

| Camino | UI | Server Action (archivo) | Tabla(s) escrita(s) | Cómo se lee después en "Tu día"/Agenda | Bugs / duplicación |
|---|---|---|---|---|---|
| **Mover bloque de Plan a otro día** | `app/dashboard/plan/move-to-tomorrow-button.tsx` (escritorio) y `app/dashboard/plan/block-menu.tsx` (móvil, "⋯") | `moveBlock` (`plan/actions.ts:604-665`), `moveBlockToEndOfQueue` (`:674-739`), `moveBlockForDay` (`:519-569`, solo reprograma dentro del mismo día) | `planOverrides` siempre; además `tasks` **solo si el bloque no tiene cola** (`queueId` null) | Bloques con cola: `lib/plan/resolve.ts` vía `day-events.ts:157-237`. Bloques sin cola: `dueTodayTasks` en `day-events.ts:252-261` | UI duplicada 2×. Comportamiento bifurcado: mover un bloque sin cola lo convierte en una `tasks` row genérica (pierde persona/checks/kind de Plan); mover uno con cola solo oculta ocurrencias intermedias vía `planOverrides.deferredQueueItem`, sin copiar contenido a ningún lado. `moveBlock` no limita cuán lejos puede ser `targetDate`, y el bucle de `:638-647` puede generar muchas filas `planOverrides` si la fecha elegida está muy lejos. |
| **Reagendar tarea suelta** | `app/dashboard/actividades/page.tsx` (alta, con atajos "hoy"/"mañana" en líneas 74-88), `app/dashboard/day-row-menu.tsx:87-98` ("Guardar hora") | `createTask`, `rescheduleTask` (`:166-186`), `rescheduleOverdueTasks` (`:189-212`), `updateTaskSchedule` (`:67-...`) — todas en `app/dashboard/actividades/actions.ts` | `tasks.due_date` / `tasks.time_due` | `day-events.ts:252-261`/`332-347` (`dueTodayTasks`/`taskEvents`, fallback 12:00 si no tiene hora) o `blockEvents` (`:280-313`) si ya tiene fila en `agenda_items` | Es el camino más simple y robusto de los seis — sin bugs detectados. |
| **`plan_overrides`** (soporte, no un camino propio) | — | `setOverride` (`:455-474`, editar texto un día), `removeForDay` (`:477-495`, ocultar un bloque un día), `clearOverride` (`:742+`) | `plan_overrides` | `resolve.ts` → `day-events.ts` | Bien diseñada; el flag `deferredQueueItem` es una distinción sutil pero necesaria y ya documentada en el propio schema (`plan.ts:267-280`). |
| **Colas (`plan_queues`/`plan_queue_items`)** | `app/dashboard/plan/fases/page.tsx` (`addQueueItem`, `replaceQueueItems`) | `plan/fases/actions.ts:149,294` | `plan_queue_items`, `plan_queue_cursors` | `resolve.ts` → `day-events.ts` | Correcta para la plantilla recurrente; no debe competir como vehículo de "mañana". |
| **`agenda_items`** | `app/dashboard/agenda/page.tsx` + `day-grid.tsx` (grilla por fecha) | `createBlock`, `updateBlock`, `deleteBlock`, `moveBlock`, `scheduleHabit` — `app/dashboard/agenda/actions.ts` | `agenda_items` | `day-events.ts:92-97,280-313` (prioridad máxima sobre tareas/hábitos virtuales) | **Choque de nombres**: `agenda/actions.ts:67` exporta `moveBlock(input:{id,blockTime,duration})` y `plan/actions.ts:604` exporta `moveBlock(input:{date,blockId,text,targetDate})` — mismo nombre, firmas y tablas totalmente distintas. No colisiona en build (archivos distintos) pero es una trampa real de mantenimiento; `move-to-tomorrow-button.tsx:6` ya importa el de Plan. Además, agendar algo futuro vía `agenda_items` exige navegar la grilla día por día — no hay atajo "mañana" desde hoy. |
| **Hábitos virtuales de Plan** (no pedido, relevante como contraste) | — | — | `activities` (lectura), `activity_logs` | `day-events.ts:119-129,270-278` | Es recurrencia diaria, no "acciones puntuales de mañana" — fuera de alcance. |

### 1.3 Recomendación: un solo camino

**El único camino que debería usarse para "elegir mis 3 acciones de mañana" es el de
tareas sueltas (`tasks.due_date`)**:

1. Es el único que `day-events.ts` ya trata como ciudadano de primera clase incluso sin
   bloque de agenda explícito — el comentario en `day-events.ts:65-73` deja constancia de
   que esto se agregó a propósito para resolver justo este caso.
2. Modelo de datos uniforme: una fila = una acción futura, sin bifurcarse según si "tiene
   cola" o no (como sí le pasa a "mover un bloque de Plan").
3. Ya tiene atajos de UI para "hoy"/"mañana" (`actividades/page.tsx:74-81`); solo falta
   exponerlos en un lugar más visible (ej. un botón "+ Agregar para mañana" en
   `/dashboard` mismo).

**Qué fusionar o eliminar para llegar ahí limpio:**

- Eliminar la rama "bloque con cola" de `moveBlock` (`plan/actions.ts:628-664`) como forma
  de "mover a otro día" — es la más compleja (reescribe N `planOverrides` intermedios) y
  la que menos se parece al modelo de "elegir 3 acciones". Usar siempre la rama que ya
  existe e inserta en `tasks` (`:613-626`), incluso para bloques con cola: convertir el
  texto resuelto en una fila `tasks` y dejar que la cola simplemente no avance
  (comportamiento ya soportado por `removeForDay`, que sacrifica el item sin congelarlo).
- Fusionar `move-to-tomorrow-button.tsx` y `block-menu.tsx` en un solo hook/componente
  compartido — mismo JSX y lógica, solo cambia el shell visual escritorio/móvil.
- Renombrar una de las dos funciones `moveBlock` (Plan vs. Agenda) — mismo nombre para
  operaciones completamente distintas es la inconsistencia más peligrosa para
  mantenimiento futuro.
- Dejar `agenda_items` solo para lo que ya hace bien: materializar horario fino (bloques
  de 10 min) de algo que YA tiene fecha en `tasks`/`activities` — no como mecanismo para
  "crear" una actividad futura.
- No tocar `plan_overrides` ni `plan_queues`: son infraestructura correcta para la
  plantilla semanal recurrente de Plan, un problema distinto y ya bien resuelto.

---

## 2. Auditoría de la base de datos (Drizzle)

Alcance: 25 archivos en `lib/db/schema/`, 41 archivos `.sql` en `drizzle/`,
`drizzle/meta/_journal.json` con 41 entradas. `lib/db/schema/index.ts` es un barrel vacío
de re-exports, no define tablas.

### 2.1 Tablas por dominio

| Dominio | Archivo | Tablas (export → nombre SQL) |
|---|---|---|
| Auth/usuarios | `auth.ts` | `users`→user, `accounts`→account, `sessions`→session, `verificationTokens`→verificationToken |
| Plan / Agenda | `plan.ts`, `agenda.ts` | `plans`, `planPeople`→plan_people, `planPhases`→plan_phases, `planQueues`→plan_queues, `planQueueItems`→plan_queue_items, `planQueueCursors`→plan_queue_cursors, `planBlocks`→plan_blocks, `planHolidays`→plan_holidays, `planEvents`→plan_events, `planBlockActivities`→plan_block_activities, `planOverrides`→plan_overrides, `planChecks`→plan_checks, `agendaItems`→agenda_items |
| Hábitos | `habitos.ts` | `activities`, `activityQueueItems`→activity_queue_items, `activityLogs`→activity_logs |
| Trabajo/Tareas | `trabajo.ts` | `tasks`, `dailyFocus`→daily_focus, `workNotes`→work_notes |
| Dinero (personal) | `dinero.ts` | `financialAccounts`→**accounts**, `expenses`, `income`, `budgetCategories`→budget_categories, `budgetCategoryDistributions`→budget_category_distributions, `personalDebts`→personal_debts |
| CRM/Presupuesto (legacy v1) | `crm.ts` | `budgets`, `budgetDistributions`→budget_distributions, `debts` |
| Agencia (negocio IArcanIA) | `agencia.ts` | `agencyClients`→**crm_clients**, `agencyPayments`→**crm_payments** |
| Clientes (freelance personal) | `clientes.ts` | `clients`, `projects`, `payments`, `invoices` |
| Facturas | `facturas.ts` | `bills`, `billPayments`→bill_payments |
| Cuerpo | `cuerpo.ts` | `exercises`, `workoutLogs`→workout_logs, `bodyMetrics`→body_metrics |
| Nutrición | `nutricion.ts` | `meals`, `nutritionTargets`→nutrition_targets |
| Hogar | `hogar.ts` | `choreTypes`→chore_types, `choreLogs`→chore_logs |
| Citas | `citas.ts` | `appointments` |
| Eventos | `eventos.ts` | `eventTypes`→event_types, `eventOccurrences`→event_occurrences |
| Personas | `personas.ts` | `people`, `importantDates`→important_dates |
| Brújula | `brujula.ts` | `lifeAreas`→life_areas, `lifeProjects`→life_projects |
| Metas (compras) | `metas.ts` | `purchaseGoals`→purchase_goals |
| Escuela | `escuela.ts` | `courses`, `lessons`, `students` |
| Libros | `libros.ts` | `books`, `bookChapters`→book_chapters, `bookCharacters`→book_characters, `bookScenarios`→book_scenarios, `bookNotes`→book_notes |
| Guiones | `guiones.ts` | `scripts`, `scriptDerivados`→script_derivados, `scriptSlides`→script_slides |
| Ideas | `ideas.ts` | `ideas` |
| Recursos | `recursos.ts` | `recursos`, `recursosSensibles`→recursos_sensibles |
| Marco | `marco.ts` | `marcoDocuments`→marco_documents |
| Brands | `brands.ts` | `brands` |

### 2.2 Tablas candidatas a borrar (uso real = 0 por nombre fuera del schema)

**Ninguna tabla está realmente sin uso.** El único grupo con 0 hits por import nombrado es
`sessions`, `verificationTokens` y `accounts` (de `auth.ts`) — pero se usan implícitamente
vía `DrizzleAdapter(db)` en `lib/auth.ts:12`, que opera sobre el schema completo por
convención de nombre SQL (`user`/`account`/`session`/`verificationToken`), no por import.
Borrarlas rompería login OAuth/credenciales. **No hay candidatas a borrar.**

### 2.3 Tablas `*_backup_*` o duplicadas

No se encontró ninguna tabla con `backup`/`_old`/`_bak` en su nombre SQL, ni en el schema
ni en las migraciones.

Hay 3 pares de nombres que *parecen* duplicados pero son separaciones de dominio
deliberadas, documentadas inline por quien escribió el schema, y **ambos lados de cada par
están en uso activo**:

| Par | A | B | Nota |
|---|---|---|---|
| `account` (NextAuth) vs `accounts` (dinero) | `auth.ts:32` export `accounts`→tabla SQL `"account"` | `dinero.ts:23` export `financialAccounts`→tabla SQL `"accounts"` | Comentario en `dinero.ts:17-21` explica el choque de nombre a propósito. |
| `clients` vs `agencyClients`/`crm_clients` | `clientes.ts:26` (freelance personal) | `agencia.ts:22` (negocio IArcanIA) | Comentario en `agencia.ts:13-19`. |
| `payments` vs `agencyPayments`/`crm_payments` | `clientes.ts:98` | `agencia.ts:52` | Mismo criterio que el par anterior. |

Un cuarto caso, **sí es deuda técnica reconocida** (no un bug de auditoría): `crm.ts`
(`budgets`/`budget_distributions`/`debts`, modelo por mes/año) convive con `dinero.ts`
(`budgetCategories`/`budgetCategoryDistributions`/`personalDebts`, modelo "categoría
viva"). El propio comentario en `dinero.ts:109-115` dice que conviven "hasta que se decida
el modelo nuevo". Candidato a consolidación futura, pero ambos están activos hoy.

### 2.4 Columnas filtradas sin índice dedicado

| Tabla | Columna | Evidencia de filtro frecuente | Nota |
|---|---|---|---|
| `tasks` | `status` | `app/dashboard/actividades/page.tsx:155,228,232`, `app/dashboard/page.tsx:157`, `app/dashboard/brujula/page.tsx:117`, `app/dashboard/trabajo/page.tsx:56` | `tasks_user_due_date_idx` cubre `(userId, dueDate)` pero varios filtros son solo `(userId, status)` sin `dueDate`. |
| `tasks` | `category` | `app/dashboard/actividades/page.tsx:210,221` | Sin índice que cubra `(userId, category)`. |
| `activities` | `isActive` + `frequency` (compuesto) | `app/dashboard/habitos/page.tsx:44-45`, `app/dashboard/habitos/actions.ts:379-380` | Solo existe `activities_user_idx` sobre `userId`; un índice compuesto `(userId, isActive, frequency)` sería más preciso. |

El resto de tablas de alto uso (`plan.ts`, `dinero.ts`) tiene índices que ya cubren los
patrones de filtro reales — sin gaps detectados ahí. Dado el volumen de datos (app
personal, no multiusuario masivo), ninguno de estos gaps es urgente.

### 2.5 FKs faltantes

Escaneo exhaustivo de toda columna `uuid("*_id")` en los 25 archivos de schema: **solo una
columna sin `.references(...)`** — `agenda.ts:28` `itemId`. No es un olvido: el propio
comentario en `agenda.ts:13-17` explica que es una FK polimórfica deliberada (hoy solo
apunta a `tasks.id`; cuando se migren Citas/Hábitos, `itemType` sumará más destinos
posibles, por lo que no se puede fijar una sola `.references()`). **No hay FKs faltantes
por descuido** — el schema es disciplinado, cada `_id` real tiene su referencia con
`onDelete` explícito.

### 2.6 Registro de migraciones — `__drizzle_migrations`

- `drizzle/*.sql`: 41 archivos (`0000`…`0040`).
- `drizzle/meta/_journal.json`: 41 entradas (`idx` 0–40).
- `drizzle.config.ts` no define `migrationsSchema` ni `migrationsTable`, así que el
  default de Drizzle aplica: tabla **`drizzle.__drizzle_migrations`** (schema `drizzle`,
  no `public`). Confirmar con `\dt drizzle.*` antes de insertar, por si la base real usa
  un esquema distinto.
- Las dos últimas entradas del journal, pendientes de registrar (aplicadas a mano según lo
  indicado):
  ```json
  { "idx": 39, "version": "7", "when": 1793295422305, "tag": "0039_plan_queue_cursors", "breakpoints": true },
  { "idx": 40, "version": "7", "when": 1795053481680, "tag": "0040_aromatic_exodus",    "breakpoints": true }
  ```
- El runner de Drizzle (`drizzle-orm/migrator.js`) calcula el hash como
  `sha256(contenido_completo_del_archivo_.sql_tal_cual_en_disco)` y hace:
  ```sql
  insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ($1, $2)
  ```
  con `$2` = el mismo milisegundo `when` del journal (no `now()`).
- Hashes sha256 verificados sobre el contenido real de los archivos en disco
  (`sha256sum drizzle/0039_plan_queue_cursors.sql drizzle/0040_aromatic_exodus.sql`):
  ```
  0039_plan_queue_cursors.sql → c5402b36a045a93dba5654038187ac037c70264d51f4916d1bfab8a9c5456917
  0040_aromatic_exodus.sql    → 6731f24be3bce1d6d5f79cf5fdf2c84e1844d3022c96fa8c1505115c07a41315
  ```
  (recalculados en esta sesión con `sha256sum`, no solo tomados del subagente — coinciden).

**SQL propuesto para registrar las dos migraciones sin re-ejecutarlas (NO corrido):**

```sql
insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values
  ('c5402b36a045a93dba5654038187ac037c70264d51f4916d1bfab8a9c5456917', 1793295422305),
  ('6731f24be3bce1d6d5f79cf5fdf2c84e1844d3022c96fa8c1505115c07a41315', 1795053481680);
```

Antes de correrlo contra la base real: confirmar que el esquema `drizzle` existe ahí (si
las migraciones anteriores se aplicaron con `drizzle-kit migrate`, ya debería existir) y
que las 39 filas actuales tienen exactamente esos mismos hashes para `0000`…`0038` (si no,
el historial ya está desalineado por otra razón y conviene investigar antes de agregar
estas dos filas).
