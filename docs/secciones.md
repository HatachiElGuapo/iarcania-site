# Las 23 secciones del dashboard

Qué hace cada sección del sidebar (`/dashboard/*`), qué tablas lee/escribe,
qué Server Actions de escritura tiene y sus sub-vistas. Sacado del código
(`page.tsx` + `actions.ts` + `nav-links.tsx`), no de suposiciones.

Convenciones:
- **Tablas**: las de `lib/db/schema/*` que la sección lee o escribe.
- **Escritura**: las `export async function` de su `actions.ts` (o el
  `actions.ts` que reutiliza).
- **Sub-vistas**: sub-rutas reales (van al `<SubNav>`) o vistas por
  `?param=` sobre la misma página.
- 🔴 **STUB** = pantalla sin funcionalidad real todavía (solo placeholder).

---

## Inicio

### Rutinas — `/dashboard` 🌅
Home: resumen del día sobre las tablas ya existentes — foco del día, hábitos
diarios pendientes, tareas de hoy, citas de los próximos 7 días. Navegador
de día `‹ fecha ›` que no va al futuro.
- **Tablas**: `trabajo.tasks`, `habitos.activities` + `habitos.activity_logs`, `citas.appointments`.
- **Escritura**: reutiliza `actividades/actions` (`createTask`, `toggleTaskStatus`) y `habitos/actions` (`createActivity`, `toggleLogToday`). Sin acciones propias.
- **Sub-vistas**: `?date=` (día visible), `?filtro=` (todas / pendientes / alta).

---

## Vida personal

### Actividades — `/dashboard/actividades` ✅
Lista de tareas personales agrupada por vencimiento (vencidas / hoy / semana
/ adelante / sin fecha), con filtro por categoría.
- **Tablas**: `trabajo.tasks`.
- **Escritura** (`actividades/actions.ts`): `createTask`, `toggleTaskStatus`, `archiveTask`, `unarchiveTask`, `deleteTask`.
- **Sub-vistas**: `?tiempo=` (todas / hoy / semana / vencidas / completadas), `?cat=`, `?archivadas=1` (vista de archivadas).

### Agenda — `/dashboard/agenda` 📅
Rejilla horaria fija 00:00–24:00 de un día: bloques de agenda, tareas con
hora, citas y los hábitos diarios (dibujados como bloques virtuales; al
arrastrarlos se materializan como fila real solo para ese día). Arrastrar y
redimensionar.
- **Tablas**: `agenda.agenda_items` (escribe), `habitos.activities` + `activity_logs`, `trabajo.tasks`, `citas.appointments` (lee).
- **Escritura** (`agenda/actions.ts`): `createBlock`, `updateBlock`, `deleteBlock`, `moveBlock`, `scheduleHabit`.
- **Sub-vistas**: `?date=` (día), `?pre=` / `?edit=` (bloque en edición).

### Ideas — `/dashboard/ideas` 💡
Bandeja de captura rápida de ideas, con estado (nueva / procesada) y
categoría. Búsqueda y paginación (listas largas).
- **Tablas**: `ideas.ideas` (escribe); `trabajo.tasks` (al convertir idea → tarea).
- **Escritura** (`ideas/actions.ts`): `createIdea`, `deleteIdea`, `createTaskFromIdea`.
- **Sub-vistas**: `?q=` (búsqueda), `?estado=` (todas / nuevas / procesadas), `?cat=`, `?page=`.

### Citas — `/dashboard/citas` 🏥
Turnos médicos, reuniones y demás con fecha y hora fija. Al crear una cita
también escribe su bloque en la agenda.
- **Tablas**: `citas.appointments` (escribe), `agenda.agenda_items` (escribe), `eventos.event_types` (lee).
- **Escritura** (`citas/actions.ts`): `createAppointment`, `completeAppointment`, `cancelAppointment`, `deleteAppointment`.
- **Sub-vistas**: ninguna (secciones apiladas: próximas / todas).

### Eventos — `/dashboard/eventos` 🎉
Tipos de evento recurrentes (cumpleaños, aniversarios…) y sus ocurrencias
registradas. Trae un set de tipos básicos con un botón de seed.
- **Tablas**: `eventos.event_types`, `eventos.event_occurrences`.
- **Escritura** (`eventos/actions.ts`): `seedEventTypeDefaults`, `saveEventType`, `deleteEventType`, `saveOccurrence`, `deleteOccurrence`.
- **Sub-vistas**: ninguna.

