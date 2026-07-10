import { supabaseAdmin } from '@/lib/supabase'
import type { Client } from '@/types'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  lead: 'badge-yellow', prospect: 'badge-gold', active: 'badge-green', inactive: 'badge-red'
}
const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead', prospect: 'Prospecto', active: 'Activo', inactive: 'Inactivo'
}

export default async function ClientesPage() {
  const { data: clients } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className="heading" style={{ fontSize: '1.5rem', color: 'var(--gold)' }}>Clientes</h1>
      </div>

      {(!clients || clients.length === 0) ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--bone-dim)' }}>
          Sin clientes registrados aún
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map((c: Client) => (
            <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.name}</div>
                {c.business_name && <div style={{ fontSize: '0.78rem', color: 'var(--bone-dim)' }}>{c.business_name}</div>}
                <div style={{ fontSize: '0.75rem', color: 'var(--bone-dim)', marginTop: 2 }}>
                  {c.phone && <span style={{ marginRight: 12 }}>📱 {c.phone}</span>}
                  {c.email && <span>✉ {c.email}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {c.source && <span style={{ fontSize: '0.72rem', color: 'var(--bone-dim)' }}>{c.source}</span>}
                <span className={STATUS_BADGE[c.status] || 'badge-yellow'}>{STATUS_LABELS[c.status] || c.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
