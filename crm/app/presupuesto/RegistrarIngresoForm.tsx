'use client'
import { useState } from 'react'
import type { Budget, DistributionPreview } from '@/types'

function fmtCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO') }

const SOURCES = [
  { value: 'iarcania', label: 'IArcanIA' },
  { value: 'la_segunda', label: 'La Segunda' },
  { value: 'family_help', label: 'Ayuda familiar' },
  { value: 'other', label: 'Otro' },
]

export default function RegistrarIngresoForm({ budgets }: { budgets: (Budget & { current_spent: number })[] }) {
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('iarcania')
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState<{ previews: DistributionPreview[]; surplus: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [savedIncomeId, setSavedIncomeId] = useState<string | null>(null)

  async function handlePreview() {
    if (!amount || isNaN(Number(amount))) return
    const n = Number(amount)
    const now = new Date()
    let remaining = n
    const previews: DistributionPreview[] = []
    for (const b of budgets) {
      const gap = Math.max(0, b.amount - b.current_spent)
      const assign = Math.min(remaining, gap)
      if (assign > 0 || gap > 0) {
        previews.push({ budget_id: b.id, budget_name: b.name, priority: b.priority, needed: b.amount, already_covered: b.current_spent, assigned: assign })
      }
      remaining -= assign
      if (remaining <= 0) break
    }
    setPreview({ previews, surplus: remaining })
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), source, description, auto_distribute: true }),
      })
      const data = await res.json()
      if (data.income?.id) {
        setSavedIncomeId(data.income.id)
        setConfirmed(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (confirmed) {
    return (
      <div className="card card-gold" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>✓</div>
        <div style={{ color: 'var(--green)', fontWeight: 700, marginBottom: 4 }}>Ingreso registrado</div>
        <div style={{ color: 'var(--bone-dim)', fontSize: '0.82rem', marginBottom: 16 }}>{fmtCOP(Number(amount))} distribuido correctamente</div>
        <button className="btn-ghost" onClick={() => { setConfirmed(false); setPreview(null); setAmount(''); setDescription('') }}>
          Registrar otro
        </button>
      </div>
    )
  }

  return (
    <div className="card card-gold">
      <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--gold)' }}>Registrar ingreso</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--bone-dim)', display: 'block', marginBottom: 4 }}>Monto (COP)</label>
          <input type="number" placeholder="1200000" value={amount} onChange={e => { setAmount(e.target.value); setPreview(null) }} />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--bone-dim)', display: 'block', marginBottom: 4 }}>Fuente</label>
          <select value={source} onChange={e => setSource(e.target.value)}>
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--bone-dim)', display: 'block', marginBottom: 4 }}>Descripción (opcional)</label>
          <input type="text" placeholder="Anticipo cliente X…" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {!preview && (
          <button className="btn-ghost" onClick={handlePreview} disabled={!amount}>
            Ver cómo se distribuiría →
          </button>
        )}
      </div>

      {preview && (
        <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 10, color: 'var(--gold)' }}>Preview de distribución</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {preview.previews.map(p => (
              <div key={p.budget_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: p.assigned > 0 ? 'var(--bone)' : 'var(--bone-dim)' }}>
                  {p.priority}. {p.budget_name}
                </span>
                <span style={{ color: p.assigned > 0 ? 'var(--green)' : 'var(--bone-dim)' }}>
                  {p.assigned > 0 ? '+' + fmtCOP(p.assigned) : '—'}
                </span>
              </div>
            ))}
            {preview.surplus > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--purple)' }}>Excedente (ahorro/deudas)</span>
                <span style={{ color: 'var(--purple)', fontWeight: 700 }}>+{fmtCOP(preview.surplus)}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn-primary" onClick={handleConfirm} disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Guardando…' : 'Confirmar y guardar'}
            </button>
            <button className="btn-ghost" onClick={() => setPreview(null)}>Editar</button>
          </div>
        </div>
      )}
    </div>
  )
}
