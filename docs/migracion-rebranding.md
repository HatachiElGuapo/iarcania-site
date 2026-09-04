# Migración de rebranding del dashboard

Contexto y bitácora de decisiones del cambio de sistema visual del
dashboard. Complementa `docs/sistema-de-diseno.md` (ese explica *cómo es* el
sistema nuevo; este explica *por qué* y *dónde vamos*).

---

## Qué es esto

El dashboard (`/dashboard/*`) tenía un sistema visual portado 1:1 de
`os.css`, el dashboard operativo original (negro `#080808`, cream, morado
plano, dorado apagado). Se decidió **reemplazarlo** por el sistema del
documento de diseño "Sistema IArcanIA" (canvas `#0F0F11`, texto frío,
violeta de acción, ámbar de nav, librería de componentes en
`components/ui/`).

La migración fue **sección por sección, con la app funcionando en todo
momento** (fases 01–05, agosto–septiembre de 2026). Los dos sistemas
convivieron en el repo hasta el PASO 5, que borró el viejo de una vez.
Este documento se conserva como registro de qué se decidió y por qué.

### La fuente de verdad visual

`~/Documentos/design/iarcania/Rutinas Dashboard Redesign-handoff/…/`:

- `Sistema IArcanIA.dc.html` — turno 4 (tokens `4a`, componentes `4b`, shell
  `4c`, arquetipos `4d–4i`, asignación y fases `4j`) y turno 5 (correcciones
  `5a–5g`: categorías, estados de formulario, sub-navegación, listas largas,
  navegación global, escala tipográfica).
- `Actividades y Agenda.dc.html` — turnos 2 y 3, exploraciones de esas dos
  pantallas (opciones `2a`/`2b`/`3a`/`3b`).
- `Rutinas Dashboard.dc.html` — turno 1.

Son lienzos de diseño: cada opción es un `<div class="dv-opt" id="...">`.
Los tokens no están en el marcado, están en el `<script>` final dentro de
`renderVals()`. `support.js` y las clases `.dv-*` son andamiaje del visor,
se ignoran.

---

## Decisiones tomadas (y por qué)

### Nombres de token propios, no prefijo temporal
Los tokens nuevos (`canvas`, `surface`, `line`, `ink`, `accent`…) se
eligieron con nombres definitivos que **no chocan** con los viejos
(`bg-bg-*`, `text-text-*`, `border-border`). Alternativa descartada:
prefijar los nuevos con `v2-` y renombrar al final. Con nombres propios, el
PASO 5 fue solo *borrar* los viejos. Los radios sí fueron namespaced
(`rounded-ui*`) porque `rounded-{sm,md,lg}` sí colisionaba; al llegar el
PASO 5 se decidió **dejarlos** así (136 usos, cero beneficio en renombrar).

### El texto por defecto del `<body>` se migró en el PASO 5
Durante la migración `app/globals.css` → `body` tenía el fondo ya nuevo
(`bg-canvas`) pero el color de texto en el token viejo (`text-text-primary`,
cream `#E8E0D0`), porque las secciones sin migrar heredaban de ahí. El
fondo sí se pudo mover antes porque `#080808 → #0F0F11` es imperceptible y
ninguna sección pintaba su propio fondo de página. En el PASO 5 pasó a
`text-ink`.

### El shell se migró de una, no sección por sección
El sidebar, el fondo y el item activo dorado son **marco**, no una sección.
Migrarlos de golpe (commit `f98998b`) no rompe "sección por sección" porque
el contenido de cada sección usa sus propias clases de texto explícitas; lo
único que cambió para todas a la vez es el marco. Alternativa descartada:
fondo condicional por ruta con una lista de "rutas migradas" — es
exactamente el tipo de andamiaje temporal que se quiere evitar.

### Actividades → variante 2a (tabla agrupada, sin detalle lateral)
El diseño tenía dos caminos para Actividades: `2a` (tabla densa agrupada por
vencimiento) y `3a` (tres paneles con detalle lateral). La página **ya
estaba** hecha como 3a. Se eligió **2a**: se quitaron el riel de filtros y
el panel de detalle; ahora es tabs de tiempo + leyenda de categorías
(filtros por `searchParams`) + tabla agrupada (Vencidas / Hoy / Esta semana
/ Más adelante / Sin fecha) + quick-add fijo. Las Server Actions
(`createTask`, `toggleTaskStatus`, `archiveTask`, `unarchiveTask`,
`deleteTask`) se reutilizaron sin tocar.

