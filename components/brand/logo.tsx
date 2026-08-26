// El Ojo Arcano — ver preview/brand-logo.html para las reglas de uso
// (siempre sobre fondo oscuro, tamaño mínimo 20px, wordmark a la derecha).
export function LogoIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M36 14 Q58 36 36 58 Q14 36 36 14 Z" stroke="#F1F0F7" strokeWidth="1.5" />
      <circle cx="36" cy="36" r="14" stroke="#94A3B8" strokeWidth="0.75" />
      <g stroke="#CBD5E1" strokeWidth="1" opacity="0.7">
        <line x1="36" y1="24" x2="36" y2="20" />
        <line x1="36" y1="48" x2="36" y2="52" />
        <line x1="24" y1="36" x2="20" y2="36" />
        <line x1="48" y1="36" x2="52" y2="36" />
        <line x1="27.9" y1="27.9" x2="25.1" y2="25.1" />
        <line x1="44.1" y1="44.1" x2="46.9" y2="46.9" />
        <line x1="44.1" y1="27.9" x2="46.9" y2="25.1" />
        <line x1="27.9" y1="44.1" x2="25.1" y2="46.9" />
      </g>
      <circle cx="36" cy="36" r="6" fill="#F1F0F7" />
      <circle cx="36" cy="36" r="2.5" fill="#090910" />
      <g stroke="#475569" strokeWidth="1" strokeLinecap="round">
        <line x1="36" y1="14" x2="36" y2="10" />
        <line x1="36" y1="58" x2="36" y2="62" />
        <line x1="14" y1="36" x2="10" y2="36" />
        <line x1="58" y1="36" x2="62" y2="36" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span
      className="font-display font-bold tracking-[0.12em]"
      style={{ fontSize: size }}
    >
      <span className="text-[#94A3B8]">I</span>
      <span className="text-text-primary">Arcan</span>
      <span className="text-[#94A3B8]">IA</span>
    </span>
  );
}

export function Logo({
  size = 28,
  wordmarkSize = 20,
  tagline,
}: {
  size?: number;
  wordmarkSize?: number;
  tagline?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <LogoIcon size={size} />
      <div>
        <Wordmark size={wordmarkSize} />
        {tagline && <div className="mt-0.5 text-[11px] tracking-wide text-text-dim">{tagline}</div>}
      </div>
    </div>
  );
}
