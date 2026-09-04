# Sistema de diseño del dashboard

Guía para trabajar en la UI del dashboard (`/dashboard/*`). Si llegas sin
contexto, lee esto antes de tocar una pantalla.

---

## 1. Hay dos sistemas visuales conviviendo

El dashboard está a mitad de un **rebranding**. Cada token, clase helper y
componente pertenece a uno de dos sistemas:

| | Sistema **viejo** (`os.css`) | Sistema **nuevo** (rebranding) |
|---|---|---|
| Origen | portado de `os.css`, el dashboard operativo original | documento de diseño "Sistema IArcanIA" (turnos 4 y 5) |
| Fondo | `#080808` (negro casi puro), cream `#e8e0d0` | canvas `#0F0F11`, texto frío `#F1F0F7` |
| Acento | morado plano `#9b72f0` + dorado `#c4a35a` | violeta `#8B5CF6` (acción) + ámbar `#E8A33D` (nav/hábitos) |
| Piezas | clases sueltas + 5 helpers en `globals.css` | `components/ui/` (16 piezas) |
| Estado | lo usan las secciones **sin migrar** | lo usan las secciones **migradas** |

El plan es migrar sección por sección al sistema nuevo y, cuando no quede
ninguna en el viejo, borrarlo entero (ver `migracion-rebranding.md`, PASO 5).
**Mientras tanto los dos coexisten a propósito.** No mezcles: una sección
está entera en uno o entera en el otro (el *shell* —sidebar, fondo— ya es
nuevo para todas).

### Dónde vive cada cosa

- **`tailwind.config.ts`** → tokens de color, radio, duración. El bloque
  "SISTEMA VIEJO" y el bloque "SISTEMA NUEVO" están separados por comentarios.
- **`app/globals.css` → `@layer components`** → helpers viejos (`.input`,
  `.card-glow`, `.btn-primary`, `.btn-secondary`, `.stat-num`) y la única
  utilidad nueva, `.focus-ring`.
- **`app/globals.css` → `@layer base`** → `body` (fondo ya migrado a
  `bg-canvas`; el color de texto por defecto sigue en el token viejo hasta
  PASO 5) y la regla `h1..h4 { font-display font-bold }`.
- **`components/ui/`** → las 16 piezas nuevas + helpers (`cx`, `catInfo`).
- **`app/dashboard/layout.tsx` + `components/app/nav-links.tsx`** → el shell
  (ya migrado).
- **`os.css`**: era el CSS del dashboard original, ya **borrado** (no se
  importaba). Los tokens que se portaron de él viven en el bloque "SISTEMA
  VIEJO" de `tailwind.config.ts` hasta PASO 5. Su único detalle de diseño
  no recogido en otro lado (el editor "branded" de Guiones) quedó anotado
  en `docs/migracion-rebranding.md`.

---

## 2. Tokens del sistema nuevo

Todos son claves de color de Tailwind: se usan como `bg-<token>`,
`text-<token>`, `border-<token>`, `ring-<token>`.

### Superficies y texto

| Token | Hex | Para qué |
|---|---|---|
| `canvas` | `#0F0F11` | fondo de la app (lo pinta `<body>`) |
| `surface` | `#16161A` | cards y paneles |
| `surface-2` | `#1C1C21` | header de card, hover, fondo de modal |
| `surface-sunken` | `#131316` | sidebar, barras de captura (QuickCapture) |
| `surface-active` | `#161616` | fondo del item activo del sidebar |
| `line` | `#262629` | borde por defecto |
| `line-strong` | `#33333A` | borde en hover y en modales |
| `ink` | `#F1F0F7` | títulos y valores |
| `ink-muted` | `#9896B0` | cuerpo, descripciones, labels de sección |
| `ink-dim` | `#5A5870` | metadatos, contadores, texto terciario |

### Acento y semánticos

| Token | Hex | Regla de uso |
|---|---|---|
| `accent` | `#8B5CF6` | **acción primaria** (botón, foco, subrayado de pestaña activa) y item activo del sidebar. Un solo acento primario por pantalla. |
| `accent-soft` | `rgba(139,92,246,.12)` | fondo hover de acción primaria |
| `accent-text` | `#C4B5FD` | violeta más claro, para **texto pequeño** que necesita leerse sobre oscuro (chip tono `accent`, estado "enviando" del Form) |
| `accent-warm` | `#E8A33D` | **uso restringido**: nav activo (texto+borde dorados), marcador de «ahora» en rejillas, borde izquierdo de bloque de hábito, y color de la categoría `infra`/`habitos`. **Nunca** en botones ni texto de cuerpo. |
| `success` | `#4ADE80` | completado, racha viva |
| `danger` | `#F87171` | vencido, eliminar. El botón peligroso **nunca es sólido**: borde + fondo al 10%. |

