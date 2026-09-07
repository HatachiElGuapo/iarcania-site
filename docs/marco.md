# Marco — documentos, marcado de color y autocoloreado

`/dashboard/marco`: los documentos personales de Miguel (Misión, Propósito,
Compromisos de vida, Filosofías). Se leen a diario y se imprimen. El color
**no es decoración**: cada palabra clave va coloreada según qué representa.

## La leyenda

| color | significa |
|---|---|
| **rojo** | carga emocional intensa: dolor, castigo, pereza, vergüenza, amor. Lo que duele, lo que se paga, lo que está en juego. (En el corpus Void Stoic: "tensión / precio".) |
| **verde** | crecimiento, disciplina, acción constructiva, dedicar, espíritu. Avanzar o construir. El verbo que mueve. |
| **azul** | conceptos serenos o abstractos. Lo mental y reflexivo. Sereno, dirección, norte, determinación, calma, estructura. (Corpus: "mente / claridad".) |
| **morado** | dualidades y opuestos internos (yin yang), emociones, libertad, propósito — y la **identidad como principio**: quién eres, qué defiendes. |
| **rosa** | el sujeto, el que se identifica con la frase: `mi`, `yo`, `mí mismo`. Presente y futuro. (No existe en el corpus; nunca se dispara ahí.) |
| **naranja** | cifras, metas y fechas. Sistema de énfasis, uso restringido. |

**Reconciliación con el corpus Void Stoic** (`corpus_void_stoic.html`, 20
filosofías coloreadas por Miguel): compatible, no idéntica. rojo/verde/azul/
naranja coinciden. El corpus usa **morado** para "identidad / principio"
(ganadores, alma, propósito, valioso…) — se folded dentro del morado de
Marco ampliando la glosa (arriba). El corpus nunca usa rosa.

**Nota `alma` vs `espíritu`**: casi sinónimos, distinto color entre los dos
sistemas. Se tratan como **entradas distintas** del diccionario:
`alma → morado` (lo interior, la identidad), `espíritu → verde` (la parte
que se cultiva, según la leyenda de Marco). Es más honesto que forzarlas al
mismo color.

## Sintaxis del marcado

Inline, en el texto plano del documento:

```
{rojo:palabra}          colorea "palabra"
{morado:varias palabras} colorea una frase entera
{-:palabra}             fuerza SIN color (y el diccionario no la vuelve a tocar)
```

Un color desconocido (`{xyz:x}`) no rompe la vista: se avisa por consola y
el texto se renderiza plano. Parser: `app/dashboard/marco/marked.tsx`.

## Autocoloreado

No hace falta marcar a mano. Se escribe la frase en texto plano y, **al
guardar**, `updateMarcoDocument` corre el diccionario y materializa los
`{color:palabra}` en el `content`. Lo guardado es siempre el formato con
marcas — el render no cambia.

Reglas (de `lib/marco/autocolor.ts`):

- **máximo 3 resaltados por frase** (por línea en las listas, por párrafo en
  prosa). Si hay más candidatos, se toman **los 3 primeros por posición** —
  es un primer pase, no un juicio estético; para ajustarlo está el override.
- **una palabra, un solo color**, en todas las frases (lo garantiza la forma
  del diccionario: `palabra → color`).
- **si no reconoce nada, la frase queda sin color.** No pasa nada.
- **idempotente**: re-guardar no duplica marcas. Las marcas explícitas
  (`{color:x}` y `{-:x}`) se respetan y su texto no se vuelve a escanear;
  las de color cuentan contra el tope de 3.
- **override**: `{rojo:x}` fuerza color; `{-:x}` fuerza plano. Si borrás una
  marca que el diccionario reconoce, al re-guardar te la vuelve a poner —
  usá `{-:x}` para dejarla plana de forma permanente.
- las frases de **varias palabras** (`{rojo:no quieres}`) van a mano; el
  diccionario es palabra por palabra.

### El diccionario

`lib/marco/color-dictionary.ts` — un `Record<string, MarcoColor>` editable a
mano.

**Ampliarlo**: agregá `palabra: "color",` en el grupo que corresponda.
Aplica en el próximo guardado de cualquier documento.

**Match**: por palabra entera, minúsculas y sin tildes (`Éxito` matchea la
clave `éxito`); el `{color:...}` emitido conserva la grafía original.

**Reaplicar a lo ya guardado** (retroactivo, cuando el diccionario crece):

```
node --env-file=.env.local --env-file-if-exists=.env.development.local \
     --import tsx scripts/marco-recolor.ts            # diff
node ... scripts/marco-recolor.ts --apply             # escribe
```