### Agenda → se integró un WIP sin commitear como base
Había trabajo local sin commitear en Agenda: una rejilla de día con arrastre
para mover/redimensionar bloques, hábitos de rutina diaria dibujados como
**bloques virtuales** (no se persisten; se materializan como fila real
`agenda_items` con `item_type='habito'` solo al arrastrarlos), y un panel de
ocupación. Se decidió **integrarlo** (en vez de migrar desde el estado
commiteado y re-mergear después) y reestilarlo al sistema nuevo en el mismo
commit. El trabajo de interacción ya estaba hecho; rehacerlo era
desperdicio.

Esto **cambió rutas de escritura** en `agenda_items`:
- `moveBlock({id, blockTime, duration})` — reprograma hora + duración (snap
  a 10 min, mínimo 20, tope 24 h). Helpers en `app/dashboard/agenda/time.ts`.
- `scheduleHabit({activityId, date, blockTime, duration})` — inserta el
  bloque `item_type='habito'` con `onConflictDoNothing` sobre el índice
  único `(user, date, block_time, item_id)`.
- `createBlock` ahora acepta `item_type` `'cita'` y `'habito'` (antes solo
  `'task'`/`'nota'`).

Verificado en runtime contra el schema real (drizzle + `agenda_items`), con
datos de prueba en la fecha centinela `2099-01-01` borrados al terminar:
18/18 checks OK (helpers, persistencia, scope por `user_id`,
`onConflictDoNothing`). No se ejecutó el flujo autenticado ni el plumbing de
Next (sin cambios). La sección **Hábitos** no se tocó.

### Rejilla de Agenda: sin scroll anidado, ventana fija 00:00–24:00
`day-grid.tsx` no tiene contenedor con `overflow` propio: la rejilla se
extiende a su altura natural (~2304 px) y scrollea la **página**, como
cualquier otra sección. Encabezado `sticky top-0`. Riel con 72 marcas cada
20 min (la hora en punto pesa más que `:20`/`:40`); el arrastre sigue
snapeando a 10 min. Al montar, la vista se centra en "ahora" (o el primer
evento) con scroll instantáneo de la página; botón "Ir a ahora" en el
encabezado. El auto-scroll usa `useEffect` con dep vacía → **no** se
redispara en las revalidaciones de Server Action (arrastrar un bloque no
salta la vista); solo una navegación real remonta y reposiciona.

### Categoría `habitos` → `accent-warm`
En `lib/constants/cats.ts` la categoría `habitos` tenía color `#9896b0`, que
es **idéntico** al token `ink-muted` del sistema nuevo (texto secundario):
un borde de categoría "hábitos" se veía como "sin clasificar". Se cambió a
`#E8A33D` (= `accent-warm`), coherente con 5a (el dorado cubre «ahora»,
hábitos y categorías). `cats.ts` sigue siendo la fuente única.

### Command palette (5e) — fuera de alcance por ahora
El diseño recomienda una paleta de comandos `⌘K` como *la* solución de
navegación a 23+ secciones. No se implementó: `nav-links.tsx` ya tiene
grupos colapsables y el PASO 3 solo pidió `<SubNav>`. Queda como mejora
futura; es el único componente que necesitaría estado cliente real de
navegación.

### `components/ui/` — barril solo server-safe
`components/ui/index.ts` re-exporta solo las piezas sin estado cliente. Las
piezas cliente (`Form`, `Modal`, `ConfirmDialog`, `Toast`, `SubNav`) se
importan de su archivo. Motivo: un barril que re-exporta módulos
`"use client"` arrastra su runtime a toda página que importe del barril,
aunque no use esas piezas (se midió: +4 kB en cada ruta). El sistema es
server-first.

