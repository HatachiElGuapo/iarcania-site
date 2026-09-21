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
| `plan_blocks` | id, plan_id, person_id, weekday 0–6 (0 = lunes), start time, end time null, text, kind, tentative bool, is_minimum bool, queue_id null, holiday_text null |
| `plan_holidays` | plan_id, date |
| `plan_events` | id, plan_id, person_id null, date null, month_day null, start null, end null, text, kind |
| `plan_overrides` | plan_id, date, block_id, text null, removed bool — único (date, block_id) |
| `plan_checks` | plan_id, date, block_id, person_id, status (`done` \| `skipped`), resolved_text, note, checked_at — único (date, block_id) |

`kind`: ingresos, juntos, cuidado, comida, casa, rutina, descanso, cita.

`resolved_text` guarda lo que decía el bloque al marcarlo. Si después se reordenan las listas, el historial no cambia.

## Resolver (`lib/plan/resolve.ts`)

Función pura, sin acceso a la base: recibe el plan completo y un rango de fechas, devuelve por fecha la fase, si es festivo, las notas del día y los bloques resueltos de cada persona.

Reglas, en este orden:
1. Recorrer día a día desde `plans.start_date`, aunque el rango pedido empiece después: los contadores dependen de todo lo anterior.
2. Bloques del día = `plan_blocks` del weekday.
3. Festivo y el bloque tiene `holiday_text` → usar ese texto y no avanzar el contador.
4. Bloque con cola → contador por (fase, cola), o solo por cola si es global. Toma el item en esa posición. Si la lista se acabó: cíclica vuelve a empezar; no cíclica usa `fallback`. El texto de la plantilla queda como etiqueta.
5. Aplicar `plan_overrides` (cambia el texto o quita el bloque) después de avanzar el contador.
6. Agregar `plan_events` del día (por fecha o por `month_day`), ordenar por hora.

Tests unitarios con estos casos del seed:
- 2026-09-22, Miguel 10:00 → "Documentar en el runbook cómo clonar el Agente Base"
- 2026-10-12 (festivo), Miguel 08:00 → texto de festivo, y el contador de prospección no avanza
- 2027-01-16, Miguel 06:00 → fallback de Void Stoic (lista global agotada)

## Rutas

- `/plan` — Día. Por defecto hoy; flechas, selector de fecha y botón Hoy. Encabezado con fase, semana X de Y, meta y festivo. Grilla con una columna por persona. Cada bloque lleva un check (hecho / saltado / sin marcar) y un botón para cambiarlo solo ese día. Resumen: bloques hechos, mínimos cumplidos y horas de ingresos hechas.
- `/plan/semana` — Plantilla editable por weekday: crear, editar y eliminar bloques, "también en estos días", cola asignada y texto de festivo.
- `/plan/fases` — Fases (nombre, fechas, meta) y sus listas en textarea, una tarea por línea. Al guardar se reescriben las posiciones de esa cola.
- `/plan/historial` — Últimos 30 días: % de bloques hechos por día, por tipo y por persona; mínimos cumplidos por día; lista de lo saltado con su nota.

Solo el dueño del plan edita. `plan_people.user_id` permite, más adelante, que Diana vea su columna con su login.

## Server Actions

`setCheck(date, blockId, status | null, note?)`, `setOverride(date, blockId, text)`, `removeForDay(date, blockId)`, `clearOverride(date, blockId)`, `upsertBlock(...)`, `deleteBlock(id)`, `updatePhase(...)`, `replaceQueueItems(queueId, phaseId, lines[])`.

Todas validan que el plan pertenezca a la sesión.

## Integraciones

- **Agenda:** mostrar los bloques resueltos del día en la Agenda existente. Aprovechar para cerrar los pendientes: rango de 00:00 a 24:00 cada 10 minutos y que las tareas creadas aparezcan en Agenda.
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