### Personas — `/dashboard/personas` 👥
Directorio de gente (familia, amigos, trabajo) con sus fechas importantes.
Búsqueda y paginación.
- **Tablas**: `personas.people`, `personas.important_dates`.
- **Escritura** (`personas/actions.ts`): `createPersona`, `updatePersona`, `deletePersona`, `createImportantDate`, `deleteImportantDate`.
- **Sub-vistas**: `?q=`, `?rel=` (relación), `?page=`, `?edit=` (persona en edición).

### Hábitos — `/dashboard/habitos` 🔥
Seguimiento de hábitos: marcar el de hoy, ver el estado por frecuencia.
- **Tablas**: `habitos.activities`, `habitos.activity_logs`.
- **Escritura** (`habitos/actions.ts`): `createActivity`, `updateActivity`, `archiveActivity`, `unarchiveActivity`, `deleteActivity`, `toggleLogToday`.
- **Sub-vistas**:
  - `?freq=` en la página principal (diarios / semanales / mensuales / únicos / recurrentes).
  - **`/habitos/gestion`** — alta/edición/archivo de hábitos (`?edit=id`, `?archivadas=1`).
  - **`/habitos/rachas`** — vista de rachas por hábito.

### Cuerpo — `/dashboard/cuerpo` 🏋️
Registro de entrenamiento: ejercicios, series (peso/reps) y métricas
corporales del día.
- **Tablas**: `cuerpo.exercises`, `cuerpo.workout_logs`, `cuerpo.body_metrics`.
- **Escritura** (`cuerpo/actions.ts`): `createExercise`, `logSet`, `upsertBodyMetrics`.
- **Sub-vistas**:
  - **`/cuerpo/nutricion`** — comidas y snacks del día + metas diarias. Tablas `nutricion.meals`, `nutricion.nutrition_targets`. Acciones (`cuerpo/nutricion/actions.ts`): `saveMeal`, `deleteMeal`, `saveTargets`.

### Hogar — `/dashboard/hogar` 🏠
Quehaceres domésticos: tipos de tarea y su registro de "hecho", con notas y
vista de los últimos 7 días.
- **Tablas**: `hogar.chore_types`, `hogar.chore_logs`.
- **Escritura** (`hogar/actions.ts`): `createChoreType`, `logChoreDone`, `updateChoreLog`, `deleteChoreLog`, `addChoreNote`.
- **Sub-vistas**: ninguna.

### Reloj — `/dashboard/reloj` ⏱️
Cronómetro, temporizador, contador y alarmas. **100 % cliente**: no toca la
base de datos; las alarmas viven en `localStorage` y solo suenan mientras la
pestaña Alarmas está montada.
- **Tablas**: ninguna.
- **Escritura**: ninguna (sin Server Actions).
- **Sub-vistas**: pestañas cliente — Cronómetro / Temporizador / Contador / Alarmas.

---

## Trabajo

### Trabajo — `/dashboard/trabajo` 💼
"Hoy": el foco de tareas del día (traídas de Actividades) + notas de trabajo
por canal.
- **Tablas**: `trabajo.tasks`, `trabajo.daily_focus`, `trabajo.work_notes`.
- **Escritura** (`trabajo/actions.ts`): `addToWorkFocus`, `toggleFocusComplete`, `removeFromFocus`, `createWorkNote`. Además reutiliza `actividades/actions` (`createTask`, `toggleTaskStatus`).
- **Sub-vistas**:
  - `?canal=` (canal de las notas: IArcanIA / Void Stoic).
  - **`/trabajo/tareas`** — tabla de tareas con vencimiento en un rango. `?rango=` (hoy / semana / 2 semanas / mes / 3 meses). Usa `toggleTaskStatus` de Actividades.

