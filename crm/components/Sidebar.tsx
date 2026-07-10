'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wallet, Users, Kanban, CreditCard } from 'lucide-react'

const nav = [
  { href: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/presupuesto', label: 'Presupuesto',  icon: Wallet },
  { href: '/clientes',    label: 'Clientes',     icon: Users },
  { href: '/pipeline',    label: 'Pipeline',     icon: Kanban },
  { href: '/deudas',      label: 'Deudas',       icon: CreditCard },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside style={{ background: 'var(--void-2)', borderRight: '1px solid rgba(201,168,76,0.15)', width: 220, minHeight: '100vh', padding: '1.5rem 0' }}>
      <div style={{ padding: '0 1.25rem 2rem', borderBottom: '1px solid rgba(201,168,76,0.12)' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'var(--gold)', letterSpacing: '0.08em' }}>IArcanIA</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--bone-dim)', marginTop: 2 }}>CRM & Finanzas</div>
      </div>
      <nav style={{ marginTop: '1rem' }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + '/')
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '0.6rem 1.25rem',
              color: active ? 'var(--gold)' : 'var(--bone-dim)',
              background: active ? 'rgba(201,168,76,0.08)' : 'transparent',
              borderRight: active ? '2px solid var(--gold)' : '2px solid transparent',
              textDecoration: 'none', fontSize: '0.875rem', fontWeight: active ? 600 : 400,
              transition: 'all 0.15s',
            }}>
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
