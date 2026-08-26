# Notas de migración — Next.js

## Planner — decisiones tomadas durante la migración

- **Mismo hallazgo que CRM, pero más profundo**: `planner.html` no es un
  dominio separado — conecta al mismo `SB_P` y lee/escribe la misma tabla
  `scripts` que ya migré en Guiones (`itemToRow`/`rowToItem` en el
  original mapean directo a `id/title/canal/status/hook/body/cta`, los
  mismos nombres de columna). El "guion" de 4 bloques que Planner también
  maneja es el mismo que documenté al migrar Guiones (colapsa a
  hook/body/cta). Se extendió `scripts` (formato, plataformaOrigen,
  horaGrab, horaPub) en vez de crear una tabla paralela — mismo criterio
  que projects/income en CRM.
- **Bug real del original que no se replicó**: Planner empaquetaba
  `fechaGrab/horaGrab/horaPub/formato/plataformaOrigen/steps/derivados/guion`
  como `JSON.stringify(...)` dentro de `scripts.notes` — la MISMA columna
  que Guiones usa como texto plano de notas de producción. Un guión editado
  desde una de las dos apps corrompía lo que la otra esperaba ahí. Aquí
  `notes` sigue siendo texto plano (Guiones), y todo lo demás son columnas
  tipadas propias o su propia tabla (`script_derivados`) — no hay JSON
  embebido en columnas de texto en ningún lado de esta migración.
- **`createScript`/`updateScript`/`deleteScript`/`toggleChecklist` se
  reutilizan de Guiones tal cual** (import directo, mismo patrón que
  Trabajo reutilizando `createTask` de Actividades) — Planner no tiene su
  propia copia de estas acciones. Se agregó `updatePlannerFields` como
  acción **separada** para formato/plataformaOrigen/fechaGrab/horaGrab/
  horaPub — a propósito no se fusionó con `updateScript`: el formulario de
  Guiones no envía estos campos, así que si compartieran una acción cada
  guardado desde Guiones los pisaría a vacío. Verificado en caliente que
  ambos paths (crear desde Guiones sin estos campos, crear desde Planner
  con ellos) funcionan sin pisarse.
- **Checklist de producción unificado con Guiones, no duplicado** — el
  original tenía DOS sistemas de pasos de producción distintos sobre la
  misma fila: el `checklist` de Guiones (guion/imagenes/grabado/editado/
  thumbnail/publicado) y los `steps` de Planner (Guión/Grabación/Edición/
  Thumbnail/Programar/Publicar), cada uno con su propio estado/avance
  automático — un desync más del mismo tipo que Citas→Agenda. Aquí la
  pestaña Producción de Planner llama al mismo `toggleChecklist` de
  Guiones sobre las 5 keys compatibles (guion/grabado/editado/thumbnail/
  publicado) — un solo checklist real. **"Programar" no se migró como
  paso** — ya está representado por si `fechaGrabacion`/`horaPub` tienen
  valor, no hace falta un booleano aparte.
- **`status` de Guiones es el único real** — Planner también tenía su
  propio vocabulario de estado (idea/grabando/editando/publicado, 4
  valores) incompatible con el CHECK constraint real de `scripts.status`
  (5 valores: borrador/en_progreso/listo_grabar/grabado/publicado). No se
  intentó replicar ese vocabulario aparte — la UI de Planner muestra el
  status real de Guiones.
- **`script_derivados` es tabla propia, no JSON embebido** — igual
  criterio que Libros (capítulos/personajes/escenarios/notas como filas).
- **Sección "Canal" del original no se migró** — `activePlatforms` nunca
  se persistía en Supabase en el original (solo `useState` en memoria, se
  reseteaba a los 3 valores por defecto en cada carga de página) — no
  había nada real que migrar, era un toggle puramente decorativo.
- **Editar guión (hook/desarrollo/cierre) no se duplicó en Planner** — la
  tarjeta de contenido enlaza a `/dashboard/guiones` para eso, mismo
  criterio que la pestaña Clientes de CRM (un solo lugar por dominio de
  edición de contenido largo).
- **Verificado en caliente end-to-end vía HTTP real, incluyendo la
  interacción entre las dos secciones**: crear desde Planner con
  formato/plataforma/fecha → crear desde Guiones sin esos campos
  (confirmando que no se pisan) → editar campos de Planner → crear
  derivado → cambiar su estado → marcar un paso del checklist desde
  Producción y confirmar que el `status` avanza igual que en Guiones
  (mismo `toggleChecklist`) → vista Semanal muestra el guión bajo el día
  correcto (verificado con la fecha real del sistema, 2026-08-25 =
  martes, cayendo correctamente bajo "Mar" en la semana que empieza el
  lunes 24) → limpieza completa contra Postgres real.

