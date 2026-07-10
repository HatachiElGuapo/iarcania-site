// ============================================================
// IArcanIA CRM — js/crm.js
// Depende de: SB_P (global), USER_ID (global), showToast (global)
// ============================================================

// Estado
let _crmTab = 'presupuesto'
let _crmBudgets = []
let _crmIncome = []
let _crmDebts = []
let _crmClients = []
let _crmDeals = []
let _crmDistributions = []

const CRM_USER = 'u1'
const META_MINIMA = 2534000

// ─── Utilidades ────────────────────────────────────────────
function _cop(n) { return '$' + Math.round(n || 0).toLocaleString('es-CO') }

function _crmMonth() {
  const n = new Date()
  return { month: n.getMonth() + 1, year: n.getFullYear() }
}

function _crmMonthStart() {
  const { month, year } = _crmMonth()
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function _semaforo(spent, needed) {
  if (spent >= needed) return { cls: 'crm-badge green', label: '● Cubierto' }
  if (spent > 0)       return { cls: 'crm-badge yellow', label: '● Parcial' }
  return { cls: 'crm-badge red', label: '● Sin cubrir' }
}

// ─── Entry point ───────────────────────────────────────────
async function loadCRM() {
  const el = document.getElementById('section-crm')
  if (!el) return
  el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`
  await Promise.all([_crmLoadBudgets(), _crmLoadIncome(), _crmLoadDebts(), _crmLoadClients(), _crmLoadDeals()])
  renderCRM()
}

// ─── Loaders ───────────────────────────────────────────────
async function _crmLoadBudgets() {
  const { month, year } = _crmMonth()
  const { data } = await SB_P.from('budgets')
    .select('*')
    .eq('user_id', CRM_USER)
    .eq('month', month)
    .eq('year', year)
    .eq('is_active', true)
    .order('priority', { ascending: true })
  _crmBudgets = data || []

  // Cargar distribuciones del mes para calcular lo asignado por categoría
  const ids = _crmBudgets.map(b => b.id)
  if (ids.length > 0) {
    const { data: dists } = await SB_P.from('budget_distributions')
      .select('*')
      .in('budget_id', ids)
    _crmDistributions = dists || []
  }
}

async function _crmLoadIncome() {
  const { data } = await SB_P.from('income')
    .select('*')
    .eq('user_id', CRM_USER)
    .gte('created_at', _crmMonthStart())
    .order('created_at', { ascending: false })
  _crmIncome = data || []
}

async function _crmLoadDebts() {
  const { data } = await SB_P.from('debts')
    .select('*')
    .eq('user_id', CRM_USER)
    .eq('status', 'active')
    .order('remaining_amount', { ascending: false })
  _crmDebts = data || []
}

async function _crmLoadClients() {
  const { data } = await SB_P.from('clients')
    .select('*')
    .order('created_at', { ascending: false })
  _crmClients = data || []
}

async function _crmLoadDeals() {
  const { data } = await SB_P.from('projects')
    .select('*')
    .eq('user_id', CRM_USER)
    .order('created_at', { ascending: false })
  _crmDeals = data || []
}

// ─── Computed helpers ──────────────────────────────────────
function _crmBudgetSpent(budgetId) {
  return _crmDistributions
    .filter(d => d.budget_id === budgetId)
    .reduce((s, d) => s + d.amount_assigned, 0)
}

function _crmTotalIncome() {
  return _crmIncome.reduce((s, i) => s + i.amount, 0)
}

function _crmTotalCovered() {
  return _crmBudgets.reduce((s, b) => s + _crmBudgetSpent(b.id), 0)
}

function _crmTotalNeeded() {
  return _crmBudgets.reduce((s, b) => s + b.amount, 0)
}

function _crmDealsByStage() {
  const stages = { contacted: [], demo: [], proposal: [], negotiation: [], won: [], lost: [] }
  for (const d of _crmDeals) {
    if (stages[d.stage]) stages[d.stage].push(d)
  }
  return stages
}

// ─── Distribución (client-side preview) ───────────────────
function _crmPreviewDistribution(amount) {
  let remaining = amount
  const previews = []
  for (const b of _crmBudgets) {
    const already = _crmBudgetSpent(b.id)
    const gap = Math.max(0, b.amount - already)
    const assign = Math.min(remaining, gap)
    previews.push({ budget_id: b.id, name: b.category, priority: b.priority, needed: b.amount, already, assign })
    remaining -= assign
    if (remaining <= 0) break
  }
  return { previews, surplus: remaining }
}

// ─── Render principal ──────────────────────────────────────
function renderCRM() {
  const el = document.getElementById('section-crm')
  if (!el) return

  const totalIncome = _crmTotalIncome()
  const totalCovered = _crmTotalCovered()
  const totalNeeded = _crmTotalNeeded()
  const deficit = totalNeeded - totalCovered
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  // Alertas
  const alerts = []
  if (deficit > 0) alerts.push({ msg: `Déficit del mes: ${_cop(deficit)}`, sev: 'red' })
  for (const b of _crmBudgets) {
    if (_crmBudgetSpent(b.id) === 0 && b.priority <= 3) alerts.push({ msg: `Sin cubrir: ${b.category}`, sev: 'red' })
  }
  for (const d of _crmDebts) {
    if (d.due_date && d.due_date <= today) alerts.push({ msg: `Deuda vencida: ${d.creditor} — ${_cop(d.remaining_amount)}`, sev: 'red' })
  }

  const tabs = [
    { id: 'presupuesto', label: '💰 Presupuesto' },
    { id: 'pipeline',    label: '📊 Pipeline' },
    { id: 'clientes',    label: '👥 Clientes' },
    { id: 'deudas',      label: '🔴 Deudas' },
  ]

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title">CRM IArcanIA</div>
    </div>

    ${alerts.length ? `
    <div class="crm-alert-bar">
      <strong>⚠ Alertas</strong>
      ${alerts.map(a => `<div class="crm-alert-item">${a.msg}</div>`).join('')}
    </div>` : ''}

    <div class="crm-stat-row">
      ${_crmStatBox('Ingresos del mes', _cop(totalIncome), `Meta: ${_cop(META_MINIMA)}`, totalIncome >= META_MINIMA ? 'green' : 'yellow')}
      ${_crmStatBox('Presupuesto cubierto', _cop(totalCovered), `de ${_cop(totalNeeded)}`, deficit === 0 ? 'green' : 'red')}
      ${_crmStatBox('Déficit', deficit > 0 ? _cop(deficit) : '✓ Cubierto', 'este mes', deficit > 0 ? 'red' : 'green')}
      ${_crmStatBox('Deals activos', _crmDeals.filter(d => d.stage !== 'won' && d.stage !== 'lost').length, 'en pipeline', 'purple')}
    </div>

    <div class="freq-tabs" style="margin-bottom:20px">
      ${tabs.map(t => `<button class="freq-tab${_crmTab === t.id ? ' active' : ''}" onclick="crmTab('${t.id}',this)">${t.label}</button>`).join('')}
    </div>

    <div id="crm-content"></div>
  `

  _crmRenderTab()
}

function _crmStatBox(label, value, sub, color) {
  const colors = { green: 'var(--color-success,#4caf7d)', red: '#e24b4a', yellow: '#f59e0b', purple: '#9b72f0' }
  return `
    <div class="stat-box">
      <div style="font-size:.75rem;color:#a09ab8;margin-bottom:4px">${label}</div>
      <div class="stat-num" style="color:${colors[color] || colors.green}">${value}</div>
      <div style="font-size:.72rem;color:#a09ab8;margin-top:2px">${sub}</div>
    </div>`
}

function crmTab(tab, btn) {
  _crmTab = tab
  document.querySelectorAll('#section-crm .freq-tab').forEach(b => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
  _crmRenderTab()
}

function _crmRenderTab() {
  const el = document.getElementById('crm-content')
  if (!el) return
  if (_crmTab === 'presupuesto') _crmRenderPresupuesto(el)
  else if (_crmTab === 'pipeline')    _crmRenderPipeline(el)
  else if (_crmTab === 'clientes')    _crmRenderClientes(el)
  else if (_crmTab === 'deudas')      _crmRenderDeudas(el)
}

// ─── Tab: Presupuesto ──────────────────────────────────────
function _crmRenderPresupuesto(el) {
  const rows = _crmBudgets.map(b => {
    const spent = _crmBudgetSpent(b.id)
    const pct = Math.min(100, (spent / b.amount) * 100)
    const sem = _semaforo(spent, b.amount)
    const barColor = spent >= b.amount ? '#4caf7d' : spent > 0 ? '#f59e0b' : '#e24b4a'
    return `
      <tr>
        <td style="color:#a09ab8;padding:10px 0">${b.priority}</td>
        <td style="padding:10px 8px">${b.category}</td>
        <td style="text-align:right;color:#a09ab8">${_cop(b.amount)}</td>
        <td style="text-align:right">
          <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">
            <div style="width:80px;height:5px;border-radius:4px;background:rgba(255,255,255,0.08)">
              <div style="width:${pct}%;height:100%;border-radius:4px;background:${barColor}"></div>
            </div>
            ${_cop(spent)}
          </div>
        </td>
        <td style="text-align:right"><span class="${sem.cls}">${sem.label}</span></td>
      </tr>`
  }).join('')

  const totalNeeded = _crmTotalNeeded()
  const totalCovered = _crmTotalCovered()

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 340px;gap:20px">
      <div>
        <div class="crm-card crm-card-gold" style="margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <thead>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
                <th style="text-align:left;padding:0 0 8px;color:#a09ab8;font-weight:500">#</th>
                <th style="text-align:left;padding:0 0 8px;color:#a09ab8;font-weight:500">Categoría</th>
                <th style="text-align:right;padding:0 0 8px;color:#a09ab8;font-weight:500">Meta</th>
                <th style="text-align:right;padding:0 0 8px;color:#a09ab8;font-weight:500">Asignado</th>
                <th style="text-align:right;padding:0 0 8px;color:#a09ab8;font-weight:500">Estado</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="border-top:1px solid rgba(201,168,76,0.3)">
                <td colspan="2" style="padding:10px 0;font-weight:700">TOTAL</td>
                <td style="text-align:right;font-weight:700">${_cop(totalNeeded)}</td>
                <td style="text-align:right;font-weight:700;color:${totalCovered >= totalNeeded ? '#4caf7d' : '#f59e0b'}">${_cop(totalCovered)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        ${_crmHistorialIngresos()}
      </div>
      <div id="crm-ingreso-form">
        ${_crmFormIngreso()}
      </div>
    </div>`
}

function _crmHistorialIngresos() {
  if (_crmIncome.length === 0) return `<div class="crm-card" style="color:#a09ab8;text-align:center;padding:2rem">Sin ingresos este mes</div>`
  const SOURCES = { iarcania: 'IArcanIA', la_segunda: 'La Segunda', family_help: 'Ayuda familiar', other: 'Otro' }
  const rows = _crmIncome.map(inc => `
    <div style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:12px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div>
          <strong>${_cop(inc.amount)}</strong>
          <span class="crm-badge gold" style="margin-left:8px">${SOURCES[inc.source] || inc.source}</span>
          ${inc.distribution_applied ? '<span class="crm-badge green" style="margin-left:4px">Distribuido</span>' : ''}
        </div>
        <span style="color:#a09ab8;font-size:.75rem">${new Date(inc.created_at).toLocaleDateString('es-CO',{day:'2-digit',month:'short'})}</span>
      </div>
      ${inc.description ? `<div style="font-size:.78rem;color:#a09ab8">${inc.description}</div>` : ''}
    </div>`).join('')
  return `<div class="crm-card"><div style="font-weight:700;margin-bottom:12px;color:var(--gold,#c9a84c)">Historial del mes</div>${rows}</div>`
}

function _crmFormIngreso(previewData) {
  if (previewData) {
    const { amount, source, description, previews, surplus } = previewData
    const rows = previews.map(p => `
      <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:4px">
        <span style="color:${p.assign > 0 ? '#f0eeff' : '#a09ab8'}">${p.priority}. ${p.name}</span>
        <span style="color:${p.assign > 0 ? '#4caf7d' : '#a09ab8'}">${p.assign > 0 ? '+' + _cop(p.assign) : '—'}</span>
      </div>`).join('')
    return `
      <div class="crm-card crm-card-gold">
        <div style="font-weight:700;margin-bottom:4px;color:var(--gold,#c9a84c)">Preview de distribución</div>
        <div style="font-size:.78rem;color:#a09ab8;margin-bottom:14px">${_cop(amount)} · ${source}</div>
        ${rows}
        ${surplus > 0 ? `<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;font-size:.8rem">
          <span style="color:#9b72f0">Excedente</span><span style="color:#9b72f0;font-weight:700">+${_cop(surplus)}</span>
        </div>` : ''}
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn-save" style="flex:1" onclick="crmConfirmarIngreso(${amount},'${source}','${(description||'').replace(/'/g,"\\'")}')">Confirmar y guardar</button>
          <button class="btn-cancel" onclick="document.getElementById('crm-ingreso-form').innerHTML=_crmFormIngreso()">Editar</button>
        </div>
      </div>`
  }
  const SOURCES = [
    ['iarcania','IArcanIA'],['la_segunda','La Segunda'],
    ['family_help','Ayuda familiar'],['other','Otro']
  ]
  return `
    <div class="crm-card crm-card-gold">
      <div style="font-weight:700;margin-bottom:16px;color:var(--gold,#c9a84c)">Registrar ingreso</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="crm-label">Monto (COP)</label>
          <input id="crm-ing-amount" type="number" placeholder="1200000">
        </div>
        <div>
          <label class="crm-label">Fuente</label>
          <select id="crm-ing-source">
            ${SOURCES.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="crm-label">Descripción (opcional)</label>
          <input id="crm-ing-desc" type="text" placeholder="Anticipo cliente X…">
        </div>
        <button class="btn-add" onclick="crmPreviewIngreso()">Ver distribución →</button>
      </div>
    </div>`
}

function crmPreviewIngreso() {
  const amount = parseFloat(document.getElementById('crm-ing-amount').value)
  const source = document.getElementById('crm-ing-source').value
  const description = document.getElementById('crm-ing-desc').value
  if (!amount || isNaN(amount)) { showToast('Ingresa un monto'); return }
  const { previews, surplus } = _crmPreviewDistribution(amount)
  document.getElementById('crm-ingreso-form').innerHTML = _crmFormIngreso({ amount, source, description, previews, surplus })
}

async function crmConfirmarIngreso(amount, source, description) {
  const id = 'inc_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  const { error } = await SB_P.from('income').insert({
    id, user_id: CRM_USER, amount, source,
    description: description || null,
    distribution_applied: false,
    created_at: new Date().toISOString()
  })
  if (error) { showToast('Error: ' + error.message); return }

  // Aplicar distribución
  const { previews } = _crmPreviewDistribution(amount)
  const distRows = previews.filter(p => p.assign > 0).map(p => ({
    id: 'bd_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + p.budget_id,
    income_id: id, budget_id: p.budget_id, amount_assigned: p.assign
  }))
  if (distRows.length > 0) {
    await SB_P.from('budget_distributions').insert(distRows)
    await SB_P.from('income').update({ distribution_applied: true }).eq('id', id)
  }

  showToast('✓ Ingreso registrado y distribuido')
  await Promise.all([_crmLoadBudgets(), _crmLoadIncome()])
  renderCRM()
}

// ─── Tab: Pipeline ─────────────────────────────────────────
const STAGE_CFG = [
  { key: 'contacted',   label: 'Contactado',  color: '#6b7280' },
  { key: 'demo',        label: 'Demo',         color: '#9b72f0' },
  { key: 'proposal',    label: 'Propuesta',    color: '#c9a84c' },
  { key: 'negotiation', label: 'Negociación',  color: '#f59e0b' },
  { key: 'won',         label: 'Ganado',       color: '#4caf7d' },
  { key: 'lost',        label: 'Perdido',      color: '#e24b4a' },
]

function _crmRenderPipeline(el) {
  const byStage = _crmDealsByStage()

  const cols = STAGE_CFG.map(s => {
    const items = byStage[s.key] || []
    const total = items.reduce((sum, d) => sum + (d.value || 0), 0)
    const cards = items.map(d => {
      const client = _crmClients.find(c => c.id === d.client_id)
      return `
        <div class="crm-card" style="padding:.75rem;margin-bottom:8px">
          <div style="font-weight:600;font-size:.82rem;margin-bottom:2px">${d.name || client?.name || 'Sin nombre'}</div>
          ${client?.name && d.name ? `<div style="color:#a09ab8;font-size:.72rem">${client.name}</div>` : ''}
          ${d.value ? `<div style="color:#c9a84c;font-weight:700;font-size:.82rem;margin-top:4px">${_cop(d.value)}</div>` : ''}
          ${d.service_type ? `<div style="color:#9b72f0;font-size:.68rem;margin-top:2px">${d.service_type === 'family_os' ? 'Family OS' : 'Agente custom'}</div>` : ''}
          <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
            ${STAGE_CFG.filter(x => x.key !== s.key).map(x => `<button onclick="crmMoveStage('${d.id}','${x.key}')" style="font-size:.65rem;padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#a09ab8;cursor:pointer">${x.label}</button>`).join('')}
          </div>
        </div>`
    }).join('')

    return `
      <div style="min-width:160px">
        <div style="background:${s.color}22;border-radius:8px;padding:6px 10px;margin-bottom:10px">
          <div style="font-size:.75rem;font-weight:700;color:${s.color}">${s.label}</div>
          <div style="font-size:.68rem;color:#a09ab8">${items.length}${total > 0 ? ' · ' + _cop(total) : ''}</div>
        </div>
        ${cards || `<div style="color:#a09ab8;font-size:.75rem;padding:8px 0">—</div>`}
      </div>`
  }).join('')

  el.innerHTML = `
    <div style="margin-bottom:16px;text-align:right">
      <button class="btn-add" onclick="crmAbrirNuevoDeal()">+ Nuevo deal</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;overflow-x:auto">
      ${cols}
    </div>
    <div id="crm-deal-form"></div>`
}

async function crmMoveStage(dealId, stage) {
  const update = { stage }
  if (stage === 'won' || stage === 'lost') update.closed_at = new Date().toISOString()
  await SB_P.from('projects').update(update).eq('id', dealId)
  showToast(`Deal movido a ${stage}`)
  await _crmLoadDeals()
  _crmRenderTab()
}

function crmAbrirNuevoDeal() {
  const clientOpts = _crmClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
  document.getElementById('crm-deal-form').innerHTML = `
    <div class="crm-card crm-card-gold" style="margin-top:20px">
      <div style="font-weight:700;margin-bottom:16px;color:#c9a84c">Nuevo deal</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="crm-label">Nombre del deal</label><input id="nd-name" type="text" placeholder="Agente WhatsApp para…"></div>
        <div><label class="crm-label">Cliente</label><select id="nd-client"><option value="">Sin cliente</option>${clientOpts}</select></div>
        <div><label class="crm-label">Tipo de servicio</label><select id="nd-type"><option value="custom_agent">Agente custom</option><option value="family_os">Family OS</option></select></div>
        <div><label class="crm-label">Valor (COP)</label><input id="nd-value" type="number" placeholder="3000000"></div>
        <div><label class="crm-label">Stage inicial</label><select id="nd-stage">${STAGE_CFG.map(s=>`<option value="${s.key}">${s.label}</option>`).join('')}</select></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-save" onclick="crmGuardarDeal()">Guardar deal</button>
        <button class="btn-cancel" onclick="document.getElementById('crm-deal-form').innerHTML=''">Cancelar</button>
      </div>
    </div>`
}

async function crmGuardarDeal() {
  const name = document.getElementById('nd-name').value
  const client_id = document.getElementById('nd-client').value || null
  const service_type = document.getElementById('nd-type').value
  const value = parseFloat(document.getElementById('nd-value').value) || null
  const stage = document.getElementById('nd-stage').value
  if (!name) { showToast('Pon un nombre al deal'); return }
  const id = 'proj_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  const { error } = await SB_P.from('projects').insert({
    id, user_id: CRM_USER, name, client_id, service_type, value, stage,
    anticipo_pct: 50, anticipo_paid: false, created_at: new Date().toISOString()
  })
  if (error) { showToast('Error: ' + error.message); return }
  showToast('✓ Deal creado')
  await _crmLoadDeals()
  _crmRenderTab()
}

// ─── Tab: Clientes ─────────────────────────────────────────
const STATUS_CFG = {
  lead:     { cls: 'crm-badge yellow', label: 'Lead' },
  prospect: { cls: 'crm-badge gold',   label: 'Prospecto' },
  active:   { cls: 'crm-badge green',  label: 'Activo' },
  inactive: { cls: 'crm-badge red',    label: 'Inactivo' },
}

function _crmRenderClientes(el) {
  const items = _crmClients.map(c => {
    const sc = STATUS_CFG[c.status] || STATUS_CFG.lead
    const deals = _crmDeals.filter(d => d.client_id === c.id)
    return `
      <div class="crm-card" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;margin-bottom:2px">${c.name}</div>
          ${c.business_name ? `<div style="font-size:.78rem;color:#a09ab8">${c.business_name}</div>` : ''}
          <div style="font-size:.75rem;color:#a09ab8;margin-top:2px">
            ${c.phone ? `📱 ${c.phone}` : ''}
            ${c.email ? ` · ✉ ${c.email}` : ''}
            ${deals.length > 0 ? ` · ${deals.length} deal${deals.length !== 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          ${c.source ? `<span style="font-size:.72rem;color:#a09ab8">${c.source}</span>` : ''}
          <span class="${sc.cls}">${sc.label}</span>
        </div>
      </div>`
  }).join('')

  el.innerHTML = `
    <div style="margin-bottom:16px;text-align:right">
      <button class="btn-add" onclick="crmAbrirNuevoCliente()">+ Nuevo cliente</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">${items || '<div class="crm-card" style="color:#a09ab8;text-align:center;padding:2rem">Sin clientes aún</div>'}</div>
    <div id="crm-cliente-form"></div>`
}

function crmAbrirNuevoCliente() {
  document.getElementById('crm-cliente-form').innerHTML = `
    <div class="crm-card crm-card-gold" style="margin-top:20px">
      <div style="font-weight:700;margin-bottom:16px;color:#c9a84c">Nuevo cliente</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label class="crm-label">Nombre *</label><input id="nc-name" type="text" placeholder="Juan Pérez"></div>
        <div><label class="crm-label">Empresa</label><input id="nc-biz" type="text" placeholder="Empresa S.A.S"></div>
        <div><label class="crm-label">Teléfono</label><input id="nc-phone" type="text" placeholder="+57 300…"></div>
        <div><label class="crm-label">Email</label><input id="nc-email" type="email" placeholder="correo@…"></div>
        <div><label class="crm-label">Fuente</label><input id="nc-source" type="text" placeholder="Referido, Instagram…"></div>
        <div><label class="crm-label">Status</label><select id="nc-status">
          <option value="lead">Lead</option><option value="prospect">Prospecto</option>
          <option value="active">Activo</option><option value="inactive">Inactivo</option>
        </select></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn-save" onclick="crmGuardarCliente()">Guardar</button>
        <button class="btn-cancel" onclick="document.getElementById('crm-cliente-form').innerHTML=''">Cancelar</button>
      </div>
    </div>`
}

async function crmGuardarCliente() {
  const name = document.getElementById('nc-name').value
  if (!name) { showToast('El nombre es requerido'); return }
  const id = 'cli_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
  const { error } = await SB_P.from('clients').insert({
    id,
    name,
    business_name: document.getElementById('nc-biz').value || null,
    phone: document.getElementById('nc-phone').value || null,
    email: document.getElementById('nc-email').value || null,
    source: document.getElementById('nc-source').value || null,
    status: document.getElementById('nc-status').value,
    created_at: new Date().toISOString()
  })
  if (error) { showToast('Error: ' + error.message); return }
  showToast('✓ Cliente guardado')
  await _crmLoadClients()
  _crmRenderTab()
}

// ─── Tab: Deudas ───────────────────────────────────────────
function _crmRenderDeudas(el) {
  const total = _crmDebts.reduce((s, d) => s + d.remaining_amount, 0)
  const totalCuota = _crmDebts.reduce((s, d) => s + (d.monthly_payment || 0), 0)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

  const items = _crmDebts.map(d => {
    const overdue = d.due_date && d.due_date <= today
    const pct = ((d.total_amount - d.remaining_amount) / d.total_amount) * 100
    const months = d.monthly_payment > 0 ? Math.ceil(d.remaining_amount / d.monthly_payment) : null
    const barColor = pct > 50 ? '#4caf7d' : pct > 0 ? '#f59e0b' : '#e24b4a'
    return `
      <div class="crm-card crm-card-gold">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;margin-bottom:2px">${d.creditor}</div>
            <div style="font-size:.78rem;color:#a09ab8">
              Deudor: ${d.debtor}
              ${d.monthly_payment ? ` · Cuota: ${_cop(d.monthly_payment)}/mes` : ''}
            </div>
            ${d.notes ? `<div style="font-size:.75rem;color:#a09ab8;margin-top:2px">${d.notes}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-size:1.2rem;font-weight:700;color:#e24b4a">${_cop(d.remaining_amount)}</div>
            ${d.total_amount !== d.remaining_amount ? `<div style="font-size:.72rem;color:#a09ab8">de ${_cop(d.total_amount)}</div>` : ''}
          </div>
        </div>
        <div style="height:5px;border-radius:4px;background:rgba(255,255,255,0.08);margin-bottom:8px">
          <div style="width:${pct}%;height:100%;border-radius:4px;background:${barColor}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem">
          <div>
            ${overdue ? `<span style="color:#e24b4a">● Vencida${d.due_date ? ' — ' + d.due_date : ''}</span>`
              : d.due_date ? `<span style="color:#f59e0b">Vence: ${d.due_date}</span>` : ''}
          </div>
          <div style="color:#a09ab8">${months ? `~${months} meses para liquidar` : 'Sin cuota fija'}</div>
        </div>
      </div>`
  }).join('')

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="crm-card">
        <div style="font-size:.75rem;color:#a09ab8;margin-bottom:4px">Total adeudado</div>
        <div style="font-size:1.5rem;font-weight:700;color:#e24b4a">${_cop(total)}</div>
      </div>
      <div class="crm-card">
        <div style="font-size:.75rem;color:#a09ab8;margin-bottom:4px">Cuotas mensuales</div>
        <div style="font-size:1.5rem;font-weight:700;color:#f59e0b">${_cop(totalCuota)}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">${items || '<div class="crm-card" style="color:#4caf7d;text-align:center;padding:2rem">✓ Sin deudas activas</div>'}</div>`
}