### Editor "branded" de Guiones — no se migró (registro antes de borrar `os.css`)
El `os.css` original tenía `.sg-branded-editor`: el editor de un guión se
teñía con el color de su canal — superficie más oscura (`#1a1a1a`), borde y
foco en el morado de marca (`--sg-primario:#7C3AED`), un acento cian
(`--sg-acento:#22D3EE`) y el logo del canal en marca de agua arriba a la
derecha (`.sg-brand-logo`, opacidad .55). La migración de Guiones (Fase 05)
lo dejó como editor plano del sistema nuevo, sin tinte por canal. Se anota
aquí porque, al borrar `os.css`, este es el único sitio donde quedaba
descrito. Si se quiere recuperar, es una mejora de producto, no de la
migración.

---

## Estado por sección

Arquetipo según `4j`. `SubNav` = tiene sub-rutas enlazadas.

| Sección | Ruta | Arquetipo | Estado | Notas |
|---|---|---|---|---|
| Rutinas | `/dashboard` | 6 Panel | ✅ migrada | Fase 01 |
| Actividades | `/dashboard/actividades` | 1 Lista (var. 2a) | ✅ migrada | Fase 01. Tabla agrupada, sin detalle |
| Agenda | `/dashboard/agenda` | 2 Temporal | ✅ migrada | Fase 01. Integra WIP de rejilla + arrastre |
| **Shell** | layout + sidebar | — | ✅ migrado | fondo `canvas`, item activo dorado |
| Ideas | `/dashboard/ideas` | 1 Lista + listas largas | ✅ migrada | Fase 02. `?q=&estado=&cat=&page=` |
| Personas | `/dashboard/personas` | 1 Lista + listas largas | ✅ migrada | Fase 02. `?q=&rel=&page=`, edición `?edit=id` |
| Hogar | `/dashboard/hogar` | 1 Lista | ✅ migrada | Fase 02. Sin búsqueda (lista corta) |
| Recursos | `/dashboard/recursos` | 1 Lista + listas largas | ✅ migrada | Fase 02. `?q=&tipo=&page=`, alta/edición `?nuevo=1`/`?edit=id` |
| Libros | `/dashboard/libros` | 1 Lista | ✅ migrada | Fase 02. Pestañas del libro con `Segmented` |
| Hábitos | `/dashboard/habitos` (+ `gestion`, `rachas`) | 3 Métricas + pestañas | ✅ migrada | Fase 03. Layout con `PageHeader` + `SubNav`. Gestión con `?edit=id` |
| Cuerpo | `/dashboard/cuerpo` (+ `nutricion`) | 3 Métricas | ✅ migrada | Fase 03. Layout con `PageHeader` + `SubNav`. Nutrición con `MetricCard` |
| Dinero · Cuentas | `/dashboard/dinero/cuentas` | 3 Métricas | ✅ migrada | Total de saldos + tarjeta/cuenta con quick-form `recordMovement` (transacción con dinero, sin cambios) |
| Dinero · Gastos | `/dashboard/dinero/gastos` | 1 Lista | ✅ migrada | `MetricCard` de totales + 2 forms + ledger unificado (expenses∪income ordenado en JS, sin cambio de query) |
| Dinero · Facturas | `/dashboard/dinero/facturas` | 1 Lista + estado de pago | ✅ migrada | `payBill` (transacción bill_payments+expenses+balance, sin cambios) |
| Dinero · Metas | `/dashboard/dinero/metas` | 1 Lista priorizada | ✅ migrada | 5g decía arquetipo 3, pero sin campo "ahorrado" una barra sería decorativa → lista simple |
| Dinero · Escanear | `/dashboard/dinero/escanear` | acción de captura | ✅ migrada | **No funciona sin `ANTHROPIC_API_KEY`** (vacía hoy). `/api/scan-receipt` ahora devuelve 503 con mensaje claro en vez del 401 críptico de Anthropic |
| Dinero · Cobros | `/dashboard/dinero/cobros` | 1 Lista | ✅ migrada | Solo markup: cero cambios en actions.ts, cero cambios en lectura/escritura del status. El botón "Eliminar cliente" ahora usa <ConfirmDialog> que dice cuántos cobros borrará el CASCADE (no cambia comportamiento, lo hace visible). Deudas 1-3 abajo, abiertas |
| Citas | `/dashboard/citas` | 2 Temporal | ✅ migrada | Fase 03. `actions.ts` (offset `-05:00`) sin tocar |
| Eventos | `/dashboard/eventos` | 2 Temporal | ✅ migrada | Fase 03 |
| Reloj | `/dashboard/reloj` | 2 Temporal | ✅ migrada | Fase 03. 100% cliente, alarmas en `localStorage` |
| Trabajo | `/dashboard/trabajo` (+ `tareas`) | 4 Tablero | ✅ migrada | Fase 04. `layout.tsx` → `PageHeader` + `SubNav`. "Hoy" con `Section` + `Segmented` de canal; `tareas` con `Segmented` de rango + `Table`. Cero cambios en actions (reutiliza Actividades). Copia voseo corregida ("no has agregado") |
| Planner | `/dashboard/planner` | 4 Tablero + pestañas | ✅ migrada | Fase 04. `?tab=` (Contenido/Producción/Semanal) + `?canal=` re-estilados como `Segmented`, NO convertidos a rutas. `toggleChecklist` (de Guiones) conservado como botón-por-paso, solo re-skin |
| CRM | `/dashboard/crm` | 4 Tablero + pestañas | ✅ migrada | Fase 04. `?tab=` (Presupuesto/Pipeline/Clientes/Deudas) → `Segmented`, una sola página. `moveDealStage` conservado como botón-por-etapa (el "select Mover ▾" del arquetipo no aplica: el mecanismo actual ya funciona). Cero cambios en actions.ts |
| Clientes | `/dashboard/clientes` | 1 Lista | ✅ migrada | Fase 04. ⚠️ datos reales — solo markup, cero cambios en actions.ts. Migrado del `PageHeader` viejo (`@/components/app/page-header`) al nuevo. `deleteClient` ahora usa `<ConfirmDialog>` que dice qué borra el CASCADE (proyectos/pagos/invoices). Deuda #5 abajo |
| Guiones | `/dashboard/guiones` | 5 Documento | ✅ migrada | Fase 05. `PageHeader` + `Segmented` de canal. `new-script-form` y `script-card` (client) re-skineados; llamadas a `/api/scripts/*` y descarga por Blob intactas. Cero cambios en actions.ts |
| Slides | `/dashboard/slides` | 5 Documento | ✅ migrada | Fase 05. Sigue siendo stub (no hay editor); `PageHeader` + `EmptyState` |
| Escuela | `/dashboard/escuela` (+ `cursos/[id]`) | 5 Documento | ✅ migrada | Fase 05. `?tab=` (Cursos/Estudiantes) → `Segmented`, **sin** `SubNav`, no convertido a rutas. `cursos/[id]` sigue stub. Tier→`MetricCard`/`Badge`, Field→Labeled. Cero cambios en actions.ts |
| Brújula | `/dashboard/brujula` | 6 Panel | ✅ migrada | Fase 05. Árbol con `<details>` nativo; bloque "Mañana" → `Card`. Colores por área siguen inline (los elige el usuario). Cero cambios en actions.ts |
| Workspace | `/dashboard/workspace` | 6 Panel | ✅ migrada | Fase 05. 100% estático; grupos → `Card`, enlaces externos con hover |

