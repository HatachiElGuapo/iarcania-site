'use client'

function fmtCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO') }

const SOURCE_LABELS: Record<string, string> = {
  iarcania: 'IArcanIA', la_segunda: 'La Segunda', family_help: 'Ayuda familiar', other: 'Otro'
}

export default function HistorialIngresos({ ingresos }: { ingresos: any[] }) {
  if (ingresos.length === 0) return (
    <div className="card" style={{ color: 'var(--bone-dim)', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
      Sin ingresos este mes
    </div>
  )

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--gold)' }}>Historial del mes</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ingresos.map(inc => (
          <div key={inc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div>
                <span style={{ fontWeight: 600 }}>{fmtCOP(inc.amount)}</span>
                <span className="badge-gold" style={{ marginLeft: 8 }}>{SOURCE_LABELS[inc.source] || inc.source}</span>
                {inc.distribution_applied && <span className="badge-green" style={{ marginLeft: 6 }}>Distribuido</span>}
              </div>
              <div style={{ color: 'var(--bone-dim)', fontSize: '0.75rem' }}>
                {new Date(inc.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
              </div>
            </div>
            {inc.description && <div style={{ fontSize: '0.78rem', color: 'var(--bone-dim)' }}>{inc.description}</div>}
            {inc.budget_distributions?.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {inc.budget_distributions.map((d: any) => (
                  <span key={d.id} style={{ fontSize: '0.7rem', color: 'var(--bone-dim)', background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '2px 6px' }}>
                    {d.budget?.name}: +{fmtCOP(d.amount_assigned)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
