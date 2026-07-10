import { supabaseAdmin } from '@/lib/supabase'
import { getBudgetsWithSpent } from '@/lib/distribution'
import RegistrarIngresoForm from './RegistrarIngresoForm'
import HistorialIngresos from './HistorialIngresos'

function fmtCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO') }

function semaforo(spent: number, needed: number): { label: string; cls: string } {
  if (spent >= needed) return { label: '● Cubierto', cls: 'badge-green' }
  if (spent > 0) return { label: '● Parcial', cls: 'badge-yellow' }
  return { label: '● Sin cubrir', cls: 'badge-red' }
}

export default async function PresupuestoPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const budgets = await getBudgetsWithSpent(month, year)
  const total_needed = budgets.reduce((s, b) => s + b.amount, 0)
  const total_covered = budgets.reduce((s, b) => s + b.current_spent, 0)

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const { data: incomeRows } = await supabaseAdmin
    .from('income')
    .select('*, budget_distributions(*, budget:budget_id(name))')
    .eq('user_id', 'u1')
    .gte('created_at', monthStart)
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 className="heading" style={{ fontSize: '1.5rem', color: 'var(--gold)', marginBottom: 8 }}>Presupuesto</h1>
      <div style={{ color: 'var(--bone-dim)', marginBottom: 24, fontSize: '0.85rem' }}>
        {new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
        {' · '}
        <span style={{ color: total_covered >= total_needed ? 'var(--green)' : 'var(--red)' }}>
          {fmtCOP(total_covered)} / {fmtCOP(total_needed)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Categorías */}
        <div>
          <div className="card card-gold" style={{ marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign: 'left', padding: '0 0 8px', color: 'var(--bone-dim)', fontWeight: 500 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '0 0 8px', color: 'var(--bone-dim)', fontWeight: 500 }}>Categoría</th>
                  <th style={{ textAlign: 'right', padding: '0 0 8px', color: 'var(--bone-dim)', fontWeight: 500 }}>Meta</th>
                  <th style={{ textAlign: 'right', padding: '0 0 8px', color: 'var(--bone-dim)', fontWeight: 500 }}>Asignado</th>
                  <th style={{ textAlign: 'right', padding: '0 0 8px', color: 'var(--bone-dim)', fontWeight: 500 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(b => {
                  const sem = semaforo(b.current_spent, b.amount)
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 0', color: 'var(--bone-dim)' }}>{b.priority}</td>
                      <td style={{ padding: '10px 8px' }}>{b.name}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0', color: 'var(--bone-dim)' }}>{fmtCOP(b.amount)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0', color: b.current_spent > 0 ? 'var(--bone)' : 'var(--bone-dim)' }}>{fmtCOP(b.current_spent)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 0' }}>
                        <span className={sem.cls}>{sem.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid rgba(201,168,76,0.3)' }}>
                  <td colSpan={2} style={{ padding: '10px 0', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ textAlign: 'right', padding: '10px 0', fontWeight: 700 }}>{fmtCOP(total_needed)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 0', fontWeight: 700, color: total_covered >= total_needed ? 'var(--green)' : 'var(--yellow)' }}>{fmtCOP(total_covered)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <HistorialIngresos ingresos={incomeRows || []} />
        </div>

        {/* Registrar ingreso */}
        <div>
          <RegistrarIngresoForm budgets={budgets} />
        </div>
      </div>
    </div>
  )
}
