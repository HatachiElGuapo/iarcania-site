import { supabaseAdmin } from '@/lib/supabase'
import { getBudgetsWithSpent } from '@/lib/distribution'
import AlertBar from '@/components/AlertBar'
import BudgetOverview from '@/components/BudgetOverview'
import PipelineSummary from '@/components/PipelineSummary'
import DebtSummary from '@/components/DebtSummary'

const META_MINIMA = 2_534_000

export default async function DashboardPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const budgets = await getBudgetsWithSpent(month, year)
  const total_needed = budgets.reduce((s, b) => s + b.amount, 0)
  const total_covered = budgets.reduce((s, b) => s + b.current_spent, 0)
  const deficit = total_needed - total_covered

  // Income del mes
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const { data: incomeRows } = await supabaseAdmin
    .from('income')
    .select('amount')
    .eq('user_id', 'u1')
    .gte('created_at', monthStart)
  const total_income = (incomeRows || []).reduce((s, r) => s + r.amount, 0)

  // Pipeline deals activos
  const { data: deals } = await supabaseAdmin
    .from('projects')
    .select('*, client:client_id(name)')
    .eq('user_id', 'u1')
    .not('stage', 'in', '("won","lost")')
    .order('created_at', { ascending: false })

  // Deudas activas
  const { data: debts } = await supabaseAdmin
    .from('debts')
    .select('*')
    .eq('user_id', 'u1')
    .eq('status', 'active')

  // Alertas
  const today = now.toISOString().split('T')[0]
  const alerts: string[] = []
  if (deficit > 0) alerts.push(`Déficit del mes: ${fmtCOP(deficit)}`)
  for (const b of budgets) {
    if (b.current_spent === 0 && b.priority <= 3) alerts.push(`Sin cubrir: ${b.name}`)
  }
  for (const d of (debts || [])) {
    if (d.due_date && d.due_date <= today) alerts.push(`Deuda vencida: ${d.creditor} — ${fmtCOP(d.remaining_amount)}`)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 className="heading" style={{ fontSize: '1.5rem', color: 'var(--gold)', marginBottom: '1.5rem' }}>
        Dashboard
      </h1>

      {alerts.length > 0 && <AlertBar alerts={alerts} />}

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatBox label="Ingresos del mes" value={fmtCOP(total_income)} sub={`Meta: ${fmtCOP(META_MINIMA)}`} color={total_income >= META_MINIMA ? 'var(--green)' : 'var(--yellow)'} />
        <StatBox label="Presupuesto cubierto" value={fmtCOP(total_covered)} sub={`de ${fmtCOP(total_needed)}`} color={deficit === 0 ? 'var(--green)' : 'var(--red)'} />
        <StatBox label="Déficit" value={deficit > 0 ? fmtCOP(deficit) : '✓ Cubierto'} sub="Este mes" color={deficit > 0 ? 'var(--red)' : 'var(--green)'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <BudgetOverview budgets={budgets} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <PipelineSummary deals={deals || []} />
          <DebtSummary debts={debts || []} />
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: '0.75rem', color: 'var(--bone-dim)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--bone-dim)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function fmtCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO')
}