## CRM — decisiones tomadas durante la migración

- **Corrección importante sobre una nota anterior**: al migrar Clientes se
  asumió que `crm.html`/`js/crm.js` era el CRM de *agencia* (proyecto
  Supabase `SB_I`) y se reservaron los nombres `crm_clients`/`crm_payments`
  para ese dominio (ver "Dominios de datos con nombres duplicados"). Leyendo
  el código completo de `js/crm.js` para esta migración: **conecta a
  `SB_P` (personal), el mismo proyecto que Clientes/Dinero**, y reutiliza
  las mismas tablas `clients`/`projects`/`income`. No existe tal separación
  — `crm_clients`/`crm_payments` nunca llegaron a crearse como tablas reales
  en ningún lado. Se corrigió el comentario en `lib/db/schema/clientes.ts`.
- **`projects` extendido, no duplicado**: Pipeline necesita columnas que el
  `projects` migrado con Clientes no tenía (`stage`, `value`, `serviceType`,
  `anticipoPct`, `anticipoPaid`, `closedAt`) — se agregaron como columnas
  nuevas con default, sin tocar las filas ni el flujo ya migrado de
  Clientes. `status` (activo/completado, ciclo de vida en Clientes) y
  `stage` (embudo de ventas: contacted→demo→proposal→negotiation→won/lost,
  Pipeline) son ejes independientes sobre la misma fila — marcar un deal
  "ganado" no cambia `status`, completar un proyecto no mueve el `stage`.
- **`projects.clientId` pasó a nullable** — Pipeline permite crear un deal
  sin cliente todavía ("Sin cliente" en el original), Clientes
  (`createProject`) siempre provee uno igual así que no se ve afectado.
- **`income` extendido con `clientId`/`projectId`/`distributionApplied`** —
  nullable/default false, el flujo normal de Dinero ("+ Ingreso" en Gastos)
  no los toca. Se usan solo cuando el ingreso viene de Presupuesto o de un
  pago de Pipeline.
- **Presupuesto migrado completo, con una simplificación**: el original
  mostraba una vista previa de reparto antes de confirmar (paso intermedio
  client-side). Aquí se aplica directo al guardar — servidor-first, sin
  estado de preview — y el resultado se ve de inmediato en la tabla de
  categorías tras el submit. **Verificado en caliente**: presupuesto con 2
  categorías (prioridad 1 y 2), ingreso que cubre la primera completa y
  parcialmente la segunda — el reparto por prioridad quedó exacto contra
  Postgres real.
- **Sin "eliminar presupuesto"** — se agregó `deactivateBudget` en su lugar
  (marca `isActive=false`) para no perder el historial de
  `budget_distributions` ya repartido contra esa categoría.
- **Deudas**: el original no tenía ningún formulario de alta/pago visible
  en `js/crm.js` (probablemente se cargaban a mano en Supabase) — se
  agregaron `createDebt`/`registerDebtPayment`/`deleteDebt`, mismo criterio
  de "siempre dar una forma de gestionarlo" usado en todo el resto de la
  migración. Al registrar un abono que salda el total, la deuda pasa a
  `status='paid'` y se mueve a una sección colapsable "N deudas saldadas"
  (con opción de eliminar) en vez de desaparecer sin dejar rastro.
- **Pestaña Clientes no se duplicó** — Clientes ya tiene su propia sección
  con CRUD completo (`/dashboard/clientes`); aquí solo un resumen (conteo
  por estado) + link, para no mantener dos UIs sobre el mismo dominio.
- **Verificado en caliente end-to-end vía HTTP real**: Presupuesto (crear 2
  categorías → registrar ingreso con reparto automático → desactivar una
  categoría), Pipeline (crear deal sin cliente → mover de etapa → registrar
  pago marcando "ganado", confirmando `anticipoPct` calculado correctamente
  desde el monto real pagado, `anticipoPaid`/`closedAt` seteados, e ingreso
  vinculado al `projectId`), Deudas (crear → abono parcial → abono que
  salda → aparece en saldadas → eliminar). Todo contra Postgres real,
  terminando en estado limpio.

## Escuela (admin) — decisiones tomadas durante la migración

- **La creación de estudiantes NO vive aquí** — en el original, `students`
  se llena desde el registro público (`escuela.html`, pendiente de
  consolidar). Esta vista admin (`courses`/`lessons`/`students`) solo
  gestiona cursos/clases y cambia el tier de estudiantes ya existentes,
  igual que el original — no se inventó un formulario de alta de
  estudiante que no existía.
