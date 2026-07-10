import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/deals/update-stage
export async function POST(req: NextRequest) {
  const { deal_id, stage, anticipo_amount } = await req.json()
  if (!deal_id || !stage) return NextResponse.json({ error: 'deal_id y stage requeridos' }, { status: 400 })

  const update: Record<string, unknown> = { stage }
  if (stage === 'won') {
    update.closed_at = new Date().toISOString()
    if (anticipo_amount) {
      // Registrar el anticipo como income automáticamente
      const { data: deal } = await supabaseAdmin.from('projects').select('*').eq('id', deal_id).single()
      if (deal) {
        const incId = `inc_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        await supabaseAdmin.from('income').insert({
          id: incId,
          user_id: 'u1',
          amount: anticipo_amount,
          source: 'iarcania',
          description: `Anticipo: ${deal.name}`,
          project_id: deal_id,
          distribution_applied: false,
          created_at: new Date().toISOString(),
        })
        update.anticipo_paid = true
        if (deal.value) update.anticipo_pct = Math.round((anticipo_amount / deal.value) * 100)
      }
    }
  }
  if (stage === 'lost') update.closed_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin.from('projects').update(update).eq('id', deal_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deal: data })
}
