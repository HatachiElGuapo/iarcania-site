// js/cuerpo.js — módulo Cuerpo (ejercicio + métricas)
// Globals de os.html: SB_P, USER_ID, showToast, TODAY, selectedDate

// ─── ESTADO ──────────────────────────────────────────────────────────────────
let _cEjercicios   = []
let _cWorkoutLogs  = []
let _cTodayMetric  = null
let _cMetricHist   = []
let _cTab          = 'registro'
let _cNutricionLoaded = false
let _cExForm       = false
let _cEditingEx    = null
let _cSelectedEx   = null
let _cAddingSet    = false

// ─── CARGA ───────────────────────────────────────────────────────────────────
async function loadCuerpo() {
  if (!USER_ID) return
  const el = document.getElementById('section-cuerpo')
  if (!el) return
  el.innerHTML = '<div class="loading"><div class="spinner"></div><br>Cargando Cuerpo…</div>'
  try {
    _cNutricionLoaded = false
    await Promise.all([_cLoadEjercicios(), _cLoadWorkoutLogs(), _cLoadBodyMetrics()])
    renderCuerpo()
  } catch (e) {
    console.error('[cuerpo]', e)
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div>${e.message}</div>`
  }
}

function _cDate() { return (typeof selectedDate !== 'undefined' && selectedDate) ? selectedDate : TODAY }

async function _cLoadEjercicios() {
  const { data, error } = await SB_P
    .from('exercises').select('*')
    .eq('user_id', USER_ID).eq('is_active', true)
    .order('sort_order').order('name')
  if (error) throw error
  _cEjercicios = data || []
}

async function _cLoadWorkoutLogs() {
  const { data, error } = await SB_P
    .from('workout_logs')
    .select('*')
    .eq('user_id', USER_ID).eq('date', _cDate())
    .order('created_at')
  if (error) throw error
  _cWorkoutLogs = data || []
}

async function _cLoadBodyMetrics() {
  const { data: hoy, error: e1 } = await SB_P
    .from('body_metrics').select('*')
    .eq('user_id', USER_ID).eq('date', _cDate()).maybeSingle()
  if (e1) throw e1
  _cTodayMetric = hoy

  const since = new Date(TODAY)
  since.setDate(since.getDate() - 13)
  const { data: hist, error: e2 } = await SB_P
    .from('body_metrics').select('date, weight_kg')
    .eq('user_id', USER_ID)
    .gte('date', since.toISOString().split('T')[0])
    .not('weight_kg', 'is', null)
    .order('date')
  if (e2) throw e2
  _cMetricHist = hist || []
}

// ─── RENDER PRINCIPAL ────────────────────────────────────────────────────────
function renderCuerpo() {
  const el = document.getElementById('section-cuerpo')
  if (!el) return
  const date      = _cDate()
  const pesoHoy   = _cTodayMetric?.weight_kg
  const series    = _cWorkoutLogs.length
  const exUnicas  = new Set(_cWorkoutLogs.map(l => l.exercise_id)).size

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Cuerpo</h1>
        <div class="page-sub">${date === TODAY ? 'Hoy' : date}</div>
      </div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-num${pesoHoy ? ' green' : ''}" id="cx-stat-peso">${pesoHoy != null ? pesoHoy + ' kg' : '—'}</div>
          <div class="stat-label">Peso</div>
        </div>
        <div class="stat-box">
          <div class="stat-num${series > 0 ? ' green' : ''}" id="cx-stat-series">${series}</div>
          <div class="stat-label">Series</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" id="cx-stat-exs">${exUnicas}</div>
          <div class="stat-label">Ejercicios</div>
        </div>
      </div>
    </div>

    <div class="freq-tabs" style="margin-bottom:1.5rem" id="cx-tabs">
      <button class="freq-tab${_cTab==='registro'    ?' active':''}" onclick="cuerpoTab('registro',this)">📋 Registro</button>
      <button class="freq-tab${_cTab==='nutricion'   ?' active':''}" onclick="cuerpoTab('nutricion',this)">🍽️ Nutrición</button>
      <button class="freq-tab${_cTab==='ejercicios'  ?' active':''}" onclick="cuerpoTab('ejercicios',this)">💪 Ejercicios</button>
      <button class="freq-tab${_cTab==='metricas'    ?' active':''}" onclick="cuerpoTab('metricas',this)">📊 Métricas</button>
    </div>

    <div id="cx-content"></div>`

  _cRenderTab()
}

async function cuerpoTab(tab, btn) {
  _cTab = tab
  document.querySelectorAll('#cx-tabs .freq-tab').forEach(b => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
  if (tab === 'nutricion' && !_cNutricionLoaded) {
    const el = document.getElementById('cx-content')
    if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div><br>Cargando...</div>'
    await loadNutricion()
    _cNutricionLoaded = true
  }
  _cRenderTab()
}

function _cRenderTab() {
  const el = document.getElementById('cx-content')
  if (!el) return
  if (_cTab === 'ejercicios')  _cRenderEjercicios(el)
  else if (_cTab === 'registro')  _cRenderRegistro(el)
  else if (_cTab === 'nutricion') renderNutricion(el)
  else _cRenderMetricas(el)
}

// ─── TAB: MIS EJERCICIOS ─────────────────────────────────────────────────────
const _cTypeLabel = { fuerza: '🏋️ Fuerza', cardio: '🏃 Cardio', peso_corporal: '🤸 Peso corporal' }

function _cRenderEjercicios(el) {
  const listHtml = _cEjercicios.length === 0
    ? `<div class="empty-state"><div class="empty-icon">💪</div>Sin ejercicios. ¡Crea el primero!</div>`
    : _cEjercicios.map(ex => `
        <div class="habito-item" style="margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--text);font-weight:500">${ex.name}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
              ${_cTypeLabel[ex.type] || ex.type}${ex.muscle_group ? ' · ' + ex.muscle_group : ''}
            </div>
          </div>
          <button class="btn-edit-act" onclick="cuerpoEditEx('${ex.id}')">Editar</button>
          <button class="habito-toggle" onclick="cuerpoDeactivateEx('${ex.id}')">Desactivar</button>
        </div>`).join('')

  el.innerHTML = `
    <div class="card">
      <div class="card-title">
        💪 Mis ejercicios
        <button class="btn-add" onclick="cuerpoOpenExForm()">+ Nuevo</button>
      </div>
      ${_cExForm ? _cExFormHtml() : ''}
      <div id="cx-ex-list">${listHtml}</div>
    </div>`
}

function _cExFormHtml() {
  const ex  = _cEditingEx
  const inp = `background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:12px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box;width:100%`
  const lbl = `font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px`
  return `
    <div style="background:#0C0C0C;border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px">
      <div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:12px">
        ${ex ? 'Editar ejercicio' : 'Nuevo ejercicio'}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label style="${lbl}">Nombre</label>
          <input id="cx-ex-name" type="text" value="${ex?.name || ''}" placeholder="Ej: Press banca" style="${inp}">
        </div>
        <div class="form-row">
          <div>
            <label style="${lbl}">Tipo</label>
            <select id="cx-ex-type" style="${inp}">
              <option value="fuerza"${(ex?.type||'fuerza')==='fuerza'?' selected':''}>🏋️ Fuerza</option>
              <option value="cardio"${ex?.type==='cardio'?' selected':''}>🏃 Cardio</option>
              <option value="peso_corporal"${ex?.type==='peso_corporal'?' selected':''}>🤸 Peso corporal</option>
            </select>
          </div>
          <div>
            <label style="${lbl}">Músculo / grupo</label>
            <input id="cx-ex-muscle" type="text" value="${ex?.muscle_group || ''}" placeholder="Ej: Pecho" style="${inp}">
          </div>
        </div>
        <div class="btn-row" style="margin-top:0">
          <button class="btn-cancel" onclick="cuerpoCloseExForm()">Cancelar</button>
          <button class="btn-save" onclick="cuerpoSaveExercise()">${ex ? 'Guardar cambios' : 'Crear ejercicio'}</button>
        </div>
      </div>
    </div>`
}

function cuerpoOpenExForm()  { _cExForm = true; _cEditingEx = null; _cRenderTab(); setTimeout(() => document.getElementById('cx-ex-name')?.focus(), 50) }
function cuerpoCloseExForm() { _cExForm = false; _cEditingEx = null; _cRenderTab() }

function cuerpoEditEx(id) {
  _cEditingEx = _cEjercicios.find(e => e.id === id) || null
  _cExForm = true
  _cRenderTab()
  setTimeout(() => document.getElementById('cx-ex-name')?.focus(), 50)
}

async function cuerpoSaveExercise() {
  const name        = document.getElementById('cx-ex-name')?.value.trim()
  const type        = document.getElementById('cx-ex-type')?.value
  const muscle_group = document.getElementById('cx-ex-muscle')?.value.trim() || null
  if (!name) { showToast('⚠️ Escribe el nombre'); return }

  if (_cEditingEx) {
    const { error } = await SB_P.from('exercises').update({ name, type, muscle_group }).eq('id', _cEditingEx.id)
    if (error) { showToast('❌ ' + error.message); return }
    showToast('✅ Ejercicio actualizado')
  } else {
    const id = 'ex_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
    const { error } = await SB_P.from('exercises')
      .insert({ id, user_id: USER_ID, name, type, muscle_group, is_active: true, sort_order: _cEjercicios.length + 1 })
    if (error) { showToast('❌ ' + error.message); return }
    showToast('✅ Ejercicio creado')
  }
  _cExForm = false; _cEditingEx = null
  await _cLoadEjercicios()
  _cRenderTab()
}

async function cuerpoDeactivateEx(id) {
  if (!confirm('¿Desactivar este ejercicio?')) return
  const { error } = await SB_P.from('exercises').update({ is_active: false }).eq('id', id)
  if (error) { showToast('❌ ' + error.message); return }
  showToast('✅ Desactivado')
  await _cLoadEjercicios()
  _cRenderTab()
}

// ─── TAB: REGISTRO DE HOY ────────────────────────────────────────────────────
function _cRenderRegistro(el) {
  const date = _cDate()
  const inp  = `background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:12px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box`
  const lbl  = `font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px`

  // Agrupar logs por ejercicio
  const grupos = {}
  _cWorkoutLogs.forEach(l => {
    if (!grupos[l.exercise_id]) grupos[l.exercise_id] = { ex: _cEjercicios.find(e => e.id === l.exercise_id) || null, logs: [] }
    grupos[l.exercise_id].logs.push(l)
  })

  const loggedHtml = Object.keys(grupos).length === 0
    ? `<div class="empty-state" style="padding:1.5rem 0"><div class="empty-icon" style="font-size:1.5rem">📋</div>Sin series ${date === TODAY ? 'hoy' : 'ese día'}.</div>`
    : Object.entries(grupos).map(([exId, { ex, logs }]) => {
        const isCardio = ex?.type === 'cardio'
        const filas = logs.map(l => {
          const det = isCardio
            ? [l.duration_min != null ? l.duration_min + ' min' : null, l.distance_km != null ? l.distance_km + ' km' : null].filter(Boolean).join(' · ')
            : [`Serie ${l.set_number}`, l.reps ? l.reps + ' reps' : null, l.weight != null ? l.weight + ' kg' : null].filter(Boolean).join(' · ')
          return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="flex:1;font-size:12px;color:var(--text-muted)">${det || '—'}</span>
            ${l.notes ? `<span style="font-size:11px;color:var(--text-muted);font-style:italic">${l.notes}</span>` : ''}
            <button onclick="cuerpoDeleteLog('${l.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:2px 4px;line-height:1" title="Eliminar">✕</button>
          </div>`
        }).join('')
        return `<div style="margin-bottom:14px">
          <div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:6px;display:flex;align-items:center;gap:6px">
            <span style="width:3px;height:14px;border-radius:2px;background:var(--green);display:inline-block;flex-shrink:0"></span>
            ${ex?.name || exId}
            <span style="font-size:10px;color:var(--text-muted);font-weight:400">${logs.length} ${logs.length===1?'serie':'series'}</span>
          </div>
          ${filas}
        </div>`
      }).join('')

  // Formulario de nueva serie
  const selectedObj  = _cSelectedEx ? _cEjercicios.find(e => e.id === _cSelectedEx) : null
  const isCardioSel  = selectedObj?.type === 'cardio'
  const exOptions    = `<option value="">Selecciona ejercicio…</option>` +
    _cEjercicios.map(e => `<option value="${e.id}"${_cSelectedEx===e.id?' selected':''}>${e.name} — ${_cTypeLabel[e.type]||e.type}</option>`).join('')

  const setFormHtml = (_cAddingSet && selectedObj) ? `
    <div style="background:#0C0C0C;border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:10px">
      ${isCardioSel ? `
        <div class="form-row" style="margin-bottom:8px">
          <div><label style="${lbl}">Duración (min)</label><input id="cx-set-dur" type="number" min="1" placeholder="45" style="${inp};width:100%"></div>
          <div><label style="${lbl}">Distancia (km)</label><input id="cx-set-dist" type="number" step="0.1" min="0" placeholder="5.0" style="${inp};width:100%"></div>
        </div>` : `
        <div class="form-row" style="margin-bottom:8px">
          <div><label style="${lbl}">Reps</label><input id="cx-set-reps" type="number" min="1" placeholder="10" style="${inp};width:100%"></div>
          <div><label style="${lbl}">Peso (kg)</label><input id="cx-set-wt" type="number" step="0.5" min="0" placeholder="60" style="${inp};width:100%"></div>
        </div>`}
      <input id="cx-set-notes" type="text" placeholder="Notas opcionales" style="${inp};width:100%;margin-bottom:8px">
      <div class="btn-row" style="margin-top:0">
        <button class="btn-cancel" onclick="cuerpoCloseSetForm()">Cancelar</button>
        <button class="btn-save" onclick="cuerpoSaveSet()">Guardar serie ✓</button>
      </div>
    </div>` : ''

  el.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">📋 Sesión — ${date === TODAY ? 'hoy' : date}</div>
      ${loggedHtml}
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:12px">➕ Agregar serie</div>
      ${_cEjercicios.length === 0
        ? `<div style="font-size:12px;color:var(--text-muted)">Primero crea ejercicios en la pestaña "Mis ejercicios".</div>`
        : `<select id="cx-reg-ex" onchange="cuerpoSelectEx(this.value)" style="${inp};width:100%">${exOptions}</select>
           ${!_cAddingSet && _cSelectedEx
             ? `<button class="btn-add" style="margin-top:10px;width:100%;justify-content:center" onclick="cuerpoOpenSetForm()">+ Agregar serie</button>`
             : ''}
           ${setFormHtml}`}
    </div>`
}

function cuerpoSelectEx(id) { _cSelectedEx = id || null; _cAddingSet = false; _cRenderTab() }
function cuerpoOpenSetForm() {
  _cAddingSet = true; _cRenderTab()
  setTimeout(() => {
    ;(document.getElementById('cx-set-reps') || document.getElementById('cx-set-dur'))?.focus()
  }, 50)
}
function cuerpoCloseSetForm() { _cAddingSet = false; _cRenderTab() }

async function cuerpoSaveSet() {
  if (!_cSelectedEx) return
  const date    = _cDate()
  const exObj   = _cEjercicios.find(e => e.id === _cSelectedEx)
  const isCardio = exObj?.type === 'cardio'
  const notes   = document.getElementById('cx-set-notes')?.value.trim() || null
  const prevSets = _cWorkoutLogs.filter(l => l.exercise_id === _cSelectedEx)

  const payload = {
    id: 'wl_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    user_id: USER_ID, exercise_id: _cSelectedEx, date,
    set_number: isCardio ? null : prevSets.length + 1,
    notes, created_at: new Date().toISOString()
  }

  if (isCardio) {
    const dur  = parseFloat(document.getElementById('cx-set-dur')?.value)
    const dist = parseFloat(document.getElementById('cx-set-dist')?.value)
    if (isNaN(dur) && isNaN(dist)) { showToast('⚠️ Ingresa duración o distancia'); return }
    payload.duration_min = isNaN(dur)  ? null : dur
    payload.distance_km  = isNaN(dist) ? null : dist
  } else {
    const reps   = parseInt(document.getElementById('cx-set-reps')?.value)
    const weight = parseFloat(document.getElementById('cx-set-wt')?.value)
    if (!reps) { showToast('⚠️ Ingresa las reps'); return }
    payload.reps   = reps
    payload.weight = isNaN(weight) ? null : weight
  }

  const { error } = await SB_P.from('workout_logs').insert(payload)
  if (error) { showToast('❌ ' + error.message); return }
  showToast('✅ Serie guardada')
  _cAddingSet = false
  await _cLoadWorkoutLogs()
  _cRefreshStats()
  _cRenderTab()
}

async function cuerpoDeleteLog(id) {
  const { error } = await SB_P.from('workout_logs').delete().eq('id', id)
  if (error) { showToast('❌ ' + error.message); return }
  showToast('🗑️ Serie eliminada')
  await _cLoadWorkoutLogs()
  _cRefreshStats()
  _cRenderTab()
}

// ─── TAB: MÉTRICAS ───────────────────────────────────────────────────────────
function _cRenderMetricas(el) {
  const m   = _cTodayMetric
  const inp = `background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box;width:100%`
  const lbl = `font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px`

  el.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <div class="card-title">📊 Registro de hoy</div>
      <div class="form-row" style="margin-bottom:10px">
        <div><label style="${lbl}">Peso (kg)</label><input id="cx-m-wt" type="number" step="0.1" min="30" max="300" value="${m?.weight_kg ?? ''}" placeholder="75.5" style="${inp}"></div>
        <div><label style="${lbl}">Sueño (h)</label><input id="cx-m-sl" type="number" step="0.5" min="0" max="24" value="${m?.sleep_hours ?? ''}" placeholder="7.5" style="${inp}"></div>
      </div>
      <div style="margin-bottom:10px">
        <label style="${lbl}">% Grasa corporal <span style="font-size:10px;color:var(--text-muted)">(opcional)</span></label>
        <input id="cx-m-fat" type="number" step="0.1" min="3" max="60" value="${m?.body_fat_pct ?? ''}" placeholder="15.0" style="${inp}">
      </div>
      <div style="margin-bottom:12px">
        <label style="${lbl}">Notas</label>
        <input id="cx-m-notes" type="text" value="${m?.notes || ''}" placeholder="Cómo te sentiste…" style="${inp}">
      </div>
      <button class="btn-save" style="width:100%;padding:11px" onclick="cuerpoSaveMetric()">
        ${m ? 'Actualizar registro' : 'Guardar registro'}
      </button>
    </div>

    <div class="card">
      <div class="card-title">📈 Peso — últimos 14 días</div>
      ${_cSparkline()}
    </div>`
}

function _cSparkline() {
  if (!_cMetricHist.length) {
    return `<div class="empty-state" style="padding:1rem 0"><div class="empty-icon">📉</div>Sin datos de peso aún.</div>`
  }
  const weights = _cMetricHist.map(r => r.weight_kg).filter(w => w != null)
  if (!weights.length) return `<div style="color:var(--text-muted);font-size:12px">Sin datos de peso.</div>`

  const min   = Math.min(...weights)
  const max   = Math.max(...weights)
  const range = max - min || 1

  const bars = _cMetricHist.map(r => {
    if (r.weight_kg == null) return `<div style="flex:1;height:4px;background:var(--border);border-radius:2px;align-self:flex-end"></div>`
    const h     = Math.round(((r.weight_kg - min) / range) * 48) + 6
    const color = r.date === TODAY ? 'var(--gold)' : 'var(--green)'
    return `<div title="${r.date}: ${r.weight_kg} kg" style="flex:1;background:${color};border-radius:2px 2px 0 0;height:${h}px;transition:height .2s;opacity:${r.date===TODAY?'1':'0.55'}"></div>`
  }).join('')

  const histRows = [..._cMetricHist].reverse().map(r => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px">
      <span style="color:var(--text-muted)">${r.date}</span>
      <span style="color:${r.date===TODAY?'var(--gold)':'var(--text-dim)'};font-weight:${r.date===TODAY?'600':'400'}">${r.weight_kg} kg</span>
    </div>`).join('')

  return `
    <div style="display:flex;align-items:flex-end;gap:3px;height:60px;margin-bottom:6px">${bars}</div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:12px">
      <span>${_cMetricHist[0]?.date?.slice(5) || ''}</span>
      <span style="color:var(--text-dim);font-size:11px">${min === max ? min + ' kg' : min + ' – ' + max + ' kg'}</span>
      <span>${_cMetricHist[_cMetricHist.length-1]?.date?.slice(5) || ''}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:0;max-height:200px;overflow-y:auto">${histRows}</div>`
}

async function cuerpoSaveMetric() {
  const date      = _cDate()
  const weight_kg = parseFloat(document.getElementById('cx-m-wt')?.value)
  const sleep_h   = parseFloat(document.getElementById('cx-m-sl')?.value)
  const fat_pct   = parseFloat(document.getElementById('cx-m-fat')?.value)
  const notes     = document.getElementById('cx-m-notes')?.value.trim() || null

  if (isNaN(weight_kg) && isNaN(sleep_h)) { showToast('⚠️ Ingresa al menos peso o sueño'); return }

  const payload = {
    user_id: USER_ID, date,
    weight_kg:    isNaN(weight_kg) ? null : weight_kg,
    sleep_hours:  isNaN(sleep_h)   ? null : sleep_h,
    body_fat_pct: isNaN(fat_pct)   ? null : fat_pct,
    notes
  }

  if (_cTodayMetric) {
    const { error } = await SB_P.from('body_metrics').update(payload).eq('id', _cTodayMetric.id)
    if (error) { showToast('❌ ' + error.message); return }
  } else {
    payload.id = 'bm_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
    const { error } = await SB_P.from('body_metrics').insert(payload)
    if (error) { showToast('❌ ' + error.message); return }
  }

  showToast('✅ Métricas guardadas')
  await _cLoadBodyMetrics()
  _cRefreshStats()
  _cRenderTab()
}

// ─── ACTUALIZAR STATS SIN RE-RENDER TOTAL ────────────────────────────────────
function _cRefreshStats() {
  const pesoHoy  = _cTodayMetric?.weight_kg
  const series   = _cWorkoutLogs.length
  const exUnicas = new Set(_cWorkoutLogs.map(l => l.exercise_id)).size
  const ep = document.getElementById('cx-stat-peso')
  const es = document.getElementById('cx-stat-series')
  const ee = document.getElementById('cx-stat-exs')
  if (ep) { ep.textContent = pesoHoy != null ? pesoHoy + ' kg' : '—'; ep.className = 'stat-num' + (pesoHoy ? ' green' : '') }
  if (es) { es.textContent = series;   es.className = 'stat-num' + (series   > 0 ? ' green' : '') }
  if (ee)   ee.textContent = exUnicas
}
