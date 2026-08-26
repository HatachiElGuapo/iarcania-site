const TABS: { href: string; label: string }[] = [
  { href: "/dashboard/habitos", label: "Hábitos" },
  { href: "/dashboard/habitos/gestion", label: "Gestión" },
  { href: "/dashboard/habitos/rachas", label: "Rachas" },
];

export default function HabitosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-8">
      <h1 className="font-display text-2xl text-text-primary">Hábitos</h1>
      <nav className="mt-4 flex gap-2 border-b border-border pb-2 text-sm">
        {TABS.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className="rounded-sm px-3 py-1.5 text-text-muted hover:bg-bg-card hover:text-text-primary"
          >
            {tab.label}
          </a>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