### Categorías

`category-{iarcania,contenido,proyectos,personal,infra,habitos,none}`. La
**fuente única** de estos colores es `lib/constants/cats.ts`; el token de
Tailwind solo lo refleja. En código se resuelve con `catInfo(key)` de
`components/ui/category.ts`, que devuelve `{ label, color }` y hace fallback
a `none` (`#3A3A42`, gris "sin clasificar") si la categoría es nula o
desconocida. **No inventes colores por hash**: si agregas una categoría, se
agrega en `cats.ts`.

Tres usos permitidos del color de categoría (5a):
1. Borde izquierdo de 3px en item de lista (`ItemRow`).
2. Punto de ~6px en tabla/celda densa (`CategoryDot`).
3. Chip a 12% de fondo / 28% de borde (`CategoryTag`).

Prohibido: fondo de fila completa, texto de cuerpo, color de botón. **El
color de categoría informa, no jerarquiza**: si compite con el violeta de
acción, gana el violeta.

### Radio, transiciones, foco, hover

- Radio: `rounded-ui-sm` (5px, inputs chicos), `rounded-ui` (6px, botones/
  inputs/chips), `rounded-ui-lg` (10px, cards y paneles), `rounded-full`
  (píldoras). *(En PASO 5 estos `ui-*` se renombran a `sm/md/lg`.)*
- Transición: **solo `colors` y `opacity`, 120 ms** (`transition-colors
  duration-120`). Nada de `transform`, nada de `translateY` en hover — es una
  herramienta de uso diario, no una landing. Todo elemento interactivo lleva
  `transition-colors duration-120`.
- **Foco visible en TODO elemento interactivo** (no solo inputs): clase
  `.focus-ring` (`focus-visible:ring-2 ring-accent/[0.22]`, sin outline azul).
  Para elementos enfocables dentro de un contenedor `overflow-hidden` (filas
  de `Table`, segmentos, paginación) usa `.focus-ring-inset` — el anillo va
  hacia adentro para no recortarse.
- **Hover**: cambio de fondo a `surface-2` **solo si el elemento entero es
  clickeable** (una fila-enlace, un botón). Un hover que aclara el fondo sin
  que un clic haga nada promete interacción que no existe — en tablas de puro
  dato es ruido. Para marcar la fila que se está editando existe la prop
  `highlighted` de `TableRow` (estado real, fondo fijo).
- Sombras: **no hay**. La elevación es el borde y el cambio de superficie.
- **Cifras**: toda columna de números, fechas, duraciones y contadores lleva
  `tabular-nums` (alineación) y suele ir `text-right`.
- **Texto largo de usuario**: siempre `truncate` + `title={textoCrudo}`
  (tooltip nativo, cero JS). Nunca dejar un título cortado sin forma de
  verlo completo.

### Tipografía

- Familias: `font-display` = Playfair Display (400/600/700), `font-body` =
  Outfit (300/400/500/600). Cargadas en `app/layout.tsx` vía `next/font`.
- Escala del sistema:

Escala **+1 de 5f** aplicada: cuerpo y metadatos suben un punto (`text-body`
13.5, `text-meta` 11.5, tokens de `fontSize`). Labels, micro-badges y títulos
se dejan como están.

| Rol | Spec |
|---|---|
| Título de página | Playfair 21px / 700 (`font-display text-[21px] font-bold`) |
| Número destacado (stat) | Playfair ~22px / 700 `tabular-nums`, color por tono |
| Label de sección | Outfit 10.5px / 600, `tracking-[.12em]`, `uppercase`, `ink-muted` |
| Cuerpo (fila, item, input) | `text-body` = Outfit 13.5px / 400, `ink` |
| Metadato (fecha, contador) | `text-meta` = Outfit 11.5px / 400, `ink-dim` |
| Micro (badge) | Outfit 10px / 600, `uppercase` |

---

## 3. Regla del item activo del sidebar (importante)

El item de navegación activo del sidebar es **dorado**, nunca violeta:

