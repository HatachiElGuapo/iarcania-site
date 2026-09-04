import { PageHeader, Card } from "@/components/ui";

const LINKS: Record<string, { label: string; href: string }[]> = {
  "⚙️ Técnico": [
    { label: "n8n", href: "https://miguel-aguilar-n8n.7sx006.easypanel.host" },
    { label: "Supabase Personal", href: "https://supabase.com/dashboard/project/gpfidxxawcwsbuzsbeob" },
    { label: "Supabase IArcanIA", href: "https://supabase.com/dashboard/project/ktmiurbvgewuwkzkqitj" },
    { label: "Vercel", href: "https://vercel.com/hatachielguapos-projects" },
    { label: "GitHub Personal", href: "https://github.com/HatachiElGuapo" },
    { label: "GitHub IArcanIA", href: "https://github.com/iarcania" },
    { label: "EasyPanel", href: "https://miguel-aguilar.7sx006.easypanel.host" },
  ],
  "🎬 Contenido": [
    { label: "YouTube VoidStoic", href: "https://www.youtube.com/@stoicvoid-o5f" },
    { label: "Instagram IArcanIA", href: "https://www.instagram.com/iarcania.ai/" },
    { label: "YouTube Studio", href: "https://studio.youtube.com" },
    { label: "Canva", href: "https://www.canva.com" },
  ],
};

export default function WorkspacePage() {
  return (
    <div className="p-8">
      <PageHeader icon="🖥️" title="Workspace" subtitle="Enlaces rápidos a tus herramientas" />

      <div className="grid gap-4 sm:grid-cols-2" style={{ maxWidth: "760px" }}>
        {Object.entries(LINKS).map(([group, links]) => (
          <Card key={group} title={group} count={links.length} flush>
            <div className="flex flex-col p-1.5">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring flex items-center justify-between rounded-ui px-2 py-1.5 text-body text-ink-muted transition-colors duration-120 hover:bg-surface-2 hover:text-ink"
                >
                  {l.label}
                  <span className="text-meta text-ink-dim">↗</span>
                </a>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
