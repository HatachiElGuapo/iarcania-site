import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getBudgetsWithSpent } from '@/lib/distribution'

// GET /api/alerts — alertas activas para el agente WhatsApp / n8n
export async function GET() {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const alerts: { type: string; message: string; severity: 'high' | 'medium' | 'low' }[] = []

  // Categorías en rojo
  const budgets = await getBudgetsWithSpent(now.getMonth() + 1, now.getFullYear())
  for (const b of budgets) {
    if (b.current_spent === 0) {
      alerts.push({ type: 'budget_uncovered', message: `${b.name} sin cubrir ($${b.amount.toLocaleString('es-CO')})`, severity: b.priority <= 3 ? 'high' : 'medium' })
    }
  }

  // Deudas vencidas o próximas a vencer
  const { data: debts } = await supabaseAdmin.from('debts').select('*').eq('status', 'active').not('due_date', 'is', null)
  for (const d of (debts || [])) {
    const days = Math.floor((new Date(d.due_date).getTime() - new Date(today).getTime()) / 86400000)
    if (days < 0) alerts.push({ type: 'debt_overdue', message: `Deuda con ${d.creditor} vencida (${d.debtor})`, severity: 'high' })
    else if (days <= 7) alerts.push({ type: 'debt_due_soon', message: `Deuda con ${d.creditor} vence en ${days} días — $${d.remaining_amount.toLocaleString('es-CO')}`, severity: 'medium' })
  }

  return NextResponse.json({ alerts, count: alerts.length, date: today })
}