- texto `accent-warm`
- **borde izquierdo dorado de 3px** (`border-l-[3px] border-accent-warm`)
- fondo `surface-active` (`#161616`)

Está implementado en `components/app/nav-links.tsx`. El violeta (`accent`)
es exclusivamente para **acción primaria** (botones, foco, subrayado de
pestaña). Que un item de menú se pinte violeta es un bug.

Las pestañas de sub-navegación (`SubNav`) sí usan violeta: la pestaña activa
lleva subrayado `accent` de 2px + texto `ink`.

---

## 4. Las 16 piezas de `components/ui/`

Importa de `@/components/ui` (barril **solo con piezas server-safe**). Las
piezas con estado cliente se importan de su archivo:
`@/components/ui/form`, `/modal`, `/confirm-dialog`, `/toast`, `/sub-nav`.

| Pieza (exports) | Archivo | Render | Para qué / props clave |
|---|---|---|---|
| **PageHeader** | `page-header.tsx` | server | Emoji de sección + título serif + subtítulo de **conteos reales** + `actions` (máx. 1 primaria + 2 secundarias) + slot `tabs` para `<SubNav>`. |
| **SubNav** | `sub-nav.tsx` | client | Pestañas = rutas hijas reales, derivadas de `NAV_GROUPS`. Devuelve `null` si la sección no tiene hijos. Se monta en el slot `tabs` del PageHeader o en el layout de la sección. Opcional `counts`. |
| **Button** | `button.tsx` | server | `variant`: `primary` (accent plano), `secondary` (borde `line`), `ghost`, `danger` (borde+fondo 10%, nunca sólido). `size`: `sm`\|`md`. `href` lo hace `<a>`. Reemplaza `bg-gradient-cta`. |
| **Card** | `card.tsx` | server | `title` (se pinta en mayúsculas), `count` (badge), `action` (JSX a la derecha), `footer`, `flush` (quita el padding del cuerpo, para tablas/listas). Sin sombra. |
| **Table** (`Table`, `TableHead`, `TableRow`) | `table.tsx` | server | Filas de 33–38px, borde izquierdo de 2px (`category` o `accentColor` para override). Acciones **siempre visibles**. Prop `highlighted` = fila marcada de forma persistente (la que se edita via `?edit=id`). La variante `href` (fila-enlace) tiene hover a `surface-2` y `.focus-ring-inset`; la variante sin `href` NO tiene hover. El mismo string `cols` (grid-template-columns) va a `TableHead` y a cada `TableRow`. |
| **ItemList** (`ItemList`, `ItemRow`) | `item-list.tsx` | server | Alternativa a la tabla cuando la fila necesita dos líneas. `ItemRow`: `href` (toda la fila es enlace), `category` (borde izq. 3px), `leading` (el checkbox va aquí como `<form>` aparte), `title`, `meta`, `trailing`. |
| **Chip** / **Badge** / **CategoryDot** / **CategoryTag** | `chip.tsx` | server | `Chip`: píldora neutra con `tone`. `Badge`: estado, micro mayúsculas, `tone` (`danger`\|`warm`\|`success`\|`neutral`\|`accent`\|`info`). `CategoryDot`/`CategoryTag`: color desde `cats.ts` vía estilo inline. |
| **Input** / **Select** / **Textarea** / **Labeled** | `inputs.tsx` | server | Controles con estilo del sistema (fondo `canvas`, borde `line`, radio 6px, `.focus-ring`). Sin `w-full` en la base (para que sirvan inline). `Labeled` = etiqueta en mayúsculas + control apilados, el reemplazo del `<Field>` viejo para `<form action={serverAction}>` planos; el ancho del control lo pone quien llama. |
| **Segmented** / **Stepper** | `segmented.tsx` | server | `Segmented`: control de segmentos como enlaces (`options[{label,href,active}]`); el activo va sobre `surface-2`. `Stepper`: `‹ label ›` con `prevHref`/`nextHref` (flecha inerte si falta) y `current` para pintar el label en `accent-warm`. |
| **Progress** / **MetricCard** | `progress.tsx` | server | `Progress`: label + barra + valor (`tabular-nums`), `tone`. `MetricCard`: número Playfair `tabular-nums` + label mayúsculas + barra opcional + prop `hint` (línea en minúsculas bajo la barra, para frases largas tipo "meta 2000 kcal" que no caben en el label), `tone` (`primary`\|`accent`\|`warm`\|`success`\|`danger`). |
| **Section** | `section.tsx` | server | Bloque de sección dentro de una página: label en mayúsculas + slot de acción + contenido. Reemplaza el `<h2>` suelto repetido. **Ritmo vertical**: raíz de página `flex flex-col gap-8` (32px entre secciones), dentro de `Section` `gap-4` (16px). |
| **EmptyState** / **Skeleton** | `states.tsx` | server | `EmptyState` = **sección vacía de verdad** (primera vez). Frase en prosa, segunda persona, que dice **qué va aquí y por qué está vacío**, + una acción. Nunca «No hay datos». `Skeleton`: barras `animate-pulse`, para `<Suspense>` por card. |
| **NoResults** | `no-results.tsx` | server | 5d — **el filtro/búsqueda no devolvió nada, pero SÍ hay datos**. `query` + `context` (frase del filtro activo) + `clearHref` (+ `scopeHref` opcional para "Buscar en todo"). Distinto de `EmptyState`: no invita a crear, invita a deshacer el filtro. |
| **Pagination** | `pagination.tsx` | server | 5d — «N–M de T» + números de página (`tabular-nums`). `page`/`pageSize`/`total` + `hrefFor(p)` que conserva el resto de filtros. Devuelve `null` si hay una sola página. (Añadida en Fase 02.) |
| **QuickCapture** | `quick-capture.tsx` | server | Barra pegada al borde inferior del contenido. Un `<form action={serverAction}>` plano: `name` (campo obligatorio), `placeholder`, `hidden` (campos ocultos), `extras` (selects con default), `submitLabel`. La validación real vive en la Server Action. |
| **Form** (`Form`, `FormField`, `FormActions`, `FormBanner`, `useFormCtx`) | `form.tsx` | **client** | Formulario con los 4 estados de 5b (vacío / enviando / error de campo / exitoso). React 18.3 no tiene `useActionState`/`useFormStatus`, así que el estado va **a mano** con `useState` + `useTransition` (igual que `ToggleRow`). La Server Action devuelve `FormResult` (`form-result.ts`: `formOk()` / `formErrors({campo: msg}, msgGeneral?)`). `FormField` clona su hijo (un control) para inyectarle `name`, `aria-invalid` y borde rojo en error. El valor escrito **nunca** se borra en error. |
| **Modal** | `modal.tsx` | **client** | Shell para route-intercepting modal (`@modal/(.)…`). Cierra con Esc, clic en backdrop o ✕ → `router.back()` (o `onCloseHref`). Mismo `<Form>` adentro, sin variantes. |
| **ConfirmDialog** | `confirm-dialog.tsx` | **client** | Confirmación destructiva. `trigger` (JSX), `action` (Server Action), `hidden`. Botón peligroso borde+fondo 10%; "Conservar" a la derecha con foco inicial; Esc = conservar. |
| **Toast** (`ToastProvider`, `useToast`) | `toast.tsx` | **client** | Confirmación abajo a la derecha, 4 s, una línea. `useToast().show({message, tone?, undo?})`. `undo` es una Server Action inversa + campos; se omite el enlace si no existe la acción inversa. Requiere montar `<ToastProvider>` una vez (aún sin montar). |