**Sub-layouts**: todos migrados — `habitos/`, `cuerpo/`, `dinero/` (Fase 03)
y `trabajo/` (Fase 04) usan `PageHeader` + `SubNav` del sistema nuevo.

### Orden de fases (`4j`)

| Fase | Qué | Estado |
|---|---|---|
| 01 · Extraer el sistema | Rutinas, Actividades, Agenda + shell + librería | ✅ hecha |
| 02 · Arquetipo 1 en volumen | Ideas, Personas, Hogar, Recursos, Libros | ✅ hecha |
| 03 · Los que ya tienen datos | Hábitos, Cuerpo, Dinero (6 pestañas) · Citas, Eventos, Reloj | ✅ hecha |
| 04 · Trabajo y negocio | CRM, Trabajo, Planner, Clientes (arq. 4) | ✅ hecha |
| 05 · Editores y paneles | Guiones, Slides, Escuela, Brújula, Workspace | ✅ hecha |

**Las 23 secciones están migradas.** El PASO 5 (borrar el sistema viejo)
también está hecho — detalle abajo.

---

## PASO 5 — limpieza final ✅ hecha

El rebranding cerró con dos commits:

1. **Borrar los archivos muertos** (0 importadores, verificado con `grep`):
   `os.css` (raíz), `components/app/page-header.tsx` (→
   `components/ui/page-header.tsx`), `components/ui/field.tsx` (→ `Labeled`
   / `FormField`). El único detalle de diseño de `os.css` no recogido en
   otro lado —el editor "branded" de Guiones— quedó anotado arriba antes de
   borrarlo.

