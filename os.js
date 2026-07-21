const { createClient } = supabase

const SB_P = createClient(
  'https://gpfidxxawcwsbuzsbeob.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZmlkeHhhd2N3c2J1enNiZW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjgxOTksImV4cCI6MjA4ODMwNDE5OX0.i96CvvseJCPSvEveUCx2FWECNKEuWHj51EP_3b2mCkc'
)

const SB_I = createClient(
  'https://ktmiurbvgewuwkzkqitj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bWl1cmJ2Z2V3dXdremtxaXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NTc5NzAsImV4cCI6MjA5NDEzMzk3MH0.5A7CyvnVmlYJQp2L_naMuW8n7quIdbEq8kL5hHbVSoY'
)

const CATS = {
  iarcania: { label:'IArcanIA', color:'#E24B4A' },
  contenido: { label:'Contenido', color:'#378ADD' },
  proyectos: { label:'Proyectos', color:'#8B6CF6' },
  personal:  { label:'Personal',  color:'#5DCAA5' },
  infra:     { label:'Infraestructura', color:'#EF9F27' },
  habitos:   { label:'Hábitos',   color:'#555050' },
}

let USER_ID = null
let USER_ROLE = null
let USER_NAME = null
let PARTNER_ID = null
let PARTNER_NAME = null
let USER_PASSWORD = null
let allTasks   = []
let _taskFilter = { tiempo: 'todas', cat: '' }
let _taskSectionsInited = false
let _showArchived = false
let hoyFocusItems      = []  // filas de daily_focus para TODAY con list_type='hoy'
let extraFocusItems    = []  // filas de daily_focus para TODAY con list_type='extra'
let trabajoFocusItems  = []  // filas de daily_focus para TODAY con list_type='trabajo'
let _quickCreateType = null  // 'task' | 'cita' | null — mini-form de creación inline en panel de hoy
let allBirthdays = []
let allClients = []
let allBooks = []
let allScripts = []
let allBrands  = []
let activeBookId = null
let activeBookTab = 'capitulos'
let expandedChapters = {}
const CHAR_ROLE_COLORS = { protagonista:'#c9a84c', antagonista:'#E24B4A', secundario:'#8B6CF6', otro:'#8a86b0' }
let activeScriptId = null
let scriptsFilter  = 'all'
let scriptsVista      = 'lista'
let publicarScriptId  = null
let _scriptModo    = {}
let _scriptStep    = {}
let _scriptGen     = {}
let _scriptInputs  = {}
let _editorModo    = {}
let _scriptLibre   = {}
let _scriptBloques = {}

// --- AUTH ---
async function doLogin(){
  const email = document.getElementById('auth-email').value.trim()
  const pass  = document.getElementById('auth-pass').value
  const errEl = document.getElementById('auth-error')
  const btn   = document.getElementById('login-btn')
  errEl.style.display = 'none'
  if(!email || !pass){ errEl.textContent='Completa email y contraseña'; errEl.style.display='block'; return }
  btn.textContent = 'Entrando...'
  btn.disabled = true
  try {
    const { data, error } = await SB_P.auth.signInWithPassword({ email, password: pass })
    if(error){ throw new Error(error.message) }
    await loadCurrentUserSlug()
    if(!USER_ID){ throw new Error('Usuario no encontrado en el sistema. Contacta al administrador.') }
    USER_PASSWORD = pass
    sessionStorage.setItem('_up', btoa(pass))
    document.getElementById('auth-screen').style.display = 'none'
    document.getElementById('app').style.display = 'block'
    try { await SB_I.auth.signInWithPassword({ email, password: pass }) } catch(e){}
    initApp()
  } catch(e) {
    errEl.textContent = e.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : (e.message || 'Error de conexión')
    errEl.style.display='block'
    btn.textContent = 'Entrar'
    btn.disabled = false
  }
}

async function doLogout(){
  await SB_P.auth.signOut()
  await SB_I.auth.signOut()
  location.reload()
}

// Resuelve el slug de dominio ('u1', 'u2', ...) a partir del auth_id de Supabase Auth.
// Asigna USER_ID al slug; lo deja null si no hay mapeo (usuario nuevo o no registrado).
async function loadCurrentUserSlug() {
  const { data: { user } } = await SB_P.auth.getUser()
  console.log('[DEBUG auth] user:', user)
  if (!user) { USER_ID = null; return }

  const { data, error } = await SB_P
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .single()
  console.log('[DEBUG users query] data:', data, 'error:', error)

  if (error || !data) {
    console.error('[loadCurrentUserSlug] Sin mapeo para auth_id:', user.id)
    USER_ID = null
    return
  }

  USER_ID = data.id // 'u1', 'u2', etc.
  USER_ROLE = data.role

  if (data.name) {
    USER_NAME = data.name
    document.getElementById('user-name').textContent = data.name
    document.getElementById('greeting-title').textContent = `Buen día, ${data.name}`
  }

  const { data: partner } = await SB_P
    .from('users')
    .select('id, name')
    .neq('id', USER_ID)
    .maybeSingle()
  if (partner) {
    PARTNER_ID = partner.id
    PARTNER_NAME = partner.name
  }

  applyRoleRestrictions(data.role)
}

function applyRoleRestrictions(role) {
  const hide = (...ids) => ids.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.style.display = 'none'
  })

  if (role === 'admin' || role === 'employee') {
    const btnNuevo = document.getElementById('btn-nuevo-recurso')
    if (btnNuevo) btnNuevo.style.display = 'block'
  }

  if (role === 'admin') {
    // admin ve todo — sin restricciones
  } else if (role === 'employee') {
    hide('nav-escuela')
  } else if (role === 'family') {
    hide('nav-trabajo')
    hide('nav-sep-dinero', 'group-dinero')
    hide('nav-libros', 'nav-guiones', 'nav-slides')
    hide('nav-workspace', 'nav-escuela', 'nav-recursos')
  } else if (role === 'cliente' || role === 'estudiante') {
    hide('nav-trabajo', 'nav-sep-dinero', 'group-dinero', 'nav-libros', 'nav-guiones', 'nav-slides', 'nav-escuela', 'nav-workspace')
    const main = document.getElementById('main-content') || document.querySelector('.main') || document.body
    const banner = document.createElement('div')
    banner.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a0f;gap:16px;font-family:Outfit,sans-serif'
    banner.innerHTML = `<div style="font-size:32px">🎓</div><div style="font-size:18px;font-weight:600;color:#f1f0f7">Tu espacio es la Escuela</div><div style="font-size:14px;color:#9896b0">Este panel es para uso interno del equipo.</div><a href="/escuela.html" style="margin-top:8px;padding:10px 24px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">Ir a IArcanIA Escuela →</a>`
    document.body.appendChild(banner)
  } else {
    // rol desconocido — misma red de seguridad que cliente/estudiante
    hide('nav-escuela')
  }
}

document.getElementById('auth-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin() })

// --- MIDNIGHT RESET ---
async function checkDateReset(){
  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const saved = localStorage.getItem('last_date')
  console.log('last_date:', saved, 'TODAY:', now)
  if(saved && saved !== now){
    localStorage.setItem('tareas_hoy_ayer', JSON.stringify(hoyFocusItems.map(x => x.task_id)))
    habitLogs = {}
    loadHabitos()
    loadTasks()
    loadTareasHoy()
    showToast('☀️ Nuevo día')
  }
  localStorage.setItem('last_date', now)
}

// --- INIT ---
async function initApp(){
  const _initHash = location.hash.replace('#','')
  history.replaceState({section: _initHash || 'rutinas'}, '', '#'+ (_initHash || 'rutinas'))
  setDate()
  updateClock()
  setInterval(updateClock, 1000)
  checkDateReset()
  setInterval(checkDateReset, 60000)
  setInterval(() => { if(document.getElementById('section-agenda')?.classList.contains('active')) renderAgenda() }, 60000)
  await loadTareasHoy() // primero: hoyFocusItems disponible antes de cualquier render
  // Carga esencial — bloquea hasta tener lo necesario para el dashboard inicial
  await Promise.all([loadTasks(), loadBirthdays(), loadHabitos(), loadCitas(), loadAgendaForDate(getAgendaDateStr())])
  renderTasks()
  // Carga diferida — no bloquea el render inicial
  setTimeout(() => Promise.all([loadIdeas(), loadClients(), loadEventos(), loadBooks(), loadScripts(), loadClientesDashboard(), loadPersonas(), loadFacturas()]), 300)
  loadTimerFromStorage()
  _migrateLocalAgendaToSupabase()
  initModoEmergencia()
  // Restaurar sección al refrescar
  if(_initHash && _initHash !== 'rutinas'){
    const btn = document.querySelector(`.nav-item[onclick*="'${_initHash}'"]`)
    if(btn) showSection(_initHash, btn)
  }
}

document.addEventListener('visibilitychange', () => {
  if(document.hidden && _timer.running) pausarTimer()
})

function setDate(){
  const d = new Date()
  const fecha = d.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const elFull = document.getElementById('today-date')
  const elShort = document.getElementById('today-date-short')
  if(elFull) elFull.textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1)
  if(elShort) elShort.textContent = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function updateClock(){
  const el = document.getElementById('dashboard-clock')
  if(!el) return
  const d = new Date()
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = (h % 12) || 12
  console.log('clock:', h12, ampm)
  el.textContent = h12 + ':' + m + ' ' + ampm
}

// --- NAV ---
// ─── MODOS DE EMERGENCIA ──────────────────────────────────────────────────────

const MODO_ENFERMO_IDS  = ['a09','a13','a75']        // Cama, Agua, Séneca noche
const MODO_MEDIANO_IDS  = ['a75']                     // extra nocturna: Diario intros → a08
const MODO_MEDIANO_NOCHE = ['a08']

function toggleModoEmergenciaPanel(){
  const p = document.getElementById('modo-emergencia-panel')
  p.style.display = p.style.display === 'none' ? 'block' : 'none'
}

function setModoEmergencia(modo){
  document.getElementById('modo-emergencia-panel').style.display = 'none'
  if(modo) localStorage.setItem('modo_emergencia', modo)
  else localStorage.removeItem('modo_emergencia')
  applyModoEmergencia(modo)
}

function applyModoEmergencia(modo){
  const btn = document.getElementById('modo-emergencia-btn')
  // Ocultar secciones de modo
  ;['section-modo-enfermo','section-modo-mediano'].forEach(id => {
    const el = document.getElementById(id)
    if(el){ el.style.display = 'none'; el.classList.remove('active') }
  })
  const rutinas = document.getElementById('section-rutinas')

  if(!modo){
    if(btn){ btn.textContent = '¿Estás bien hoy?'; btn.style.color = 'var(--text-muted)'; btn.style.borderColor = 'rgba(255,255,255,0.1)' }
    if(rutinas){ rutinas.style.display = ''; rutinas.classList.add('active') }
    return
  }

  // Activar modo
  const sectionId = modo === 'enfermo' ? 'section-modo-enfermo' : 'section-modo-mediano'
  if(rutinas){ rutinas.classList.remove('active'); rutinas.style.display = 'none' }
  const sec = document.getElementById(sectionId)
  if(sec){ sec.style.display = ''; sec.classList.add('active') }

  if(modo === 'enfermo'){
    btn.textContent = '🤒 Modo enfermo'; btn.style.color = '#E24B4A'; btn.style.borderColor = 'rgba(226,75,74,0.4)'
    renderModoEmergenciaBody('modo-enfermo-body', MODO_ENFERMO_IDS, '#E24B4A')
  } else {
    btn.textContent = '⚡ Modo mínimo'; btn.style.color = '#EF9F27'; btn.style.borderColor = 'rgba(239,159,39,0.4)'
    const despertar = allActivities.filter(a => a.category === 'despertar' && a.is_active).map(a => a.id)
    const ritual    = allActivities.filter(a => a.category === 'ritual_2020' && a.is_active).map(a => a.id)
    const noche     = MODO_MEDIANO_NOCHE
    renderModoMedianoBody(despertar, ritual, noche)
  }
}

function renderModoEmergenciaBody(containerId, ids, color){
  const el = document.getElementById(containerId)
  if(!el) return
  const acts = ids.map(id => allActivities.find(a => a.id === id)).filter(Boolean)
  el.innerHTML = acts.map(a => {
    const done = !!habitLogs[a.id]
    return `<div class="ritual-item${done?' done':''}" onclick="toggleHabito('${a.id}');applyModoEmergencia(localStorage.getItem('modo_emergencia'))" style="margin-bottom:4px">
      <div class="ritual-check${done?' done':''}" style="${done?`background:${color};border-color:${color};color:#000`:`border-color:${color}44`}">${done?'✓':''}</div>
      <span class="ritual-label">${a.name}</span>
    </div>`
  }).join('')
}

function renderModoMedianoBody(despertarIds, ritualIds, nocheIds){
  const el = document.getElementById('modo-mediano-body')
  if(!el) return
  const section = (label, ids, color) => {
    const acts = ids.map(id => allActivities.find(a => a.id === id)).filter(Boolean)
    if(!acts.length) return ''
    const items = acts.map(a => {
      const done = !!habitLogs[a.id]
      return `<div class="ritual-item${done?' done':''}" onclick="toggleHabito('${a.id}');applyModoEmergencia('mediano')" style="margin-bottom:4px">
        <div class="ritual-check${done?' done':''}" style="${done?`background:${color};border-color:${color};color:#000`:`border-color:${color}44`}">${done?'✓':''}</div>
        <span class="ritual-label">${a.name}</span>
      </div>`
    }).join('')
    return `<div style="font-size:11px;font-weight:600;color:${color};margin:10px 0 6px">${label}</div>${items}`
  }
  el.innerHTML =
    section('🌅 Despertar', despertarIds, '#FFD166') +
    section('🔄 20/20/20',  ['a35','a02','a14'], '#00C2FF') +
    section('🌙 Noche',     nocheIds, '#378ADD')
}

function initModoEmergencia(){
  const saved = localStorage.getItem('modo_emergencia')
  if(saved) applyModoEmergencia(saved)
}

// ─────────────────────────────────────────────────────────────────────────────

function navTo(section){
  const btn = document.querySelector(`.nav-item[onclick*="'${section}'"]`)
  if(btn) showSection(section, btn)
}
function showSection(id, btn){
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'))
  document.getElementById('section-'+id).classList.add('active')
  btn.classList.add('active')
  if(id === 'agenda') loadAndRenderAgenda()
  if(id === 'rachas') renderRachas()
  if(id === 'gestion-habitos') renderGestionHabitos()
  if(id === 'hogar') loadHogar()
  if(id === 'citas') loadCitas()
  if(id === 'trabajo'){ loadProyectoDia(); renderTrabajoDash() }
  if(id === 'libros') loadBooks()
  if(id === 'guiones') loadScripts()
  if(id === 'slides') onSlidesEnter()
  if(id === 'escuela') loadEscAdmin()
  if(id === 'recursos') loadRecursos()
  if(id === 'actividades') initTaskSections()
  if(id === 'eventos') { if(allEventTypes.length) renderEventos(); else loadEventos().then(() => renderEventos()) }
  if(id === 'personas') { if(allPeople.length) renderPersonas(); else loadPersonas().then(() => renderPersonas()) }
  if(id === 'dinero') switchDineroTab(_dineroTab)
  if(id === 'clientes') loadClientesDashboard()
  if(id === 'cuerpo') loadCuerpo()
  if(id === 'habitos' && selectedDate !== TODAY){ selectedDate = TODAY; loadHabitos() }
  if(window.innerWidth <= 768) closeSidebar()
  if(!_isPopState) history.pushState({section: id}, '', '#'+id)
}

function toggleSidebar(){ document.getElementById('sidebar').classList.toggle('open') }

window.addEventListener('popstate', e => {
  const section = e.state?.section
  if(!section) return
  const btn = document.querySelector(`.nav-item[onclick*="'${section}'"]`)
  if(!btn) return
  _isPopState = true
  showSection(section, btn)
  _isPopState = false
})
;(function(){
  let _tx = 0
  document.addEventListener('touchstart', e => { _tx = e.touches[0].clientX }, { passive: true })
  document.addEventListener('touchend', e => {
    if(window.innerWidth > 900) return
    const dx = e.changedTouches[0].clientX - _tx
    const sb = document.getElementById('sidebar')
    if(dx > 50 && !sb.classList.contains('open'))  sb.classList.add('open')
    if(dx < -50 && sb.classList.contains('open'))  sb.classList.remove('open')
  }, { passive: true })
})()
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open') }
function toggleNavGroup(name){
  const group=document.getElementById('group-'+name)
  const sep=group.previousElementSibling
  const collapsed=group.classList.toggle('collapsed')
  sep.classList.toggle('collapsed',collapsed)
  localStorage.setItem('sidebar_collapsed_'+name,collapsed?'1':'0')
}
;(function initNavGroups(){
  ['dashboards','diaadia','personal','dinero','creativo'].forEach(name=>{
    if(localStorage.getItem('sidebar_collapsed_'+name)==='1'){
      const group=document.getElementById('group-'+name)
      if(group){group.classList.add('collapsed');group.previousElementSibling.classList.add('collapsed')}
    }
  })
})()

// --- SECCIÓN DINERO ---
const DINERO_TABS = ['cuentas','gastos','facturas','escanear','cobros']
let _dineroTab = 'cuentas'
let _isPopState = false

function switchDineroTab(tab){
  _dineroTab = tab
  DINERO_TABS.forEach(t => {
    document.getElementById('dinero-tab-'+t).style.display = t === tab ? 'block' : 'none'
    const btn = document.getElementById('dtab-'+t)
    if(btn) btn.classList.toggle('active', t === tab)
  })
  const actions = document.getElementById('dinero-tab-actions')
  if(actions){
    if(tab === 'gastos')   actions.innerHTML = `<button class="btn-add" onclick="openModalGasto()">+ Nuevo gasto</button>`
    else if(tab === 'facturas') actions.innerHTML = `<button class="btn-add" onclick="openModal('nueva-factura')">+ Nueva factura</button>`
    else if(tab === 'cobros')   actions.innerHTML = `<button class="btn-add" onclick="openModal('payment')">+ Registrar cobro</button>`
    else actions.innerHTML = ''
  }
  if(tab === 'cuentas')  loadFinanzas()
  if(tab === 'gastos')   loadExpenses()
  if(tab === 'facturas') loadFacturas()
  if(tab === 'cobros')   loadPayments()
}

// --- TASKS ---
async function loadTasks(){
  const { data } = await SB_P.from('tasks').select('*').order('priority')
  allTasks = data || []
  renderTasks()
}

async function loadTareasHoy(){
  const { data } = await SB_P.from('daily_focus')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('date', TODAY)
    .order('sort_order', { ascending: true })
  const all = data || []
  hoyFocusItems      = all.filter(x => !x.list_type || x.list_type === 'hoy')
  extraFocusItems    = all.filter(x => x.list_type === 'extra')
  trabajoFocusItems  = all.filter(x => x.list_type === 'trabajo')
  renderTasks()
}

function toggleTaskSection(id){
  const body = document.getElementById('body-'+id)
  const icon = document.getElementById('icon-'+id)
  if(!body || !icon) return
  const collapsing = !icon.classList.contains('collapsed')
  if(collapsing){
    body.style.maxHeight = body.scrollHeight + 'px'
    requestAnimationFrame(() => { body.style.maxHeight = '0' })
    icon.classList.add('collapsed')
    localStorage.setItem('tasks_collapsed_'+id, '1')
  } else {
    body.style.maxHeight = body.scrollHeight + 'px'
    icon.classList.remove('collapsed')
    setTimeout(() => { body.style.maxHeight = 'none' }, 220)
    localStorage.removeItem('tasks_collapsed_'+id)
  }
}

function initTaskSections(){
  const defaults = { fecha: false, overdue: true }
  Object.keys(defaults).forEach(id => {
    const saved = localStorage.getItem('tasks_collapsed_'+id)
    const collapsed = saved !== null ? saved === '1' : defaults[id]
    const icon = document.getElementById('icon-'+id)
    const body = document.getElementById('body-'+id)
    if(!body) return
    if(collapsed){ icon?.classList.add('collapsed'); body.style.maxHeight = '0' }
    else { icon?.classList.remove('collapsed'); body.style.maxHeight = 'none' }
  })
}

function setTaskFilter(tiempo){
  _taskFilter.tiempo = tiempo
  ;['todas','hoy','semana'].forEach(t => {
    document.getElementById('tf-'+t)?.classList.toggle('active', t === tiempo)
  })
  applyTaskFilters()
}

function setTaskCatFilter(cat){
  _taskFilter.cat = cat
  const sel = document.getElementById('tf-cat')
  if(sel) sel.style.color = cat ? '#e8e8e8' : '#888'
  applyTaskFilters()
}

function limpiarFiltros(){
  _taskFilter = { tiempo: 'todas', cat: '' }
  document.getElementById('tf-todas')?.classList.add('active')
  document.getElementById('tf-hoy')?.classList.remove('active')
  document.getElementById('tf-semana')?.classList.remove('active')
  const sel = document.getElementById('tf-cat')
  if(sel){ sel.value = ''; sel.style.color = '#888' }
  applyTaskFilters()
}

function applyTaskFilters(){
  const { tiempo, cat } = _taskFilter
  const weekEnd = new Date(TODAY); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().split('T')[0]
  ;['tareas-con-fecha','overdue-tasks','all-tasks'].forEach(listId => {
    const list = document.getElementById(listId)
    if(!list) return
    list.querySelectorAll('.task-item').forEach(item => {
      const tid = item.getAttribute('data-id')
      const task = tid ? allTasks.find(t => t.id === tid) : null
      let show = true
      if(task){
        if(tiempo === 'hoy') show = task.due_date === TODAY
        else if(tiempo === 'semana') show = !!(task.due_date && task.due_date >= TODAY && task.due_date <= weekEndStr)
        if(cat && task.category !== cat) show = false
      }
      item.style.display = show ? '' : 'none'
    })
  })
  ;[['tareas-con-fecha-wrap','tareas-con-fecha'],['overdue-wrap','overdue-tasks']].forEach(([wid,lid]) => {
    const wrap = document.getElementById(wid)
    const list = document.getElementById(lid)
    if(!wrap || !list) return
    const total = list.querySelectorAll('.task-item').length
    if(!total) return
    let visible = 0
    list.querySelectorAll('.task-item').forEach(i => { if(i.style.display !== 'none') visible++ })
    wrap.style.display = visible > 0 ? 'block' : 'none'
  })
  const hasFilter = _taskFilter.tiempo !== 'todas' || !!_taskFilter.cat
  const lBtn = document.getElementById('tf-limpiar')
  if(lBtn) lBtn.style.display = hasFilter ? 'inline-block' : 'none'
}

function updateCatDropdown(){
  const sel = document.getElementById('tf-cat')
  if(!sel) return
  const cats = new Set(allTasks.filter(t => t.status !== 'completada' && t.status !== 'archivada' && t.category).map(t => t.category))
  const cur = sel.value
  sel.innerHTML = '<option value="">Todas las categorías</option>'
  ;[...cats].sort().forEach(c => {
    const opt = document.createElement('option')
    opt.value = c; opt.textContent = CATS[c]?.label || c
    if(c === cur) opt.selected = true
    sel.appendChild(opt)
  })
}

function renderTasks(){
  const pending = allTasks.filter(t => t.status !== 'completada' && t.status !== 'archivada')
  const done    = allTasks.filter(t => t.status === 'completada')
  document.getElementById('stat-pending').textContent = pending.length
  document.getElementById('stat-done').textContent    = done.length
  // Dashboard: Mis 5 tareas
  const hoyIds   = getDashList('hoy')
  const hoyTasks = hoyIds.map(id => {
    const fi = hoyFocusItems.find(x => x.task_id === id)
    const t  = allTasks.find(t => t.id === id)
    if(t) return { ...t, _focusCompleted: fi?.completed || false, _focusNote: fi?.notes || '' }
    const c = (typeof allCitas !== 'undefined' ? allCitas : []).find(c => c.id === id)
    if(c) return { id: c.id, title: c.title, category: null, status: c.status, _isCita: true, _focusCompleted: fi?.completed || false, _focusNote: fi?.notes || '' }
    const act = (typeof allActivities !== 'undefined' ? allActivities : []).find(a => a.id === id)
    if(act) return { id: act.id, title: act.name, _isHabit: true, _habitColor: act.color || '#f97316', _focusCompleted: fi?.completed || false, _focusNote: fi?.notes || '' }
    return null
  }).filter(Boolean)
  renderDashTasksSection('dashboard-tasks', hoyTasks, 'hoy')
  renderCitasEnDashboard()
  // Dashboard: Tareas extra (daily_focus list_type='extra')
  const extraIds   = getDashList('extra')
  const extraTasks = extraIds.map(id => {
    const fi = extraFocusItems.find(x => x.task_id === id)
    const t  = allTasks.find(t => t.id === id)
    if(t) return { ...t, _focusCompleted: fi?.completed || false, _focusNote: fi?.notes || '' }
    const c = (typeof allCitas !== 'undefined' ? allCitas : []).find(c => c.id === id)
    if(c) return { id: c.id, title: c.title, category: null, status: c.status, _isCita: true, _focusCompleted: fi?.completed || false, _focusNote: fi?.notes || '' }
    const act = (typeof allActivities !== 'undefined' ? allActivities : []).find(a => a.id === id)
    if(act) return { id: act.id, title: act.name, _isHabit: true, _habitColor: act.color || '#f97316', _focusCompleted: fi?.completed || false, _focusNote: fi?.notes || '' }
    return null
  }).filter(Boolean)
  renderDashTasksSection('extra-tasks', extraTasks, 'extra')
  // Sección Tareas: lista sin vencidas + grupos especiales
  const overdue = allTasks.filter(t => t.due_date && (t.due_date||'').slice(0,10) < todayBogota() && t.status !== 'completada' && t.status !== 'hoy' && t.status !== 'archivada')
  const overdueIds = new Set(overdue.map(t => t.id))
  renderTaskList('all-tasks', allTasks.filter(t => !overdueIds.has(t.id) && t.status !== 'archivada'))
  renderArchivedTasks()
  renderOverdueTasks(overdue)
  renderTareasConFecha(allTasks)
  renderVencidas(overdue)
  const badgeOv = document.getElementById('badge-overdue')
  if(badgeOv){ badgeOv.textContent = overdue.length; badgeOv.style.display = overdue.length ? 'inline-flex' : 'none' }
  const pill = document.getElementById('overdue-count-pill')
  if(pill){ pill.textContent = overdue.length; pill.style.display = overdue.length ? 'inline-block' : 'none' }
  // Auto-expandir si hay vencidas
  if(overdue.length){
    const body = document.getElementById('body-overdue')
    const icon = document.getElementById('icon-overdue')
    if(body && body.style.maxHeight === '0px' || body?.style.maxHeight === '0'){
      body.style.maxHeight = body.scrollHeight + 'px'
      if(icon) icon.classList.remove('collapsed')
    }
    document.getElementById('overdue-wrap')?.style && (document.getElementById('overdue-wrap').style.display = 'block')
  }
  renderCatLegend()
  if(document.getElementById('section-agenda')?.classList.contains('active')) renderAgenda()
  update2020Widget()
  updateCatDropdown()
  applyTaskFilters()
  if(!_taskSectionsInited){ _taskSectionsInited = true; setTimeout(initTaskSections, 60) }
}


function renderTaskList(elId, tasks){
  const el = document.getElementById(elId)
  const ordered = applyTaskOrder(tasks)
  if(!ordered.length){ el.innerHTML = '<div class="empty-state"><div class="empty-icon">◎</div>No hay actividades todavía</div>'; return }
  el.innerHTML = ordered.map(t => {
    const cat = CATS[t.category] || CATS.habitos
    const done = t.status === 'completada'
    const hora = t.notes && /^\d{2}:\d{2}$/.test(t.notes.trim()) ? t.notes.trim() : null
    const fecha = t.due_date || null
    return `<div class="task-item${done?' done':''}"
      data-id="${t.id}"
      onclick="toggleTask('${t.id}')"
      draggable="true"
      ondragstart="onTaskDragStart(event,'${t.id}')"
      ondragover="onTaskDragOver(event)"
      ondragleave="onTaskDragLeave(event)"
      ondrop="onTaskDrop(event,'${t.id}','${elId}')"
      ondragend="onTaskDragEnd(event)"
      style="border-left-color:${done?'var(--border)':cat.color}">
      <div class="task-check" style="${done?`background:${cat.color};border-color:${cat.color}`:''}">
        ${done?'✓':''}
      </div>
      <div class="task-text">
        <div>${t.title}</div>
        ${(hora||fecha) ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${fecha?'📅 '+fecha:''}${hora?' 🕐'+hora:''}</div>` : ''}
      </div>
      <div class="task-cat" style="color:${cat.color}">${cat.label}</div>
      <button class="habito-toggle" onclick="event.stopPropagation();openEditTask('${t.id}')">✏️</button>
    </div>`
  }).join('')
}

// --- AGENDA HORARIA ---
const AGENDA_SCHEDULE = [
  { time:'03:40', label:'Despertar, cama y agua' },
  { time:'04:00', label:'Entrenamiento matutino', dur: 40 },
  { time:'04:40', label:'Baño frío' },
  { time:'05:00', label:'Meditar' },
  { time:'05:20', label:'Escritura / Diario' },
  { time:'05:40', label:'Planificación' },
  { time:'06:00', label:'Trabajo profundo' },
  { time:'10:00', label:'Tomar sol' },
  { time:'10:20', label:'Llamar familiar' },
  { time:'10:40', label:'Tareas ligeras' },
  { time:'12:00', label:'Almuerzo' },
  { time:'13:00', label:'Estudio / Ideas' },
  { time:'15:00', label:'Apoyo mamá' },
  { time:'17:00', label:'Limpieza' },
  { time:'17:20', label:'Descanso' },
  { time:'18:00', label:'Entrenamiento nocturno' },
  { time:'18:40', label:'Cenar / Estirar' },
  { time:'19:00', label:'Cenar' },
  { time:'19:20', label:'Escritura + lista hábitos' },
  { time:'19:40', label:'Skincare / Ropa' },
  { time:'20:00', label:'Dormir' },
]

let _agendaDayOffset = 0

function getAgendaDateStr(){
  const d = new Date()
  d.setDate(d.getDate() + _agendaDayOffset)
  return d.toLocaleDateString('en-CA')
}

function getAgendaKey(){ return 'agenda_' + getAgendaDateStr() }

function navAgenda(delta){ _agendaDayOffset += delta; loadAndRenderAgenda() }
function goAgendaToday(){ _agendaDayOffset = 0; loadAndRenderAgenda() }
function jumpAgendaToDate(dateStr){
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr + 'T00:00:00')
  _agendaDayOffset = Math.round((target - today) / 86400000)
  loadAndRenderAgenda()
}
let _agendaCache = {}
let _agendaCacheDate = null

function _parseLocalAgenda(dateStr){
  const raw = JSON.parse(localStorage.getItem('agenda_'+dateStr) || '{}')
  const out = {}
  Object.entries(raw).forEach(([k, v]) => {
    const parts = k.split(':').map(Number)
    if(parts.length !== 2) return
    const m = parts[0]*60 + parts[1]
    const snapped = Math.round(m/AGENDA_SLOT)*AGENDA_SLOT
    if(snapped >= 24*60) return
    const sk = `${Math.floor(snapped/60).toString().padStart(2,'0')}:${(snapped%60).toString().padStart(2,'0')}`
    const items = Array.isArray(v) ? v.map(x => typeof x==='string' ? {id:x, dur:20} : x) : []
    if(!out[sk]) out[sk] = []
    items.forEach(x => { if(!out[sk].find(e => e.id===x.id)) out[sk].push(x) })
  })
  return out
}

function getAgendaData(){ return _agendaCache }
function setAgendaData(data){
  _agendaCache = data
  localStorage.setItem(getAgendaKey(), JSON.stringify(data))
}

async function loadAgendaForDate(dateStr){
  _agendaCacheDate = dateStr
  try {
    const { data, error } = await SB_P.from('agenda_items')
      .select('*').eq('user_id', USER_ID).eq('date', dateStr)
    if(!error && data){
      if(data.length > 0){
        const out = {}
        data.forEach(row => {
          const bk = row.block_time
          if(!bk) return
          if(!out[bk]) out[bk] = []
          const item = { id: row.item_id ?? null, dur: row.duration||20, type: row.item_type||'task' }
          if(row.notes) item.note = row.notes
          // allow multiple null-id events per block
          const isDup = item.id !== null && out[bk].find(e => e.id===item.id)
          if(!isDup) out[bk].push(item)
        })
        _agendaCache = out
        localStorage.setItem('agenda_'+dateStr, JSON.stringify(out))
        return
      }
      // Supabase vacío — usar localStorage como fuente si tiene datos (migración pendiente)
      const local = _parseLocalAgenda(dateStr)
      _agendaCache = local
      return
    }
  } catch(e){}
  _agendaCache = _parseLocalAgenda(dateStr)
}

async function loadAndRenderAgenda(){
  await loadAgendaForDate(getAgendaDateStr())
  renderAgenda()
}

function _sbAgendaRow(dateStr, slotKey, item){
  return {
    id: 'ai_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
    user_id: USER_ID,
    date: dateStr,
    block_time: slotKey,
    item_id: item.id,
    item_type: item.type||'task',
    duration: item.dur||20,
    notes: item.note||null
  }
}

function _sbAgendaDel(dateStr, slotKey, itemId){
  SB_P.from('agenda_items').delete()
    .eq('user_id', USER_ID).eq('date', dateStr)
    .eq('block_time', slotKey).eq('item_id', itemId)
}

async function _migrateLocalAgendaToSupabase(){
  if(localStorage.getItem('agenda_sb_migrated')) return
  const rows = []
  for(let i=0; i<localStorage.length; i++){
    const key = localStorage.key(i)
    if(!key || !key.startsWith('agenda_') || key.startsWith('agenda_routine') || key==='agenda_sb_migrated') continue
    const dateStr = key.replace('agenda_','')
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue
    const parsed = _parseLocalAgenda(dateStr)
    Object.entries(parsed).forEach(([bk, items]) => {
      items.forEach(x => {
        rows.push({ id:'ai_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
          user_id:USER_ID, date:dateStr, block_time:bk,
          item_id:x.id, item_type:x.type||'task', duration:x.dur||20, notes:x.note||null })
      })
    })
  }
  if(!rows.length){ localStorage.setItem('agenda_sb_migrated','1'); return }
  const {error} = await SB_P.from('agenda_items').insert(rows)
  if(!error) localStorage.setItem('agenda_sb_migrated','1')
}

const AGENDA_SLOT = 10
const agendaToMin = s => { const [h,m] = s.split(':').map(Number); return h*60+m }
const agendaFromMin = m => `${Math.floor(m/60).toString().padStart(2,'0')}:${(m%60).toString().padStart(2,'0')}`

let _agendaModalSelectedTask = null
let _agendaModalTab = 'tasks'
let _agendaEditSlot = null, _agendaEditId = null, _agendaEditType = null
let _agendaDragSlot = null, _agendaDragId = null

function openAgendaModal(){
  _agendaModalSelectedTask = null
  _agendaModalTab = 'tasks'
  const modal = document.getElementById('agenda-add-modal')
  if(!modal) return
  modal.style.display = 'flex'
  // Populate slot options
  const sel = document.getElementById('agenda-modal-slot')
  if(sel){
    const blocks = []
    for(let h=0; h<24; h++) for(let m=0; m<60; m+=AGENDA_SLOT) blocks.push(agendaFromMin(h*60+m))
    const now = new Date()
    const nowMin = now.getHours()*60+now.getMinutes()
    const nextBm = Math.ceil(nowMin/AGENDA_SLOT)*AGENDA_SLOT
    const defaultBk = agendaFromMin(Math.min(nextBm, 23*60+(60-AGENDA_SLOT)))
    sel.innerHTML = blocks.map(bk => {
      const sched = AGENDA_SCHEDULE.find(s=>s.time===bk)
      const label = sched ? `${bk}  —  ${sched.label}` : bk
      return `<option value="${bk}"${bk===defaultBk?' selected':''}>${label}</option>`
    }).join('')
  }
  switchAgendaModalTab('tasks')
}

function closeAgendaModal(){
  const modal = document.getElementById('agenda-add-modal')
  if(modal) modal.style.display = 'none'
  _agendaModalSelectedTask = null
}

function switchAgendaModalTab(tab){
  _agendaModalTab = tab
  _agendaModalSelectedTask = null
  const tBtn = document.getElementById('agenda-tab-tasks')
  const hBtn = document.getElementById('agenda-tab-habits')
  if(!tBtn || !hBtn) return
  if(tab === 'tasks'){
    tBtn.style.background = 'rgba(155,114,240,0.15)'; tBtn.style.color = 'var(--purple)'; tBtn.style.fontWeight = '600'
    hBtn.style.background = 'transparent'; hBtn.style.color = 'var(--text-muted)'; hBtn.style.fontWeight = '400'
  } else {
    hBtn.style.background = 'rgba(155,114,240,0.15)'; hBtn.style.color = 'var(--purple)'; hBtn.style.fontWeight = '600'
    tBtn.style.background = 'transparent'; tBtn.style.color = 'var(--text-muted)'; tBtn.style.fontWeight = '400'
  }
  renderAgendaModalTasks()
}

function renderAgendaModalTasks(){
  if(_agendaModalTab === 'habits'){ renderAgendaModalHabits(); return }
  const el = document.getElementById('agenda-modal-task-list')
  if(!el) return
  const data = getAgendaData()
  const usedIds = new Set(Object.values(data).flat().map(x=>x.id))
  const tasks = allTasks.filter(t => t.status!=='completada' && t.status!=='archivada' && !usedIds.has(t.id))
  if(!tasks.length){
    el.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text-muted);text-align:center">No hay tareas pendientes disponibles</div>'
    return
  }
  const groups = {}
  tasks.forEach(t => {
    const k = t.category||'habitos'
    if(!groups[k]) groups[k]=[]
    groups[k].push(t)
  })
  el.innerHTML = Object.entries(groups).map(([catKey, catTasks]) => {
    const cat = CATS[catKey]||CATS.habitos
    return `<div>
      <div style="padding:5px 10px;font-size:11px;font-weight:600;color:${cat.color};background:rgba(0,0,0,0.3);display:flex;align-items:center;gap:5px;position:sticky;top:0">
        <span style="width:6px;height:6px;border-radius:50%;background:${cat.color};display:inline-block;flex-shrink:0"></span>
        ${cat.label} <span style="font-size:10px;color:var(--text-muted);font-weight:400">(${catTasks.length})</span>
      </div>
      ${catTasks.map(t => {
        const sel = _agendaModalSelectedTask===t.id
        return `<div onclick="selectAgendaModalTask('${t.id}')"
          style="display:flex;align-items:center;gap:8px;padding:7px 10px 7px 22px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);background:${sel?cat.color+'18':'transparent'}"
          onmouseenter="if('${t.id}'!==_agendaModalSelectedTask)this.style.background='rgba(255,255,255,0.04)'"
          onmouseleave="if('${t.id}'!==_agendaModalSelectedTask)this.style.background='${sel?cat.color+'18':'transparent'}'">
          <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${sel?cat.color:'var(--border)'};background:${sel?cat.color:'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff">${sel?'✓':''}</div>
          <span style="flex:1;font-size:12px;color:${sel?cat.color:'var(--text)'}">${t.title}</span>
        </div>`
      }).join('')}
    </div>`
  }).join('')
}

function renderAgendaModalHabits(){
  const el = document.getElementById('agenda-modal-task-list')
  if(!el) return
  const data = getAgendaData()
  const usedIds = new Set(Object.values(data).flat().map(x=>x.id))
  const habits = allActivities.filter(a => a.is_active && !usedIds.has(a.id))
  if(!habits.length){
    el.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text-muted);text-align:center">No hay hábitos activos disponibles</div>'
    return
  }
  const groups = {}
  habits.forEach(a => {
    const k = a.category||'vida_practica'
    if(!groups[k]) groups[k]=[]
    groups[k].push(a)
  })
  el.innerHTML = Object.entries(groups).map(([catKey, catHabits]) => {
    const color = CAT_COLORS[catKey]||'#555'
    const label = CAT_LABELS[catKey]||catKey
    return `<div>
      <div style="padding:5px 10px;font-size:11px;font-weight:600;color:${color};background:rgba(0,0,0,0.3);display:flex;align-items:center;gap:5px;position:sticky;top:0">
        <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
        ${label} <span style="font-size:10px;color:var(--text-muted);font-weight:400">(${catHabits.length})</span>
      </div>
      ${catHabits.map(a => {
        const sel = _agendaModalSelectedTask===a.id
        return `<div onclick="selectAgendaModalTask('${a.id}')"
          style="display:flex;align-items:center;gap:8px;padding:7px 10px 7px 22px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);background:${sel?color+'18':'transparent'}"
          onmouseenter="if('${a.id}'!==_agendaModalSelectedTask)this.style.background='rgba(255,255,255,0.04)'"
          onmouseleave="if('${a.id}'!==_agendaModalSelectedTask)this.style.background='${sel?color+'18':'transparent'}'">
          <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${sel?color:'var(--border)'};background:${sel?color:'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff">${sel?'✓':''}</div>
          <span style="flex:1;font-size:12px;color:${sel?color:'var(--text)'}">${a.name}</span>
        </div>`
      }).join('')}
    </div>`
  }).join('')
}

function selectAgendaModalTask(id){
  _agendaModalSelectedTask = _agendaModalSelectedTask===id ? null : id
  renderAgendaModalTasks()
}

function saveAgendaTask(){
  if(!_agendaModalSelectedTask){ showToast('⚠️ Selecciona una tarea o hábito'); return }
  const slotKey = document.getElementById('agenda-modal-slot')?.value
  if(!slotKey){ showToast('⚠️ Selecciona la hora'); return }
  const sel  = document.getElementById('agenda-modal-dur')
  const cust = document.getElementById('agenda-modal-dur-cust')
  let dur = parseInt(sel?.value||'20')
  if(dur===0) dur = parseInt(cust?.value||'20')||20
  const type = _agendaModalTab === 'habits' ? 'habit' : 'task'
  const newItem = {id:_agendaModalSelectedTask, dur, type}
  const data = getAgendaData()
  if(!data[slotKey]) data[slotKey]=[]
  if(!data[slotKey].find(x=>x.id===_agendaModalSelectedTask)) data[slotKey].push(newItem)
  setAgendaData(data)
  SB_P.from('agenda_items').insert(_sbAgendaRow(getAgendaDateStr(), slotKey, newItem))
  closeAgendaModal()
  renderAgenda()
  showToast('✅ Agregado a la agenda')
}

function removeAgendaTask(slotKey, taskId){
  const data = getAgendaData()
  if(!data[slotKey]) return
  data[slotKey] = data[slotKey].filter(x=>x.id!==taskId)
  if(!data[slotKey].length) delete data[slotKey]
  setAgendaData(data)
  _sbAgendaDel(getAgendaDateStr(), slotKey, taskId)
  renderAgenda()
}

async function removeAutoAgendaTask(taskId){
  const task = allTasks.find(t=>t.id===taskId)
  if(!task) return
  await SB_P.from('tasks').update({ notes: null }).eq('id', taskId)
  task.notes = null
  renderTasks()
}

function getRoutineOverrides(){
  return JSON.parse(localStorage.getItem('agenda_routine_overrides_'+getAgendaDateStr())||'{}')
}
function setRoutineOverrides(ov){
  localStorage.setItem('agenda_routine_overrides_'+getAgendaDateStr(), JSON.stringify(ov))
}

function _populateAgendaSlotSelect(selId, selected){
  const sel = document.getElementById(selId)
  if(!sel) return
  const blocks = []
  for(let h=0;h<24;h++) for(let m=0;m<60;m+=AGENDA_SLOT) blocks.push(agendaFromMin(h*60+m))
  sel.innerHTML = blocks.map(bk => {
    const s = AGENDA_SCHEDULE.find(x=>x.time===bk)
    const label = s ? `${bk}  —  ${s.label}` : bk
    return `<option value="${bk}"${bk===selected?' selected':''}>${label}</option>`
  }).join('')
}

function openAgendaEditModal(slotKey, itemId){
  const data = getAgendaData()
  const item = (data[slotKey]||[]).find(x=>x.id===itemId)
  if(!item) return
  _agendaEditSlot = slotKey
  _agendaEditId = itemId
  _agendaEditType = item.type
  const modal = document.getElementById('agenda-edit-modal')
  if(!modal) return
  document.getElementById('aedit-dur-row').style.display = ''
  document.getElementById('aedit-note-row').style.display = ''
  document.getElementById('aedit-del-btn').style.display = ''
  _populateAgendaSlotSelect('aedit-slot', slotKey)
  const durSel = document.getElementById('aedit-dur')
  const durCust = document.getElementById('aedit-dur-cust')
  const knownDurs = ['20','40','60','80','100','120','150','180','240']
  const durStr = String(item.dur||20)
  if(knownDurs.includes(durStr)){
    durSel.value = durStr
    durCust.style.display = 'none'
  } else {
    durSel.value = '0'
    durCust.style.display = 'block'
    durCust.value = durStr
  }
  document.getElementById('aedit-note').value = item.note || ''
  modal.style.display = 'flex'
}

function openRoutineEditModal(originalSlot){
  _agendaEditSlot = '__routine__'
  _agendaEditId = originalSlot
  _agendaEditType = 'routine'
  const modal = document.getElementById('agenda-edit-modal')
  if(!modal) return
  document.getElementById('aedit-dur-row').style.display = 'none'
  document.getElementById('aedit-note-row').style.display = 'none'
  document.getElementById('aedit-del-btn').style.display = ''
  const overrides = getRoutineOverrides()
  _populateAgendaSlotSelect('aedit-slot', overrides[originalSlot] || originalSlot)
  modal.style.display = 'flex'
}

function closeAgendaEditModal(){
  const modal = document.getElementById('agenda-edit-modal')
  if(modal) modal.style.display = 'none'
  _agendaEditSlot = null; _agendaEditId = null; _agendaEditType = null
}

function eliminarAgendaEdit(){
  if(!_agendaEditSlot || !_agendaEditId) return
  if(_agendaEditType === 'routine'){
    const overrides = getRoutineOverrides()
    overrides[_agendaEditId] = '__hidden__'
    setRoutineOverrides(overrides)
    closeAgendaEditModal()
    renderAgenda()
    return
  }
  removeAgendaTask(_agendaEditSlot, _agendaEditId)
  closeAgendaEditModal()
}

function saveAgendaEdit(){
  if(!_agendaEditSlot || !_agendaEditId) return
  const newSlot = document.getElementById('aedit-slot')?.value
  if(!newSlot){ showToast('⚠️ Selecciona la hora'); return }

  if(_agendaEditType === 'routine'){
    const overrides = getRoutineOverrides()
    if(newSlot === _agendaEditId) delete overrides[_agendaEditId]
    else overrides[_agendaEditId] = newSlot
    setRoutineOverrides(overrides)
    closeAgendaEditModal()
    renderAgenda()
    showToast('✅ Rutina movida para hoy')
    return
  }

  const data = getAgendaData()
  const oldItems = data[_agendaEditSlot] || []
  const item = oldItems.find(x=>x.id===_agendaEditId)
  if(!item) return
  const durSel = document.getElementById('aedit-dur')
  const durCust = document.getElementById('aedit-dur-cust')
  let dur = parseInt(durSel?.value||'20')
  if(dur===0) dur = parseInt(durCust?.value||'20')||20
  const note = document.getElementById('aedit-note')?.value?.trim()||''

  data[_agendaEditSlot] = oldItems.filter(x=>x.id!==_agendaEditId)
  if(!data[_agendaEditSlot].length) delete data[_agendaEditSlot]
  if(!data[newSlot]) data[newSlot]=[]
  const existing = data[newSlot].findIndex(x=>x.id===_agendaEditId)
  const newItem = {id:_agendaEditId, dur, type:item.type}
  if(note) newItem.note = note
  if(existing>=0) data[newSlot][existing]=newItem
  else data[newSlot].push(newItem)

  setAgendaData(data)
  const _editDateStr = getAgendaDateStr()
  _sbAgendaDel(_editDateStr, _agendaEditSlot, _agendaEditId)
  SB_P.from('agenda_items').insert(_sbAgendaRow(_editDateStr, newSlot, newItem))
  closeAgendaEditModal()
  renderAgenda()
  showToast('✅ Guardado')
}

function onAgendaChipDragStart(event, slotKey, itemId){
  _agendaDragSlot = slotKey
  _agendaDragId = itemId
  event.dataTransfer.effectAllowed = 'move'
}

function onAgendaBlockDrop(event, newSlot){
  event.preventDefault()
  if(!_agendaDragSlot || !_agendaDragId) return
  if(_agendaDragSlot === newSlot){ _agendaDragSlot=null; _agendaDragId=null; return }
  const data = getAgendaData()
  const item = (data[_agendaDragSlot]||[]).find(x=>x.id===_agendaDragId)
  if(!item){ _agendaDragSlot=null; _agendaDragId=null; return }
  const oldSlot = _agendaDragSlot, dragId = _agendaDragId
  data[_agendaDragSlot] = (data[_agendaDragSlot]||[]).filter(x=>x.id!==_agendaDragId)
  if(!data[_agendaDragSlot].length) delete data[_agendaDragSlot]
  if(!data[newSlot]) data[newSlot]=[]
  if(!data[newSlot].find(x=>x.id===_agendaDragId)) data[newSlot].push(item)
  setAgendaData(data)
  const _dropDateStr = getAgendaDateStr()
  _sbAgendaDel(_dropDateStr, oldSlot, dragId)
  SB_P.from('agenda_items').insert(_sbAgendaRow(_dropDateStr, newSlot, item))
  _agendaDragSlot=null; _agendaDragId=null
  renderAgenda()
  showToast('✅ Tarea movida')
}

function renderAgenda(){
  const el = document.getElementById('agenda-timeline')
  if(!el) return

  const data = getAgendaData()
  const now = new Date()
  const nowMin = now.getHours()*60 + now.getMinutes()
  const curBlockMin = Math.floor(nowMin/AGENDA_SLOT)*AGENDA_SLOT
  const curBk = agendaFromMin(curBlockMin)
  const progressInBlock = (nowMin - curBlockMin) / AGENDA_SLOT

  const routineOverrides = getRoutineOverrides()
  const schedMap = {}
  AGENDA_SCHEDULE.forEach(s => {
    const effectiveSlot = routineOverrides[s.time] || s.time
    if(effectiveSlot === '__hidden__') return
    schedMap[effectiveSlot] = {label: s.label, originalSlot: s.time}
  })

  // Continuation blocks for multi-block routine items
  const routineContMap = {}
  AGENDA_SCHEDULE.forEach(s => {
    if(s.dur && s.dur > 20){
      const n = Math.ceil(s.dur/AGENDA_SLOT)
      for(let i=1; i<n; i++){
        const bm = agendaToMin(s.time)+i*AGENDA_SLOT
        if(bm >= 24*60) break
        routineContMap[agendaFromMin(bm)] = s.label
      }
    }
  })

  // Pre-compute continuation blocks from multi-block tasks/habits
  const contMap = {}
  Object.entries(data).forEach(([sk, items]) => {
    items.forEach(x => {
      const {id, dur, type} = x
      let color, title, isHabit=false, isCita=false, isEvent=false
      if(type === 'habit'){
        const act = allActivities.find(a=>a.id===id)
        color = act ? (CAT_COLORS[act.category]||'#555') : '#555'
        title = act?.name || 'Hábito'
        isHabit = true
      } else if(type === 'cita'){
        color = x.color || '#EF9F27'
        title = '🏥 ' + (x.title || allCitas.find(c=>c.id===id)?.title || 'Cita')
        isCita = true
      } else if(id === null || id === undefined){
        color = '#9B72F0'
        title = x.note || 'Evento'
        isEvent = true
      } else {
        const task = allTasks.find(t=>t.id===id)
        color = task ? (CATS[task.category]||CATS.habitos).color : '#555'
        title = task?.title || 'Tarea'
      }
      const n = Math.ceil(dur/AGENDA_SLOT)
      const totalConts = n - 1
      for(let i=1; i<n; i++){
        const bm = agendaToMin(sk)+i*AGENDA_SLOT
        if(bm>=24*60) break
        const bk = agendaFromMin(bm)
        if(!contMap[bk]) contMap[bk]=[]
        contMap[bk].push({color, title, taskId:id, startKey:sk, isHabit, isCita, isEvent, note:x.note, dur, contIdx:i, totalConts})
      }
    })
  })

  // Auto-tasks by block (due on agenda date with HH:MM in notes)
  const agendaDateStr = getAgendaDateStr()
  const autoMap = {}
  allTasks.forEach(t => {
    if(t.due_date===agendaDateStr && t.notes && /^\d{2}:\d{2}$/.test(t.notes.trim())){
      const bm = Math.floor(agendaToMin(t.notes.trim())/AGENDA_SLOT)*AGENDA_SLOT
      const bk = agendaFromMin(Math.min(bm, 23*60+(60-AGENDA_SLOT)))
      if(!autoMap[bk]) autoMap[bk]=[]
      autoMap[bk].push(t)
    }
  })

  // Date navigator
  const dateNav = document.getElementById('agenda-date-nav')
  if(dateNav){
    const agendaDay = new Date()
    agendaDay.setDate(agendaDay.getDate() + _agendaDayOffset)
    const dateLabel = agendaDay.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
      .replace(/^\w/, c => c.toUpperCase())
    const isToday = _agendaDayOffset === 0
    const navBtn = s => `style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:2px 6px;line-height:1;border-radius:5px" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-muted)'"`
    const agendaDateVal = agendaDay.toLocaleDateString('en-CA')
    dateNav.innerHTML = `<button onclick="navAgenda(-1)" ${navBtn()}>←</button>
      <span onclick="document.getElementById('agenda-date-picker').showPicker?document.getElementById('agenda-date-picker').showPicker():document.getElementById('agenda-date-picker').click()" style="font-size:12px;font-weight:600;color:${isToday?'var(--gold)':'var(--text-dim)'};cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px" title="Saltar a fecha">${dateLabel}</span>
      <input type="date" id="agenda-date-picker" value="${agendaDateVal}" onchange="jumpAgendaToDate(this.value)" style="position:absolute;opacity:0;pointer-events:none;width:0;height:0">
      <button onclick="navAgenda(1)" ${navBtn()}>→</button>
      ${!isToday?`<button onclick="goAgendaToday()" style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);color:var(--gold);border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:'Outfit',sans-serif;margin-left:2px">Hoy</button>`:''}
    `
  }

  const fmtDur = d => d>=60 ? `${Math.floor(d/60)}h${d%60?d%60+'m':''}` : `${d}min`

  const chipCheck = (t, cat) => {
    const done = t.status==='completada'
    return `<div onclick="toggleTask('${t.id}')" style="cursor:pointer;width:12px;height:12px;border-radius:50%;border:1.5px solid ${cat.color};background:${done?cat.color:'transparent'};display:flex;align-items:center;justify-content:center;font-size:8px;color:#000;flex-shrink:0">${done?'✓':''}</div>`
  }

  // Generate 144 blocks (00:00 → 23:50, every 10 min)
  const blocks = []
  for(let h=0; h<24; h++) for(let m=0; m<60; m+=AGENDA_SLOT) blocks.push(agendaFromMin(h*60+m))
  _agendaAllBlocks = blocks

  // Pre-proceso: fusionar entradas consecutivas del mismo id sin rutina intermedia
  const _absorbedKeys = new Set() // "slotKey|itemId"
  blocks.forEach((bk, idx) => {
    (data[bk]||[]).forEach(item => {
      const key = bk + '|' + String(item.id)
      if(_absorbedKeys.has(key)) return
      let extraSlots = 0
      let ni = idx + 1
      while(ni < blocks.length){
        const nbk = blocks[ni]
        if(schedMap[nbk]) break // rutina fija, no fusionar
        const sameNext = (data[nbk]||[]).find(x => String(x.id) === String(item.id) && x.type === item.type)
        if(!sameNext) break
        _absorbedKeys.add(nbk + '|' + String(item.id))
        extraSlots++
        ni++
      }
      if(extraSlots > 0) item.dur = (item.dur || AGENDA_SLOT) + extraSlots * AGENDA_SLOT
    })
  })

  let html = '<div class="agenda-timeline-wrap">'
  blocks.forEach(bk => {
    const bMin    = agendaToMin(bk)
    const isNow   = bk === curBk
    const isPast  = bMin+AGENDA_SLOT <= nowMin
    const isHour  = bk.endsWith(':00')
    const isHalf  = bk.endsWith(':30')
    const routineEntry = schedMap[bk]
    const routine      = routineEntry?.label || null
    const routineOrig  = routineEntry?.originalSlot || bk
    const routineCont = routineContMap[bk]
    const conts   = contMap[bk]||[]
    const autos   = autoMap[bk]||[]
    const items   = data[bk]||[]
    const autoIds = new Set(autos.map(t=>t.id))
    // IDs que tienen bloque de continuación en el slot siguiente
    const nextBk = agendaFromMin(agendaToMin(bk)+AGENDA_SLOT)
    const hasContinuation = new Set((contMap[nextBk]||[]).map(c=>c.taskId))
    const pinned  = items.filter(x=>!autoIds.has(x.id) && !_absorbedKeys.has(bk+'|'+String(x.id)))
    const pinnedItems = pinned.map(x => {
      if(x.type === 'habit'){
        const act = allActivities.find(a=>a.id===x.id)
        if(!act) return null
        const color = CAT_COLORS[act.category]||'#555'
        return {id:x.id, title:act.name, color, dur:x.dur, isHabit:true, note:x.note}
      }
      if(x.type === 'cita'){
        const color = x.color || '#EF9F27'
        const title = x.title || allCitas.find(c=>c.id===x.id)?.title || 'Cita'
        return {id:x.id, title:'🏥 '+title, color, dur:x.dur, isHabit:false, isCita:true, note:x.note}
      }
      if(x.id === null || x.id === undefined){
        return {id:null, title:x.note||'Evento', color:'#9B72F0', dur:x.dur, isHabit:false, isEvent:true}
      }
      const t = allTasks.find(t=>t.id===x.id)
      if(!t) return null
      const cat = CATS[t.category]||CATS.habitos
      return {id:x.id, title:t.title, color:cat.color, dur:x.dur, task:t, isHabit:false, note:x.note}
    }).filter(Boolean)
    const domId   = bk.replace(':','_')
    const hasContent = routine||routineCont||conts.length||autos.length||pinnedItems.length
    const rowCount = (routine?1:0) + (routineCont?1:0) + conts.length + autos.length + pinnedItems.length
    const minH = rowCount === 0 ? 32 : Math.max(40, rowCount * 30 + 10)

    const nowLineY = Math.round(progressInBlock*(hasContent?52:36))
    const nowLineHTML = isNow ? `<div class="agenda-now-line" style="top:${nowLineY}px"></div>` : ''

    const contHTML = conts.map(c => {
      const isLast = c.contIdx === c.totalConts
      const isMid  = c.contIdx < c.totalConts
      const radius = isLast ? '0 0 6px 6px' : '0'
      const borderT = 'none'
      const borderB = isMid ? 'none' : ''
      const contStyle = `border-radius:${radius};border-top:${borderT};${borderB?'border-bottom:'+borderB:''};margin-top:0`
      const dotEl = `<div style="width:12px;height:12px;border-radius:50%;background:${c.color};flex-shrink:0;opacity:0.8"></div>`
      const noteEl = c.note ? `<span style="font-size:9px;color:var(--text-muted);font-style:italic;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0">${c.note}</span>` : ''
      const durEl = `<span style="color:var(--text-muted);font-size:9px;flex-shrink:0">(${fmtDur(c.dur)})</span>`
      const editBtn = (c.isHabit||c.isCita||c.isEvent) ? '' :
        `<button onclick="event.stopPropagation();openAgendaEditModal('${c.startKey}','${c.taskId}')" style="font-size:11px;color:var(--text-muted);background:transparent;border:none;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0">✏️</button>`
      const removeBtn = `<button onclick="removeAgendaTask('${c.startKey}','${c.taskId}')" style="font-size:13px;color:var(--text-muted);background:transparent;border:none;cursor:pointer;padding:0;line-height:1;flex-shrink:0">×</button>`
      return `<div class="agenda-chip" oncontextmenu="agendaChipRightClick(event,'${c.startKey}','${c.taskId}')" style="border-color:${c.color}44;background:${c.color}0D;${contStyle}">
        ${dotEl}
        <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</span>
        ${noteEl}${durEl}${editBtn}${removeBtn}
      </div>`
    }).join('')

    const autoHTML = autos.map(t => {
      const cat = CATS[t.category]||CATS.habitos
      const done = t.status==='completada'
      return `<div class="agenda-chip" style="border-color:${cat.color}33;background:${cat.color}0D;${done?'opacity:0.5':''}">
        ${chipCheck(t,cat)}
        <span style="flex:1;${done?'text-decoration:line-through;color:var(--text-muted)':''}">${t.title}</span>
        <span style="color:${cat.color};font-size:9px;flex-shrink:0">auto</span>
        <button onclick="removeAutoAgendaTask('${t.id}')" style="font-size:13px;color:var(--text-muted);background:transparent;border:none;cursor:pointer;padding:0;line-height:1;flex-shrink:0">×</button>
      </div>`
    }).join('')

    const pinnedHTML = pinnedItems.map(item => {
      const {id, title, color, dur, isHabit, isCita, isEvent, task, note} = item
      if(isEvent){
        return `<div class="agenda-chip" style="border-color:${color}44;background:${color}0D">
          <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin:2px"></div>
          <span style="flex:1;color:var(--text)">${title}</span>
          <span style="color:var(--text-muted);font-size:9px;flex-shrink:0">(${fmtDur(dur)})</span>
        </div>`
      }
      const done = !isHabit && !isCita && task?.status === 'completada'
      const checkEl = (isHabit || isCita)
        ? `<div style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0;opacity:0.8"></div>`
        : chipCheck(task, {color})
      const hasCont = hasContinuation.has(String(id))
      const contStyle = hasCont ? 'border-radius:6px 6px 0 0;border-bottom:none;margin-bottom:0' : ''
      return `<div class="agenda-chip" draggable="true" ondragstart="onAgendaChipDragStart(event,'${bk}','${id}')" oncontextmenu="agendaChipRightClick(event,'${bk}','${id}')" style="border-color:${color}44;background:${color}0D;${done?'opacity:0.5':''};${contStyle}">
        ${checkEl}
        <span style="flex:1;${done?'text-decoration:line-through;color:var(--text-muted)':''};">${title}</span>
        ${note?`<span style="font-size:9px;color:var(--text-muted);font-style:italic;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0" title="${note}">${note}</span>`:''}
        <span style="color:var(--text-muted);font-size:9px;flex-shrink:0">(${fmtDur(dur)})</span>
        <button onclick="event.stopPropagation();openAgendaEditModal('${bk}','${id}')" style="font-size:11px;color:var(--text-muted);background:transparent;border:none;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0">✏️</button>
        <button onclick="removeAgendaTask('${bk}','${id}')" style="font-size:13px;color:var(--text-muted);background:transparent;border:none;cursor:pointer;padding:0;line-height:1;flex-shrink:0">×</button>
      </div>`
    }).join('')

    const isSelected = _agendaSelectedSlots.has(bk)
    html += `<div class="agenda-block${isNow?' is-now':''}${isPast?' is-past':''}${isSelected?' agenda-selected':''}" id="ablock-${domId}" style="position:relative" onmouseover="agendaSelMouseOver(event,'${bk}')">
      ${nowLineHTML}
      <div class="agenda-time-lbl${isHour?' is-hour':isHalf?' is-half':''}">${bk}</div>
      <div class="agenda-block-line"></div>
      <div class="agenda-block-content" data-slot="${bk}" onmousedown="agendaSelMouseDown(event,'${bk}')" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="onAgendaBlockDrop(event,'${bk}');this.classList.remove('drag-over')" style="min-height:${minH}px">
        ${routine?`<div class="agenda-routine-lbl${isNow?' is-now':''}" style="display:flex;align-items:center;gap:4px">${routine}<button onclick="event.stopPropagation();openRoutineEditModal('${routineOrig}')" style="font-size:10px;color:var(--text-muted);background:transparent;border:none;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0">✏️</button></div>`:''}
        ${routineCont?`<div style="font-size:10px;color:var(--text-muted);padding-left:4px;font-style:italic">↳ ${routineCont}</div>`:''}
        ${contHTML}${autoHTML}${pinnedHTML}
      </div>
    </div>`
  })

  html += '</div>'
  el.innerHTML = html

  // Auto-scroll to current block only when viewing today
  if(_agendaDayOffset === 0){
    const nowBlock = document.getElementById('ablock-'+curBk.replace(':','_'))
    if(nowBlock) setTimeout(() => nowBlock.scrollIntoView({behavior:'smooth', block:'center'}), 100)
  }
}

function showToast(msg, duration=3500){
  const t = document.getElementById('toast')
  t.classList.remove('action')
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), duration)
}

let _toastActionTimer = null
function showToastAction(msg, yesLabel, onYes){
  clearTimeout(_toastActionTimer)
  const t = document.getElementById('toast')
  t.innerHTML = `<div style="margin-bottom:8px">${msg}</div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button onclick="window._toastYes()" style="padding:5px 14px;border-radius:7px;border:1px solid #EF9F27;background:rgba(239,159,39,0.15);color:#EF9F27;cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px;font-weight:600">${yesLabel}</button>
      <button onclick="window._toastNo()" style="padding:5px 14px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px">No</button>
    </div>`
  t.classList.add('show', 'action')
  window._toastYes = () => { onYes(); _dismissToastAction() }
  window._toastNo  = () => { _dismissToastAction() }
  _toastActionTimer = setTimeout(_dismissToastAction, 8000)
}
function _dismissToastAction(){
  clearTimeout(_toastActionTimer)
  const t = document.getElementById('toast')
  t.classList.remove('show')
  setTimeout(() => { t.classList.remove('action'); t.innerHTML = '' }, 400)
}

function addCitaToHoy(citaId){
  const ids = getDashList('hoy')
  if(ids.length >= 5){ showToast('Máximo 5 tareas en "Mis 5 tareas"'); return }
  if(!ids.includes(citaId)) ids.push(citaId)
  setDashList('hoy', ids)
  renderTasks()
  showToast('✅ Cita agregada a tus tareas de hoy')
}

function update2020Widget(){
  const banoSlotDone = Object.keys(slotLogs['a14']||{}).length > 0
  const trio = ['a35','a14','a02']
  const trioCompleto = ['a35','a02'].every(id => !!habitLogs[id]) && banoSlotDone
  const despertarCompleto = ['a09','a13','a07'].every(id => !!habitLogs[id])

  // Update both 20/20/20 blocks (Rutinas + Trabajo)
  ;[{pfx:'r-', cpfx:'rc-', badge:'ritual-badge', overlay:'overlay-2020-r'},
    {pfx:'rt-',cpfx:'rct-',badge:'ritual-badge-t',overlay:'overlay-2020-t'}].forEach(({pfx,cpfx,badge:badgeId,overlay:ovId}) => {
    trio.forEach(id => {
      if(id === 'a14'){
        const item = document.getElementById(pfx+id)
        if(!item) return
        const slotMap = slotLogs['a14'] || {}
        const donedSlot = [{id:'frio',icon:'🚿',label:'Frío'},{id:'completo',icon:'🛁',label:'Completo'}].find(s => !!slotMap[s.id])
        const anyDone = !!donedSlot
        item.classList.toggle('done', anyDone)
        const color = '#00C2FF'
        const pickerId = pfx+'a14-picker'
        if(anyDone){
          item.innerHTML = `
            <div class="ritual-check done" style="background:${color};border-color:${color};color:#000;flex-shrink:0">✓</div>
            <span class="ritual-label">${donedSlot.icon} ${donedSlot.label}</span>
            <button onclick="eliminarSlot('a14','${donedSlot.id}');event.stopPropagation()" style="margin-left:auto;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px 6px">✕</button>`
        } else {
          const isOpen = _slotExpandido === pfx+'a14'
          if(isOpen){
            item.innerHTML = `
              <span class="ritual-label" style="flex:none;margin-right:8px">Baño</span>
              <button onclick="_slotExpandido=null;marcarSlot('a14','frio');update2020Widget()" style="flex:1;padding:5px 0;border-radius:7px;border:1px solid rgba(0,194,255,0.3);background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">🚿 Frío</button>
              <button onclick="_slotExpandido=null;marcarSlot('a14','completo');update2020Widget()" style="flex:1;padding:5px 0;border-radius:7px;border:1px solid rgba(0,194,255,0.3);background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif;margin-left:4px">🛁 Completo</button>
              <button onclick="_slotExpandido=null;update2020Widget()" style="padding:5px 8px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif;margin-left:4px">✕</button>`
          } else {
            item.innerHTML = `
              <div class="ritual-check" style="border-color:rgba(0,194,255,0.3);flex-shrink:0"></div>
              <span class="ritual-label">Baño</span>
              <button onclick="event.stopPropagation();_slotExpandido='${pfx}a14';update2020Widget()" style="margin-left:auto;padding:4px 10px;border-radius:6px;border:1px solid rgba(0,194,255,0.25);background:transparent;color:rgba(0,194,255,0.6);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">+ elegir</button>`
          }
        }
        return
      }
      const done = !!habitLogs[id]
      const item  = document.getElementById(pfx+id)
      const check = document.getElementById(cpfx+id)
      if(!item) return
      item.classList.toggle('done', done)
      check.classList.toggle('done', done)
      check.textContent = done ? '✓' : ''
    })
    const badge = document.getElementById(badgeId)
    if(badge){
      badge.classList.toggle('done', trioCompleto)
      badge.textContent = trioCompleto ? '✅ 20/20/20 Completado' : '🔄 20/20/20'
    }
    const ov = document.getElementById(ovId)
    if(ov){
      if(trioCompleto){
        ov.style.display = 'flex'
        ov.style.background = 'rgba(6,6,9,0.72)'
        ov.style.pointerEvents = 'none'
        ov.innerHTML = '🔥 ¡20/20/20 completado! Cuerpo y mente listos.'
      } else if(!despertarCompleto){
        ov.style.display = 'flex'
        ov.style.background = 'rgba(6,6,9,0.88)'
        ov.style.pointerEvents = 'auto'
        ov.innerHTML = '⚠️ Completa Despertar primero'
      } else {
        ov.style.display = 'none'
      }
    }
  })

  const wrap = document.getElementById('dashboard-tasks-wrap')
  if(wrap) wrap.classList.toggle('tasks-locked', !trioCompleto)
  renderDespertarDash()
  renderMatutinaDash()
  renderTrabajoDash()
  renderInicioDiaDash()
  renderRutinaNocturnaDash()
  renderCierreDiaDash()
}

async function toggleHabitoFromDash(activityId){
  if(habitLogs[activityId]){
    await SB_P.from('activity_logs').delete().eq('id', habitLogs[activityId].id)
    delete habitLogs[activityId]
  } else {
    const log = { id:'log_'+Date.now(), user_id: USER_ID, activity_id: activityId, value: 1, date: TODAY }
    await SB_P.from('activity_logs').insert(log)
    habitLogs[activityId] = log
  }
  const trioCompleto = ['a35','a02'].every(id => !!habitLogs[id]) && Object.keys(slotLogs['a14']||{}).length > 0
  if(trioCompleto && !habitLogs['a70']){
    const log70 = { id:'log_'+Date.now()+'_70', user_id: USER_ID, activity_id: 'a70', value: 1, date: TODAY }
    await SB_P.from('activity_logs').insert(log70)
    habitLogs['a70'] = log70
    showToast('🔥 ¡20/20/20 completado! Cuerpo y mente listos. A trabajar.')
    alertarTareasIncompletas()
  } else if(!trioCompleto && habitLogs['a70']){
    await SB_P.from('activity_logs').delete().eq('id', habitLogs['a70'].id)
    delete habitLogs['a70']
  }
  update2020Widget()
  renderHabitos()
}

function renderCatLegend(){
  const el = document.getElementById('cat-legend')
  if(!el) return
  el.innerHTML = Object.entries(CATS).map(([id,c]) => {
    const count = allTasks.filter(t => t.category===id && t.status!=='completada').length
    return `<div class="cat-row">
      <div class="cat-dot" style="background:${c.color}"></div>
      <span>${c.label}</span>
      <span class="cat-count">${count} pendientes</span>
    </div>`
  }).join('')
}

async function toggleTask(id){
  const task = allTasks.find(t => t.id===id)
  if(!task) return
  const newStatus = task.status === 'completada' ? 'pendiente' : 'completada'
  await SB_P.from('tasks').update({ status: newStatus }).eq('id', id)
  task.status = newStatus
  renderTasks()
}

function toggleDashSection(id){
  const body  = document.getElementById('dash-'+id+'-body')
  const arrow = document.getElementById('dash-'+id+'-arrow')
  if(!body) return
  body.classList.toggle('collapsed')
  arrow.classList.toggle('up')
}

function renderMatutinaDash(){
  const el = document.getElementById('dash-matutina-body')
  if(!el) return
  const byCategory = allActivities.filter(a => a.category === 'secundarios_manana' && a.is_active && (a.frequency||'diaria') === 'diaria')
  const acts = [...byCategory]
  if(!acts.length){
    el.innerHTML = '<div style="padding:6px 10px;font-size:12px;color:var(--text-muted)">Sin actividades matutinas configuradas</div>'
    return
  }
  el.innerHTML = acts.map(a => {
    if(SLOT_HABITS[a.id]) return renderSlotHabito(a.id, a.name)
    const done = !!habitLogs[a.id]
    const hora = a.hora_sugerida ? `<span style="font-size:10px;color:var(--text-muted);margin-left:auto;opacity:.7">${a.hora_sugerida.slice(0,5)}</span>` : ''
    return `<div class="ritual-item${done?' done':''}" onclick="toggleHabito('${a.id}')">
      <div class="ritual-check${done?' done':''}" style="${done?'background:#C4A35A;border-color:#C4A35A;color:#000':'border-color:rgba(196,163,90,0.4)'}">${done?'✓':''}</div>
      <span class="ritual-label">${a.name}</span>
      ${hora}
    </div>`
  }).join('')
  if(_slotEditing){
    const actId = _slotEditing.split('|')[0]
    const inp = document.getElementById('slot-edit-'+actId)
    if(inp){ inp.value = _slotEditText; inp.focus() }
  }
}

function renderSlotHabito(actId, name){
  const slots = SLOT_HABITS[actId]
  const color = '#C4A35A'
  const slotMap = slotLogs[actId] || {}
  const anyDone = Object.keys(slotMap).length > 0

  // Modo expandible: muestra "+" cuando no hay nada marcado, expande al tocar
  if(SLOT_EXPANDIBLE.has(actId)){
    const donedSlot = slots.find(s => !!slotMap[s.id])
    if(donedSlot){
      const menuKey = actId+'|'+donedSlot.id
      const isMenu = _slotMenu === menuKey
      if(isMenu){
        return `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">${name}</div>
          <div style="border:1px solid ${color};border-radius:7px;overflow:hidden">
            <div style="padding:3px 6px;font-size:10px;color:${color};background:rgba(196,163,90,0.12);text-align:center">${donedSlot.icon} ${donedSlot.label} ✓</div>
            <div style="display:flex">
              <button onclick="editarSlot('${actId}','${donedSlot.id}')" style="flex:1;padding:3px 0;border:none;border-top:1px solid rgba(196,163,90,0.3);background:transparent;color:var(--text-muted);cursor:pointer;font-size:10px;font-family:'Outfit',sans-serif">✏️</button>
              <button onclick="eliminarSlot('${actId}','${donedSlot.id}')" style="flex:1;padding:3px 0;border:none;border-top:1px solid rgba(196,163,90,0.3);border-left:1px solid rgba(196,163,90,0.3);background:transparent;color:var(--red);cursor:pointer;font-size:10px;font-family:'Outfit',sans-serif">🗑️</button>
            </div>
          </div>
        </div>`
      }
      return `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">${name}</div>
        <button onclick="abrirMenuSlot('${actId}','${donedSlot.id}')" style="width:100%;padding:5px 10px;border-radius:7px;border:1px solid ${color};background:rgba(196,163,90,0.12);color:${color};cursor:pointer;font-family:'Outfit',sans-serif;font-size:11px;text-align:left">
          ${donedSlot.icon} ${donedSlot.label} ✓
        </button>
      </div>`
    }
    // Sin marcar
    const isOpen = _slotExpandido === actId
    if(!isOpen){
      return `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">${name}</div>
        <button onclick="_slotExpandido='${actId}';renderMatutinaDash()" style="width:100%;padding:5px 10px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:11px;text-align:left">
          + ¿Frío o completo?
        </button>
      </div>`
    }
    // Picker abierto
    const btnS = (s) => `flex:1;padding:6px 0;border-radius:7px;border:1px solid rgba(196,163,90,0.3);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:11px;text-align:center`
    return `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">${name}</div>
      <div style="display:flex;gap:5px">
        ${slots.map(s => `<button onclick="_slotExpandido=null;marcarSlot('${actId}','${s.id}')" style="${btnS(s)}">${s.icon} ${s.label}</button>`).join('')}
        <button onclick="_slotExpandido=null;renderMatutinaDash()" style="padding:6px 8px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">✕</button>
      </div>
    </div>`
  }
  const btnStyle = (border,bg,col) => `padding:5px 8px;border-radius:7px;border:1px solid ${border};background:${bg};color:${col};cursor:pointer;font-family:'Outfit',sans-serif;font-size:11px;flex:1;text-align:center`
  const buttons = slots.map(s => {
    const log = slotMap[s.id]
    const done = !!log
    const menuKey = actId+'|'+s.id
    const isMenu = _slotMenu === menuKey
    if(done && isMenu){
      return `<div style="flex:1;border:1px solid ${color};border-radius:7px;overflow:hidden">
        <div style="padding:3px 6px;font-size:10px;color:${color};background:rgba(196,163,90,0.12);text-align:center">${s.icon} ${s.label} ✓</div>
        <div style="display:flex">
          <button onclick="editarSlot('${actId}','${s.id}')" style="flex:1;padding:3px 0;border:none;border-top:1px solid rgba(196,163,90,0.3);background:transparent;color:var(--text-muted);cursor:pointer;font-size:10px;font-family:'Outfit',sans-serif">✏️</button>
          <button onclick="eliminarSlot('${actId}','${s.id}')" style="flex:1;padding:3px 0;border:none;border-top:1px solid rgba(196,163,90,0.3);border-left:1px solid rgba(196,163,90,0.3);background:transparent;color:var(--red);cursor:pointer;font-size:10px;font-family:'Outfit',sans-serif">🗑️</button>
        </div>
      </div>`
    }
    const border = done ? color : 'var(--border)'
    const bg     = done ? 'rgba(196,163,90,0.12)' : 'transparent'
    const col    = done ? color : 'var(--text-muted)'
    const fn     = done ? `abrirMenuSlot('${actId}','${s.id}')` : `marcarSlot('${actId}','${s.id}')`
    return `<button onclick="${fn}" style="${btnStyle(border,bg,col)}">${s.icon} ${s.label}${done?' ✓':''}</button>`
  }).join('')
  const editingSlotId = _slotEditing?.startsWith(actId+'|') ? _slotEditing.split('|')[1] : null
  const editSlotConf  = editingSlotId ? slots.find(s => s.id === editingSlotId) : null
  const inputArea = editSlotConf ? `
    <div style="margin-top:5px">
      <input type="text" id="slot-edit-${actId}" placeholder="Nota opcional (${editSlotConf.icon} ${editSlotConf.label})..." style="width:100%;background:#0C0C0C;border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:11px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box">
      <div style="display:flex;gap:5px;margin-top:4px">
        <button onclick="cancelarSlotEdit()" style="flex:1;padding:4px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:11px">Cancelar</button>
        <button onclick="guardarSlotEdit('${actId}','${editingSlotId}')" style="flex:1;padding:4px;border-radius:6px;border:1px solid ${color};background:rgba(196,163,90,0.1);color:${color};cursor:pointer;font-family:'Outfit',sans-serif;font-size:11px">Guardar ✓</button>
      </div>
    </div>` : ''
  return `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:5px">${name}</div>
    <div style="display:flex;gap:5px">${buttons}</div>
    ${inputArea}
  </div>`
}

async function marcarSlot(actId, slotId){
  const id = 'log_'+Date.now()
  const { error } = await SB_P.from('activity_logs').insert({
    id, user_id: USER_ID, activity_id: actId, value: 1, date: TODAY,
    notes: slotId, created_at: new Date().toISOString()
  })
  if(error){ showToast('❌ Error: '+error.message); return }
  if(!slotLogs[actId]) slotLogs[actId] = {}
  slotLogs[actId][slotId] = { id, notes: slotId, created_at: new Date().toISOString() }
  habitLogs[actId] = slotLogs[actId][slotId]
  renderMatutinaDash()
  update2020Widget()
}

function abrirMenuSlot(actId, slotId){
  const key = actId+'|'+slotId
  _slotMenu = _slotMenu === key ? null : key
  renderMatutinaDash()
}

function editarSlot(actId, slotId){
  const log = slotLogs[actId]?.[slotId]
  if(!log) return
  _slotEditing = actId+'|'+slotId
  _slotEditText = (log.notes||'').split('|')[1] || ''
  _slotMenu = null
  renderMatutinaDash()
}

function cancelarSlotEdit(){
  _slotEditing = null
  _slotEditText = ''
  renderMatutinaDash()
}

async function guardarSlotEdit(actId, slotId){
  const log = slotLogs[actId]?.[slotId]
  if(!log) return
  const text = document.getElementById('slot-edit-'+actId)?.value.trim() || ''
  const notes = slotId + (text ? '|'+text : '')
  const { error } = await SB_P.from('activity_logs').update({ notes }).eq('id', log.id)
  if(error){ showToast('❌ Error: '+error.message); return }
  slotLogs[actId][slotId] = { ...log, notes }
  _slotEditing = null
  _slotEditText = ''
  renderMatutinaDash()
}

async function eliminarSlot(actId, slotId){
  const slotLabel = SLOT_HABITS[actId]?.find(s => s.id === slotId)?.label || slotId
  if(!confirm(`¿Eliminar ${slotLabel}?`)) return
  const log = slotLogs[actId]?.[slotId]
  if(!log) return
  await SB_P.from('activity_logs').delete().eq('id', log.id)
  delete slotLogs[actId][slotId]
  _slotMenu = null
  const remaining = Object.values(slotLogs[actId])
  habitLogs[actId] = remaining[0] || null
  renderMatutinaDash()
  update2020Widget()
}

function renderDespertarDash(){
  const el = document.getElementById('dash-despertar-body')
  if(!el) return
  const acts = allActivities.filter(a => a.category === 'despertar' && a.is_active && (a.frequency||'diaria') === 'diaria')
  if(!acts.length){
    el.innerHTML = '<div style="padding:6px 10px;font-size:12px;color:var(--text-muted)">Sin actividades de despertar configuradas</div>'
    return
  }
  el.innerHTML = acts.map(a => {
    const done = !!habitLogs[a.id]
    const hora = a.hora_sugerida ? `<span style="font-size:10px;color:var(--text-muted);margin-left:auto;opacity:.7">${a.hora_sugerida.slice(0,5)}</span>` : ''
    return `<div class="ritual-item${done?' done':''}" onclick="toggleHabito('${a.id}')">
      <div class="ritual-check${done?' done':''}" style="${done?'background:#FFD166;border-color:#FFD166;color:#000':'border-color:rgba(255,209,102,0.4)'}">${done?'✓':''}</div>
      <span class="ritual-label">${a.name}</span>
      ${hora}
    </div>`
  }).join('')
}

function renderAlimentacionDash(){
  const el = document.getElementById('dash-comida-content')
  if(!el) return
  const btnStyle = (border,bg,color) => `padding:7px 10px;border-radius:8px;border:1px solid ${border};background:${bg};color:${color};cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px;flex:1;text-align:left`
  const miniBtn = (onclick,color,label) => `<button onclick="${onclick}" style="flex:1;padding:5px 0;border:none;border-top:1px solid rgba(93,202,165,0.3);background:transparent;color:${color};cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">${label}</button>`
  const buttons = MEALS.map(m => {
    if(m.id === 'extra'){
      const count = extraLogs.length
      const active = _currentMeal === 'extra'
      const border = active ? 'var(--gold)' : count > 0 ? '#5DCAA5' : 'var(--border)'
      const bg     = active ? 'rgba(201,168,76,0.08)' : count > 0 ? 'rgba(93,202,165,0.06)' : 'transparent'
      const color  = active ? 'var(--gold)' : count > 0 ? '#5DCAA5' : 'var(--text-muted)'
      return `<button onclick="abrirComida('extra')" style="${btnStyle(border,bg,color)}">${m.icon} ${m.label}${count>0?` (${count})`:''} +</button>`
    }
    const done   = !!foodLogs[m.id]
    const active = _currentMeal === m.id
    const isMenu = _mealMenu === m.id
    if(done && isMenu){
      return `<div style="flex:1;border:1px solid #5DCAA5;border-radius:8px;overflow:hidden">
        <div style="padding:5px 10px;font-size:12px;color:#5DCAA5;background:rgba(93,202,165,0.12)">${m.icon} ${m.label} ✓</div>
        <div style="display:flex">
          ${miniBtn(`editarComida('${m.id}')`, 'var(--text-muted)', '✏️ Editar')}
          <button onclick="eliminarComida('${m.id}')" style="flex:1;padding:5px 0;border:none;border-top:1px solid rgba(93,202,165,0.3);border-left:1px solid rgba(93,202,165,0.3);background:transparent;color:var(--red);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">🗑️ Eliminar</button>
        </div>
      </div>`
    }
    const border = done ? '#5DCAA5' : active ? 'var(--gold)' : 'var(--border)'
    const bg     = done ? 'rgba(93,202,165,0.12)' : active ? 'rgba(201,168,76,0.08)' : 'transparent'
    const color  = done ? '#5DCAA5' : active ? 'var(--gold)' : 'var(--text-muted)'
    const fn     = done ? `abrirMenuComida('${m.id}')` : `abrirComida('${m.id}')`
    return `<button onclick="${fn}" style="${btnStyle(border,bg,color)}">${m.icon} ${m.label}${done?' ✓':''}</button>`
  }).join('')
  const inputArea = _currentMeal ? `
    <div style="margin-bottom:8px">
      <input type="text" id="comida-input-text" placeholder="¿Qué comiste? (opcional)" style="width:100%;background:#0C0C0C;border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box">
      <div style="display:flex;gap:6px;margin-top:6px">
        <button onclick="cerrarComida()" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px">Cancelar</button>
        <button onclick="guardarComida()" style="flex:1;padding:6px;border-radius:6px;border:1px solid #5DCAA5;background:rgba(93,202,165,0.1);color:#5DCAA5;cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px">Guardar ✓</button>
      </div>
    </div>` : ''
  const regsMeals = MEALS.filter(m => m.id !== 'extra' && foodLogs[m.id]).map(m => {
    const log = foodLogs[m.id]
    const desc = (log.notes||'').split('|')[1] || ''
    const hora = log.created_at ? new Date(log.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : ''
    return `<div style="font-size:11px;color:var(--text-muted);padding:3px 0">${m.icon} <strong style="color:var(--text)">${m.label}</strong>${desc?' — '+desc:''}${hora?' · '+hora:''}</div>`
  })
  const regsExtra = extraLogs.map((log, i) => {
    const desc = (log.notes||'').split('|')[1] || ''
    const hora = log.created_at ? new Date(log.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : ''
    const microBtn = (fn,lbl) => `<button onclick="${fn}" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px 3px;line-height:1">${lbl}</button>`
    return `<div style="font-size:11px;color:var(--text-muted);padding:3px 0;display:flex;align-items:center;gap:4px">
      <span style="flex:1">🍎 <strong style="color:var(--text)">Extra ${i+1}</strong>${desc?' — '+desc:''}${hora?' · '+hora:''}</span>
      ${microBtn(`editarExtra(${i})`, '✏️')}${microBtn(`eliminarExtra(${i})`, '🗑️')}
    </div>`
  })
  const registros = [...regsMeals, ...regsExtra].join('')
  el.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${buttons}</div>
    ${inputArea}
    ${registros ? `<div style="border-top:1px solid var(--border);padding-top:6px">${registros}</div>` : ''}`
  if(_currentMeal){
    const inp = document.getElementById('comida-input-text')
    if(inp){ inp.value = _editInitText; inp.focus() }
  }
}

function abrirMenuComida(meal){
  _mealMenu = _mealMenu === meal ? null : meal
  renderAlimentacionDash()
}

function abrirComida(meal){
  _editingLogId = null
  _editInitText = ''
  _mealMenu = null
  _currentMeal = meal
  renderAlimentacionDash()
}

function editarComida(meal){
  const log = foodLogs[meal]
  if(!log) return
  _editingLogId = log.id
  _editInitText = (log.notes||'').split('|')[1] || ''
  _mealMenu = null
  _currentMeal = meal
  renderAlimentacionDash()
}

async function eliminarComida(meal){
  if(!confirm(`¿Eliminar el registro de ${meal}?`)) return
  const log = foodLogs[meal]
  if(!log) return
  await SB_P.from('activity_logs').delete().eq('id', log.id)
  delete foodLogs[meal]
  _mealMenu = null
  renderAlimentacionDash()
}

function editarExtra(idx){
  const log = extraLogs[idx]
  if(!log) return
  _editingLogId = log.id
  _editInitText = (log.notes||'').split('|')[1] || ''
  _currentMeal = 'extra'
  renderAlimentacionDash()
}

async function eliminarExtra(idx){
  const log = extraLogs[idx]
  if(!log) return
  if(!confirm(`¿Eliminar Extra ${idx+1}?`)) return
  await SB_P.from('activity_logs').delete().eq('id', log.id)
  extraLogs.splice(idx, 1)
  renderAlimentacionDash()
}

function cerrarComida(){
  _currentMeal = null
  _editingLogId = null
  _editInitText = ''
  _mealMenu = null
  renderAlimentacionDash()
}

async function guardarComida(){
  if(!_currentMeal) return
  const text = document.getElementById('comida-input-text')?.value.trim() || ''
  const notes = _currentMeal + (text ? '|'+text : '')
  if(_editingLogId){
    const { error } = await SB_P.from('activity_logs').update({ notes }).eq('id', _editingLogId)
    if(error){ showToast('❌ Error: '+error.message); return }
    if(_currentMeal === 'extra'){
      const idx = extraLogs.findIndex(l => l.id === _editingLogId)
      if(idx !== -1) extraLogs[idx] = { ...extraLogs[idx], notes }
    } else {
      foodLogs[_currentMeal] = { ...foodLogs[_currentMeal], notes }
    }
  } else {
    const id = 'log_'+Date.now()
    const { error } = await SB_P.from('activity_logs').insert({
      id, user_id: USER_ID, activity_id: 'a15', value: 1, date: TODAY, notes,
      created_at: new Date().toISOString()
    })
    if(error){ showToast('❌ Error: '+error.message); return }
    const newLog = { id, notes, created_at: new Date().toISOString() }
    if(_currentMeal === 'extra') extraLogs.push(newLog)
    else foodLogs[_currentMeal] = newLog
  }
  _editingLogId = null
  _editInitText = ''
  _currentMeal = null
  renderAlimentacionDash()
}

let _trabajoExpandido = false
let _trabajoPanelOpen = false
let _trabajoPanelQuery = ''

function renderTrabajoDash(){
  const TARGETS = ['trabajo-expandible', 'trabajo-expandible-r']
  const QUICK_LINKS = {
    'Grabar contenido':         {label:'🎬 Guiones', section:'guiones'},
    'Trabajo tecnico IArcanIA': {label:'🖥️ Workspace', section:'workspace'},
  }
  const acts   = allActivities.filter(a => a.category === 'trabajo_profundo' && a.is_active)
  const doneH  = acts.filter(a => !!habitLogs[a.id])
  const doneT  = trabajoFocusItems.filter(x => x.completed)

  let html
  if(!_trabajoExpandido){
    const partes = []
    if(doneH.length) partes.push(`${doneH.length} hábito${doneH.length>1?'s':''}`)
    if(doneT.length) partes.push(`${doneT.length} tarea${doneT.length>1?'s':''}`)
    const resumen = partes.length
      ? `<span style="color:var(--gold);font-size:11px">${partes.join(' · ')}</span>`
      : `<span style="color:var(--text-muted);font-size:11px">Sin marcar</span>`
    html = `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
      <div style="font-size:11px;color:var(--text-muted)">${doneH.length}/${acts.length} · ${doneT.length} tareas</div>
      ${resumen}
      <button onclick="_trabajoExpandido=true;renderTrabajoDash()" style="margin-left:auto;padding:4px 12px;border-radius:6px;border:1px solid rgba(201,168,76,0.35);background:transparent;color:var(--gold);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">+ abrir</button>
    </div>`
  } else {
    // Bloque 1: hábitos fijos
    const habitItems = acts.map(a => {
      const isDone = !!habitLogs[a.id]
      const link = QUICK_LINKS[a.name]
      const linkBtn = link
        ? `<button onclick="event.stopPropagation();navTo('${link.section}')" style="font-size:10px;padding:2px 7px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif">${link.label}</button>`
        : ''
      return `<div class="ritual-item${isDone?' done':''}" onclick="_marcarTrabajo('${a.id}')">
        <div class="ritual-check${isDone?' done':''}" style="${isDone?'background:var(--gold);border-color:var(--gold);color:#000':'border-color:rgba(201,168,76,0.4)'}">${isDone?'✓':''}</div>
        <span class="ritual-label">${a.name}</span>
        ${linkBtn}
      </div>`
    }).join('')

    // Bloque 2: tareas ad-hoc
    const tareaItems = trabajoFocusItems.map(fi => {
      const task = allTasks.find(t => t.id === fi.task_id)
      const cita = (typeof allCitas !== 'undefined' ? allCitas : []).find(c => c.id === fi.task_id)
      const item = task || cita
      if(!item) return ''
      const name = item.title || item.name || '?'
      const done = !!fi.completed
      return `<div class="ritual-item${done?' done':''}" style="opacity:${done?'.6':'1'}">
        <div class="ritual-check${done?' done':''}" onclick="_toggleTrabajoFocus('${fi.id}')" style="${done?'background:var(--gold);border-color:var(--gold);color:#000':'border-color:rgba(201,168,76,0.4)'}cursor:pointer">${done?'✓':''}</div>
        <span class="ritual-label" style="flex:1">${name}</span>
        <button onclick="_quitarTrabajoFocus('${fi.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px 6px">✕</button>
      </div>`
    }).filter(Boolean).join('')

    // Panel de búsqueda
    const panelHtml = _trabajoPanelOpen ? `
      <div style="margin-top:8px;background:#0C0C0C;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border)">
          <span style="font-size:12px;font-weight:600;color:var(--text-dim)">Agregar tarea</span>
          <button onclick="_trabajoPanelOpen=false;renderTrabajoDash()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;font-family:'Outfit',sans-serif">✕</button>
        </div>
        <div style="padding:8px 10px 4px">
          <input type="text" placeholder="🔍 Buscar tarea o cita..." oninput="_trabajoPanelQuery=this.value;_renderTrabajoPanelList()" id="trabajo-panel-input" style="width:100%;background:#111;border:1px solid var(--border);border-radius:6px;padding:7px 10px;color:var(--text);font-size:12px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box">
        </div>
        <div id="trabajo-panel-list" style="max-height:220px;overflow-y:auto"></div>
        <div style="display:flex;gap:8px;padding:8px 10px;border-top:1px solid var(--border)">
          <button onclick="openNewTask()" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">+ Crear tarea</button>
          <button onclick="openModal('nueva-cita')" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">+ Crear cita</button>
        </div>
      </div>` : ''

    html = `
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;padding:4px 0 2px">Hábitos</div>
      ${habitItems}
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;padding:8px 0 2px;display:flex;align-items:center;justify-content:space-between">
        <span>Tareas del día</span>
        <button onclick="_trabajoPanelOpen=!_trabajoPanelOpen;renderTrabajoDash()" style="padding:2px 8px;border-radius:5px;border:1px solid rgba(201,168,76,0.3);background:transparent;color:var(--gold);cursor:pointer;font-size:10px;font-family:'Outfit',sans-serif">+ Agregar</button>
      </div>
      ${tareaItems || '<div style="font-size:11px;color:var(--text-muted);padding:4px 0">Sin tareas agregadas</div>'}
      ${panelHtml}
      <div style="padding:6px 0 2px;display:flex;justify-content:flex-end">
        <button onclick="_trabajoExpandido=false;_trabajoPanelOpen=false;renderTrabajoDash()" style="padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">✕ Cerrar</button>
      </div>`
  }

  TARGETS.forEach(id => {
    const el = document.getElementById(id)
    if(el) el.innerHTML = html
  })

  if(_trabajoPanelOpen){
    _renderTrabajoPanelList()
    setTimeout(() => document.getElementById('trabajo-panel-input')?.focus(), 50)
  }
}

function _renderTrabajoPanelList(){
  const el = document.getElementById('trabajo-panel-list')
  if(!el) return
  const q = (_trabajoPanelQuery || '').toLowerCase()
  const yaIds = new Set(trabajoFocusItems.map(x => x.task_id))
  const tasks = allTasks.filter(t => t.status !== 'completada' && t.status !== 'archivada' && !yaIds.has(t.id) && (!q || (t.title||'').toLowerCase().includes(q)))
  const citas = (typeof allCitas !== 'undefined' ? allCitas : []).filter(c => !yaIds.has(c.id) && (!q || (c.title||'').toLowerCase().includes(q)))
  const items = [...tasks, ...citas]
  if(!items.length){
    el.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text-muted);text-align:center">Sin resultados</div>'
    return
  }
  el.innerHTML = items.slice(0,20).map(item => {
    const isCita = !item.status
    const icon = isCita ? '📅' : '📋'
    return `<div onclick="_agregarTrabajoFocus('${item.id}')" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:8px" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
      <span style="font-size:11px">${icon}</span>
      <span style="flex:1">${item.title || item.name}</span>
    </div>`
  }).join('')
}

async function _agregarTrabajoFocus(taskId){
  const ya = trabajoFocusItems.find(x => x.task_id === taskId)
  if(ya) return
  const rec = { id: 'tf_'+Date.now(), user_id: USER_ID, date: TODAY, task_id: taskId, list_type: 'trabajo', completed: false, sort_order: trabajoFocusItems.length }
  await SB_P.from('daily_focus').insert(rec)
  trabajoFocusItems.push(rec)
  _trabajoPanelQuery = ''
  renderTrabajoDash()
}

async function _toggleTrabajoFocus(focusId){
  const fi = trabajoFocusItems.find(x => x.id === focusId)
  if(!fi) return
  fi.completed = !fi.completed
  await SB_P.from('daily_focus').update({ completed: fi.completed }).eq('id', focusId)

  // Sincronizar a_t1h igual que los hábitos fijos de trabajo
  const T1H = 'a_t1h'
  const actsHecho = allActivities.filter(a => a.category === 'trabajo_profundo' && a.is_active).some(a => !!habitLogs[a.id])
  const tareaHecha = trabajoFocusItems.some(x => x.completed)
  const alguno = actsHecho || tareaHecha
  if(alguno && !habitLogs[T1H]){
    const log = { id:'log_'+Date.now()+'_t1h', user_id: USER_ID, activity_id: T1H, value: 1, date: selectedDate }
    await SB_P.from('activity_logs').insert(log)
    habitLogs[T1H] = log
    showToast('💼 ¡Trabajar 1 hora completado automáticamente!')
  } else if(!alguno && habitLogs[T1H]){
    await SB_P.from('activity_logs').delete().eq('id', habitLogs[T1H].id)
    delete habitLogs[T1H]
  }
  renderTrabajoDash()
  renderHabitos()
}

async function _quitarTrabajoFocus(focusId){
  await SB_P.from('daily_focus').delete().eq('id', focusId)
  trabajoFocusItems = trabajoFocusItems.filter(x => x.id !== focusId)
  renderTrabajoDash()
}

function renderRutinaNocturnaDash(){
  const el = document.getElementById('dash-noche-body')
  if(!el) return
  const acts = allActivities.filter(a => a.category === 'rutina_nocturna' && a.is_active && (a.frequency||'diaria') === 'diaria').sort((a,b) => (a.hora_sugerida||'').localeCompare(b.hora_sugerida||''))
  if(!acts.length){
    el.innerHTML = '<div style="padding:6px 10px;font-size:12px;color:var(--text-muted)">Sin actividades de rutina nocturna configuradas</div>'
    return
  }
  el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px">${
    acts.map(a => {
      const done = !!habitLogs[a.id]
      const hora = a.hora_sugerida ? `<span style="font-size:10px;color:var(--text-muted);margin-left:auto;opacity:.7">${a.hora_sugerida.slice(0,5)}</span>` : ''
      return `<div class="ritual-item${done?' done':''}" onclick="toggleHabito('${a.id}')">
        <div class="ritual-check${done?' done':''}" style="${done?'background:#378ADD;border-color:#378ADD;color:#000':'border-color:rgba(55,138,221,0.4)'}">${done?'✓':''}</div>
        <span class="ritual-label">${a.name}</span>
        ${hora}
      </div>`
    }).join('')
  }</div>`
}

function renderInicioDiaDash(){
  const el = document.getElementById('dash-iniciod-body')
  if(!el) return
  const acts = allActivities.filter(a => a.category === 'inicio_dia' && a.is_active).sort((a,b) => (a.hora_sugerida||'').localeCompare(b.hora_sugerida||''))
  if(!acts.length){
    el.innerHTML = '<div style="padding:6px 10px;font-size:12px;color:var(--text-muted)">Sin actividades configuradas</div>'
    return
  }
  el.innerHTML = acts.map(a => {
    const done = !!habitLogs[a.id]
    const hora = a.hora_sugerida ? `<span style="font-size:10px;color:var(--text-muted);margin-left:auto;opacity:.7">${a.hora_sugerida.slice(0,5)}</span>` : ''
    return `<div class="ritual-item${done?' done':''}" onclick="toggleHabito('${a.id}')">
      <div class="ritual-check${done?' done':''}" style="${done?'background:#5DCAA5;border-color:#5DCAA5;color:#000':'border-color:rgba(93,202,165,0.4)'}">${done?'✓':''}</div>
      <span class="ritual-label">${a.name}</span>
      ${hora}
    </div>`
  }).join('')
}

function renderCierreDiaDash(){
  const el = document.getElementById('dash-cierre-body')
  if(!el) return
  const acts = allActivities.filter(a => a.category === 'cierre_dia' && a.is_active).sort((a,b) => (a.hora_sugerida||'').localeCompare(b.hora_sugerida||''))
  if(!acts.length){
    el.innerHTML = '<div style="padding:6px 10px;font-size:12px;color:var(--text-muted)">Sin actividades configuradas</div>'
    return
  }
  el.innerHTML = acts.map(a => {
    const done = !!habitLogs[a.id]
    return `<div class="ritual-item${done?' done':''}" onclick="toggleHabito('${a.id}')">
      <div class="ritual-check${done?' done':''}" style="${done?'background:#6B7FD4;border-color:#6B7FD4;color:#000':'border-color:rgba(107,127,212,0.4)'}">${done?'✓':''}</div>
      <span class="ritual-label">${a.name}</span>
    </div>`
  }).join('')
}

// --- CITAS DEL DÍA (agenda localStorage) ---
function getCitasHoy(){
  const data = JSON.parse(localStorage.getItem('agenda_' + TODAY) || '{}')
  const citas = []
  Object.entries(data).forEach(([slot, items]) => {
    items.forEach(x => { if(x.type === 'cita') citas.push({ slot, title: x.title || '?', id: x.id }) })
  })
  return citas.sort((a,b) => a.slot.localeCompare(b.slot))
}

function renderCitasEnDashboard(){
  const el = document.getElementById('dash-citas-hoy')
  if(!el) return
  const focusIds = new Set(hoyFocusItems.map(x => x.task_id))
  const citas = getCitasHoy().filter(c => !focusIds.has(c.id))
  if(!citas.length){ el.innerHTML = ''; return }
  const collapsed = el.dataset.collapsed === '1'
  const listHTML = citas.map(c =>
    `<div style="font-size:11px;color:#EF9F27;padding:2px 0 2px 14px">⏰ ${c.slot} — ${c.title}</div>`
  ).join('')
  el.innerHTML = `<div style="background:rgba(239,159,39,0.08);border:1px solid rgba(239,159,39,0.3);border-radius:8px;padding:8px 10px;margin-bottom:8px;cursor:pointer" onclick="this.parentElement.dataset.collapsed=this.parentElement.dataset.collapsed==='1'?'0':'1';renderCitasEnDashboard()">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:12px;font-weight:600;color:#EF9F27">🏥 Tienes ${citas.length} cita${citas.length>1?'s':''} hoy</span>
      <span style="font-size:11px;color:#EF9F27">${collapsed?'▶':'▼'}</span>
    </div>
    ${collapsed?'':listHTML}
  </div>`
}

// --- DASHBOARD TASK LISTS ('hoy' + 'extra' → Supabase daily_focus por list_type) ---
// SQL migration: ALTER TABLE public.daily_focus ADD COLUMN IF NOT EXISTS list_type text DEFAULT 'hoy';
function getDashList(list){
  if(list === 'hoy')   return hoyFocusItems.map(x => x.task_id)
  if(list === 'extra') return extraFocusItems.map(x => x.task_id)
  return JSON.parse(localStorage.getItem('tareas_'+list+'_ids') || '[]')
}

function setDashList(list, newIds){
  if(list === 'hoy' || list === 'extra'){
    const focusArr = list === 'hoy' ? hoyFocusItems : extraFocusItems
    const oldIds   = focusArr.map(x => x.task_id)
    const toAdd    = newIds.filter(id => !oldIds.includes(id))
    const toRemove = oldIds.filter(id => !newIds.includes(id))
    // Actualizar memoria inmediatamente (sync) para que la UI no espere
    if(list === 'hoy'){
      hoyFocusItems   = hoyFocusItems.filter(x => !toRemove.includes(x.task_id))
    } else {
      extraFocusItems = extraFocusItems.filter(x => !toRemove.includes(x.task_id))
    }
    const insertRows = toAdd.map((id, i) => ({
      id: 'df_' + Date.now() + '_' + i,
      user_id: USER_ID,
      task_id: id,
      task_type: (typeof allCitas !== 'undefined' && allCitas.find(c => c.id === id)) ? 'cita' : 'task',
      date: TODAY,
      sort_order: newIds.indexOf(id),
      list_type: list
    }))
    if(list === 'hoy'){
      hoyFocusItems.push(...insertRows)
    } else {
      extraFocusItems.push(...insertRows)
    }
    // Supabase fire-and-forget
    if(toRemove.length) SB_P.from('daily_focus').delete().eq('user_id', USER_ID).eq('date', TODAY).eq('list_type', list).in('task_id', toRemove)
    if(toAdd.length)    SB_P.from('daily_focus').insert(insertRows)
    return
  }
  localStorage.setItem('tareas_'+list+'_ids', JSON.stringify(newIds))
}

function renderDashTasksSection(elId, tasks, listKey){
  const el = document.getElementById(elId)
  if(!el) return
  const isHoy = listKey === 'hoy' || listKey === 'extra'
  if(!tasks.length){
    el.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:var(--text-muted)">Ninguna tarea seleccionada. Usa el buscador de abajo.</div>'
    return
  }
  const noteEditor = (id, note) => `<div id="focus-note-editor-${id}" style="display:none;margin-top:4px">
    <input type="text" placeholder="Escribe una nota..." onkeydown="if(event.key==='Enter')saveFocusNote('${id}',this.value);else if(event.key==='Escape')this.parentElement.style.display='none'" onblur="saveFocusNote('${id}',this.value)" style="width:100%;background:#111;border:1px solid var(--border);border-radius:4px;padding:4px 7px;color:var(--text);font-size:11px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box">
  </div>`
  el.innerHTML = tasks.map(t => {
    if(t._isHabit){
      const hColor = t._habitColor || '#f97316'
      const fc = isHoy ? t._focusCompleted : false
      const fn = isHoy ? (t._focusNote || '') : ''
      return `<div class="task-item${fc?' done':''}" style="border-left-color:${fc?'var(--border)':hColor}">
        <div class="task-check" onclick="event.stopPropagation();toggleFocusCheck('${t.id}')" style="cursor:pointer;border-color:${fc?hColor:'rgba(249,115,22,0.4)'};${fc?`background:${hColor};color:#fff;`:''}">${fc?'✓':''}</div>
        <div class="task-text">
          <div style="${fc?'text-decoration:line-through;':''}color:${fc?'var(--text-muted)':hColor};font-weight:500">🔥 ${t.title}</div>
          ${fn?`<div style="font-size:10px;color:var(--text-muted);margin-top:2px">📝 ${fn}</div>`:''}
          ${isHoy?noteEditor(t.id, fn):''}
        </div>
        <div class="task-cat" style="color:${fc?'var(--text-muted)':hColor}">Hábito</div>
        ${isHoy?`<button class="habito-toggle" onclick="openFocusNote('${t.id}')" title="Nota" style="font-size:12px;padding:3px 5px;color:var(--text-muted)">📝</button>`:''}
        <button class="habito-toggle" onclick="removeDashTask('${listKey}','${t.id}')" title="Quitar" style="font-size:15px;color:var(--text-muted)">×</button>
      </div>`
    }
    if(t._isCita){
      const fc   = isHoy ? (t._focusCompleted || t.status === 'completada') : false
      const fn   = isHoy ? (t._focusNote || '') : ''
      const citaColor = fc ? 'var(--text-muted)' : '#EF9F27'
      const citaObj = (typeof allCitas !== 'undefined' ? allCitas : []).find(c => c.id === t.id)
      const hora = citaObj?.datetime
        ? new Date(citaObj.datetime).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:false})
        : null
      const checkStyle = fc
        ? `background:#EF9F27;border-color:#EF9F27;color:#fff`
        : `border-color:rgba(239,159,39,0.5)`
      return `<div class="task-item${fc?' done':''}" style="border-left-color:${fc?'var(--border)':'#EF9F27'}">
        <div class="task-check" onclick="event.stopPropagation();toggleFocusCheck('${t.id}')" style="cursor:pointer;border-color:${fc?'#EF9F27':'rgba(239,159,39,0.5)'};${fc?'background:#EF9F27;color:#fff;':''}">${fc?'✓':''}</div>
        <div class="task-text">
          <div style="${fc?'text-decoration:line-through;':''}color:${citaColor};font-weight:500">🏥 ${t.title}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">📅 Hoy${hora?' · 🕐 '+hora:''}</div>
          ${fn?`<div style="font-size:10px;color:var(--text-muted);margin-top:2px">📝 ${fn}</div>`:''}
          ${isHoy?noteEditor(t.id, fn):''}
        </div>
        <div class="task-cat" style="color:${citaColor}">Cita</div>
        ${isHoy?`<button class="habito-toggle" onclick="openFocusNote('${t.id}')" title="Nota" style="font-size:12px;padding:3px 5px;color:var(--text-muted)">📝</button>`:''}
        <button class="habito-toggle" onclick="removeDashTask('${listKey}','${t.id}')" title="Quitar" style="font-size:15px;color:var(--text-muted)">×</button>
      </div>`
    }
    const cat  = CATS[t.category] || CATS.habitos
    const fc   = isHoy ? (t._focusCompleted || t.status === 'completada') : (t.status === 'completada')
    const fn   = isHoy ? (t._focusNote || '') : ''
    const isOverdue = t.due_date && (t.due_date||'').slice(0,10) < todayBogota() && !fc
    const horaTask = t.notes && /^\d{2}:\d{2}$/.test(t.notes.trim()) ? t.notes.trim() : null
    const fecha = t.due_date || null
    const checkClick = isHoy ? `event.stopPropagation();toggleFocusCheck('${t.id}')` : `toggleTask('${t.id}')`
    return `<div class="task-item${fc?' done':''}" style="border-left-color:${fc?'var(--border)':isOverdue?'var(--red)':cat.color}">
      <div class="task-check" onclick="${checkClick}" style="${fc?`background:${cat.color};border-color:${cat.color}`:''}cursor:pointer">${fc?'✓':''}</div>
      <div class="task-text"${!isHoy?` onclick="${checkClick}" style="cursor:pointer"`:''}>
        <div${fc?' style="text-decoration:line-through"':''}>${t.title}</div>
        ${isOverdue?`<div style="font-size:10px;color:var(--red);margin-top:2px">⚠️ Vencida: ${fecha}</div>`:
          (horaTask||fecha)?`<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${fecha?'📅 '+fecha:''}${horaTask?' 🕐'+horaTask:''}</div>`:''}
        ${fn?`<div style="font-size:10px;color:var(--text-muted);margin-top:2px">📝 ${fn}</div>`:''}
        ${isHoy?noteEditor(t.id, fn):''}
      </div>
      <div class="task-cat" style="color:${fc?'var(--text-muted)':cat.color}">${cat.label}</div>
      ${isOverdue&&!isHoy?`<button class="habito-toggle" onclick="event.stopPropagation();reasignarTarea('${t.id}')" title="Reasignar" style="color:var(--amber);border-color:rgba(239,159,39,.3)">↻</button>`:''}
      ${isHoy?`<button class="habito-toggle" onclick="openFocusNote('${t.id}')" title="Nota" style="font-size:12px;padding:3px 5px;color:var(--text-muted)">📝</button>`:''}
      <button class="habito-toggle" onclick="removeDashTask('${listKey}','${t.id}')" title="Quitar" style="font-size:15px;color:var(--text-muted)">×</button>
    </div>`
  }).join('')
}

function findFocusItem(taskId){
  return hoyFocusItems.find(x => x.task_id === taskId) || extraFocusItems.find(x => x.task_id === taskId)
}

async function toggleFocusCheck(taskId){
  const item = findFocusItem(taskId)
  if(!item) return
  const newCompleted = !item.completed
  item.completed = newCompleted
  const newStatus = newCompleted ? 'completada' : 'pendiente'
  SB_P.from('daily_focus').update({ completed: newCompleted }).eq('id', item.id)
  // Detectar tipo — cita, hábito o tarea
  const cita = (typeof allCitas !== 'undefined' ? allCitas : []).find(c => c.id === taskId)
  const act  = (typeof allActivities !== 'undefined' ? allActivities : []).find(a => a.id === taskId)
  if(cita || item.task_type === 'cita'){
    SB_P.from('appointments').update({ status: newStatus }).eq('id', taskId)
    allCitas = allCitas.map(c => c.id === taskId ? { ...c, status: newStatus } : c)
  } else if(act || item.task_type === 'habit'){
    if(newCompleted){
      const logId = 'log_' + Date.now()
      const log = { id: logId, user_id: USER_ID, activity_id: taskId, value: 1, date: TODAY }
      SB_P.from('activity_logs').insert(log)
      habitLogs[taskId] = log
    } else {
      const existingLog = habitLogs[taskId]
      if(existingLog){ SB_P.from('activity_logs').delete().eq('id', existingLog.id); delete habitLogs[taskId] }
    }
  } else {
    const task = allTasks.find(t => t.id === taskId)
    if(task){
      SB_P.from('tasks').update({ status: newStatus }).eq('id', taskId)
      task.status = newStatus
    }
  }
  renderTasks()
}

function openFocusNote(taskId){
  const ed  = document.getElementById('focus-note-editor-' + taskId)
  const item = findFocusItem(taskId)
  if(!ed) return
  const inp = ed.querySelector('input')
  if(inp) inp.value = item?.notes || ''
  ed.style.display = 'block'
  if(inp) inp.focus()
}

function saveFocusNote(taskId, note){
  const item = findFocusItem(taskId)
  if(!item) return
  const ed = document.getElementById('focus-note-editor-' + taskId)
  if(ed) ed.style.display = 'none'
  const trimmed = (note || '').trim()
  if((item.notes || '') === trimmed) return
  item.notes = trimmed || null
  SB_P.from('daily_focus').update({ notes: item.notes }).eq('id', item.id)
  renderTasks()
}

function addDashTask(list, id){
  const ids = getDashList(list)
  if(list === 'hoy' && ids.length >= 5){ showToast('Máximo 5 tareas en "Mis 5 tareas"'); return }
  if(!ids.includes(id)) ids.push(id)
  setDashList(list, ids)
  const inp = document.getElementById('search-'+list)
  const sugg = document.getElementById('sugg-'+list)
  if(inp) inp.value = ''
  if(sugg){ sugg.innerHTML = ''; sugg.style.display = 'none' }
  renderTasks()
}

function removeDashTask(list, id){
  setDashList(list, getDashList(list).filter(i => i !== id))
  renderTasks()
  if(list === 'hoy'){
    if(document.getElementById('panel-add-hoy')?.style.display !== 'none'){
      renderTodayTaskPanel(document.getElementById('search-hoy-panel')?.value || '')
    }
    if(document.getElementById('panel-citas-hoy')?.style.display !== 'none'){
      renderCitasHoyPanel()
    }
  }
  if(list === 'extra'){
    if(document.getElementById('panel-add-extra')?.style.display !== 'none'){
      renderExtraTaskPanel(document.getElementById('search-extra-panel')?.value || '')
    }
    if(document.getElementById('panel-citas-extra')?.style.display !== 'none'){
      renderExtraCitasPanel()
    }
  }
}

function searchDashTask(list, query){
  const sugg = document.getElementById('sugg-'+list)
  if(!sugg) return
  if(!query.trim()){ sugg.innerHTML = ''; sugg.style.display = 'none'; return }
  const ids = getDashList(list)
  const matches = allTasks
    .filter(t => t.status !== 'completada' && !ids.includes(t.id) && t.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6)
  if(!matches.length){ sugg.innerHTML = ''; sugg.style.display = 'none'; return }
  sugg.style.display = 'block'
  sugg.innerHTML = matches.map(t => {
    const cat = CATS[t.category] || CATS.habitos
    return `<div onclick="addDashTask('${list}','${t.id}')" style="cursor:pointer;padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text);display:flex;align-items:center;gap:8px">
      <span style="color:${cat.color};font-size:8px">●</span>
      <span style="flex:1">${t.title}</span>
      <span style="font-size:10px;color:${cat.color}">${cat.label}</span>
    </div>`
  }).join('')
}

function openTodayTaskPanel(){
  const panel = document.getElementById('panel-add-hoy')
  const btns  = document.getElementById('btns-add-hoy')
  const inp   = document.getElementById('search-hoy-panel')
  if(!panel) return
  panel.style.display = 'block'
  if(btns) btns.style.display = 'none'
  if(inp){ inp.value = ''; inp.focus() }
  renderTodayTaskPanel('')
}

function closeTodayTaskPanel(){
  const panel = document.getElementById('panel-add-hoy')
  const btns  = document.getElementById('btns-add-hoy')
  if(panel) panel.style.display = 'none'
  if(btns) btns.style.display = 'flex'
}

function openCitasHoyPanel(){
  const panel = document.getElementById('panel-citas-hoy')
  const btns  = document.getElementById('btns-add-hoy')
  if(!panel) return
  panel.style.display = 'block'
  if(btns) btns.style.display = 'none'
  renderCitasHoyPanel()
}

function closeCitasHoyPanel(){
  const panel = document.getElementById('panel-citas-hoy')
  const btns  = document.getElementById('btns-add-hoy')
  if(panel) panel.style.display = 'none'
  if(btns) btns.style.display = 'flex'
}

// --- PANELES TAREAS EXTRA ---
function openExtraTaskPanel(){
  const panel = document.getElementById('panel-add-extra')
  const btns  = document.getElementById('btns-add-extra')
  const inp   = document.getElementById('search-extra-panel')
  if(!panel) return
  panel.style.display = 'block'
  if(btns) btns.style.display = 'none'
  if(inp){ inp.value = ''; inp.focus() }
  renderExtraTaskPanel('')
}
function closeExtraTaskPanel(){
  const panel = document.getElementById('panel-add-extra')
  const btns  = document.getElementById('btns-add-extra')
  if(panel) panel.style.display = 'none'
  if(btns) btns.style.display = 'flex'
}
function openExtraCitasPanel(){
  const panel = document.getElementById('panel-citas-extra')
  const btns  = document.getElementById('btns-add-extra')
  if(!panel) return
  panel.style.display = 'block'
  if(btns) btns.style.display = 'none'
  renderExtraCitasPanel()
}
function closeExtraCitasPanel(){
  const panel = document.getElementById('panel-citas-extra')
  const btns  = document.getElementById('btns-add-extra')
  if(panel) panel.style.display = 'none'
  if(btns) btns.style.display = 'flex'
}
function renderExtraTaskPanel(query){
  const el = document.getElementById('panel-extra-list')
  if(!el) return
  const extraIds = getDashList('extra')
  const q = (query||'').toLowerCase().trim()
  const tasks = allTasks.filter(t => t.status !== 'completada' && (!q || t.title.toLowerCase().includes(q)))
  if(!tasks.length){
    el.innerHTML = '<div style="padding:12px 10px;font-size:12px;color:var(--text-muted);text-align:center">No hay tareas pendientes</div>'
    return
  }
  const groups = {}
  tasks.forEach(t => { const k = t.category||'habitos'; if(!groups[k]) groups[k]=[]; groups[k].push(t) })
  el.innerHTML = Object.entries(groups).map(([catKey, catTasks]) => {
    const cat = CATS[catKey] || CATS.habitos
    const pending = catTasks.filter(t => !extraIds.includes(t.id)).length
    return `<div>
      <div style="padding:6px 10px;font-size:11px;font-weight:600;color:${cat.color};display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.25);position:sticky;top:0">
        <span style="width:7px;height:7px;border-radius:50%;background:${cat.color};display:inline-block;flex-shrink:0"></span>
        ${cat.label}<span style="font-size:10px;color:var(--text-muted);font-weight:400">(${pending} pendientes)</span>
      </div>
      ${catTasks.map(t => {
        const added = extraIds.includes(t.id)
        const onclick = added ? '' : "addDashTaskFromExtraPanel('" + t.id + "')"
        return `<div onclick="${onclick}"
          style="display:flex;align-items:center;gap:8px;padding:7px 10px 7px 22px;cursor:${added?'default':'pointer'};border-bottom:1px solid rgba(255,255,255,0.04)"
          ${!added?`onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''"`:''}>
          <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${added?cat.color:'var(--border)'};background:${added?cat.color:'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff">${added?'✓':''}</div>
          <span style="flex:1;font-size:12px;color:${added?'var(--text-muted)':'var(--text)'}${added?';text-decoration:line-through':''}">${t.title}</span>
        </div>`
      }).join('')}
    </div>`
  }).join('')
}
function renderExtraCitasPanel(){
  const el = document.getElementById('panel-citas-extra-list')
  if(!el) return
  const extraIds = getDashList('extra')
  const citas = (typeof allCitas !== 'undefined' ? allCitas : [])
    .filter(c => c.status === 'pendiente' && c.datetime && c.datetime >= TODAY)
    .sort((a,b) => new Date(a.datetime)-new Date(b.datetime))
  if(!citas.length){
    el.innerHTML = '<div style="padding:12px 10px;font-size:12px;color:var(--text-muted);text-align:center">No hay citas próximas</div>'
    return
  }
  const citasHoy  = citas.filter(c => c.datetime.startsWith(TODAY))
  const citasProx = citas.filter(c => !c.datetime.startsWith(TODAY))
  function citaRow(c){
    const added = extraIds.includes(c.id)
    const onclick = added ? '' : "addCitaToExtraFromPanel('" + c.id + "')"
    const fecha = new Date(c.datetime)
    const hora  = fecha.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:false})
    const dia   = c.datetime.startsWith(TODAY) ? 'Hoy' : fecha.toLocaleDateString('es-CO',{day:'numeric',month:'short'})
    return `<div onclick="${onclick}"
      style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:${added?'default':'pointer'};border-bottom:1px solid rgba(255,255,255,0.04)"
      ${!added?`onmouseenter="this.style.background='rgba(239,159,39,0.06)'" onmouseleave="this.style.background=''"`:''}>
      <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${added?'#EF9F27':'rgba(239,159,39,0.4)'};background:${added?'#EF9F27':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff">${added?'✓':'🏥'}</div>
      <span style="flex:1;font-size:12px;color:${added?'var(--text-muted)':'#EF9F27'}${added?';text-decoration:line-through':''}">${c.title}</span>
      <span style="font-size:11px;color:var(--text-muted)">${dia} ${hora}</span>
    </div>`
  }
  let html = ''
  if(citasHoy.length)  html += `<div style="padding:5px 10px 3px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,0,0,0.3)">Hoy</div>` + citasHoy.map(citaRow).join('')
  if(citasProx.length) html += `<div style="padding:5px 10px 3px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,0,0,0.3)">Próximas</div>` + citasProx.map(citaRow).join('')
  el.innerHTML = html
}
function addDashTaskFromExtraPanel(id){
  const ids = getDashList('extra')
  if(!ids.includes(id)) ids.push(id)
  setDashList('extra', ids)
  renderTasks()
  renderExtraTaskPanel(document.getElementById('search-extra-panel')?.value || '')
}
function addCitaToExtraFromPanel(citaId){
  const ids = getDashList('extra')
  if(!ids.includes(citaId)) ids.push(citaId)
  setDashList('extra', ids)
  renderTasks()
  if(document.getElementById('panel-add-extra')?.style.display !== 'none')
    renderExtraTaskPanel(document.getElementById('search-extra-panel')?.value || '')
  if(document.getElementById('panel-citas-extra')?.style.display !== 'none')
    renderExtraCitasPanel()
}

function renderCitasHoyPanel(){
  const el = document.getElementById('panel-citas-hoy-list')
  if(!el) return
  const hoyIds = getDashList('hoy')
  const full = hoyIds.length >= 5
  const citas = (typeof allCitas !== 'undefined' ? allCitas : [])
    .filter(c => c.status === 'pendiente' && c.datetime && c.datetime >= TODAY)
    .sort((a,b) => new Date(a.datetime)-new Date(b.datetime))
  if(!citas.length){
    el.innerHTML = '<div style="padding:12px 10px;font-size:12px;color:var(--text-muted);text-align:center">No hay citas próximas</div>'
    return
  }
  const citasHoy = citas.filter(c => c.datetime.startsWith(TODAY))
  const citasProx = citas.filter(c => !c.datetime.startsWith(TODAY))
  function citaRow(c){
    const added = hoyIds.includes(c.id)
    const disabled = !added && full
    const fecha = new Date(c.datetime)
    const hora = fecha.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:false})
    const dia = c.datetime.startsWith(TODAY) ? 'Hoy' : fecha.toLocaleDateString('es-CO',{day:'numeric',month:'short'})
    return `<div
      onclick="${added || disabled ? '' : `addCitaToHoyFromPanel('${c.id}')`}"
      style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:${added||disabled?'default':'pointer'};opacity:${disabled?'0.35':'1'};border-bottom:1px solid rgba(255,255,255,0.04)"
      ${!added&&!disabled?`onmouseenter="this.style.background='rgba(239,159,39,0.06)'" onmouseleave="this.style.background=''"`:''}>
      <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${added?'#EF9F27':'rgba(239,159,39,0.4)'};background:${added?'#EF9F27':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff">${added?'✓':'🏥'}</div>
      <span style="flex:1;font-size:12px;color:${added?'var(--text-muted)':'#EF9F27'}${added?';text-decoration:line-through':''}">${c.title}</span>
      <span style="font-size:11px;color:var(--text-muted)">${dia} ${hora}</span>
    </div>`
  }
  let html = ''
  if(citasHoy.length){
    html += `<div style="padding:5px 10px 3px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,0,0,0.3)">Hoy</div>`
    html += citasHoy.map(citaRow).join('')
  }
  if(citasProx.length){
    html += `<div style="padding:5px 10px 3px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;background:rgba(0,0,0,0.3)">Próximas</div>`
    html += citasProx.map(citaRow).join('')
  }
  el.innerHTML = html
}

function renderTodayTaskPanel(query){
  const el = document.getElementById('panel-hoy-list')
  if(!el) return
  if(_quickCreateType) return  // mini-form abierto, no destruir su contexto
  const hoyIds = getDashList('hoy')
  const q = (query||'').toLowerCase().trim()
  const tasks = allTasks.filter(t => t.status !== 'completada' &&
    (!q || t.title.toLowerCase().includes(q)))
  const groups = {}
  tasks.forEach(t => {
    const k = t.category || 'habitos'
    if(!groups[k]) groups[k] = []
    groups[k].push(t)
  })
  const full = hoyIds.length >= 5

  const taskGroupsHTML = Object.entries(groups).map(([catKey, catTasks]) => {
    const cat = CATS[catKey] || CATS.habitos
    const pending = catTasks.filter(t => !hoyIds.includes(t.id)).length
    return `<div>
      <div style="padding:6px 10px;font-size:11px;font-weight:600;color:${cat.color};display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.25);position:sticky;top:0">
        <span style="width:7px;height:7px;border-radius:50%;background:${cat.color};display:inline-block;flex-shrink:0"></span>
        ${cat.label}
        <span style="font-size:10px;color:var(--text-muted);font-weight:400">(${pending} pendientes)</span>
      </div>
      ${catTasks.map(t => {
        const added = hoyIds.includes(t.id)
        const disabled = !added && full
        return `<div
          onclick="${added || disabled ? '' : `addDashTaskFromPanel('${t.id}')`}"
          style="display:flex;align-items:center;gap:8px;padding:7px 10px 7px 22px;cursor:${added||disabled?'default':'pointer'};opacity:${disabled?'0.35':'1'};border-bottom:1px solid rgba(255,255,255,0.04)"
          ${!added&&!disabled?`onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''"`:''}>
          <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${added?cat.color:'var(--border)'};background:${added?cat.color:'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff">${added?'✓':''}</div>
          <span style="flex:1;font-size:12px;color:${added?'var(--text-muted)':'var(--text)'}${added?';text-decoration:line-through':''}">${t.title}</span>
        </div>`
      }).join('')}
    </div>`
  }).join('')

  // Sección citas de hoy
  const citasHoy = (typeof allCitas !== 'undefined' ? allCitas : [])
    .filter(c => c.datetime && c.datetime.startsWith(TODAY) && c.status !== 'cancelada')
  const citasHTML = citasHoy.length ? `<div>
    <div style="padding:6px 10px;font-size:11px;font-weight:600;color:#EF9F27;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.25);position:sticky;top:0">
      <span style="width:7px;height:7px;border-radius:50%;background:#EF9F27;display:inline-block;flex-shrink:0"></span>
      Citas de hoy
    </div>
    ${citasHoy.map(c => {
      const added = hoyIds.includes(c.id)
      const disabled = !added && full
      const hora = c.datetime ? new Date(c.datetime).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:false}) : ''
      return `<div
        onclick="${added || disabled ? '' : `addCitaToHoyFromPanel('${c.id}')`}"
        style="display:flex;align-items:center;gap:8px;padding:7px 10px 7px 22px;cursor:${added||disabled?'default':'pointer'};opacity:${disabled?'0.35':'1'};border-bottom:1px solid rgba(255,255,255,0.04)"
        ${!added&&!disabled?`onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''"`:''}>
        <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${added?'#EF9F27':'var(--border)'};background:${added?'#EF9F27':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff">${added?'✓':'🏥'}</div>
        <span style="flex:1;font-size:12px;color:${added?'var(--text-muted)':'#EF9F27'}${added?';text-decoration:line-through':''}">${c.title}${hora?' · '+hora:''}</span>
      </div>`
    }).join('')}
  </div>` : ''

  const qSafe = q.replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const qLabel = q ? `"${qSafe}"` : 'nueva'
  const _cbs = `padding:5px 10px;background:transparent;border:1px solid var(--border);border-radius:5px;color:var(--text-muted);font-size:11px;font-family:'Outfit',sans-serif;cursor:pointer`
  const createRow = `<div style="border-top:1px solid rgba(255,255,255,0.06);padding:8px 10px">
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">✎ Agregar ${qLabel}:</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button onclick="openQuickCreate('task')" style="${_cbs}">📝 Tarea</button>
      <button onclick="openQuickCreate('cita')" style="${_cbs}">🏥 Cita</button>
      <button onclick="openHabitPanel()" style="${_cbs}">🔥 Hábito</button>
    </div>
  </div>`
  if(!taskGroupsHTML && !citasHTML){
    el.innerHTML = `<div style="padding:12px 10px 4px;font-size:12px;color:var(--text-muted);text-align:center">${q ? 'Sin coincidencias — crea una nueva:' : 'No hay tareas pendientes'}</div>` + createRow
  } else {
    el.innerHTML = taskGroupsHTML + citasHTML + createRow
  }
}

function addCitaToHoyFromPanel(citaId){
  const ids = getDashList('hoy')
  if(ids.length >= 5){ showToast('Máximo 5 tareas en "Mis 5 tareas"'); return }
  if(!ids.includes(citaId)) ids.push(citaId)
  setDashList('hoy', ids)
  renderTasks()
  if(getDashList('hoy').length >= 5){
    closeTodayTaskPanel()
    closeCitasHoyPanel()
    showToast('✅ 5 tareas seleccionadas para hoy')
  } else {
    if(document.getElementById('panel-add-hoy')?.style.display !== 'none'){
      renderTodayTaskPanel(document.getElementById('search-hoy-panel')?.value || '')
    }
    if(document.getElementById('panel-citas-hoy')?.style.display !== 'none'){
      renderCitasHoyPanel()
    }
  }
}

function addDashTaskFromPanel(id){
  const ids = getDashList('hoy')
  if(ids.length >= 5){ showToast('Máximo 5 tareas en "Mis 5 tareas"'); return }
  if(!ids.includes(id)) ids.push(id)
  setDashList('hoy', ids)
  renderTasks()
  const newIds = getDashList('hoy')
  if(newIds.length >= 5){
    closeTodayTaskPanel()
    showToast('✅ 5 tareas seleccionadas para hoy')
  } else {
    renderTodayTaskPanel(document.getElementById('search-hoy-panel')?.value || '')
  }
}

// --- QUICK CREATE (creación inline en panel de hoy) ---
function openQuickCreate(type){
  _quickCreateType = type
  const form = document.getElementById('panel-hoy-create')
  const list = document.getElementById('panel-hoy-list')
  if(!form) return
  if(list) list.style.display = 'none'

  const titlePrefill = (document.getElementById('search-hoy-panel')?.value || '').trim()
  const now  = new Date()
  const dateStr = now.toLocaleDateString('en-CA')
  const nextH = new Date(now.getTime() + 3600000)
  const timeStr = nextH.toTimeString().slice(0,5)

  const inp  = `width:100%;background:#111;border:1px solid var(--border);border-radius:5px;padding:7px 9px;color:var(--text);font-size:12px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box;margin-top:3px`
  const lbl  = `font-size:11px;color:var(--text-muted);display:block;margin-top:8px`
  const sel  = inp + `;appearance:auto`

  let fieldsHTML = ''
  let headerText = ''
  if(type === 'task'){
    headerText = '📝 Nueva tarea'
    fieldsHTML = `
      <label style="${lbl}">Título *</label>
      <input id="phc-inp-title" type="text" value="${titlePrefill.replace(/"/g,'&quot;')}" placeholder="Nombre de la tarea" style="${inp}">
      <label style="${lbl}">Categoría</label>
      <select id="phc-inp-cat" style="${sel}">
        <option value="personal">Personal</option>
        <option value="proyectos">Proyectos</option>
        <option value="iarcania">IArcanIA</option>
        <option value="contenido">Contenido</option>
        <option value="infra">Infraestructura</option>
        <option value="habitos">Hábitos</option>
      </select>
      <label style="${lbl}">Prioridad</label>
      <select id="phc-inp-priority" style="${sel}">
        <option value="media" selected>Media</option>
        <option value="alta">Alta</option>
        <option value="baja">Baja</option>
      </select>
      <label style="${lbl}">Fecha límite</label>
      <input id="phc-inp-due" type="date" value="${dateStr}" style="${inp}">
      <label style="${lbl}">Notas (opcional)</label>
      <input id="phc-inp-notes" type="text" placeholder="Notas..." style="${inp}">`
  } else {
    headerText = '🏥 Nueva cita'
    fieldsHTML = `
      <label style="${lbl}">Título *</label>
      <input id="phc-inp-title" type="text" value="${titlePrefill.replace(/"/g,'&quot;')}" placeholder="Nombre de la cita" style="${inp}">
      <label style="${lbl}">Tipo</label>
      <select id="phc-inp-type" style="${sel}">
        <option value="otro" selected>Otro</option>
        <option value="médica">Médica</option>
        <option value="reunión">Reunión</option>
      </select>
      <label style="${lbl}">Fecha *</label>
      <input id="phc-inp-date" type="date" value="${dateStr}" style="${inp}">
      <label style="${lbl}">Hora</label>
      <input id="phc-inp-time" type="time" value="${timeStr}" style="${inp}">
      <label style="${lbl}">Doctor / persona (opcional)</label>
      <input id="phc-inp-doctor" type="text" placeholder="Dr. García..." style="${inp}">
      <label style="${lbl}">Lugar (opcional)</label>
      <input id="phc-inp-location" type="text" placeholder="Clínica / dirección..." style="${inp}">`
  }

  form.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:12px;font-weight:600;color:var(--text-dim)">${headerText}</span>
      <button onclick="cancelQuickCreate()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 2px;font-family:'Outfit',sans-serif">✕</button>
    </div>
    ${fieldsHTML}
    <div style="display:flex;gap:6px;margin-top:10px">
      <button id="phc-save-btn" onclick="submitQuickCreate()" style="flex:1;padding:8px;background:var(--purple);border:none;border-radius:6px;color:#fff;font-size:12px;font-family:'Outfit',sans-serif;font-weight:600;cursor:pointer">✓ Crear y agregar a hoy</button>
      <button onclick="cancelQuickCreate()" style="padding:8px 12px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:12px;font-family:'Outfit',sans-serif;cursor:pointer">Cancelar</button>
    </div>`
  form.style.display = 'block'
  setTimeout(() => { const i = document.getElementById('phc-inp-title'); if(i){ i.focus(); i.select() } }, 30)
}

function cancelQuickCreate(){
  _quickCreateType = null
  const form = document.getElementById('panel-hoy-create')
  const list = document.getElementById('panel-hoy-list')
  if(form) form.style.display = 'none'
  if(list) list.style.display = 'block'
  renderTodayTaskPanel(document.getElementById('search-hoy-panel')?.value || '')
}

async function submitQuickCreate(){
  const type = _quickCreateType
  if(!type) return
  const titleInp = document.getElementById('phc-inp-title')
  const title = (titleInp?.value || '').trim()
  if(!title){ showToast('⚠️ El título es obligatorio'); titleInp?.focus(); return }
  const hoyIds = getDashList('hoy')
  if(hoyIds.length >= 5){ showToast('Máximo 5 tareas en "Mis 5 tareas"'); return }
  const btn = document.getElementById('phc-save-btn')
  if(btn){ btn.textContent = 'Creando...'; btn.disabled = true }
  try {
    let newId
    if(type === 'task'){
      newId = 'task_' + Date.now()
      const cat = document.getElementById('phc-inp-cat')?.value || 'personal'
      const catObj = CATS[cat] || CATS.personal
      const rec = {
        id:          newId,
        title,
        category:    cat,
        color:       catObj.color,
        priority:    document.getElementById('phc-inp-priority')?.value || 'media',
        due_date:    document.getElementById('phc-inp-due')?.value || null,
        notes:       document.getElementById('phc-inp-notes')?.value.trim() || null,
        assigned_to: USER_ID,
        created_by:  USER_ID,
        status:      'pendiente'
      }
      const { error } = await SB_P.from('tasks').insert(rec)
      if(error) throw new Error(error.message)
      allTasks.push(rec)
    } else {
      newId = 'apt_' + Date.now()
      const dateVal = document.getElementById('phc-inp-date')?.value
      if(!dateVal) throw new Error('La fecha es obligatoria')
      const timeVal = document.getElementById('phc-inp-time')?.value || '00:00'
      const rec = {
        id:          newId,
        user_id:     USER_ID,
        title,
        type:        document.getElementById('phc-inp-type')?.value || 'otro',
        datetime:    new Date(`${dateVal}T${timeVal}:00`).toISOString(),
        location:    document.getElementById('phc-inp-location')?.value.trim() || null,
        doctor_name: document.getElementById('phc-inp-doctor')?.value.trim()   || null,
        reminder_1:  null,
        reminder_2:  null,
        status:      'pendiente'
      }
      const { error } = await SB_P.from('appointments').insert(rec)
      if(error) throw new Error(error.message)
      allCitas = [...allCitas, rec].sort((a,b) => new Date(a.datetime) - new Date(b.datetime))
    }
    const ids = getDashList('hoy')
    if(!ids.includes(newId)) ids.push(newId)
    setDashList('hoy', ids)
    renderTasks()
    cancelQuickCreate()
    const atMax = getDashList('hoy').length >= 5
    if(atMax) closeTodayTaskPanel()
    showToast((type === 'task' ? '✓ Tarea' : '✓ Cita') + ' creada y agregada a hoy' + (atMax ? ' · 5/5 🎯' : ''))
  } catch(e){
    showToast('❌ ' + e.message)
    if(btn){ btn.textContent = '✓ Crear y agregar a hoy'; btn.disabled = false }
  }
}

// --- PANEL HÁBITOS (selección para Mis 5 tareas de hoy) ---
let _habitScheduledIds = new Set()

async function openHabitPanel(){
  const form = document.getElementById('panel-hoy-create')
  const list = document.getElementById('panel-hoy-list')
  if(!form) return
  _quickCreateType = 'habit'
  if(list) list.style.display = 'none'
  form.innerHTML = '<div style="padding:12px 10px;font-size:12px;color:var(--text-muted);text-align:center">Cargando hábitos...</div>'
  form.style.display = 'block'
  const dayName = new Date().toLocaleDateString('es', {weekday:'long'}).toLowerCase()
  const { data: schedules } = await SB_P.from('training_schedule').select('activity_id').eq('user_id', USER_ID).eq('day_of_week', dayName)
  _habitScheduledIds = new Set((schedules || []).map(s => s.activity_id))
  renderHabitPanel()
}

function renderHabitPanel(){
  const form = document.getElementById('panel-hoy-create')
  if(!form || _quickCreateType !== 'habit') return
  const hoyIds = new Set(getDashList('hoy'))
  const full = hoyIds.size >= 5

  const diarios = allActivities.filter(a =>
    a.is_active && (a.frequency === 'diaria' || !a.frequency) &&
    !habitLogs[a.id] && !hoyIds.has(a.id)
  )
  const programados = allActivities.filter(a =>
    a.is_active && a.frequency !== 'diaria' &&
    _habitScheduledIds.has(a.id) && !habitLogs[a.id] && !hoyIds.has(a.id)
  )
  const otros = allActivities.filter(a =>
    a.is_active && ['recurrente','unico','semanal','mensual'].includes(a.frequency) &&
    !_habitScheduledIds.has(a.id) && !habitLogs[a.id] && !hoyIds.has(a.id)
  )

  const rowHtml = (a) => {
    const added    = hoyIds.has(a.id)
    const disabled = !added && full
    const color    = a.color || '#f97316'
    const attrs    = (!added && !disabled) ? `onclick="addHabitToHoy('${a.id}')" onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''"` : ''
    return `<div ${attrs} style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:${added||disabled?'default':'pointer'};opacity:${disabled?'0.35':'1'}">
      <div style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${added?color:'var(--border)'};background:${added?color:'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;color:#fff">${added?'✓':''}</div>
      <span style="flex:1;font-size:12px;color:${added?'var(--text-muted)':'var(--text)'}${added?';text-decoration:line-through':''}">${a.name}</span>
      ${a.category?`<span style="font-size:10px;color:var(--text-muted)">${a.category}</span>`:''}
    </div>`
  }
  const sHdr = (label) => `<div style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;background:rgba(0,0,0,0.3)">${label}</div>`

  let body = ''
  if(diarios.length)    body += sHdr('🔥 Diarios pendientes hoy') + diarios.map(rowHtml).join('')
  if(programados.length) body += sHdr('📅 Programados hoy') + programados.map(rowHtml).join('')
  if(otros.length) body += `<details><summary style="padding:5px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;background:rgba(0,0,0,0.3);cursor:pointer;list-style:none;display:flex;align-items:center;gap:4px">➕ Otros (${otros.length}) ▾</summary>` + otros.map(rowHtml).join('') + '</details>'
  if(!body) body = '<div style="padding:14px 10px;font-size:12px;color:var(--text-muted);text-align:center">No hay hábitos pendientes disponibles</div>'

  form.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;font-weight:600;color:var(--text-dim)">🔥 Seleccionar hábito</span>
      <button onclick="cancelQuickCreate()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 2px;font-family:'Outfit',sans-serif">✕</button>
    </div>
    <div style="max-height:300px;overflow-y:auto">${body}</div>`
}

async function addHabitToHoy(activityId){
  const hoyIds = getDashList('hoy')
  if(hoyIds.length >= 5){ showToast('Máximo 5 tareas en "Mis 5 tareas"'); return }
  if(hoyIds.includes(activityId)) return
  const rec = {
    id:        'df_' + Date.now(),
    user_id:   USER_ID,
    task_id:   activityId,
    task_type: 'habit',
    date:      TODAY,
    sort_order: hoyIds.length,
    completed:  false,
    list_type:  'hoy'
  }
  const { error } = await SB_P.from('daily_focus').insert(rec)
  if(error){ showToast('❌ ' + error.message); return }
  hoyFocusItems.push(rec)
  renderTasks()
  renderHabitPanel()
  const newLen = getDashList('hoy').length
  if(newLen >= 5){ cancelQuickCreate(); closeTodayTaskPanel(); showToast('🔥 Hábito agregado · 5/5 🎯') }
  else { showToast('🔥 Hábito agregado a hoy') }
}

// --- TAREAS VENCIDAS ---
function renderOverdueTasks(tasks){
  const wrap = document.getElementById('overdue-wrap')
  const el   = document.getElementById('overdue-tasks')
  if(!wrap || !el) return
  wrap.style.display = tasks.length ? 'block' : 'none'
  if(!tasks.length) return
  el.innerHTML = tasks.map(t => {
    const cat = CATS[t.category] || CATS.habitos
    return `<div class="task-item" data-id="${t.id}" style="border-left-color:var(--red)">
      <div class="task-check" style="border-color:rgba(226,75,74,0.4)"></div>
      <div class="task-text">
        <div>${t.title}</div>
        <div style="font-size:10px;color:var(--red);margin-top:2px">⚠️ Vencida: ${t.due_date}</div>
      </div>
      <div class="task-cat" style="color:${cat.color}">${cat.label}</div>
      <button class="habito-toggle" onclick="reasignarTarea('${t.id}')" style="font-size:10px;padding:3px 7px;color:var(--amber);border-color:rgba(239,159,39,.3)">↻ Reasignar</button>
    </div>`
  }).join('')
}

function reasignarTarea(id){
  openEditTask(id)
  setTimeout(() => { document.getElementById('t-due').value = '' }, 50)
}

// --- TAREAS CON FECHA (sección en Actividades) ---
function renderTareasConFecha(tasks){
  const wrap = document.getElementById('tareas-con-fecha-wrap')
  const el   = document.getElementById('tareas-con-fecha')
  if(!wrap || !el) return
  const withDate = tasks
    .filter(t => t.due_date && t.status !== 'completada')
    .sort((a, b) => {
      if(a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date)
      const aH = a.notes && /^\d{2}:\d{2}$/.test(a.notes.trim()) ? a.notes.trim() : '99:99'
      const bH = b.notes && /^\d{2}:\d{2}$/.test(b.notes.trim()) ? b.notes.trim() : '99:99'
      return aH.localeCompare(bH)
    })
  wrap.style.display = withDate.length ? 'block' : 'none'
  if(!withDate.length) return
  el.innerHTML = withDate.map(t => {
    const cat = CATS[t.category] || CATS.habitos
    const hora = t.notes && /^\d{2}:\d{2}$/.test(t.notes.trim()) ? t.notes.trim() : null
    const isOverdue = (t.due_date||'').slice(0,10) < todayBogota()
    return `<div class="task-item" data-id="${t.id}" style="border-left-color:${isOverdue?'var(--red)':cat.color}">
      <div class="task-check" onclick="toggleTask('${t.id}')" style="cursor:pointer"></div>
      <div class="task-text" onclick="toggleTask('${t.id}')" style="cursor:pointer">
        <div>${t.title}</div>
        <div style="font-size:10px;margin-top:2px;display:flex;gap:8px;align-items:center">
          <span style="color:${isOverdue?'var(--red)':'var(--text-muted)'}">📅 ${t.due_date}</span>
          ${hora?`<span style="color:var(--text-muted)">🕐 ${hora}</span>`:''}
          <span style="color:${cat.color}">${cat.label}</span>
        </div>
      </div>
      <button class="habito-toggle" onclick="event.stopPropagation();openEditTask('${t.id}')">✏️</button>
    </div>`
  }).join('')
}

function searchTareasSection(query){
  const sugg = document.getElementById('sugg-tareas-act')
  if(!sugg) return
  if(!query.trim()){ sugg.innerHTML=''; sugg.style.display='none'; return }
  const matches = allTasks
    .filter(t => t.status !== 'completada' && t.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6)
  if(!matches.length){ sugg.innerHTML=''; sugg.style.display='none'; return }
  sugg.style.display = 'block'
  sugg.innerHTML = matches.map(t => {
    const cat = CATS[t.category] || CATS.habitos
    return `<div onclick="openEditTask('${t.id}');document.getElementById('search-tareas-act').value='';document.getElementById('sugg-tareas-act').style.display='none'"
      style="cursor:pointer;padding:8px 10px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text);display:flex;align-items:center;gap:8px">
      <span style="color:${cat.color};font-size:8px">●</span>
      <span style="flex:1">${t.title}</span>
      <span style="font-size:10px;color:${cat.color}">${cat.label}</span>
    </div>`
  }).join('')
}

// --- SECCIÓN VENCIDAS ---
function renderVencidas(tasks){
  const el = document.getElementById('vencidas-list')
  if(!el) return
  const sub = document.getElementById('vencidas-sub')
  if(sub) sub.textContent = tasks.length
    ? `${tasks.length} tarea${tasks.length !== 1 ? 's' : ''} vencida${tasks.length !== 1 ? 's' : ''}`
    : 'Sin tareas vencidas'
  if(!tasks.length){
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">✓</div>Sin tareas vencidas — ¡Bien hecho!</div>'
    return
  }
  el.innerHTML = tasks.map(t => {
    const cat = CATS[t.category] || CATS.habitos
    return `<div class="task-item" style="border-left-color:var(--red)">
      <div class="task-check" style="border-color:rgba(226,75,74,0.4)"></div>
      <div class="task-text">
        <div>${t.title}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:3px">
          <span style="font-size:11px;color:${cat.color}">${cat.label}</span>
          <span style="font-size:11px;color:var(--red)">⚠️ ${t.due_date}</span>
        </div>
      </div>
      <button class="habito-toggle" onclick="reasignarTarea('${t.id}')" style="font-size:10px;padding:3px 8px;color:var(--amber);border-color:rgba(239,159,39,.3)">↻ Reasignar</button>
      <button class="habito-toggle" onclick="completarTareaVencida('${t.id}')" style="font-size:10px;padding:3px 8px;color:var(--green);border-color:rgba(93,202,165,.3)">✓ Completar</button>
    </div>`
  }).join('')
}

async function completarTareaVencida(id){
  await SB_P.from('tasks').update({ status: 'completada' }).eq('id', id)
  const t = allTasks.find(t => t.id === id)
  if(t) t.status = 'completada'
  showToast('✓ Tarea completada')
  renderTasks()
}

function openBulkReassign(){
  const overdue = allTasks.filter(t => t.due_date && (t.due_date||'').slice(0,10) < todayBogota() && t.status !== 'completada' && t.status !== 'hoy')
  if(!overdue.length){ showToast('No hay tareas vencidas'); return }
  document.getElementById('bulk-new-date').value = ''
  openModal('bulk-reassign')
}

async function saveBulkReassign(){
  const newDate = document.getElementById('bulk-new-date').value
  if(!newDate){ showToast('Elige una fecha'); return }
  const overdue = allTasks.filter(t => t.due_date && (t.due_date||'').slice(0,10) < todayBogota() && t.status !== 'completada' && t.status !== 'hoy')
  await Promise.all(overdue.map(t => SB_P.from('tasks').update({ due_date: newDate }).eq('id', t.id)))
  overdue.forEach(t => { t.due_date = newDate })
  closeModal('bulk-reassign')
  showToast(`↻ ${overdue.length} tarea${overdue.length!==1?'s':''} reasignada${overdue.length!==1?'s':''} a ${newDate}`)
  renderTasks()
}

function alertarTareasIncompletas(){
  const ayerIds = JSON.parse(localStorage.getItem('tareas_hoy_ayer') || '[]')
  if(!ayerIds.length) return
  const incompletas = ayerIds.filter(id => {
    const t = allTasks.find(t => t.id === id)
    return t && t.status !== 'completada'
  })
  if(incompletas.length){
    setTimeout(() => showToast(`⚠️ Quedaron ${incompletas.length} tareas sin completar ayer. Revisa Tareas Vencidas.`, 6000), 4000)
  }
}

// --- HÁBITOS RECURRENTES ---
function habitoRecurrenteHTML(a){
  const color = CAT_COLORS[a.category] || '#555'
  return `<div class="habito-item" style="border-left-color:${color}">
    <div style="flex:1">
      <div class="habito-name">${a.name}</div>
      <div style="font-size:11px;color:${color};margin-top:2px">${CAT_LABELS[a.category]||a.category}</div>
    </div>
    <button class="btn-add" onclick="convertirEnTarea('${a.id}')" style="font-size:11px;padding:5px 10px;color:#9b72f0;border-color:rgba(155,114,240,0.3)">→ Crear tarea</button>
    <button class="habito-toggle" onclick="openActivityModal('${a.id}')">✏️</button>
  </div>`
}

// ─── Progreso por hábito (inline panel) ──────────────────────────────────────

function toggleHabitoProgress(activityId){
  if(openProgressId === activityId){
    openProgressId = null
    const panel = document.getElementById('hp-'+activityId)
    if(panel){ panel.style.display='none'; panel.innerHTML='' }
    const item = panel?.previousElementSibling
    if(item) item.classList.remove('panel-open')
    return
  }
  if(openProgressId){
    const prev = document.getElementById('hp-'+openProgressId)
    if(prev){ prev.style.display='none'; prev.innerHTML='' }
    const prevItem = prev?.previousElementSibling
    if(prevItem) prevItem.classList.remove('panel-open')
  }
  openProgressId = activityId
  const panel = document.getElementById('hp-'+activityId)
  if(!panel) return
  panel.style.display = 'block'
  panel.innerHTML = '<div style="padding:10px;text-align:center;font-size:12px;color:var(--text-muted)">Cargando historial…</div>'
  const item = panel.previousElementSibling
  if(item) item.classList.add('panel-open')
  renderHabitoProgressPanel(activityId)
}

async function renderHabitoProgressPanel(activityId, customAnchor){
  const panel = document.getElementById('hp-'+activityId)
  if(!panel) return
  const act = allActivities.find(a => a.id === activityId)
  if(!act) return

  const freq = act.frequency
  const habitColor = act.color || '#f97316'

  const { data: logs } = await SB_P.from('activity_logs')
    .select('date')
    .eq('activity_id', activityId)
    .eq('user_id', USER_ID)
    .order('date')

  const allLogDates = (logs||[]).map(l => l.date).sort()
  const logSet = new Set(allLogDates)
  const firstLogDate = allLogDates.length ? allLogDates[0] : TODAY

  if(customAnchor) progressAnchorDates[activityId] = customAnchor
  if(!progressAnchorDates[activityId]){
    const d = new Date(TODAY); d.setMonth(d.getMonth()-3)
    progressAnchorDates[activityId] = d.toISOString().slice(0,10)
  }
  const anchorDate = progressAnchorDates[activityId]

  let gridHTML = '', listHTML = ''

  if(freq === 'diaria' || freq === 'recurrente'){
    const cells = _hpDayCells(anchorDate, firstLogDate, logSet, freq)
    gridHTML = _hpDayGrid(cells, habitColor)
    listHTML = _hpDayList(cells, habitColor, firstLogDate)
  } else if(freq === 'semanal'){
    const cells = _hpWeekCells(anchorDate, firstLogDate, logSet)
    gridHTML = _hpWeekGrid(cells, habitColor)
    listHTML = _hpWeekList(cells, habitColor)
  } else if(freq === 'mensual'){
    const cells = _hpMonthCells(anchorDate, firstLogDate, logSet)
    gridHTML = _hpMonthGrid(cells, habitColor)
    listHTML = _hpMonthList(cells, habitColor)
  }

  panel.innerHTML = `<div class="habito-progress-panel" style="--hp-color:${habitColor}">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em">Historial · ${freq}</span>
      <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted)">
        desde <input type="date" value="${anchorDate}"
          onchange="renderHabitoProgressPanel('${activityId}',this.value)"
          style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:2px 5px;font-size:11px;font-family:'Outfit',sans-serif">
      </label>
    </div>
    ${gridHTML}
    <div style="margin-top:10px">${listHTML}</div>
  </div>`
}

function _hpDayCells(anchorDate, firstLogDate, logSet, freq){
  const cells = []
  const d = new Date(anchorDate), end = new Date(TODAY)
  while(d <= end){
    const ds = d.toISOString().slice(0,10)
    const hasLog = logSet.has(ds)
    const before = ds < firstLogDate
    let status
    if(before) status = 'gray'
    else if(hasLog) status = 'done'
    else if(freq === 'recurrente') status = 'gray'
    else if(ds < TODAY) status = 'fail'
    else status = 'gray'
    cells.push({ds, status})
    d.setDate(d.getDate()+1)
  }
  return cells
}

function _hpDayGrid(cells, habitColor){
  const padded = []
  if(cells.length){
    const first = new Date(cells[0].ds)
    const dow = first.getDay()===0 ? 6 : first.getDay()-1
    for(let i=0;i<dow;i++) padded.push({ds:'',status:'empty'})
  }
  padded.push(...cells)
  while(padded.length%7!==0) padded.push({ds:'',status:'empty'})
  const labels = ['L','M','X','J','V','S','D']
  return `<div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px;width:100%">
      ${labels.map(l=>`<div style="font-size:7px;color:var(--text-muted);text-align:center">${l}</div>`).join('')}
    </div>
    <div class="hp-grid" style="grid-template-columns:repeat(7,1fr)">
      ${padded.map(c=>`<div class="hp-cell ${c.status}" style="aspect-ratio:1" title="${c.ds}"></div>`).join('')}
    </div>
  </div>`
}

function _hpDayList(cells, habitColor, firstLogDate){
  const weekMap = {}
  for(const c of cells){
    if(!c.ds || c.ds < firstLogDate) continue
    const d = new Date(c.ds)
    const dow = d.getDay()===0?6:d.getDay()-1
    const mon = new Date(d); mon.setDate(d.getDate()-dow)
    const wk = mon.toISOString().slice(0,10)
    if(!weekMap[wk]) weekMap[wk]=[]
    weekMap[wk].push(c)
  }
  const weeks = Object.keys(weekMap).sort().reverse().slice(0,4)
  if(!weeks.length) return '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:6px 0">Sin datos</div>'
  return weeks.map(wk => {
    const wCells = weekMap[wk]
    const done = wCells.filter(c=>c.status==='done').length
    const total = wCells.length
    const d = new Date(wk), sun = new Date(d); sun.setDate(d.getDate()+6)
    const fmt = dt => `${dt.getDate()}/${dt.getMonth()+1}`
    const color = done===0 ? '#c0392b' : habitColor
    return `<div class="hp-list-row">
      <span style="color:var(--text-muted)">${fmt(d)} – ${fmt(sun)}</span>
      <span style="font-weight:500;color:${color}">${done}/${total} días</span>
    </div>`
  }).join('')
}

function _hpWeekCells(anchorDate, firstLogDate, logSet){
  const cells = []
  const d = new Date(anchorDate)
  const dow = d.getDay()===0?6:d.getDay()-1
  d.setDate(d.getDate()-dow)
  const today = new Date(TODAY)
  while(d<=today){
    const monStr = d.toISOString().slice(0,10)
    const sun = new Date(d); sun.setDate(d.getDate()+6)
    const sunStr = sun.toISOString().slice(0,10)
    let hasLog = false
    for(const ld of logSet){ if(ld>=monStr&&ld<=sunStr){hasLog=true;break} }
    const passed = sunStr < TODAY
    const before = sunStr < firstLogDate
    let status
    if(before) status='gray'
    else if(hasLog) status='done'
    else if(passed) status='fail'
    else status='gray'
    cells.push({monStr,sunStr,status})
    d.setDate(d.getDate()+7)
  }
  return cells
}

function _hpWeekGrid(cells, habitColor){
  const MN = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const html = cells.map(c => {
    const d = new Date(c.monStr)
    const label = d.getDate()===1||c===cells[0] ? MN[d.getMonth()] : d.getDate()
    const txtColor = c.status==='done'?'#000':c.status==='fail'?'#fff':'var(--text-muted)'
    return `<div class="hp-cell ${c.status}" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:7px;color:${txtColor}" title="${c.monStr} – ${c.sunStr}">${label}</div>`
  }).join('')
  return `<div class="hp-grid" style="grid-template-columns:repeat(${cells.length},1fr)">${html}</div>`
}

function _hpWeekList(cells, habitColor){
  const recent = [...cells].reverse().slice(0,4)
  return recent.map(c => {
    const d = new Date(c.monStr), sun = new Date(c.sunStr)
    const fmt = dt => `${dt.getDate()}/${dt.getMonth()+1}`
    const isCurrent = c.sunStr >= TODAY
    let badge, color
    if(c.status==='done'){badge='✓ cumplido';color=habitColor}
    else if(c.status==='fail'){badge='✗ no hecho';color='#c0392b'}
    else{badge=isCurrent?'En curso':'—';color='var(--text-muted)'}
    return `<div class="hp-list-row">
      <span style="color:var(--text-muted)">Sem ${fmt(d)} – ${fmt(sun)}</span>
      <span style="font-weight:500;color:${color}">${badge}</span>
    </div>`
  }).join('')
}

function _hpMonthCells(anchorDate, firstLogDate, logSet){
  const cells = []
  const d = new Date(anchorDate.slice(0,7)+'-01')
  const today = new Date(TODAY)
  while(d<=today){
    const monthStr = d.toISOString().slice(0,7)
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0)
    const lastStr = last.toISOString().slice(0,10)
    let hasLog = false
    for(const ld of logSet){ if(ld.startsWith(monthStr)){hasLog=true;break} }
    const passed = lastStr < TODAY
    const before = lastStr < firstLogDate
    let status
    if(before) status='gray'
    else if(hasLog) status='done'
    else if(passed) status='fail'
    else status='gray'
    cells.push({monthStr,lastStr,status})
    d.setMonth(d.getMonth()+1)
  }
  return cells
}

function _hpMonthGrid(cells, habitColor){
  const MN = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const html = cells.map(c => {
    const m = parseInt(c.monthStr.slice(5,7))-1
    const txtColor = c.status==='done'?'#000':c.status==='fail'?'#fff':'var(--text-muted)'
    return `<div class="hp-cell ${c.status}" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:8px;color:${txtColor}" title="${c.monthStr}">${MN[m]}</div>`
  }).join('')
  return `<div class="hp-grid" style="grid-template-columns:repeat(${cells.length},1fr)">${html}</div>`
}

function _hpMonthList(cells, habitColor){
  const MN = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return [...cells].reverse().slice(0,3).map(c => {
    const m = parseInt(c.monthStr.slice(5,7))-1
    const y = c.monthStr.slice(0,4)
    const isCurrent = c.lastStr >= TODAY
    let badge, color
    if(c.status==='done'){badge='✓ cumplido';color=habitColor}
    else if(c.status==='fail'){badge='✗ no hecho';color='#c0392b'}
    else{badge=isCurrent?'En curso':'—';color='var(--text-muted)'}
    return `<div class="hp-list-row">
      <span style="color:var(--text-muted)">${MN[m]} ${y}</span>
      <span style="font-weight:500;color:${color}">${badge}</span>
    </div>`
  }).join('')
}

// ─────────────────────────────────────────────────────────────────────────────

function convertirEnTarea(activityId){
  const act = allActivities.find(a => a.id === activityId)
  if(!act) return
  document.getElementById('modal-task-title').textContent = 'Nueva tarea'
  document.getElementById('t-id').value = ''
  document.getElementById('t-title').value = act.name
  document.getElementById('t-cat').value = 'personal'
  document.getElementById('t-priority').value = 'alta'
  document.getElementById('t-due').value = ''
  document.getElementById('t-time').value = ''
  document.getElementById('task-delete-btn').style.display = 'none'
  openModal('task')
}

async function deleteTask(){
  const id = document.getElementById('t-id').value
  if(!id) return
  if(!confirm('¿Eliminar esta tarea permanentemente?')) return
  await SB_P.from('tasks').delete().eq('id', id)
  allTasks = allTasks.filter(t => t.id !== id)
  closeModal('task')
  document.getElementById('t-id').value = ''
  document.getElementById('modal-task-title').textContent = 'Nueva actividad'
  document.getElementById('archive-note-area').style.display = 'none'
  document.getElementById('archive-note-input').value = ''
  showToast('🗑️ Tarea eliminada')
  renderTasks()
}

function archiveTask(){
  const area = document.getElementById('archive-note-area')
  if(area) area.style.display = area.style.display === 'none' ? 'block' : 'none'
}

async function confirmArchiveTask(){
  const id = document.getElementById('t-id').value
  if(!id) return
  const note = document.getElementById('archive-note-input').value.trim()
  const updates = { status: 'archivada' }
  if(note) updates.notes = note
  await SB_P.from('tasks').update(updates).eq('id', id)
  const t = allTasks.find(x => x.id === id)
  if(t){ t.status = 'archivada'; if(note) t.notes = note }
  closeModal('task')
  document.getElementById('archive-note-area').style.display = 'none'
  document.getElementById('archive-note-input').value = ''
  showToast('📦 Tarea archivada')
  renderTasks()
}

function toggleArchivadasView(){
  _showArchived = !_showArchived
  const btn = document.getElementById('toggle-archivadas-btn')
  if(btn){
    btn.textContent = _showArchived ? '📦 Ocultar archivadas' : '📦 Ver archivadas'
    btn.style.background   = _showArchived ? 'rgba(93,202,165,0.12)' : 'transparent'
    btn.style.borderColor  = _showArchived ? 'rgba(93,202,165,0.35)' : 'var(--border)'
    btn.style.color        = _showArchived ? 'var(--green)' : 'var(--text-muted)'
  }
  renderTasks()
}

function renderArchivedTasks(){
  const wrap = document.getElementById('archived-tasks-wrap')
  if(!wrap) return
  if(!_showArchived){ wrap.style.display = 'none'; return }
  const archived = allTasks.filter(t => t.status === 'archivada')
  if(!archived.length){ wrap.style.display = 'none'; return }
  wrap.style.display = ''
  document.getElementById('archived-tasks-list').innerHTML = archived.map(t => {
    const cat = CATS[t.category] || CATS.habitos
    return `<div class="task-item done" style="border-left-color:var(--border);opacity:0.55;cursor:default">
      <div class="task-check" style="background:rgba(255,255,255,0.08);border-color:var(--border);font-size:10px;display:flex;align-items:center;justify-content:center">📦</div>
      <div class="task-text">
        <div style="text-decoration:line-through;color:var(--text-muted)">${t.title}</div>
        ${t.notes && !/^\d{2}:\d{2}$/.test(t.notes.trim()) ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;font-style:italic">${t.notes}</div>` : ''}
      </div>
      <div class="task-cat" style="color:var(--text-muted)">${cat.label}</div>
    </div>`
  }).join('')
}

function openNewTask(){
  document.getElementById('modal-task-title').textContent = 'Nueva actividad'
  document.getElementById('t-id').value = ''
  document.getElementById('t-title').value = ''
  document.getElementById('t-cat').value = 'iarcania'
  document.getElementById('t-priority').value = 'alta'
  document.getElementById('t-due').value = ''
  document.getElementById('t-time').value = ''
  document.getElementById('task-delete-btn').style.display = 'none'
  openModal('task')
}

function openEditTask(id){
  const task = allTasks.find(t => t.id === id)
  if(!task) return
  document.getElementById('modal-task-title').textContent = 'Editar tarea'
  document.getElementById('t-id').value = task.id
  document.getElementById('t-title').value = task.title
  document.getElementById('t-cat').value = task.category || 'iarcania'
  document.getElementById('t-priority').value = task.priority || 'alta'
  document.getElementById('t-due').value = task.due_date || ''
  document.getElementById('t-time').value = (task.notes && /^\d{2}:\d{2}$/.test(task.notes.trim())) ? task.notes.trim() : ''
  document.getElementById('task-delete-btn').style.display = 'flex'
  document.getElementById('archive-note-area').style.display = 'none'
  document.getElementById('archive-note-input').value = ''
  openModal('task')
}

function openEditIdea(id){
  const idea = (window._allIdeas || []).find(i => i.id === id)
  if(!idea) return
  document.getElementById('edit-idea-id').value  = id
  document.getElementById('edit-idea-raw').value = idea.raw_content || ''
  document.getElementById('edit-idea-cat').value = idea.category   || ''
  openModal('edit-idea')
}

async function saveEditIdea(){
  const id  = document.getElementById('edit-idea-id').value
  const raw = document.getElementById('edit-idea-raw').value.trim()
  if(!raw) return
  const category = document.getElementById('edit-idea-cat').value || null
  const { error } = await SB_P.from('ideas').update({ raw_content: raw, category }).eq('id', id)
  if(error){ showToast('❌ Error: ' + error.message); return }
  closeModal('edit-idea')
  await loadIdeas()
}

async function deleteIdea(id){
  if(!confirm('¿Eliminar esta idea?')) return
  await SB_P.from('ideas').delete().eq('id', id)
  await loadIdeas()
}

function createTaskFromIdea(btn){
  const title = btn.dataset.title
  const cat   = btn.dataset.cat
  document.getElementById('modal-task-title').textContent = 'Nueva tarea'
  document.getElementById('t-id').value    = ''
  document.getElementById('t-title').value = title
  document.getElementById('t-cat').value   = CATS[cat] ? cat : 'personal'
  document.getElementById('t-priority').value = 'alta'
  document.getElementById('t-due').value   = ''
  document.getElementById('t-time').value  = ''
  document.getElementById('task-delete-btn').style.display = 'none'
  openModal('task')
}

async function saveTask(){
  const title = document.getElementById('t-title').value.trim()
  if(!title) return
  const existingId = document.getElementById('t-id').value
  const cat = CATS[document.getElementById('t-cat').value] || CATS.habitos
  const taskData = {
    title,
    category: document.getElementById('t-cat').value,
    color: cat.color,
    priority: document.getElementById('t-priority').value,
    due_date: document.getElementById('t-due').value || null,
    notes: document.getElementById('t-time').value || null,
  }
  if(existingId){
    await SB_P.from('tasks').update(taskData).eq('id', existingId)
    const task = allTasks.find(t => t.id === existingId)
    if(task) Object.assign(task, taskData)
    renderTasks()
    showToast('✓ Tarea actualizada')
  } else {
    const newId = 'task_'+Date.now()
    await SB_P.from('tasks').insert({
      id: newId, ...taskData,
      assigned_to: USER_ID,
      created_by: USER_ID,
      status: 'pendiente'
    })
  }
  closeModal('task')
  document.getElementById('t-id').value = ''
  document.getElementById('t-title').value = ''
  document.getElementById('modal-task-title').textContent = 'Nueva actividad'
  await loadTasks()
}

// --- EVENTOS (event_types + event_occurrences) ---
const EVENT_TYPE_CATS = {
  cultural: { label:'Cultural', icon:'🎭', color:'#8B6CF6' },
  familia:  { label:'Familia',  icon:'👨‍👩‍👧', color:'#5DCAA5' },
  amigos:   { label:'Amigos',   icon:'👥',    color:'#378ADD' },
  visita:   { label:'Visita',   icon:'🏠',    color:'#EF9F27' },
}
const MOOD_MAP = { genial:'😊', normal:'😐', dificil:'😔' }
let allEventTypes       = []
let allOccurrences      = {}   // { [event_type_id]: occurrence[] }
let expandedEventTypes  = new Set()
let _editingEventTypeId = null
let _editingOccId       = null
let _occTargetTypeId    = null
let _selectedMood       = null

// ── PERSONAS ──────────────────────────────────────────────────────────────
let allPeople = []
let _editingPersonaId = null
let _currentPersonaFilter = 'all'
let _ncSelectedPeople = [] // ids seleccionadas en el modal de nueva cita

async function loadPersonas(){
  const { data } = await SB_P.from('people').select('*').eq('user_id', USER_ID).order('name')
  allPeople = data || []
}

function filterPersonas(rel, btn){
  _currentPersonaFilter = rel
  document.querySelectorAll('#personas-rel-filters .cat-filter').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  renderPersonas()
}

const REL_LABELS = { yo:'🪞 Yo', amigo:'👤 Amigo/a', familia:'👨‍👩‍👧 Familia', conocido:'🤝 Conocido/a', trabajo:'💼 Trabajo' }

function renderPersonas(){
  const el = document.getElementById('personas-list')
  if(!el) return
  const list = _currentPersonaFilter === 'all'
    ? allPeople
    : allPeople.filter(p => p.relationship === _currentPersonaFilter)
  if(!list.length){
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div>No hay personas aquí todavía.</div>`
    return
  }
  el.innerHTML = list.map(p => {
    const rel = REL_LABELS[p.relationship] || '🤝 Conocido/a'
    const bday = allBirthdays.find(b => b.person_id === p.id)
    const bdayStr = bday ? `  ·  🎂 ${bday.day}/${bday.month}` : ''
    const bdayDays = bday ? daysUntil(bday.day, bday.month) : null
    const bdayPill = bdayDays !== null && bdayDays <= 7
      ? `<span style="margin-left:6px;font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(196,163,90,0.2);color:#C4A35A">${bdayDays === 0 ? '¡Hoy!' : bdayDays === 1 ? 'Mañana' : bdayDays+' días'}</span>` : ''
    return `<div class="card" style="padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:50%;background:rgba(139,108,246,0.2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${p.name.charAt(0).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${p.name}${bdayPill}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${rel}${bdayStr}${p.notes ? '  ·  '+p.notes : ''}</div>
      </div>
      <button onclick="crearCitaDesdePersona('${p.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:4px" title="Crear cita">🏥</button>
      <button onclick="openPersonaModal('${p.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:4px">✏️</button>
      <button onclick="deletePersona('${p.id}')" style="background:transparent;border:none;color:rgba(239,68,68,0.6);cursor:pointer;font-size:15px;padding:4px">×</button>
    </div>`
  }).join('')
}

function toggleFechasEnPersonas(btn){
  const el = document.getElementById('fechas-en-personas')
  const open = el.style.display !== 'none'
  el.style.display = open ? 'none' : 'block'
  btn.textContent = open ? '📅 Ver fechas importantes' : '📅 Ocultar fechas'
  if(!open){
    const grid = document.getElementById('bd-grid-personas')
    // Reutilizar renderBirthdays pero apuntando al nuevo contenedor
    const orig = document.getElementById('bd-grid')
    const bds = allBirthdays.filter(b => !(b.type === 'cumpleanos' && b.person_id))
    if(!bds.length){
      grid.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px 0">No hay fechas guardadas</div>'
      return
    }
    // Swap temporalmente el contenedor para reusar renderBirthdays
    orig.id = 'bd-grid-bak'
    grid.id = 'bd-grid'
    renderBirthdays(allBirthdays)
    grid.id = 'bd-grid-personas'
    orig.id = 'bd-grid'
  }
}

function crearCitaDesdePersona(personaId){
  const p = allPeople.find(x => x.id === personaId)
  if(!p) return
  _ncPopulateEventTypes()
  _ncSelectedPeople = [personaId]
  _ncRenderSelectedPeople()
  document.getElementById('nc-title').value = `Con ${p.name}`
  document.getElementById('nc-type').value = 'reunion'
  document.getElementById('nc-datetime').value = ''
  document.getElementById('nc-duration').value = '60'
  document.getElementById('nc-travel-before').value = '0'
  document.getElementById('nc-travel-after').value = '0'
  document.getElementById('nc-lugar').value = ''
  document.getElementById('nc-doctor').value = ''
  document.getElementById('nc-r1').value = '3'
  document.getElementById('nc-r2').value = '1'
  document.getElementById('nc-event-type').value = ''
  openModal('nueva-cita')
}

function openPersonaModal(id){
  _editingPersonaId = id || null
  const p = id ? allPeople.find(x => x.id === id) : null
  document.getElementById('persona-modal-title').textContent = p ? 'Editar persona' : 'Nueva persona'
  document.getElementById('persona-id').value    = p?.id   || ''
  document.getElementById('persona-name').value  = p?.name || ''
  document.getElementById('persona-rel').value   = p?.relationship || 'amigo'
  document.getElementById('persona-notes').value = p?.notes || ''
  // Cumpleaños: buscar en birthdays por person_id
  const bday = p ? allBirthdays.find(b => b.person_id === p.id) : null
  document.getElementById('persona-bday-day').value   = bday?.day   || ''
  document.getElementById('persona-bday-month').value = bday?.month || ''
  openModal('persona')
}

async function savePersona(){
  const name = document.getElementById('persona-name').value.trim()
  if(!name){ showToast('⚠️ El nombre es obligatorio'); return }
  const bdayDay   = parseInt(document.getElementById('persona-bday-day').value)   || null
  const bdayMonth = parseInt(document.getElementById('persona-bday-month').value) || null
  const row = {
    name,
    relationship: document.getElementById('persona-rel').value,
    notes: document.getElementById('persona-notes').value.trim() || null,
    user_id: USER_ID,
  }
  let personId = _editingPersonaId
  if(_editingPersonaId){
    await SB_P.from('people').update(row).eq('id', _editingPersonaId)
  } else {
    personId = 'per_' + Date.now()
    row.id = personId
    await SB_P.from('people').insert(row)
  }
  // Sincronizar cumpleaños en birthdays
  const existingBday = allBirthdays.find(b => b.person_id === personId)
  if(bdayDay && bdayMonth){
    const bdayRow = {
      name,
      day:   bdayDay,
      month: bdayMonth,
      type:  'cumpleanos',
      relationship: row.relationship,
      person_id: personId,
      user_id: USER_ID,
    }
    if(existingBday){
      await SB_P.from('birthdays').update(bdayRow).eq('id', existingBday.id)
    } else {
      bdayRow.id = 'bd_' + Date.now()
      await SB_P.from('birthdays').insert(bdayRow)
    }
  } else if(existingBday){
    // Se borró el cumpleaños
    await SB_P.from('birthdays').delete().eq('id', existingBday.id)
  }
  closeModal('persona')
  await Promise.all([loadPersonas(), loadBirthdays()])
  renderPersonas()
  showToast(_editingPersonaId ? '✅ Persona actualizada' : '✅ Persona guardada')
}

async function deletePersona(id){
  const p = allPeople.find(x => x.id === id)
  if(!p) return
  showToastAction(`¿Eliminar a ${p.name}?`, async () => {
    await SB_P.from('people').delete().eq('id', id)
    allPeople = allPeople.filter(x => x.id !== id)
    renderPersonas()
  })
}

// Autocomplete de personas en el modal de nueva cita
function _ncRenderSelectedPeople(){
  const wrap = document.getElementById('nc-people-selected')
  if(!wrap) return
  wrap.innerHTML = _ncSelectedPeople.map(id => {
    const p = allPeople.find(x => x.id === id)
    if(!p) return ''
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(139,108,246,0.15);border:1px solid rgba(139,108,246,0.3);border-radius:20px;padding:3px 10px;font-size:12px;color:#c4b5fd">
      ${p.name}
      <button onclick="_ncRemovePerson('${id}')" style="background:none;border:none;color:#c4b5fd;cursor:pointer;font-size:13px;padding:0;line-height:1">×</button>
    </span>`
  }).join('')
}

function _ncRemovePerson(id){
  _ncSelectedPeople = _ncSelectedPeople.filter(x => x !== id)
  _ncRenderSelectedPeople()
}

function ncPeopleSearch(q){
  const dd = document.getElementById('nc-people-dropdown')
  if(!dd) return
  const matches = allPeople.filter(p =>
    !_ncSelectedPeople.includes(p.id) &&
    p.name.toLowerCase().includes(q.toLowerCase())
  )
  if(!q && !matches.length){ dd.style.display = 'none'; return }
  dd.style.display = matches.length ? 'block' : 'none'
  dd.innerHTML = matches.slice(0,8).map(p =>
    `<div onclick="ncSelectPerson('${p.id}')" style="padding:9px 12px;cursor:pointer;font-size:13px;color:var(--text-dim);border-bottom:1px solid var(--border)" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">${p.name} <span style="font-size:10px;color:var(--text-muted)">${REL_LABELS[p.relationship]||''}</span></div>`
  ).join('')
}

function ncSelectPerson(id){
  if(!_ncSelectedPeople.includes(id)) _ncSelectedPeople.push(id)
  document.getElementById('nc-people-search').value = ''
  document.getElementById('nc-people-dropdown').style.display = 'none'
  _ncRenderSelectedPeople()
}

function _ncPopulateEventTypes(){
  const sel = document.getElementById('nc-event-type')
  if(!sel) return
  sel.innerHTML = '<option value="">— Ninguno —</option>' +
    Object.entries(EVENT_TYPE_CATS).map(([key, cat]) => {
      const types = allEventTypes.filter(et => (et.category||'visita') === key)
      if(!types.length) return ''
      return `<optgroup label="${cat.icon} ${cat.label}">${types.map(et =>
        `<option value="${et.id}">${et.name}</option>`).join('')}</optgroup>`
    }).join('')
}

async function seedEventosDefaults(){
  const defaults = [
    // Cultural
    { category:'cultural', name:'Cine',           description:'Película en sala' },
    { category:'cultural', name:'Concierto',       description:'Show en vivo — música' },
    { category:'cultural', name:'Teatro / Stand up', description:'Obra, comedia o show en escenario' },
    { category:'cultural', name:'Museo / Exposición', description:'Arte, ciencia o historia' },
    // Amigos
    { category:'amigos',   name:'Salida con amigos', description:'Plan informal con el grupo' },
    { category:'amigos',   name:'Fiesta / Rumba',    description:'Celebración o noche de rumba' },
    { category:'amigos',   name:'Videollamada grupal', description:'Cuando la distancia manda' },
    // Familia
    { category:'familia',  name:'Reunión familiar',  description:'Toda la familia junta' },
    { category:'familia',  name:'Cena en familia',   description:'Comida especial en casa o restaurante' },
    { category:'familia',  name:'Visita a familiares', description:'Ir a ver a alguien de la familia' },
    // Visita / Lugar
    { category:'visita',   name:'Restaurante nuevo',  description:'Probar un lugar por primera vez' },
    { category:'visita',   name:'Café de trabajo',    description:'Sesión de trabajo fuera de casa' },
    { category:'visita',   name:'Viaje / Escapada',   description:'Salir de la ciudad aunque sea un día' },
    { category:'visita',   name:'Bar / Tertulia',     description:'Conversación tranquila con algo de tomar' },
  ]
  const rows = defaults.map(d => ({
    id: 'et_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    user_id: USER_ID,
    name: d.name,
    category: d.category,
    description: d.description,
  }))
  // Insertar uno por uno con pequeño delay para evitar colisión de ids por Date.now()
  for(const row of rows){
    await new Promise(r => setTimeout(r, 2))
    row.id = 'et_' + Date.now() + '_' + Math.random().toString(36).slice(2,6)
    await SB_P.from('event_types').insert(row)
  }
  await loadEventos()
  renderEventos()
  showToast('✅ Tipos básicos cargados')
}

async function loadEventos(){
  const { data } = await SB_P.from('event_types').select('*').eq('user_id', USER_ID).order('name')
  allEventTypes = data || []
}

async function loadOccurrencesForType(typeId){
  const { data } = await SB_P.from('event_occurrences')
    .select('*').eq('event_type_id', typeId).eq('user_id', USER_ID)
    .order('date', { ascending: false })
  allOccurrences[typeId] = data || []
}

function _renderEventCard(et){
  const cat  = EVENT_TYPE_CATS[et.category] || EVENT_TYPE_CATS.visita
  const open = expandedEventTypes.has(et.id)
  const occs = allOccurrences[et.id] || []
  const citasCount = allCitas.filter(c => c.event_type_id === et.id).length
  const totalCount = occs.length + citasCount
  const occHTML = open ? `
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
      <button onclick="openOccurrenceModal('${et.id}')" style="width:100%;padding:8px;background:transparent;border:1px dashed var(--border);border-radius:7px;color:var(--text-muted);font-size:12px;font-family:'Outfit',sans-serif;cursor:pointer;margin-bottom:8px">+ Registrar vez</button>
      ${!occs.length
        ? `<div style="font-size:12px;color:var(--text-muted);padding:4px 0;text-align:center">Sin registros todavía</div>`
        : occs.map(o => {
            const mood = o.mood ? MOOD_MAP[o.mood]||'' : ''
            const meta = [
              o.date     ? '📅 '+o.date : '',
              o.people   ? '👤 '+o.people : '',
              o.location ? '📍 '+o.location : '',
              o.cost     ? '💰 $'+Number(o.cost).toLocaleString('es-CO') : '',
              mood,
            ].filter(Boolean).join('  ·  ')
            return `<div style="background:rgba(0,0,0,0.25);border-radius:8px;padding:10px 12px;margin-bottom:6px">
              <div style="font-size:11px;color:var(--text-muted)">${meta}</div>
              ${o.notes?`<div style="font-size:12px;color:var(--text-dim);margin-top:4px">${o.notes}</div>`:''}
            </div>`
          }).join('')
      }
      ${citasCount > 0 ? `
        <div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🏥 Citas vinculadas</div>
        ${allCitas.filter(c => c.event_type_id === et.id).map(c => {
          const d = new Date(c.datetime)
          const dateStr = d.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})
          const timeStr = d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})
          const people = c.people_ids?.length ? '  ·  👥 ' + c.people_ids.map(id => allPeople.find(p=>p.id===id)?.name||'').filter(Boolean).join(', ') : ''
          return `<div style="background:rgba(239,159,39,0.08);border-left:3px solid #EF9F27;border-radius:0 6px 6px 0;padding:8px 10px;margin-bottom:4px">
            <div style="font-size:12px;color:var(--text-dim)">${c.title}</div>
            <div style="font-size:11px;color:var(--text-muted)">📅 ${dateStr} ${timeStr}${people}</div>
          </div>`
        }).join('')}` : ''}
    </div>` : ''
  return `<div class="card" style="margin-bottom:10px;padding:12px 14px">
    <div onclick="toggleEventType('${et.id}')" style="display:flex;align-items:center;gap:10px;cursor:pointer">
      <span style="font-size:20px">${cat.icon}</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--text)">${et.name}</div>
        ${et.description?`<div style="font-size:11px;color:var(--text-muted);margin-top:1px">${et.description}</div>`:''}
      </div>
      <span style="font-size:11px;color:var(--text-muted)">${totalCount} ${totalCount===1?'vez':'veces'}</span>
      <button onclick="event.stopPropagation();openEventTypeModal('${et.id}')" class="habito-toggle" style="font-size:12px">✏️</button>
      <span style="font-size:11px;color:var(--text-muted);transition:transform .2s;display:inline-block;${open?'':'transform:rotate(-90deg)'}">▼</span>
    </div>
    ${occHTML}
  </div>`
}

function renderEventos(){
  const el = document.getElementById('eventos-list')
  if(!el) return
  if(!allEventTypes.length){
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎉</div>
      <div style="margin-bottom:14px">Sin tipos de evento todavía.</div>
      <button onclick="seedEventosDefaults()" style="background:rgba(139,108,246,0.15);border:1px solid rgba(139,108,246,0.4);border-radius:8px;padding:10px 18px;color:#8B6CF6;font-size:13px;font-family:'Outfit',sans-serif;cursor:pointer">🌱 Cargar tipos básicos</button>
    </div>`
    return
  }
  const collapsed = JSON.parse(localStorage.getItem('eventos_groups_collapsed') || '{}')
  el.innerHTML = Object.entries(EVENT_TYPE_CATS).map(([catKey, cat]) => {
    const types = allEventTypes.filter(et => (et.category || 'visita') === catKey)
    if(!types.length) return ''
    const isCollapsed = !!collapsed[catKey]
    return `<div style="margin-bottom:1.25rem">
      <div onclick="toggleEventosGroup('${catKey}')" style="display:flex;align-items:center;gap:8px;padding:8px 4px;cursor:pointer;user-select:none">
        <span>${cat.icon}</span>
        <span style="font-size:11px;font-weight:600;color:${cat.color};text-transform:uppercase;letter-spacing:.1em">${cat.label}</span>
        <span style="font-size:10px;color:var(--text-muted)">(${types.length})</span>
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <span style="font-size:9px;color:var(--text-muted);display:inline-block;transition:transform .2s;${isCollapsed?'transform:rotate(-90deg)':''}">▼</span>
      </div>
      ${isCollapsed ? '' : types.map(_renderEventCard).join('')}
    </div>`
  }).join('')
}

function toggleEventosGroup(catKey){
  const collapsed = JSON.parse(localStorage.getItem('eventos_groups_collapsed') || '{}')
  collapsed[catKey] = !collapsed[catKey]
  localStorage.setItem('eventos_groups_collapsed', JSON.stringify(collapsed))
  renderEventos()
}

async function toggleEventType(id){
  if(expandedEventTypes.has(id)){
    expandedEventTypes.delete(id)
  } else {
    expandedEventTypes.add(id)
    if(!allOccurrences[id]) await loadOccurrencesForType(id)
  }
  renderEventos()
}

function openEventTypeModal(id){
  _editingEventTypeId = id || null
  const et = id ? allEventTypes.find(x => x.id === id) : null
  document.getElementById('et-modal-title').textContent = et ? 'Editar tipo' : 'Nuevo tipo de evento'
  document.getElementById('et-name').value = et?.name        || ''
  document.getElementById('et-cat').value  = et?.category    || 'cultural'
  document.getElementById('et-desc').value = et?.description || ''
  openModal('event-type')
}

async function saveEventType(){
  const name = document.getElementById('et-name').value.trim()
  if(!name){ showToast('⚠️ El nombre es obligatorio'); return }
  const row = {
    name,
    category:    document.getElementById('et-cat').value,
    description: document.getElementById('et-desc').value.trim() || null,
    user_id:     USER_ID,
  }
  if(_editingEventTypeId){
    await SB_P.from('event_types').update(row).eq('id', _editingEventTypeId)
  } else {
    row.id = 'et_' + Date.now()
    await SB_P.from('event_types').insert(row)
  }
  closeModal('event-type')
  await loadEventos()
  renderEventos()
  showToast(_editingEventTypeId ? '✅ Tipo actualizado' : '✅ Tipo creado')
}

function openOccurrenceModal(typeId, occId){
  _occTargetTypeId  = typeId
  _editingOccId     = occId || null
  _selectedMood     = null
  const o = occId ? (allOccurrences[typeId]||[]).find(x => x.id === occId) : null
  document.getElementById('occ-modal-title').textContent = o ? 'Editar registro' : 'Registrar vez'
  document.getElementById('occ-date').value     = o?.date     || TODAY
  document.getElementById('occ-cost').value     = o?.cost     || ''
  document.getElementById('occ-people').value   = o?.people   || ''
  document.getElementById('occ-location').value = o?.location || ''
  document.getElementById('occ-notes').value    = o?.notes    || ''
  _selectedMood = o?.mood || null
  ;['genial','normal','dificil'].forEach(m => {
    const btn = document.getElementById('mood-btn-'+m)
    if(btn){ btn.style.background = m === _selectedMood ? 'rgba(255,255,255,0.1)' : 'transparent'; btn.style.borderColor = m === _selectedMood ? 'var(--gold)' : 'var(--border)'; btn.style.color = m === _selectedMood ? 'var(--text)' : 'var(--text-muted)' }
  })
  openModal('occurrence')
}

function selectMood(m){
  _selectedMood = (_selectedMood === m) ? null : m
  ;['genial','normal','dificil'].forEach(k => {
    const btn = document.getElementById('mood-btn-'+k)
    if(btn){ btn.style.background = k === _selectedMood ? 'rgba(255,255,255,0.1)' : 'transparent'; btn.style.borderColor = k === _selectedMood ? 'var(--gold)' : 'var(--border)'; btn.style.color = k === _selectedMood ? 'var(--text)' : 'var(--text-muted)' }
  })
}

async function saveOccurrence(){
  const date = document.getElementById('occ-date').value
  if(!date){ showToast('⚠️ La fecha es obligatoria'); return }
  const row = {
    event_type_id: _occTargetTypeId,
    user_id:       USER_ID,
    date,
    cost:     parseFloat(document.getElementById('occ-cost').value)     || null,
    people:   document.getElementById('occ-people').value.trim()   || null,
    location: document.getElementById('occ-location').value.trim() || null,
    notes:    document.getElementById('occ-notes').value.trim()    || null,
    mood:     _selectedMood || null,
  }
  if(_editingOccId){
    await SB_P.from('event_occurrences').update(row).eq('id', _editingOccId)
  } else {
    row.id = 'occ_' + Date.now()
    await SB_P.from('event_occurrences').insert(row)
  }
  closeModal('occurrence')
  await loadOccurrencesForType(_occTargetTypeId)
  renderEventos()
  showToast(_editingOccId ? '✅ Registro actualizado' : '✅ Registro guardado')
}

// --- BIRTHDAYS ---
async function loadBirthdays(){
  const { data } = await SB_P.from('birthdays').select('*').order('month').order('day')
  allBirthdays = data || []
  renderBirthdays(allBirthdays)
  renderProximasFechas()
}

function daysUntil(day, month){
  const now = new Date(); now.setHours(0,0,0,0)
  let next = new Date(now.getFullYear(), month-1, day); next.setHours(0,0,0,0)
  if(next < now) next.setFullYear(now.getFullYear()+1)
  return Math.round((next - now) / 86400000)
}

const FECHA_TIPOS = {
  cumpleanos:  { label:'🎂 Cumpleaños',  color:'#C4A35A' },
  especial:    { label:'⭐ Especial',    color:'#8B6CF6' },
  aniversario: { label:'💜 Aniversario', color:'#F472B6' },
  cita:        { label:'🏥 Cita',        color:'#EF9F27' },
  pago:        { label:'💰 Pago',        color:'#5DCAA5' },
  evento:      { label:'🎉 Evento',      color:'#378ADD' },
  otro:        { label:'📌 Otro',        color:'#7a788f' },
}

function bdCardHTML(b){
  const days = daysUntil(b.day, b.month)
  const cls   = days === 0 ? 'pill-hot' : days <= 3 ? 'pill-hot' : days <= 7 ? 'pill-warm' : 'pill-cool'
  const label = days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `${days} días`
  const tipo  = FECHA_TIPOS[b.type || b.relationship_type] || FECHA_TIPOS.otro
  const extra = [b.time ? `⏰ ${b.time}` : '', b.location ? `📍 ${b.location}` : ''].filter(Boolean).join(' · ')
  const celebLine = b.celeb_date ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">🗓 Celebración: ${b.celeb_date}</div>` : ''
  const taskBtn = `<button onclick="crearTareaDesdefecha('${b.id}')" style="margin-top:8px;width:100%;padding:6px;background:rgba(155,114,240,0.1);border:1px solid rgba(155,114,240,0.3);border-radius:6px;color:var(--purple);font-size:11px;cursor:pointer;font-family:'Outfit',sans-serif">📋 Crear tarea</button>`
  return `<div class="bd-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <div class="bd-name">${b.name}</div>
      <span class="fecha-cat-badge" style="background:${tipo.color}22;color:${tipo.color};border:1px solid ${tipo.color}44">${tipo.label}</span>
    </div>
    <div class="bd-date">${b.relationship || b.relationship_type || ''} · ${b.day}/${b.month}</div>
    ${extra ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">${extra}</div>` : ''}
    ${b.notes ? `<div style="font-size:11px;color:var(--text-dim);margin-top:3px;font-style:italic">${b.notes}</div>` : ''}
    ${celebLine}
    <span class="bd-days pill ${cls}" style="margin-top:6px;display:inline-block">${label}</span>
    ${taskBtn}
  </div>`
}

function renderProximasFechas(){
  const targets = [
    document.getElementById('proximas-fechas-widget'),
    document.getElementById('proximas-fechas-widget-personas'),
    document.getElementById('proximas-fechas-widget-fechas'),
  ].filter(Boolean)
  if(!targets.length) return
  const el = targets[0] // para compatibilidad con resto del código
  const dismissed = JSON.parse(localStorage.getItem('pfw_dismissed_' + TODAY) || '[]')

  const cumples    = allBirthdays.filter(b => b.type === 'cumpleanos')
  const especiales = allBirthdays.filter(b => b.type !== 'cumpleanos')

  // --- Facturas próximas (7 días) como avisos ---
  const todayDay = parseInt(TODAY.split('-')[2])
  const paidIds  = new Set((allBillPayments||[]).map(p => p.bill_id))
  const facturasProximas = (allBills||[]).filter(b => {
    const diff = b.due_day - todayDay
    return !paidIds.has(b.id) && diff >= 0 && diff <= 7
  }).sort((a,b) => a.due_day - b.due_day)

  // --- Banner 15 días: cumpleaños + fechas especiales ---
  const en15 = [...cumples, ...especiales].filter(b => {
    const d = daysUntil(b.day, b.month)
    return d >= 0 && d <= 15
  }).sort((a,b) => daysUntil(a.day,a.month) - daysUntil(b.day,b.month))

  // --- Avisos descartables ---
  const avisos30 = especiales.filter(b => {
    const d = daysUntil(b.day, b.month)
    return d > 15 && d <= 30 && !dismissed.includes('30_'+b.id)
  }).sort((a,b) => daysUntil(a.day,a.month) - daysUntil(b.day,b.month))

  const avisos45 = [...cumples, ...especiales].filter(b => {
    const d = daysUntil(b.day, b.month)
    return d > 15 && d <= 45 && !dismissed.includes('45_'+b.id)
  }).sort((a,b) => daysUntil(a.day,a.month) - daysUntil(b.day,b.month))

  let html = ''

  // Avisos facturas próximas 7 días (descartables)
  facturasProximas.forEach(b => {
    const diff = b.due_day - todayDay
    const key = 'bill_'+b.id
    if(dismissed.includes(key)) return
    const fmt = n => '$' + Number(n||0).toLocaleString('es-CO')
    const label = diff === 0 ? '¡Vence hoy!' : `Vence en ${diff} día${diff!==1?'s':''}`
    const color = diff === 0 ? 'var(--red)' : diff <= 3 ? '#f97316' : '#c4b5fd'
    html += `<div class="pfw-aviso" style="background:rgba(196,163,90,0.06);border:1px solid rgba(196,163,90,0.2);color:var(--text)">
      <span>🧾</span>
      <span style="flex:1"><b>${b.name}</b> · ${fmt(b.estimated_amount)} <span style="color:${color};font-size:11px">${label}</span></span>
      <button onclick="pfwDismiss('${key}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" title="No mostrar hoy">×</button>
    </div>`
  })

  // Avisos 45 días (más casuales, descartables)
  avisos45.forEach(b => {
    const d = daysUntil(b.day, b.month)
    const isCumple = b.type === 'cumpleanos'
    const ico = isCumple ? '🎂' : '📅'
    html += `<div class="pfw-aviso pfw-aviso-45">
      <span>${ico}</span>
      <span style="flex:1">${b.name}${isCumple && b.relationship ? ' · '+b.relationship : ''} <span style="color:var(--text-muted)">en ${d} días</span></span>
      <button onclick="pfwDismiss('45_${b.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" title="No mostrar hoy">×</button>
    </div>`
  })

  // Avisos 30 días (especiales, más visibles, descartables)
  avisos30.forEach(b => {
    const d = daysUntil(b.day, b.month)
    html += `<div class="pfw-aviso pfw-aviso-30">
      <span>📅</span>
      <span style="flex:1;font-weight:500">${b.name} <span style="font-weight:400;opacity:.8">en ${d} días</span></span>
      <button onclick="pfwDismiss('30_${b.id}')" style="background:none;border:none;color:#c4b5fd;cursor:pointer;font-size:14px;padding:0 2px;line-height:1" title="No mostrar hoy">×</button>
    </div>`
  })

  // Banner 15 días (colapsado, no descartable)
  if(en15.length){
    const stored = JSON.parse(localStorage.getItem('pfw_banner_open') || 'false')
    const isOpen = stored === true
    const resumen = en15.map(b => {
      const d = daysUntil(b.day, b.month)
      return `${b.type==='cumpleanos'?'🎂':'📅'} <b>${b.name}</b> ${d===0?'¡hoy!':d===1?'mañana':'en '+d+' días'}`
    }).join('<br>')
    html += `<div class="pfw-banner" onclick="pfwToggleBanner(this)">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">${en15[0].type==='cumpleanos'?'🎂':'📅'}</span>
        <span style="font-size:12px;font-weight:600;color:#C4A35A;flex:1">${en15.length === 1 ? en15[0].name : en15.length+' fechas próximas'} <span style="font-weight:400;color:var(--text-muted)">· próximos 15 días</span></span>
        <span class="pfw-arrow" style="font-size:10px;color:var(--text-muted);transition:transform .2s;display:inline-block;${isOpen?'':'transform:rotate(-90deg)'}">▼</span>
      </div>
      <div class="pfw-detail" style="display:${isOpen?'block':'none'};margin-top:10px;padding-top:10px;border-top:1px solid rgba(196,163,90,0.15);font-size:12px;color:var(--text-dim);line-height:2">${resumen}</div>
    </div>`
  }

  targets.forEach(t => t.innerHTML = html)
}

function pfwDismiss(key){
  const dismissed = JSON.parse(localStorage.getItem('pfw_dismissed_' + TODAY) || '[]')
  if(!dismissed.includes(key)) dismissed.push(key)
  localStorage.setItem('pfw_dismissed_' + TODAY, JSON.stringify(dismissed))
  renderProximasFechas()
}

function pfwToggleBanner(el){
  const detail = el.querySelector('.pfw-detail')
  const arrow  = el.querySelector('.pfw-arrow')
  if(!detail) return
  const open = detail.style.display !== 'none'
  // Sync all instances
  document.querySelectorAll('.pfw-detail').forEach(d => d.style.display = open ? 'none' : 'block')
  document.querySelectorAll('.pfw-arrow').forEach(a => a.style.transform = open ? 'rotate(-90deg)' : '')
  localStorage.setItem('pfw_banner_open', JSON.stringify(!open))
}

function renderBirthdays(bds){
  const grid = document.getElementById('bd-grid')
  if(!bds.length){
    grid.style.cssText = ''
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">◉</div>No hay fechas guardadas</div>'
    return
  }

  // Agrupar por tipo, ordenar internamente por días hasta la fecha
  // Cumpleaños vinculados a una persona viven en Personas, no aquí
  bds = bds.filter(b => !(b.type === 'cumpleanos' && b.person_id))
  const TYPE_ORDER = ['cumpleanos','especial','aniversario','cita','pago','evento']
  const grouped = {}
  bds.forEach(b => {
    const t = b.type || b.relationship_type || 'evento'
    if(!grouped[t]) grouped[t] = []
    grouped[t].push(b)
  })
  Object.values(grouped).forEach(arr => arr.sort((a, b) => daysUntil(a.day, a.month) - daysUntil(b.day, b.month)))
  const hasOther = Object.keys(grouped).filter(t => !TYPE_ORDER.includes(t))
  const orderedTypes = [...TYPE_ORDER, ...hasOther].filter(t => grouped[t]?.length)

  grid.style.cssText = 'display:flex;flex-direction:column;gap:1.5rem'
  grid.innerHTML = orderedTypes.map(t => {
    const tipo = FECHA_TIPOS[t] || FECHA_TIPOS.otro
    return `<div>
      <div style="font-size:12px;font-weight:600;color:${tipo.color};margin-bottom:10px;display:flex;align-items:center;gap:8px">
        ${tipo.label}
        <div style="flex:1;height:1px;background:${tipo.color}33"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
        ${grouped[t].map(b => bdCardHTML(b)).join('')}
      </div>
    </div>`
  }).join('')

  // Alert dashboard: todas las fechas en los próximos 30 días, ordenadas por días restantes
  const urgent = bds
    .filter(b => daysUntil(b.day, b.month) <= 30)
    .sort((a, b) => daysUntil(a.day, a.month) - daysUntil(b.day, b.month))
  const pillsHTML = urgent.map(b => {
    const days  = daysUntil(b.day, b.month)
    const cls   = days <= 1 ? 'pill-hot' : days <= 7 ? 'pill-warm' : 'pill-cool'
    const label = days === 0 ? '¡Hoy!' : days === 1 ? 'Mañana' : `en ${days} días`
    const tipo  = FECHA_TIPOS[b.type || b.relationship_type] || FECHA_TIPOS.otro
    return `<span class="pill ${cls}">${tipo.label.split(' ')[0]} ${b.name} — ${label}</span>`
  }).join(' ')
  ;['bd-alert','bd-alert-t'].forEach(alertId => {
    const bar = document.getElementById(alertId)
    if(!bar) return
    const pillsEl = document.getElementById(alertId === 'bd-alert' ? 'bd-pills' : 'bd-pills-t')
    if(urgent.length){
      bar.style.display = 'flex'
      if(pillsEl) pillsEl.innerHTML = pillsHTML
    } else {
      bar.style.display = 'none'
    }
  })
}

function crearTareaDesdefecha(bdId){
  const b = allBirthdays.find(x => String(x.id) === String(bdId))
  if(!b) return
  const tipo = b.type || b.relationship_type || 'evento'
  const TITLES = {
    cumpleanos:  `🎂 Cumpleaños de ${b.name}`,
    especial:    `⭐ Celebración de ${b.name}`,
    aniversario: `💜 Aniversario de ${b.name}`,
    cita:        `🏥 Cita con ${b.name}`,
    pago:        `💰 Pago: ${b.name}`,
    evento:      `🎉 Evento: ${b.name}`,
  }
  const CATS_BY_TYPE = {
    cumpleanos: 'familia', aniversario: 'familia', especial: 'personal',
    cita: 'personal', pago: 'iarcania', evento: 'personal',
  }
  const title = TITLES[tipo] || `📅 ${b.name}`
  const cat   = CATS_BY_TYPE[tipo] || 'personal'
  document.getElementById('modal-task-title').textContent = 'Nueva tarea'
  document.getElementById('t-id').value = ''
  document.getElementById('t-title').value = title
  document.getElementById('t-cat').value = cat
  document.getElementById('t-priority').value = 'alta'
  document.getElementById('t-due').value = ''
  document.getElementById('t-time').value = ''
  document.getElementById('task-delete-btn').style.display = 'none'
  openModal('task')
}

async function saveBirthday(){
  const name = document.getElementById('bd-name').value.trim()
  if(!name) return
  const tipo = document.getElementById('bd-type').value
  await SB_P.from('birthdays').insert({
    id: 'bd_'+Date.now(),
    name,
    type: tipo,
    relationship: document.getElementById('bd-rel').value,
    relationship_type: tipo,
    day: parseInt(document.getElementById('bd-day').value),
    month: parseInt(document.getElementById('bd-month').value),
    time: document.getElementById('bd-time').value || null,
    location: document.getElementById('bd-location').value.trim() || null,
    notes: document.getElementById('bd-notes').value.trim() || null,
    celeb_date: document.getElementById('bd-celeb-date').value || null,
    reminder_days_before: parseInt(document.getElementById('bd-reminder').value)||3
  })
  closeModal('birthday')
  ;['bd-name','bd-rel','bd-time','bd-location','bd-notes','bd-celeb-date'].forEach(id => { document.getElementById(id).value = '' })
  document.getElementById('bd-reminder').value = '3'
  await loadBirthdays()
}

// --- IDEAS ---
async function loadIdeas(){
  const { data } = await SB_P.from('ideas').select('*').order('created_at',{ascending:false})
  window._allIdeas = data || []
  renderIdeas(window._allIdeas)
}

function renderIdeas(ideas){
  const el = document.getElementById('ideas-list')
  if(!ideas.length){ el.innerHTML='<div class="empty-state"><div class="empty-icon">◇</div>No hay ideas todavía</div>'; return }
  el.innerHTML = ideas.map(i => {
    const cat = i.category && CATS[i.category]
    const catBadge = cat ? `<span style="color:${cat.color};font-size:11px;font-weight:600">${cat.label}</span>` : ''
    const ideaTitle = (i.processed_content || i.raw_content || '').substring(0, 200).replace(/"/g, '&quot;')
    const ideaCat = i.category || 'personal'
    return `<div class="idea-card" onclick="openEditIdea('${i.id}')" style="cursor:pointer">
      <div class="idea-raw">${i.raw_content||''}</div>
      ${i.processed_content?`<div class="idea-processed">${i.processed_content}</div>`:''}
      <div class="idea-meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="idea-status ${i.status==='procesada'?'status-procesada':'status-nueva'}">${i.status||'nueva'}</span>
        ${catBadge}
        <span style="color:var(--text-muted)">· ${new Date(i.created_at).toLocaleDateString('es-CO')}</span>
        <button onclick="event.stopPropagation();createTaskFromIdea(this)" data-title="${ideaTitle}" data-cat="${ideaCat}" style="margin-left:auto;font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif">→ Crear tarea</button>
        <button onclick="event.stopPropagation();deleteIdea('${i.id}')" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid rgba(226,75,74,0.3);background:transparent;color:var(--red);cursor:pointer;font-family:'Outfit',sans-serif">✕</button>
      </div>
    </div>`
  }).join('')
}

async function saveIdea(){ await _saveIdea('new-idea') }
async function saveQuickIdea(){ await _saveIdea('quick-idea') }

async function _saveIdea(inputId){
  const raw = document.getElementById(inputId).value.trim()
  if(!raw) return
  const id = 'idea_'+Date.now()
  const catEl = document.getElementById('idea-cat')
  const category = (catEl && inputId === 'new-idea') ? (catEl.value || null) : null
  await SB_P.from('ideas').insert({
    id, user_id: USER_ID, raw_content: raw,
    processed_content: null,
    source: 'text', status: 'nueva',
    category,
    created_at: new Date().toISOString()
  })
  document.getElementById(inputId).value = ''
  if(catEl && inputId === 'new-idea') catEl.value = ''
  await loadIdeas()
}

// --- HABITOS ---
const CAT_COLORS = {
  despertar:           '#FFD166',
  ritual_2020:         '#00C2FF',
  secundarios_manana:  '#C4A35A',
  trabajo_profundo:    '#8B6CF6',
  secundarios_tarde:   '#EF9F27',
  rutina_nocturna:     '#378ADD',
  cierre_dia:          '#6B7FD4',
  inicio_dia:          '#5DCAA5',
  identidad_diaria:    '#C4A35A',
  base_estabilidad:    '#5DCAA5',
  expansion_cognitiva: '#378ADD',
  expansion_creativa:  '#8B6CF6',
  expansion_fisica:    '#EF9F27',
  expansion_relacional:'#E24B4A',
  vida_practica:       '#555050',
  vicios:              '#8B1A1A',
  eventos_crisis:      '#2A2A2A',
}

const CAT_LABELS = {
  despertar:           '🌅 Despertar',
  ritual_2020:         '🔄 20/20/20',
  secundarios_manana:  '☀️ Secundarios mañana',
  trabajo_profundo:    '💼 Trabajo profundo',
  secundarios_tarde:   '🌤️ Secundarios tarde',
  rutina_nocturna:     '🌙 Rutina nocturna',
  cierre_dia:          '🌛 Cierre del día',
  inicio_dia:          '🥗 Inicio del día',
  identidad_diaria:    'Identidad diaria',
  base_estabilidad:    'Estabilidad base',
  expansion_cognitiva: 'Expansión cognitiva',
  expansion_creativa:  'Expansión creativa',
  expansion_fisica:    'Expansión física',
  expansion_relacional:'Expansión relacional',
  vida_practica:       'Vida práctica',
  vicios:              'Vicios',
  eventos_crisis:       'Eventos / crisis',
  trabajo_profundo_meta:'💼 Trabajo',
}

const CAT_ORDER = [
  'despertar','ritual_2020','inicio_dia','identidad_diaria','trabajo_profundo_meta','trabajo_profundo',
  'secundarios_manana','secundarios_tarde','rutina_nocturna','cierre_dia',
  'vicios','expansion_cognitiva','expansion_creativa',
  'expansion_fisica','expansion_relacional','vida_practica',
  'base_estabilidad','eventos_crisis'
]

let allActivities = []
let habitLogs = {}
let foodLogs = {}
let extraLogs = []
let _currentMeal = null
let _mealMenu = null
let _editingLogId = null
let _editInitText = ''
let slotLogs = {}
let _slotMenu = null
let _slotEditing = null
let _slotEditText = ''
let _slotExpandido = null  // actId con picker abierto (modo expandible)
let vicioLogs = {}
let _vicioAbierto = null
let _vicioEditId = null
let _vicioEditText = ''
let choreToday = {}
let choreHistory = []
let _choreInput = null
let _choreInputText = ''
let _chorePersonPicker = null
const CHORES_DEF = [
  { id:'cocinar',    label:'Cocinar',     icon:'🍳', multiNote:true },
  { id:'loza',       label:'Loza',        icon:'🍽️', multiNote:true },
  { id:'barrer',     label:'Barrer',      icon:'🧹', multiNote:true },
  { id:'lavar_ropa', label:'Lavar ropa',  icon:'🧺' },
  { id:'colgar_ropa',label:'Colgar ropa', icon:'👕' },
  { id:'basura',     label:'Basura',      icon:'🗑️' },
  { id:'bano',       label:'Baño',        icon:'🧽' }
]
const SLOT_HABITS = {
  a12: [{id:'manana',label:'Mañana',icon:'🌅'},{id:'tarde',label:'Tarde',icon:'☀️'},{id:'noche',label:'Noche',icon:'🌙'}],
  a07: [{id:'manana',label:'Mañana',icon:'🌅'},{id:'noche',label:'Noche',icon:'🌙'}],
  a14: [{id:'frio',label:'Frío',icon:'🚿'},{id:'completo',label:'Completo',icon:'🛁'}]
}
const SLOT_EXPANDIBLE = new Set(['a14'])
const MEALS = [
  { id:'desayuno', label:'Desayuno', icon:'☕' },
  { id:'almuerzo', label:'Almuerzo', icon:'🍽️' },
  { id:'cena',     label:'Cena',     icon:'🌙' },
  { id:'extra',    label:'Extra',    icon:'🍎' }
]
let weeklyLogs = {}
let monthlyLogs = {}
let openProgressId = null
let progressAnchorDates = {}
let showInactive = false
let currentCatFilter = 'all'
let currentFreqFilter = 'todos_diarios'

// Crisis mode — se guarda por fecha en localStorage
function getCrisisHoy(){ return JSON.parse(localStorage.getItem('crisis_' + TODAY) || 'null') }
function setCrisisHoy(id){ if(id) localStorage.setItem('crisis_' + TODAY, JSON.stringify(id)); else localStorage.removeItem('crisis_' + TODAY) }
function isCrisisModeActive(){ return !!getCrisisHoy() }
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
// Siempre usa timezone de Bogotá y normaliza a YYYY-MM-DD (por si due_date viene como timestamp de Supabase)
function todayBogota() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) }
let selectedDate = TODAY

async function loadHabitos(){
  const { data: acts } = await SB_P.from('activities').select('*').order('sort_order').order('name')
  allActivities = acts || []

  // Daily logs
  const { data: logs } = await SB_P.from('activity_logs')
    .select('*').eq('user_id', USER_ID).eq('date', selectedDate)
  habitLogs = {}
  foodLogs = {}
  extraLogs = []
  slotLogs = {}
  vicioLogs = {}
  Object.keys(SLOT_HABITS).forEach(id => { slotLogs[id] = {} })
  ;(logs||[]).forEach(l => {
    habitLogs[l.activity_id] = l
    if(l.activity_id === 'a15'){
      const meal = (l.notes||'').split('|')[0]
      if(meal === 'extra') extraLogs.push(l)
      else if(meal) foodLogs[meal] = l
    }
    if(SLOT_HABITS[l.activity_id]){
      const slot = (l.notes||'').split('|')[0]
      if(slot && SLOT_HABITS[l.activity_id].find(s => s.id === slot))
        slotLogs[l.activity_id][slot] = l
    }
    const actDef = allActivities.find(a => a.id === l.activity_id)
    if(actDef && actDef.category === 'vicios'){
      if(!vicioLogs[l.activity_id]) vicioLogs[l.activity_id] = []
      vicioLogs[l.activity_id].push(l)
    }
  })

  // Weekly logs (Monday to Sunday of current week)
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now); monday.setDate(now.getDate() - (day===0?6:day-1)); monday.setHours(0,0,0,0)
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6)
  const weekStart = monday.toISOString().split('T')[0]
  const weekEnd   = sunday.toISOString().split('T')[0]
  const { data: wlogs } = await SB_P.from('activity_logs')
    .select('*').eq('user_id', USER_ID).gte('date', weekStart).lte('date', weekEnd)
  weeklyLogs = {}
  ;(wlogs||[]).forEach(l => {
    if(!weeklyLogs[l.activity_id]) weeklyLogs[l.activity_id] = []
    weeklyLogs[l.activity_id].push(l)
  })

  // Monthly logs
  const monthStart = TODAY.slice(0,7)+'-01'
  const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()
  const monthEnd = TODAY.slice(0,7)+'-'+String(lastDay).padStart(2,'0')
  const { data: mlogs } = await SB_P.from('activity_logs')
    .select('*').eq('user_id', USER_ID).gte('date', monthStart).lte('date', monthEnd)
  monthlyLogs = {}
  ;(mlogs||[]).forEach(l => {
    if(!monthlyLogs[l.activity_id]) monthlyLogs[l.activity_id] = []
    monthlyLogs[l.activity_id].push(l)
  })

  renderHabitos()
  if(selectedDate === TODAY){
    renderVicios()
    update2020Widget()
    renderAlimentacionDash()
  }
}

// --- VICIOS ---
function renderVicios(){
  const el = document.getElementById('vicios-list')
  if(!el) return
  const vicios = allActivities.filter(a => a.category === 'vicios' && a.is_active)
  if(!vicios.length){
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>No hay vicios registrados. Agrégalos desde Hábitos con categoría "vicios".</div>'
    return
  }
  let totalCaidas = 0, viciosConCaidas = 0
  vicios.forEach(a => {
    const logs = vicioLogs[a.id] || []
    if(logs.length){ totalCaidas += logs.length; viciosConCaidas++ }
  })
  const subEl = document.getElementById('vicios-sub')
  if(subEl) subEl.textContent = totalCaidas === 0
    ? '¡Sin caídas hoy! 💪'
    : `Hoy: ${totalCaidas} caída${totalCaidas!==1?'s':''} en ${viciosConCaidas} vicio${viciosConCaidas!==1?'s':''}`
  el.innerHTML = vicios.map(a => renderVicioWidget(a)).join('')
  if(_vicioAbierto){
    const inp = document.getElementById('vicio-input-text')
    if(inp){ inp.value = _vicioEditText; inp.focus() }
  }
}

function renderVicioWidget(a){
  const logs = vicioLogs[a.id] || []
  const count = logs.length
  const isBinary = !a.unit
  const isOpen = _vicioAbierto === a.id

  let btnBorder, btnBg, btnColor, btnLabel
  if(isBinary){
    if(count === 0){
      btnBorder = '#5DCAA5'; btnBg = 'rgba(93,202,165,0.08)'; btnColor = '#5DCAA5'
      btnLabel = '✓ Sin caídas'
    } else {
      btnBorder = '#E24B4A'; btnBg = 'rgba(226,75,74,0.08)'; btnColor = '#E24B4A'
      btnLabel = `⚠️ ${count} caída${count!==1?'s':''}`
    }
  } else {
    const total = logs.reduce((s,l) => s+(parseFloat(l.value)||1), 0)
    btnBorder = count===0 ? 'var(--border)' : '#c9a84c'
    btnBg = count===0 ? 'transparent' : 'rgba(201,168,76,0.08)'
    btnColor = count===0 ? 'var(--text-muted)' : 'var(--gold)'
    btnLabel = count===0 ? `0 ${a.unit}s` : `${total} ${a.unit}${total!==1?'s':''} hoy`
  }

  const inputHtml = isOpen ? `
    <div style="margin:8px 0">
      <input type="text" id="vicio-input-text" placeholder="${isBinary?'¿Cómo fue? Ej: comí brownies':'Descripción (opcional)'}"
        style="width:100%;background:#0C0C0C;border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box"
        onkeydown="if(event.key==='Enter') guardarVicio()">
      <div style="display:flex;gap:6px;margin-top:6px">
        <button onclick="cerrarVicio()" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px">Cancelar</button>
        <button onclick="guardarVicio()" style="flex:1;padding:6px;border-radius:6px;border:1px solid #E24B4A;background:rgba(226,75,74,0.1);color:#E24B4A;cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px">Guardar</button>
      </div>
    </div>` : ''

  const logsList = logs.map((log,i) => {
    const hora = log.created_at ? new Date(log.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : ''
    const desc = log.notes || ''
    const micro = (fn,lbl) => `<button onclick="${fn}" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px 3px;line-height:1;flex-shrink:0">${lbl}</button>`
    return `<div style="font-size:11px;color:var(--text-muted);padding:3px 0;display:flex;align-items:center;gap:4px">
      <span style="flex:1">${hora}${desc?' — '+desc:''}</span>
      ${micro(`editarVicioLog('${log.id}','${a.id}')`, '✏️')}${micro(`eliminarVicioLog('${log.id}','${a.id}')`, '🗑️')}
    </div>`
  }).join('')

  return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:${isOpen||count>0?'8px':'0'}">
      <span style="font-size:13px;font-weight:600;color:var(--text)">${a.name}</span>
      <button onclick="abrirVicio('${a.id}')" style="padding:6px 12px;border-radius:8px;border:1px solid ${btnBorder};background:${btnBg};color:${btnColor};cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px;white-space:nowrap">${btnLabel} +</button>
    </div>
    ${inputHtml}
    ${logsList ? `<div style="border-top:1px solid var(--border);padding-top:6px">${logsList}</div>` : ''}
  </div>`
}

function _renderViciosCtx(){
  // Si estamos en Hábitos (con filtro vicios o "todos"), re-render Hábitos
  // Si estamos en Rachas, re-render Rachas
  // Siempre re-render Vicios también (por si acaso)
  const habitosActive = document.getElementById('section-habitos')?.classList.contains('active')
  const rachasActive  = document.getElementById('section-rachas')?.classList.contains('active')
  if(habitosActive) renderHabitos()
  else if(rachasActive) renderRachas()
  else renderVicios()
}

function abrirVicio(actId){
  _vicioAbierto = _vicioAbierto === actId ? null : actId
  _vicioEditId = null
  _vicioEditText = ''
  _renderViciosCtx()
}

function cerrarVicio(){
  _vicioAbierto = null
  _vicioEditId = null
  _vicioEditText = ''
  _renderViciosCtx()
}

async function guardarVicio(){
  const actId = _vicioAbierto
  if(!actId) return
  const text = document.getElementById('vicio-input-text')?.value.trim() || ''
  if(_vicioEditId){
    const { error } = await SB_P.from('activity_logs').update({ notes: text }).eq('id', _vicioEditId)
    if(error){ showToast('❌ '+error.message); return }
    const arr = vicioLogs[actId] || []
    const idx = arr.findIndex(l => l.id === _vicioEditId)
    if(idx !== -1) arr[idx] = { ...arr[idx], notes: text }
  } else {
    const id = 'log_'+Date.now()
    const { error } = await SB_P.from('activity_logs').insert({
      id, user_id: USER_ID, activity_id: actId, value: 1, date: TODAY, notes: text,
      created_at: new Date().toISOString()
    })
    if(error){ showToast('❌ '+error.message); return }
    if(!vicioLogs[actId]) vicioLogs[actId] = []
    vicioLogs[actId].push({ id, notes: text, created_at: new Date().toISOString() })
    habitLogs[actId] = { id, notes: text, created_at: new Date().toISOString() }
  }
  _vicioAbierto = null
  _vicioEditId = null
  _vicioEditText = ''
  _renderViciosCtx()
}

function editarVicioLog(logId, actId){
  const arr = vicioLogs[actId] || []
  const log = arr.find(l => l.id === logId)
  if(!log) return
  _vicioAbierto = actId
  _vicioEditId = logId
  _vicioEditText = log.notes || ''
  _renderViciosCtx()
}

async function eliminarVicioLog(logId, actId){
  if(!confirm('¿Eliminar este registro?')) return
  const { error } = await SB_P.from('activity_logs').delete().eq('id', logId)
  if(error){ showToast('❌ '+error.message); return }
  if(vicioLogs[actId]){
    vicioLogs[actId] = vicioLogs[actId].filter(l => l.id !== logId)
    if(!vicioLogs[actId].length) delete habitLogs[actId]
  }
  _renderViciosCtx()
}

// ─── RACHAS ──────────────────────────────────────────────────────────────────

let _rachaDetalleId = null

let _gestionTab = 'semanal'

function switchGestionTab(tab, btn){
  _gestionTab = tab
  document.querySelectorAll('#section-gestion-habitos .freq-tab').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  renderGestionHabitos()
}

function renderGestionHabitos(){
  const el = document.getElementById('gestion-habitos-list')
  if(!el) return

  if(_gestionTab === 'todos_diarios'){
    const SECUNDARIOS_CATS = ['secundarios_manana', 'secundarios_tarde']
    const toShow = allActivities.filter(a => {
      if(!a.is_active) return false
      if(a.id === 'a70') return false
      return (a.frequency || 'diaria') === 'diaria'
    })
    const grouped = {}
    toShow.forEach(a => { if(!grouped[a.category]) grouped[a.category]=[]; grouped[a.category].push(a) })
    const CAT_ORDER_LOCAL = ['despertar','ritual_2020','identidad_diaria','trabajo_profundo','secundarios_manana','secundarios_tarde','rutina_nocturna','vicios','expansion_cognitiva','expansion_creativa','expansion_fisica','expansion_relacional','vida_practica','base_estabilidad']
    const orderedCats = CAT_ORDER_LOCAL.filter(c => grouped[c])
    const rest = Object.keys(grouped).filter(c => !CAT_ORDER_LOCAL.includes(c))
    el.innerHTML = [...orderedCats, ...rest].map(cat => {
      const color = CAT_COLORS[cat] || '#555'
      const label = CAT_LABELS[cat] || cat
      return `<div class="habito-group">
        <div class="habito-group-title" style="color:${color}">${label}<div class="habito-group-line"></div></div>
        <div style="display:flex;flex-direction:column;gap:5px">${grouped[cat].map(a => habitoHTML(a)).join('')}</div>
      </div>`
    }).join('')
    return
  }

  if(_gestionTab === 'crisis'){
    // Reutiliza la misma lógica del render de crisis en hábitos
    const crisisActs = allActivities.filter(a => a.category === 'eventos_crisis')
    const activaCrisis = getCrisisHoy()
    el.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;padding:10px 12px;background:rgba(226,75,74,0.06);border:1px solid rgba(226,75,74,0.15);border-radius:8px">
        Activar un modo de crisis hace que los hábitos del día no cuenten para rachas. El 20/20/20 sigue siendo obligatorio siempre.
      </div>
      ${crisisActs.map(a => {
        const isActive = activaCrisis === a.id
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-card);border:1px solid ${isActive?'rgba(226,75,74,0.5)':'var(--border)'};border-radius:8px;margin-bottom:8px">
          <div style="flex:1;font-size:13px;color:${isActive?'var(--red)':'var(--text)'};font-weight:${isActive?'600':'400'}">${a.name}</div>
          ${isActive
            ? `<button onclick="toggleCrisis('${a.id}');renderGestionHabitos()" style="font-size:11px;padding:5px 12px;background:rgba(226,75,74,0.12);border:1px solid rgba(226,75,74,0.3);border-radius:6px;color:var(--red);cursor:pointer;font-family:'Outfit',sans-serif">✕ Desactivar</button>`
            : `<button onclick="toggleCrisis('${a.id}');renderGestionHabitos()" style="font-size:11px;padding:5px 12px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif">Activar</button>`
          }
        </div>`
      }).join('')}
      ${activaCrisis ? `<div style="margin-top:8px;font-size:11px;color:var(--red);text-align:center">🚨 Modo crisis activo hoy — los hábitos no cuentan para rachas (excepto 20/20/20)</div>` : ''}
    `
    return
  }

  const acts = allActivities.filter(a => {
    if(!showInactive && !a.is_active) return false
    const freq = a.frequency || 'diaria'
    if(_gestionTab === 'recurrente') return freq === 'recurrente'
    return freq === _gestionTab
  })

  if(!acts.length){
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◑</div>No hay hábitos en esta frecuencia</div>`
    return
  }

  el.innerHTML = acts.map(a => habitoPeriodicoHTML(a, _gestionTab)).join('')
}

function switchRachasTab(tab, btn){
  document.querySelectorAll('#section-rachas .freq-tab').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById('rachas-panel').style.display  = tab === 'rachas' ? 'block' : 'none'
  document.getElementById('logros-panel').style.display  = tab === 'logros'  ? 'block' : 'none'
  if(tab === 'logros') loadLogros()
}

function renderRachas(){
  const panorama = document.getElementById('rachas-panorama')
  const detalle  = document.getElementById('rachas-detalle')
  if(!panorama) return

  const acts = allActivities.filter(a =>
    a.is_active &&
    (a.frequency||'diaria') !== 'unico' &&
    (a.frequency||'diaria') !== 'unica'
  )

  if(!acts.length){
    panorama.innerHTML = '<div class="empty-state"><div class="empty-icon">📈</div>No hay hábitos activos aún.</div>'
    return
  }

  panorama.innerHTML = acts.map(a => _rachaCardHTML(a)).join('')

  if(_rachaDetalleId){
    detalle.style.display = 'block'
    _abrirRachaDetalle(_rachaDetalleId, false)
  }
}

function _rachaCardHTML(a){
  const freq  = a.frequency || 'diaria'
  const color = a.color || CAT_COLORS[a.category] || '#f97316'
  const cat   = CAT_LABELS[a.category] || ''

  // Racha actual: días/semanas/meses consecutivos con log hasta hoy
  let rachaLabel = ''
  if(freq === 'diaria'){
    let n = 0
    const d = new Date(TODAY)
    while(true){
      const ds = d.toISOString().slice(0,10)
      if(!habitLogs[a.id] && ds === TODAY){ break } // hoy sin marcar aún
      // Para la racha necesitamos saber si ese día tiene log — usamos vicioLogs o habitLogs solo para hoy
      // Para días pasados no tenemos cache, así que mostramos "ver detalle"
      break
    }
    rachaLabel = habitLogs[a.id] ? '✓ hoy' : '—'
  } else if(freq === 'semanal'){
    const wLogs = weeklyLogs[a.id] || []
    rachaLabel = wLogs.length ? '✓ esta sem.' : '—'
  } else if(freq === 'mensual'){
    const mLogs = monthlyLogs[a.id] || []
    rachaLabel = mLogs.length ? '✓ este mes' : '—'
  } else if(freq === 'recurrente'){
    rachaLabel = '∞'
  }

  const rachaColor = rachaLabel.startsWith('✓') ? color : rachaLabel === '∞' ? color : 'var(--text-muted)'

  return `<div onclick="_abrirRachaDetalle('${a.id}',true)" style="background:var(--bg-card);border:1px solid var(--border);border-left:3px solid ${color};border-radius:8px;padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:border-color .15s" onmouseover="this.style.borderColor='${color}'" onmouseout="this.style.borderColor='var(--border)'">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${cat} · ${freq}</div>
    </div>
    <div style="font-size:12px;font-weight:600;color:${rachaColor};flex-shrink:0">${rachaLabel}</div>
    <div style="font-size:11px;color:var(--text-muted);flex-shrink:0">▸</div>
  </div>`
}

async function _abrirRachaDetalle(activityId, scroll){
  _rachaDetalleId = activityId
  const detalle = document.getElementById('rachas-detalle')
  const act = allActivities.find(a => a.id === activityId)
  if(!detalle || !act) return

  detalle.style.display = 'block'
  detalle.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <div>
      <div style="font-size:15px;font-weight:600;color:var(--text)">${act.name}</div>
      <div style="font-size:11px;color:var(--text-muted)">${CAT_LABELS[act.category]||''} · ${act.frequency||'diaria'}</div>
    </div>
    <button onclick="_cerrarRachaDetalle()" style="background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);padding:4px 10px;cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px">✕ Cerrar</button>
  </div>
  <div id="rachas-detalle-contenido"><div style="padding:14px;text-align:center;font-size:12px;color:var(--text-muted)">Cargando historial…</div></div>`

  if(scroll) detalle.scrollIntoView({behavior:'smooth', block:'start'})

  await _renderRachaDetalleContenido(activityId)
}

async function _renderRachaDetalleContenido(activityId, customAnchor){
  const contenido = document.getElementById('rachas-detalle-contenido')
  if(!contenido) return
  const act = allActivities.find(a => a.id === activityId)
  if(!act) return

  const freq = act.frequency || 'diaria'
  const habitColor = act.color || CAT_COLORS[act.category] || '#f97316'

  const { data: logs } = await SB_P.from('activity_logs')
    .select('date')
    .eq('activity_id', activityId)
    .eq('user_id', USER_ID)
    .order('date')

  const allLogDates = (logs||[]).map(l => l.date).sort()
  const logSet = new Set(allLogDates)
  const firstLogDate = allLogDates.length ? allLogDates[0] : TODAY

  if(customAnchor) progressAnchorDates[activityId] = customAnchor
  if(!progressAnchorDates[activityId]){
    const d = new Date(TODAY); d.setMonth(d.getMonth()-3)
    progressAnchorDates[activityId] = d.toISOString().slice(0,10)
  }
  const anchorDate = progressAnchorDates[activityId]

  let gridHTML = '', listHTML = ''
  if(freq === 'diaria' || freq === 'recurrente'){
    const cells = _hpDayCells(anchorDate, firstLogDate, logSet, freq)
    gridHTML = _hpDayGrid(cells, habitColor)
    listHTML = _hpDayList(cells, habitColor, firstLogDate)
  } else if(freq === 'semanal'){
    const cells = _hpWeekCells(anchorDate, firstLogDate, logSet)
    gridHTML = _hpWeekGrid(cells, habitColor)
    listHTML = _hpWeekList(cells, habitColor)
  } else if(freq === 'mensual'){
    const cells = _hpMonthCells(anchorDate, firstLogDate, logSet)
    gridHTML = _hpMonthGrid(cells, habitColor)
    listHTML = _hpMonthList(cells, habitColor)
  }

  contenido.innerHTML = `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em">Historial · ${freq}</span>
      <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted)">
        desde <input type="date" value="${anchorDate}"
          onchange="_renderRachaDetalleContenido('${activityId}',this.value)"
          style="background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:2px 5px;font-size:11px;font-family:'Outfit',sans-serif">
      </label>
    </div>
    <div style="--hp-color:${habitColor}">${gridHTML}</div>
    <div style="margin-top:12px">${listHTML}</div>
  </div>`
}

function _cerrarRachaDetalle(){
  _rachaDetalleId = null
  const detalle = document.getElementById('rachas-detalle')
  if(detalle){ detalle.style.display='none'; detalle.innerHTML='' }
}

// ─────────────────────────────────────────────────────────────────────────────

// --- LOGROS ---
const LOGROS_202020 = ['saltos', 'meditar', 'baño'] // palabras clave en nombre

const LOGRO_DEFS_HABIT = [
  { id:'first',    icon:'🌅', name:'Primer paso',        desc:'Completaste este hábito por primera vez',            reward:'🤝 Ya empezaste — eso es lo más difícil' },
  { id:'streak7',  icon:'🔥', name:'Racha 7 días',       desc:'7 días consecutivos sin fallar',                     reward:'🍫 Mereces un chocolate' },
  { id:'streak14', icon:'🔥🔥',name:'Racha 14 días',     desc:'Dos semanas seguidas sin parar',                     reward:'🧃 Un jugo o bebida especial' },
  { id:'streak30', icon:'💪', name:'Racha 30 días',      desc:'Un mes entero de consistencia',                      reward:'🍕 Pide lo que más se te antoje para cenar' },
  { id:'streak100',icon:'🏆', name:'Racha 100 días',     desc:'100 días consecutivos — eso es carácter',            reward:'🎉 Una salida especial: restaurant, cine, lo que quieras' },
  { id:'week_perfect', icon:'⭐', name:'Semana perfecta', desc:'7/7 días completados en una semana',                reward:'🍬 Un dulce a tu elección' },
  { id:'month_perfect',icon:'🌟',name:'Mes perfecto',    desc:'Todos los días del mes completados',                 reward:'🛍️ Cómprate algo que tengas pendiente' },
  { id:'comeback', icon:'💫', name:'Comeback',           desc:'Fallaste una vez pero volviste al día siguiente',    reward:'🤝 Bienvenido de vuelta — la racha continúa' },
]
// Volume cada 20 se genera dinámicamente

const LOGRO_DEFS_GLOBAL = [
  { id:'dia_perfecto',    icon:'🎯', name:'Día perfecto',          desc:'Todos tus hábitos diarios completados en un mismo día',       reward:'☕ Un café o snack especial que te guste' },
  { id:'semana_perfecta', icon:'🗓️', name:'Semana perfecta global', desc:'Todos tus hábitos diarios completados cada día de la semana', reward:'🍽️ Sal a comer donde quieras' },
  { id:'en_racha',        icon:'⚡', name:'En racha',              desc:'3 hábitos distintos con racha activa al mismo tiempo',        reward:'🎁 Un pequeño regalo para ti' },
  { id:'sin_pausa',       icon:'⚡', name:'Sin pausa',             desc:'5 días seguidos sin un solo fallo en ningún hábito',          reward:'🎮 Una tarde libre sin culpas' },
  { id:'muro',            icon:'🧱', name:'Muro',                  desc:'30 días consecutivos con al menos 1 hábito completado',       reward:'🧘 Una tarde de descanso total' },
  { id:'muro_hierro',     icon:'🔩', name:'Muro de hierro',        desc:'30 días con el 20/20/20 completado cada día',                 reward:'👟 Cómprate algo para tu rutina física' },
  { id:'equilibrado',     icon:'🌈', name:'Equilibrado',           desc:'1 hábito de cada categoría completado en el mismo día',       reward:'🍱 Un almuerzo especial donde quieras' },
  { id:'polimata',        icon:'🎭', name:'Polímata',              desc:'Tienes hábitos activos en 4 o más categorías distintas',      reward:'📚 Compra ese libro o curso que tienes pendiente' },
  { id:'centenario',      icon:'💯', name:'Centenario',            desc:'100 logs totales entre todos tus hábitos',                    reward:'🍣 Una cena especial' },
  { id:'tsunami',         icon:'🌊', name:'Tsunami',               desc:'500 logs totales — eres una máquina',                        reward:'✈️ Planifica un viaje o escapada' },
]

function _currentStreak(sortedDates){
  if(!sortedDates.length) return 0
  const ds = [...sortedDates].sort().reverse()
  const today = TODAY
  const yesterday = _offsetDate(today, -1)
  if(ds[0] !== today && ds[0] !== yesterday) return 0
  let streak = 1
  for(let i=1;i<ds.length;i++){
    const expected = _offsetDate(ds[i-1], -1)
    if(ds[i] === expected) streak++
    else break
  }
  return streak
}

function _maxStreak(sortedDates){
  if(!sortedDates.length) return 0
  const ds = [...sortedDates].sort()
  let max = 1, cur = 1
  for(let i=1;i<ds.length;i++){
    if(ds[i] === _offsetDate(ds[i-1], 1)){ cur++; if(cur>max) max=cur }
    else cur=1
  }
  return max
}

function _offsetDate(dateStr, days){
  const d = new Date(dateStr); d.setDate(d.getDate()+days)
  return d.toISOString().slice(0,10)
}

function _perfectWeeksCount(sortedDates, firstLogDate){
  if(!sortedDates.length) return 0
  const set = new Set(sortedDates)
  const start = new Date(firstLogDate)
  const dow = start.getDay()===0?6:start.getDay()-1
  start.setDate(start.getDate()-dow)
  let count = 0
  const today = new Date(TODAY)
  while(start <= today){
    const end = new Date(start); end.setDate(start.getDate()+6)
    if(end < today){
      let perfect = true
      for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
        if(!set.has(d.toISOString().slice(0,10))){ perfect=false; break }
      }
      if(perfect) count++
    }
    start.setDate(start.getDate()+7)
  }
  return count
}

function _perfectMonthsCount(sortedDates, firstLogDate){
  if(!sortedDates.length) return 0
  const set = new Set(sortedDates)
  const start = new Date(firstLogDate.slice(0,7)+'-01')
  const today = new Date(TODAY)
  let count = 0
  while(start < today){
    const y = start.getFullYear(), m = start.getMonth()
    const last = new Date(y, m+1, 0)
    if(last < today){
      let perfect = true
      for(let d=new Date(start); d<=last; d.setDate(d.getDate()+1)){
        if(!set.has(d.toISOString().slice(0,10))){ perfect=false; break }
      }
      if(perfect) count++
    }
    start.setMonth(start.getMonth()+1)
  }
  return count
}

function _hasComeback(sortedDates){
  if(sortedDates.length < 2) return false
  const ds = [...sortedDates].sort()
  for(let i=1;i<ds.length-1;i++){
    const prev = ds[i-1], curr = ds[i], next = ds[i+1]
    const gap1 = (new Date(curr)-new Date(prev))/(86400000)
    const gap2 = (new Date(next)-new Date(curr))/(86400000)
    if(gap1 > 1 && gap2 === 1) return true
  }
  return false
}

function _computeHabitAchievements(activity, logDates){
  const sorted = [...logDates].sort()
  const freq = activity.frequency || 'diaria'
  const isDaily = freq === 'diaria' || freq === 'recurrente'
  const results = []

  const streak = isDaily ? _currentStreak(sorted) : 0
  const maxSt  = isDaily ? _maxStreak(sorted) : 0
  const total  = sorted.length
  const firstLog = sorted[0] || TODAY

  for(const def of LOGRO_DEFS_HABIT){
    let earned = false, progress = ''
    if(def.id === 'first'){
      earned = total > 0
    } else if(def.id === 'streak7'){
      earned = maxSt >= 7
      if(!earned) progress = `${Math.min(streak,maxSt)}/7 días`
    } else if(def.id === 'streak14'){
      earned = maxSt >= 14
      if(!earned) progress = `${Math.min(streak,maxSt)}/14 días`
    } else if(def.id === 'streak30'){
      earned = maxSt >= 30
      if(!earned) progress = `${Math.min(streak,maxSt)}/30 días`
    } else if(def.id === 'streak100'){
      earned = maxSt >= 100
      if(!earned) progress = `${Math.min(streak,maxSt)}/100 días`
    } else if(def.id === 'week_perfect'){
      if(isDaily){ earned = _perfectWeeksCount(sorted, firstLog) > 0 }
    } else if(def.id === 'month_perfect'){
      if(isDaily){ earned = _perfectMonthsCount(sorted, firstLog) > 0 }
    } else if(def.id === 'comeback'){
      earned = _hasComeback(sorted)
    }
    if(!isDaily && ['streak7','streak14','streak30','streak100','week_perfect','month_perfect','comeback'].includes(def.id)) continue
    results.push({...def, earned, progress})
  }

  // Volume cada 20
  const milestones = []
  for(let n=20; n<=Math.max(total+20, 200); n+=20){
    const icons = ['📌','📈','💎','👑','🚀','🌠','🔱','⚜️','🏅','🎖️']
    const ic = icons[Math.floor((n/20)-1) % icons.length]
    milestones.push({
      id:`vol_${n}`, icon:ic, name:`${n} completados`,
      desc:`Has completado este hábito ${n} veces`,
      reward: n<=60 ? '🍬 Un dulce merecido' : n<=100 ? '🍕 Una comida especial' : n<=200 ? '🎉 Celébralo como mereces' : '🏆 Eres una leyenda',
      earned: total >= n,
      progress: total < n ? `${total}/${n}` : ''
    })
    if(n > total + 60) break
  }
  return [...results, ...milestones]
}

async function loadLogros(){
  const el = document.getElementById('logros-list')
  if(!el) return
  el.innerHTML = '<div class="loading"><div class="spinner"></div><br>Calculando logros…</div>'

  if(!allActivities.length){
    const { data } = await SB_P.from('activities').select('*').eq('user_id', USER_ID)
    allActivities = data || []
  }

  const active = allActivities.filter(a => a.is_active && !['unico','unica'].includes(a.frequency))

  // Fetch todos los logs de todos los hábitos activos
  const { data: allLogs } = await SB_P.from('activity_logs')
    .select('date,activity_id')
    .eq('user_id', USER_ID)
    .order('date')

  const logsByHabit = {}
  ;(allLogs||[]).forEach(l => {
    if(!logsByHabit[l.activity_id]) logsByHabit[l.activity_id] = []
    logsByHabit[l.activity_id].push(l.date)
  })

  // ── Logros globales ──
  const globalResults = _computeGlobalAchievements(active, allLogs||[], logsByHabit)

  // ── Logros por hábito ──
  const habitSections = active.map(a => {
    const logs = logsByHabit[a.id] || []
    const achievements = _computeHabitAchievements(a, logs)
    const earned = achievements.filter(x=>x.earned).length
    return { activity: a, achievements, earned }
  }).filter(s => s.achievements.length > 0)
    .sort((a,b) => b.earned - a.earned)

  const totalEarned = globalResults.filter(x=>x.earned).length + habitSections.reduce((s,h)=>s+h.earned,0)
  const totalPossible = globalResults.length + habitSections.reduce((s,h)=>s+h.achievements.length,0)

  let html = `<div style="font-size:12px;color:var(--text-muted);margin-bottom:1rem">
    <span style="font-size:18px;font-weight:700;color:var(--gold)">${totalEarned}</span> / ${totalPossible} insignias desbloqueadas
  </div>`

  // Global
  html += `<div class="logro-section-title">🌍 Multihabito</div><div class="logro-grid">`
  for(const g of globalResults) html += _logroBadgeHTML(g)
  html += '</div>'

  // Por hábito
  for(const s of habitSections){
    const color = s.activity.color || '#f97316'
    html += `<div class="logro-section-title" style="color:${color}">${s.activity.name}</div><div class="logro-grid">`
    for(const ach of s.achievements) html += _logroBadgeHTML(ach)
    html += '</div>'
  }

  el.innerHTML = html
}

function _computeGlobalAchievements(active, allLogs, logsByHabit){
  const results = []
  const dailyActs = active.filter(a => a.frequency === 'diaria')
  const allLogDates = allLogs.map(l=>l.date).sort()
  const totalLogs = allLogs.length

  // Día perfecto — ¿existió algún día donde todos los hábitos diarios tuvieron log?
  let diaPerfecto = false
  if(dailyActs.length){
    const dateCount = {}
    for(const l of allLogs){
      if(dailyActs.find(a=>a.id===l.activity_id)){
        dateCount[l.date] = (dateCount[l.date]||new Set())
        dateCount[l.date].add(l.activity_id)
      }
    }
    for(const [, set] of Object.entries(dateCount)){
      if(set.size >= dailyActs.length){ diaPerfecto=true; break }
    }
  }

  // Semana perfecta global
  let semanaPerfecta = false
  if(dailyActs.length){
    const dateActSet = {}
    for(const l of allLogs){
      if(dailyActs.find(a=>a.id===l.activity_id)){
        if(!dateActSet[l.date]) dateActSet[l.date] = new Set()
        dateActSet[l.date].add(l.activity_id)
      }
    }
    const allDates = Object.keys(dateActSet).sort()
    for(let i=0;i<allDates.length-6;i++){
      let ok = true
      for(let j=0;j<7;j++){
        const expected = _offsetDate(allDates[i], j)
        if(!dateActSet[expected] || dateActSet[expected].size < dailyActs.length){ ok=false; break }
      }
      if(ok){ semanaPerfecta=true; break }
    }
  }

  // En racha — 3+ hábitos con racha activa
  let enRacha = 0
  for(const a of active){
    const logs = (logsByHabit[a.id]||[]).sort()
    if(_currentStreak(logs) > 0) enRacha++
  }

  // Sin pausa — 5 días seguidos sin fallo en ningún hábito diario
  let sinPausa = false
  if(dailyActs.length){
    const dateActSet2 = {}
    for(const l of allLogs){
      if(dailyActs.find(a=>a.id===l.activity_id)){
        if(!dateActSet2[l.date]) dateActSet2[l.date] = new Set()
        dateActSet2[l.date].add(l.activity_id)
      }
    }
    const allDates2 = Object.keys(dateActSet2).sort()
    for(let i=0;i<allDates2.length-4;i++){
      let ok = true
      for(let j=0;j<5;j++){
        const expected = _offsetDate(allDates2[i], j)
        if(!dateActSet2[expected] || dateActSet2[expected].size < dailyActs.length){ ok=false; break }
      }
      if(ok){ sinPausa=true; break }
    }
  }

  // Muro — 30 días con al menos 1 log cualquier hábito
  let muro = false
  {
    const uniqueDates = [...new Set(allLogs.map(l=>l.date))].sort()
    for(let i=0;i<uniqueDates.length-29;i++){
      let ok = true
      for(let j=0;j<30;j++){
        if(uniqueDates[i+j] !== _offsetDate(uniqueDates[i], j)){ ok=false; break }
      }
      if(ok){ muro=true; break }
    }
  }

  // Muro de hierro — 30 días con Saltos + Meditar + Baño
  let muroHierro = false
  {
    const actos202020 = active.filter(a => LOGROS_202020.some(kw => a.name.toLowerCase().includes(kw)))
    if(actos202020.length >= 3){
      const dateSet = {}
      for(const l of allLogs){
        if(actos202020.find(a=>a.id===l.activity_id)){
          if(!dateSet[l.date]) dateSet[l.date] = new Set()
          dateSet[l.date].add(l.activity_id)
        }
      }
      const days = Object.keys(dateSet).filter(d=>dateSet[d].size>=3).sort()
      for(let i=0;i<days.length-29;i++){
        let ok=true
        for(let j=0;j<30;j++){
          if(days[i+j] !== _offsetDate(days[i],j)){ ok=false; break }
        }
        if(ok){ muroHierro=true; break }
      }
    }
  }

  // Equilibrado — 1 hábito de cada categoría el mismo día
  let equilibrado = false
  {
    const cats = [...new Set(active.map(a=>a.category))]
    if(cats.length >= 2){
      const dateCatSet = {}
      for(const l of allLogs){
        const act = active.find(a=>a.id===l.activity_id)
        if(act){
          if(!dateCatSet[l.date]) dateCatSet[l.date] = new Set()
          dateCatSet[l.date].add(act.category)
        }
      }
      for(const set of Object.values(dateCatSet)){
        if(cats.every(c=>set.has(c))){ equilibrado=true; break }
      }
    }
  }

  // Polímata — hábitos activos en 4+ categorías
  const cats = new Set(active.map(a=>a.category))
  const polimata = cats.size >= 4

  // Centenario / Tsunami
  const centenario = totalLogs >= 100
  const tsunami = totalLogs >= 500

  const defs = [
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='dia_perfecto'),    earned:diaPerfecto,    progress: diaPerfecto?'':'' },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='semana_perfecta'), earned:semanaPerfecta, progress: '' },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='en_racha'),        earned:enRacha>=3,     progress: enRacha<3?`${enRacha}/3 hábitos`:'' },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='sin_pausa'),       earned:sinPausa,       progress: '' },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='muro'),            earned:muro,           progress: '' },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='muro_hierro'),     earned:muroHierro,     progress: '' },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='equilibrado'),     earned:equilibrado,    progress: '' },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='polimata'),        earned:polimata,       progress: polimata?'':`${cats.size}/4 categorías` },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='centenario'),      earned:centenario,     progress: centenario?'':`${totalLogs}/100 logs` },
    { ...LOGRO_DEFS_GLOBAL.find(d=>d.id==='tsunami'),         earned:tsunami,        progress: tsunami?'':`${totalLogs}/500 logs` },
  ]
  return defs
}

function _logroBadgeHTML(ach){
  const cls = ach.earned ? 'earned' : 'locked'
  return `<div class="logro-badge ${cls}">
    <div class="logro-icon">${ach.icon}</div>
    <div class="logro-info">
      <div class="logro-name">${ach.name}</div>
      <div class="logro-desc">${ach.desc}</div>
      ${ach.earned ? `<div class="logro-reward">${ach.reward}</div>` : ach.progress ? `<div class="logro-progress">${ach.progress}</div>` : ''}
    </div>
  </div>`
}

// ─────────────────────────────────────────────────────────────────────────────

// --- HOGAR ---
async function loadHogar(){
  const el = document.getElementById('hogar-list')
  if(!el) return
  el.innerHTML = '<div class="loading"><div class="spinner"></div><br>Cargando...</div>'

  const { data: today, error } = await SB_P.from('chores').select('*').eq('date', TODAY)
  if(error){
    el.innerHTML = `<div style="padding:1rem;font-size:13px;color:var(--text-muted)">Error: ${error.message}</div>`
    return
  }
  // State: { [choreId]: { ocurrencias: rec[], notes: rec[] } }
  choreToday = {}
  ;(today||[]).forEach(c => {
    if(!choreToday[c.name]) choreToday[c.name] = { ocurrencias: [], notes: [] }
    if(c.notes) choreToday[c.name].notes.push(c)
    else choreToday[c.name].ocurrencias.push(c)
  })

  const d7 = new Date(); d7.setDate(d7.getDate()-6)
  const weekStart = d7.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const { data: hist } = await SB_P.from('chores').select('*').gte('date', weekStart).lte('date', TODAY).order('date',{ascending:false})
  choreHistory = hist || []

  renderHogar()
}

function renderHogar(){
  const el = document.getElementById('hogar-list')
  if(!el) return

  const btnBase = 'padding:5px 10px;border-radius:6px;font-size:12px;font-family:\'Outfit\',sans-serif;cursor:pointer;border:1px solid'

  const todayCards = CHORES_DEF.map(ch => {
    const state       = choreToday[ch.id] || { ocurrencias: [], notes: [] }
    const ocurrencias = state.ocurrencias
    const hasOcc      = ocurrencias.length > 0
    const isOpen      = _choreInput === ch.id

    const styleGray = `${btnBase} var(--border);background:transparent;color:var(--text-muted)`
    const stylePlus = `background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text-muted);font-size:13px;padding:2px 8px;cursor:pointer;line-height:1;font-family:'Outfit',sans-serif`
    const styleNote = `${btnBase} var(--border);background:transparent;color:var(--text-muted)`

    const isPicking    = _chorePersonPicker === ch.id
    const plusOrPicker = isPicking
      ? `<button onclick="addChoreOccurrence('${ch.id}','${USER_ID}')" style="${styleGray}">${USER_NAME||'Yo'}</button><button onclick="addChoreOccurrence('${ch.id}','${PARTNER_ID}')" style="${styleGray}">${PARTNER_NAME||'Otro'}</button><button onclick="_chorePersonPicker=null;renderHogar()" style="${stylePlus}">×</button>`
      : `<button onclick="_chorePersonPicker='${ch.id}';renderHogar()" style="${stylePlus}">+</button>`

    const actionButtons = hasOcc
      ? `${plusOrPicker}<button onclick="abrirChoreNotes('${ch.id}')" style="${styleNote}">📝</button>`
      : `<button onclick="toggleChore('${ch.id}','${USER_ID}')" style="${styleGray}">${USER_NAME||'Yo'}</button><button onclick="toggleChore('${ch.id}','${PARTNER_ID}')" style="${styleGray}">${PARTNER_NAME||'Otro'}</button>${plusOrPicker}<button onclick="abrirChoreNotes('${ch.id}')" style="${styleNote}">📝</button>`

    const occRow = hasOcc
      ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${ocurrencias.map(rec => choreBadge(ch.id, rec)).join('')}</div>`
      : ''

    const inputArea = isOpen
      ? `<div style="margin-top:8px">
          <input type="text" id="chore-notes-${ch.id}" placeholder="Nota (ej: arroz con pollo)"
            style="width:100%;background:#0C0C0C;border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--text);font-size:12px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box"
            onkeydown="if(event.key==='Enter') guardarChoreNotes('${ch.id}')">
          <div style="display:flex;gap:6px;margin-top:5px">
            <button onclick="_choreInput=null;renderHogar()" style="flex:1;padding:5px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">Cancelar</button>
            <button onclick="guardarChoreNotes('${ch.id}')" style="flex:1;padding:5px;border-radius:6px;border:1px solid #5DCAA5;background:rgba(93,202,165,0.1);color:#5DCAA5;cursor:pointer;font-size:11px;font-family:'Outfit',sans-serif">Guardar</button>
          </div>
        </div>`
      : ''

    const notesList = state.notes.map(n => {
      const hora = n.created_at ? new Date(n.created_at).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : ''
      return `<div style="font-size:11px;color:var(--text-muted);padding:2px 0;display:flex;align-items:center;gap:4px">
        <span style="flex:1">📝 ${n.notes}${hora?' · '+hora:''}</span>
        <button onclick="eliminarChoreNote('${n.id}','${ch.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:2px 3px;line-height:1;flex-shrink:0">🗑️</button>
      </div>`
    }).join('')

    return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:18px;flex-shrink:0">${ch.icon}</span>
        <span style="flex:1;font-size:13px;font-weight:600;color:var(--text)">${ch.label}</span>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">${actionButtons}</div>
      </div>
      ${occRow}
      ${notesList ? `<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:6px">${notesList}</div>` : ''}
      ${inputArea}
    </div>`
  }).join('')

  // 7-day history
  const days = []
  for(let i=6; i>=0; i--){
    const d = new Date(); d.setDate(d.getDate()-i)
    days.push({ date: d.toISOString().split('T')[0], label: i===0 ? 'Hoy' : d.toLocaleDateString('es-CO',{weekday:'short'}).replace('.','') })
  }
  // Build history: { date: { choreId: { miguel:bool, diana:bool } } }
  const histByDate = {}
  choreHistory.forEach(c => {
    if(!c.done_by || c.notes) return
    if(!histByDate[c.date]) histByDate[c.date] = {}
    if(!histByDate[c.date][c.name]) histByDate[c.date][c.name] = { miguel:false, diana:false }
    if(c.done_by === USER_ID) histByDate[c.date][c.name].miguel = true
    if(c.done_by === PARTNER_ID)  histByDate[c.date][c.name].diana  = true
  })
  const thStyle = 'padding:5px 8px;font-size:11px;color:var(--text-muted);font-weight:500;text-align:center'
  const headers = `<th style="${thStyle};text-align:left"></th>` + days.map(d => `<th style="${thStyle}">${d.label}</th>`).join('')
  const rows = CHORES_DEF.map(ch => {
    const cells = days.map(d => {
      const s = histByDate[d.date]?.[ch.id]
      if(s?.miguel && s?.diana) return `<td style="text-align:center;padding:4px 6px;font-size:10px;color:var(--gold);font-weight:500">${USER_NAME||'Yo'}+M</td>`
      if(s?.miguel) return `<td style="text-align:center;padding:4px 6px;font-size:11px;color:#378ADD;font-weight:500">${USER_NAME||'Yo'}</td>`
      if(s?.diana)  return `<td style="text-align:center;padding:4px 6px;font-size:11px;color:#f472b6;font-weight:500">M</td>`
      return `<td style="text-align:center;padding:4px 6px;font-size:11px;color:var(--border)">·</td>`
    }).join('')
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:5px 10px;font-size:12px;color:var(--text-dim)">${ch.icon} ${ch.label}</td>
      ${cells}
    </tr>`
  }).join('')

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1.25rem">${todayCards}</div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:12px;font-weight:600;color:var(--text-dim)">Últimos 7 días</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`

  if(_choreInput){
    const inp = document.getElementById('chore-notes-'+_choreInput)
    if(inp){ inp.value = _choreInputText; inp.focus() }
  }
}

function choreBadge(choreId, rec) {
  if (!rec) return ''
  const isMiguel = rec.done_by === USER_ID
  const color = isMiguel ? '#378ADD' : '#f472b6'
  const name  = isMiguel ? (USER_NAME||'Yo') : (PARTNER_NAME||'Otro')
  const iStyle = `background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.12);color:${color};font-size:11px;font-family:'Outfit',sans-serif;outline:none;padding:0 2px`
  const xStyle = `background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:13px;padding:0 2px;line-height:1;flex-shrink:0`
  return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:${color};background:rgba(255,255,255,0.04);border-radius:6px;padding:3px 6px">${name}&nbsp;✓<input type="time" value="${rec.done_at||''}" onchange="updateChoreField('${choreId}','${rec.id}','done_at',this.value)" style="${iStyle};width:68px;cursor:pointer"><input type="number" value="${rec.duration_minutes??''}" placeholder="min" min="1" max="480" onchange="updateChoreField('${choreId}','${rec.id}','duration_minutes',this.value===''?null:+this.value)" style="${iStyle};width:36px;text-align:center"><button onclick="removeChoreOccurrence('${rec.id}','${choreId}')" style="${xStyle}">×</button></span>`
}

async function updateChoreField(choreId, recId, field, value) {
  const rec = choreToday[choreId]?.ocurrencias?.find(r => r.id === recId)
  if (rec) rec[field] = value
  const { error } = await SB_P.from('chores').update({ [field]: value }).eq('id', recId)
  if (error) showToast('❌ ' + error.message)
}

async function toggleChore(choreId, person){
  if(!choreToday[choreId]) choreToday[choreId] = { ocurrencias: [], notes: [] }
  const id = 'ch_'+Date.now()
  const now = new Date()
  const done_at = now.toTimeString().slice(0,5)
  const newRec = { id, name:choreId, done_by:person, notes:null, date:TODAY, done_at, duration_minutes:null, created_at:now.toISOString() }
  choreToday[choreId].ocurrencias.push(newRec)
  renderHogar()
  const { error } = await SB_P.from('chores').insert({ id, name:choreId, done_by:person, notes:null, date:TODAY, done_at, duration_minutes:null, created_at:now.toISOString() })
  if(error){ choreToday[choreId].ocurrencias = choreToday[choreId].ocurrencias.filter(r => r.id !== id); renderHogar(); showToast('❌ '+error.message) }
}

async function addChoreOccurrence(choreId, person){
  if(!choreToday[choreId]) choreToday[choreId] = { ocurrencias: [], notes: [] }
  _chorePersonPicker = null
  const id = 'ch_'+Date.now()
  const now = new Date()
  const done_at = now.toTimeString().slice(0,5)
  const newRec = { id, name:choreId, done_by:person, notes:null, date:TODAY, done_at, duration_minutes:null, created_at:now.toISOString() }
  choreToday[choreId].ocurrencias.push(newRec)
  renderHogar()
  const { error } = await SB_P.from('chores').insert({ id, name:choreId, done_by:person, notes:null, date:TODAY, done_at, duration_minutes:null, created_at:now.toISOString() })
  if(error){ choreToday[choreId].ocurrencias = choreToday[choreId].ocurrencias.filter(r => r.id !== id); renderHogar(); showToast('❌ '+error.message) }
}

async function removeChoreOccurrence(recId, choreId){
  if(!choreToday[choreId]) return
  const prev = choreToday[choreId].ocurrencias
  choreToday[choreId].ocurrencias = prev.filter(r => r.id !== recId)
  renderHogar()
  const { error } = await SB_P.from('chores').delete().eq('id', recId)
  if(error){ choreToday[choreId].ocurrencias = prev; renderHogar(); showToast('❌ '+error.message) }
}

function abrirChoreNotes(choreId){
  _choreInput = _choreInput === choreId ? null : choreId
  _choreInputText = ''
  renderHogar()
}

async function guardarChoreNotes(choreId){
  const inp = document.getElementById('chore-notes-'+choreId)
  const notes = inp?.value.trim() || ''
  if(!notes) return
  const id = 'chn_'+Date.now()
  const { error } = await SB_P.from('chores').insert({ id, name:choreId, done_by:null, notes, date:TODAY, created_at:new Date().toISOString() })
  if(error){ showToast('❌ '+error.message); return }
  if(!choreToday[choreId]) choreToday[choreId] = { ocurrencias: [], notes: [] }
  choreToday[choreId].notes.push({ id, name:choreId, done_by:null, notes, date:TODAY, created_at:new Date().toISOString() })
  _choreInput = null
  _choreInputText = ''
  renderHogar()
}

async function eliminarChoreNote(noteId, choreId){
  const { error } = await SB_P.from('chores').delete().eq('id', noteId)
  if(error){ showToast('❌ '+error.message); return }
  if(choreToday[choreId]) choreToday[choreId].notes = choreToday[choreId].notes.filter(n => n.id !== noteId)
  renderHogar()
}

function renderHabitos(){
  const el = document.getElementById('habitos-list')
  const catFilters = document.getElementById('habitos-cat-filters')
  const progressWrap = document.getElementById('habitos-progress-wrap')

  const SECUNDARIOS_CATS = ['secundarios_manana', 'secundarios_tarde']
  const isTodosDaily   = currentFreqFilter === 'todos_diarios'
  const isDiarios      = currentFreqFilter === 'diaria'
  const isSecundarios  = currentFreqFilter === 'secundarios'
  const isViciosTab    = currentFreqFilter === 'vicios_tab'
  const isDailyGroup   = isTodosDaily || isDiarios || isSecundarios || isViciosTab

  // Show/hide sub-filters y nav — solo en tabs con contexto diario
  catFilters.style.display = (isTodosDaily || isDiarios) ? 'flex' : 'none'
  progressWrap.style.display = isDailyGroup ? 'block' : 'none'
  const navEl = document.getElementById('habitos-nav')
  if(navEl) navEl.style.display = isDailyGroup ? 'flex' : 'none'
  if(isDailyGroup) renderHabitosNav()

  const addWrap = document.getElementById('habitos-add-btn-wrap')
  if(addWrap) addWrap.innerHTML = ''

  let toShow

  if(isTodosDaily){
    // Todos los diarios: freq=diaria (incluyendo vicios y secundarios, excluyendo trabajo_profundo)
    toShow = allActivities.filter(a => {
      if(!showInactive && !a.is_active) return false
      if(a.id === 'a70') return false // compuesto auto, se muestra en rachas
      return (a.frequency || 'diaria') === 'diaria'
    })
    if(currentCatFilter !== 'all') toShow = toShow.filter(a => a.category === currentCatFilter)
  } else if(isDiarios){
    // Diarios puros: excluyendo vicios y secundarios
    toShow = allActivities.filter(a => {
      if(!showInactive && !a.is_active) return false
      if(a.id === 'a70') return false // compuesto auto, se muestra en rachas
      if(a.category === 'vicios') return false
      if(SECUNDARIOS_CATS.includes(a.category)) return false
      if(a.category === 'trabajo_profundo') return false
      return (a.frequency || 'diaria') === 'diaria'
    })
    if(currentCatFilter !== 'all') toShow = toShow.filter(a => a.category === currentCatFilter)
  } else if(isSecundarios){
    toShow = allActivities.filter(a =>
      SECUNDARIOS_CATS.includes(a.category) && (showInactive || a.is_active)
    )
  } else if(isViciosTab){
    toShow = allActivities.filter(a => a.category === 'vicios' && (showInactive || a.is_active))
  } else {
    toShow = allActivities.filter(a => {
      const freq = a.frequency || 'diaria'
      if(freq !== currentFreqFilter) return false
      if(!showInactive && !a.is_active) return false
      return true
    })
  }

  // Progress bar (daily group only)
  if(isDailyGroup){
    const active = toShow.filter(a => a.is_active && a.id !== 'a70')
    const done = active.filter(a => habitLogs[a.id])
    const crisisAct = getCrisisHoy() ? allActivities.find(a => a.id === getCrisisHoy()) : null
    document.getElementById('habitos-progress-text').textContent = crisisAct
      ? `🚨 ${crisisAct.name}`
      : `${done.length} / ${active.length}`
    const pct = active.length ? (done.length/active.length*100) : 0
    document.getElementById('habitos-progress-bar').style.width = crisisAct ? '100%' : pct+'%'
    document.getElementById('habitos-progress-bar').style.background = crisisAct ? 'var(--red)' : ''
  }

  if(!toShow.length){
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◑</div>${
      currentFreqFilter==='unica' ? 'No hay actividades únicas. Agrega tareas pendientes con "+ Nueva"' :
      'No hay actividades en esta frecuencia'
    }</div>`
    return
  }

  if(currentFreqFilter === 'crisis'){
    const crisisActs = allActivities.filter(a => a.category === 'eventos_crisis')
    const activaCrisis = getCrisisHoy()
    el.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;padding:10px 12px;background:rgba(226,75,74,0.06);border:1px solid rgba(226,75,74,0.15);border-radius:8px">
        Activar un modo de crisis hace que los hábitos del día no cuenten para rachas. El 20/20/20 sigue siendo obligatorio siempre.
      </div>
      ${crisisActs.map(a => {
        const isActive = activaCrisis === a.id
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-card);border:1px solid ${isActive ? 'rgba(226,75,74,0.5)' : 'var(--border)'};border-radius:8px;margin-bottom:8px">
          <div style="flex:1;font-size:13px;color:${isActive ? 'var(--red)' : 'var(--text)'};font-weight:${isActive ? '600' : '400'}">${a.name}</div>
          ${isActive
            ? `<button onclick="toggleCrisis('${a.id}')" style="font-size:11px;padding:5px 12px;background:rgba(226,75,74,0.12);border:1px solid rgba(226,75,74,0.3);border-radius:6px;color:var(--red);cursor:pointer;font-family:'Outfit',sans-serif">✕ Desactivar</button>`
            : `<button onclick="toggleCrisis('${a.id}')" style="font-size:11px;padding:5px 12px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif">Activar</button>`
          }
        </div>`
      }).join('')}
      ${activaCrisis ? `<div style="margin-top:8px;font-size:11px;color:var(--red);text-align:center">🚨 Modo crisis activo hoy — los hábitos no cuentan para rachas (excepto 20/20/20)</div>` : ''}
    `
    return
  }

  if(currentFreqFilter === 'recurrente'){
    el.innerHTML = toShow.length
      ? toShow.map(a => habitoRecurrenteHTML(a)).join('')
      : '<div class="empty-state"><div class="empty-icon">🔗</div>No hay hábitos recurrentes. Agrega con "+ Nueva" y elige frecuencia Recurrente.</div>'
    return
  }

  if(currentFreqFilter === 'semanal'){
    el.innerHTML = toShow.map(a => habitoPeriodicoHTML(a, 'semanal')).join('')
    return
  }

  if(currentFreqFilter === 'mensual'){
    el.innerHTML = toShow.map(a => habitoPeriodicoHTML(a, 'mensual')).join('')
    return
  }

  // Daily - grouped by category
  if(currentCatFilter === 'all'){
    const grouped = {}
    toShow.forEach(a => {
      if(!grouped[a.category]) grouped[a.category] = []
      grouped[a.category].push(a)
    })
    const orderedCats = CAT_ORDER.filter(c => grouped[c])
    const rest = Object.keys(grouped).filter(c => !CAT_ORDER.includes(c))
    el.innerHTML = [...orderedCats, ...rest].map(cat => {
      const color = CAT_COLORS[cat] || '#555'
      const label = CAT_LABELS[cat] || cat
      const gap = cat === 'vicios' ? '10px' : '5px'
      return `<div class="habito-group">
        <div class="habito-group-title" style="color:${color}">${label}<div class="habito-group-line"></div></div>
        <div style="display:flex;flex-direction:column;gap:${gap}">${grouped[cat].slice().sort((a,b) => (a.hora_sugerida||'99:99').localeCompare(b.hora_sugerida||'99:99')).map(a => habitoHTML(a)).join('')}</div>
      </div>`
    }).join('')
    return
  }

  el.innerHTML = toShow.map(a => habitoHTML(a)).join('')
}

function habitoHTML(a){
  if(a.category === 'vicios') return renderVicioWidget(a)

  const isActive = a.is_active
  const is2020 = a.id === 'a70'
  // Crisis mode: hábitos en gris excepto 20/20/20
  const enCrisis = isCrisisModeActive() && !is2020
  const color = enCrisis ? 'var(--text-muted)' : (CAT_COLORS[a.category] || '#555')

  if(a.multi){
    const val = habitLogs[a.id]?.value || 0
    const isDone = val >= 1
    const checkStyle = isDone ? `background:${color};border-color:${color};color:#000` : `border-color:${color}44`
    const btnBase = `font-size:15px;width:26px;height:26px;border-radius:6px;border:1px solid ${color}44;background:transparent;color:${color};cursor:pointer;font-family:'Outfit',sans-serif;line-height:1;flex-shrink:0`
    return `<div class="habito-item${isDone?' done':''}${!isActive?' inactive':''}" style="border-left-color:${isActive?color:'var(--border)'}">
      <div class="habito-check" style="${checkStyle};cursor:default">${val>0?val:''}</div>
      <div style="flex:1">
        <div class="habito-name">${a.name}${val>0?` <span style="font-size:11px;color:${color}">(${val}x)</span>`:''}</div>
      </div>
      <span style="font-size:10px;color:${color};opacity:.6;flex-shrink:0;margin-right:4px">${CAT_LABELS[a.category]||''}</span>
      <button onclick="decrementHabito('${a.id}')" style="${btnBase}" ${val===0?'disabled':''}">−</button>
      <button onclick="incrementHabito('${a.id}')" style="${btnBase}" ${val>=3?'disabled':''}">+</button>
      <button class="habito-toggle" onclick="toggleActive('${a.id}',${isActive})">${isActive?'✕':'+'}</button>
    </div>`
  }

  const isDone = !!habitLogs[a.id]
  const checkStyle = isDone ? `background:${color};border-color:${color};color:#000` : `border-color:${color}44`
  const onclick = is2020 ? '' : `onclick="toggleHabito('${a.id}')"`
  const horaTag = a.hora_sugerida ? `<span style="font-size:10px;color:var(--text-muted);flex-shrink:0;margin-right:6px;opacity:.7">${a.hora_sugerida.slice(0,5)}</span>` : ''
  return `<div class="habito-item${isDone?' done':''}${!isActive?' inactive':''}" style="border-left-color:${isActive?color:'var(--border)'}">
    <div class="habito-check" ${onclick} style="${checkStyle}${is2020?';cursor:default':''}">
      ${isDone?'✓':''}
    </div>
    <div style="flex:1">
      <div class="habito-name">${a.name}${is2020?' <span style="font-size:10px;color:var(--text-muted)">(auto)</span>':''}</div>
    </div>
    ${horaTag}
    <span style="font-size:10px;color:${color};opacity:.6;flex-shrink:0;margin-right:8px">${CAT_LABELS[a.category]||''}</span>
    <button class="habito-toggle" onclick="toggleActive('${a.id}',${isActive})">${isActive?'✕':'+'}</button>
  </div>`
}

function tareasDeHabito(name){
  const q = name.toLowerCase()
  const matching = allTasks.filter(t => t.title.toLowerCase().includes(q))
  const pending = matching.filter(t => t.status !== 'completada')
  const done    = matching.filter(t => t.status === 'completada').slice(0, 2)
  return [...pending, ...done].slice(0, 5)
}

function tareasHabitoMiniHTML(tasks){
  if(!tasks.length) return ''
  return `<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">
    ${tasks.map(t => {
      const cat  = CATS[t.category] || CATS.habitos
      const done = t.status === 'completada'
      return `<div style="display:flex;align-items:center;gap:5px;font-size:11px">
        <span style="color:${cat.color};font-size:7px;flex-shrink:0">●</span>
        <span style="color:${done?'var(--text-muted)':'var(--text)'};${done?'text-decoration:line-through;opacity:0.6':''};flex:1">${t.title}</span>
        ${t.due_date ? `<span style="color:var(--text-muted);font-size:10px;flex-shrink:0">📅 ${t.due_date}</span>` : ''}
        ${done ? `<span style="color:var(--text-muted);font-size:10px;flex-shrink:0">✓</span>` : ''}
      </div>`
    }).join('')}
  </div>`
}

function toggleCrisis(activityId){
  const actual = getCrisisHoy()
  setCrisisHoy(actual === activityId ? null : activityId)
  renderHabitos()
}

function habitoUnicoHTML(a){
  const isDone = !!habitLogs[a.id] || !a.is_active
  const color = CAT_COLORS[a.category] || '#555'
  if(isDone){
    return `<div class="unica-item done-arch">
      <div style="flex:1">
        <div style="font-size:13px;color:var(--text-muted);text-decoration:line-through">${a.name}</div>
        <div style="font-size:11px;color:${color};margin-top:2px">${CAT_LABELS[a.category]||a.category}</div>
      </div>
      <span class="freq-done-badge">Archivado</span>
    </div>`
  }
  const relTasks = tareasDeHabito(a.name)
  return `<div class="unica-item">
    <div style="flex:1">
      <div style="font-size:13px;color:var(--text)">${a.name}</div>
      <div style="font-size:11px;color:${color};margin-top:2px">${CAT_LABELS[a.category]||a.category}</div>
      ${tareasHabitoMiniHTML(relTasks)}
    </div>
    <button class="btn-add" onclick="convertirEnTarea('${a.id}')" style="font-size:11px;padding:5px 10px;color:#9b72f0;border-color:rgba(155,114,240,0.3)">→ Crear tarea</button>
    <button class="btn-edit-act" onclick="openActivityModal('${a.id}')">✏️</button>
  </div>`
}

function habitoPeriodicoHTML(a, freq){
  const color    = CAT_COLORS[a.category] || '#555'
  const relTasks = tareasDeHabito(a.name)
  return `<div class="habito-item" style="border-left-color:${a.is_active?color:'var(--border)'}">
    <div style="flex:1">
      <div class="habito-name">${a.name}</div>
      <div style="font-size:11px;color:${color};margin-top:2px">${CAT_LABELS[a.category]||a.category}</div>
      ${tareasHabitoMiniHTML(relTasks)}
    </div>
    <button class="btn-add" onclick="convertirEnTarea('${a.id}')" style="font-size:11px;padding:5px 10px;color:#9b72f0;border-color:rgba(155,114,240,0.3)">→ Crear tarea</button>
    <button class="habito-toggle" onclick="openActivityModal('${a.id}')">✏️</button>
  </div>`
}

async function toggleHabitoPeriodico(activityId, freq){
  const logs = freq==='semanal' ? weeklyLogs[activityId] : monthlyLogs[activityId]
  if(logs && logs.length > 0){
    await SB_P.from('activity_logs').delete().eq('id', logs[logs.length-1].id)
    if(freq==='semanal') weeklyLogs[activityId] = logs.slice(0,-1)
    else monthlyLogs[activityId] = logs.slice(0,-1)
  } else {
    const log = { id:'log_'+Date.now(), user_id: USER_ID, activity_id: activityId, value: 1, date: TODAY }
    await SB_P.from('activity_logs').insert(log)
    if(freq==='semanal'){ if(!weeklyLogs[activityId]) weeklyLogs[activityId]=[]; weeklyLogs[activityId].push(log) }
    else { if(!monthlyLogs[activityId]) monthlyLogs[activityId]=[]; monthlyLogs[activityId].push(log) }
  }
  renderHabitos()
}

async function archiveActivity(activityId){
  await SB_P.from('activities').update({ is_active: false }).eq('id', activityId)
  const act = allActivities.find(a => a.id===activityId)
  if(act){ act.is_active = false }
  showToast('✓ Actividad archivada')
  renderHabitos()
}

function renderHabitosNav(){
  const label = document.getElementById('habitos-nav-label')
  const nextBtn = document.getElementById('habitos-nav-next')
  if(!label || !nextBtn) return

  const sel = new Date(selectedDate + 'T12:00:00')
  const tod = new Date(TODAY + 'T12:00:00')
  const diffDays = Math.round((tod - sel) / 86400000)

  let text
  if(diffDays === 0){
    text = 'Hoy, ' + sel.toLocaleDateString('es-CO', { day:'numeric', month:'short' })
  } else if(diffDays === 1){
    text = 'Ayer, ' + sel.toLocaleDateString('es-CO', { day:'numeric', month:'short' })
  } else {
    const dow = sel.toLocaleDateString('es-CO', { weekday:'short' })
    text = dow.charAt(0).toUpperCase() + dow.slice(1) + ', ' + sel.toLocaleDateString('es-CO', { day:'numeric', month:'short' })
  }
  label.value = selectedDate
  const subEl = document.getElementById('habitos-sub')
  if(subEl) subEl.textContent = text
  nextBtn.disabled = selectedDate >= TODAY
  nextBtn.style.opacity = selectedDate >= TODAY ? '0.3' : '1'
  nextBtn.style.cursor = selectedDate >= TODAY ? 'default' : 'pointer'

  const progressLabel = document.querySelector('#habitos-progress-wrap span:first-child')
  if(progressLabel) progressLabel.textContent = diffDays === 0 ? 'Progreso de hoy' : 'Progreso del día'
}

async function irAFechaHabitos(dateStr){
  if(!dateStr) return
  selectedDate = dateStr
  await loadHabitos()
}

async function navegarDia(delta){
  const d = new Date(selectedDate + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  const nuevo = d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  if(nuevo > TODAY) return
  selectedDate = nuevo
  await loadHabitos()
}

function filterFreq(freq, btn){
  currentFreqFilter = freq
  document.querySelectorAll('.freq-tab').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  renderHabitos()
}

// CRUD de actividades
function openActivityModal(id){
  const existing = id ? allActivities.find(a => a.id===id) : null
  document.getElementById('activity-modal-title').textContent = existing ? 'Editar actividad' : 'Nueva actividad'
  document.getElementById('act-id').value = existing ? existing.id : ''
  document.getElementById('act-name').value = existing ? existing.name : ''
  document.getElementById('act-freq').value = existing ? (existing.frequency||'diaria') : currentFreqFilter
  document.getElementById('act-cat').value = existing ? existing.category : 'vida_practica'
  document.getElementById('act-type').value = existing ? (existing.type||'binary') : 'binary'
  document.getElementById('act-unit').value = existing ? (existing.unit||'') : ''
  document.getElementById('act-hora').value = existing ? (existing.hora_sugerida||'') : ''
  document.getElementById('act-sort').value = existing ? (existing.sort_order||'') : ''
  document.getElementById('act-delete-btn').style.display = existing ? 'block' : 'none'
  updateActFreqHint()
  openModal('activity')
}

function updateActFreqHint(){
  const freq = document.getElementById('act-freq').value
  const hint = document.getElementById('act-freq-hint')
  const hints = {
    diaria: '✓ Aparece en la lista de hábitos diarios y genera racha',
    semanal: '✓ Se marca una vez por semana — ideal para rutinas semanales',
    mensual: '✓ Se marca una vez al mes — ideal para revisiones y limpiezas',
    unica: '✓ Tarea única — cuando la termines se archiva automáticamente'
  }
  hint.textContent = hints[freq] || ''
  hint.style.display = 'block'
}

async function saveActivity(){
  const id = document.getElementById('act-id').value
  const name = document.getElementById('act-name').value.trim()
  if(!name) return
  const data = {
    name,
    frequency: document.getElementById('act-freq').value,
    category: document.getElementById('act-cat').value,
    type: document.getElementById('act-type').value,
    unit: document.getElementById('act-unit').value || 'sesion',
    is_active: true,
    sort_order: parseInt(document.getElementById('act-sort').value) || 99,
    hora_sugerida: document.getElementById('act-hora').value || null
  }
  if(id){
    await SB_P.from('activities').update(data).eq('id', id)
    const act = allActivities.find(a => a.id===id)
    if(act) Object.assign(act, data)
    showToast('✓ Actividad actualizada')
  } else {
    const newId = 'a_'+Date.now()
    await SB_P.from('activities').insert({ id: newId, ...data })
    allActivities.push({ id: newId, ...data })
    showToast('✓ Actividad creada')
  }
  closeModal('activity')
  renderHabitos()
}

async function deleteActivity(){
  const id = document.getElementById('act-id').value
  if(!id) return
  if(!confirm('¿Eliminar esta actividad permanentemente?')) return
  await SB_P.from('activities').delete().eq('id', id)
  allActivities = allActivities.filter(a => a.id !== id)
  closeModal('activity')
  showToast('🗑️ Actividad eliminada')
  renderHabitos()
}

async function incrementHabito(activityId){
  const log = habitLogs[activityId]
  const curVal = log?.value || 0
  if(curVal >= 3) return
  const newVal = curVal + 1
  if(log){
    await SB_P.from('activity_logs').update({ value: newVal }).eq('id', log.id)
    habitLogs[activityId] = { ...log, value: newVal }
  } else {
    const newLog = { id:'log_'+Date.now(), user_id: USER_ID, activity_id: activityId, value: newVal, date: selectedDate }
    await SB_P.from('activity_logs').insert(newLog)
    habitLogs[activityId] = newLog
  }
  renderHabitos()
}

async function decrementHabito(activityId){
  const log = habitLogs[activityId]
  if(!log) return
  const newVal = (log.value || 0) - 1
  if(newVal <= 0){
    await SB_P.from('activity_logs').delete().eq('id', log.id)
    delete habitLogs[activityId]
  } else {
    await SB_P.from('activity_logs').update({ value: newVal }).eq('id', log.id)
    habitLogs[activityId] = { ...log, value: newVal }
  }
  renderHabitos()
}

async function _marcarTrabajo(activityId){
  await toggleHabito(activityId)
  const T1H = 'a_t1h'
  const trabajoActs = allActivities.filter(a => a.category === 'trabajo_profundo' && a.is_active)
  const alguno = trabajoActs.some(a => !!habitLogs[a.id])
  if(alguno && !habitLogs[T1H]){
    const log = { id:'log_'+Date.now()+'_t1h', user_id: USER_ID, activity_id: T1H, value: 1, date: selectedDate }
    await SB_P.from('activity_logs').insert(log)
    habitLogs[T1H] = log
    showToast('💼 ¡Trabajar 1 hora completado automáticamente!')
  } else if(!alguno && habitLogs[T1H]){
    await SB_P.from('activity_logs').delete().eq('id', habitLogs[T1H].id)
    delete habitLogs[T1H]
  }
  renderTrabajoDash()
  renderHabitos()
}

async function toggleHabito(activityId){
  if(habitLogs[activityId]){
    await SB_P.from('activity_logs').delete().eq('id', habitLogs[activityId].id)
    delete habitLogs[activityId]
  } else {
    const { data: existing } = await SB_P.from('activity_logs')
      .select('id')
      .eq('activity_id', activityId)
      .eq('date', selectedDate)
      .eq('user_id', USER_ID)
      .single()
    const log = existing || { id:'log_'+Date.now(), user_id: USER_ID, activity_id: activityId, value: 1, date: selectedDate }
    if(!existing) await SB_P.from('activity_logs').insert(log)
    habitLogs[activityId] = log
    if(activityId === 'a68'){
      const listos = allScripts.filter(s => s.status === 'listo_grabar')
      if(listos.length) showGrabarDialog(listos)
    }
  }

  const trio = ['a35','a14','a02']
  const trioCompleto = trio.every(id => !!habitLogs[id])

  if(trioCompleto && !habitLogs['a70']){
    const log70 = { id:'log_'+Date.now()+'_70', user_id: USER_ID, activity_id: 'a70', value: 1, date: selectedDate }
    await SB_P.from('activity_logs').insert(log70)
    habitLogs['a70'] = log70
    showToast('🔥 ¡20/20/20 completado! Cuerpo y mente listos. A trabajar.')
    alertarTareasIncompletas()
  } else if(!trioCompleto && habitLogs['a70']){
    await SB_P.from('activity_logs').delete().eq('id', habitLogs['a70'].id)
    delete habitLogs['a70']
  }

  renderHabitos()
  update2020Widget()
}

async function toggleActive(activityId, currentState){
  await SB_P.from('activities').update({ is_active: !currentState }).eq('id', activityId)
  const act = allActivities.find(a => a.id===activityId)
  if(act) act.is_active = !currentState
  renderHabitos()
}

function filterHabitos(cat, btn){
  currentCatFilter = cat
  document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  renderHabitos()
}

function toggleShowAll(){
  showInactive = !showInactive
  document.getElementById('btn-show-all').textContent = showInactive ? 'Ocultar inactivos' : 'Ver inactivos'
  renderHabitos()
}

// --- SB_I AUTH HELPER ---
async function ensureSBI(){
  const { data } = await SB_I.auth.getSession()
  if(data.session) return true
  const { data: pd } = await SB_P.auth.getSession()
  const email = pd?.session?.user?.email
  const pass  = USER_PASSWORD || (sessionStorage.getItem('_up') ? atob(sessionStorage.getItem('_up')) : null)
  if(!email || !pass) return false
  const { error } = await SB_I.auth.signInWithPassword({ email, password: pass })
  return !error
}

// --- BOOKS ---
async function loadBooks(){
  const { data } = await SB_P.from('books').select('*').order('created_at',{ascending:false})
  allBooks = data || []
  renderBooks()
}

function renderBooks(){
  const el = document.getElementById('books-list')
  if(!el) return
  if(!allBooks.length){
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div>Sin libros todavía — agrega tu primera lectura</div>'
    return
  }
  const STATUS_MAP = {
    leyendo:  { label:'Leyendo',   color:'var(--gold)' },
    terminado:{ label:'Terminado', color:'#5DCAA5' },
    pendiente:{ label:'Pendiente', color:'var(--text-muted)' },
  }
  el.innerHTML = allBooks.map(b => {
    const st = STATUS_MAP[b.status] || STATUS_MAP.pendiente
    const isActive = b.id === activeBookId
    return `<div class="book-card${isActive?' active':''}" onclick="openBookDetail('${b.id}')">
      <div>
        <div style="font-size:14px;font-weight:600;color:var(--text)">${b.title}</div>
        ${b.author ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${b.author}</div>` : ''}
      </div>
      <span style="font-size:11px;padding:3px 8px;border-radius:12px;background:${st.color}22;color:${st.color};border:1px solid ${st.color}44;white-space:nowrap">${st.label}</span>
    </div>`
  }).join('')
}

async function openBookDetail(bookId){
  activeBookId = bookId === activeBookId ? null : bookId
  renderBooks()
  const panel = document.getElementById('book-detail-panel')
  if(!activeBookId){ panel.style.display='none'; return }
  const book = allBooks.find(b => b.id === bookId)
  document.getElementById('book-detail-title').textContent = book.title + (book.author ? ` — ${book.author}` : '')
  panel.style.display = 'block'
  switchBookTab(activeBookTab)
}

function closeBookDetail(){
  activeBookId = null
  activeBookTab = 'capitulos'
  expandedChapters = {}
  document.getElementById('book-detail-panel').style.display = 'none'
  renderBooks()
}

function switchBookTab(tab){
  activeBookTab = tab
  ;['capitulos','personajes','escenarios','notas'].forEach(t => {
    const btn = document.getElementById('btab-'+t)
    if(btn) btn.classList.toggle('active', t === tab)
  })
  renderBookTab()
}

async function renderBookTab(){
  const el = document.getElementById('book-tab-content')
  if(!el || !activeBookId) return
  const book = allBooks.find(b => b.id === activeBookId)
  if(!book) return

  if(activeBookTab === 'capitulos'){
    const { data } = await SB_P.from('book_chapters').select('*').eq('book_id', activeBookId).order('number', { ascending: true })
    const chaps = data || []
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        ${chaps.length ? chaps.map(c => {
          const open = !!expandedChapters[c.id]
          return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <div onclick="toggleChapter('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer">
              <span style="font-size:11px;font-weight:700;color:var(--text-muted);min-width:22px">C${c.number}</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--text)">${c.title||'Sin título'}</div>
                ${c.summary&&!open ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px">${c.summary}</div>` : ''}
              </div>
              <button onclick="event.stopPropagation();deleteChapter('${c.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:4px">✕</button>
              <span style="color:var(--text-muted);font-size:14px;transition:transform .2s;${open?'transform:rotate(180deg)':''}">⌄</span>
            </div>
            ${open ? `<div style="padding:0 12px 12px;border-top:1px solid var(--border)">
              ${c.summary ? `<div style="font-size:12px;color:var(--text-dim);margin:10px 0 8px;font-style:italic">${c.summary}</div>` : ''}
              <textarea id="chapnotes-${c.id}" class="script-editor-field" style="min-height:90px;margin-top:8px"
                onblur="autoSaveChapterNotes('${c.id}')"
                placeholder="Notas del capítulo...">${c.notes||''}</textarea>
            </div>` : ''}
          </div>`
        }).join('') : '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Sin capítulos todavía</div>'}
      </div>
      <div style="background:var(--bg);border:1px dashed var(--border);border-radius:8px;padding:14px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">+ Agregar capítulo</div>
        <div class="form-row">
          <div class="field" style="flex:0 0 80px"><input type="number" id="chap-num" placeholder="Nº" min="1"/></div>
          <div class="field"><input type="text" id="chap-title" placeholder="Título del capítulo"/></div>
        </div>
        <div class="field" style="margin-top:6px"><input type="text" id="chap-summary" placeholder="Resumen breve"/></div>
        <textarea id="chap-notes" class="script-editor-field" style="margin-top:6px;min-height:60px" placeholder="Notas del capítulo (opcional)"></textarea>
        <button class="btn-save" style="margin-top:10px" onclick="saveChapter('${activeBookId}')">+ Agregar</button>
      </div>`

  } else if(activeBookTab === 'personajes'){
    const { data } = await SB_P.from('book_characters').select('*').eq('book_id', activeBookId).order('name')
    const chars = data || []
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
        ${chars.length ? chars.map(c => {
          const roleColor = CHAR_ROLE_COLORS[c.role] || CHAR_ROLE_COLORS.otro
          const roleLabel = c.role ? c.role.charAt(0).toUpperCase() + c.role.slice(1) : ''
          return `<div style="background:var(--bg);border:1px solid var(--border);border-left:3px solid ${roleColor};border-radius:8px;padding:10px 12px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div style="flex:1">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <span style="font-size:13px;font-weight:600;color:var(--text)">${c.name}</span>
                  ${roleLabel ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${roleColor}22;color:${roleColor};border:1px solid ${roleColor}44">${roleLabel}</span>` : ''}
                </div>
                ${c.description ? `<div style="font-size:12px;color:var(--text-dim)">${c.description}</div>` : ''}
              </div>
              <button onclick="deleteChar('${c.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:2px 4px;margin-left:8px">✕</button>
            </div>
          </div>`
        }).join('') : '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Sin personajes todavía</div>'}
      </div>
      <div style="background:var(--bg);border:1px dashed var(--border);border-radius:8px;padding:14px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">+ Agregar personaje</div>
        <div class="form-row">
          <div class="field"><input type="text" id="char-name" placeholder="Nombre"/></div>
          <div class="field"><label style="display:none"></label>
            <select id="char-role" style="width:100%;background:#0C0C0C;border:1px solid var(--border);border-radius:8px;padding:11px 12px;color:var(--text);font-family:'Outfit',sans-serif;font-size:13px;outline:none">
              <option value="">Rol...</option>
              <option value="protagonista">Protagonista</option>
              <option value="antagonista">Antagonista</option>
              <option value="secundario">Secundario</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>
        <div class="field" style="margin-top:6px"><input type="text" id="char-desc" placeholder="Descripción del personaje"/></div>
        <button class="btn-save" style="margin-top:10px" onclick="saveChar('${activeBookId}')">+ Agregar</button>
      </div>`

  } else if(activeBookTab === 'escenarios'){
    const { data } = await SB_P.from('book_scenarios').select('*').eq('book_id', activeBookId).order('title')
    const scens = data || []
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        ${scens.length ? scens.map(s => {
          const open = !!expandedChapters['scen_'+s.id]
          return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <div onclick="toggleScenario('${s.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer">
              <div style="font-size:13px;font-weight:600;color:var(--text)">${s.title}</div>
              <div style="display:flex;align-items:center;gap:6px">
                <button onclick="event.stopPropagation();deleteScenario('${s.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:4px">✕</button>
                <span style="color:var(--text-muted);font-size:14px;transition:transform .2s;${open?'transform:rotate(180deg)':''}">⌄</span>
              </div>
            </div>
            ${open ? `<div style="padding:0 12px 12px;border-top:1px solid var(--border)">
              <textarea id="scendesc-${s.id}" class="script-editor-field" style="margin-top:10px;min-height:70px"
                onblur="autoSaveScenField('${s.id}','description')"
                placeholder="Descripción del escenario...">${s.description||''}</textarea>
              <textarea id="scennotes-${s.id}" class="script-editor-field" style="margin-top:6px;min-height:60px"
                onblur="autoSaveScenField('${s.id}','notes')"
                placeholder="Notas adicionales...">${s.notes||''}</textarea>
            </div>` : `${s.description ? `<div style="font-size:12px;color:var(--text-dim);padding:0 12px 10px">${s.description}</div>` : ''}`}
          </div>`
        }).join('') : '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Sin escenarios todavía</div>'}
      </div>
      <div style="background:var(--bg);border:1px dashed var(--border);border-radius:8px;padding:14px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">+ Agregar escenario</div>
        <div class="field"><input type="text" id="scen-title" placeholder="Título del escenario"/></div>
        <div class="field" style="margin-top:6px"><input type="text" id="scen-desc" placeholder="Descripción breve"/></div>
        <button class="btn-save" style="margin-top:10px" onclick="saveScenario('${activeBookId}')">+ Agregar</button>
      </div>`

  } else if(activeBookTab === 'notas'){
    await ensureSBI()
    const { data: bookNotes } = await SB_P.from('book_notes').select('*').eq('book_id', activeBookId).order('created_at', { ascending: false })
    const notes = bookNotes || []
    const showForm = !!expandedChapters['note_form']
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:12px;color:var(--text-muted)">${notes.length} nota${notes.length!==1?'s':''}</span>
        <button class="btn-add" onclick="toggleNoteForm()" style="font-size:12px;padding:6px 14px">+ Nueva nota</button>
      </div>
      ${showForm ? `
      <div style="background:var(--bg);border:1px solid rgba(155,114,240,0.4);border-radius:8px;padding:14px;margin-bottom:12px">
        <input type="text" id="new-note-title" placeholder="Título (opcional)"
          style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);padding:5px 0 6px;color:var(--text);font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;outline:none;margin-bottom:10px;box-sizing:border-box"/>
        <textarea id="new-note-content" class="script-editor-field" style="min-height:100px" placeholder="Contenido de la nota..."></textarea>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn-save" onclick="saveBookNote('${activeBookId}')">Guardar nota</button>
          <button onclick="toggleNoteForm()" style="padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px">Cancelar</button>
        </div>
      </div>` : ''}
      <div style="display:flex;flex-direction:column;gap:6px">
        ${notes.length ? notes.map(n => {
          const open = !!expandedChapters['note_'+n.id]
          const preview = n.content ? n.content.substring(0,90)+(n.content.length>90?'…':'') : ''
          const safeTitle = (n.title||'').replace(/"/g,'&quot;')
          return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;overflow:hidden">
            <div onclick="toggleBookNote('${n.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:${n.title?'var(--text)':'var(--text-muted)'}">${n.title||'Sin título'}</div>
                ${!open&&preview ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${preview}</div>` : ''}
              </div>
              <div style="display:flex;align-items:center;gap:4px;margin-left:8px;flex-shrink:0">
                <button onclick="event.stopPropagation();deleteBookNote('${n.id}')" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:4px 6px">✕</button>
                <span style="color:var(--text-muted);font-size:14px;display:inline-block;transition:transform .2s;${open?'transform:rotate(180deg)':''}">⌄</span>
              </div>
            </div>
            ${open ? `<div style="padding:0 12px 12px;border-top:1px solid var(--border)">
              <input type="text" id="note-title-${n.id}" value="${safeTitle}"
                onblur="autoSaveNoteTitle('${n.id}')"
                placeholder="Título (opcional)"
                style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);padding:6px 0 7px;color:var(--text);font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;outline:none;margin:10px 0 8px;box-sizing:border-box"/>
              <textarea id="note-content-${n.id}" class="script-editor-field" style="min-height:120px"
                onblur="autoSaveNoteContent('${n.id}')"
                placeholder="Contenido...">${n.content||''}</textarea>
            </div>` : ''}
          </div>`
        }).join('') : '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Sin notas todavía — crea la primera</div>'}
      </div>
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
        <button onclick="deleteBook('${book.id}')" style="padding:9px 14px;border-radius:8px;border:1px solid rgba(226,75,74,0.3);background:transparent;color:var(--red);cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px">Eliminar libro</button>
      </div>`
  }
}

function openNewBook(){
  document.getElementById('bk-title').value = ''
  document.getElementById('bk-author').value = ''
  document.getElementById('bk-status').value = 'leyendo'
  openModal('book')
}

async function saveBook(){
  const title = document.getElementById('bk-title').value.trim()
  if(!title) return
  await ensureSBI()
  const id = 'bk_'+Date.now()
  const { error } = await SB_P.from('books').insert({
    id, title,
    author: document.getElementById('bk-author').value.trim()||null,
    status: document.getElementById('bk-status').value
  })
  if(error){ showToast('❌ Error: ' + error.message); return }
  closeModal('book')
  await loadBooks()
  activeBookId = id
  renderBooks()
  const book = allBooks.find(b => b.id === id)
  if(book){
    document.getElementById('book-detail-title').textContent = book.title + (book.author ? ` — ${book.author}` : '')
    document.getElementById('book-detail-panel').style.display = 'block'
    switchBookTab('capitulos')
  }
}

function toggleNoteForm(){
  expandedChapters['note_form'] = !expandedChapters['note_form']
  renderBookTab()
}

function toggleBookNote(noteId){
  expandedChapters['note_'+noteId] = !expandedChapters['note_'+noteId]
  renderBookTab()
}

async function saveBookNote(bookId){
  const content = document.getElementById('new-note-content').value.trim()
  if(!content) return
  await ensureSBI()
  const id = 'bn_'+Date.now()
  const { error } = await SB_P.from('book_notes').insert({
    id, book_id: bookId,
    title: document.getElementById('new-note-title').value.trim() || null,
    content
  })
  if(error){ showToast('❌ Error: ' + error.message); return }
  expandedChapters['note_form'] = false
  expandedChapters['note_'+id] = true
  switchBookTab('notas')
}

async function deleteBookNote(noteId){
  await ensureSBI()
  await SB_P.from('book_notes').delete().eq('id', noteId)
  delete expandedChapters['note_'+noteId]
  switchBookTab('notas')
}

async function autoSaveNoteTitle(noteId){
  const el = document.getElementById('note-title-'+noteId)
  if(!el) return
  await ensureSBI()
  await SB_P.from('book_notes').update({ title: el.value.trim() || null }).eq('id', noteId)
}

async function autoSaveNoteContent(noteId){
  const el = document.getElementById('note-content-'+noteId)
  if(!el) return
  await ensureSBI()
  await SB_P.from('book_notes').update({ content: el.value }).eq('id', noteId)
}

async function deleteBook(bookId){
  if(!confirm('¿Eliminar este libro, sus capítulos, notas, personajes y escenarios?')) return
  await ensureSBI()
  await SB_P.from('book_chapters').delete().eq('book_id', bookId)
  await SB_P.from('book_notes').delete().eq('book_id', bookId)
  await SB_P.from('book_characters').delete().eq('book_id', bookId)
  await SB_P.from('book_scenarios').delete().eq('book_id', bookId)
  const { error } = await SB_P.from('books').delete().eq('id', bookId)
  if(error){ showToast('❌ Error: ' + error.message); return }
  closeBookDetail()
  await loadBooks()
  showToast('🗑️ Libro eliminado')
}

function toggleChapter(chapId){
  expandedChapters[chapId] = !expandedChapters[chapId]
  renderBookTab()
}

function toggleScenario(scenId){
  expandedChapters['scen_'+scenId] = !expandedChapters['scen_'+scenId]
  renderBookTab()
}

async function saveChapter(bookId){
  const num = parseInt(document.getElementById('chap-num').value)
  if(!num) return
  await ensureSBI()
  const { error } = await SB_P.from('book_chapters').insert({
    id: 'chp_'+Date.now(), book_id: bookId,
    number: num,
    title:   document.getElementById('chap-title').value.trim()||null,
    summary: document.getElementById('chap-summary').value.trim()||null,
    notes:   document.getElementById('chap-notes').value.trim()||null
  })
  if(error){ showToast('❌ Error: ' + error.message); return }
  switchBookTab('capitulos')
}

async function deleteChapter(chapId){
  await ensureSBI()
  await SB_P.from('book_chapters').delete().eq('id', chapId)
  delete expandedChapters[chapId]
  switchBookTab('capitulos')
}

async function autoSaveChapterNotes(chapId){
  const el = document.getElementById('chapnotes-'+chapId)
  if(!el) return
  await ensureSBI()
  await SB_P.from('book_chapters').update({ notes: el.value }).eq('id', chapId)
}

async function autoSaveScenField(scenId, field){
  const elId = field === 'description' ? 'scendesc-'+scenId : 'scennotes-'+scenId
  const el = document.getElementById(elId)
  if(!el) return
  await ensureSBI()
  await SB_P.from('book_scenarios').update({ [field]: el.value }).eq('id', scenId)
}

async function saveChar(bookId){
  const name = document.getElementById('char-name').value.trim()
  if(!name) return
  await ensureSBI()
  const { error } = await SB_P.from('book_characters').insert({
    id: 'chr_'+Date.now(), book_id: bookId, name,
    role: document.getElementById('char-role').value.trim()||null,
    description: document.getElementById('char-desc').value.trim()||null
  })
  if(error){ showToast('❌ Error: ' + error.message); return }
  switchBookTab('personajes')
}

async function deleteChar(charId){
  await ensureSBI()
  await SB_P.from('book_characters').delete().eq('id', charId)
  switchBookTab('personajes')
}

async function saveScenario(bookId){
  const title = document.getElementById('scen-title').value.trim()
  if(!title) return
  await ensureSBI()
  const { error } = await SB_P.from('book_scenarios').insert({
    id: 'scn_'+Date.now(), book_id: bookId, title,
    description: document.getElementById('scen-desc').value.trim()||null
  })
  if(error){ showToast('❌ Error: ' + error.message); return }
  switchBookTab('escenarios')
}

async function deleteScenario(scenId){
  await ensureSBI()
  await SB_P.from('book_scenarios').delete().eq('id', scenId)
  switchBookTab('escenarios')
}

// --- SCRIPTS ---
let _guionesDashCanal = 'iarcania'
let _timer = { running: false, canal: null, startTs: null, elapsed: 0, intervalId: null }
let _workNotes = {}

function filterGuionesDash(canal, btn){
  if(_timer.running && _timer.canal !== canal) pausarTimer()
  _guionesDashCanal = canal
  document.querySelectorAll('#gft-iarcania,#gft-voidstoic').forEach(b => {
    const isActive = b.id === 'gft-'+canal
    b.style.background = isActive ? (canal==='iarcania'?'rgba(226,75,74,0.12)':'rgba(139,108,246,0.12)') : 'transparent'
    b.style.borderColor = isActive ? (canal==='iarcania'?'#E24B4A':'var(--purple)') : 'var(--border)'
    b.style.color = isActive ? (canal==='iarcania'?'#E24B4A':'var(--purple)') : 'var(--text-muted)'
  })
  loadProyectoDia()
}

async function loadScripts(){
  const [scriptsRes, brandsRes] = await Promise.all([
    SB_P.from('scripts').select('*').order('created_at',{ascending:false}),
    SB_P.from('brands').select('*').order('nombre'),
  ])
  allScripts = scriptsRes.data || []
  allBrands  = brandsRes.data  || []
  allScripts.forEach(s => { if(s.pres_data) _scriptGen[s.id] = s.pres_data })
  renderScripts()
}

async function loadGuionDelDia(){ await loadProyectoDia() }

// ── Branding dinámico del editor de Guiones ───────────────────
const _sgLoadedFonts = new Set()
function _sgEnsureFont(family) {
  if (!family || _sgLoadedFonts.has(family)) return
  _sgLoadedFonts.add(family)
  const lk = document.createElement('link')
  lk.rel  = 'stylesheet'
  lk.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`
  document.head.appendChild(lk)
}
function _sgIsDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return true
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255
  return 0.299*r + 0.587*g + 0.114*b < 0.5
}
function _sgLighten(hex, amt) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#1a1a1a'
  return '#' + ['1','3','5'].map(i => Math.min(255, parseInt(hex.slice(+i,+i+2),16) + Math.round(255*amt)).toString(16).padStart(2,'0')).join('')
}
function _sgDarken(hex, amt) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#e0e0e0'
  return '#' + ['1','3','5'].map(i => Math.max(0, parseInt(hex.slice(+i,+i+2),16) - Math.round(255*amt)).toString(16).padStart(2,'0')).join('')
}
function _sgRgba(hex, a) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(120,120,120,${a})`
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`
}
function _sgBrandForScript(s) {
  if (s.brand_id) return allBrands.find(b => b.id === s.brand_id) || null
  const canal = (s.canal || '').toLowerCase().replace(/\s/g,'')
  return allBrands.find(b => (b.nombre||'').toLowerCase().replace(/\s/g,'') === canal) || null
}
function applyScriptBranding(scriptId) {
  const el = document.getElementById('sg-editor-' + scriptId)
  if (!el) return
  const s = allScripts.find(x => x.id === scriptId)
  const b = s ? _sgBrandForScript(s) : null
  const c = b?.colores || {}
  const fondo  = c.fondo    || '#0d0d0d'
  const prim   = c.primario || '#7C3AED'
  const texto  = c.texto    || '#e8e8e8'
  const acento = c.acento   || '#22D3EE'
  const dark   = _sgIsDark(fondo)
  const surface = dark ? _sgLighten(fondo, 0.07) : _sgDarken(fondo, 0.07)
  el.style.setProperty('--sg-fondo',    fondo)
  el.style.setProperty('--sg-primario', prim)
  el.style.setProperty('--sg-texto',    texto)
  el.style.setProperty('--sg-acento',   acento)
  el.style.setProperty('--sg-surface',  surface)
  el.style.setProperty('--sg-border',   _sgRgba(prim, 0.22))
  el.style.setProperty('--sg-muted',    _sgRgba(texto, 0.45))
  el.style.background  = fondo
  el.style.borderColor = _sgRgba(prim, 0.18)
  if (b?.tipografia) {
    _sgEnsureFont(b.tipografia)
    el.style.fontFamily = `'${b.tipografia}', sans-serif`
  }
  const logoEl = el.querySelector('.sg-brand-logo')
  if (logoEl) {
    if (b?.logo_url) { logoEl.src = b.logo_url; logoEl.style.display = '' }
    else logoEl.style.display = 'none'
  }
}

async function loadWorkNotes(canal){
  const { data } = await SB_P.from('work_notes')
    .select('*').eq('project', canal)
    .order('created_at',{ascending:false}).limit(3)
  _workNotes[canal] = data || []
}

async function guardarNotaTrabajo(){
  const ta = document.getElementById('nota-trabajo-input')
  if(!ta) return
  const content = ta.value.trim()
  if(!content) return
  const { error } = await SB_P.from('work_notes').insert({
    id: 'wn_'+Date.now(),
    project: _guionesDashCanal,
    content,
    date: TODAY,
    created_at: new Date().toISOString()
  })
  if(error){ showToast('❌ ' + error.message); return }
  ta.value = ''
  await loadWorkNotes(_guionesDashCanal)
  const el = document.getElementById('work-notes-list')
  if(el) el.innerHTML = renderWorkNotesHtml(_guionesDashCanal)
  showToast('✅ Nota guardada')
}

function renderWorkNotesHtml(canal){
  const notes = _workNotes[canal] || []
  if(!notes.length) return '<div style="font-size:11px;color:var(--text-muted);padding:3px 0">Sin notas todavía</div>'
  return notes.map(n => `<div style="padding:5px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:11px;color:var(--text-primary)">${n.content.replace(/</g,'&lt;')}</div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${new Date(n.created_at).toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit'})}</div>
  </div>`).join('')
}

function formatTimer(secs){
  const h = Math.floor(secs/3600)
  const m = Math.floor((secs%3600)/60)
  const s = secs%60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function getCurrentElapsed(){
  if(_timer.running && _timer.startTs)
    return _timer.elapsed + Math.floor((Date.now()-_timer.startTs)/1000)
  return _timer.elapsed
}

function saveTimerToStorage(){
  localStorage.setItem('timer_trabajo', JSON.stringify({
    running: _timer.running, canal: _timer.canal,
    startTs: _timer.startTs, elapsed: _timer.elapsed
  }))
}

function loadTimerFromStorage(){
  try{
    const raw = localStorage.getItem('timer_trabajo')
    if(!raw) return
    const s = JSON.parse(raw)
    _timer.canal   = s.canal   || 'iarcania'
    _timer.elapsed = s.elapsed || 0
    if(s.running && s.startTs){
      _timer.running = true
      _timer.startTs = s.startTs
      _timer.intervalId = setInterval(tickTimer, 1000)
    }
  }catch(e){}
}

function tickTimer(){
  const el = document.getElementById('timer-display')
  if(el) el.textContent = formatTimer(getCurrentElapsed())
}

function iniciarTimer(){
  if(_timer.running) return
  _timer.running = true
  _timer.canal   = _guionesDashCanal
  _timer.startTs = Date.now()
  saveTimerToStorage()
  if(_timer.intervalId) clearInterval(_timer.intervalId)
  _timer.intervalId = setInterval(tickTimer, 1000)
  updateTimerButtons()
}

function pausarTimer(){
  if(!_timer.running) return
  _timer.elapsed = getCurrentElapsed()
  _timer.running = false
  _timer.startTs = null
  if(_timer.intervalId){ clearInterval(_timer.intervalId); _timer.intervalId = null }
  saveTimerToStorage()
  updateTimerButtons()
}

async function detenerTimer(){
  const elapsed = getCurrentElapsed()
  if(elapsed === 0) return
  const mins = Math.round(elapsed/60)
  const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60)
  const actId = (_timer.canal || _guionesDashCanal) === 'iarcania' ? 'a72' : 'a68'
  if(mins > 0){
    await SB_P.from('activity_logs').insert({
      id: 'tlog_'+Date.now(),
      user_id: USER_ID,
      activity_id: actId,
      value: mins,
      notes: `timer: ${h}h ${m}m`,
      date: TODAY
    })
  }
  _timer.running = false; _timer.elapsed = 0; _timer.startTs = null; _timer.canal = null
  if(_timer.intervalId){ clearInterval(_timer.intervalId); _timer.intervalId = null }
  localStorage.removeItem('timer_trabajo')
  updateTimerButtons()
  showToast(`⏱️ Tiempo registrado: ${h}h ${m}m`)
}

function updateTimerButtons(){
  const timerIsThisCanal = !_timer.canal || _timer.canal === _guionesDashCanal
  const elapsed = timerIsThisCanal ? getCurrentElapsed() : 0
  const el = document.getElementById('timer-display')
  if(el) el.textContent = formatTimer(elapsed)
  const btnStart = document.getElementById('timer-btn-start')
  const btnPause = document.getElementById('timer-btn-pause')
  const btnStop  = document.getElementById('timer-btn-stop')
  if(!btnStart) return
  const isRunning = _timer.running && timerIsThisCanal
  btnStart.style.display = isRunning ? 'none' : 'inline-flex'
  btnPause.style.display = isRunning ? 'inline-flex' : 'none'
  btnStop.style.display  = elapsed > 0 && timerIsThisCanal ? 'inline-flex' : 'none'
}

async function loadProyectoDia(){
  const [scriptsRes] = await Promise.all([
    SB_P.from('scripts').select('*')
      .eq('canal', _guionesDashCanal)
      .in('status', ['borrador','en_progreso','listo_grabar'])
      .order('created_at',{ascending:false}).limit(2),
    loadWorkNotes(_guionesDashCanal)
  ])
  renderProyectoDia(scriptsRes.data || [])
}

function renderProyectoDia(scripts){
  const el = document.getElementById('dash-guion-content')
  if(!el) return

  const isIA    = _guionesDashCanal === 'iarcania'
  const color   = isIA ? '#E24B4A' : 'var(--purple)'
  const taskCat = isIA ? 'iarcania' : 'contenido'
  const PRIO    = { alta:0, media:1, baja:2 }
  const subHdr  = label => `<div style="font-size:10px;font-weight:600;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin:10px 0 5px;padding-bottom:3px;border-bottom:1px solid var(--border)">${label}</div>`

  // — Barra de progreso —
  const allCatTasks = allTasks.filter(t => t.category === taskCat)
  const done  = allCatTasks.filter(t => t.status === 'completada').length
  const total = allCatTasks.length
  const pct   = total ? Math.round(done/total*100) : 0
  const barC  = pct === 0 ? '#E24B4A' : pct < 100 ? '#EF9F27' : '#5DCAA5'
  const progressHtml = `<div style="margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:10px;color:var(--text-muted)">Progreso tareas</span>
      <span style="font-size:10px;color:${barC};font-weight:600">${done}/${total}</span>
    </div>
    <div style="height:4px;border-radius:2px;background:var(--border);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${barC};border-radius:2px;transition:width .3s"></div>
    </div>
  </div>`

  // — Timer —
  const timerIsThisCanal = !_timer.canal || _timer.canal === _guionesDashCanal
  const elapsed = timerIsThisCanal ? getCurrentElapsed() : 0
  const isRunning = _timer.running && timerIsThisCanal
  const timerHtml = `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:2px">
    <span id="timer-display" style="font-size:18px;font-weight:700;color:${color};font-variant-numeric:tabular-nums;min-width:76px">${formatTimer(elapsed)}</span>
    <div style="display:flex;gap:4px;margin-left:auto">
      <button id="timer-btn-start" onclick="iniciarTimer()" style="display:${isRunning?'none':'inline-flex'};align-items:center;gap:3px;padding:4px 10px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif">▶ Iniciar</button>
      <button id="timer-btn-pause" onclick="pausarTimer()" style="display:${isRunning?'inline-flex':'none'};align-items:center;gap:3px;padding:4px 10px;font-size:12px;border-radius:6px;border:1px solid rgba(239,159,39,0.4);background:transparent;color:#EF9F27;cursor:pointer;font-family:'Outfit',sans-serif">⏸ Pausar</button>
      <button id="timer-btn-stop" onclick="detenerTimer()" style="display:${elapsed>0&&timerIsThisCanal?'inline-flex':'none'};align-items:center;padding:4px 8px;font-size:12px;border-radius:6px;border:1px solid rgba(226,75,74,0.4);background:transparent;color:var(--red);cursor:pointer;font-family:'Outfit',sans-serif">⏹</button>
    </div>
  </div>`

  // — Tareas —
  const tareas = allTasks
    .filter(t => t.category === taskCat && t.status !== 'completada')
    .sort((a,b) => (PRIO[a.priority]??3) - (PRIO[b.priority]??3))
    .slice(0, 3)
  const tareasHtml = tareas.length
    ? tareas.map(t => `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="width:5px;height:5px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <span style="font-size:12px;color:var(--text-primary);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</span>
      </div>`).join('')
    : `<div style="font-size:11px;color:var(--text-muted);padding:3px 0">Sin tareas pendientes</div>`

  // — Guiones —
  const S_COLOR = { borrador:'var(--text-muted)', en_progreso:'#EF9F27', listo_grabar:'#5DCAA5' }
  const S_LABEL = { borrador:'Borrador', en_progreso:'En progreso', listo_grabar:'Listo para grabar' }
  const guionesHtml = scripts.length
    ? scripts.map(s => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.title}</div>
          <span style="font-size:10px;color:${S_COLOR[s.status]||'var(--text-muted)'}">${S_LABEL[s.status]||s.status}</span>
        </div>
        <button onclick="goToScript('${s.id}')" style="flex-shrink:0;padding:3px 8px;font-size:11px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif">✏️ Editar</button>
      </div>`).join('')
    : `<div style="font-size:11px;color:var(--text-muted);padding:3px 0">Sin guiones pendientes</div>`

  // — Nota del día —
  const notaHtml = `<div>
    <textarea id="nota-trabajo-input" placeholder="¿Qué lograste hoy?" style="width:100%;box-sizing:border-box;padding:8px;font-size:12px;font-family:'Outfit',sans-serif;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);resize:none;height:56px;outline:none;margin-bottom:6px"></textarea>
    <button onclick="guardarNotaTrabajo()" style="width:100%;padding:6px;font-size:12px;border-radius:6px;border:1px solid ${color};background:transparent;color:${color};cursor:pointer;font-family:'Outfit',sans-serif;margin-bottom:8px">Guardar nota</button>
    <div id="work-notes-list">${renderWorkNotesHtml(_guionesDashCanal)}</div>
  </div>`

  // — Citas del día —
  const citasHoy = getCitasHoy()
  const citasWidgetHtml = citasHoy.length
    ? `<div style="background:rgba(239,159,39,0.08);border:1px solid rgba(239,159,39,0.3);border-radius:8px;padding:8px 10px;margin-bottom:10px">
        <div style="font-size:11px;font-weight:600;color:#EF9F27;margin-bottom:4px">🏥 Citas hoy</div>
        ${citasHoy.map(c=>`<div style="font-size:11px;color:#EF9F27;padding:1px 0">⏰ ${c.slot} — ${c.title}</div>`).join('')}
      </div>`
    : ''

  el.innerHTML = citasWidgetHtml + progressHtml + timerHtml + subHdr('Tareas') + tareasHtml + subHdr('Guiones') + guionesHtml + subHdr('Nota del día') + notaHtml
}

function goToScript(scriptId){
  activeScriptId = scriptId
  const btn = document.querySelector('.nav-item[onclick*="guiones"]')
  showSection('guiones', btn)
}

function showGrabarDialog(scripts){
  const sel = document.getElementById('grabar-script-select')
  sel.innerHTML = scripts.map(s => `<option value="${s.id}">${s.title}</option>`).join('')
  openModal('grabar')
}

async function confirmarGrabacion(){
  const scriptId = document.getElementById('grabar-script-select').value
  if(!scriptId) return
  const { error } = await SB_P.from('scripts').update({ status: 'grabado' }).eq('id', scriptId)
  if(error){ showToast('❌ Error: ' + error.message); return }
  allScripts = allScripts.map(s => s.id === scriptId ? {...s, status:'grabado'} : s)
  closeModal('grabar')
  renderScripts()
  loadProyectoDia()
  showToast('🎬 ¡Grabación registrada!')
}

function switchEditorModo(id, target){
  const cur = _editorModo[id] || 'ia'
  if(cur === 'libre'){
    const el = document.getElementById('se-libre-'+id)
    if(el) _scriptLibre[id] = el.value
  } else if(cur === 'bloques'){
    _captureBlocksFromDOM(id)
  }
  if(target === 'bloques'){
    _editorModo[id] = _scriptBloques[id] ? 'bloques' : 'bloques_prompt'
  } else if(target === 'libre'){
    if(cur === 'bloques'){
      const b = _scriptBloques[id]
      if(b) _scriptLibre[id] = [b.b1,b.b2,b.b3,b.b4].filter(Boolean).join('\n\n')
    }
    _editorModo[id] = 'libre'
  } else {
    _editorModo[id] = target
  }
  renderScripts()
}

function _captureBlocksFromDOM(id){
  const b1 = document.getElementById('se-b1-'+id)?.value || ''
  const b2 = document.getElementById('se-b2-'+id)?.value || ''
  const b3 = document.getElementById('se-b3-'+id)?.value || ''
  const b4 = document.getElementById('se-b4-'+id)?.value || ''
  const notas = document.getElementById('se-notes-'+id)?.value || ''
  if(!_scriptBloques[id]) _scriptBloques[id] = {}
  Object.assign(_scriptBloques[id], {b1,b2,b3,b4,notas})
  _scriptLibre[id] = [b1,b2,b3,b4].filter(Boolean).join('\n\n')
}

function empezarBloquesVacios(id){
  _scriptBloques[id] = {b1:'',b2:'',b3:'',b4:'',notas:''}
  _editorModo[id] = 'bloques'
  renderScripts()
}

function syncLibreFromBloques(id){
  const b1 = document.getElementById('se-b1-'+id)?.value || ''
  const b2 = document.getElementById('se-b2-'+id)?.value || ''
  const b3 = document.getElementById('se-b3-'+id)?.value || ''
  const b4 = document.getElementById('se-b4-'+id)?.value || ''
  _scriptLibre[id] = [b1,b2,b3,b4].filter(Boolean).join('\n\n')
}

async function estructurarConIA(id){
  const libreEl = document.getElementById('se-libre-'+id)
  const texto = ((libreEl ? libreEl.value : '') || _scriptLibre[id] || '').trim()
  if(!texto){ showToast('❌ Escribe algo primero'); return }
  _scriptLibre[id] = texto
  const btn    = document.getElementById('se-estructurar-btn-'+id)
  const loadEl = document.getElementById('se-estructurar-load-'+id)
  if(btn){ btn.disabled=true; btn.textContent='Estructurando...' }
  if(loadEl) loadEl.style.display = 'flex'
  try {
    const script = allScripts.find(s => s.id === id)
    const response = await fetch('/api/generate-script', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({libre_text: texto, canal: script?.canal||'iarcania'})
    })
    const data = await response.json()
    if(!response.ok) throw new Error(data.error||'Error del servidor')
    _scriptBloques[id] = {b1:data.b1||'',b2:data.b2||'',b3:data.b3||'',b4:data.b4||'',notas:''}
    _editorModo[id] = 'bloques'
    renderScripts()
  } catch(e){
    showToast('❌ '+(e.message||'Error desconocido'))
    if(btn){ btn.disabled=false; btn.textContent='Estructurar con IA →' }
    if(loadEl) loadEl.style.display = 'none'
  }
}

function setScriptModo(id, modo){
  _scriptInputs[id] = {
    q1: document.getElementById('ai-q1-'+id)?.value || '',
    q2: document.getElementById('ai-q2-'+id)?.value || '',
    q3: document.getElementById('ai-q3-'+id)?.value || ''
  }
  _scriptModo[id] = modo
  renderScripts()
}

function resetToAIQuestions(id){
  _scriptStep[id] = 'questions'
  delete _scriptGen[id]
  renderScripts()
}

async function generateScriptInline(id){
  const modo = _scriptModo[id] || 'pantalla'
  const q1 = (document.getElementById('ai-q1-'+id)?.value || '').trim()
  const q2 = (document.getElementById('ai-q2-'+id)?.value || '').trim()
  const q3 = (document.getElementById('ai-q3-'+id)?.value || '').trim()
  if(!q1 || !q2 || !q3){ showToast('❌ Responde las 3 preguntas'); return }
  const btn    = document.getElementById('ai-gen-btn-'+id)
  const loadEl = document.getElementById('ai-load-'+id)
  if(btn){ btn.disabled = true; btn.textContent = 'Generando...' }
  if(loadEl) loadEl.style.display = 'flex'
  try {
    const script = allScripts.find(s => s.id === id)
    const response = await fetch('/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo, q1, q2, q3, canal: script?.canal || 'iarcania' })
    })
    const data = await response.json()
    if(!response.ok) throw new Error(data.error || 'Error del servidor')
    let b1='',b2='',b3='',b4=''
    if(modo === 'pantalla'){
      b1=data.pantalla_inicio||''; b2=data.problema||''; b3=data.explicacion||''; b4=data.cierre||''
    } else {
      b1=data.contradiccion||''; b2=data.tension||''; b3=data.aprendizaje||''; b4=data.cambio_real||''
    }
    _scriptBloques[id] = { b1, b2, b3, b4, notas:'' }
    _scriptLibre[id]   = [b1,b2,b3,b4].filter(Boolean).join('\n\n')
    _editorModo[id]    = 'bloques'
    renderScripts()
  } catch(e){
    showToast('❌ ' + (e.message || 'Error desconocido'))
    if(btn){ btn.disabled = false; btn.textContent = '✨ Generar guión' }
    if(loadEl) loadEl.style.display = 'none'
  }
}

function setScriptsVista(vista){
  scriptsVista = vista
  const btnL = document.getElementById('gv-lista')
  const btnC = document.getElementById('gv-cal')
  if(btnL){ btnL.style.background = vista==='lista'?'#161616':'transparent'; btnL.style.color = vista==='lista'?'var(--gold)':'var(--text-muted)' }
  if(btnC){ btnC.style.background = vista==='calendario'?'#161616':'transparent'; btnC.style.color = vista==='calendario'?'var(--gold)':'var(--text-muted)' }
  renderScripts()
}

function renderScriptsCalendario(filtered){
  const today = new Date(); today.setHours(0,0,0,0)
  const year  = today.getFullYear()
  const month = today.getMonth()
  // Agrupar por fecha — grabación y publicación
  const byDate = {}
  filtered.forEach(s => {
    if(s.fecha_grabacion){ if(!byDate[s.fecha_grabacion]) byDate[s.fecha_grabacion]=[];  byDate[s.fecha_grabacion].push({s,tipo:'grab'}) }
    if(s.fecha_publicacion){ if(!byDate[s.fecha_publicacion]) byDate[s.fecha_publicacion]=[]; byDate[s.fecha_publicacion].push({s,tipo:'pub'}) }
  })
  const CANAL_COLORS = { iarcania:'#E24B4A', voidstoic:'#8B6CF6' }
  const months = []
  // Mostrar mes actual + siguiente
  for(let mi=0; mi<2; mi++){
    const m = (month+mi)%12
    const y = year + Math.floor((month+mi)/12)
    const daysInMonth = new Date(y,m+1,0).getDate()
    const firstDay    = new Date(y,m,1).getDay() // 0=Dom
    const monthName   = new Date(y,m,1).toLocaleDateString('es-CO',{month:'long',year:'numeric'})
    let cells = ''
    // Encabezados días
    const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
    cells += dayNames.map(d=>`<div style="font-size:10px;color:#5a5870;font-family:Outfit,sans-serif;text-align:center;padding:4px 0">${d}</div>`).join('')
    // Celdas vacías inicio
    for(let i=0;i<firstDay;i++) cells+=`<div></div>`
    // Días
    for(let d=1;d<=daysInMonth;d++){
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const isToday = new Date(y,m,d).getTime()===today.getTime()
      const items   = byDate[dateStr]||[]
      const dots    = items.map(({s,tipo})=>{
        const c = tipo==='grab'?'#EF9F27':(CANAL_COLORS[normMarca(s.canal)]||'#8B6CF6')
        const ic = tipo==='grab'?'📹':'🚀'
        return `<div title="${ic} ${s.title}" style="font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${c};cursor:pointer" onclick="openScriptDetail('${s.id}');setScriptsVista('lista')">${ic} ${s.title}</div>`
      }).join('')
      cells += `<div style="min-height:52px;border:1px solid ${isToday?'rgba(124,58,237,0.4)':'#1a1a1a'};border-radius:6px;padding:4px 5px;background:${isToday?'rgba(124,58,237,0.05)':'transparent'}">
        <div style="font-size:11px;font-weight:${isToday?700:400};color:${isToday?'#a78bfa':'#666'};font-family:Outfit,sans-serif;margin-bottom:2px">${d}</div>
        ${dots}
      </div>`
    }
    months.push(`<div style="margin-bottom:24px">
      <div style="font-size:13px;font-weight:600;color:var(--text);font-family:Outfit,sans-serif;text-transform:capitalize;margin-bottom:10px">${monthName}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${cells}</div>
    </div>`)
  }
  // Próximos eventos
  const upcoming = Object.entries(byDate)
    .filter(([d])=>d >= today.toISOString().slice(0,10))
    .sort(([a],[b])=>a.localeCompare(b))
    .slice(0,8)
  const upcomingHtml = upcoming.length ? `<div style="margin-top:8px">
    <div style="font-size:11px;font-weight:600;color:#5a5870;font-family:Outfit,sans-serif;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Próximos</div>
    ${upcoming.map(([date,items])=>items.map(({s,tipo})=>{
      const label = tipo==='grab'?'Grabación':'Publicación'
      const ic    = tipo==='grab'?'📹':'🚀'
      const c     = CANAL_COLORS[normMarca(s.canal)]||'#8B6CF6'
      const d     = new Date(date+'T12:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'})
      return `<div onclick="openScriptDetail('${s.id}');setScriptsVista('lista')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #1a1a1a;border-radius:8px;cursor:pointer;margin-bottom:4px">
        <span style="font-size:16px">${ic}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);font-family:Outfit,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.title}</div>
          <div style="font-size:10px;color:${c};font-family:Outfit,sans-serif">${label} · ${d}</div>
        </div>
      </div>`
    }).join('')).join('')}
  </div>` : ''
  return months.join('') + upcomingHtml
}

const normMarca = v => (v || '').toString().toLowerCase().replace(/[\s_\-]+/g, '')

function renderScripts(){
  const el = document.getElementById('scripts-list')
  if(!el) return
  const filtered = scriptsFilter === 'all' ? allScripts : allScripts.filter(s => normMarca(s.canal) === normMarca(scriptsFilter))
  if(scriptsVista === 'calendario'){
    el.innerHTML = renderScriptsCalendario(filtered)
    return
  }
  if(scriptsVista === 'publicar' && publicarScriptId){
    el.innerHTML = renderPublicar(publicarScriptId)
    return
  }
  if(!filtered.length){
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎬</div>No hay guiones todavía — crea el primero</div>'
    return
  }
  const CANAL_COLORS = { iarcania:'#E24B4A', voidstoic:'#8B6CF6' }
  const CANAL_LABELS = { iarcania:'IArcanIA', voidstoic:'Void Stoic' }
  const STATUS_COLORS = { borrador:'var(--text-muted)', en_progreso:'#EF9F27', listo_grabar:'#5DCAA5', grabado:'#378ADD', publicado:'#8B6CF6' }
  const STATUS_LABELS = { borrador:'Borrador', en_progreso:'En progreso', listo_grabar:'Listo para grabar', grabado:'Grabado', publicado:'Publicado' }
  el.innerHTML = filtered.map(s => {
    const cKey   = normMarca(s.canal)
    const cColor = CANAL_COLORS[cKey] || '#8B6CF6'
    const cLabel = CANAL_LABELS[cKey] || s.canal
    const stColor = STATUS_COLORS[s.status] || STATUS_COLORS.borrador
    const stLabel = STATUS_LABELS[s.status] || 'Borrador'
    const isActive = s.id === activeScriptId
    const grabacion = [
      s.fecha_grabacion   ? `<span style="color:#EF9F27;font-size:10px">📹 ${s.fecha_grabacion}</span>`   : '',
      s.fecha_publicacion ? `<span style="color:#8B6CF6;font-size:10px">🚀 ${s.fecha_publicacion}</span>` : ''
    ].filter(Boolean).join('')
    const cl = getChecklist(s)
    const clDone = checklistDone(cl)
    const clKeys = ['guion','imagenes','grabado','editado','thumbnail','publicado']
    const clLabels = {guion:'Guión listo',imagenes:'Imágenes / recursos listos',grabado:'Grabado',editado:'Editado',thumbnail:'Thumbnail',publicado:'Publicado'}
    const clBarC = clDone === 0 ? 'var(--text-muted)' : clDone < 6 ? '#EF9F27' : '#5DCAA5'
    const hasContent  = !!(s.hook || s.body || s.cta)
    const editorModo  = _editorModo[s.id] || (hasContent ? 'bloques' : 'ia')
    const bl = _scriptBloques[s.id]
    let b1='',b2='',b3='',b4='',notesVal=''
    if(bl){ b1=bl.b1; b2=bl.b2; b3=bl.b3; b4=bl.b4; notesVal=bl.notas||'' }
    else if(hasContent){
      b1=s.hook||''; const pts=(s.body||'').split('\n\n')
      b2=pts[0]||''; b3=pts.slice(1).join('\n\n')||''; b4=s.cta||''
      notesVal = (s.notes && !s.notes.startsWith('{')) ? s.notes : ''
    }
    const libreText  = _scriptLibre[s.id] !== undefined ? _scriptLibre[s.id] : [b1,b2,b3,b4].filter(Boolean).join('\n\n')
    const iaModo     = _scriptModo[s.id] || (normMarca(s.canal)==='voidstoic' ? 'camara' : 'pantalla')
    const iaInputs   = _scriptInputs[s.id] || {}
    const iStyle = 'width:100%;background:var(--sg-surface,#161616);border:1px solid var(--sg-border,#2a2a2a);border-radius:6px;padding:9px 12px;color:var(--sg-texto,#e8e8e8);font-family:Outfit,sans-serif;font-size:13px;outline:none;box-sizing:border-box'
    const tStyle = 'width:100%;background:var(--sg-surface,#161616);border:1px solid var(--sg-border,#2a2a2a);border-radius:6px;padding:9px 12px;color:var(--sg-texto,#e8e8e8);font-family:Outfit,sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical'
    const lStyle = 'font-size:11px;font-weight:600;color:var(--sg-muted,#888);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;display:block'
    const mBtnA  = 'padding:7px 14px;border-radius:6px;font-family:Outfit,sans-serif;font-size:13px;font-weight:500;cursor:pointer;border:1px solid #444;background:#1e1e1e;color:#e8e8e8'
    const mBtnI  = 'padding:7px 14px;border-radius:6px;font-family:Outfit,sans-serif;font-size:13px;font-weight:500;cursor:pointer;border:1px solid #2a2a2a;background:transparent;color:#888'
    const tBtnA  = 'padding:6px 14px;border-radius:6px;font-family:Outfit,sans-serif;font-size:12px;font-weight:500;cursor:pointer;border:1px solid #444;background:#1e1e1e;color:#e8e8e8'
    const tBtnI  = 'padding:6px 14px;border-radius:6px;font-family:Outfit,sans-serif;font-size:12px;font-weight:500;cursor:pointer;border:1px solid #2a2a2a;background:transparent;color:#888'
    const isPA   = iaModo==='pantalla'
    const isCM   = iaModo==='camara'
    const QL = isPA
      ? {q1:'¿Qué vas a mostrar en pantalla?',q2:'¿Qué no entiende la gente de esto?',q3:'¿Qué cambia para quien lo vea?'}
      : {q1:'¿Qué contradicción tuya arranca el video?',q2:'¿Qué tensión o problema hay detrás?',q3:'¿Qué cambiaste tú en tu vida real?'}
    const PH = isPA
      ? {q1:'ej: mi agente de WhatsApp respondiendo mensajes',q2:'ej: que no es un chatbot, es un agente con herramientas',q3:'ej: dejarían de responder WhatsApp manualmente'}
      : {q1:'ej: tengo todo organizado y no lo cumplo',q2:'ej: saber y hacer son cosas diferentes',q3:'ej: decidí que el tema de mañana se decide hoy en la noche'}
    // Toggle de 5 modos
    const toggleBar = `<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      <button onclick="switchEditorModo('${s.id}','libre')" style="${editorModo==='libre'?tBtnA:tBtnI}">✏️ Libre</button>
      <button onclick="switchEditorModo('${s.id}','bloques')" style="${(editorModo==='bloques'||editorModo==='bloques_prompt')?tBtnA:tBtnI}">🧩 Bloques</button>
      <button onclick="switchEditorModo('${s.id}','ia')" style="${editorModo==='ia'?tBtnA:tBtnI}">✨ IA</button>
      <button onclick="switchEditorModo('${s.id}','presentacion')" style="${editorModo==='presentacion'?tBtnA:tBtnI}">🎨 Presentación</button>
      <button onclick="switchEditorModo('${s.id}','publicar')" style="${editorModo==='publicar'?tBtnA:tBtnI}">🚀 Publicar</button>
    </div>`
    // Modo Libre
    const libreHTML = `<div style="display:flex;flex-direction:column;gap:10px">
      <textarea id="se-libre-${s.id}" style="${tStyle};min-height:300px;background:#111;border-color:#1e1e1e" placeholder="Escribe tu guión como quieras. Cuando termines, presiona Estructurar y la IA lo divide en bloques.">${libreText}</textarea>
      <div style="display:flex;align-items:center;gap:10px">
        <button id="se-estructurar-btn-${s.id}" onclick="estructurarConIA('${s.id}')" style="padding:10px 20px;border-radius:6px;background:#fff;color:#000;border:none;font-family:Outfit,sans-serif;font-size:13px;font-weight:600;cursor:pointer">Estructurar con IA →</button>
        <div id="se-estructurar-load-${s.id}" style="display:none;font-size:12px;color:#888;font-family:Outfit,sans-serif;align-items:center;gap:6px"><span class="ai-dot-anim">●</span>&nbsp;Estructurando...</div>
      </div>
    </div>`
    // Modo Bloques — prompt cuando no hay bloques
    const bloquePromptHTML = `<div style="border:1px solid #2a2a2a;border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:10px;align-items:flex-start">
      <div style="font-size:13px;color:#888;font-family:Outfit,sans-serif">¿Cómo quieres empezar los bloques?</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="estructurarConIA('${s.id}')" style="padding:9px 16px;border-radius:6px;background:#fff;color:#000;border:none;font-family:Outfit,sans-serif;font-size:13px;font-weight:600;cursor:pointer">✨ Estructurar con IA</button>
        <button onclick="empezarBloquesVacios('${s.id}')" style="padding:9px 16px;border-radius:6px;background:transparent;border:1px solid #2a2a2a;color:#e8e8e8;font-family:Outfit,sans-serif;font-size:13px;cursor:pointer">Escribir manualmente</button>
      </div>
    </div>`
    // Modo Bloques — contenido
    const backBtn = _scriptLibre[s.id] !== undefined ? `<button onclick="switchEditorModo('${s.id}','libre')" style="background:transparent;border:1px solid #2a2a2a;border-radius:4px;padding:2px 8px;color:#888;font-size:11px;cursor:pointer;font-family:Outfit,sans-serif">← Ver texto libre</button>` : ''
    const bloquesContentHTML = `<div style="display:flex;flex-direction:column;gap:10px">
      ${backBtn ? `<div>${backBtn}</div>` : ''}
      <div><label style="${lStyle}">Pantalla inicio</label><textarea id="se-b1-${s.id}" style="${tStyle};min-height:80px" oninput="syncLibreFromBloques('${s.id}')">${b1}</textarea></div>
      <div><label style="${lStyle}">Problema</label><textarea id="se-b2-${s.id}" style="${tStyle};min-height:100px" oninput="syncLibreFromBloques('${s.id}')">${b2}</textarea></div>
      <div><label style="${lStyle}">Explicación</label><textarea id="se-b3-${s.id}" style="${tStyle};min-height:100px" oninput="syncLibreFromBloques('${s.id}')">${b3}</textarea></div>
      <div><label style="${lStyle}">Cierre</label><textarea id="se-b4-${s.id}" style="${tStyle};min-height:80px" oninput="syncLibreFromBloques('${s.id}')">${b4}</textarea></div>
      <div><label style="${lStyle}">Notas</label><textarea id="se-notes-${s.id}" style="${tStyle};min-height:60px">${notesVal}</textarea></div>
    </div>`
    const bloquesHTML = editorModo === 'bloques_prompt' ? bloquePromptHTML : bloquesContentHTML
    // Modo IA
    const iaHTML = `<div style="border:1px solid #2a2a2a;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="setScriptModo('${s.id}','pantalla')" style="${isPA?mBtnA:mBtnI}">📺 Muestro pantalla</button>
        <button onclick="setScriptModo('${s.id}','camara')" style="${isCM?mBtnA:mBtnI}">🎥 Hablo a cámara</button>
      </div>
      <div><label style="${lStyle}">${QL.q1}</label><input id="ai-q1-${s.id}" type="text" placeholder="${PH.q1}" value="${(iaInputs.q1||'').replace(/"/g,'&quot;')}" style="${iStyle}"></div>
      <div><label style="${lStyle}">${QL.q2}</label><input id="ai-q2-${s.id}" type="text" placeholder="${PH.q2}" value="${(iaInputs.q2||'').replace(/"/g,'&quot;')}" style="${iStyle}"></div>
      <div><label style="${lStyle}">${QL.q3}</label><input id="ai-q3-${s.id}" type="text" placeholder="${PH.q3}" value="${(iaInputs.q3||'').replace(/"/g,'&quot;')}" style="${iStyle}"></div>
      <div id="ai-load-${s.id}" style="display:none;font-size:12px;color:#888;font-family:Outfit,sans-serif;align-items:center;gap:6px"><span class="ai-dot-anim">●</span>&nbsp;Generando...</div>
      <button id="ai-gen-btn-${s.id}" onclick="generateScriptInline('${s.id}')" style="padding:10px 20px;border-radius:6px;background:#fff;color:#000;border:none;font-family:Outfit,sans-serif;font-size:13px;font-weight:600;cursor:pointer;align-self:flex-start">✨ Generar guión</button>
    </div>`
    // Modo Presentación — inline, sin modal
    const presGen   = _scriptGen[s.id]
    const scriptContent = [s.title, s.hook, s.body, s.cta].filter(Boolean).join('\n\n')
    const presResultRow = (vista, label, icon) => {
      const gen = presGen?.[vista]
      const fechaStr = gen && presGen.generado_en ? new Date(presGen.generado_en).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}) : ''
      return `
      <div style="padding:10px 14px;background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.15);border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <span style="font-size:12px;color:#a78bfa;font-family:Outfit,sans-serif">${icon} ${label}</span>
          ${fechaStr ? `<span style="font-size:10px;color:#5a5870;font-family:Outfit,sans-serif;margin-left:8px">${fechaStr}</span>` : ''}
        </div>
        <div style="display:flex;gap:8px">
          ${gen ? `
          <button onclick="presInlineVer('${s.id}','${vista}')" style="padding:5px 12px;font-size:11px;background:transparent;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;cursor:pointer;font-family:Outfit,sans-serif">👁 Ver</button>
          <button onclick="presInlineDescargar('${s.id}','${vista}')" style="padding:5px 12px;font-size:11px;background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;border-radius:6px;color:#fff;cursor:pointer;font-family:Outfit,sans-serif">⬇ Descargar</button>
          <button onclick="generarPresentacionInline('${s.id}','${vista}')" style="padding:5px 12px;font-size:11px;background:transparent;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#888;cursor:pointer;font-family:Outfit,sans-serif">↺ Regenerar</button>
          ` : `
          <button onclick="generarPresentacionInline('${s.id}','${vista}')" style="padding:5px 14px;font-size:11px;background:#fff;border:none;border-radius:6px;color:#000;cursor:pointer;font-family:Outfit,sans-serif;font-weight:600">✦ Generar</button>
          `}
        </div>
      </div>`
    }
    const presHTML  = `<div style="border:1px solid #2a2a2a;border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px">
      <div style="font-size:12px;color:#888;font-family:Outfit,sans-serif;line-height:1.5">
        Genera dos versiones HTML: una para ti (con estructura, bloques y notas) y otra para tu audiencia (visual, limpia, lista para mostrar).
      </div>
      <div style="padding:10px 12px;background:#111;border:1px solid #2a2a2a;border-radius:6px;font-size:11px;color:#5a5870;font-family:Outfit,sans-serif;line-height:1.6;max-height:80px;overflow:hidden">
        ${scriptContent ? scriptContent.substring(0,200).replace(/</g,'&lt;') + (scriptContent.length > 200 ? '…' : '') : '<em>Sin contenido en el guión aún</em>'}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px"><label style="${lStyle}">Canal</label>
          <select id="pres-inline-canal-${s.id}" style="${iStyle}">
            <option value="iarcania" ${normMarca(s.canal)==='iarcania'?'selected':''}>IArcanIA</option>
            <option value="voidstoic" ${normMarca(s.canal)==='voidstoic'?'selected':''}>Void Stoic</option>
          </select>
        </div>
        <div style="flex:1;min-width:120px"><label style="${lStyle}">Formato</label>
          <select id="pres-inline-formato-${s.id}" style="${iStyle}">
            <option value="largo">Video largo (YouTube)</option>
            <option value="corto">Short / Reels</option>
          </select>
        </div>
      </div>
      <div id="pres-inline-load-${s.id}" style="display:none;font-size:12px;color:#888;font-family:Outfit,sans-serif;align-items:center;gap:6px">
        <span class="ai-dot-anim">●</span>&nbsp;<span id="pres-inline-load-txt-${s.id}">Generando ambas presentaciones...</span>
      </div>
      ${presResultRow('presentador', 'Vista presentador', '📋')}
      ${presResultRow('audiencia', 'Vista audiencia', '👥')}
      <button id="pres-inline-btn-${s.id}" onclick="generarPresentacionInline('${s.id}')"
        style="padding:7px 16px;border-radius:6px;background:transparent;color:#555;border:1px solid #333;font-family:Outfit,sans-serif;font-size:12px;cursor:pointer;align-self:flex-start">
        🎨 Generar ambas
      </button>
    </div>`
    // Modo Publicar
    const plats  = s.plataformas || []
    const pubSt  = s.pub_status  || {}
    const ST_COLOR = { pendiente:'#EF9F27', publicado:'#5DCAA5', error:'#E24B4A' }
    const ST_LABEL = { pendiente:'⏳ Pendiente', publicado:'✅ Publicado', error:'❌ Error' }
    const ytSt = pubSt.youtube   || (plats.includes('youtube')   ? 'pendiente' : null)
    const igSt = pubSt.instagram || (plats.includes('instagram') ? 'pendiente' : null)
    const publicarHTML = `<div style="display:flex;flex-direction:column;gap:14px">
      ${(ytSt||igSt) ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        ${ytSt ? `<span style="padding:4px 10px;font-size:11px;font-family:Outfit,sans-serif;color:${ST_COLOR[ytSt]};border:1px solid ${ST_COLOR[ytSt]}33;border-radius:20px">▶ YT ${ST_LABEL[ytSt]}</span>` : ''}
        ${igSt ? `<span style="padding:4px 10px;font-size:11px;font-family:Outfit,sans-serif;color:${ST_COLOR[igSt]};border:1px solid ${ST_COLOR[igSt]}33;border-radius:20px">📸 IG ${ST_LABEL[igSt]}</span>` : ''}
      </div>` : ''}
      <div>
        <label style="${lStyle}">Link del video editado (Google Drive)</label>
        <input id="pub-url-${s.id}" type="url" placeholder="https://drive.google.com/file/d/..." value="${(s.video_url||'').replace(/"/g,'&quot;')}" style="${iStyle}">
      </div>
      <div>
        <label style="${lStyle}">Publicar en</label>
        <div style="display:flex;gap:16px;margin-top:5px">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;color:var(--text);font-family:Outfit,sans-serif">
            <input type="checkbox" id="pub-yt-${s.id}" ${plats.includes('youtube')?'checked':''} style="width:15px;height:15px;accent-color:#E24B4A;cursor:pointer"> ▶ YouTube
          </label>
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;color:var(--text);font-family:Outfit,sans-serif">
            <input type="checkbox" id="pub-ig-${s.id}" ${plats.includes('instagram')?'checked':''} style="width:15px;height:15px;accent-color:#8B6CF6;cursor:pointer"> 📸 Instagram
          </label>
        </div>
      </div>
      <div style="border-top:1px solid #1e1e1e;padding-top:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <label style="${lStyle};margin-bottom:0">Copy por plataforma</label>
          <button id="pub-copy-btn-${s.id}" onclick="generarCopyPublicacion('${s.id}')" style="padding:5px 12px;font-size:11px;background:transparent;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;cursor:pointer;font-family:Outfit,sans-serif">✨ Generar con IA</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="${lStyle}">YouTube — Título</label>
            <input id="pub-yt-titulo-${s.id}" type="text" placeholder="Título optimizado para YouTube" value="${(s.copy_yt_titulo||'').replace(/"/g,'&quot;')}" style="${iStyle}">
          </div>
          <div>
            <label style="${lStyle}">YouTube — Descripción</label>
            <textarea id="pub-yt-desc-${s.id}" placeholder="Descripción con timestamps, links y CTA..." style="${tStyle};min-height:100px">${s.copy_yt_descripcion||''}</textarea>
          </div>
          <div>
            <label style="${lStyle}">Instagram — Caption</label>
            <textarea id="pub-ig-caption-${s.id}" placeholder="Caption con hashtags..." style="${tStyle};min-height:80px">${s.copy_ig_caption||''}</textarea>
          </div>
        </div>
      </div>
      <button onclick="savePublicacion('${s.id}')" style="padding:9px 20px;border-radius:8px;background:#fff;color:#000;border:none;font-family:Outfit,sans-serif;font-size:13px;font-weight:600;cursor:pointer;align-self:flex-start">Guardar publicación</button>
    </div>`
    const editorContent  = editorModo === 'libre' ? libreHTML : editorModo === 'ia' ? iaHTML : editorModo === 'presentacion' ? presHTML : editorModo === 'publicar' ? publicarHTML : bloquesHTML
    const scriptBlockUI  = `<div id="sg-editor-${s.id}" class="sg-branded-editor"><img class="sg-brand-logo" src="" alt="" style="display:none">${toggleBar}${editorContent}</div>`
    return `<div class="script-card${isActive?' active':''}" style="border-left-color:${cColor}">
      <div onclick="openScriptDetail('${s.id}')" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer">
        <div style="flex:1;min-width:0">
          <input id="se-title-${s.id}" value="${(s.title||'').replace(/"/g,'&quot;')}" onclick="event.stopPropagation()" style="font-size:14px;font-weight:600;color:var(--text);background:transparent;border:none;border-bottom:1px solid transparent;outline:none;width:100%;font-family:Outfit,sans-serif;padding:0" onfocus="this.style.borderBottomColor='var(--border)'" onblur="this.style.borderBottomColor='transparent'">
          <div style="font-size:11px;margin-top:4px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <span style="color:${cColor};font-weight:600">${cLabel}</span>
            <span style="color:${stColor}">${stLabel}</span>
            ${grabacion}
          </div>
          ${renderChecklistBar(cl)}
        </div>
        <span style="color:var(--text-muted);font-size:18px;line-height:1;display:inline-block;transition:transform .2s;flex-shrink:0;margin-left:10px;${isActive?'transform:rotate(180deg)':''}">⌄</span>
      </div>
      ${isActive ? `<div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--border);padding-top:14px">
        <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">📋 Producción</div>
          <div style="display:flex;gap:2px;border-radius:3px;overflow:hidden;margin-bottom:10px">${clKeys.map(k=>`<div style="flex:1;height:4px;background:${cl[k]?clBarC:'var(--border)'}"></div>`).join('')}</div>
          <div style="display:flex;flex-direction:column;gap:4px">${clKeys.map(k=>`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:3px 0">
            <input type="checkbox" ${cl[k]?'checked':''} onchange="toggleChecklist('${s.id}','${k}',this.checked)" style="width:15px;height:15px;accent-color:${clBarC};cursor:pointer;flex-shrink:0">
            <span style="font-size:13px;color:${cl[k]?'var(--text-primary)':'var(--text-muted)'}">${clLabels[k]}</span>
          </label>`).join('')}</div>
          <div style="font-size:11px;color:${clBarC};margin-top:8px">${clDone}/6 completados</div>
        </div>
        ${scriptBlockUI}
        <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;align-items:center">
          <select id="se-status-${s.id}" style="background:#0C0C0C;border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'Outfit',sans-serif;font-size:13px;outline:none">
            <option value="borrador" ${s.status==='borrador'?'selected':''}>Borrador</option>
            <option value="en_progreso" ${s.status==='en_progreso'?'selected':''}>En progreso</option>
            <option value="listo_grabar" ${s.status==='listo_grabar'?'selected':''}>Listo para grabar</option>
            <option value="grabado" ${s.status==='grabado'?'selected':''}>Grabado</option>
            <option value="publicado" ${s.status==='publicado'?'selected':''}>Publicado</option>
          </select>
          <div style="display:flex;flex-direction:column;gap:2px">
            <label style="font-size:10px;color:#5a5870;font-family:Outfit,sans-serif;letter-spacing:.4px">📹 GRABACIÓN</label>
            <input type="date" id="se-fecha-${s.id}" value="${s.fecha_grabacion||''}" style="background:#0C0C0C;border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'Outfit',sans-serif;font-size:13px;outline:none" title="Fecha de grabación">
          </div>
          <div style="display:flex;flex-direction:column;gap:2px">
            <label style="font-size:10px;color:#5a5870;font-family:Outfit,sans-serif;letter-spacing:.4px">🚀 PUBLICACIÓN</label>
            <input type="datetime-local" id="se-fechapub-${s.id}" value="${(s.fecha_publicacion||'').slice(0,16)}" style="background:#0C0C0C;border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-family:'Outfit',sans-serif;font-size:13px;outline:none" title="Fecha y hora de publicación">
          </div>
          <button class="btn-save" onclick="saveScript('${s.id}')">Guardar</button>
          <button onclick="deleteScript('${s.id}')" style="padding:9px 14px;border-radius:8px;border:1px solid rgba(226,75,74,0.3);background:transparent;color:var(--red);cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px">Eliminar</button>
        </div>
      </div>` : ''}
    </div>`
  }).join('')
  if (activeScriptId) requestAnimationFrame(() => applyScriptBranding(activeScriptId))
}

function openScriptDetail(scriptId){
  activeScriptId = scriptId === activeScriptId ? null : scriptId
  renderScripts()
}

function filterScripts(filter, btn){
  scriptsFilter = filter
  document.querySelectorAll('#gf-all,#gf-iarcania,#gf-voidstoic').forEach(b => {
    b.style.background = 'transparent'
    b.style.color = 'var(--text-muted)'
  })
  btn.style.background = '#161616'
  btn.style.color = 'var(--gold)'
  renderScripts()
}

async function saveScript(scriptId){
  await ensureSBI()
  const mode = _editorModo[scriptId] || 'bloques'
  if(mode === 'libre'){
    const texto = (document.getElementById('se-libre-'+scriptId)?.value || _scriptLibre[scriptId] || '').trim()
    if(!texto){ showToast('❌ El guión está vacío'); return }
    if(!confirm('El guión está en modo libre. ¿Guardar el texto completo en el primer bloque?')) return
    _scriptLibre[scriptId] = texto
    _scriptBloques[scriptId] = {b1:texto, b2:'', b3:'', b4:'', notas:''}
  } else if(mode === 'bloques'){
    _captureBlocksFromDOM(scriptId)
  }
  const bl = _scriptBloques[scriptId] || {}
  const fechaVal = document.getElementById('se-fecha-'+scriptId)?.value || ''
  const data = {
    title:           document.getElementById('se-title-'+scriptId)?.value?.trim() || '',
    hook:            bl.b1 || '',
    body:            [bl.b2, bl.b3].filter(Boolean).join('\n\n'),
    cta:             bl.b4 || '',
    notes:           bl.notas || '',
    status:          document.getElementById('se-status-'+scriptId)?.value || 'borrador',
    fecha_grabacion:   fechaVal || null,
    fecha_publicacion: document.getElementById('se-fechapub-'+scriptId)?.value || null
  }
  const { error } = await SB_P.from('scripts').update(data).eq('id', scriptId)
  if(error){ showToast('❌ Error: ' + error.message); return }
  allScripts = allScripts.map(s => s.id === scriptId ? {...s, ...data} : s)
  showToast('✅ Guión guardado')
  renderScripts()
  loadProyectoDia()
}

async function savePublicacion(scriptId){
  await ensureSBI()
  const plataformas = []
  if(document.getElementById('pub-yt-'+scriptId)?.checked) plataformas.push('youtube')
  if(document.getElementById('pub-ig-'+scriptId)?.checked) plataformas.push('instagram')
  const data = {
    video_url:           document.getElementById('pub-url-'+scriptId)?.value.trim() || null,
    plataformas,
    copy_yt_titulo:      document.getElementById('pub-yt-titulo-'+scriptId)?.value.trim() || null,
    copy_yt_descripcion: document.getElementById('pub-yt-desc-'+scriptId)?.value.trim()   || null,
    copy_ig_caption:     document.getElementById('pub-ig-caption-'+scriptId)?.value.trim()|| null
  }
  const { error } = await SB_P.from('scripts').update(data).eq('id', scriptId)
  if(error){ showToast('❌ ' + error.message); return }
  allScripts = allScripts.map(s => s.id === scriptId ? {...s, ...data} : s)
  showToast('✅ Publicación guardada')
  renderScripts()
}

async function generarCopyPublicacion(scriptId){
  const s = allScripts.find(x => x.id === scriptId)
  if(!s){ showToast('❌ Guión no encontrado'); return }
  const contenido = [s.title, s.hook, s.body, s.cta].filter(Boolean).join('\n\n')
  if(!contenido.trim()){ showToast('❌ El guión no tiene contenido'); return }
  const btn = document.getElementById('pub-copy-btn-'+scriptId)
  if(btn){ btn.disabled = true; btn.textContent = 'Generando...' }
  try {
    const r = await fetch('/api/generar-copy', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ canal: s.canal, contenido })
    })
    const data = await r.json()
    if(!r.ok) throw new Error(data.error || 'Error del servidor')
    const t = document.getElementById('pub-yt-titulo-'+scriptId)
    const d = document.getElementById('pub-yt-desc-'+scriptId)
    const c = document.getElementById('pub-ig-caption-'+scriptId)
    if(t) t.value = data.yt_titulo      || ''
    if(d) d.value = data.yt_descripcion || ''
    if(c) c.value = data.ig_caption     || ''
    showToast('✨ Copy generado — revísalo y guarda')
  } catch(e){
    showToast('❌ Error: ' + (e.message || 'Error desconocido'))
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = '✨ Generar con IA' }
  }
}

function abrirPublicar(scriptId){
  publicarScriptId = scriptId
  scriptsVista = 'publicar'
  document.getElementById('scripts-list').innerHTML = renderPublicar(scriptId)
}

function renderPublicar(scriptId){
  const s = allScripts.find(x => x.id === scriptId)
  if(!s) return '<div style="color:var(--text-muted);font-family:Outfit,sans-serif">Guión no encontrado</div>'
  const CANAL_COLORS = { iarcania:'#E24B4A', voidstoic:'#8B6CF6' }
  const CANAL_LABELS = { iarcania:'IArcanIA', voidstoic:'Void Stoic' }
  const plats  = s.plataformas || []
  const pubSt  = s.pub_status  || {}
  const ST_COLOR = { pendiente:'#EF9F27', publicado:'#5DCAA5', error:'#E24B4A' }
  const ST_LABEL = { pendiente:'⏳ Pendiente', publicado:'✅ Publicado', error:'❌ Error' }
  const ytSt = pubSt.youtube   || (plats.includes('youtube')   ? 'pendiente' : null)
  const igSt = pubSt.instagram || (plats.includes('instagram') ? 'pendiente' : null)
  const iStyle = 'width:100%;background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:10px 14px;color:#e8e8e8;font-family:Outfit,sans-serif;font-size:13px;outline:none;box-sizing:border-box'
  const tStyle = 'width:100%;background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:10px 14px;color:#e8e8e8;font-family:Outfit,sans-serif;font-size:13px;outline:none;box-sizing:border-box;resize:vertical'
  const lStyle = 'font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:block'
  const cColor = CANAL_COLORS[normMarca(s.canal)] || '#8B6CF6'
  const cLabel = CANAL_LABELS[normMarca(s.canal)] || s.canal
  return `<div style="display:flex;flex-direction:column;gap:20px;max-width:680px">
    <div style="display:flex;align-items:center;gap:12px">
      <button onclick="setScriptsVista('lista')" style="padding:7px 14px;font-size:12px;font-family:Outfit,sans-serif;border:1px solid #2a2a2a;border-radius:8px;background:transparent;color:#888;cursor:pointer">← Volver</button>
      <div>
        <div style="font-size:15px;font-weight:600;color:var(--text);font-family:Outfit,sans-serif">${s.title}</div>
        <div style="font-size:11px;color:${cColor};font-family:Outfit,sans-serif;margin-top:2px">${cLabel}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${ytSt ? `<div style="padding:10px 14px;background:rgba(226,75,74,0.06);border:1px solid rgba(226,75,74,0.2);border-radius:8px;font-size:12px;font-family:Outfit,sans-serif;color:${ST_COLOR[ytSt]||'#888'}">YouTube — ${ST_LABEL[ytSt]||ytSt}</div>` : ''}
      ${igSt ? `<div style="padding:10px 14px;background:rgba(139,108,246,0.06);border:1px solid rgba(139,108,246,0.2);border-radius:8px;font-size:12px;font-family:Outfit,sans-serif;color:${ST_COLOR[igSt]||'#888'}">Instagram — ${ST_LABEL[igSt]||igSt}</div>` : ''}
    </div>

    <div style="background:#0e0e0e;border:1px solid #1e1e1e;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:16px">
      <div style="font-size:12px;font-weight:600;color:#5a5870;text-transform:uppercase;letter-spacing:.6px">Video</div>
      <div>
        <label style="${lStyle}">Link del video editado (Google Drive)</label>
        <input id="pub-url-${s.id}" type="url" placeholder="https://drive.google.com/file/d/..." value="${(s.video_url||'').replace(/"/g,'&quot;')}" style="${iStyle}">
      </div>
      <div>
        <label style="${lStyle}">Publicar en</label>
        <div style="display:flex;gap:16px;margin-top:4px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text);font-family:Outfit,sans-serif">
            <input type="checkbox" id="pub-yt-${s.id}" ${plats.includes('youtube')?'checked':''} style="width:16px;height:16px;accent-color:#E24B4A;cursor:pointer">
            <span>▶ YouTube</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text);font-family:Outfit,sans-serif">
            <input type="checkbox" id="pub-ig-${s.id}" ${plats.includes('instagram')?'checked':''} style="width:16px;height:16px;accent-color:#8B6CF6;cursor:pointer">
            <span>📸 Instagram</span>
          </label>
        </div>
      </div>
    </div>

    <div style="background:#0e0e0e;border:1px solid #1e1e1e;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:12px;font-weight:600;color:#5a5870;text-transform:uppercase;letter-spacing:.6px">Copy</div>
        <button id="pub-copy-btn-${s.id}" onclick="generarCopyPublicacion('${s.id}')" style="padding:6px 14px;font-size:12px;background:transparent;border:1px solid rgba(124,58,237,0.4);border-radius:6px;color:#a78bfa;cursor:pointer;font-family:Outfit,sans-serif">✨ Generar con IA</button>
      </div>
      <div>
        <label style="${lStyle}">YouTube — Título</label>
        <input id="pub-yt-titulo-${s.id}" type="text" placeholder="Título optimizado para YouTube" value="${(s.copy_yt_titulo||'').replace(/"/g,'&quot;')}" style="${iStyle}">
      </div>
      <div>
        <label style="${lStyle}">YouTube — Descripción</label>
        <textarea id="pub-yt-desc-${s.id}" placeholder="Descripción con timestamps, links y CTA..." style="${tStyle};min-height:120px">${s.copy_yt_descripcion||''}</textarea>
      </div>
      <div>
        <label style="${lStyle}">Instagram — Caption</label>
        <textarea id="pub-ig-caption-${s.id}" placeholder="Caption con hashtags..." style="${tStyle};min-height:90px">${s.copy_ig_caption||''}</textarea>
      </div>
    </div>

    <div style="display:flex;gap:10px">
      <button onclick="savePublicacion('${s.id}')" style="padding:10px 22px;border-radius:8px;background:#fff;color:#000;border:none;font-family:Outfit,sans-serif;font-size:13px;font-weight:600;cursor:pointer">Guardar</button>
      <button onclick="setScriptsVista('lista')" style="padding:10px 18px;border-radius:8px;background:transparent;border:1px solid #2a2a2a;color:#888;font-family:Outfit,sans-serif;font-size:13px;cursor:pointer">Cancelar</button>
    </div>
  </div>`
}

function getChecklist(s){
  const def = {guion:false,imagenes:false,grabado:false,editado:false,thumbnail:false,publicado:false}
  if(!s.checklist) return def
  return {...def, ...s.checklist}
}

function checklistDone(cl){
  return ['guion','imagenes','grabado','editado','thumbnail','publicado'].filter(k => cl[k]).length
}

function renderChecklistBar(cl){
  const done  = checklistDone(cl)
  const keys  = ['guion','imagenes','grabado','editado','thumbnail','publicado']
  const barC  = done === 0 ? 'var(--text-muted)' : done < 6 ? '#EF9F27' : '#5DCAA5'
  const segs  = keys.map(k => cl[k] ? '██' : '░░').join('')
  return `<div style="margin-top:5px;font-size:10px;color:${barC};font-family:monospace;letter-spacing:0">${done}/6 ${segs}</div>`
}

async function toggleChecklist(scriptId, key, value){
  const script = allScripts.find(s => s.id === scriptId)
  if(!script) return
  const cl = getChecklist(script)
  cl[key] = value
  const updates = { checklist: cl }
  const ORDER = ['borrador','en_progreso','listo_grabar','grabado','publicado']
  const autoMap = { guion:'en_progreso', grabado:'grabado', publicado:'publicado' }
  if(value && autoMap[key]){
    const curIdx = ORDER.indexOf(script.status || 'borrador')
    const newIdx = ORDER.indexOf(autoMap[key])
    if(newIdx > curIdx) updates.status = autoMap[key]
  }
  const { error } = await SB_P.from('scripts').update(updates).eq('id', scriptId)
  if(error){ showToast('❌ ' + error.message); return }
  allScripts = allScripts.map(s => s.id === scriptId ? {...s, ...updates} : s)
  renderScripts()
  loadProyectoDia()
}

async function deleteScript(scriptId){
  if(!confirm('¿Eliminar este guión?')) return
  await ensureSBI()
  const { error } = await SB_P.from('scripts').delete().eq('id', scriptId)
  if(error){ showToast('❌ Error: ' + error.message); return }
  allScripts = allScripts.filter(s => s.id !== scriptId)
  activeScriptId = null
  renderScripts()
  showToast('🗑️ Guión eliminado')
}

function openNewScript(){
  document.getElementById('sc-title').value = ''
  document.getElementById('sc-canal').value = 'iarcania'
  document.getElementById('sc-status').value = 'borrador'
  openModal('script')
}

async function saveNewScript(){
  const title = document.getElementById('sc-title').value.trim()
  if(!title) return
  await ensureSBI()
  const id = 'scr_'+Date.now()
  const { error } = await SB_P.from('scripts').insert({
    id, title,
    canal: document.getElementById('sc-canal').value,
    status: document.getElementById('sc-status').value
  })
  if(error){ showToast('❌ Error: ' + error.message); return }
  closeModal('script')
  await loadScripts()
  activeScriptId = id
  renderScripts()
}

function openAIScriptModal(){
  document.getElementById('ai-idea').value = ''
  document.getElementById('ai-canal').value = 'iarcania'
  document.getElementById('ai-formato').value = 'Video largo'
  document.getElementById('ai-loading').style.display = 'none'
  document.getElementById('ai-generate-btn').disabled = false
  openModal('ai-script')
}

let _presHtml = ''
let _presFilename = ''

function openPresentacionModal(tipo, scriptId){
  const isGuion = tipo !== 'propuesta'
  document.getElementById('pres-title').textContent = isGuion ? '🎨 Generar presentación de guión' : '📄 Generar propuesta comercial'
  document.getElementById('pres-form-guion').style.display = isGuion ? '' : 'none'
  document.getElementById('pres-form-propuesta').style.display = isGuion ? 'none' : ''
  document.getElementById('pres-loading').style.display = 'none'
  document.getElementById('pres-result').style.display = 'none'
  document.getElementById('pres-generate-btn').disabled = false
  document.getElementById('pres-generate-btn').style.display = ''
  document.getElementById('pres-generate-btn').dataset.tipo = tipo
  _presHtml = ''
  if(isGuion){
    // Si viene de un guion específico, pre-rellenar con su contenido
    const script = scriptId ? allScripts.find(s => s.id === scriptId) : null
    if(script){
      // Construir la idea combinando título + hook para dar contexto a la IA
      const idea = [script.title, script.hook].filter(Boolean).join('\n\n')
      document.getElementById('pres-idea').value = idea
      document.getElementById('pres-canal').value = script.canal || 'iarcania'
    } else {
      document.getElementById('pres-idea').value = ''
      document.getElementById('pres-canal').value = 'iarcania'
    }
  } else {
    ;['nombre','empresa','problema','solucion','precio','pago'].forEach(f => document.getElementById('pres-cli-'+f).value = '')
  }
  openModal('presentacion')
}

function presPreview(){
  if(!_presHtml) return
  const blob = new Blob([_presHtml], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function presDownload(){
  if(!_presHtml) return
  const blob = new Blob([_presHtml], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = _presFilename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function generarPresentacion(){
  const tipo = document.getElementById('pres-generate-btn').dataset.tipo
  let body = { tipo }

  if(tipo === 'guion'){
    const idea = document.getElementById('pres-idea').value.trim()
    if(!idea){ showToast('❌ Escribe el tema primero'); return }
    body.idea = idea
    body.canal = document.getElementById('pres-canal').value
    body.formato = document.getElementById('pres-formato').value
    const mb = allBrands.find(b => b.nombre === body.canal) || allBrands.find(b => b.nombre === 'iarcania') || {}
    body.brandColores = mb.colores || null
    body.brandConfig  = mb.config  || null
  } else {
    const nombre = document.getElementById('pres-cli-nombre').value.trim()
    const problema = document.getElementById('pres-cli-problema').value.trim()
    const solucion = document.getElementById('pres-cli-solucion').value.trim()
    const precio = document.getElementById('pres-cli-precio').value.trim()
    if(!nombre || !problema || !solucion || !precio){ showToast('❌ Completa los campos obligatorios (*)'); return }
    body.cliente = {
      nombre, precio,
      empresa: document.getElementById('pres-cli-empresa').value.trim(),
      problema, solucion,
      pago: document.getElementById('pres-cli-pago').value.trim() || '50% inicio / 50% entrega',
      fundadora: document.getElementById('pres-cli-fundadora').checked
    }
  }

  document.getElementById('pres-loading').style.display = 'block'
  document.getElementById('pres-generate-btn').disabled = true

  try {
    const r = await fetch('/api/generar-presentacion', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
    const data = await r.json()
    if(!r.ok) throw new Error(data.error || 'Error del servidor')

    _presHtml = data.html
    _presFilename = tipo === 'propuesta'
      ? `propuesta-${(body.cliente?.nombre||'cliente').toLowerCase().replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.html`
      : `guion-${(body.canal||'iarcania')}-${new Date().toISOString().slice(0,10)}.html`

    document.getElementById('pres-loading').style.display = 'none'
    document.getElementById('pres-generate-btn').style.display = 'none'
    document.getElementById('pres-result').style.display = 'flex'
    showToast('✨ Presentación lista — descarga o abre en nueva pestaña')
  } catch(e){
    showToast('❌ Error: ' + (e.message || 'Error desconocido'))
  }

  document.getElementById('pres-generate-btn').disabled = false
}

// ── Presentación inline (dentro del tab del guion) ────────────
// vista: null = ambas, 'presentador' = solo lectura, 'audiencia' = solo navegable
async function generarPresentacionInline(scriptId, vista = null){
  const s = allScripts.find(x => x.id === scriptId)
  if(!s){ showToast('❌ Guión no encontrado'); return }
  const idea    = [s.title, s.hook, s.body, s.cta].filter(Boolean).join('\n\n')
  const canal   = document.getElementById('pres-inline-canal-'+scriptId)?.value || s.canal || 'iarcania'
  const formato = document.getElementById('pres-inline-formato-'+scriptId)?.value || 'largo'
  if(!idea.trim()){ showToast('❌ El guión no tiene contenido aún'); return }

  const btn  = document.getElementById('pres-inline-btn-'+scriptId)
  const load = document.getElementById('pres-inline-load-'+scriptId)
  const loadTxt = document.getElementById('pres-inline-load-txt-'+scriptId)
  const spinnerMsg = vista === 'presentador' ? 'Regenerando vista presentador...'
                   : vista === 'audiencia'   ? 'Regenerando vista audiencia...'
                   : 'Generando ambas presentaciones...'
  if(btn)  { btn.disabled = true; btn.textContent = 'Generando...' }
  if(load) load.style.display = 'flex'
  if(loadTxt) loadTxt.textContent = spinnerMsg

  // Normaliza 'voidstoic' → 'void_stoic' para matchear b.nombre en la tabla brands
  const canalNorm = canal.toLowerCase().replace(/[\s_-]+/g,'') === 'voidstoic' ? 'void_stoic' : canal
  const brand = allBrands.find(b => (b.nombre||'') === canalNorm) || allBrands.find(b => b.nombre === 'iarcania') || {}
  console.log('[brand-debug] canal=%s | canalNorm=%s | brand.nombre=%s | colores=%s',
    canal, canalNorm, brand.nombre, JSON.stringify(brand.colores))
  const callAPI = (tipo) => fetch('/api/generar-presentacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, idea, canal, formato, brandColores: brand.colores || null, brandConfig: brand.config || null })
  }).then(r => r.json().then(d => { if(!r.ok) throw new Error(d.error || 'Error del servidor'); return d }))

  try {
    const ts = new Date().toISOString().slice(0,10)
    // Base: preservar pres_data existente para no perder la vista que no se regenera
    const existing = _scriptGen[scriptId] || s.pres_data || {}
    let presData = { ...existing, generado_en: new Date().toISOString() }

    if(vista === 'presentador'){
      const data = await callAPI('guion')
      presData.presentador = { html: data.html, filename: `presentador-${canal}-${ts}.html` }
    } else if(vista === 'audiencia'){
      const data = await callAPI('audiencia')
      presData.audiencia = { html: data.html, filename: `audiencia-${canal}-${ts}.html` }
    } else {
      const [dataPres, dataAud] = await Promise.all([callAPI('guion'), callAPI('audiencia')])
      presData.presentador = { html: dataPres.html, filename: `presentador-${canal}-${ts}.html` }
      presData.audiencia   = { html: dataAud.html,  filename: `audiencia-${canal}-${ts}.html`   }
    }

    _scriptGen[scriptId] = presData
    await SB_P.from('scripts').update({ pres_data: presData }).eq('id', scriptId)
    const sc = allScripts.find(x => x.id === scriptId)
    if(sc) sc.pres_data = presData
    const toastMsg = vista === 'presentador' ? '✨ Vista presentador regenerada'
                   : vista === 'audiencia'   ? '✨ Vista audiencia regenerada'
                   : '✨ Ambas presentaciones listas'
    showToast(toastMsg)
    renderScripts()
  } catch(e){
    showToast('❌ Error: ' + (e.message || 'Error desconocido'))
    if(btn) { btn.disabled = false; btn.textContent = '🎨 Generar presentaciones' }
    if(load) load.style.display = 'none'
  }
}

function presInlineVer(scriptId, vista){
  const gen = _scriptGen[scriptId]?.[vista]
  if(!gen) return
  const blob = new Blob([gen.html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function presInlineDescargar(scriptId, vista){
  const gen = _scriptGen[scriptId]?.[vista]
  if(!gen) return
  const blob = new Blob([gen.html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = gen.filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function generateScriptWithAI(){
  const idea = document.getElementById('ai-idea').value.trim()
  if(!idea){ showToast('❌ Escribe una idea primero'); return }
  const canal = document.getElementById('ai-canal').value
  const formato = document.getElementById('ai-formato').value

  document.getElementById('ai-loading').style.display = 'block'
  document.getElementById('ai-generate-btn').disabled = true

  let guion = null
  try {
    const response = await fetch('/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, canal, formato })
    })
    guion = await response.json()
    if(!response.ok) throw new Error(guion.error || 'Error del servidor')
  } catch(e) {
    showToast('❌ Error al generar: ' + (e.message || 'Error desconocido'))
  }

  document.getElementById('ai-loading').style.display = 'none'
  document.getElementById('ai-generate-btn').disabled = false

  if(!guion){ return }

  closeModal('ai-script')
  const id = 'scr_'+Date.now()
  const { error } = await SB_P.from('scripts').insert({
    id,
    title:  guion.titulo || idea,
    canal,
    status: 'borrador',
    hook:   guion.hook  || '',
    body:   guion.body  || '',
    cta:    guion.cta   || '',
    notes:  guion.notas || ''
  })
  if(error){ showToast('❌ Error al guardar: ' + error.message); return }
  await loadScripts()
  activeScriptId = id
  renderScripts()
  showSection('guiones', document.querySelector('.nav-item[onclick*="guiones"]'))
  showToast('✨ Guión generado y listo para revisar')
}

// --- CLIENTS ---
async function loadClients(){
  const { data } = await SB_I.from('clients').select('*').order('created_at',{ascending:false})
  allClients = data||[]
  const sel = document.getElementById('p-client')
  sel.innerHTML = '<option value="">Seleccionar cliente...</option>' +
    allClients.map(c=>`<option value="${c.id}">${c.name} — ${c.business||''}</option>`).join('')
}

function renderClients(){
  const el = document.getElementById('client-list')
  if(!allClients.length){ el.innerHTML='<div class="empty-state"><div class="empty-icon">◆</div>Sin clientes todavía — cierra tu primer deal 🎯</div>'; return }
  el.innerHTML = allClients.map(c=>`
    <div class="client-card">
      <div class="client-avatar">${c.name.charAt(0)}</div>
      <div class="client-info">
        <div class="client-name">${c.name}</div>
        <div class="client-biz">${c.business||''} · ${c.service||''}</div>
      </div>
      <div style="text-align:right">
        <div class="client-amount">$${c.monthly_amount||0}/mes</div>
        <span class="client-status status-${c.status||'activo'}">${c.status||'activo'}</span>
      </div>
    </div>`).join('')
}

// --- CLIENTES DASHBOARD (SB_P) ---
let allClientsP = []
let allProjectsP = []
let allPaymentsP = []
let allInvoicesP = []

async function loadClientesDashboard(){
  if(!USER_ID) return
  const el = document.getElementById('client-list')
  if(!el) return

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth()+1).padStart(2,'0')
  const monthStart = `${y}-${m}-01`
  const monthEnd   = `${y}-${m}-31`

  try {
    const [r1, r2, r3, r4] = await Promise.all([
      SB_P.from('clients').select('*').eq('user_id', USER_ID).order('created_at',{ascending:false}),
      SB_P.from('projects').select('*'),
      SB_P.from('payments').select('*').order('date',{ascending:false}),
      SB_P.from('invoices').select('*').order('due_date',{ascending:true})
    ])

    allClientsP  = r1.data || []
    allProjectsP = r2.data || []
    allPaymentsP = r3.data || []
    allInvoicesP = r4.data || []
  } catch(err){
    console.error('loadClientesDashboard error:', err)
    allClientsP = []; allProjectsP = []; allPaymentsP = []; allInvoicesP = []
  }

  const cobrado = allPaymentsP
    .filter(p => p.status === 'pagado' && p.paid_date >= monthStart && p.paid_date <= monthEnd)
    .reduce((a, p) => a + (p.amount || 0), 0)

  const pendiente = allInvoicesP
    .filter(i => i.status === 'pendiente' || i.status === 'vencido')
    .reduce((a, i) => a + (i.amount || 0), 0)

  const summaryEl = document.getElementById('cli-summary')
  if(summaryEl){
    summaryEl.style.display = allClientsP.length ? 'grid' : 'none'
    if(allClientsP.length){
      document.getElementById('cli-cobrado').textContent  = '$'+cobrado.toLocaleString('es-CO')
      document.getElementById('cli-pendiente').textContent = '$'+pendiente.toLocaleString('es-CO')
    }
  }

  renderClientesDashboard()
}

function renderClientesDashboard(){
  const el = document.getElementById('client-list')
  if(!el) return
  if(!allClientsP.length){
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">◆</div>Sin clientes todavía — cierra tu primer deal 🎯</div>'
    return
  }

  const statusColors = { activo:'var(--green)', inactivo:'var(--text-muted)', pausado:'var(--amber)' }
  const statusBg     = { activo:'rgba(93,202,165,0.1)', inactivo:'rgba(85,80,80,0.2)', pausado:'rgba(239,159,39,0.1)' }

  el.innerHTML = allClientsP.map(c => {
    const st = c.status || 'activo'
    const proyecto   = allProjectsP.find(p => p.client_id === c.id && p.status === 'activo')
    const totalPag   = allPaymentsP.filter(p => p.client_id === c.id && p.status === 'pagado').reduce((a,p)=>a+(p.amount||0),0)
    const invPend    = allInvoicesP.filter(i => i.client_id === c.id && (i.status === 'pendiente' || i.status === 'vencido'))
    const totalPend  = invPend.reduce((a,i)=>a+(i.amount||0),0)

    const pagoRows = allPaymentsP.filter(p => p.client_id === c.id).slice(0,8)
    const histHTML = pagoRows.length
      ? pagoRows.map(p => {
          const cls = p.status==='pagado'?'badge-paid':p.status==='vencido'?'badge-overdue':'badge-pending'
          const fecha = p.paid_date||p.due_date||'—'
          return `<div class="cli-hist-row">
            <span class="cli-hist-date">${fecha}</span>
            <span class="cli-hist-desc">${p.notes||'—'}</span>
            <span class="cli-hist-amount">$${(p.amount||0).toLocaleString('es-CO')}</span>
            <span class="payment-badge ${cls}">${p.status}</span>
          </div>`
        }).join('')
      : '<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin pagos registrados</div>'

    const invHTML = invPend.slice(0,8).length
      ? invPend.slice(0,8).map(i => {
          const cls = i.status==='vencido'?'badge-overdue':'badge-pending'
          return `<div class="cli-hist-row">
            <span class="cli-hist-date">${i.due_date||'—'}</span>
            <span class="cli-hist-desc">${i.description||'—'}</span>
            <span class="cli-hist-amount">$${(i.amount||0).toLocaleString('es-CO')}</span>
            <span class="payment-badge ${cls}">${i.status}</span>
          </div>`
        }).join('')
      : '<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin invoices pendientes 🎉</div>'

    return `<div class="cli-card2" id="clicard-${c.id}">
      <div class="cli-card2-head">
        <div class="client-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="cli-card2-meta">
          <div class="cli-card2-row1">
            <span class="cli-card2-name">${c.name}</span>
            <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${statusBg[st]||statusBg.activo};color:${statusColors[st]||statusColors.activo}">${st}</span>
          </div>
          <div class="cli-card2-biz">${[c.business,c.service].filter(Boolean).join(' · ')||'—'}</div>
          ${proyecto?`<div class="cli-card2-project">📁 ${proyecto.name}</div>`:''}
          <div class="cli-card2-nums">
            <span style="color:var(--green)">✅ $${totalPag.toLocaleString('es-CO')} pagado</span>
            ${totalPend>0?`<span style="color:var(--amber)">⏳ $${totalPend.toLocaleString('es-CO')} pendiente</span>`:''}
          </div>
        </div>
        <button class="cli-card2-toggle" onclick="toggleClientAccordion('${c.id}')">Ver ▾</button>
      </div>
      <div class="cli-accordion" id="cliaccordion-${c.id}">
        <div class="cli-acc-section">
          <div class="cli-acc-title">Historial de pagos</div>
          ${histHTML}
        </div>
        <div class="cli-acc-section">
          <div class="cli-acc-title">Invoices pendientes</div>
          ${invHTML}
        </div>
      </div>
    </div>`
  }).join('')
}

function toggleClientAccordion(id){
  const acc = document.getElementById('cliaccordion-'+id)
  if(!acc) return
  const btn = document.querySelector(`#clicard-${id} .cli-card2-toggle`)
  const isOpen = acc.classList.toggle('open')
  if(btn) btn.textContent = isOpen ? 'Cerrar ▴' : 'Ver ▾'
}

async function saveClient(){
  const name = document.getElementById('c-name').value.trim()
  if(!name) return
  await SB_I.from('clients').insert({
    id:'cli_'+Date.now(), name,
    business: document.getElementById('c-biz').value,
    whatsapp: document.getElementById('c-wa').value,
    email: document.getElementById('c-email').value,
    service: document.getElementById('c-service').value,
    monthly_amount: parseFloat(document.getElementById('c-amount').value)||0,
    start_date: new Date().toISOString().split('T')[0],
    status:'activo'
  })
  closeModal('client')
  await loadClients()
  await loadClientesDashboard()
}

// --- PAYMENTS ---
async function loadPayments(){
  const { data } = await SB_I.from('payments').select('*').order('due_date',{ascending:false})
  renderPayments(data||[])
}

function renderPayments(payments){
  const el = document.getElementById('payment-list')
  if(!payments.length){ el.innerHTML='<div class="empty-state"><div class="empty-icon">◐</div>No hay cobros registrados todavía</div>'; return }
  const pending = payments.filter(p=>p.status==='pendiente').reduce((a,p)=>a+(p.amount||0),0)
  const summary = document.getElementById('cobros-summary')
  if(pending>0){
    summary.style.display='flex'
    document.getElementById('cobros-total').textContent=`$${pending.toFixed(0)} USD por cobrar`
  }
  el.innerHTML = payments.map(p=>{
    const client = allClients.find(c=>c.id===p.client_id)
    const cls = p.status==='pagado'?'paid':p.status==='vencido'?'overdue':'pending'
    const badgeCls = p.status==='pagado'?'badge-paid':p.status==='vencido'?'badge-overdue':'badge-pending'
    return `<div class="payment-row">
      <div class="payment-info">
        <div class="payment-title">${client?client.name:'Cliente'}</div>
        <div class="payment-date">Vence: ${p.due_date||'—'}${p.paid_date?` · Pagado: ${p.paid_date}`:''}</div>
      </div>
      <div class="payment-amount ${cls}">$${p.amount||0}</div>
      <span class="payment-badge ${badgeCls}">${p.status}</span>
    </div>`
  }).join('')
}

async function savePayment(){
  const client_id = document.getElementById('p-client').value
  if(!client_id) return
  await SB_I.from('payments').insert({
    id:'pay_'+Date.now(), client_id,
    amount: parseFloat(document.getElementById('p-amount').value)||0,
    status: document.getElementById('p-status').value,
    due_date: document.getElementById('p-due').value||null,
    paid_date: document.getElementById('p-paid').value||null,
    notes: document.getElementById('p-notes').value
  })
  closeModal('payment')
  await loadPayments()
}

// --- TASK ORDER & DRAG AND DROP ---
function getTaskOrder(){ return JSON.parse(localStorage.getItem('tasks_order') || 'null') }
function saveTaskOrder(ids){ localStorage.setItem('tasks_order', JSON.stringify(ids)) }
function applyTaskOrder(tasks){
  const order = getTaskOrder()
  if(!order || !order.length) return tasks
  return [...tasks].sort((a, b) => {
    const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
    if(ai === -1 && bi === -1) return 0
    if(ai === -1) return 1
    if(bi === -1) return -1
    return ai - bi
  })
}

let dragTaskId = null

function onTaskDragStart(e, id){
  dragTaskId = id
  e.dataTransfer.effectAllowed = 'move'
  setTimeout(() => { const el = document.querySelector(`[data-id="${id}"]`); if(el) el.style.opacity = '0.4' }, 0)
}
function onTaskDragOver(e){
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  e.currentTarget.classList.add('drag-over')
}
function onTaskDragLeave(e){ e.currentTarget.classList.remove('drag-over') }
function onTaskDragEnd(e){
  e.target.style.opacity = ''
  document.querySelectorAll('.task-item.drag-over').forEach(el => el.classList.remove('drag-over'))
  dragTaskId = null
}
function onTaskDrop(e, targetId, elId){
  e.preventDefault()
  document.querySelectorAll('.task-item.drag-over').forEach(el => el.classList.remove('drag-over'))
  if(!dragTaskId || dragTaskId === targetId) return
  const listEl = document.getElementById(elId)
  const currentIds = [...listEl.querySelectorAll('[data-id]')].map(el => el.dataset.id)
  const dragIdx = currentIds.indexOf(dragTaskId)
  const targetIdx = currentIds.indexOf(targetId)
  if(dragIdx === -1 || targetIdx === -1) return
  currentIds.splice(dragIdx, 1)
  currentIds.splice(targetIdx, 0, dragTaskId)
  saveTaskOrder(currentIds)
  renderTasks()
}

// --- FACTURAS ---
let allBills = []
let allCitas = []
let allBillPayments = []
let _pagarBillId = null
let allServiciosExpenses = []
let allMercadoExpenses = []
let allBillPaymentsHistory = []

async function loadFacturas(){
  const { data: bills } = await SB_P.from('bills').select('*').eq('user_id', USER_ID).eq('is_active', true).order('due_day')
  allBills = bills || []
  const monthStart = TODAY.slice(0,7)+'-01'
  const lastDay = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()
  const monthEnd = TODAY.slice(0,7)+'-'+String(lastDay).padStart(2,'0')
  const { data: payments } = await SB_P.from('bill_payments').select('*').gte('paid_date', monthStart).lte('paid_date', monthEnd)
  allBillPayments = payments || []
  const since   = new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().slice(0,10)
  const since12 = new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString().slice(0,10)
  const [{ data: svc }, { data: mkt }, { data: payhist }] = await Promise.all([
    SB_P.from('expenses').select('*').eq('user_id', USER_ID).eq('category', 'servicios').gte('date', since).order('date', { ascending: false }),
    SB_P.from('expenses').select('*').eq('user_id', USER_ID).eq('category', 'mercado').gte('date', since).order('date', { ascending: false }),
    SB_P.from('bill_payments').select('*').gte('paid_date', since12).order('paid_date', { ascending: false }),
  ])
  allServiciosExpenses = svc || []
  allMercadoExpenses = mkt || []
  allBillPaymentsHistory = payhist || []
  renderFacturasAlert()
  renderFacturas()
}

function renderFacturasAlert(){ renderFacturasWidget() }

function renderFacturasWidget(){
  const el = document.getElementById('facturas-widget')
  if(!el) return
  const todayDay = parseInt(TODAY.split('-')[2])
  const paidIds = new Set(allBillPayments.map(p => p.bill_id))
  const fmt = n => '$' + Number(n||0).toLocaleString('es-CO')

  const overdue  = allBills.filter(b => b.due_day < todayDay  && !paidIds.has(b.id))
  const upcoming = allBills.filter(b => b.due_day >= todayDay && b.due_day <= todayDay+7 && !paidIds.has(b.id))
  const paid     = allBills.filter(b => paidIds.has(b.id))
  const pending  = allBills.filter(b => b.due_day >= todayDay && !paidIds.has(b.id))

  const isOpen = JSON.parse(localStorage.getItem('facturas_widget_open') || 'true')

  const totalPendiente = [...overdue, ...pending].reduce((s,b) => s + (b.estimated_amount||0), 0)
  const totalPagado    = paid.reduce((s,b) => s + (b.estimated_amount||0), 0)

  // Avisos en próximas fechas widget para las próximas 7 días
  upcoming.forEach(b => {
    const days = b.due_day - todayDay
    const key = 'bill_'+b.id
    const dismissed = JSON.parse(localStorage.getItem('pfw_dismissed_' + TODAY) || '[]')
    if(!dismissed.includes(key)){
      // Se integran al próximas fechas widget via renderProximasFechas
    }
  })

  el.innerHTML = `
    <div class="pfw-banner" onclick="facturasWidgetToggle(this)" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">🧾</span>
        <span style="font-size:12px;font-weight:600;color:#C4A35A;flex:1">
          Facturas del mes
          ${overdue.length ? `<span style="margin-left:6px;background:var(--red);color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;animation:pulse-red 1.5s infinite">${overdue.length} vencida${overdue.length!==1?'s':''}</span>` : ''}
        </span>
        <span style="font-size:11px;color:var(--text-muted)">${fmt(totalPagado)} pagado · ${fmt(totalPendiente)} pendiente</span>
        <span class="pfw-arrow" style="font-size:10px;color:var(--text-muted);transition:transform .2s;display:inline-block;margin-left:8px;${isOpen?'':'transform:rotate(-90deg)'}">▼</span>
      </div>
      <div class="pfw-detail" style="display:${isOpen?'block':'none'};margin-top:10px;padding-top:10px;border-top:1px solid rgba(196,163,90,0.15)">
        ${allBills.sort((a,b)=>a.due_day-b.due_day).map(b => {
          const isPaid = paidIds.has(b.id)
          const isOverdue = !isPaid && b.due_day < todayDay
          const statusColor = isPaid ? '#4ade80' : isOverdue ? 'var(--red)' : 'var(--text-muted)'
          const statusLabel = isPaid ? '✓ Pagada' : isOverdue ? '⚠ Vencida' : `Vence día ${b.due_day}`
          return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:${isPaid?'var(--text-muted)':isOverdue?'var(--red)':'var(--text)'};${isPaid?'text-decoration:line-through':''}">${b.name}</div>
              <div style="font-size:10px;color:${statusColor};margin-top:1px">${statusLabel}</div>
            </div>
            <div style="font-size:12px;color:var(--text-muted);flex-shrink:0">${fmt(b.estimated_amount)}</div>
            ${!isPaid ? `<button onclick="marcarFacturaPagada('${b.id}',${b.estimated_amount||0},event)" style="font-size:10px;padding:3px 8px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:6px;color:#4ade80;cursor:pointer;font-family:'Outfit',sans-serif;white-space:nowrap">✓ Pagar</button>` : ''}
          </div>`
        }).join('')}
      </div>
    </div>
  `
}

function facturasWidgetToggle(el){
  const detail = el.querySelector('.pfw-detail')
  const arrow  = el.querySelector('.pfw-arrow')
  if(!detail) return
  const open = detail.style.display !== 'none'
  detail.style.display = open ? 'none' : 'block'
  arrow.style.transform = open ? 'rotate(-90deg)' : ''
  localStorage.setItem('facturas_widget_open', JSON.stringify(!open))
}

function abrirPagarFactura(billId, estimado, e){
  e.stopPropagation()
  const bill = allBills.find(b => b.id === billId)
  if(!bill) return
  const fmt = n => '$' + Number(n||0).toLocaleString('es-CO')
  const html = `<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center" id="pagar-overlay" onclick="if(event.target===this)this.remove()">
    <div style="background:#111;border:1px solid var(--border);border-radius:12px;padding:20px;width:320px;max-width:90vw">
      <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">${bill.name}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px">Estimado: ${fmt(estimado)}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Monto real pagado</div>
      <input type="number" id="pagar-monto" value="${estimado||''}" placeholder="0" style="width:100%;background:#0C0C0C;border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:14px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box;margin-bottom:12px">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Fecha de pago</div>
      <input type="date" id="pagar-fecha" value="${TODAY}" style="width:100%;background:#0C0C0C;border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;font-family:'Outfit',sans-serif;outline:none;box-sizing:border-box;margin-bottom:16px;color-scheme:dark">
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('pagar-overlay').remove()" style="flex:1;padding:10px;background:transparent;border:1px solid var(--border);border-radius:8px;color:var(--text-muted);cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px">Cancelar</button>
        <button onclick="confirmarPagoFactura('${billId}',event)" style="flex:1;padding:10px;background:#4ade80;border:none;border-radius:8px;color:#000;cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px;font-weight:600">✓ Confirmar</button>
      </div>
    </div>
  </div>`
  document.body.insertAdjacentHTML('beforeend', html)
  document.getElementById('pagar-monto').focus()
  document.getElementById('pagar-monto').select()
}

async function confirmarPagoFactura(billId, e){
  e.stopPropagation()
  const monto = parseFloat(document.getElementById('pagar-monto').value)
  const fecha = document.getElementById('pagar-fecha').value
  if(!monto || !fecha){ showToast('Ingresa el monto y la fecha'); return }
  document.getElementById('pagar-overlay').remove()
  const { error } = await SB_P.from('bill_payments').insert({
    id: 'pay_'+Date.now(),
    bill_id: billId,
    amount: monto,
    paid_date: fecha,
    notes: null
  })
  if(error){ showToast('❌ Error al guardar'); return }
  await loadFacturas()
  showToast('✓ Factura pagada')
}

async function marcarFacturaPagada(billId, amount, e){
  e.stopPropagation()
  abrirPagarFactura(billId, amount, e)
}

function renderFacturas(){
  const el = document.getElementById('facturas-list')
  if(!el) return
  const fmt = n => '$' + Number(n||0).toLocaleString('es-CO')
  const currentYM = TODAY.slice(0,7)
  const todayDay  = parseInt(TODAY.split('-')[2])

  // Pagos del mes actual
  const paidThisMonth = new Set(allBillPayments.map(p => p.bill_id))

  // Historial de pagos por bill
  const histByBill = {}
  allBillPaymentsHistory.forEach(p => {
    if(!histByBill[p.bill_id]) histByBill[p.bill_id] = []
    histByBill[p.bill_id].push(p)
  })

  // Grupos de categorías
  const CAT_CONFIG = {
    servicios:   { label:'🏠 Servicios del hogar', color:'rgba(196,163,90,0.15)' },
    salud:       { label:'💊 Salud',               color:'rgba(74,222,128,0.08)' },
    herramientas:{ label:'🔧 Herramientas',        color:'rgba(139,108,246,0.08)' },
    mercado:     { label:'🛒 Mercado y alimentación', color:'rgba(239,159,39,0.08)' },
    familia:     { label:'👨‍👩‍👧 Familia',             color:'rgba(139,108,246,0.08)' },
    deuda:       { label:'💳 Deudas y cuotas',     color:'rgba(226,75,74,0.08)' },
    transporte:  { label:'🚌 Transporte',          color:'rgba(93,202,165,0.08)' },
    hogar:       { label:'🏠 Hogar',               color:'rgba(196,163,90,0.08)' },
  }

  // Agrupar bills por categoría
  const grouped = {}
  allBills.forEach(b => {
    const cat = b.category || 'otros'
    if(!grouped[cat]) grouped[cat] = []
    grouped[cat].push(b)
  })

  const catOrder = ['servicios','hogar','salud','mercado','familia','deuda','transporte','herramientas']
  const cats = [...catOrder.filter(c => grouped[c]), ...Object.keys(grouped).filter(c => !catOrder.includes(c))]

  const renderBillRow = (bill, idx) => {
    const isPaid    = paidThisMonth.has(bill.id)
    const isOverdue = !isPaid && bill.due_day < todayDay
    const hist      = (histByBill[bill.id] || []).sort((a,b) => b.paid_date.localeCompare(a.paid_date))
    const lastPay   = hist[0]
    const key       = 'bf_'+idx

    const byMonth = {}
    hist.forEach(p => {
      const ym = p.paid_date.slice(0,7)
      byMonth[ym] = (byMonth[ym]||0) + Number(p.amount||0)
    })
    const months = Object.keys(byMonth).sort((a,b) => b.localeCompare(a))
    const vals   = months.map(ym => byMonth[ym])
    const dMax   = Math.max(...vals, 1)

    const histRows = months.slice(0,12).map(ym => {
      const [y,m] = ym.split('-')
      const label = new Date(Number(y),Number(m)-1,1).toLocaleDateString('es-CO',{month:'short',year:'numeric'})
      const val   = byMonth[ym]
      const barW  = Math.round((val/dMax)*100)
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
        <td style="padding:7px 14px;font-size:12px;color:var(--text-dim);white-space:nowrap">${label}</td>
        <td style="padding:7px 8px;width:100%"><div style="background:rgba(255,255,255,0.05);border-radius:3px;height:5px"><div style="width:${barW}%;height:100%;background:#C4A35A;border-radius:3px"></div></div></td>
        <td style="padding:7px 14px;font-size:12px;font-weight:600;color:var(--text);text-align:right;white-space:nowrap">${fmt(val)}</td>
      </tr>`
    }).join('')

    const statusColor = isPaid ? '#4ade80' : isOverdue ? 'var(--red)' : 'var(--text-muted)'
    const statusLabel = isPaid ? `✓ Pagada · ${fmt(lastPay?.amount)}` : isOverdue ? `⚠ Vencida (día ${bill.due_day})` : `Vence día ${bill.due_day}`

    return `<tr onclick="toggleSvcHistorial('${key}')" style="border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
      <td style="padding:14px 14px">
        <span id="chev-${key}" style="font-size:10px;color:var(--text-muted);margin-right:6px">▸</span>
        <span style="font-size:13px;font-weight:500;color:${isPaid?'var(--text-muted)':isOverdue?'var(--red)':'var(--text)'}${isPaid?';text-decoration:line-through':''}">${bill.name}</span>
        <div style="font-size:10px;color:${statusColor};margin-top:2px;margin-left:16px">${statusLabel}</div>
      </td>
      <td style="padding:14px 10px;font-size:13px;color:var(--text-muted);text-align:right;white-space:nowrap">${fmt(bill.estimated_amount)}</td>
      <td style="padding:14px 10px;text-align:right">
        ${!isPaid
          ? `<button onclick="abrirPagarFactura('${bill.id}',${bill.estimated_amount||0},event)" style="font-size:11px;padding:4px 10px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:6px;color:#4ade80;cursor:pointer;font-family:'Outfit',sans-serif;white-space:nowrap">✓ Pagar</button>`
          : `<span style="font-size:11px;color:#4ade80">✓</span>`
        }
      </td>
    </tr>
    <tr id="svc-hist-${key}" style="display:none">
      <td colspan="3" style="padding:0;background:rgba(0,0,0,0.25);border-bottom:1px solid rgba(255,255,255,0.06)">
        ${histRows
          ? `<table style="width:100%;border-collapse:collapse">${histRows}</table>`
          : `<div style="padding:10px 14px;font-size:12px;color:var(--text-muted)">Sin historial de pagos</div>`
        }
      </td>
    </tr>`
  }

  let html = ''
  cats.forEach(cat => {
    const bills = grouped[cat]
    const cfg   = CAT_CONFIG[cat] || { label: cat, color:'rgba(255,255,255,0.03)' }
    html += `<div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${cfg.label}</div>
      <div style="border:1px solid var(--border);border-radius:10px;background:var(--bg-card);overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="padding:8px 14px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:left">Factura</th>
            <th style="padding:8px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Estimado</th>
            <th></th>
          </tr></thead>
          <tbody>${bills.map((b,i) => renderBillRow(b, cat+'_'+i)).join('')}</tbody>
        </table>
      </div>
    </div>`
  })

  const subEl = document.getElementById('facturas-sub')
  if(subEl) subEl.textContent = `${allBills.length} facturas · ${allBills.filter(b=>paidThisMonth.has(b.id)).length} pagadas este mes`

  el.innerHTML = html || '<div style="padding:16px;color:var(--text-muted);font-size:13px">Sin facturas registradas.</div>'
}

function _renderFacturasLegacy(){
  const el = document.getElementById('facturas-list')
  if(!el) return
  const fmt = n => '$' + Number(n).toLocaleString('es-CO')
  const currentYM = TODAY.slice(0,7)

  // ── helpers ───────────────────────────────────────────────────────────────
  const SVC_ICONS = { acueducto:'💧', agua:'💧', luz:'💡', energia:'💡', epm:'⚡', gas:'🔥', internet:'📡', wifi:'📡', claro:'📡', movistar:'📡', tv:'📺', netflix:'📺', spotify:'🎵' }
  const getIcon = name => {
    const lower = (name||'').toLowerCase()
    for(const [k,v] of Object.entries(SVC_ICONS)) if(lower.includes(k)) return v
    return '⚡'
  }

  // ── SECCIÓN 1: SERVICIOS RECURRENTES (por servicio, accordion = meses) ───
  const svcByDesc = {}
  allServiciosExpenses.forEach(e => {
    if(!e.date || !e.description) return
    const desc = e.description.trim()
    if(!svcByDesc[desc]) svcByDesc[desc] = []
    svcByDesc[desc].push(e)
  })

  // ── Servicios (expenses) rows ─────────────────────────────────────────────
  const svcDescs = Object.keys(svcByDesc).sort((a,b) => {
    const lastA = [...svcByDesc[a]].sort((x,y) => y.date.localeCompare(x.date))[0]?.date || ''
    const lastB = [...svcByDesc[b]].sort((x,y) => y.date.localeCompare(x.date))[0]?.date || ''
    return lastB.localeCompare(lastA)
  })
  const mkSvcAccordion = (key, byMonth, months, vals) => {
    const dMax = Math.max(...vals.slice(0, 12))
    const dAvg = vals.slice(0, 12).reduce((s,v) => s+v, 0) / (Math.min(vals.length, 12) || 1)
    return months.slice(0, 12).map(ym => {
      const [y, m] = ym.split('-')
      const mesLabel = new Date(Number(y), Number(m)-1, 1).toLocaleDateString('es-CO', { month:'short', year:'numeric' })
      const val    = byMonth[ym]
      const diffPc = dAvg > 0 ? ((val - dAvg) / dAvg * 100) : 0
      const barW   = dMax > 0 ? Math.round((val / dMax) * 100) : 0
      const barClr = diffPc > 8 ? '#E24B4A' : diffPc > -8 ? '#EF9F27' : '#5DCAA5'
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
        <td style="padding:8px 16px;font-size:12px;color:var(--text-dim);white-space:nowrap">${mesLabel}</td>
        <td style="padding:8px 8px;width:100%">
          <div style="background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;height:6px;min-width:60px">
            <div style="width:${barW}%;height:100%;background:${barClr};border-radius:3px"></div>
          </div>
        </td>
        <td style="padding:8px 16px;font-size:12px;font-weight:600;color:var(--text);text-align:right;white-space:nowrap">${fmt(Math.round(val))}</td>
      </tr>`
    }).join('')
  }
  const mkSvcRow = (key, icon, label, lastAmt, prom3, pctDiff, flecha, fColor, detailRows) =>
    `<tr onclick="toggleSvcHistorial('${key}')" style="border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer" onmouseover="this.style.background='rgba(255,255,255,0.035)'" onmouseout="this.style.background=''">
      <td style="padding:16px 16px;font-size:15px;font-weight:600;color:var(--text)">
        <span id="chev-${key}" style="font-size:11px;color:var(--text-muted);margin-right:7px;display:inline-block;width:9px">▸</span>${icon} ${label}
      </td>
      <td style="padding:16px 10px;font-size:15px;color:var(--text);text-align:right;white-space:nowrap">${fmt(Math.round(lastAmt))}</td>
      <td class="svc-col-prom" style="padding:16px 10px;font-size:15px;color:var(--text-dim);text-align:right;white-space:nowrap">${fmt(Math.round(prom3))}</td>
      <td style="padding:16px 10px;text-align:center">
        <span style="font-size:20px;color:${fColor};font-weight:700;line-height:1">${flecha}</span>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${pctDiff>0?'+':''}${Math.round(pctDiff)}%</div>
      </td>
    </tr>
    <tr id="svc-hist-${key}" style="display:none">
      <td colspan="4" style="padding:0;background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.07)">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
            <th style="padding:7px 16px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:left">Mes</th>
            <th></th>
            <th style="padding:7px 16px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Monto</th>
          </tr></thead>
          <tbody>${detailRows}</tbody>
        </table>
      </td>
    </tr>`

  const svcRows = svcDescs.map((desc, i) => {
    const byMonth = {}
    svcByDesc[desc].forEach(e => {
      const ym = e.date.slice(0,7)
      byMonth[ym] = (byMonth[ym] || 0) + Number(e.amount||0)
    })
    const months  = Object.keys(byMonth).sort((a,b) => b.localeCompare(a))
    const vals    = months.map(ym => byMonth[ym])
    const lastAmt = vals[0] || 0
    const w3      = vals.slice(0, 3)
    const prom3   = w3.reduce((s,v) => s+v, 0) / (w3.length || 1)
    const pctDiff = prom3 > 0 ? ((lastAmt - prom3) / prom3 * 100) : 0
    const flecha  = pctDiff > 5 ? '↑' : pctDiff < -5 ? '↓' : '→'
    const fColor  = pctDiff > 5 ? 'var(--red)' : pctDiff < -5 ? 'var(--green)' : 'var(--text-muted)'
    return mkSvcRow(`sv${i}`, getIcon(desc), desc, lastAmt, prom3, pctDiff, flecha, fColor,
      mkSvcAccordion(`sv${i}`, byMonth, months, vals))
  }).join('')

  // ── Bills (otras facturas) rows — historial desde bill_payments ───────────
  const BILL_CAT_ICON = { tecnologia:'💻', hogar:'🏠', salud:'💊', herramientas:'🔧', otros:'📦' }
  const otrosBillsTable = allBills.filter(b => b.category !== 'servicios')
  const billRows = otrosBillsTable.map((bill, bi) => {
    const bPays = allBillPaymentsHistory.filter(p => p.bill_id === bill.id)
      .slice().sort((a,b) => b.paid_date.localeCompare(a.paid_date))
    const icon = BILL_CAT_ICON[bill.category] || '📦'
    const key  = `bl${bi}`
    if(!bPays.length){
      return `<tr onclick="toggleSvcHistorial('${key}')" style="border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer" onmouseover="this.style.background='rgba(255,255,255,0.035)'" onmouseout="this.style.background=''">
        <td style="padding:16px 16px;font-size:15px;font-weight:600;color:var(--text)">
          <span id="chev-${key}" style="font-size:11px;color:var(--text-muted);margin-right:7px;display:inline-block;width:9px">▸</span>${icon} ${bill.name}
        </td>
        <td colspan="3" style="padding:16px 10px;font-size:13px;color:var(--text-muted)">Sin historial</td>
      </tr>
      <tr id="svc-hist-${key}" style="display:none">
        <td colspan="4" style="padding:12px 16px;font-size:13px;color:var(--text-muted);background:rgba(0,0,0,0.3)">Sin pagos registrados.</td>
      </tr>`
    }
    const byMonth = {}
    bPays.forEach(p => {
      const ym = p.paid_date.slice(0,7)
      byMonth[ym] = (byMonth[ym] || 0) + Number(p.amount||0)
    })
    const months  = Object.keys(byMonth).sort((a,b) => b.localeCompare(a))
    const vals    = months.map(ym => byMonth[ym])
    const lastAmt = vals[0] || 0
    const w3      = vals.slice(0, 3)
    const prom3   = w3.reduce((s,v) => s+v, 0) / (w3.length || 1)
    const pctDiff = prom3 > 0 ? ((lastAmt - prom3) / prom3 * 100) : 0
    const flecha  = pctDiff > 5 ? '↑' : pctDiff < -5 ? '↓' : '→'
    const fColor  = pctDiff > 5 ? 'var(--red)' : pctDiff < -5 ? 'var(--green)' : 'var(--text-muted)'
    return mkSvcRow(key, icon, bill.name, lastAmt, prom3, pctDiff, flecha, fColor,
      mkSvcAccordion(key, byMonth, months, vals))
  }).join('')

  let svcBody = ''
  if(!svcRows && !billRows){
    svcBody = '<div style="padding:12px 16px;font-size:13px;color:var(--text-muted)">Sin datos de servicios.</div>'
  } else {
    svcBody = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:380px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="padding:8px 16px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:left">Servicio</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Último</th>
        <th class="svc-col-prom" style="padding:8px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Prom. 3m</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:center">Tend.</th>
      </tr></thead>
      <tbody>${svcRows}${billRows}</tbody>
    </table></div>`
  }


  // ── SECCIÓN MERCADO (una fila, accordion = meses) ─────────────────────────
  const mercadoByMonth = {}
  allMercadoExpenses.forEach(e => {
    if(!e.date) return
    const ym = e.date.slice(0,7)
    if(!mercadoByMonth[ym]) mercadoByMonth[ym] = []
    mercadoByMonth[ym].push(e)
  })

  let mercadoBody = ''
  if(!Object.keys(mercadoByMonth).length){
    mercadoBody = '<div style="padding:12px 16px;font-size:13px;color:var(--text-muted)">Sin gastos en categoría "mercado" en los últimos 6 meses.</div>'
  } else {
    const mktMonths  = Object.keys(mercadoByMonth).sort((a,b) => b.localeCompare(a))
    const mktVals    = mktMonths.map(ym => mercadoByMonth[ym].reduce((s,e) => s + Number(e.amount||0), 0))
    const mktLast    = mktVals[0] || 0
    const mktW3      = mktVals.slice(0, 3)
    const mktProm3   = mktW3.reduce((s,v) => s+v, 0) / (mktW3.length || 1)
    const mktPct     = mktProm3 > 0 ? ((mktLast - mktProm3) / mktProm3 * 100) : 0
    const mktFlecha  = mktPct > 5 ? '↑' : mktPct < -5 ? '↓' : '→'
    const mktColor   = mktPct > 5 ? 'var(--red)' : mktPct < -5 ? 'var(--green)' : 'var(--text-muted)'
    const mktMax    = Math.max(...mktVals.slice(0, 12))
    const mktAvg12  = mktVals.slice(0, 12).reduce((s,v) => s+v, 0) / (Math.min(mktVals.length, 12) || 1)
    const mktDetail  = mktMonths.slice(0, 12).map((ym, i) => {
      const [y, m] = ym.split('-')
      const mesLabel = new Date(Number(y), Number(m)-1, 1).toLocaleDateString('es-CO', { month:'short', year:'numeric' })
      const val    = mktVals[i]
      const diffPc = mktAvg12 > 0 ? ((val - mktAvg12) / mktAvg12 * 100) : 0
      const barW   = mktMax > 0 ? Math.round((val / mktMax) * 100) : 0
      const barClr = diffPc > 8 ? '#E24B4A' : diffPc > -8 ? '#EF9F27' : '#5DCAA5'
      return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
        <td style="padding:8px 16px;font-size:12px;color:var(--text-dim);white-space:nowrap">${mesLabel}</td>
        <td style="padding:8px 8px;width:100%">
          <div style="background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;height:6px;min-width:60px">
            <div style="width:${barW}%;height:100%;background:${barClr};border-radius:3px"></div>
          </div>
        </td>
        <td style="padding:8px 16px;font-size:12px;font-weight:600;color:var(--text);text-align:right;white-space:nowrap">${fmt(Math.round(val))}</td>
      </tr>`
    }).join('')
    mercadoBody = `<div style="overflow-x:auto"><table class="mercado-tbl" style="width:100%;border-collapse:collapse;min-width:280px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="padding:8px 16px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:left">Categoría</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Último mes</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Prom. 3m</th>
        <th style="padding:8px 10px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:center">Tend.</th>
      </tr></thead>
      <tbody>
        <tr class="mercado-main-row" onclick="toggleSvcHistorial('mk0')" style="border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer" onmouseover="this.style.background='rgba(255,255,255,0.035)'" onmouseout="this.style.background=''">
          <td style="padding:16px 16px;font-size:15px;font-weight:600;color:var(--text)">
            <span id="chev-mk0" style="font-size:11px;color:var(--text-muted);margin-right:7px;display:inline-block;width:9px">▸</span>🛒 Mercado
          </td>
          <td style="padding:16px 10px;font-size:15px;color:var(--text);text-align:right;white-space:nowrap">${fmt(Math.round(mktLast))}</td>
          <td style="padding:16px 10px;font-size:15px;color:var(--text-dim);text-align:right;white-space:nowrap">${fmt(Math.round(mktProm3))}</td>
          <td style="padding:16px 10px;text-align:center">
            <span style="font-size:20px;color:${mktColor};font-weight:700;line-height:1">${mktFlecha}</span>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${mktPct>0?'+':''}${Math.round(mktPct)}%</div>
          </td>
        </tr>
        <tr id="svc-hist-mk0" style="display:none">
          <td colspan="4" style="padding:0;background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.07)">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
                <th style="padding:7px 16px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:left">Mes</th>
                <th></th>
                <th style="padding:7px 16px;font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Total</th>
              </tr></thead>
              <tbody>${mktDetail}</tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table></div>`
  }

  // ── sub label ─────────────────────────────────────────────────────────────
  const subEl = document.getElementById('facturas-sub')
  if(subEl){
    const totalSvc = Object.keys(svcByDesc).length + otrosBillsTable.length
    subEl.textContent = `${totalSvc} servicios · ${Object.keys(mercadoByMonth).length}m mercado`
  }

}

let _svcOpen = null
function toggleSvcHistorial(key){
  if(_svcOpen && _svcOpen !== key){
    const prevHist = document.getElementById('svc-hist-'+_svcOpen)
    const prevChev = document.getElementById('chev-'+_svcOpen)
    if(prevHist) prevHist.style.display = 'none'
    if(prevChev) prevChev.textContent = '▸'
  }
  const hist = document.getElementById('svc-hist-'+key)
  const chev = document.getElementById('chev-'+key)
  if(!hist) return
  const opening = hist.style.display === 'none'
  hist.style.display = opening ? 'block' : 'none'
  if(chev) chev.textContent = opening ? '▾' : '▸'
  _svcOpen = opening ? key : null
}

function abrirPagarServicio(desc){
  document.getElementById('g-amount').value = ''
  document.getElementById('g-desc').value = desc
  document.getElementById('g-cat').value = 'servicios'
  document.getElementById('g-date').value = TODAY
  openModal('gasto')
}

function abrirPagarFactura(billId){
  _pagarBillId = billId
  const bill = allBills.find(b => b.id === billId)
  if(!bill) return
  document.getElementById('pagar-factura-title').textContent = `Pagar: ${bill.name}`
  document.getElementById('pf-amount').value = bill.estimated_amount || ''
  document.getElementById('pf-date').value = TODAY
  document.getElementById('pf-notes').value = ''
  openModal('pagar-factura')
}

async function guardarPagoFactura(){
  const bill = allBills.find(b => b.id === _pagarBillId)
  if(!bill) return
  const amount    = Number(document.getElementById('pf-amount').value)
  const paid_date = document.getElementById('pf-date').value || TODAY
  const notes     = document.getElementById('pf-notes').value.trim()
  if(!amount){ showToast('❌ Ingresa el monto pagado'); return }

  const payId = 'bp_'+Date.now()
  const { error: e1 } = await SB_P.from('bill_payments').insert({
    id: payId, bill_id: _pagarBillId, amount, paid_date, notes,
    created_at: new Date().toISOString()
  })
  if(e1){ showToast('❌ '+e1.message); return }

  const catMap = { servicios:'servicios', tecnologia:'tecnologia', hogar:'hogar', salud:'salud', herramientas:'herramientas' }
  await SB_P.from('expenses').insert({
    id: 'exp_'+Date.now(), user_id: USER_ID, amount,
    category: catMap[bill.category] || 'otros',
    description: bill.name, date: paid_date,
    created_at: new Date().toISOString()
  })

  closeModal('pagar-factura')
  showToast(`✅ ${bill.name} marcada como pagada`)
  await loadFacturas()
}

async function guardarNuevaFactura(){
  const name             = document.getElementById('nf-name').value.trim()
  const estimated_amount = Number(document.getElementById('nf-amount').value) || null
  const due_day          = parseInt(document.getElementById('nf-day').value)
  const category         = document.getElementById('nf-cat').value
  if(!name){ showToast('❌ Ingresa el nombre de la factura'); return }
  if(!due_day || due_day < 1 || due_day > 28){ showToast('❌ El día debe ser entre 1 y 28'); return }
  const { error } = await SB_P.from('bills').insert({
    id: 'bill_'+Date.now(), user_id: USER_ID, name, estimated_amount,
    due_day, category, is_active: true,
    created_at: new Date().toISOString()
  })
  if(error){ showToast('❌ '+error.message); return }
  closeModal('nueva-factura')
  showToast('✅ Factura agregada')
  await loadFacturas()
}

// --- MODALS ---
function openModal(type){ document.getElementById('modal-'+type).classList.add('open') }
function closeModal(type){ document.getElementById('modal-'+type).classList.remove('open') }
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click', e=>{ if(e.target===m) m.classList.remove('open') })
})

// --- CHECK SESSION ---
;(async()=>{
  const { data } = await SB_P.auth.getSession()
  if(data.session){
    await loadCurrentUserSlug()
    if(!USER_ID){
      const errEl = document.getElementById('auth-error')
      errEl.textContent = 'Sesión inválida: usuario no registrado en el sistema. Inicia sesión nuevamente.'
      errEl.style.display = 'block'
      await SB_P.auth.signOut()
      return
    }
    const stored = sessionStorage.getItem('_up')
    if(stored) USER_PASSWORD = atob(stored)
    document.getElementById('auth-screen').style.display='none'
    document.getElementById('app').style.display='block'
    const sbiSess = await SB_I.auth.getSession()
    if(!sbiSess.data.session && USER_PASSWORD){
      await SB_I.auth.signInWithPassword({ email: data.session.user.email, password: USER_PASSWORD }).catch(()=>{})
    }
    initApp()
  }
})()

setDate()
updateClock()
setInterval(updateClock, 1000)

// --- FINANZAS ---
const ACCOUNTS_DEF = [
  { id:'acc_bolsillo',    name:'Bolsillo',    icon:'💵', color:'#5DCAA5' },
  { id:'acc_nequi',       name:'Nequi',       icon:'📱', color:'#E040FB' },
  { id:'acc_bancolombia', name:'Bancolombia', icon:'🏦', color:'#FFD700' },
]
let allAccounts = []

async function loadFinanzas(){
  const { data } = await SB_P.from('accounts').select('*').eq('user_id', USER_ID)
  allAccounts = data || []
  renderFinanzas()
}

function renderFinanzas(){
  const el = document.getElementById('finanzas-content')
  if(!el) return
  const fmt = n => '$' + Number(n).toLocaleString('es-CO')

  const getAcc = id => allAccounts.find(a => a.id === id)

  const totalSaldo = allAccounts.reduce((s, a) => s + Number(a.balance||0), 0)

  const cards = ACCOUNTS_DEF.map(def => {
    const acc = getAcc(def.id)
    const saldo = acc ? Number(acc.balance||0) : 0
    const color = def.color
    return `<div style="background:#0E0E0E;border:1px solid var(--border);border-radius:12px;padding:18px 20px;flex:1;min-width:200px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:22px">${def.icon}</span>
        <span style="font-size:14px;font-weight:600;color:var(--text)">${def.name}</span>
      </div>
      <div style="font-size:28px;font-weight:700;color:${color};font-family:'Playfair Display',serif;line-height:1;margin-bottom:16px">${fmt(saldo)}</div>
      <div style="display:flex;gap:8px">
        <button onclick="abrirMovimiento('${def.id}','ingreso')" style="flex:1;padding:7px 0;border-radius:7px;border:1px solid ${color}44;background:${color}11;color:${color};cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px;font-weight:600">+ Ingreso</button>
        <button onclick="abrirMovimiento('${def.id}','gasto')" style="flex:1;padding:7px 0;border-radius:7px;border:1px solid rgba(226,75,74,0.3);background:rgba(226,75,74,0.08);color:var(--red);cursor:pointer;font-family:'Outfit',sans-serif;font-size:12px;font-weight:600">− Gasto</button>
      </div>
    </div>`
  }).join('')

  el.innerHTML = `
    <div class="card" style="margin-bottom:20px;text-align:center">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Total en todas las cuentas</div>
      <div style="font-size:38px;font-weight:700;color:var(--text);font-family:'Playfair Display',serif">${fmt(totalSaldo)}</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:14px">${cards}</div>`
}

function abrirMovimiento(accountId, tipo){
  const def = ACCOUNTS_DEF.find(d => d.id === accountId)
  document.getElementById('mov-account-id').value = accountId
  document.getElementById('mov-tipo').value = tipo
  document.getElementById('mov-amount').value = ''
  document.getElementById('mov-desc').value = ''
  document.getElementById('mov-date').value = TODAY
  document.getElementById('mov-title').textContent = tipo === 'ingreso'
    ? `+ Ingreso — ${def?.name||''}`
    : `− Gasto — ${def?.name||''}`
  const btn = document.getElementById('mov-btn-save')
  btn.style.background = tipo === 'ingreso' ? 'rgba(93,202,165,0.15)' : 'rgba(226,75,74,0.15)'
  btn.style.color = tipo === 'ingreso' ? '#5DCAA5' : 'var(--red)'
  btn.style.borderColor = tipo === 'ingreso' ? '#5DCAA5' : 'var(--red)'
  document.getElementById('modal-movimiento').classList.add('open')
}

async function saveMovimiento(){
  const accountId  = document.getElementById('mov-account-id').value
  const tipo       = document.getElementById('mov-tipo').value
  const amount     = Number(document.getElementById('mov-amount').value)
  const description = document.getElementById('mov-desc').value.trim()
  const date       = document.getElementById('mov-date').value || TODAY
  if(!amount){ showToast('❌ Ingresa un monto'); return }

  const acc = allAccounts.find(a => a.id === accountId)
  if(!acc){ showToast('❌ Cuenta no encontrada'); return }
  const newBalance = Number(acc.balance||0) + (tipo === 'ingreso' ? amount : -amount)

  // Actualizar saldo
  const { error: errAcc } = await SB_P.from('accounts')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', accountId)
  if(errAcc){ showToast('❌ Error: '+errAcc.message); return }

  // Registrar movimiento en expenses o income
  const tabla = tipo === 'gasto' ? 'expenses' : 'income'
  const def = ACCOUNTS_DEF.find(d => d.id === accountId)
  const baseRecord = { id: tipo[0]+'_'+Date.now(), user_id: USER_ID, amount, description, date, created_at: new Date().toISOString() }
  if(tipo === 'gasto'){
    await SB_P.from('expenses').insert({ ...baseRecord, category: 'otros', notes: `cuenta:${def?.name||accountId}` })
  } else {
    await SB_P.from('income').insert({ ...baseRecord, source: def?.name||accountId })
  }

  // Actualizar memoria local
  acc.balance = newBalance
  closeModal('movimiento')
  showToast(tipo === 'ingreso' ? '✅ Ingreso registrado' : '✅ Gasto registrado')
  renderFinanzas()
}

// --- GASTOS ---
let allExpenses = []
// _gastoMes: offset en meses desde el actual (0 = actual, -1 = anterior, etc.)
let _gastoMes = 0

const GASTO_CATS = {
  mercado:      { label:'Mercado',      icon:'🛒' },
  restaurantes: { label:'Restaurantes', icon:'🍽️' },
  transporte:   { label:'Transporte',   icon:'🚗' },
  servicios:    { label:'Servicios',    icon:'⚡' },
  salud:        { label:'Salud',        icon:'💊' },
  tecnologia:   { label:'Tecnología',   icon:'💻' },
  hogar:        { label:'Hogar',        icon:'🏠' },
  otros:        { label:'Otros',        icon:'📦' },
}

async function loadExpenses(){
  const { data } = await SB_P.from('expenses').select('*').order('date',{ascending:false})
  allExpenses = data || []
  renderExpenses()
}

function navGasto(delta){
  const next = _gastoMes + delta
  if(next > 0) return   // no ir más allá del mes actual
  _gastoMes = next
  renderExpenses()
}

function getGastoRange(){
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + _gastoMes
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end:   new Date(y, m + 1, 0).toISOString().slice(0, 10),
    year:  new Date(y, m, 1).getFullYear(),
    month: new Date(y, m, 1).getMonth()
  }
}

function filteredExpenses(){
  const { start, end } = getGastoRange()
  return allExpenses.filter(e => e.date && e.date >= start && e.date <= end)
}

function renderExpenses(){
  const el = document.getElementById('gastos-content')
  if(!el) return
  const fmt = n => '$' + Number(n).toLocaleString('es-CO')
  const filtered = filteredExpenses()
  const { start, year, month } = getGastoRange()

  // NAVEGADOR DE MES
  const mesLabel = new Date(year, month, 1).toLocaleDateString('es-CO', { month:'long', year:'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
  const isCurrentMonth = _gastoMes === 0
  const navHtml = `<div style="display:flex;align-items:center;justify-content:space-between;background:#0E0E0E;border:1px solid var(--border);border-radius:10px;padding:8px 12px;margin-bottom:16px">
    <button onclick="navGasto(-1)" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:2px 8px;line-height:1;border-radius:6px" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-muted)'">←</button>
    <span style="font-size:14px;font-weight:600;color:var(--text)">${mesLabel}</span>
    <button onclick="navGasto(1)" ${isCurrentMonth?'disabled':''} style="background:transparent;border:none;color:${isCurrentMonth?'rgba(255,255,255,0.15)':'var(--text-muted)'};cursor:${isCurrentMonth?'default':'pointer'};font-size:18px;padding:2px 8px;line-height:1;border-radius:6px" ${isCurrentMonth?'':' onmouseover="this.style.color=\'var(--text)\'" onmouseout="this.style.color=\'var(--text-muted)\'"'}>→</button>
  </div>`

  // RESUMEN
  const total = filtered.reduce((s,e) => s + Number(e.amount||0), 0)
  const porCat = {}
  filtered.forEach(e => { const c = e.category||'otros'; porCat[c] = (porCat[c]||0) + Number(e.amount||0) })
  const catGrid = Object.entries(porCat).sort((a,b) => b[1]-a[1]).map(([c,t]) => {
    const {label,icon} = GASTO_CATS[c] || {label:c,icon:'📦'}
    const pct = total > 0 ? Math.round(t/total*100) : 0
    return `<div style="background:#0A0A0A;border:1px solid var(--border);border-radius:8px;padding:10px 12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:12px;color:var(--text-muted)">${icon} ${label}</span>
        <span style="font-size:11px;color:var(--text-muted)">${pct}%</span>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--red);margin-bottom:6px">${fmt(t)}</div>
      <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px">
        <div style="height:100%;width:${pct}%;background:var(--red);border-radius:2px"></div>
      </div>
    </div>`
  }).join('')
  const resumenHtml = `<div class="card" style="margin-bottom:16px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:8px${catGrid?';margin-bottom:14px':''}">
      <div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">Total del mes</div>
        <div style="font-size:34px;font-weight:700;color:var(--red);font-family:'Playfair Display',serif;line-height:1">${fmt(total)}</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted)">${filtered.length} gasto${filtered.length!==1?'s':''}</div>
    </div>
    ${catGrid ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${catGrid}</div>` : ''}
  </div>`

  // GRÁFICO — últimos 6 meses, mes seleccionado resaltado
  const selectedKey = `${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}`
  const chartMonths = Array.from({length:6}, (_,i) => {
    const d = new Date(year, month - (5-i), 1)
    const key = d.toISOString().slice(0,7)
    const label = d.toLocaleDateString('es-CO',{month:'short'})
    const sum = allExpenses.filter(e => (e.date||'').startsWith(key)).reduce((s,e) => s+Number(e.amount||0), 0)
    return { key, label, sum, selected: key === selectedKey }
  })
  const maxSum = Math.max(...chartMonths.map(m => m.sum), 1)
  const bars = chartMonths.map(m => {
    const pct = Math.max(Math.round(m.sum/maxSum*100), m.sum>0?4:0)
    const barColor = m.selected ? 'var(--red)' : 'rgba(226,75,74,0.3)'
    const labelColor = m.selected ? 'var(--text)' : 'var(--text-muted)'
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:9px;color:var(--text-muted);height:18px;display:flex;align-items:flex-end;text-align:center">${m.sum>0?fmt(m.sum).replace('$',''):'—'}</div>
      <div style="width:100%;height:70px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${pct}%;background:${m.sum>0?barColor:'rgba(255,255,255,0.04)'};border-radius:3px 3px 0 0;min-height:${m.sum>0?'4px':'0'};transition:height .2s"></div>
      </div>
      <div style="font-size:10px;color:${labelColor};font-weight:${m.selected?'600':'400'};text-transform:capitalize">${m.label}</div>
    </div>`
  }).join('')
  const chartHtml = `<div class="card" style="margin-bottom:16px">
    <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Últimos 6 meses</div>
    <div style="display:flex;gap:6px">${bars}</div>
  </div>`

  // LISTA agrupada por semana
  if(!filtered.length){
    el.innerHTML = navHtml + resumenHtml + chartHtml +
      `<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Sin gastos en este mes.</div>`
    return
  }
  const weekMap = {}
  filtered.forEach(e => {
    if(!e.date) return
    const d = new Date(e.date+'T12:00:00')
    const day = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() + (day===0?-6:1-day))
    const key = mon.toISOString().slice(0,10)
    if(!weekMap[key]) weekMap[key] = { mon, items:[] }
    weekMap[key].items.push(e)
  })
  const fmtLong = d => d.toLocaleDateString('es-CO',{day:'numeric',month:'long'})
  const listHtml = Object.entries(weekMap).sort((a,b) => b[0].localeCompare(a[0])).map(([,w]) => {
    const sun = new Date(w.mon); sun.setDate(w.mon.getDate()+6)
    const weekTotal = w.items.reduce((s,e) => s+Number(e.amount||0), 0)
    const rows = w.items.map(e => {
      const {icon,label} = GASTO_CATS[e.category] || {icon:'📦',label:'Otros'}
      const fecha = new Date(e.date+'T12:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'2-digit',month:'short'})
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.04)">
        <span style="font-size:16px;width:20px;text-align:center">${icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.description||label}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${fecha} · ${label}</div>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--red);white-space:nowrap">${fmt(e.amount)}</div>
        <button onclick="deleteGasto('${e.id}')" style="background:transparent;border:none;color:rgba(255,255,255,0.18);cursor:pointer;font-size:13px;padding:2px 4px;line-height:1" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='rgba(255,255,255,0.18)'">🗑️</button>
      </div>`
    }).join('')
    return `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;padding:5px 2px;margin-bottom:4px">
        <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">Semana del ${fmtLong(w.mon)} al ${fmtLong(sun)}</span>
        <span style="font-size:12px;font-weight:700;color:var(--red)">${fmt(weekTotal)}</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden">${rows}</div>
    </div>`
  }).join('')

  el.innerHTML = navHtml + resumenHtml + chartHtml + listHtml
}

function openModalGasto(){
  document.getElementById('g-amount').value = ''
  document.getElementById('g-desc').value = ''
  document.getElementById('g-cat').value = 'mercado'
  document.getElementById('g-date').value = TODAY
  document.getElementById('modal-gasto').classList.add('open')
}

async function saveGasto(){
  const amount = Number(document.getElementById('g-amount').value)
  const category = document.getElementById('g-cat').value
  const description = document.getElementById('g-desc').value.trim()
  const date = document.getElementById('g-date').value || TODAY
  if(!amount){ showToast('❌ Ingresa un monto'); return }
  const id = 'exp_'+Date.now()
  const { error } = await SB_P.from('expenses').insert({
    id, user_id: USER_ID, amount, category, description, date,
    created_at: new Date().toISOString()
  })
  if(error){ showToast('❌ Error: '+error.message); return }
  closeModal('gasto')
  showToast('✅ Gasto guardado')
  await loadExpenses()
}

async function deleteGasto(id){
  if(!confirm('¿Eliminar este gasto?')) return
  await SB_P.from('expenses').delete().eq('id', id)
  allExpenses = allExpenses.filter(e => e.id !== id)
  renderExpenses()
}

// --- ESCANEAR ---
let _scanData = null
let _scanBase64 = null
let _scanMediaType = null

function resetScanTab(){
  _scanData = null
  _scanBase64 = null
  _scanMediaType = null
  ;['scan-camera-input','scan-gallery-input'].forEach(id => {
    const fi = document.getElementById(id); if(fi) fi.value = ''
  })
  document.getElementById('scan-drop-zone').style.display = 'block'
  document.getElementById('scan-preview').style.display = 'none'
  document.getElementById('scan-loading').style.display = 'none'
  document.getElementById('scan-question-box').style.display = 'none'
  document.getElementById('scan-form-box').style.display = 'none'
}

function handleScanDrop(event){
  event.preventDefault()
  document.getElementById('scan-drop-zone').style.borderColor = 'var(--border)'
  const file = event.dataTransfer.files[0]
  if(file) processScanFile(file)
}

function handleScanFileInput(event){
  const file = event.target.files[0]
  if(file) processScanFile(file)
}

function processScanFile(file){
  if(!file.type.match(/^image\/(jpeg|png)$/)){
    showToast('❌ Solo se aceptan JPG o PNG')
    return
  }
  const reader = new FileReader()
  reader.onload = async (e) => {
    const dataUrl = e.target.result
    _scanBase64 = dataUrl.split(',')[1]
    _scanMediaType = file.type
    document.getElementById('scan-img').src = dataUrl
    document.getElementById('scan-preview').style.display = 'block'
    document.getElementById('scan-drop-zone').style.display = 'none'
    document.getElementById('scan-loading').style.display = 'block'
    await callScanAPI()
  }
  reader.readAsDataURL(file)
}

async function callScanAPI(extraContext = null){
  try {
    const body = { imageBase64: _scanBase64, mediaType: _scanMediaType }
    if(extraContext) body.extraContext = extraContext
    const res = await fetch('/api/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    document.getElementById('scan-loading').style.display = 'none'
    if(!res.ok){
      showToast('❌ ' + (data.error || 'Error al analizar'))
      document.getElementById('scan-drop-zone').style.display = 'block'
      return
    }
    _scanData = data
    renderScanResult(data)
  } catch(err){
    document.getElementById('scan-loading').style.display = 'none'
    showToast('❌ Error al conectar con la IA')
    document.getElementById('scan-drop-zone').style.display = 'block'
  }
}

function renderScanResult(data){
  if(data.pregunta){
    document.getElementById('scan-question-text').textContent = data.pregunta
    document.getElementById('scan-question-answer').value = ''
    document.getElementById('scan-question-box').style.display = 'block'
  } else {
    document.getElementById('scan-question-box').style.display = 'none'
  }

  document.getElementById('scan-monto').value = data.monto || ''
  document.getElementById('scan-fecha').value = data.fecha || TODAY
  document.getElementById('scan-desc').value = data.descripcion || ''
  document.getElementById('scan-cat').value = data.categoria || 'otros'

  const esRecurrente = data.tipo === 'factura_recurrente'
  document.getElementById('scan-tipo-badge').innerHTML = esRecurrente
    ? `<span style="background:rgba(155,114,240,0.12);border:1px solid rgba(155,114,240,0.3);border-radius:6px;padding:4px 10px;font-size:11px;color:#9b72f0;font-weight:600">🔄 FACTURA RECURRENTE</span>`
    : `<span style="background:rgba(93,202,165,0.1);border:1px solid rgba(93,202,165,0.3);border-radius:6px;padding:4px 10px;font-size:11px;color:#5DCAA5;font-weight:600">💸 GASTO PUNTUAL</span>`

  if(esRecurrente){
    document.getElementById('scan-factura-fields').style.display = 'block'
    document.getElementById('scan-bill-name').value = data.descripcion || ''
    if(data.fecha){
      const d = new Date(data.fecha + 'T00:00:00')
      if(!isNaN(d)) document.getElementById('scan-bill-day').value = d.getDate()
    }
  } else {
    document.getElementById('scan-factura-fields').style.display = 'none'
  }

  const confColors = { alta:'#5DCAA5', media:'#EF9F27', baja:'#E24B4A' }
  const confBg    = { alta:'rgba(93,202,165,0.08)', media:'rgba(239,159,39,0.08)', baja:'rgba(226,75,74,0.08)' }
  const conf = data.confianza || 'media'
  document.getElementById('scan-confianza-badge').innerHTML =
    `<span style="background:${confBg[conf]};border:1px solid ${confColors[conf]}55;border-radius:6px;padding:4px 10px;font-size:11px;color:${confColors[conf]};font-weight:600">Confianza: ${conf.toUpperCase()}</span>`

  document.getElementById('scan-form-box').style.display = 'block'
}

async function continueScanWithAnswer(){
  const answer = document.getElementById('scan-question-answer').value.trim()
  if(!answer){ showToast('❌ Escribe tu respuesta primero'); return }
  document.getElementById('scan-question-box').style.display = 'none'
  document.getElementById('scan-form-box').style.display = 'none'
  document.getElementById('scan-loading').style.display = 'block'
  await callScanAPI(answer)
}

async function registrarEscaneo(){
  const monto = Number(document.getElementById('scan-monto').value)
  const fecha = document.getElementById('scan-fecha').value || TODAY
  const desc  = document.getElementById('scan-desc').value.trim()
  const cat   = document.getElementById('scan-cat').value
  if(!monto){ showToast('❌ Ingresa un monto'); return }
  if(!desc)  { showToast('❌ Ingresa una descripción'); return }

  const esRecurrente = _scanData?.tipo === 'factura_recurrente'

  if(esRecurrente){
    const billName = document.getElementById('scan-bill-name').value.trim() || desc
    const billDay  = parseInt(document.getElementById('scan-bill-day').value)
    if(!billDay || billDay < 1 || billDay > 28){ showToast('❌ El día debe ser entre 1 y 28'); return }
    const { error: billErr } = await SB_P.from('bills').insert({
      id: 'bill_'+Date.now(), user_id: USER_ID, name: billName,
      estimated_amount: monto, due_day: billDay, category: cat,
      is_active: true, created_at: new Date().toISOString()
    })
    if(billErr){ showToast('❌ Error al registrar factura: '+billErr.message); return }
    await SB_P.from('expenses').insert({
      id: 'exp_'+Date.now(), user_id: USER_ID, amount: monto,
      category: cat, description: desc, date: fecha, created_at: new Date().toISOString()
    })
    showToast('✅ Factura y gasto registrados')
    resetScanTab()
    switchDineroTab('facturas')
  } else {
    const { error } = await SB_P.from('expenses').insert({
      id: 'exp_'+Date.now(), user_id: USER_ID, amount: monto,
      category: cat, description: desc, date: fecha, created_at: new Date().toISOString()
    })
    if(error){ showToast('❌ Error: '+error.message); return }
    showToast('✅ Gasto registrado')
    resetScanTab()
    switchDineroTab('gastos')
  }
}

// --- CITAS ---
const CITA_ICONS = { medica:'🏥', odontologica:'🦷', reunion:'🤝', otro:'📋' }
const CITA_STATUS_COLOR = { pendiente:'#EF9F27', completada:'#5DCAA5', cancelada:'var(--text-muted)' }
const CITA_STATUS_LABEL = { pendiente:'Pendiente', completada:'Completada', cancelada:'Cancelada' }

async function loadCitas(){
  const { data } = await SB_P.from('appointments')
    .select('*').order('datetime',{ascending:true})
  allCitas = data || []
  allCitas.filter(c => c.status === 'pendiente' && c.datetime >= TODAY)
    .forEach(syncCitaToAgenda)
  renderCitas()
  renderCitasAlert()
  renderTasks()
}

function _agendaSlotKey(totalMinutes, snapDir='round'){
  const fn = snapDir==='floor' ? Math.floor : snapDir==='ceil' ? Math.ceil : Math.round
  const snapped = fn(totalMinutes/AGENDA_SLOT)*AGENDA_SLOT
  const h = Math.floor(snapped/60) % 24
  const m = snapped % 60
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`
}

function _syncCitaConViajes(cita){
  if(!cita.datetime) return
  const dateStr = cita.datetime.slice(0, 10)
  const key = 'agenda_' + dateStr
  const raw = JSON.parse(localStorage.getItem(key) || '{}')
  const d = new Date(cita.datetime)
  const citaMin = d.getHours()*60 + d.getMinutes()
  const durMin = cita.duration_minutes || 60
  const tBefore = cita.travel_before_minutes || 0
  const tAfter  = cita.travel_after_minutes  || 0

  // Bloque de viaje de ida — floor garantiza que quede ANTES del slot de la cita
  if(tBefore > 0){
    const sk = _agendaSlotKey(citaMin - tBefore, 'floor')
    if(!raw[sk]) raw[sk] = []
    if(!raw[sk].find(x => x.id === cita.id+'_ida')){
      raw[sk].push({ id: cita.id+'_ida', dur: tBefore, type: 'cita', title: '🚗 Viaje ida — '+cita.title, color: '#64748B' })
    }
  }
  // Bloque de la cita
  const citaSk = _agendaSlotKey(citaMin)
  if(!raw[citaSk]) raw[citaSk] = []
  if(!raw[citaSk].find(x => x.id === cita.id)){
    raw[citaSk].push({ id: cita.id, dur: durMin, type: 'cita', title: cita.title, color: '#EF9F27' })
  }
  // Bloque de viaje de vuelta — ceil garantiza que quede DESPUÉS del slot de la cita
  if(tAfter > 0){
    const sk = _agendaSlotKey(citaMin + durMin, 'ceil')
    if(!raw[sk]) raw[sk] = []
    if(!raw[sk].find(x => x.id === cita.id+'_vuelta')){
      raw[sk].push({ id: cita.id+'_vuelta', dur: tAfter, type: 'cita', title: '🚗 Viaje vuelta — '+cita.title, color: '#64748B' })
    }
  }
  localStorage.setItem(key, JSON.stringify(raw))
}

function syncCitaToAgenda(cita){
  if(!cita.datetime || cita.datetime < TODAY) return
  const key = 'agenda_' + cita.datetime.slice(0,10)
  const raw = JSON.parse(localStorage.getItem(key) || '{}')
  const alreadyExists = Object.values(raw).some(arr =>
    Array.isArray(arr) && arr.some(x => (typeof x === 'string' ? x : x.id) === cita.id)
  )
  if(alreadyExists) return
  _syncCitaConViajes(cita)
}

function removeCitaFromAgenda(citaId){
  const cita = allCitas.find(c => c.id === citaId)
  if(!cita || !cita.datetime) return
  const dateStr = cita.datetime.slice(0, 10)
  const key = 'agenda_' + dateStr
  const raw = JSON.parse(localStorage.getItem(key) || '{}')
  const idsToRemove = new Set([citaId, citaId+'_ida', citaId+'_vuelta'])
  let changed = false
  Object.keys(raw).forEach(slot => {
    if(!Array.isArray(raw[slot])) return
    const before = raw[slot].length
    raw[slot] = raw[slot].filter(x => !idsToRemove.has(typeof x === 'string' ? x : x.id))
    if(raw[slot].length !== before) changed = true
    if(raw[slot].length === 0) delete raw[slot]
  })
  if(changed) localStorage.setItem(key, JSON.stringify(raw))
}

function renderCitasAlert(){
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1)
  const tmrStr = tomorrow.toLocaleDateString('en-CA')
  const proximas = allCitas.filter(c => {
    if(c.status !== 'pendiente') return false
    const d = c.datetime.slice(0,10)
    return d === TODAY || d === tmrStr
  })
  const citasText = proximas.map(c => {
    const d   = new Date(c.datetime)
    const h   = d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})
    const dia = c.datetime.slice(0,10) === TODAY ? 'Hoy' : 'Mañana'
    return `${dia} ${h} — ${c.title}`
  }).join(' · ')
  ;[['citas-alert','citas-alert-text'],['citas-alert-t','citas-alert-text-t']].forEach(([alertId, txtId]) => {
    const el  = document.getElementById(alertId)
    const txt = document.getElementById(txtId)
    if(!el) return
    if(!proximas.length){ el.style.display='none'; return }
    el.style.display = 'flex'
    if(txt) txt.textContent = citasText
  })
}

function renderCitas(){
  const el = document.getElementById('citas-list')
  if(!el) return
  const now = new Date()
  const proximas = allCitas.filter(c => c.status === 'pendiente' && new Date(c.datetime) >= now)
  const pasadas  = allCitas.filter(c => c.status !== 'pendiente' || new Date(c.datetime) < now)

  function citaCard(c){
    const d     = new Date(c.datetime)
    const fecha = d.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    const hora  = d.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})
    const stC   = CITA_STATUS_COLOR[c.status] || 'var(--text-muted)'
    const stL   = CITA_STATUS_LABEL[c.status] || c.status
    const icon  = CITA_ICONS[c.type] || '📋'
    const isPendiente = c.status === 'pendiente'
    const lugar  = c.location  ? `<span>📍 ${c.location}</span>`   : ''
    const doctor = c.doctor_name ? `<span>👨‍⚕️ ${c.doctor_name}</span>` : ''
    const dateKey = c.datetime.slice(0,10)
    return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:8px${c.status==='cancelada'?';opacity:.5':''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0;cursor:pointer" onclick="verCitaEnAgenda('${c.id}','${dateKey}')">
          <div style="font-size:14px;font-weight:600;color:var(--text-primary)">${icon} ${c.title}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:5px;display:flex;flex-wrap:wrap;gap:8px">
            <span>📅 ${fecha.charAt(0).toUpperCase()+fecha.slice(1)}, ${hora}</span>
            ${lugar}${doctor}
            <span style="color:var(--gold)">📋 Ver en agenda →</span>
          </div>
        </div>
        <span style="font-size:11px;color:${stC};font-weight:600;white-space:nowrap;flex-shrink:0">${stL}</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        ${isPendiente ? `
        <button onclick="completarCita('${c.id}')" style="flex:1;padding:5px 12px;font-size:12px;border-radius:6px;border:1px solid rgba(93,202,165,0.4);background:transparent;color:#5DCAA5;cursor:pointer;font-family:'Outfit',sans-serif">✓ Completar</button>
        <button onclick="confirmarCancelarCita('${c.id}')" style="flex:1;padding:5px 12px;font-size:12px;border-radius:6px;border:1px solid rgba(239,159,39,0.3);background:transparent;color:#EF9F27;cursor:pointer;font-family:'Outfit',sans-serif">✗ Cancelar</button>` : ''}
        <button onclick="confirmarEliminarCita('${c.id}')" style="padding:5px 10px;font-size:12px;border-radius:6px;border:1px solid rgba(226,75,74,0.3);background:transparent;color:var(--red);cursor:pointer;font-family:'Outfit',sans-serif">🗑️</button>
      </div>
    </div>`
  }

  if(!proximas.length && !pasadas.length){
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏥</div>No hay citas registradas</div>'
    return
  }
  let html = ''
  if(proximas.length){
    html += `<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Próximas</div>`
    html += proximas.map(citaCard).join('')
  }
  if(pasadas.length){
    html += `<details style="margin-top:${proximas.length?'14':'0'}px">
      <summary style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;cursor:pointer;list-style:none;margin-bottom:8px">Pasadas / completadas (${pasadas.length})</summary>
      <div style="margin-top:8px">${pasadas.map(citaCard).join('')}</div>
    </details>`
  }
  el.innerHTML = html
}

async function completarCita(id){
  const { error } = await SB_P.from('appointments').update({status:'completada'}).eq('id',id)
  if(error){ showToast('❌ '+error.message); return }
  removeCitaFromAgenda(id)
  allCitas = allCitas.map(c => c.id===id ? {...c,status:'completada'} : c)
  renderCitas(); renderCitasAlert()
  showToast('✅ Cita completada')
}

async function cancelarCita(id){
  const { error } = await SB_P.from('appointments').update({status:'cancelada'}).eq('id',id)
  if(error){ showToast('❌ '+error.message); return }
  removeCitaFromAgenda(id)
  allCitas = allCitas.map(c => c.id===id ? {...c,status:'cancelada'} : c)
  renderCitas(); renderCitasAlert()
  showToast('✗ Cita cancelada')
}

function verCitaEnAgenda(citaId, dateKey){
  jumpAgendaToDate(dateKey)
  showSection('agenda', document.querySelector('[onclick*="showSection(\'agenda\'"]'))
  // Scroll al slot de la cita después de que renderice
  setTimeout(() => {
    const cita = allCitas.find(c => c.id === citaId)
    if(!cita) return
    const d = new Date(cita.datetime)
    const rawMin = d.getHours()*60 + d.getMinutes()
    const snapped = Math.round(rawMin/20)*20
    const hh = Math.floor(snapped/60).toString().padStart(2,'0')
    const mm = (snapped%60).toString().padStart(2,'0')
    const blockId = 'ablock-' + hh + '_' + mm
    const slotEl = document.getElementById(blockId) || document.querySelector(`[data-slot="${hh}:${mm}"]`)
    if(slotEl){
      slotEl.scrollIntoView({behavior:'smooth', block:'center'})
      slotEl.style.outline = '2px solid var(--gold)'
      slotEl.style.borderRadius = '8px'
      setTimeout(() => { slotEl.style.outline = ''; slotEl.style.borderRadius = '' }, 2000)
    }
  }, 400)
}

function confirmarCancelarCita(id){
  const cita = allCitas.find(c => c.id === id)
  const nombre = cita?.title || 'esta cita'
  showToastAction(`¿Cancelar "${nombre}"? La cita quedará guardada en tu historial como cancelada, no se borrará.`, 'Sí, cancelar', () => cancelarCita(id))
}

function confirmarEliminarCita(id){
  const cita = allCitas.find(c => c.id === id)
  const nombre = cita?.title || 'esta cita'
  showToastAction(`¿Eliminar "${nombre}"?`, 'Sí, eliminar', () => eliminarCita(id))
}

async function eliminarCita(id){
  const cita = allCitas.find(c => c.id === id)
  const { error } = await SB_P.from('appointments').delete().eq('id',id)
  if(error){ showToast('❌ '+error.message); return }
  // Solo quitar de agenda si la cita aún no ha pasado
  if(cita && new Date(cita.datetime) >= new Date()) removeCitaFromAgenda(id)
  allCitas = allCitas.filter(c => c.id!==id)
  renderCitas(); renderCitasAlert()
  showToast('🗑️ Cita eliminada')
}

// Pendiente de confirmar conflicto
let _conflictoPendiente = null

function _citaConflictos(dateStr, startMin, durMin, travelBefore, travelAfter){
  const data = _agendaCacheDate === dateStr ? getAgendaData() : JSON.parse(localStorage.getItem('agenda_'+dateStr)||'{}')
  const conflictos = [] // { slot, items: [{id, label}] }
  const ranges = []
  if(travelBefore > 0) ranges.push({startMin: startMin - travelBefore, dur: travelBefore, label: 'Viaje de ida'})
  ranges.push({startMin, dur: durMin, label: null})
  if(travelAfter > 0) ranges.push({startMin: startMin + durMin, dur: travelAfter, label: 'Viaje de vuelta'})
  ranges.forEach(range => {
    const n = Math.ceil(range.dur / AGENDA_SLOT)
    for(let i = 0; i < n; i++){
      const slotMin = Math.floor((range.startMin + i*AGENDA_SLOT)/AGENDA_SLOT)*AGENDA_SLOT
      const sk = agendaFromMin(slotMin)
      const items = (Array.isArray(data[sk]) ? data[sk] : []).filter(x => {
        const id = typeof x === 'string' ? x : x.id
        return id && !id.endsWith('_ida') && !id.endsWith('_vuelta')
      })
      if(items.length > 0 && !conflictos.find(c => c.slot === sk)){
        conflictos.push({slot: sk, items: items.map(x => {
          const id = typeof x === 'string' ? x : x.id
          const act = allActivities.find(a => a.id === id)
          return {id, label: act ? (act.emoji||'') + ' ' + act.name : id}
        })})
      }
    }
  })
  return conflictos
}

function _conflictoEliminarSlot(slot){
  const data = getAgendaData()
  if(!data[slot]) return
  delete data[slot]
  setAgendaData(data)
  const el = document.querySelector(`#conflicto-lista [data-slot="${slot}"]`)
  if(el) el.remove()
  // si ya no quedan conflictos, guardar directo
  if(!document.querySelector('#conflicto-lista [data-slot]')) _conflictoGuardarDejando()
}

async function _conflictoMoverSlot(slot){
  const data = getAgendaData()
  const items = data[slot] || []
  if(!items.length){ _conflictoEliminarSlot(slot); return }
  // buscar primer slot libre después
  let newMin = agendaToMin(slot) + AGENDA_SLOT
  while(newMin < 24*60){
    const nk = agendaFromMin(newMin)
    if(!(data[nk]||[]).length) break
    newMin += AGENDA_SLOT
  }
  if(newMin >= 24*60){ showToast('⚠️ No hay slot libre disponible'); return }
  const nk = agendaFromMin(newMin)
  data[nk] = [...(data[nk]||[]), ...items]
  delete data[slot]
  setAgendaData(data)
  const el = document.querySelector(`#conflicto-lista [data-slot="${slot}"]`)
  if(el) el.remove()
  showToast(`↗️ Movido a ${nk}`)
  if(!document.querySelector('#conflicto-lista [data-slot]')) _conflictoGuardarDejando()
}

async function _conflictoGuardarDejando(){
  closeModal('conflicto-cita')
  if(!_conflictoPendiente) return
  const rec = _conflictoPendiente
  _conflictoPendiente = null
  const { error } = await SB_P.from('appointments').insert(rec)
  if(error){ showToast('❌ '+error.message); return }
  allCitas = [...allCitas, rec].sort((a,b) => new Date(a.datetime)-new Date(b.datetime))
  _syncCitaConViajes(rec)
  closeModal('nueva-cita')
  _resetNuevaCitaForm()
  renderCitas(); renderCitasAlert()
  const dateKey = rec.datetime.slice(0,10)
  if(dateKey === TODAY){
    const slotKey = rec.datetime.slice(11,16)
    const msgEl = document.getElementById('modal-cita-hoy-msg')
    const yesBtn = document.getElementById('modal-cita-hoy-yes')
    if(msgEl) msgEl.textContent = `${rec.title} — a las ${slotKey}`
    if(yesBtn) yesBtn.onclick = () => { addCitaToHoy(rec.id); closeModal('cita-hoy') }
    openModal('cita-hoy')
  } else {
    showToast('✅ Cita guardada')
  }
}

function _resetNuevaCitaForm(){
  document.getElementById('nc-title').value = ''
  document.getElementById('nc-datetime').value = ''
  document.getElementById('nc-duration').value = '60'
  document.getElementById('nc-travel-before').value = '0'
  document.getElementById('nc-travel-after').value = '0'
  document.getElementById('nc-lugar').value = ''
  document.getElementById('nc-doctor').value = ''
  document.getElementById('nc-r1').value = '3'
  document.getElementById('nc-r2').value = '1'
  document.getElementById('nc-people-search').value = ''
  document.getElementById('nc-people-dropdown').style.display = 'none'
  document.getElementById('nc-event-type').value = ''
  _ncSelectedPeople = []
  _ncRenderSelectedPeople()
}

async function guardarNuevaCita(){
  const title = document.getElementById('nc-title').value.trim()
  const dt    = document.getElementById('nc-datetime').value
  if(!title || !dt){ showToast('⚠️ Título y fecha son requeridos'); return }
  const dtMs = new Date(dt).getTime()
  const r1h  = parseFloat(document.getElementById('nc-r1').value) || 0
  const r2h  = parseFloat(document.getElementById('nc-r2').value) || 0
  const durMin        = parseInt(document.getElementById('nc-duration').value) || 60
  const travelBefore  = parseInt(document.getElementById('nc-travel-before').value) || 0
  const travelAfter   = parseInt(document.getElementById('nc-travel-after').value) || 0
  const eventTypeId = document.getElementById('nc-event-type')?.value || null
  const rec  = {
    id:         'apt_'+Date.now(),
    user_id:    USER_ID,
    title,
    type:       document.getElementById('nc-type').value,
    datetime:   new Date(dt).toISOString(),
    duration_minutes:      durMin,
    travel_before_minutes: travelBefore || null,
    travel_after_minutes:  travelAfter  || null,
    location:   document.getElementById('nc-lugar').value.trim() || null,
    doctor_name: document.getElementById('nc-doctor').value.trim() || null,
    reminder_1: r1h > 0 ? new Date(dtMs - r1h*3600000).toISOString() : null,
    reminder_2: r2h > 0 ? new Date(dtMs - r2h*3600000).toISOString() : null,
    status:     'pendiente',
    event_type_id: eventTypeId || null,
    people_ids:    _ncSelectedPeople.length ? _ncSelectedPeople : null,
  }
  // Detectar conflictos en la agenda del día de la cita
  const dateKey = rec.datetime.slice(0, 10)
  const citaMin = new Date(rec.datetime).getHours()*60 + new Date(rec.datetime).getMinutes()
  const conflictos = _citaConflictos(dateKey, citaMin, durMin, travelBefore, travelAfter)
  if(conflictos.length > 0){
    _conflictoPendiente = rec
    const lista = document.getElementById('conflicto-lista')
    lista.innerHTML = conflictos.map(c => `
      <div data-slot="${c.slot}" style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px 12px">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">🕐 ${c.slot}</div>
        ${c.items.map(it => `<div style="font-size:13px;color:var(--text-dim);margin-bottom:4px">${it.label}</div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:8px">
          <button onclick="_conflictoEliminarSlot('${c.slot}')" style="flex:1;font-size:11px;padding:5px 8px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:transparent;color:#f87171;cursor:pointer">🗑 Eliminar</button>
          <button onclick="_conflictoMoverSlot('${c.slot}')" style="flex:1;font-size:11px;padding:5px 8px;border-radius:6px;border:1px solid rgba(99,179,237,0.4);background:transparent;color:#90cdf4;cursor:pointer">↗️ Mover al siguiente libre</button>
        </div>
      </div>`).join('')
    openModal('conflicto-cita')
    return
  }
  // Sin conflictos — guardar directo
  _conflictoPendiente = rec
  await _conflictoGuardarDejando()
}

// --- SELECTOR DE TAREAS ---
let _selectorTab = 'existente'
let _selectorSelected = new Set()

function openNuevaTareaModal(){
  _selectorSelected = new Set()
  document.getElementById('st-search').value = ''
  document.getElementById('st-title').value = ''
  document.getElementById('st-due').value = ''
  document.getElementById('st-time').value = ''
  document.getElementById('st-cat').value = 'iarcania'
  document.getElementById('st-priority').value = 'alta'
  switchSelectorTab('existente')
  renderSelectorTareas('')
  openModal('selector-tarea')
}

function switchSelectorTab(tab){
  _selectorTab = tab
  document.getElementById('st-panel-existente').style.display = tab === 'existente' ? 'block' : 'none'
  document.getElementById('st-panel-nueva').style.display     = tab === 'nueva'     ? 'block' : 'none'
  ;['existente','nueva'].forEach(t => {
    const btn = document.getElementById('st-tab-'+t)
    btn.style.borderBottomColor = t === tab ? 'var(--gold)' : 'transparent'
    btn.style.color = t === tab ? 'var(--gold)' : 'var(--text-muted)'
  })
}

function filterSelectorTareas(q){
  renderSelectorTareas(q.toLowerCase())
}

function renderSelectorTareas(q){
  const el = document.getElementById('st-lista')
  if(!el) return
  const pending  = allTasks.filter(t => t.status !== 'completada')
  const filtered = q ? pending.filter(t => t.title.toLowerCase().includes(q)) : pending

  if(!filtered.length){
    el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Sin resultados</div>'
    updateSelectorCount()
    return
  }

  const groups = {}
  filtered.forEach(t => {
    const k = t.category || 'personal'
    if(!groups[k]) groups[k] = []
    groups[k].push(t)
  })

  const CAT_FALLBACK = { label:'Otros', color:'#888888' }
  el.innerHTML = Object.entries(groups).map(([catKey, tasks]) => {
    const cat = CATS[catKey] || CAT_FALLBACK
    const rows = tasks.map(t => {
      const checked = _selectorSelected.has(t.id) ? 'checked' : ''
      const dateStr = t.due_date ? `<span style="font-size:10px;color:var(--text-muted);flex-shrink:0">${t.due_date}</span>` : ''
      return `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;background:transparent" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
        <input type="checkbox" ${checked} onchange="toggleSelectorTask('${t.id}',this.checked)" style="width:15px;height:15px;accent-color:${cat.color};cursor:pointer;flex-shrink:0">
        <span style="font-size:13px;color:var(--text-primary);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</span>
        ${dateStr}
      </label>`
    }).join('')
    return `<div style="margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:${cat.color};text-transform:uppercase;letter-spacing:.07em;padding:0 8px;margin-bottom:2px">${cat.label}</div>
      ${rows}
    </div>`
  }).join('')
  updateSelectorCount()
}

function toggleSelectorTask(id, checked){
  if(checked) _selectorSelected.add(id)
  else _selectorSelected.delete(id)
  updateSelectorCount()
}

function updateSelectorCount(){
  const el = document.getElementById('st-sel-count')
  if(el) el.textContent = `${_selectorSelected.size} seleccionada${_selectorSelected.size !== 1 ? 's' : ''}`
}

function confirmarSeleccionTareas(){
  if(!_selectorSelected.size){ showToast('⚠️ Selecciona al menos una tarea'); return }
  const ids = getDashList('hoy')
  let added = 0
  _selectorSelected.forEach(id => {
    if(ids.length >= 5) return
    if(!ids.includes(id)){ ids.push(id); added++ }
  })
  setDashList('hoy', ids)
  closeModal('selector-tarea')
  renderTasks()
  showToast(added > 0 ? `✅ ${added} tarea${added > 1 ? 's' : ''} agregada${added > 1 ? 's' : ''} a Hoy` : '⚠️ Límite de 5 tareas alcanzado o ya estaban en la lista')
}

async function saveNuevaTareaFromSelector(){
  const title = document.getElementById('st-title').value.trim()
  if(!title){ showToast('⚠️ Escribe un título'); return }
  const catKey = document.getElementById('st-cat').value
  const cat    = CATS[catKey] || CATS.habitos
  const taskData = {
    id:          'task_'+Date.now(),
    title,
    category:    catKey,
    color:       cat.color,
    priority:    document.getElementById('st-priority').value,
    due_date:    document.getElementById('st-due').value  || null,
    notes:       document.getElementById('st-time').value || null,
    assigned_to: USER_ID,
    created_by:  USER_ID,
    status:      'pendiente'
  }
  const { error } = await SB_P.from('tasks').insert(taskData)
  if(error){ showToast('❌ '+error.message); return }
  closeModal('selector-tarea')
  await loadTasks()
  showToast('✅ Tarea creada')
}

// ─── MÓDULO RECURSOS ────────────────────────────────────────────────────────
const RECURSOS_TIPOS = {
  curso:       { label: 'Curso',       icon: '🎓' },
  sop:         { label: 'SOP',         icon: '📋' },
  prompt:      { label: 'Prompt',      icon: '💬' },
  workflow:    { label: 'Workflow',    icon: '⚙️' },
  plantilla:   { label: 'Plantilla',  icon: '📄' },
  entregable:  { label: 'Entregable', icon: '📦' },
}
const RECURSOS_ESTADO_COLOR = {
  'vivo':        '#5DCAA5',
  'en-progreso': '#c4a35a',
  'pendiente':   '#888',
  'archivado':   '#444',
}

let _recursos = []
let _recursosTipoFilter = 'all'

async function loadRecursos() {
  document.getElementById('recursos-list').innerHTML =
    '<div class="loading"><div class="spinner"></div><br>Cargando recursos...</div>'

  const { data, error } = await SB_P.from('recursos')
    .select('id, titulo, tipo, estado, visible_para, owner_id, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    document.getElementById('recursos-list').innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠️</div>${error.message}</div>`
    return
  }

  _recursos = data || []
  renderRecursosFiltros()
  renderRecursosList()

  const sub = document.getElementById('recursos-sub')
  if (sub) sub.textContent = `${_recursos.length} recurso${_recursos.length !== 1 ? 's' : ''}`
}

function renderRecursosFiltros() {
  const el = document.getElementById('recursos-type-filters')
  if (!el) return
  const counts = {}
  _recursos.forEach(r => { counts[r.tipo] = (counts[r.tipo] || 0) + 1 })
  const btnStyle = active =>
    `padding:5px 14px;font-size:12px;font-family:'Outfit',sans-serif;border-radius:20px;cursor:pointer;border:1px solid ${active ? 'var(--gold)' : 'var(--border)'};background:${active ? 'rgba(196,163,90,.12)' : 'transparent'};color:${active ? 'var(--gold)' : 'var(--text-muted)'};transition:all .15s`
  const all = _recursosTipoFilter === 'all'
  let html = `<button onclick="filtrarRecursosTipo('all')" style="${btnStyle(all)}">Todos (${_recursos.length})</button>`
  Object.entries(RECURSOS_TIPOS).forEach(([key, { label, icon }]) => {
    if (!counts[key]) return
    const active = _recursosTipoFilter === key
    html += `<button onclick="filtrarRecursosTipo('${key}')" style="${btnStyle(active)}">${icon} ${label} (${counts[key]})</button>`
  })
  el.innerHTML = html
}

function filtrarRecursosTipo(tipo) {
  _recursosTipoFilter = tipo
  renderRecursosFiltros()
  renderRecursosList()
}

function renderRecursosList() {
  const el = document.getElementById('recursos-list')
  if (!el) return
  const lista = _recursosTipoFilter === 'all'
    ? _recursos
    : _recursos.filter(r => r.tipo === _recursosTipoFilter)

  if (!lista.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div>Sin recursos en esta categoría</div>'
    return
  }

  const canEdit = USER_ROLE === 'admin'
  el.innerHTML = lista.map(r => {
    const { label, icon } = RECURSOS_TIPOS[r.tipo] || { label: r.tipo, icon: '📄' }
    const estadoColor = RECURSOS_ESTADO_COLOR[r.estado] || '#888'
    const rolesStr = Array.isArray(r.visible_para) ? r.visible_para.join(', ') : (r.visible_para || '—')
    const fecha = new Date(r.created_at).toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric'
    })
    const editBtn = (canEdit || (USER_ROLE === 'employee' && r.owner_id === USER_ID))
      ? `<button onclick="abrirRecursoEditar('${r.id}')" title="Editar" style="background:none;border:none;color:var(--text-muted);font-size:15px;cursor:pointer;padding:4px 6px;flex-shrink:0;opacity:.7" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.7">✏️</button>`
      : ''
    return `<div class="script-card" style="display:flex;align-items:center;gap:14px;padding:12px 16px">
      <div style="font-size:22px;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.titulo}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">
          <span>${label}</span>
          <span style="color:${estadoColor}">● ${r.estado}</span>
          <span>Roles: ${rolesStr}</span>
          <span>${fecha}</span>
        </div>
      </div>
      ${editBtn}
    </div>`
  }).join('')
}

// ── Formulario crear / editar ────────────────────────────────────────────────

let _recursoEditId = null // null = modo INSERT, string = modo UPDATE

function _mostrarBtnNuevoRecurso() {
  if (USER_ROLE === 'admin' || USER_ROLE === 'employee') {
    const btn = document.getElementById('btn-nuevo-recurso')
    if (btn) btn.style.display = 'block'
  }
}

function _resetRecursoForm() {
  document.getElementById('rec-titulo').value = ''
  document.getElementById('rec-tipo').value = 'curso'
  document.getElementById('rec-estado').value = 'vivo'
  document.getElementById('rec-nivel').value = ''
  ;['admin','employee','family','cliente','estudiante'].forEach(r => {
    const cb = document.getElementById('vp-' + r)
    if (cb) cb.checked = false
  })
  document.getElementById('rec-contenido').value = ''
  document.getElementById('rec-sensible').value = ''
  const sensWrap = document.getElementById('rec-sensible-wrap')
  if (sensWrap) sensWrap.style.display = USER_ROLE === 'admin' ? 'block' : 'none'
}

function abrirRecursoNuevo() {
  _recursoEditId = null
  _resetRecursoForm()
  document.getElementById('recurso-modal-title').textContent = 'Nuevo recurso'
  document.getElementById('recurso-modal').style.display = 'block'
}

async function abrirRecursoEditar(id) {
  _recursoEditId = id
  _resetRecursoForm()
  document.getElementById('recurso-modal-title').textContent = 'Editar recurso'
  document.getElementById('recurso-modal').style.display = 'block'

  const { data, error } = await SB_P.from('recursos')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) { alert('No se pudo cargar el recurso.'); cerrarRecursoModal(); return }

  document.getElementById('rec-titulo').value = data.titulo || ''
  document.getElementById('rec-tipo').value = data.tipo || 'curso'
  document.getElementById('rec-estado').value = data.estado || 'vivo'
  document.getElementById('rec-nivel').value = data.nivel_min || ''
  const vp = Array.isArray(data.visible_para) ? data.visible_para : []
  ;['admin','employee','family','cliente','estudiante'].forEach(r => {
    const cb = document.getElementById('vp-' + r)
    if (cb) cb.checked = vp.includes(r)
  })
  document.getElementById('rec-contenido').value = data.contenido || ''

  if (USER_ROLE === 'admin') {
    const { data: sens } = await SB_P
      .from('recursos_sensible')
      .select('contenido')
      .eq('recurso_id', id)
      .maybeSingle()
    document.getElementById('rec-sensible').value = sens?.contenido || ''
  }
}

function cerrarRecursoModal() {
  document.getElementById('recurso-modal').style.display = 'none'
  _recursoEditId = null
}

async function guardarRecurso() {
  const titulo = document.getElementById('rec-titulo').value.trim()
  if (!titulo) { alert('El título es obligatorio.'); return }

  const vp = ['admin','employee','family','cliente','estudiante']
    .filter(r => document.getElementById('vp-' + r)?.checked)
  const nivel = document.getElementById('rec-nivel').value || null
  const sensible = USER_ROLE === 'admin'
    ? document.getElementById('rec-sensible').value.trim()
    : null

  const payload = {
    titulo,
    tipo:        document.getElementById('rec-tipo').value,
    estado:      document.getElementById('rec-estado').value,
    nivel_min:   nivel,
    visible_para: vp,
    contenido:   document.getElementById('rec-contenido').value.trim() || null,
  }

  const saveBtn = document.querySelector('#recurso-modal button[onclick="guardarRecurso()"]')
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…' }

  try {
    if (_recursoEditId) {
      // UPDATE
      const { error } = await SB_P.from('recursos').update(payload).eq('id', _recursoEditId)
      if (error) throw error

      if (USER_ROLE === 'admin' && sensible !== null) {
        const { error: se } = await SB_P
          .from('recursos_sensible')
          .upsert({ recurso_id: _recursoEditId, contenido: sensible }, { onConflict: 'recurso_id' })
        if (se) throw se
      }
    } else {
      // INSERT
      payload.owner_id = USER_ID
      const { data: inserted, error } = await SB_P
        .from('recursos')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error

      if (USER_ROLE === 'admin' && sensible) {
        const { error: se } = await SB_P
          .from('recursos_sensible')
          .insert({ recurso_id: inserted.id, contenido: sensible })
        if (se) throw se
      }
    }

    cerrarRecursoModal()
    await loadRecursos()
  } catch (err) {
    alert('Error al guardar: ' + err.message)
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar' }
  }
}

// ── Agenda multi-select ───────────────────────────────────────────────────────
let _agendaSelectedSlots = new Set()
let _agendaSelecting = false
let _agendaSelectStartIdx = -1
let _agendaAllBlocks = []

function _agendaSlotIdx(sk){ return _agendaAllBlocks.indexOf(sk) }

function agendaSelMouseDown(event, slotKey){
  if(event.button !== 0) return
  if(event.target.closest('.agenda-chip,button,a,input')) return
  if(_agendaPasteMode) return
  _agendaSelecting = true
  _agendaSelectStartIdx = _agendaSlotIdx(slotKey)
  _agendaSelectedSlots = new Set([slotKey])
  _agendaUpdateSelectionUI()
  event.preventDefault()
}

function agendaSelMouseOver(event, slotKey){
  if(!_agendaSelecting) return
  const endIdx = _agendaSlotIdx(slotKey)
  const minI = Math.min(_agendaSelectStartIdx, endIdx)
  const maxI = Math.max(_agendaSelectStartIdx, endIdx)
  _agendaSelectedSlots = new Set(_agendaAllBlocks.slice(minI, maxI+1))
  _agendaUpdateSelectionUI()
}

function _agendaUpdateSelectionUI(){
  document.querySelectorAll('.agenda-block').forEach(el => {
    const sk = el.id.replace('ablock-','').replace('_',':')
    el.classList.toggle('agenda-selected', _agendaSelectedSlots.has(sk))
  })
  const toolbar = document.getElementById('agenda-select-toolbar')
  const n = _agendaSelectedSlots.size
  if(!toolbar) return
  if(n > 0){
    toolbar.style.display = 'flex'
    toolbar.querySelector('.agenda-sel-count').textContent = `${n} slot${n>1?'s':''}`
  } else {
    toolbar.style.display = 'none'
  }
}

function agendaClearSelection(){
  _agendaSelectedSlots = new Set()
  _agendaSelecting = false
  _agendaUpdateSelectionUI()
}

// ── Acciones de selección múltiple ───────────────────────────────────────────

function agendaSelAdd(){
  if(!_agendaSelectedSlots.size) return
  const panel = document.getElementById('agenda-multisel-panel')
  document.getElementById('multisel-slot-count').textContent = _agendaSelectedSlots.size
  document.getElementById('multisel-search').value = ''
  renderMultiselList('')
  panel.style.display = 'flex'
  setTimeout(() => document.getElementById('multisel-search').focus(), 50)
}

function renderMultiselList(q){
  const el = document.getElementById('multisel-list')
  if(!el) return
  const qLow = (q||'').toLowerCase()
  const habits = allActivities.filter(a => a.is_active && (!qLow || a.name.toLowerCase().includes(qLow)))
  const tasks  = allTasks.filter(t => t.status!=='completada' && (!qLow || t.title.toLowerCase().includes(qLow))).slice(0,10)
  let html = ''
  if(habits.length){
    html += `<div style="padding:5px 10px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;background:#0C0C0C">Hábitos</div>`
    html += habits.slice(0,12).map(a => {
      const color = CAT_COLORS[a.category]||'#888'
      return `<div class="asugg-row" onclick="agendaMultiselPick('habit','${a.id}','${a.name.replace(/'/g,"\\'")}')">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <span>${a.name}</span>
      </div>`
    }).join('')
  }
  if(tasks.length){
    html += `<div style="padding:5px 10px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;background:#0C0C0C">Tareas</div>`
    html += tasks.map(t => {
      const cat = CATS[t.category]||CATS.habitos
      return `<div class="asugg-row" onclick="agendaMultiselPick('task','${t.id}','${t.title.replace(/'/g,"\\'")}')">
        <div style="width:8px;height:8px;border-radius:50%;background:${cat.color};flex-shrink:0"></div>
        <span>${t.title}</span>
      </div>`
    }).join('')
  }
  el.innerHTML = html || `<div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center">Sin resultados</div>`
}

function agendaMultiselPick(type, id, title){
  const dur = parseInt(document.getElementById('multisel-dur').value)||60
  const dateStr = getAgendaDateStr()
  const key = 'agenda_' + dateStr
  const raw = JSON.parse(localStorage.getItem(key)||'{}')
  const color = type==='habit'
    ? (CAT_COLORS[(allActivities.find(a=>a.id===id)||{}).category]||'#888')
    : ((CATS[(allTasks.find(t=>t.id===id)||{}).category]||CATS.habitos).color)
  for(const sk of _agendaSelectedSlots){
    if(!raw[sk]) raw[sk]=[]
    if(!raw[sk].find(x=>x.id===id)){
      raw[sk].push({id, dur, type, title, color})
    }
  }
  localStorage.setItem(key, JSON.stringify(raw))
  document.getElementById('agenda-multisel-panel').style.display='none'
  agendaClearSelection()
  renderAgenda()
  showToast(`✅ "${title}" agregado a ${_agendaSelectedSlots.size||'los'} slots`)
}

function agendaSelDelete(){
  if(!_agendaSelectedSlots.size) return
  const dateStr = getAgendaDateStr()
  const key = 'agenda_' + dateStr
  const raw = JSON.parse(localStorage.getItem(key)||'{}')
  let removed = 0
  for(const sk of _agendaSelectedSlots){
    if(raw[sk]){ removed += raw[sk].length; delete raw[sk] }
  }
  localStorage.setItem(key, JSON.stringify(raw))
  agendaClearSelection()
  renderAgenda()
  showToast(`🗑️ ${removed} ítem${removed!==1?'s':''} eliminados`)
}

function agendaSelMove(){
  if(!_agendaSelectedSlots.size){ showToast('⚠️ Selecciona slots primero'); return }
  if(!_agendaClipboard){ showToast('⚠️ Haz click derecho en un bloque y usa "Duplicar" primero'); return }
  const dateStr = getAgendaDateStr()
  const key = 'agenda_' + dateStr
  const raw = JSON.parse(localStorage.getItem(key)||'{}')
  // Remove from original slot
  const origSk = _agendaClipboard.slotKey
  if(raw[origSk]){
    raw[origSk] = raw[origSk].filter(x => x.id !== _agendaClipboard.item.id)
    if(!raw[origSk].length) delete raw[origSk]
  }
  // Add to all selected slots
  for(const sk of _agendaSelectedSlots){
    if(!raw[sk]) raw[sk]=[]
    if(!raw[sk].find(x=>x.id===_agendaClipboard.item.id)){
      raw[sk].push({..._agendaClipboard.item})
    }
  }
  localStorage.setItem(key, JSON.stringify(raw))
  _agendaClipboard = null
  agendaClearSelection()
  renderAgenda()
  showToast('↔️ Ítem movido a los slots seleccionados')
}

// ── Agenda copy/paste ─────────────────────────────────────────────────────────
let _agendaClipboard = null  // {slotKey, item}
let _agendaPasteMode = false

function agendaChipRightClick(event, slotKey, itemId){
  event.preventDefault()
  event.stopPropagation()
  const menu = document.getElementById('agenda-ctx-menu')
  menu.style.display = 'block'
  menu.style.left = Math.min(event.clientX, window.innerWidth-200) + 'px'
  menu.style.top  = Math.min(event.clientY, window.innerHeight-100) + 'px'
  menu.dataset.slot   = slotKey
  menu.dataset.itemId = itemId
  const moverBtn = document.getElementById('ctx-mover-seleccion')
  if(moverBtn) moverBtn.style.display = _agendaSelectedSlots.size > 0 ? 'block' : 'none'
}

function agendaCtxMoverASeleccion(){
  const menu = document.getElementById('agenda-ctx-menu')
  const slotKey = menu.dataset.slot
  const itemId  = menu.dataset.itemId
  const data    = getAgendaData()
  const item = (data[slotKey]||[]).find(x => String(x.id) === String(itemId))
  if(!item){ agendaCtxClose(); return }
  _agendaClipboard = { slotKey, item: {...item} }
  agendaCtxClose()
  agendaSelMove()
}

function agendaCtxDuplicate(){
  const menu = document.getElementById('agenda-ctx-menu')
  const slotKey = menu.dataset.slot
  const itemId  = menu.dataset.itemId
  const data    = getAgendaData()
  const slotItems = data[slotKey] || []
  const item = slotItems.find(x => String(x.id) === String(itemId))
  if(!item){ agendaCtxClose(); return }
  _agendaClipboard = { slotKey, item: {...item} }
  _agendaPasteMode = true
  agendaCtxClose()
  showToast('📋 Click en el slot destino para pegar — Esc para cancelar')
}

function agendaCtxClose(){
  document.getElementById('agenda-ctx-menu').style.display = 'none'
}

function agendaPaste(destSlotKey){
  if(!_agendaPasteMode || !_agendaClipboard) return
  const dateStr = getAgendaDateStr()
  const key = 'agenda_' + dateStr
  const raw = JSON.parse(localStorage.getItem(key) || '{}')
  if(!raw[destSlotKey]) raw[destSlotKey] = []
  const newItem = {..._agendaClipboard.item, id: _agendaClipboard.item.id}
  if(!raw[destSlotKey].find(x => x.id === newItem.id && x.title === newItem.title)){
    raw[destSlotKey].push(newItem)
    localStorage.setItem(key, JSON.stringify(raw))
    if(getAgendaDateStr() === dateStr) renderAgenda()
    showToast('✅ Pegado en ' + destSlotKey)
  } else {
    showToast('⚠️ Ya existe en ese slot')
  }
  _agendaPasteMode = false
  _agendaClipboard = null
}

document.addEventListener('mouseup', e => {
  _agendaSelecting = false
  // Paste mode: pegar en el slot clickeado
  if(_agendaPasteMode && _agendaClipboard){
    const content = e.target.closest('[data-slot]')
    if(content){
      const sk = content.dataset.slot
      if(sk) agendaPaste(sk)
    }
  }
})

document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    if(_agendaPasteMode){ _agendaPasteMode=false; _agendaClipboard=null; showToast('❌ Pegado cancelado') }
    if(_agendaSelectedSlots.size) agendaClearSelection()
    agendaCtxClose()
    document.getElementById('agenda-multisel-panel').style.display='none'
  }
})
document.addEventListener('click', e => {
  if(!document.getElementById('agenda-ctx-menu').contains(e.target)) agendaCtxClose()
})