### Brújula — `/dashboard/brujula` 🧭
Áreas de vida → objetivos → proyectos → sub-proyectos, en árbol de
`<details>`. Cada proyecto-hoja lleva sus tareas. Bloque "Mañana" con lo que
vence al día siguiente por área. Siembra 6 áreas por defecto si no hay
ninguna.
- **Tablas**: `brujula.life_areas`, `brujula.life_projects`, `trabajo.tasks`.
- **Escritura** (`brujula/actions.ts`): `createArea`, `updateArea`, `deleteArea`, `createProject`, `completeProject`, `createTaskInProject`. Además `toggleTaskStatus` de Actividades.
- **Sub-vistas**: ninguna (todo en un árbol expandible).

---

## Contenido

### Libros — `/dashboard/libros` 📚
Biblioteca de lectura con estado (leyendo / terminado / pendiente) y, por
libro, notas estructuradas.
- **Tablas**: `libros.books`, `libros.book_chapters`, `libros.book_characters`, `libros.book_scenarios`, `libros.book_notes`.
- **Escritura** (`libros/actions.ts`): `createBook`, `updateBookStatus`, `deleteBook`, `createChapter`, `updateChapterNotes`, `deleteChapter`, `createCharacter`, `deleteCharacter`, `createScenario`, `updateScenario`, `deleteScenario`, `createNote`, `updateNote`, `deleteNote`.
- **Sub-vistas**: `?book=` (libro abierto) + `?tab=` (Capítulos / Personajes / Escenarios / Notas).

### Guiones — `/dashboard/guiones` 🎬
Guiones de video por canal. Editor con hook / desarrollo / cierre, checklist
de producción, datos de publicación y generación de presentaciones. Varias
acciones de IA vía `/api/scripts/*` (generar guión, estructurar texto libre,
generar copy, generar presentaciones).
- **Tablas**: `guiones.scripts`.
- **Escritura** (`guiones/actions.ts`): `createScript`, `updateScript`, `deleteScript`, `toggleChecklist`, `savePublicacion`, `savePresData`.
- **Sub-vistas**: `?canal=` (Todos / IArcanIA / Void Stoic). El editor de cada guión tiene pestañas cliente Editar / Publicar / Presentación.

### Slides — `/dashboard/slides` 🖼️  🔴 STUB
Solo un `PageHeader` + `EmptyState`. Sin tablas, sin acciones, sin
funcionalidad. Reservado para un futuro editor de slides.

### Planner — `/dashboard/planner` 🗓️
Planificación de contenido: piezas (comparten tabla con Guiones), sus
derivados por plataforma, checklist de producción y una vista semanal por
fecha de grabación.
- **Tablas**: `guiones.scripts`, `guiones.script_derivados`.
- **Escritura** (`planner/actions.ts`): `updatePlannerFields`, `createDerivado`, `updateDerivadoEstado`, `deleteDerivado`. Además reutiliza `guiones/actions` (`createScript`, `deleteScript`, `toggleChecklist`).
- **Sub-vistas**: `?tab=` (Contenido / Producción / Semanal) + `?canal=`. Una sola página, no rutas.

---

## Negocio

### Dinero — `/dashboard/dinero` 💰
Contenedor. `/dashboard/dinero` redirige a `/dashboard/dinero/cuentas`. Seis
sub-rutas reales:

- **`/dinero/cuentas`** — saldos por cuenta/tarjeta + registrar movimiento.
  Tablas: `dinero.financial_accounts`. Escritura (`dinero/actions.ts`):
  `createAccount`, `recordMovement`.
- **`/dinero/gastos`** — ledger de gastos e ingresos del mes.
  Tablas: `dinero.financial_accounts`, `dinero.expenses`, `dinero.income`.
  Escritura (`dinero/actions.ts`): `recordMovement`, `deleteExpense`, `deleteIncome`.
- **`/dinero/facturas`** — facturas recurrentes y su pago (el pago escribe
  bill_payments + expenses + saldo en una transacción).
  Tablas: `facturas.bills`, `facturas.bill_payments`, `dinero.expenses`, `dinero.financial_accounts`.
  Escritura (`dinero/facturas/actions.ts`): `createBill`, `payBill`.
- **`/dinero/cobros`** — clientes de agencia y sus cobros mensuales
  (dominio `agencia.*`, distinto del de la sección Clientes).
  Tablas: `agencia.agency_clients`, `agencia.agency_payments`.
  Escritura (`dinero/cobros/actions.ts`): `createAgencyClient`, `updateAgencyClientStatus`, `deleteAgencyClient`, `createAgencyPayment`, `markAgencyPaymentPaid`, `deleteAgencyPayment`.
