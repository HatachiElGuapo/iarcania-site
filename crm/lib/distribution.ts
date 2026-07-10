import { supabaseAdmin } from './supabase'
import type { Budget, DistributionPreview } from '@/types'

const USER_ID = 'u1'

export async function getBudgetsWithSpent(month: number, year: number): Promise<(Budget & { current_spent: number })[]> {
  const { data: budgets } = await supabaseAdmin
    .from('budgets')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('month', month)
    .eq('year', year)
    .eq('is_active', true)
    .eq('type', 'expense')
    .order('priority', { ascending: true })

  if (!budgets) return []

  // sum distributions per budget this month
  const { data: dists } = await supabaseAdmin
    .from('budget_distributions')
    .select('budget_id, amount_assigned, income:income_id(created_at)')
    .in('budget_id', budgets.map(b => b.id))

  const spentMap: Record<string, number> = {}
  for (const d of (dists || [])) {
    spentMap[d.budget_id] = (spentMap[d.budget_id] || 0) + d.amount_assigned
  }

  return budgets.map(b => ({ ...b, current_spent: spentMap[b.id] || 0 }))
}

export async function previewDistribution(
  amount: number,
  month: number,
  year: number
): Promise<{ previews: DistributionPreview[]; surplus: number }> {
  const budgets = await getBudgetsWithSpent(month, year)
  let remaining = amount
  const previews: DistributionPreview[] = []

  for (const b of budgets) {
    const gap = Math.max(0, b.amount - b.current_spent)
    const assign = Math.min(remaining, gap)
    previews.push({
      budget_id: b.id,
      budget_name: b.name,
      priority: b.priority,
      needed: b.amount,
      already_covered: b.current_spent,
      assigned: assign,
    })
    remaining -= assign
    if (remaining <= 0) break
  }

  return { previews, surplus: remaining }
}

export async function applyDistribution(
  incomeId: string,
  previews: DistributionPreview[]
): Promise<void> {
  const rows = previews
    .filter(p => p.assigned > 0)
    .map(p => ({
      id: `bd_${Date.now()}_${Math.floor(Math.random() * 1000)}_${p.budget_id}`,
      income_id: incomeId,
      budget_id: p.budget_id,
      amount_assigned: p.assigned,
    }))

  if (rows.length === 0) return

  await supabaseAdmin.from('budget_distributions').insert(rows)
  await supabaseAdmin.from('income').update({ distribution_applied: true }).eq('id', incomeId)
}
