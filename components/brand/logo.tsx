// Ver os.css .sidebar-logo-text/.auth-logo — texto Playfair dorado sólido,
// sin ícono. El original (os.html) no usa el ojo arcano en la app operativa,
// solo en el sitio de marketing — no se replica aquí.
export function Wordmark({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`font-display font-bold tracking-[0.05em] text-gold ${className}`}
      style={{ fontSize: size }}
    >
      IArcanIA
    </span>
  );
}
