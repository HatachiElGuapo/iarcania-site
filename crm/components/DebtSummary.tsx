import type { Debt } from '@/types'

function fmtCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO') }

export default function DebtSummary({ debts }: { debts: Debt[] }) {
  const total = debts.reduce((s, d) => s + d.remaining_amount, 0)
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--gold)' }}>Deudas activas</div>
      {debts.length === 0 ? (
        <div style={{ color: 'var(--green)', fontSize: '0.82rem' }}>✓ Sin deudas</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {debts.map(d => {
            const today = new Date().toISOString().split('T')[0]
            const overdue = d.due_date && d.due_date <= today
            return (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: 'var(--bone)' }}>{d.creditor}</span>
                  <span style={{ color: 'var(--bone-dim)', marginLeft: 6 }}>({d.debtor})</span>
                  {overdue && <span style={{ color: 'var(--red)', marginLeft: 6, fontSize: '0.7rem' }}>VENCIDA</span>}
                </div>
                <span style={{ color: 'var(--red)' }}>{fmtCOP(d.remaining_amount)}</span>
              </div>
            )
          })}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--bone-dim)' }}>Total</span>
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>{fmtCOP(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