Piezas que **no** son del sistema nuevo pero viven en la carpeta:
`field.tsx` (el `Field` viejo, lo usan ~10 páginas sin migrar; su reemplazo
es `FormField`). Y `components/app/optimistic-toggle-row.tsx` (`ToggleRow`):
fila con feedback optimista sin `useOptimistic`, **se conserva y se
reestiliza, no se reescribe** — está verificado contra Postgres.

---

## 5. Los 6 arquetipos de página

Cada sección se arma con **uno** de estos moldes (turno 4). No se inventan
layouts nuevos: si algo no sale con las piezas, primero se agrega la pieza.

| # | Arquetipo | Forma | Secciones |
|---|---|---|---|
| 1 | **Lista / CRUD** | tabla o lista de una entidad + quick-add fijo abajo; opcional detalle lateral | Actividades*, Ideas, Personas, Hogar, Libros, Clientes, Recursos |
| 2 | **Temporal** | rejilla/timeline de día o semana, navegador de fecha, línea de «ahora» | Agenda*, Citas, Eventos, Reloj |
| 3 | **Seguimiento con métricas** | fila de `MetricCard` + heatmap/series + registro | Hábitos, Cuerpo, Dinero |
| 4 | **Tablero por etapas** | columnas = etapas, tarjetas avanzan con un `<form>` "mover a ▾" (sin drag) | Trabajo, Planner, CRM |
| 5 | **Documento / editor** | riel de documentos + editor central + panel de estructura/metadatos | Guiones, Slides, Escuela |
| 6 | **Panel resumen** | stats + secciones-resumen + atajos, sin CRUD pesado | Rutinas*, Brújula, Workspace |

