# Sección Plan en iarcania

Portar el "Plan de la casa" (artifact) al dashboard como sección de Productividad, con verificación diaria. Seguir los patrones ya usados en el proyecto: App Router, una ruta por sección, Server Actions con chequeo de dueño, Drizzle, UUID nativos, UI server-first (grilla + formularios, sin drag and drop).

Datos iniciales: `plan-seed.json` (formato del artifact: `people`, `queues`, `phases`, `hol`, `events`, `range`).

## Modelo

| Tabla | Campos |
|---|---|
| `plans` | id, owner_id → users, name, start_date, end_date |
| `plan_people` | id, plan_id, name, color, user_id (nullable: Diana no tiene login), sort |
| `plan_phases` | id, plan_id, name, start_date, end_date, goal, sort |
| `plan_queues` | id, plan_id, key, name, cyclic bool, global bool, fallback text |
| `plan_queue_items` | id, queue_id, phase_id (null si la cola es global), position, text |
| `plan_queue_cursors` | queue_id, phase_id (null si la cola es global), position — único (queue_id, phase_id), con dos índices parciales porque Postgres no trata dos NULL como iguales |
| `plan_blocks` | id, plan_id, person_id, weekday 0–6 (0 = lunes), start time, end time null, text, kind, tentative bool, is_minimum bool, queue_id null, holiday_text null |
| `plan_holidays` | plan_id, date |
| `plan_events` | id, plan_id, person_id null, date null, month_day null, start null, end null, text, kind |
| `plan_overrides` | plan_id, date, block_id, text null, removed bool, deferred_queue_item bool — único (date, block_id) |
| `plan_checks` | plan_id, date, block_id, person_id, status (`done` \| `skipped`), resolved_text, note, checked_at — único (date, block_id) |

`plan_queue_cursors` es la posición ACTUAL de cada cola (o cola+fase) — reemplaza el conteo histórico que tenía el resolver viejo (ver más abajo). Sin fila para un grupo, la posición es 0. No hay backfill automático al migrar: `/plan/fases` trae "ir al item N" para corregirla a mano una vez (`setQueueCursor` en `fases/actions.ts`).

`kind`: ingresos, juntos, cuidado, comida, casa, rutina, descanso, cita.

`resolved_text` guarda lo que decía el bloque al marcarlo. Si después se reordenan las listas, el historial no cambia.

## Resolver (`lib/plan/resolve.ts`)

Función pura, sin acceso a la base: recibe el plan completo y un rango de fechas (más un `today` opcional, ver abajo), devuelve por fecha la fase, si es festivo, las notas del día y los bloques resueltos de cada persona.

**La cola ya NO se calcula contando ocurrencias desde `plans.start_date`.** Arranca en lo que diga `plan_queue_cursors` y solo avanza cuando se MARCA una actividad (`setCheck` en `actions.ts`, hecho o saltado) — pedido explícito: si un día no se marca nada, al día siguiente sigue tocando la misma. Antes el resolver re-contaba todo el historial en cada llamada; ahora el cursor persistido YA es la posición real, así que el loop arranca directo en `fromDate`, sin recorrer desde el inicio del plan.

Reglas, en este orden:
1. Bloques del día = `plan_blocks` del weekday.
2. Festivo y el bloque tiene `holiday_text` → usar ese texto y no tocar la posición de la cola.
3. Bloque con cola → posición actual por (fase, cola), o solo por cola si es global, arrancando en `plan.queueCursors`. Toma el item en esa posición. Si la lista se acabó: cíclica vuelve a empezar; no cíclica usa `fallback`.
4. `plan_overrides` con `deferred_queue_item = true` (ver "Mover" más abajo) saltan la ocurrencia ANTES de tocar la posición — no cuenta como consumida. Los demás overrides (remover de verdad, cambio de texto) se aplican DESPUÉS.
5. Agregar `plan_events` del día (por fecha o por `month_day`), ordenar por hora.

**Pasado vs. proyección — el parámetro `today`:** dentro de UN mismo rango resuelto (ej. Agenda o una vista de varios días), los días `< today` usan la posición real SIN avanzarla (nunca se marcaron, así que el cursor real nunca se movió de ahí — mismo item en todos esos días). Los días `>= today` sí avanzan en memoria por cada ocurrencia (cursor+1, +2…), como una proyección especulativa ("si se marcara cada una en orden") — nunca se persiste nada de esto. Cada `ResolvedBlock` trae `isProjected` para que la UI pueda distinguir "lo real de hoy" de "la vista previa de más adelante". Si se omite `today`, el default es `fromDate` (todo el rango es "futuro" respecto de sí mismo — el comportamiento correcto para una consulta de un solo día, donde `fromDate === toDate`).

Tests unitarios (`lib/plan/resolve.test.ts`) con estos casos:
- Cursor en una posición dada → el item que corresponde a esa posición, sin importar la fecha real.
- Festivo con `holiday_text` → no toca la posición del cursor.
- Cola no cíclica con el cursor en el largo exacto de la lista → fallback.
- Dos días sin marcar nada → mismo item en ambos.
- Un rango de varios días con `today` en el medio → el primer día no proyecta, los siguientes sí (`isProjected`).
- Un override `deferredQueueItem` oculta la ocurrencia sin consumir la posición.

## Rutas

