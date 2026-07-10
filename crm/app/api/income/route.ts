import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { previewDistribution, applyDistribution } from '@/lib/distribution'

// POST /api/income — registra ingreso y aplica distribución
// Body: { amount, source, description?, client_id?, project_id?, auto_distribute? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { amount, source, description, client_id, project_id, auto_distribute = true } = body

  if (!amount || !source) {
    return NextResponse.json({ error: 'amount y source son requeridos' }, { status: 400 })
  }

  const now = new Date()
  const id = `inc_${Date.now()}_${Math.floor(Math.random() * 1000)}`

  const { data: inc, error } = await supabaseAdmin.from('income').insert({
    id,
    user_id: 'u1',
    amount,
    source,
    description,
    client_id: client_id || null,
    project_id: project_id || null,
    distribution_applied: false,
    created_at: now.toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!auto_distribute) {
    return NextResponse.json({ income: inc, distribution: null })
  }

  const { previews, surplus } = await previewDistribution(amount, now.getMonth() + 1, now.getFullYear())
  await applyDistribution(id, previews)

  return NextResponse.json({ income: inc, distribution: previews, surplus })
}