`*` = ya migrada.

**Variantes / ajustes (5g):**
- **Actividades** se hizo con la **variante 2a** del arquetipo 1: tabla densa
  agrupada por vencimiento, **sin** panel de detalle (se descartó el detalle
  lateral que tenía).
- **Dinero** = arquetipo 3 **+ sub-navegación** de 6 pestañas (Cuentas/Metas
  son arq. 3; Gastos/Facturas/Cobros son arq. 1; Escanear es una acción).
- **CRM** = arquetipo 4 **+ pestañas** (Pipeline es el 4; Presupuesto arq. 3;
  Deudas arq. 1).
- **Hábitos** = arquetipo 3 **+ pestañas** (Gestión, Rachas).
- **Personas, Recursos, Ideas** = arquetipo 1 pero **obligadas a búsqueda +
  paginación desde el primer día** (listas largas, patrón 5d): encabezado de
  tabla `sticky` dentro del scroll de la card, búsqueda y página en
  `searchParams` (`?q=&page=`), "sin resultados" que nombra el término y los
  filtros y ofrece deshacerlos (distinto del estado vacío de sección).

**Nutrición** es pestaña de **Cuerpo** (`/dashboard/cuerpo/nutricion`,
arquetipo 3), no sección propia. **Escuela** no lleva `<SubNav>`: sus
"pestañas" son `?tab=` sobre una sola página, y `cursos/[id]` es ruta de
detalle.

---

## 6. Restricciones de React Server Components

Por qué las piezas tienen la forma que tienen:

- **No se pueden pasar funciones a un Client Component** (ni como prop ni
  como `children`), salvo Server Actions. Por eso `ToggleRow` recibe
  `fieldsOn`/`fieldsOff` como objetos planos y `meta` como JSX
  pre-renderizado, no callbacks. Nada de render-props.
- Las piezas cliente (`Form`, `Modal`, `ConfirmDialog`, `Toast`) reciben
  Server Actions y JSX, ambos serializables. El estado de error de `Form`
  viaja por React context **dentro del árbol cliente** (`Form` + `FormField`
  ambos client).
- **React 18.3** (aunque el repo esté en Next 15): no hay `useActionState`
  ni `useFormStatus`. Los estados de formulario se hacen a mano con
  `useState` + `useTransition`. Verifica la versión en `package.json` antes
  de usar hooks de React 19.
- Fechas: usa siempre `lib/date/bogota.ts` (`todayISO`, `nowHHMM`,
  `addDaysISO`, `currentMonthRangeISO`) para "hoy" y cálculos de calendario.
  Nunca construyas `Date` a mano para lógica de negocio — el proceso Node
  puede correr en UTC.

---

## 7. Cómo migrar una sección

1. Identifica su arquetipo (tabla de §5).
2. Reescribe la UI **solo** con `components/ui/`. Si falta una pieza, se
   agrega a `components/ui/` primero y después se usa — nunca estilos
   propios en la página.
3. Reutiliza las **Server Actions existentes** de esa sección. Un solo lugar
   de verdad por dominio: si otra sección ya tiene el CRUD, se importa, no se
   duplica.
4. Elimina de esa página **todo** el estilo viejo: `bg-bg-*`, `text-text-*`,
   `border-border`, `rounded-{sm,md,lg}` viejos, `.btn-primary`,
   `.btn-secondary`, `.card-glow`, `.stat-num`, `.input`, `bg-gradient-cta`,
   `shadow-glow-purple`, hexadecimales hardcodeados, imports de `Field`.
5. Si la sección tiene sub-rutas, añádelas a `NAV_GROUPS.children` en
   `nav-links.tsx` y monta `<SubNav>` (el sidebar sigue mostrando solo el
   primer nivel).
6. `build`, `lint` y `tsc --noEmit` limpios. Un commit por sección.
7. **No toques** secciones que todavía no migraste.
