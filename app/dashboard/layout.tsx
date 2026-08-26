import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { Blobs } from "@/components/brand/blobs";
import { NavLinks } from "@/components/app/nav-links";
import { LogoutButton } from "@/components/app/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-bg-deep">
      <aside className="relative flex w-64 shrink-0 flex-col border-r border-border bg-bg-dark">
        <Blobs />
        <div className="relative border-b border-border p-4">
          <Logo size={26} wordmarkSize={17} tagline="Sistema personal" />
        </div>
        <div className="relative flex-1 overflow-y-auto p-3">
          <NavLinks />
        </div>
        <div className="relative flex items-center justify-between gap-2 border-t border-border p-3">
          <span className="truncate text-xs text-text-dim">{session.user?.email}</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
