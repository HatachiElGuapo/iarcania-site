import { supabaseAdmin } from '@/lib/supabase'

const STAGES = [
  { key: 'contacted',   label: 'Contactado' },
  { key: 'demo',        label: 'Demo' },
  { key: 'proposal',    label: 'Propuesta' },
  { key: 'negotiation', label: 'Negociación' },
  { key: 'won',         label: 'Ganado' },
  { key: 'lost',        label: 'Perdido' },
]

const STAGE_COLOR: Record<string, string> = {
  contacted: '#6b7280', demo: 'var(--purple)', proposal: 'var(--gold)',
  negotiation: 'var(--yellow)', won: 'var(--green)', lost: 'var(--red)',
}

function fmtCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO') }

export default async function PipelinePage() {
  const { data: deals } = await supabaseAdmin
    .from('projects')
    .select('*, client:client_id(name)')
    .eq('user_id', 'u1')
    .order('created_at', { ascending: false })

  const byStage: Record<string, any[]> = {}
  STAGES.forEach(s => byStage[s.key] = [])
  for (const d of (deals || [])) {
    if (byStage[d.stage]) byStage[d.stage].push(d)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 className="heading" style={{ fontSize: '1.5rem', color: 'var(--gold)', marginBottom: 24 }}>Pipeline</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, overflowX: 'auto' }}>
        {STAGES.map(s => {
          const items = byStage[s.key]
          const total = items.reduce((sum: number, d: any) => sum + (d.value || 0), 0)
          return (
            <div key={s.key}>
              <div style={{ padding: '6px 10px', borderRadius: 8, background: STAGE_COLOR[s.key] + '22', marginBottom: 10 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: STAGE_COLOR[s.key] }}>{s.label}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--bone-dim)' }}>{items.length} · {total > 0 ? fmtCOP(total) : '—'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((d: any) => (
                  <div key={d.id} className="card" style={{ padding: '0.75rem', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{d.name || d.client?.name || 'Sin nombre'}</div>
                    {d.client?.name && d.name && <div style={{ color: 'var(--bone-dim)', fontSize: '0.72rem' }}>{d.client.name}</div>}
                    {d.value && <div style={{ color: 'var(--gold)', marginTop: 4, fontWeight: 700 }}>{fmtCOP(d.value)}</div>}
                    {d.service_type && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--purple)', marginTop: 2 }}>
                        {d.service_type === 'family_os' ? 'Family OS' : 'Agente custom'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