- **Segundo caso del mismo bug `onChange` en Server Component** (ya visto
  en Hogar) — el select de "cambiar tier" también lo tenía; mismo fix
  (botón explícito en vez de auto-submit).
- **Verificado el mapeo especial `founder`**: la opción visual "Fundador"
  del select no es un valor real de `tier` — se traduce a `tier='pro'` +
  `is_founder=true`, confirmado en caliente (conteos de tier se
  recalculan correctamente tras el cambio).

## Clientes — decisiones tomadas durante la migración

- **El original era de solo lectura, con un bug real**: `loadClientesDashboard()`
  leía de `SB_P.clients` (personal), pero la única función de guardado que
  existía (`saveClient()`) escribía a `SB_I.clients` (agencia) — un cliente
  creado ahí nunca aparecía en este dashboard. Se construyó CRUD completo
  real sobre el dominio personal/freelance (`clients`, `projects`,
  `payments`, `invoices` — nombres ya reservados para este dominio desde el
  inicio de la migración, ver nota de "Dominios de datos con nombres
  duplicados" más abajo) en vez de replicar el dashboard roto.
- **Verificado en caliente con datos multi-entidad reales**: resumen
  mensual (cobrado/pendiente) recalculando correctamente al marcar pagos e
  invoices como pagados, con dos clientes y montos cruzados entre pagos e
  invoices para confirmar que cada total se calcula de la tabla correcta.

## Recursos — decisiones tomadas durante la migración (abre Negocio)

- **Biblioteca compartida, no datos privados por usuario** — igual que el
  original (`loadRecursos()` nunca filtraba por `user_id`), la consulta trae
  TODOS los recursos sin importar quién los creó. `userId` solo se usa para
  permisos de edición, no para visibilidad.
- **Sistema de roles simplificado**: el original tenía roles
  admin/employee/family/cliente/estudiante para permisos reales de edición
  (`canEdit || (employee && owner)`) — como esos roles no existen como
  cuentas reales todavía (solo `users.role` admin/usuario), edición se
  simplificó a "admin o dueño del recurso". `visible_para` se conserva como
  metadata/filtro, no como control de acceso.
- **Contenido sensible (`recursos_sensibles`) solo visible/editable por
  admin** — verificado en caliente con 2 usuarios reales (uno admin, uno
  no): el no-admin nunca recibe el contenido sensible en el HTML (ni
  siquiera en el payload), confirmando que no hay fuga de datos entre
  roles.

## Libros — decisiones tomadas durante la migración

- **Cuatro sub-entidades por libro** (`book_chapters`, `book_characters`,
  `book_scenarios`, `book_notes`), todas con `bookId` + `userId` propios y
  ownership verificado en cada acción vía `requireBookOwnership` — igual
  criterio que el resto de la migración (nunca confiar solo en el `id` de
  la sub-fila, siempre cruzar contra el libro dueño).
- **Personajes sin edición, solo alta/baja** — a diferencia de capítulos,
  escenarios y notas (que sí tienen `update*`), `bookCharacters` solo tiene
  `createCharacter`/`deleteCharacter`, igual que el resto de acciones que
  no tenían edición en el original; no se agregó `updateCharacter` porque
  no había campo editable de sobra (nombre/rol/descripción se recrean en
  vez de corregirse).
- **Verificado en caliente end-to-end vía HTTP real** (no solo lectura de
  código): crear libro → crear capítulo/personaje/escenario/nota → editar
  notas de capítulo, descripción/notas de escenario, y título/contenido de
  nota → eliminar cada sub-entidad → eliminar el libro. Confirmado contra
  Postgres real en cada paso, incluyendo el estado final limpio
  ("Sin libros todavía").

## Guiones — decisiones tomadas durante la migración (cierra Negocio)

- **Reemplaza el editor original en 3 bloques fijos** (hook/body/cta) en
  vez de bloques dinámicos — ver comentario en `lib/db/schema/guiones.ts`:
  el original modelaba "4 bloques" solo en memoria del cliente, pero al
  guardar siempre colapsaba a esas 3 columnas; se persiste directo así,
  sin el paso intermedio.
- **Flujo de generación con IA migrado a `/api/scripts/ai`, `/copy` y
  `/presentacion`** (reemplazan `/api/generate-script`,
  `/api/generar-copy`, `/api/generar-presentacion` del original) — pendiente
  del módulo Estudio/Director, que sigue pospuesto (ver sección aparte).
- **`status` avanza automáticamente al marcar ciertos ítems del checklist**
  (`guion`→en_progreso, `grabado`→grabado, `publicado`→publicado en
  `toggleChecklist`), pero solo hacia adelante (`CHECKLIST_ORDER`) — nunca
  retrocede el estado si ya estaba más avanzado. Replica el comportamiento
  del original.
- **No se pudo verificar el round-trip real de generación con IA** —
  `ANTHROPIC_API_KEY` vacía en `.env.local`, mismo bloqueo ya documentado en
  Dinero/Escanear. Sí se verificó que `/api/scripts/ai` responde 401 sin
  sesión y falla de forma controlada (500 con mensaje claro, sin tumbar el
  servidor) cuando falta la key — no queda como caja negra sin probar.
- **Verificado en caliente end-to-end vía HTTP real** (crear guión manual →
  editar título/estado/hook/body/cta/notas → marcar ítems del checklist,
  confirmando que el JSON `checklist` persiste correctamente → guardar
  publicación (video_url/plataformas/copy de YouTube e Instagram) →
  eliminar) contra Postgres real, terminando en estado limpio
  ("Sin guiones todavía").
- **Cierra el bloque Negocio** (Recursos, Clientes, Libros, Escuela,
  Guiones) — las 5 secciones tienen schema + acciones + página, typecheck
  limpio (`tsc --noEmit`), y las 5 fueron probadas en caliente contra datos
  reales antes de darlas por cerradas.

## Workspace — decisiones tomadas durante la migración

- **Página 100% estática, sin schema ni acciones** — confirmado en el
  original (`os.html`, sección `#section-workspace`): es literalmente una
  lista fija de links externos (n8n, Supabase ×2, Vercel, GitHub ×2,
  EasyPanel, YouTube, Instagram, YouTube Studio, Canva) agrupada en
  "Técnico" y "Contenido", sin ningún dato en Supabase detrás. Se copiaron
  los mismos links tal cual, sin agregar ni quitar ninguno.
- **Verificado en caliente**: página renderiza 200 con sesión real y
  todos los links del original presentes.

## Zona horaria — hallazgo sistémico y retrofit (afecta a casi toda la app)

**Qué pasó:** todas las páginas que necesitaban "la fecha de hoy" usaban
`new Date().toISOString().slice(0,10)` o construían `Date` locales
(`new Date(now.getFullYear(), now.getMonth(), ...)`, `.getDate()` sobre un
string "YYYY-MM-DD", etc.). Todo eso es sensible a la timezone del *proceso
Node*, no a la del usuario (Bogotá). El dev server corre en `America/Bogota`
así que nunca falló en las pruebas — pero un contenedor Docker por defecto
suele arrancar en UTC, y cerca de la medianoche (Bogotá va 5h detrás de UTC,
entre las 7pm y medianoche hora Bogotá el reloj UTC ya marca el día
siguiente) esto habría calculado "hoy" mal en silencio, en casi cada
sección con fecha.

**Fix:** `lib/date/bogota.ts` — `todayISO()`, `nowHHMM()`, `addDaysISO()`,
`currentMonthRangeISO()`, todos con timezone Bogotá explícita (vía
`Intl`/offset fijo `-05:00`, Colombia no tiene horario de verano) — correctos
sin importar la timezone del proceso. Se hizo retrofit en **13 archivos** ya
construidos: Cuerpo, Nutrición, Trabajo (2), Agenda, Dinero (Facturas,
Gastos, Cuentas, Escanear ×2), Hogar (2), Actividades, Eventos, Brújula,
Personas, y `lib/habitos/streak.ts`.

**Verificado con un instante real simulado** (`2026-08-26T02:30:00Z` con
`TZ=UTC`, que corresponde a `2026-08-25T21:30:00-05:00` en Bogotá): el
helper corregido devuelve `2026-08-25` (correcto), el patrón viejo devolvía
`2026-08-26` (un día adelantado) — reproduce exactamente la falla que se
habría visto en producción dockerizada. También se verificaron
`addDaysISO`/`currentMonthRangeISO` en casos límite (cruce de mes, febrero
no bisiesto).

**Para nuevas secciones**: usar siempre `lib/date/bogota.ts` para "hoy",
sumas/restas de días, y rangos de mes — nunca construir `Date` a mano para
lógica de negocio basada en el calendario de Bogotá.

## Hábitos — decisiones tomadas durante la migración (cierra Vida personal)

- **Núcleo limpio, confirmado explícitamente por el usuario** — se migró
  `activities` + `activity_logs` con CRUD completo (Hábitos/Gestión/Rachas)
  y racha real calculada correctamente. **Deliberadamente fuera de
  alcance** (documentado, no descuidado):
  - `habit_strikes` (sistema de mínimos/penalización) — el propio original
    lo dejó sin terminar (comentario literal: *"Aquí iría el reset de racha
    cuando esté implementado"*, nunca escrito).
  - Modo crisis, el compuesto "20/20/20", y los ~30 comportamientos
    hardcodeados por ID de hábito específico (skincare, limpieza, rutina
    nocturna, despertar, cierre de día, etc.) — viven enteramente en arrays
    de IDs fijos en el JS original, no en el modelo de datos.
  - Las columnas fantasma del original (`color`, `multi`, `min_value`,
    `target_value`, `penalty_days`, `penalty_pct`) — el propio formulario de
    creación/edición del original nunca las escribía.
- **Racha real, a diferencia del original**: el original solo mostraba
  "✓ hoy"/"✓ esta semana" en la tarjeta resumen (sin contar días
  consecutivos) y calculaba la racha real únicamente al abrir el detalle de
  un hábito. Aquí `computeDailyStreak()` (`lib/habitos/streak.ts`) calcula
  la racha real siempre, verificada con un caso de hueco intencional (una
  racha de 4 días + un hábito con hueco que correctamente corta a 1 día en
  vez de sumar el total de logs).
- **`category` es texto libre**, no las ~18 categorías fijas del original —
  como se descartó toda la lógica especial por categoría (crisis, 20/20/20,
  IDs hardcodeados), no tenía sentido mantener un enum cerrado atado a
  comportamiento que ya no existe.

## Reloj — decisiones tomadas durante la migración

- **100% cliente, sin schema ni Server Actions** — cronómetro/temporizador/
  contador son estado efímero por diseño (el original tampoco los
  persistía). Las alarmas siguen en `localStorage` (`os_alarmas`), no en
  Postgres — decisión consciente, no un descuido: una alarma solo puede
  sonar mientras esta pestaña del navegador sigue abierta (no hay
  notificaciones push), así que sincronizarlas entre dispositivos vía DB no
  agregaría funcionalidad real sin construir infraestructura de push
  notifications, que está fuera de alcance.

## Hogar — decisiones tomadas durante la migración

- **`chore_types` gestionable por el usuario** en vez de los 7 quehaceres
  hardcodeados del original (`CHORES_DEF`) — mismo criterio que
  accounts/exercises/bills. Se auto-siembran los mismos 7 por defecto en la
  primera carga (igual patrón que las áreas de Brújula).
- **`doneBy` es texto libre**, no un FK a un segundo usuario real —
  confirmado explícitamente por el usuario, mismo criterio que quedó
  pendiente para `assigned_to` en tasks: sin modelo multiusuario real
  todavía no vale la pena forzar un FK que no se puede probar en caliente
  con una segunda persona de verdad.
- **Separé la tabla `chores` original en `chore_types` (definición) +
  `chore_logs` (cada ocurrencia o nota)** — el original mezclaba ambas
  cosas en una sola tabla donde `name` era el id del quehacer hardcodeado,
  no un nombre real.

## Personas — decisiones tomadas durante la migración (abre Vida personal)

- **Tabla `birthdays` renombrada a `important_dates`** — el original la
  usaba para mucho más que cumpleaños (pagos, aniversarios, eventos). Se
  quitó `relationship_type`, columna duplicada de `type` en el original.
- **Cascada real en vez de borrado manual en dos pasos**: `important_dates.person_id`
  tiene `ON DELETE CASCADE` hacia `people.id` — borrar una persona borra su
  cumpleaños sincronizado automáticamente (el original lo hacía a mano en
  `deletePersona`, sin transacción).
- **No se migró el widget de alertas del dashboard home** (`bd-alert`/
  `bd-pills`, fechas urgentes de los próximos 30 días) ni
  `crearTareaDesdefecha` (crear tarea rápida desde una fecha importante) —
  son widgets del home (Rutinas), no de la página Personas en sí.

## Citas — decisiones tomadas durante la migración (cierra Productividad)

- **⚠️ Offset fijo `-05:00` (Bogotá) al parsear `datetime-local`, no
  `new Date(string)` a secas.** `<input type="datetime-local">` entrega un
  string sin timezone ("2026-08-25T14:30"); parsearlo con `new Date(...)` en
  el servidor lo interpreta en la timezone del *proceso Node*, no la del
  usuario. Hoy el servidor de desarrollo corre en `America/Bogota` así que
  ambas coinciden — pero si se dockeriza con una imagen que por defecto usa
  UTC (muy común), sin este fix las citas se guardarían 5 horas corridas sin
  ningún error visible. Colombia no tiene horario de verano, así que el
  offset fijo es seguro. Ver `slotTimeFrom`/`BOGOTA_OFFSET` en
  `app/dashboard/citas/actions.ts` — replicar el mismo patrón si se agrega
  otro input de fecha/hora en el futuro.
- **Cita → Agenda: sincronización real vía DB, no la del original.** El
  original "sincronizaba" citas a Agenda solo en `localStorage`, nunca en
  Supabase — un side-channel que ni el propio `agenda_items` real leía salvo
  por una migración única. Aquí `createAppointment` inserta un
  `agenda_items` real (`item_type='cita'`) en la misma transacción, y
  completar/cancelar/eliminar la cita borra ese bloque — es una mejora
  deliberada sobre el original, no una réplica.
- **Sin bloques de viaje ida/vuelta en Agenda.** `travel_before_minutes`/
  `travel_after_minutes` se guardan en la cita pero no generan bloques
  separados en `agenda_items` (el original sí lo hacía). Son datos
  informativos por ahora.
- **Sin detección de conflictos de horario.** El modal de "conflicto de
  cita" (mover/eliminar slot ocupado) del original no se migró — coherente
  con la versión simplificada de Agenda (sin drag-and-drop) que ya
  aprobaste. Dos citas o bloques pueden solaparse sin aviso.
- **`people_ids` no existe todavía** — el original vinculaba una cita a
  personas (`allPeople`/Personas, no migrado). Se agrega cuando se migre esa
  sección.

## Agenda — decisiones tomadas durante la migración

- **Versión simplificada, confirmada explícitamente por el usuario.** El
  original tenía una grilla de horario con drag-and-drop entre slots,
  selección múltiple y menú contextual (click derecho) — todo eso NO se
  migró. Lo que hay: lista cronológica de bloques del día (solo los
  ocupados, no las 144 casillas de 10 min vacías) con formularios para
  crear/editar (incluye cambiar la hora — cubre "mover" sin arrastrar) y
  eliminar. Retomar drag-and-drop es una mejora de UI futura, no bloqueante.
- **`agenda_items.item_type` sin CHECK constraint** — a propósito, es un
  campo extensible: hoy solo `'task'` (vincula a `tasks.id`) y `'nota'`
  (texto libre), pero sumará `'cita'`/`'habito'` cuando se migren esas
  secciones, sin necesitar tocar el constraint.
- **`renderAgendaHoy` (vista alterna "Hoy" agregando hábitos+tareas+citas
  en una sola lista) no se migró** — depende de `allActivities` (Hábitos,
  no migrado) y `allCitas` (Citas, no migrado). Retomar cuando esas dos
  secciones existan.
- **La sincronización automática Citas→Agenda** (`syncCitaToAgenda`,
  bloques de "viaje ida/vuelta") tampoco se migró — depende de Citas.

## Eventos — decisiones tomadas durante la migración

- **Agregué `deleteEventType`/`deleteOccurrence`**, que no existían en el
  original (solo tenía crear/editar) — mismo criterio de siempre: si es
  barato de agregar y evita datos huérfanos sin forma de corregirlos, se
  agrega.
- **Pendiente cuando se migre Citas**: `event_occurrences` es la tabla de
  "veces registradas manualmente"; el original también contaba citas
  vinculadas (`appointments.event_type_id`) como otra forma de "vez" del
  mismo tipo de evento (ej. "Restaurante nuevo" contando tanto ocurrencias
  manuales como citas de tipo restaurante). Cuando se migre Citas, sumar ese
  conteo y esa sección "Citas vinculadas" a la tarjeta de tipo de evento.
- **No se migró el colapso de categorías por `localStorage`** — las 4
  categorías (Cultural/Familia/Amigos/Visita) se muestran siempre expandidas
  vía `<details open>`; cada tipo de evento sigue siendo colapsable
  individualmente.

## Brújula — decisiones tomadas durante la migración

- **Árbol siempre con `<details>` nativo, sin estado de cliente.** El
  original guardaba qué nodos estaban expandidos en un `Set` de JS en
  memoria (se perdía al recargar). Aquí cada área/proyecto/sub-proyecto es
  un `<details>` HTML — expandir/colapsar funciona sin JavaScript ni
  componente cliente, a costa de no recordar el estado entre cargas de
  página (tampoco lo hacía el original entre sesiones).
- **No repliqué el bug de `category: 'iarcania'` hardcodeado** en
  `_guardarTareaProyecto()` del original (toda tarea creada desde un
  proyecto de Brújula quedaba taggeada "iarcania" sin importar el área real).
  Las tareas creadas desde Brújula aquí no llevan categoría — se puede
  asignar luego desde Actividades si hace falta.
- **No se migró el modal de "filosofía" con quick-add de tarea
  hoy/mañana** (`openFilosofiaModal`, `mf-tarea-input` etc.) — es UI
  redundante sobre los mismos datos que ya cubre el árbol principal
  (crear tarea en un proyecto + el widget "Mañana"). El enfoque/filosofía
  del área sí se muestra, solo no en un modal aparte.
- **Semilla de las 6 áreas personales** (`_seedBrujulaAreas`) se replica tal
  cual — es contenido real del usuario (IArcanIA, Void Stoic, Memoria
  Vintage, Luna Angelical, Familia & Amigos), no boilerplate genérico.

## Productividad — decisiones tomadas durante la migración

- **`tasks` no tiene `assigned_to`/`created_by`** (el original sí — permitía
  asignar una tarea al otro usuario de la pareja). Decisión explícita del
  usuario: mantener `tasks.userId` como dueño exclusivo por ahora; agregar
  asignación multiusuario más adelante cuando el caso de uso sea real y se
  pueda probar en caliente con ambas personas logueadas. Si se retoma, es un
  cambio de modelo que toca el scoping de Trabajo, Actividades e Ideas
  (`createTaskFromIdea`), no solo agregar una columna.
- **`tasks.color` no existe** — en el original se guardaba redundante
  (derivado de `category` vía el mapa `CATS`). Aquí se deriva en la UI desde
  `lib/constants/cats.ts` en vez de duplicarlo en la base.
- **`allActivities`/tabla `activities`** en el original es el catálogo de
  hábitos/rutinas (skincare, limpieza, rutina nocturna, despertar, vicios,
  trabajo profundo...), usado transversalmente por Rutinas y Hábitos — **no**
  tiene relación con la sección "Actividades" del nav, que en realidad es un
  visor/gestor de `tasks` con filtros. No confundir al migrar Hábitos.
- **CRUD completo de tasks vive en `app/dashboard/actividades/actions.ts`**
  (Actividades es la vista de gestión completa); Trabajo importa `createTask`
  y `toggleTaskStatus` desde ahí en vez de duplicarlos — evitar reintroducir
  una copia en `trabajo/actions.ts`.

## Dinero — decisiones tomadas durante la migración

- **"Cobros" no es parte de Dinero.** En el original, ese tab usaba
  `SB_I.payments` (cobros a clientes de la agencia), no ingreso personal. Se
  sacó del nav de Dinero; se retoma cuando se migre Clientes/CRM. El ingreso
  personal real vive en la tabla `income`, creada desde el botón "+ Ingreso"
  dentro de Gastos — igual que en el original.
- **`accounts` es gestionable por el usuario**, no las 3 cuentas hardcodeadas
  (Bolsillo/Nequi/Bancolombia) del original — mismo criterio de "siempre dar
  un formulario de alta" usado en el resto de la migración. El símbolo
  TypeScript se llama `financialAccounts` (la tabla SQL sigue siendo
  `accounts`) porque `auth.ts` ya exporta un `accounts` para la tabla OAuth de
  NextAuth — ver comentario en `lib/db/schema/dinero.ts`.
- **Metas de compra pasó de `localStorage` a la tabla `purchase_goals`** — es
  una lista de deseos priorizada (no un tracker de ahorro progresivo; no hay
  campo "ahorrado hasta ahora", igual que en el original).
- **Fix consciente en Escanear**: el original, al escanear una
  `factura_recurrente`, creaba la fila en `bills` pero nunca un
  `bill_payments` — quedaba "pendiente este mes" pese a acabar de
  registrarse. Aquí `registerScan()` sí crea el `bill_payments` junto con la
  factura: el recibo escaneado es la evidencia del pago.
- **Escanear requiere `ANTHROPIC_API_KEY`** en `.env.local`/`.env` para
  funcionar de extremo a extremo — no se pudo verificar el round-trip real
  con la API de Anthropic en esta sesión (la key está vacía). Sí se verificó
  que la ruta `/api/scan-receipt` responde 401 sin sesión y 400 con campos
  faltantes, y que el flujo de registro (`registerScan`) hace lo correcto
  simulando la transacción directamente contra la base.
- **Pequeña inconsistencia heredada, no resuelta**: las categorías sugeridas
  en Gastos (`GASTO_CATS`, sin "herramientas") y en Escanear (`CATEGORIAS`,
  con "herramientas") no son idénticas — así estaban en el `os.js` original
  (`GASTO_CATS` vs. el prompt de `scan-receipt.js`). No se unificaron porque
  `category` es texto libre sin CHECK en ninguna de las dos tablas; unificar
  la lista es un cambio de UI de bajo riesgo para cuando se retome Dinero.

## Pendiente: módulo Estudio / Director

**Estado:** pospuesto, fuera del alcance inicial de la migración.

**Qué hacía:** editor de guiones (`js/estudio.js`, 1.794 líneas) con una vista
"director" (`director.html`) que se abría en una segunda pestaña/ventana vía
`window.open('/director.html?scriptId=...')` y se sincronizaba con la vista
de edición mediante `postMessage` — mostraba reloj, controles de timer y qué
bloque del guión está "ahora en pantalla" para grabaciones en vivo.

**Por qué se pospone:** no está conectado a ningún nav activo en el dashboard
actual (`os.html`/`os.js`) — es código construido pero no cableado. El flujo
de generación de guiones cambió desde que se escribió (ver sección "Guiones"
en `os.js`, que hoy pasa por `/api/generate-script`, `/api/generar-copy` y
`/api/generar-presentacion`), así que si se retoma esta feature debe
rediseñarse contra el flujo actual, no portarse tal cual.

**Código original de referencia:** `js/estudio.js`, `director.html` (en la
raíz del repo, versión estática — no se ha tocado ni eliminado).

## Pendiente: widget "proyecto del día" y acoplamiento con Hábitos (sección Trabajo)

**Estado:** pospuesto, fuera del alcance de la migración de Trabajo.

**Qué hacía:** en `os.js`, la sección Trabajo tenía un tercer widget además del
foco del día y las notas — un "proyecto del día" sobre `scripts` (Guiones),
filtrado por canal y estado (`borrador`/`en_progreso`/`listo_grabar`), con un
timer que al usarse insertaba logs en `activity_logs`. Además, marcar/
desmarcar un item de foco de trabajo como completo disparaba lógica cruzada
con Hábitos: si había algún item de trabajo o algún hábito `trabajo_profundo`
completado, se auto-registraba (o revertía) un log del hábito fijo `a_t1h`
("Trabajar 1 hora") en `activity_logs` (`os.js:2504-2517`).

**Por qué se pospone:** ambas piezas dependen de tablas/secciones que todavía
no existen en el schema nuevo (`scripts` de Guiones, `activity_logs` de
Hábitos). Se migró solo la parte autocontenida de Trabajo: `tasks`,
`daily_focus` (list_type='trabajo') y `work_notes`.

**Cómo retomarlo:** cuando se migren Guiones y Hábitos, agregar el widget de
proyecto del día como una consulta a `scripts` filtrada por canal/estado, y
decidir conscientemente si se replica el acoplamiento automático con
`activity_logs` o se deja como una acción manual del usuario — el original no
tiene un dueño claro de esa regla de negocio (no hay comentario ni docs que
la expliquen, solo el código).

## `daily_focus` compartida con Actividades (no migrada) y Rutina nocturna (no migrada)

La tabla `daily_focus` ya soporta `list_type IN ('hoy','extra','trabajo')` y
`task_type` (hoy solo `'task'`), pensada para que Actividades (`hoy`/`extra`)
y el planeador de "mañana en trabajo" de Rutina nocturna la reutilicen tal
cual cuando se migren, sin tocar el schema de nuevo. `task_type='cita'`
(referencia a `appointments`) queda sin implementar hasta que se migre Citas.

## Dominios de datos con nombres duplicados entre los dos Supabase actuales

`clients` y `payments` existen tanto en el proyecto Supabase "Personal"
(`SB_P`, CRM freelance/personal — `projects`/`invoices`) como en el proyecto
"IArcanIA" (`SB_I`, CRM de la agencia). Al consolidar en un solo Postgres vía
Drizzle:

- Dominio personal/freelance → `lib/db/schema/clientes.ts`: `clients`,
  `payments`, `projects`, `invoices` (nombres tal cual).
- Dominio agencia → `lib/db/schema/crm.ts`: `crm_clients`, `crm_payments`
  (renombrados para evitar colisión).

## IDs

Todo el schema nuevo usa `uuid` nativo de Postgres (`gen_random_uuid()` vía
`.defaultRandom()` de Drizzle), no el patrón viejo de IDs generados en el
navegador (`'prefijo_' + Date.now() + '_' + random`) — no hay datos de
producción reales que migrar, así que no hace falta preservar compatibilidad.