2. **Borrar los tokens viejos del config/CSS**:
   - `tailwind.config.ts` → fuera `colors.{bg,purple,gold,text,border}`,
     `borderRadius.{sm,md,lg}` (8/12/16px), y las keys `backgroundImage` y
     `boxShadow` enteras. Los `rounded-ui*` **no** se renombraron a
     `sm/md/lg` (136 usos en 48 archivos, cero beneficio; `ui-*` es el
     nombre propio).
   - `app/globals.css` → `@layer components` queda solo con `.focus-ring` /
     `.focus-ring-inset` (fuera `.input`, `.card-glow`, `.btn-primary`,
     `.btn-secondary`, `.stat-num`). `body` pasa a `@apply bg-canvas
     text-ink`. La regla `h1..h4 { font-display font-bold }` se conserva.
   - `app/layout.tsx` → Playfair Display `weight: ["400", "700"]` (el 600
     no lo usaba nada; el 400 lo usan el reloj/timer/contador de Reloj y la
     inicial del avatar en Clientes).

**Verificación tras aplicar**: `grep -rE "bg-bg-|text-text-|border-border|purple-(mid|light|deep)|text-gold|bg-gold|border-gold|rounded-(sm|md|lg)\b|gradient-(cta|text)|glow-purple|card-glow|btn-primary|btn-secondary|stat-num" app/ components/` → 0, con `tsc` + `next build` limpios.

---

## Deuda de lógica de negocio (NO tocar durante el rebranding)

Hallazgos que salieron al leer el código para migrar. **Son de lógica, no de
estilo** — se deciden aparte, con calma, cuando termine el rebranding. Los
commits de migración NO los tocan.

### Cobros (`/dashboard/dinero/cobros`)

1. **El `status` de un cobro no se calcula, se almacena.** No hay ninguna
   lógica que pase `pendiente` → `vencido` cuando `due_date < hoy`. El badge
   "Vencido" solo aparece si alguien lo puso a mano en el select. Decidir:
   ¿se computa `vencido` en la lectura (comparando `due_date` con hoy), o se
   deja como campo manual?
2. **El banner y la tarjeta suman distinto.** El banner "$X por cobrar"
   (`cobros/page.tsx`) suma solo `status === 'pendiente'`. El total
   por-cliente (`ClientCard`) suma `pendiente` **o** `vencido`. Si (1) se
   resuelve computando `vencido`, esto se arregla solo; si no, hay que
   decidir cuál de los dos criterios es el correcto.
3. **`crm_payments.client_id` tiene `ON DELETE CASCADE` hacia
   `crm_clients.id`** (verificado en `lib/db/schema/agencia.ts`). Borrar un
   cliente de agencia con `deleteAgencyClient` borra todo su historial de
   cobros, pagados incluidos. Desde la migración el `<ConfirmDialog>` lo
   **dice** antes de ejecutar ("se borran N cobros"), pero el comportamiento
   del CASCADE no cambió. Abierto: ¿soft-delete del cliente en vez de
   `DELETE` duro?

### Gastos (`/dashboard/dinero/gastos`)

4. **Mejora pendiente, no bug**: el diseño 4f muestra "barras por categoría
   de gasto" (un `GROUP BY category, SUM(amount)` del mes). La página no lo
   tiene. Es funcionalidad nueva; se pospuso para no mezclarla con la
   migración.

### Clientes (`/dashboard/clientes`)

5. **`clients.id` cascada a `projects`, `payments` e `invoices`** (los tres
   con `references(() => clients.id, { onDelete: "cascade" })` en
   `lib/db/schema/clientes.ts`). `deleteClient` borra el cliente y todo su
   historial —pagos y invoices pagados incluidos— sin rastro. Misma clase de
   riesgo que la deuda #3 de Cobros. Desde la migración el `<ConfirmDialog>`
   lo **dice** antes ("se borran N proyectos, N pagos, N invoices"), pero el
   `DELETE` duro no cambió. Abierto: ¿soft-delete? Decidir junto con #3, es
   la misma pregunta en dos dominios (agencia vs. freelance).
