// Ver os.css .page-header/.page-title/.page-sub — título + subtítulo a la
// izquierda, botones de acción a la derecha. Sin eyebrow ni ícono: eso no
// existe en el original, el ícono ya vive en el nav-item del sidebar.
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="mb-0.5 text-[26px] text-text-primary">{title}</h1>
        {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
