const TABS: { href: string; label: string }[] = [
  { href: "/dashboard/dinero/cuentas", label: "Cuentas" },
  { href: "/dashboard/dinero/facturas", label: "Facturas" },
  { href: "/dashboard/dinero/gastos", label: "Gastos" },
  { href: "/dashboard/dinero/cobros", label: "Cobros" },
  { href: "/dashboard/dinero/metas", label: "Metas" },
  { href: "/dashboard/dinero/escanear", label: "Escanear" },
];

export default function DineroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-8">
      <h1 className="font-display text-2xl text-text-primary">Dinero</h1>
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
