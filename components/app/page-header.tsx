export function PageHeader({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow?: string;
  title: string;
  icon?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="section-label mb-2">{eyebrow}</div>}
        <h1 className="font-display text-2xl text-text-primary">
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
