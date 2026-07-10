import { NextResponse } from 'next/server'
import { getBudgetsWithSpent } from '@/lib/distribution'

// GET /api/budget/summary — resumen del mes para el agente WhatsApp
export async function GET() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const budgets = await getBudgetsWithSpent(month, year)

  const total_needed = budgets.reduce((s, b) => s + b.amount, 0)
  const total_covered = budgets.reduce((s, b) => s + b.current_spent, 0)
  const deficit = total_needed - total_covered

  const categories = budgets.map(b => ({
    name: b.name,
    priority: b.priority,
    needed: b.amount,
    covered: b.current_spent,
    status: b.current_spent >= b.amount ? 'green' : b.current_spent > 0 ? 'yellow' : 'red',
  }))

  return NextResponse.json({ month, year, total_needed, total_covered, deficit, categories })
}
