// js/nutricion.js — Módulo Nutrición (tab dentro de Cuerpo)
// Globals de os.html: SB_P, USER_ID, showToast, TODAY, selectedDate

// ─── ESTADO ──────────────────────────────────────────────────────────────────
let _nMeals   = []
let _nTargets = { kcal_target: 2000, prot_target: 150, carb_target: 200, fat_target: 65 }
let _nForm    = null   // null | meal_type abierto
let _nEditing = null   // id del meal en edición
let _nFormData = {}

const N_MEAL_TYPES = [
  { id: 'desayuno', label: 'Desayuno', icon: '☕' },
  { id: 'almuerzo', label: 'Almuerzo', icon: '🍽️' },
  { id: 'cena',     label: 'Cena',     icon: '🌙' },
  { id: 'snack',    label: 'Snack',    icon: '🍎' },
]

// ─── CARGA ───────────────────────────────────────────────────────────────────
async function loadNutricion() {
  const date = (typeof selectedDate !== 'undefined' && selectedDate) ? selectedDate : TODAY
  const [{ data: meals }, { data: targets }] = await Promise.all([
    SB_P.from('meals').select('*').eq('user_id', USER_ID).eq('date', date).order('created_at'),
    SB_P.from('nutrition_targets').select('*').eq('user_id', USER_ID).maybeSingle()
  ])
  _nMeals   = meals   || []
  _nTargets = targets || _nTargets
}