- **`/dinero/metas`** — lista priorizada de metas de compra.
  Tablas: `metas.purchase_goals`.
  Escritura (`dinero/metas/actions.ts`): `createGoal`, `toggleGoalDone`, `deleteGoal`.
- **`/dinero/escanear`** — subir foto de un recibo → la IA extrae los datos
  y pre-llena el registro de gasto/factura. **Requiere `ANTHROPIC_API_KEY`**
  (hoy vacía): sin ella, `/api/scan-receipt` responde 503 con mensaje.
  Tablas: `dinero.expenses`, `dinero.financial_accounts`, `facturas.bills`, `facturas.bill_payments`.
  Escritura (`dinero/escanear/actions.ts`): `registerScan`.

### Clientes — `/dashboard/clientes` 🤝
Clientes freelance/personales de IArcanIA con su proyecto activo, historial
de pagos e invoices pendientes. Dominio `clientes.*`, distinto de Cobros.
⚠️ `deleteClient` hace CASCADE a proyectos, pagos e invoices.
- **Tablas**: `clientes.clients`, `clientes.projects`, `clientes.payments`, `clientes.invoices`.
- **Escritura** (`clientes/actions.ts`): `createClient`, `updateClientStatus`, `deleteClient`, `createProject`, `completeProjectClient`, `createPayment`, `markPaymentPaid`, `deletePayment`, `createInvoice`, `markInvoicePaid`, `deleteInvoice`.
- **Sub-vistas**: ninguna (una tarjeta expandible por cliente).

### CRM — `/dashboard/crm` 📊
Panel de negocio en una sola página con `?tab=`: presupuesto por prioridad,
pipeline de deals por etapa, resumen de clientes (enlaza a la sección
Clientes) y deudas.
- **Tablas**: `crm.budgets`, `crm.budget_distributions`, `crm.debts`; `dinero.income` (registrar ingreso); `clientes.clients` + `clientes.projects` (los deals son `projects`).
- **Escritura** (`crm/actions.ts`): `createBudget`, `deactivateBudget`, `registrarIngreso`, `createDeal`, `moveDealStage`, `registerDealPayment`, `createDebt`, `registerDebtPayment`, `deleteDebt`.
- **Sub-vistas**: `?tab=` (Presupuesto / Pipeline / Clientes / Deudas). Una sola página, no rutas.

### Recursos — `/dashboard/recursos` 📦
Biblioteca **compartida** (no filtra por usuario; el usuario solo decide
permisos de edición): cursos, SOPs, prompts, plantillas, entregables.
Contenido "sensible" por recurso, visible solo para admin. Búsqueda y
paginación.
- **Tablas**: `recursos.recursos`, `recursos.recursos_sensibles`.
- **Escritura** (`recursos/actions.ts`): `createRecurso`, `updateRecurso`, `deleteRecurso`.
- **Sub-vistas**: `?q=`, `?tipo=`, `?page=`; alta con `?nuevo=1`, edición con `?edit=id`.

### Escuela — `/dashboard/escuela` 🎓
Administración de la escuela: cursos y sus clases (con tier requerido) +
lista de estudiantes por tier.
- **Tablas**: `escuela.courses`, `escuela.lessons`, `escuela.students`.
- **Escritura** (`escuela/actions.ts`): `createCourse`, `updateCourse`, `deleteCourse`, `createLesson`, `updateLesson`, `deleteLesson`, `changeStudentTier`.
- **Sub-vistas**:
  - `?tab=` (Cursos / Estudiantes) sobre la misma página.
  - **`/escuela/cursos/[id]`** 🔴 STUB — solo `PageHeader` + `EmptyState`. La edición real de cursos/clases se hace desde la lista.

### Workspace — `/dashboard/workspace` 🖥️
Página estática: enlaces rápidos a herramientas externas (n8n, Supabase,
Vercel, GitHub, EasyPanel, YouTube Studio, Canva…), agrupados en Técnico y
Contenido.
- **Tablas**: ninguna.
- **Escritura**: ninguna.
- **Sub-vistas**: ninguna.