- `/plan` — Día. Por defecto hoy; flechas, selector de fecha y botón Hoy. Encabezado con fase, semana X de Y, meta y festivo. Grilla con una columna por persona. Cada bloque lleva un check (hecho / saltado / sin marcar) y un botón para cambiarlo solo ese día. Resumen: bloques hechos, mínimos cumplidos y horas de ingresos hechas.
- `/plan/semana` — Plantilla editable por weekday: crear, editar y eliminar bloques, "también en estos días", cola asignada y texto de festivo.
- `/plan/fases` — Fases (nombre, fechas, meta) y sus listas en textarea, una tarea por línea. Al guardar se reescriben las posiciones de esa cola. Cada cola muestra "Ir al item N" para fijar a mano la posición del cursor (`setQueueCursor`) — necesario porque la migración a `plan_queue_cursors` no hace backfill automático (arranca en 0 para toda cola existente).
- `/plan/historial` — Últimos 30 días: % de bloques hechos por día, por tipo y por persona; mínimos cumplidos por día; lista de lo saltado con su nota.

Solo el dueño del plan edita. `plan_people.user_id` permite, más adelante, que Diana vea su columna con su login.

## Server Actions

`setCheck(date, blockId, status | null, note?)`, `setOverride(date, blockId, text)`, `removeForDay(date, blockId)`, `clearOverride(date, blockId)`, `upsertBlock(...)`, `deleteBlock(id)`, `updatePhase(...)`, `replaceQueueItems(queueId, phaseId, lines[])`, `setQueueCursor(queueId, phaseId, itemNumber)`, `resetPlanStartDate(planId)`.

Todas validan que el plan pertenezca a la sesión.

### "Mover" una actividad de una cola (`app/dashboard/plan/actions.ts`)

Botón en la vista del día, en Rutinas y en el dashboard (⋯ de cada bloque, o los botones sueltos del panel "Cambiar solo hoy"), con tres opciones:

- **Mañana** / **elegir fecha** (`moveBlock({ date, blockId, text, targetDate })`): la actividad queda en la primera ocurrencia del weekday de ESE bloque en o después de `targetDate` (búsqueda hasta 7 días adelante — el weekday siempre vuelve a aparecer dentro de una semana). Como la cola ya no avanza por el paso de los días (solo al marcar), alcanza con OCULTAR las ocurrencias intermedias — hoy y cualquier otro bloque que comparta la misma cola entre hoy y la fecha de llegada — con un override `removed: true, deferredQueueItem: true`. Nada se pierde: la fecha de llegada no necesita ningún override, el resolver ya muestra ahí el mismo item porque la posición nunca se tocó. Si el bloque no viene de ninguna cola (texto fijo), se mantiene el comportamiento viejo: una tarea suelta con vencimiento en la fecha elegida.
- **Al final de la cola** (`moveBlockToEndOfQueue({ date, blockId })`): reordena `plan_queue_items` (mismo patrón que `deleteQueueItem` — renumera 0..n-1) poniendo el item actual (el que indica el cursor) último. NO toca el cursor: como las posiciones de los demás bajan un lugar, el cursor (que queda igual) pasa a apuntar al que antes era el siguiente item. Solo hace falta un override `deferredQueueItem` para ocultar la ocurrencia de HOY — la nueva posición se ve de inmediato al día siguiente (o incluso hoy mismo, si se vuelve a resolver sin la ocultación).

**Reversible:** `clearOverride(date, blockId)` borra el override de "Mover" (vuelve a mostrarse lo que decía la plantilla/cursor ese día). El reorden de "al final de la cola" se puede revertir a mano desde `/plan/fases` (↑/↓ de cada item). **Historial:** nada de esto toca `plan_checks` — lo que ya se marcó queda igual; "Mover" solo cambia qué se ve en adelante.

## Integraciones

- **Agenda:** mostrar los bloques resueltos del día en la Agenda existente. Aprovechar para cerrar los pendientes: rango de 00:00 a 24:00 cada 10 minutos y que las tareas creadas aparezcan en Agenda.
- **Dashboard · "Plan · sin marcar":** con el cursor de la cola, un bloque sin marcar YA NO se pierde (el mismo item sigue tocando al día siguiente — ver `isProjected`/regla de `today` arriba), así que esta sección mira solo AYER, no una ventana de varios días. Nunca antes de `plans.start_date` (si se reinició el plan, ayer puede ser de la versión vieja y no hay nada que resolver ahí). Si ayer no tiene nada sin marcar, la sección no se muestra.
- **"Reiniciar desde hoy" (`resetPlanStartDate`, botón en `/dashboard/plan`):** pone `plans.start_date` en hoy (America/Bogota). Solo el dueño del plan, con confirmación (irreversible desde la UI). No toca `plan_checks` (el historial ya guardado queda igual) ni `plan_queue_cursors` (la posición de las colas es independiente) — solo mueve el límite desde el que `/plan/historial`, `/plan/fases` y el "sin marcar de ayer" del dashboard resuelven.
- **Agente CEO (siguiente paso, no ahora):** tool `get_plan_dia(fecha, persona)` que llame al mismo resolver, para preguntar por WhatsApp "qué me toca ahora".

## Import

`scripts/seed-plan.ts` lee `plan-seed.json` y crea el plan para el usuario dueño dentro de una transacción. Es idempotente: si ya existe un plan con el mismo nombre, no hace nada.

## Orden de trabajo

1. Migración Drizzle y seed.
2. Resolver con tests.
3. `/plan` con checks.
4. `/plan/semana`.
5. `/plan/fases`.
6. `/plan/historial`.
7. Agenda.

Probar cada paso de punta a punta antes de pasar al siguiente, y documentar la sección en el runbook al terminar.
