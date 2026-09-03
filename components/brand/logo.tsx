// Wordmark del shell (4c): "IArcanIA" en Playfair, texto primario (ink), sin
// ícono — el ojo arcano es solo del sitio de marketing. El login tiene su
// propio markup (.auth-logo), no usa este componente.
export function Wordmark({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`font-display font-bold tracking-[0.05em] text-ink ${className}`}
      style={{ fontSize: size }}
    >
      IArcanIA
    </span>
  );
}
