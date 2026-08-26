const LINKS: Record<string, { icon: string; label: string; href: string }[]> = {
  "⚙️ Técnico": [
    { icon: "🔗", label: "n8n", href: "https://miguel-aguilar-n8n.7sx006.easypanel.host" },
    {
      icon: "🔗",
      label: "Supabase Personal",
      href: "https://supabase.com/dashboard/project/gpfidxxawcwsbuzsbeob",
    },
    {
      icon: "🔗",
      label: "Supabase IArcanIA",
      href: "https://supabase.com/dashboard/project/ktmiurbvgewuwkzkqitj",
    },
    { icon: "🔗", label: "Vercel", href: "https://vercel.com/hatachielguapos-projects" },
    { icon: "🔗", label: "GitHub Personal", href: "https://github.com/HatachiElGuapo" },
    { icon: "🔗", label: "GitHub IArcanIA", href: "https://github.com/iarcania" },
    { icon: "🔗", label: "EasyPanel", href: "https://miguel-aguilar.7sx006.easypanel.host" },
  ],
  "🎬 Contenido": [
    { icon: "🔗", label: "YouTube VoidStoic", href: "https://www.youtube.com/@stoicvoid-o5f" },
    { icon: "🔗", label: "Instagram IArcanIA", href: "https://www.instagram.com/iarcania.ai/" },
    { icon: "🔗", label: "YouTube Studio", href: "https://studio.youtube.com" },
    { icon: "🔗", label: "Canva", href: "https://www.canva.com" },
  ],
};

export default function WorkspacePage() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-display text-2xl text-text-primary">🖥️ Workspace</h1>
        <p className="mt-1 text-sm text-text-muted">Links rápidos a tus herramientas</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" style={{ maxWidth: "760px" }}>
        {Object.entries(LINKS).map(([group, links]) => (
          <div key={group} className="rounded-md border border-border bg-bg-card p-4">
            <div className="mb-2 text-sm font-semibold text-text-primary">{group}</div>
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm text-text-muted hover:bg-bg-deep hover:text-text-primary"
                >
                  {l.label}
                  <span className="text-xs text-text-dim">↗</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
