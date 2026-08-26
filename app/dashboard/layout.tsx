import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Wordmark } from "@/components/brand/logo";
import { NavLinks } from "@/components/app/nav-links";
import { LogoutButton } from "@/components/app/logout-button";

// Ver os.css .sidebar/.sidebar-logo/.sidebar-footer — 220px, sin
// decoración (sin blobs), logo de texto plano.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-bg-deep">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-bg-dark">
        <div className="border-b border-border p-6">
          <Wordmark size={18} />
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-text-muted">
            Sistema Operativo
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-border px-5 py-4">
          <div className="mb-0.5 truncate text-xs font-medium text-text-muted">
            {session.user?.name ?? "Usuario"}
          </div>
          <div className="mb-1.5 truncate text-xs text-text-dim">{session.user?.email}</div>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
