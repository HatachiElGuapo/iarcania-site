import { supabaseAdmin } from '@/lib/supabase'
import type { Debt } from '@/types'

function fmtCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO') }

function monthsToPayoff(remaining: number, monthly: number | undefined) {
  if (!monthly || monthly <= 0) return null
  return Math.ceil(remaining / monthly)
}

export default async function DeudasPage() {
  const { data: debts } = await supabaseAdmin
    .from('debts')
    .select('*')
    .eq('user_id', 'u1')
    .order('status')
    .order('remaining_amount', { ascending: false })

  const active = (debts || []).filter((d: Debt) => d.status === 'active')
  const total = active.reduce((s: number, d: Debt) => s + d.remaining_amount, 0)
  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 className="heading" style={{ fontSize: '1.5rem', color: 'var(--gold)', marginBottom: 24 }}>Deudas</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--bone-dim)', marginBottom: 4 }}>Total adeudado</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--red)' }}>{fmtCOP(total)}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '0.75rem', color: 'var(--bone-dim)', marginBottom: 4 }}>Cuotas mensuales</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--yellow)' }}>
            {fmtCOP(active.reduce((s: number, d: Debt) => s + (d.monthly_payment || 0), 0))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {active.map((d: Debt) => {
          const overdue = d.due_date && d.due_date <= today
          const months = monthsToPayoff(d.remaining_amount, d.monthly_payment)
          const pct = ((d.total_amount - d.remaining_amount) / d.total_amount) * 100

          return (
            <div key={d.id} className="card card-gold">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>{d.creditor}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--bone-dim)' }}>
                    Deudor: {d.debtor}
                    {d.monthly_payment && <span style={{ marginLeft: 8 }}>· Cuota: {fmtCOP(d.monthly_payment)}/mes</span>}
                  </div>
                  {d.notes && <div style={{ fontSize: '0.75rem', color: 'var(--bone-dim)', marginTop: 2 }}>{d.notes}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--red)' }}>{fmtCOP(d.remaining_amount)}</div>
                  {d.total_amount !== d.remaining_amount && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--bone-dim)' }}>de {fmtCOP(d.total_amount)}</div>
                  )}
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="progress-bar" style={{ marginBottom: 8 }}>
                <div className="progress-fill" style={{ width: pct + '%', background: 'var(--green)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <div>
                  {overdue ? (
                    <span style={{ color: 'var(--red)' }}>● Vencida {d.due_date && `— ${d.due_date}`}</span>
                  ) : d.due_date ? (
                    <span style={{ color: 'var(--yellow)' }}>Vence: {d.due_date}</span>
                  ) : null}
                </div>
                <div style={{ color: 'var(--bone-dim)' }}>
                  {months ? `~${months} meses para liquidar` : 'Sin cuota fija definida'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
