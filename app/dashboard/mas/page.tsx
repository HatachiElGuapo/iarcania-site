import { SectionHeader } from "@/components/ui/section-header";
import { ListCard } from "@/components/ui/list-card";
import { NAV_GROUPS } from "@/components/app/nav-groups";

// Móvil · pantalla 04 del diseño ("Más"): todo lo que no entra en el tab
// bar. Reusa NAV_GROUPS (misma fuente que el sidebar de escritorio, sin
// duplicar la lista de secciones) agrupado igual que el sidebar, salvo Hoy,
// Dinero y Cuerpo que ya tienen su propio tab. Sin datos propios — es solo
// navegación, no vuelve a tocar Server Actions.
const HIDDEN_HREFS = new Set(["/dashboard", "/dashboard/dinero", "/dashboard/cuerpo"]);

export default function MasPage() {
  return (
    <div className="flex flex-col gap-6 p-4 pb-28 md:p-8 md:pb-8">
      <SectionHeader title="Más" eyebrow="Todo lo demás" />
      <div className="flex flex-col gap-5">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !HIDDEN_HREFS.has(item.href));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="flex flex-col gap-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                {group.label}
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((item) => (
                  <a key={item.href} href={item.href}>
                    <ListCard>
                      <span className="w-[20px] shrink-0 text-center text-[15px]">{item.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                        {item.label}
                      </span>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#5A5870"
                        strokeWidth="1.8"
                        className="shrink-0"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </ListCard>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
