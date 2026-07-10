import type { Budget } from '@/types'

function fmtCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO') }

function statusColor(spent: number, needed: number) {
  if (spent >= needed) return 'var(--green)'
  if (spent > 0) return 'var(--yellow)'
  return 'var(--red)'
}

export default function BudgetOverview({ budgets }: { budgets: (Budget & { current_spent: number })[] }) {
  return (
    <div className="card card-gold">
      <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--gold)' }}>Presupuesto mensual</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {budgets.map(b => {
          const pct = Math.min(100, (b.current_spent / b.amount) * 100)
          const color = statusColor(b.current_spent, b.amount)
          return (
            <div key={b.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--bone)' }}>
                  <span style={{ color: 'var(--bone-dim)', marginRight: 6 }}>{b.priority}.</span>
                  {b.name}
                </span>
                <span style={{ color }}>
                  {fmtCOP(b.current_spent)} <span style={{ color: 'var(--bone-dim)' }}>/ {fmtCOP(b.amount)}</span>
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: pct + '%', background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