// ─── RENDER PRINCIPAL ────────────────────────────────────────────────────────
function renderNutricion(container) {
  if (!container) return
  const totals = _nTotals()
  const pct = (v, t) => t ? Math.min(100, Math.round(v / t * 100)) : 0
  const bar  = (v, t, color) => {
    const p = pct(v, t)
    return `<div style="background:var(--border);border-radius:4px;height:5px;overflow:hidden;margin-top:3px">
      <div style="width:${p}%;height:100%;background:${color};border-radius:4px;transition:width .3s"></div>
    </div>`
  }

  const macroBoxes = [
    { label:'Calorías', val: Math.round(totals.cal),  target: _nTargets.kcal_target, unit:'kcal', color:'#FFD166' },
    { label:'Proteína', val: Math.round(totals.prot), target: _nTargets.prot_target, unit:'g',    color:'#5DCAA5' },
    { label:'Carbs',    val: Math.round(totals.carb), target: _nTargets.carb_target, unit:'g',    color:'#378ADD' },
    { label:'Grasa',    val: Math.round(totals.fat),  target: _nTargets.fat_target,  unit:'g',    color:'#C4A35A' },
  ].map(m => `
    <div style="flex:1;min-width:0;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px">
      <div style="font-size:18px;font-weight:700;color:var(--text)">${m.val}<span style="font-size:11px;color:var(--text-muted);margin-left:2px">${m.unit}</span></div>
      <div style="font-size:11px;color:var(--text-muted)">${m.label} · meta ${m.target}${m.unit}</div>
      ${bar(m.val, m.target, m.color)}
    </div>`).join('')

  const mealCards = N_MEAL_TYPES.map(t => {
    const meal = _nMeals.find(m => m.meal_type === t.id)
    const isOpen = _nForm === t.id && !_nEditing
    if (isOpen) return _nFormHTML(t)
    if (meal) return _nMealCard(meal, t)
    return `<button onclick="nAbrirForm('${t.id}')"
      style="display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;
             background:var(--card);border:1px dashed var(--border);border-radius:10px;
             color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px;text-align:left">
      <span style="font-size:16px">${t.icon}</span>
      <span>${t.label}</span>
      <span style="margin-left:auto;font-size:18px;opacity:.5">+</span>
    </button>`
  }).join('')

  const snacks = _nMeals.filter(m => m.meal_type === 'snack')
  const isSnackOpen = _nForm === 'snack' && !_nEditing

  const snackSection = `
    <div style="margin-top:8px">
      ${snacks.map(m => _nMealCard(m, N_MEAL_TYPES.find(t=>t.id==='snack'))).join('')}
      ${isSnackOpen ? _nFormHTML(N_MEAL_TYPES.find(t=>t.id==='snack')) : ''}
      ${!isSnackOpen ? `<button onclick="nAbrirForm('snack')"
        style="display:flex;align-items:center;gap:8px;padding:8px 12px;
               background:transparent;border:1px dashed var(--border);border-radius:8px;
               color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px;margin-top:4px">
        + Agregar snack
      </button>` : ''}
    </div>`

  container.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${macroBoxes}</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${mealCards}
      ${snackSection}
    </div>`

  if (_nEditing) {
    const editMeal = _nMeals.find(m => m.id === _nEditing)
    if (editMeal) {
      const el = document.getElementById('n-edit-' + _nEditing)
      if (el) el.outerHTML = _nFormHTML(N_MEAL_TYPES.find(t => t.id === editMeal.meal_type), editMeal)
    }
    _nFocusForm()
  } else if (_nForm) {
    _nFocusForm()
  }
}

function _nMealCard(meal, type) {
  const macrosLine = [
    meal.calories  ? `${meal.calories} kcal` : null,
    meal.protein_g ? `${meal.protein_g}g prot` : null,
    meal.carbs_g   ? `${meal.carbs_g}g carbs` : null,
    meal.fat_g     ? `${meal.fat_g}g grasa` : null,
  ].filter(Boolean).join(' · ')
  const locationBadge = meal.location === 'fuera'
    ? `<span style="font-size:10px;background:rgba(55,138,221,0.15);color:#378ADD;padding:2px 6px;border-radius:4px">🏪 Fuera</span>`
    : ''

  if (_nEditing === meal.id) {
    return `<div id="n-edit-${meal.id}">${_nFormHTML(type, meal)}</div>`
  }

  return `
    <div style="background:var(--card);border:1px solid rgba(93,202,165,0.3);border-radius:10px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:15px">${type.icon}</span>
        <span style="font-size:13px;font-weight:600;color:#5DCAA5">${type.label}</span>
        ${locationBadge}
        <div style="margin-left:auto;display:flex;gap:4px">
          <button onclick="nEditarMeal('${meal.id}')"
            style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:2px 6px">✏️</button>
          <button onclick="nEliminarMeal('${meal.id}')"
            style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:13px;padding:2px 6px">🗑️</button>
        </div>
      </div>
      ${meal.description ? `<div style="font-size:13px;color:var(--text)">${meal.description}</div>` : ''}
      ${macrosLine ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">${macrosLine}</div>` : ''}
    </div>`
}

function _nFormHTML(type, existing) {
  const d = existing || _nFormData
  const borderColor = existing ? 'rgba(201,168,76,0.4)' : 'var(--border)'
  const inputStyle = `width:100%;background:#0C0C0C;border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:13px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box`
  const macroStyle = `${inputStyle};padding:6px 8px;font-size:12px`
  const id = existing ? existing.id : 'new'

  return `
    <div style="background:var(--card);border:1px solid ${borderColor};border-radius:10px;padding:12px 14px" id="n-form-${id}">
      <div style="font-size:13px;font-weight:600;color:${existing?'var(--gold)':'var(--text)'};margin-bottom:10px">${type.icon} ${type.label}${existing?' — editar':''}</div>
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <button onclick="nSetLocation('${id}','casa')"
          style="flex:1;padding:6px;border-radius:7px;border:1px solid ${(d.location||'casa')==='casa'?'#5DCAA5':'var(--border)'};
                 background:${(d.location||'casa')==='casa'?'rgba(93,202,165,0.1)':'transparent'};
                 color:${(d.location||'casa')==='casa'?'#5DCAA5':'var(--text-muted)'};cursor:pointer;font-size:12px;font-family:'Outfit',sans-serif">
          🏠 Casa
        </button>
        <button onclick="nSetLocation('${id}','fuera')"
          style="flex:1;padding:6px;border-radius:7px;border:1px solid ${d.location==='fuera'?'#378ADD':'var(--border)'};
                 background:${d.location==='fuera'?'rgba(55,138,221,0.1)':'transparent'};
                 color:${d.location==='fuera'?'#378ADD':'var(--text-muted)'};cursor:pointer;font-size:12px;font-family:'Outfit',sans-serif">
          🏪 Fuera
        </button>
      </div>
      <input id="n-desc-${id}" type="text" placeholder="¿Qué comiste?" value="${existing?.description||''}"
        style="${inputStyle};margin-bottom:8px"
        onkeydown="if(event.key==='Enter')nGuardarMeal('${id}','${type.id}')">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:10px">
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">kcal</div>
          <input id="n-cal-${id}"  type="number" placeholder="0" value="${existing?.calories||''}"  style="${macroStyle}">
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">proteína g</div>
          <input id="n-prot-${id}" type="number" placeholder="0" value="${existing?.protein_g||''}" style="${macroStyle}">
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">carbs g</div>
          <input id="n-carb-${id}" type="number" placeholder="0" value="${existing?.carbs_g||''}"   style="${macroStyle}">
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">grasa g</div>
          <input id="n-fat-${id}"  type="number" placeholder="0" value="${existing?.fat_g||''}"     style="${macroStyle}">
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="nCerrarForm()" style="flex:1;padding:7px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px">Cancelar</button>
        <button onclick="nGuardarMeal('${id}','${type.id}')" style="flex:2;padding:7px;border-radius:7px;border:1px solid #5DCAA5;background:rgba(93,202,165,0.1);color:#5DCAA5;cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px">Guardar ✓</button>
      </div>
    </div>`
}

function _nFocusForm() {
  const id = _nEditing || 'new'
  const inp = document.getElementById('n-desc-' + id)
  if (inp) inp.focus()
}

function _nTotals() {
  return _nMeals.reduce((acc, m) => {
    acc.cal  += (m.calories  || 0)
    acc.prot += parseFloat(m.protein_g || 0)
    acc.carb += parseFloat(m.carbs_g   || 0)
    acc.fat  += parseFloat(m.fat_g     || 0)
    return acc
  }, { cal: 0, prot: 0, carb: 0, fat: 0 })
}

// ─── ACCIONES ────────────────────────────────────────────────────────────────
function nAbrirForm(mealType) {
  _nForm    = mealType
  _nEditing = null
  _nFormData = { location: 'casa' }
  _cRenderNutricion()
}

function nCerrarForm() {
  _nForm    = null
  _nEditing = null
  _nFormData = {}
  _cRenderNutricion()
}

function nEditarMeal(id) {
  const m = _nMeals.find(m => m.id === id)
  if (!m) return
  _nEditing = id
  _nForm    = m.meal_type
  _nFormData = { location: m.location }
  _cRenderNutricion()
}

function nSetLocation(formId, loc) {
  if (formId === 'new') _nFormData.location = loc
  else {
    const m = _nMeals.find(m => m.id === formId)
    if (m) m.location = loc
  }
  _cRenderNutricion()
}

async function nGuardarMeal(formId, mealType) {
  const isNew = formId === 'new'
  const desc = document.getElementById('n-desc-' + formId)?.value.trim() || ''
  const cal  = parseFloat(document.getElementById('n-cal-' + formId)?.value)  || null
  const prot = parseFloat(document.getElementById('n-prot-' + formId)?.value) || null
  const carb = parseFloat(document.getElementById('n-carb-' + formId)?.value) || null
  const fat  = parseFloat(document.getElementById('n-fat-' + formId)?.value)  || null
  const date = (typeof selectedDate !== 'undefined' && selectedDate) ? selectedDate : TODAY

  const loc = isNew
    ? (_nFormData.location || 'casa')
    : (_nMeals.find(m => m.id === formId)?.location || 'casa')

  const row = {
    user_id:     USER_ID,
    date,
    meal_type:   mealType,
    description: desc || null,
    location:    loc,
    calories:    cal,
    protein_g:   prot,
    carbs_g:     carb,
    fat_g:       fat,
  }

  if (isNew) {
    const id = 'meal_' + Date.now()
    const { error } = await SB_P.from('meals').insert({ id, ...row, created_at: new Date().toISOString() })
    if (error) { showToast('❌ ' + error.message); return }
    _nMeals.push({ id, ...row, created_at: new Date().toISOString() })
  } else {
    const { error } = await SB_P.from('meals').update(row).eq('id', formId)
    if (error) { showToast('❌ ' + error.message); return }
    const idx = _nMeals.findIndex(m => m.id === formId)
    if (idx !== -1) _nMeals[idx] = { ..._nMeals[idx], ...row }
  }

  _nForm    = null
  _nEditing = null
  _nFormData = {}
  _cRenderNutricion()
  showToast('✅ Guardado')
}

async function nEliminarMeal(id) {
  if (!confirm('¿Eliminar este registro?')) return
  const { error } = await SB_P.from('meals').delete().eq('id', id)
  if (error) { showToast('❌ ' + error.message); return }
  _nMeals = _nMeals.filter(m => m.id !== id)
  _cRenderNutricion()
}

// llamado desde cuerpo.js cuando está en tab nutricion
function _cRenderNutricion() {
  const el = document.getElementById('cx-content')
  if (el) renderNutricion(el)
}
