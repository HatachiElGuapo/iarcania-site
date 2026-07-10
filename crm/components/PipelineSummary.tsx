const STAGE_LABELS: Record<string, string> = {
  contacted: 'Contactado', demo: 'Demo', proposal: 'Propuesta',
  negotiation: 'Negociación', won: 'Ganado', lost: 'Perdido',
}
const STAGE_COLOR: Record<string, string> = {
  contacted: 'var(--bone-dim)', demo: 'var(--purple)', proposal: 'var(--gold)',
  negotiation: 'var(--yellow)', won: 'var(--green)', lost: 'var(--red)',
}

function fmtCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO') }

export default function PipelineSummary({ deals }: { deals: any[] }) {
  const total = deals.reduce((s, d) => s + (d.value || 0), 0)
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--gold)' }}>
        Pipeline <span style={{ color: 'var(--bone-dim)', fontWeight: 400, fontSize: '0.8rem' }}>({deals.length} activos)</span>
      </div>
      {deals.length === 0 ? (
        <div style={{ color: 'var(--bone-dim)', fontSize: '0.82rem' }}>Sin deals activos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {deals.slice(0, 5).map(d => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
              <div>
                <div style={{ color: 'var(--bone)' }}>{d.name || d.client?.name}</div>
                <div style={{ color: STAGE_COLOR[d.stage] || 'var(--bone-dim)', fontSize: '0.72rem' }}>
                  {STAGE_LABELS[d.stage] || d.stage}
                </div>
              </div>
              {d.value && <div style={{ color: 'var(--gold)' }}>{fmtCOP(d.value)}</div>}
            </div>
          ))}
          {total > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--bone-dim)' }}>Total pipeline</span>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{fmtCOP(total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
