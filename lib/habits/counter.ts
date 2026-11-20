// Un hábito con meta (activities.target_value) está "hecho" ese día cuando
// su log alcanza o pasa la meta, no por la mera existencia del log — a
// diferencia del resto de hábitos, donde cualquier log cuenta como hecho
// sin importar su value. Sin meta, el comportamiento de siempre.
export function isCounterDone(value: number | null | undefined, targetValue: number | null | undefined): boolean {
  if (value == null) return false;
  if (targetValue == null) return true;
  return value >= targetValue;
}

// Pasos "+N" (botones grandes) desde un string separado por comas — descarta
// lo que no sea un entero positivo, sin ordenar (el orden en que se
// escriben es el orden en que se muestran los botones).
export function parseCountSteps(raw: string): number[] | null {
  const steps = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return steps.length ? steps : null;
}
