// js/estudio.js — Módulo Estudio IArcanIA OS
// Depende de: SB_P (global), USER_ID (global), showToast (global)

;(function () {
'use strict'

// ── Estado ────────────────────────────────────────────────────
let _brands       = []
let _scripts      = []
let _slides       = []
let _activeScript = null
let _filterBrand  = 'all'
let _filterEstado = 'all'
let _initialized  = false
let _presOpen     = false
let _presIdx      = 0
let _presFading   = false

// ── Constantes ────────────────────────────────────────────────
const ESTADOS = ['idea', 'borrador', 'aprobado', 'grabado', 'publicado']
const PLATAFORMAS = ['tiktok', 'reels', 'youtube', 'linkedin']
const TIPOS_SLIDE = ['portada', 'punto', 'cita', 'dato', 'cierre']

const ESTADO_COLORS = {
  idea:      '#64748B',
  borrador:  '#EF9F27',
  aprobado:  '#5DCAA5',
  grabado:   '#378ADD',
  publicado: '#8B6CF6',
}

// ── Utilidades ────────────────────────────────────────────────
const $    = id => document.getElementById(id)
const esc  = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const uid  = () => typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
const fmtDate  = d => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : ''
const brand    = id => _brands.find(b => b.id === id)
const capFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

// ── CSS ───────────────────────────────────────────────────────
function injectStyles() {
  if ($('est-styles')) return
  const s = document.createElement('style')
  s.id = 'est-styles'
  s.textContent = `
/* ── Layout ── */
#section-estudio { overflow-y: auto; }
.est-wrap { padding: 24px; max-width: 940px; }

/* ── Header ── */
.est-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.est-page-title { font-family:'Playfair Display',serif; font-size:22px; color:var(--text); }
.est-filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; align-items:center; }
.est-filter-sel { height:30px; padding:0 10px; border-radius:6px; border:1px solid var(--border);
  background:#111; color:var(--text-muted); font-family:'Outfit',sans-serif; font-size:12px; outline:none; cursor:pointer; }
.est-filter-sel:focus { border-color:#333; color:var(--text); }

/* ── Cards ── */
.est-grid { display:flex; flex-direction:column; gap:8px; }
.est-card { background:var(--bg-card); border:1px solid var(--border); border-radius:10px;
  padding:14px 16px; cursor:pointer; transition:border-color .15s; }
.est-card:hover { border-color:#2a2a2a; }
.est-card-top { display:flex; align-items:center; gap:10px; margin-bottom:5px; }
.est-brand-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.est-card-title { font-size:14px; font-weight:600; color:var(--text); flex:1; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; }
.est-badge { display:inline-block; font-size:10px; font-weight:600; letter-spacing:.5px;
  padding:2px 8px; border-radius:100px; white-space:nowrap; }
.est-card-meta { font-size:11px; color:var(--text-muted); display:flex; gap:10px;
  margin-left:18px; flex-wrap:wrap; }

/* ── Buttons ── */
.est-btn { height:34px; padding:0 16px; border-radius:7px; border:none;
  font-family:'Outfit',sans-serif; font-size:13px; font-weight:500; cursor:pointer;
  display:inline-flex; align-items:center; gap:6px; transition:opacity .12s; }
.est-btn-primary  { background:var(--purple); color:#fff; }
.est-btn-primary:hover  { opacity:.85; }
.est-btn-ghost    { background:transparent; border:1px solid var(--border); color:var(--text-muted); }
.est-btn-ghost:hover    { border-color:#333; color:var(--text); }
.est-btn-present  { background:linear-gradient(135deg,#7C3AED 0%,#22D3EE 100%); color:#fff; font-weight:600; }
.est-btn-present:hover  { opacity:.88; }
.est-btn-danger   { background:transparent; border:1px solid rgba(226,75,74,0.3); color:#E24B4A; }
.est-btn-sm { height:28px; padding:0 10px; font-size:11px; }

/* ── Back ── */
.est-back { display:inline-flex; align-items:center; gap:6px; color:var(--text-muted);
  font-size:12px; cursor:pointer; padding:0; background:none; border:none; margin-bottom:16px; }
.est-back:hover { color:var(--text); }

/* ── Detail grid ── */
.est-detail { display:grid; grid-template-columns:1fr 300px; gap:20px; align-items:start; }
@media(max-width:760px){ .est-detail{ grid-template-columns:1fr; } }

/* ── Form ── */
.est-form { display:flex; flex-direction:column; gap:12px; }
.est-field { display:flex; flex-direction:column; gap:4px; }
.est-label { font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); }
.est-input { background:#0C0C0C; border:1px solid var(--border); border-radius:8px;
  padding:9px 11px; color:var(--text); font-family:'Outfit',sans-serif; font-size:13px;
  outline:none; width:100%; box-sizing:border-box; }
.est-input:focus { border-color:rgba(139,108,246,.4); }
.est-textarea { resize:vertical; min-height:80px; }
.est-select { cursor:pointer; }
.est-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.est-actions { display:flex; gap:8px; flex-wrap:wrap; }

/* ── Slides panel ── */
.est-slides-panel { background:var(--bg-card); border:1px solid var(--border);
  border-radius:10px; padding:16px; position:sticky; top:20px; }
.est-slides-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.est-slides-label { font-size:12px; font-weight:600; color:var(--text); }
.est-slide-item { background:#0a0a0a; border:1px solid var(--border); border-radius:8px;
  padding:10px 12px; margin-bottom:6px; position:relative; }
.est-slide-item:hover .est-sl-ctrl { opacity:1; }
.est-tipo-tag { display:inline-block; font-size:9px; font-weight:700; letter-spacing:1px;
  text-transform:uppercase; padding:2px 7px; border-radius:100px;
  background:rgba(139,108,246,.1); border:1px solid rgba(139,108,246,.2);
  color:var(--purple); margin-bottom:4px; }
.est-slide-main { font-size:12px; color:var(--text-muted); line-height:1.5;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.est-slide-sec  { font-size:11px; color:var(--text-muted); opacity:.55; margin-top:1px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.est-sl-ctrl { position:absolute; top:6px; right:6px; display:flex; gap:2px; opacity:0; transition:opacity .12s; }
.est-sl-ctrl button { background:none; border:none; color:var(--text-muted); cursor:pointer;
  font-size:12px; padding:2px 4px; line-height:1; border-radius:4px; }
.est-sl-ctrl button:hover { color:var(--text); background:#1a1a1a; }
.est-sl-del { color:rgba(226,75,74,.5) !important; }
.est-sl-del:hover { color:#E24B4A !important; }

/* ── Add slide ── */
.est-add-form { background:#0a0a0a; border:1px dashed #2a2a2a; border-radius:8px;
  padding:12px; margin-top:8px; display:flex; flex-direction:column; gap:8px; }

/* ─────────────────────────────────────────────────────────────
   PRESENTER
───────────────────────────────────────────────────────────── */
#est-presenter {
  display: none; position: fixed; inset: 0; z-index: 9999;
  flex-direction: column; background: var(--pres-bg, #0A0A0A);
  color: var(--pres-texto, #fff);
}
#est-presenter.pres-open { display: flex; }
.est-pres-body {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 48px 80px; overflow: hidden;
}
.est-pres-body.fading { opacity: 0; transition: opacity .15s; }
.est-pres-foot {
  height: 4px; background: rgba(255,255,255,.07); flex-shrink: 0; position: relative;
}
.est-pres-bar { height: 100%; transition: width .3s ease; }
.est-pres-counter {
  position: absolute; bottom: 10px; right: 18px;
  font-size: 11px; font-family: 'Outfit',sans-serif; color: rgba(255,255,255,.2);
}
.est-pres-hint {
  position: absolute; bottom: 10px; left: 18px;
  font-size: 11px; font-family: 'Outfit',sans-serif; color: rgba(255,255,255,.15);
}

/* ── Slide layouts ── */
.sl-portada {
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 28px; max-width: 800px; width: 100%;
}
.sl-portada .logo { max-height: 64px; opacity: .9; }
.sl-portada .tit  {
  font-size: clamp(34px, 5.5vw, 72px); font-weight: 700; line-height: 1.12; letter-spacing: -.5px;
}
.sl-portada .sub  { font-size: clamp(16px,2.2vw,26px); opacity: .6; }

.sl-punto { display: flex; flex-direction: column; gap: 20px; max-width: 800px; width: 100%; }
.sl-punto .main { font-size: clamp(28px,4.5vw,60px); font-weight: 700; line-height: 1.18; }
.sl-punto .sub  { font-size: clamp(16px,2.2vw,26px); opacity: .65; line-height: 1.55; }

.sl-cita {
  max-width: 780px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
}
.sl-cita .qmark  { font-size: 96px; line-height: .7; opacity: .2; font-family: Georgia,serif; }
.sl-cita .main   { font-size: clamp(22px,3.5vw,48px); font-style: italic; font-weight: 500; line-height: 1.38; }
.sl-cita .author { font-size: clamp(14px,1.6vw,22px); opacity: .5; margin-top: 6px; }

.sl-dato {
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 14px;
}
.sl-dato .num { font-size: clamp(64px,12vw,140px); font-weight: 800; line-height: 1; }
.sl-dato .ctx { font-size: clamp(16px,2.2vw,28px); opacity: .6; max-width: 600px; }

.sl-cierre {
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 22px; max-width: 780px; width: 100%;
}
.sl-cierre .cta  { font-size: clamp(24px,4vw,56px); font-weight: 700; line-height: 1.25; }
.sl-cierre .sub  { font-size: clamp(14px,1.8vw,24px); opacity: .55; }
.sl-cierre .logo { max-height: 54px; opacity: .8; margin-top: 8px; }
`
  document.head.appendChild(s)
}

// ── Presenter DOM ─────────────────────────────────────────────
function buildPresenterDOM() {
  if ($('est-presenter')) return
  const div = document.createElement('div')
  div.id = 'est-presenter'
  div.innerHTML = `
    <div class="est-pres-body" id="est-pres-body"></div>
    <div class="est-pres-foot">
      <div class="est-pres-bar" id="est-pres-bar"></div>
      <span class="est-pres-counter" id="est-pres-counter"></span>
      <span class="est-pres-hint">← → Espacio · Esc salir</span>
    </div>`
  document.body.appendChild(div)
  document.addEventListener('keydown', onPresKey)
}

// ── Entry point ───────────────────────────────────────────────
async function loadEstudio() {
  if (!_initialized) {
    _initialized = true
    injectStyles()
    buildPresenterDOM()
  }
  const el = $('section-estudio')
  if (!el) return
  el.innerHTML = `<div class="est-wrap"><div class="loading"><div class="spinner"></div></div></div>`

  const [brandsRes, scriptsRes] = await Promise.all([
    SB_P.from('brands').select('*').order('nombre'),
    SB_P.from('scripts').select('*').eq('user_id', USER_ID).order('created_at', { ascending: false }),
  ])
  _brands  = brandsRes.data  || []
  _scripts = scriptsRes.data || []
  renderList()
}

// ── Vista: Lista ──────────────────────────────────────────────
function renderList() {
  const el = $('section-estudio')
  if (!el) return

  const brandOpts  = _brands.map(b => `<option value="${esc(b.id)}">${esc(b.nombre)}</option>`).join('')
  const estadoOpts = ESTADOS.map(e => `<option value="${e}">${capFirst(e)}</option>`).join('')

  let filtered = _scripts
  if (_filterBrand  !== 'all') filtered = filtered.filter(s => s.brand_id === _filterBrand)
  if (_filterEstado !== 'all') filtered = filtered.filter(s => s.estado   === _filterEstado)

  const cards = filtered.length
    ? filtered.map(cardHTML).join('')
    : `<div class="empty-state"><div class="empty-icon">🎬</div>No hay guiones todavía</div>`

  el.innerHTML = `<div class="est-wrap">
    <div class="est-hdr">
      <div class="est-page-title">Estudio</div>
      <button class="est-btn est-btn-primary" onclick="_est.newScript()">+ Nuevo guion</button>
    </div>
    <div class="est-filters">
      <select class="est-filter-sel" onchange="_est.filterBrand(this.value)">
        <option value="all">Todas las marcas</option>
        ${brandOpts}
      </select>
      <select class="est-filter-sel" onchange="_est.filterEstado(this.value)">
        <option value="all">Todos los estados</option>
        ${estadoOpts}
      </select>
    </div>
    <div class="est-grid">${cards}</div>
  </div>`

  const [bSel, eSel] = el.querySelectorAll('.est-filter-sel')
  if (bSel) bSel.value = _filterBrand
  if (eSel) eSel.value = _filterEstado
}

function cardHTML(s) {
  const b     = brand(s.brand_id)
  const dot   = b?.colores?.primario || '#555'
  const ec    = ESTADO_COLORS[s.estado] || '#555'
  return `<div class="est-card" onclick="_est.openScript('${s.id}')">
    <div class="est-card-top">
      <div class="est-brand-dot" style="background:${esc(dot)}"></div>
      <div class="est-card-title">${esc(s.titulo)}</div>
      <span class="est-badge" style="background:${esc(ec)}22;color:${esc(ec)};border:1px solid ${esc(ec)}44">
        ${esc(s.estado)}
      </span>
    </div>
    <div class="est-card-meta">
      ${b ? `<span>${esc(b.nombre)}</span>` : ''}
      ${s.plataforma ? `<span>${esc(s.plataforma)}</span>` : ''}
      <span>${fmtDate(s.created_at)}</span>
    </div>
  </div>`
}

// ── Vista: Detalle/Edición ────────────────────────────────────
async function openScript(id) {
  _activeScript = _scripts.find(s => s.id === id) || null
  if (!_activeScript) return
  const { data } = await SB_P.from('script_slides')
    .select('*').eq('script_id', id).order('orden')
  _slides = data || []
  renderDetail()
}

function renderDetail() {
  const s  = _activeScript
  if (!s) return
  const el = $('section-estudio')
  if (!el) return

  const b      = brand(s.brand_id)
  const dot    = b?.colores?.primario || '#555'

  const bOpts  = _brands.map(b2 =>
    `<option value="${esc(b2.id)}" ${s.brand_id===b2.id?'selected':''}>${esc(b2.nombre)}</option>`
  ).join('')
  const platOpts = [['', '— Plataforma —'], ...PLATAFORMAS.map(p => [p, p])].map(([v,l]) =>
    `<option value="${v}" ${s.plataforma===v?'selected':''}>${esc(l)}</option>`
  ).join('')
  const estOpts = ESTADOS.map(e =>
    `<option value="${e}" ${s.estado===e?'selected':''}>${capFirst(e)}</option>`
  ).join('')

  el.innerHTML = `<div class="est-wrap">
    <button class="est-back" onclick="_est.backToList()">← Estudio</button>
    <div class="est-detail">

      <!-- Formulario -->
      <div class="est-form">
        <div class="est-card-top" style="margin-bottom:8px">
          <div class="est-brand-dot" style="background:${esc(dot)};width:10px;height:10px"></div>
          <div style="font-family:'Playfair Display',serif;font-size:17px;color:var(--text)">
            ${esc(s.titulo || 'Sin título')}
          </div>
        </div>

        <div class="est-form-row">
          <div class="est-field">
            <div class="est-label">Marca</div>
            <select class="est-input est-select" onchange="_est.setField('brand_id',this.value)">
              ${bOpts}
            </select>
          </div>
          <div class="est-field">
            <div class="est-label">Plataforma</div>
            <select class="est-input est-select" onchange="_est.setField('plataforma',this.value)">
              ${platOpts}
            </select>
          </div>
        </div>

        <div class="est-form-row">
          <div class="est-field">
            <div class="est-label">Título</div>
            <input class="est-input" value="${esc(s.titulo)}"
              oninput="_est.setField('titulo',this.value)">
          </div>
          <div class="est-field">
            <div class="est-label">Estado</div>
            <select class="est-input est-select" onchange="_est.setField('estado',this.value)">
              ${estOpts}
            </select>
          </div>
        </div>

        <div class="est-field">
          <div class="est-label">Tema</div>
          <input class="est-input" value="${esc(s.tema)}"
            oninput="_est.setField('tema',this.value)" placeholder="Tema central del video">
        </div>

        <div class="est-field">
          <div class="est-label">Hook</div>
          <textarea class="est-input est-textarea"
            oninput="_est.setField('hook',this.value)">${esc(s.hook)}</textarea>
        </div>

        <div class="est-field">
          <div class="est-label">Contenido</div>
          <textarea class="est-input est-textarea" style="min-height:120px"
            oninput="_est.setField('contenido',this.value)">${esc(s.contenido)}</textarea>
        </div>

        <div class="est-field">
          <div class="est-label">CTA</div>
          <input class="est-input" value="${esc(s.cta)}"
            oninput="_est.setField('cta',this.value)" placeholder="Llamada a la acción">
        </div>

        <div class="est-actions">
          <button class="est-btn est-btn-primary" onclick="_est.saveScript()">Guardar</button>
          <button class="est-btn est-btn-present" onclick="_est.openPresenter()">▶ Presentar</button>
          <button class="est-btn est-btn-danger" onclick="_est.deleteScript()">Eliminar</button>
        </div>
      </div>

      <!-- Panel de slides -->
      <div class="est-slides-panel">
        <div class="est-slides-hdr">
          <div class="est-slides-label">Slides <span id="est-sl-count">(${_slides.length})</span></div>
          <button class="est-btn est-btn-ghost est-btn-sm"
            onclick="_est.toggleAddSlide()">+ Agregar</button>
        </div>
        <div id="est-slides-list">${renderSlidesListHTML()}</div>
        <div id="est-add-form" style="display:none" class="est-add-form">
          ${addSlideFormHTML()}
        </div>
      </div>

    </div>
  </div>`
}

function renderSlidesListHTML() {
  if (!_slides.length)
    return `<div style="font-size:11px;color:var(--text-muted);padding:6px 0">Sin slides — agrega el primero</div>`
  return _slides.map((sl, i) => slideItemHTML(sl, i)).join('')
}

function slideItemHTML(sl, i) {
  const isFirst = i === 0
  const isLast  = i === _slides.length - 1
  return `<div class="est-slide-item" id="est-sl-${sl.id}">
    <div class="est-tipo-tag">${esc(sl.tipo)}</div>
    <div class="est-slide-main">${esc(sl.texto_principal)}</div>
    ${sl.texto_secundario ? `<div class="est-slide-sec">${esc(sl.texto_secundario)}</div>` : ''}
    <div class="est-sl-ctrl">
      ${!isFirst ? `<button title="Subir" onclick="_est.moveSlide('${sl.id}',-1)">↑</button>` : ''}
      ${!isLast  ? `<button title="Bajar" onclick="_est.moveSlide('${sl.id}',1)">↓</button>`  : ''}
      <button class="est-sl-del" title="Eliminar" onclick="_est.deleteSlide('${sl.id}')">✕</button>
    </div>
  </div>`
}

function addSlideFormHTML() {
  const tipoOpts = TIPOS_SLIDE.map(t =>
    `<option value="${t}">${capFirst(t)}</option>`
  ).join('')
  return `
    <div class="est-field">
      <div class="est-label">Tipo</div>
      <select class="est-input est-select" id="new-sl-tipo">${tipoOpts}</select>
    </div>
    <div class="est-field">
      <div class="est-label">Texto principal</div>
      <textarea class="est-input est-textarea" id="new-sl-main"
        style="min-height:56px" placeholder="Texto principal del slide"></textarea>
    </div>
    <div class="est-field">
      <div class="est-label">Texto secundario (opcional)</div>
      <input class="est-input" id="new-sl-sec" placeholder="Subtítulo, contexto…">
    </div>
    <div style="display:flex;gap:6px;margin-top:4px">
      <button class="est-btn est-btn-primary est-btn-sm" onclick="_est.addSlide()">Agregar</button>
      <button class="est-btn est-btn-ghost est-btn-sm" onclick="_est.toggleAddSlide()">Cancelar</button>
    </div>`
}

// ── CRUD Scripts ──────────────────────────────────────────────
async function newScript() {
  const defaultBrand = _brands[0]?.id || ''
  const { data, error } = await SB_P.from('scripts').insert({
    id: uid(), user_id: USER_ID, brand_id: defaultBrand,
    titulo: 'Nuevo guion', estado: 'idea',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single()
  if (error) { showToast('❌ ' + error.message); return }
  _scripts.unshift(data)
  await openScript(data.id)
}

function setField(key, val) {
  if (_activeScript) _activeScript[key] = val
}

async function saveScript() {
  if (!_activeScript) return
  const s = _activeScript
  const { error } = await SB_P.from('scripts').update({
    brand_id: s.brand_id, titulo: s.titulo, tema: s.tema,
    plataforma: s.plataforma, hook: s.hook, contenido: s.contenido,
    cta: s.cta, estado: s.estado, updated_at: new Date().toISOString(),
  }).eq('id', s.id)
  if (error) { showToast('❌ ' + error.message); return }
  const idx = _scripts.findIndex(x => x.id === s.id)
  if (idx >= 0) _scripts[idx] = { ..._scripts[idx], ...s }
  showToast('✅ Guion guardado')
  // Refresh title in detail header
  const hdr = document.querySelector('.est-detail .est-card-top div:last-child')
  if (hdr) hdr.textContent = s.titulo || 'Sin título'
}

async function deleteScript() {
  if (!_activeScript || !confirm('¿Eliminar este guion y todos sus slides?')) return
  await SB_P.from('script_slides').delete().eq('script_id', _activeScript.id)
  const { error } = await SB_P.from('scripts').delete().eq('id', _activeScript.id)
  if (error) { showToast('❌ ' + error.message); return }
  _scripts = _scripts.filter(s => s.id !== _activeScript.id)
  _activeScript = null
  showToast('🗑 Guion eliminado')
  renderList()
}

// ── CRUD Slides ───────────────────────────────────────────────
function toggleAddSlide() {
  const form = $('est-add-form')
  if (!form) return
  const open = form.style.display !== 'none'
  form.style.display = open ? 'none' : 'block'
  if (!open) { const ta = $('new-sl-main'); if (ta) ta.focus() }
}

async function addSlide() {
  if (!_activeScript) return
  const tipo = $('new-sl-tipo')?.value || 'punto'
  const main = ($('new-sl-main')?.value || '').trim()
  const sec  = ($('new-sl-sec')?.value  || '').trim() || null
  if (!main) { showToast('⚠️ El texto principal es obligatorio'); return }

  const maxOrden = _slides.length ? Math.max(..._slides.map(s => s.orden)) : -1
  const { data, error } = await SB_P.from('script_slides').insert({
    id: uid(), script_id: _activeScript.id,
    orden: maxOrden + 1, tipo,
    texto_principal: main, texto_secundario: sec,
    created_at: new Date().toISOString(),
  }).select().single()
  if (error) { showToast('❌ ' + error.message); return }
  _slides.push(data)
  showToast('✅ Slide agregado')
  refreshSlidesList()
  toggleAddSlide()
  if ($('new-sl-main')) $('new-sl-main').value = ''
  if ($('new-sl-sec'))  $('new-sl-sec').value  = ''
}

async function deleteSlide(id) {
  if (!confirm('¿Eliminar este slide?')) return
  const { error } = await SB_P.from('script_slides').delete().eq('id', id)
  if (error) { showToast('❌ ' + error.message); return }
  _slides = _slides.filter(s => s.id !== id)
  showToast('🗑 Slide eliminado')
  refreshSlidesList()
}

async function moveSlide(id, dir) {
  const idx = _slides.findIndex(s => s.id === id)
  if (idx < 0) return
  const next = idx + dir
  if (next < 0 || next >= _slides.length) return
  ;[_slides[idx], _slides[next]] = [_slides[next], _slides[idx]]
  await Promise.all([
    SB_P.from('script_slides').update({ orden: idx  }).eq('id', _slides[idx].id),
    SB_P.from('script_slides').update({ orden: next }).eq('id', _slides[next].id),
  ])
  _slides[idx].orden = idx
  _slides[next].orden = next
  refreshSlidesList()
}

function refreshSlidesList() {
  const el = $('est-slides-list')
  if (el) el.innerHTML = renderSlidesListHTML()
  const cnt = $('est-sl-count')
  if (cnt) cnt.textContent = `(${_slides.length})`
}

// ── Navegación ────────────────────────────────────────────────
function backToList()    { _activeScript = null; _slides = []; renderList() }
function filterBrand(v)  { _filterBrand  = v; renderList() }
function filterEstado(v) { _filterEstado = v; renderList() }

// ── Presenter ─────────────────────────────────────────────────
function applyBrandVars(b) {
  const pres = $('est-presenter')
  if (!pres) return
  const c = b?.colores || {}
  pres.style.setProperty('--pres-bg',      c.fondo    || '#0A0A0A')
  pres.style.setProperty('--pres-primario', c.primario || '#7C3AED')
  pres.style.setProperty('--pres-texto',   c.texto    || '#FFFFFF')
  pres.style.setProperty('--pres-acento',  c.acento   || '#22D3EE')
  pres.style.background = c.fondo || '#0A0A0A'
  pres.style.color      = c.texto || '#FFFFFF'
  pres.style.fontFamily = b?.tipografia
    ? `'${b.tipografia}', sans-serif`
    : "'Inter', system-ui, sans-serif"
}

async function openPresenter() {
  if (!_activeScript) return
  if (!_slides.length) { showToast('⚠️ Agrega al menos un slide antes de presentar'); return }

  const b = brand(_activeScript.brand_id)
  applyBrandVars(b)

  _presIdx = 0
  const pres = $('est-presenter')
  pres.classList.add('pres-open')
  _presOpen = true
  renderPresSlide()

  try {
    const fn = pres.requestFullscreen || pres.webkitRequestFullscreen || pres.mozRequestFullScreen
    if (fn) await fn.call(pres)
  } catch {}
}

function closePresenter() {
  const pres = $('est-presenter')
  if (!pres) return
  pres.classList.remove('pres-open')
  _presOpen = false
  try {
    ;(document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen
    )?.call(document)
  } catch {}
}

function renderPresSlide() {
  const sl  = _slides[_presIdx]
  const b   = brand(_activeScript?.brand_id)
  const body = $('est-pres-body')
  if (!body || !sl) return

  body.innerHTML = buildSlideHTML(sl, _activeScript, b)

  const bar = $('est-pres-bar')
  if (bar) {
    bar.style.background = b?.colores?.primario || '#7C3AED'
    bar.style.width = (((_presIdx + 1) / _slides.length) * 100) + '%'
  }
  const cnt = $('est-pres-counter')
  if (cnt) cnt.textContent = `${_presIdx + 1} / ${_slides.length}`
}

function buildSlideHTML(sl, script, b) {
  const primario = b?.colores?.primario || '#7C3AED'
  const logoUrl  = b?.logo_url || ''
  const logoHtml = logoUrl
    ? `<img class="logo" src="${esc(logoUrl)}" alt="${esc(b?.nombre || '')}" onerror="this.style.display='none'">`
    : ''

  switch (sl.tipo) {

    case 'portada':
      return `<div class="sl-portada">
        ${logoHtml}
        <div class="tit">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div class="sub">${esc(sl.texto_secundario)}</div>` : ''}
      </div>`

    case 'punto':
      return `<div class="sl-punto">
        <div class="main">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div class="sub">${esc(sl.texto_secundario)}</div>` : ''}
      </div>`

    case 'cita':
      return `<div class="sl-cita">
        <div class="qmark" style="color:${esc(primario)}">"</div>
        <div class="main">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario
          ? `<div class="author">— ${esc(sl.texto_secundario)}</div>`
          : ''}
      </div>`

    case 'dato':
      return `<div class="sl-dato">
        <div class="num" style="color:${esc(primario)}">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div class="ctx">${esc(sl.texto_secundario)}</div>` : ''}
      </div>`

    case 'cierre':
      return `<div class="sl-cierre">
        <div class="cta">${esc(script?.cta || sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div class="sub">${esc(sl.texto_secundario)}</div>` : ''}
        ${logoHtml}
      </div>`

    default:
      return `<div class="sl-punto">
        <div class="main">${esc(sl.texto_principal)}</div>
      </div>`
  }
}

function presNext() { if (_presIdx < _slides.length - 1) { _presIdx++; fadeToSlide() } }
function presPrev() { if (_presIdx > 0) { _presIdx--; fadeToSlide() } }

function fadeToSlide() {
  if (_presFading) return
  _presFading = true
  const body = $('est-pres-body')
  if (body) {
    body.style.opacity = '0'
    body.style.transition = 'opacity .15s'
    setTimeout(() => {
      renderPresSlide()
      body.style.opacity = '1'
      _presFading = false
    }, 160)
  }
}

function onPresKey(ev) {
  if (!_presOpen) return
  if (ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); presNext() }
  if (ev.key === 'ArrowLeft')                    { ev.preventDefault(); presPrev() }
  if (ev.key === 'Escape')                       { ev.preventDefault(); closePresenter() }
}

// ── API pública ───────────────────────────────────────────────
window._est = {
  newScript, openScript, saveScript, deleteScript, setField,
  backToList, filterBrand, filterEstado,
  addSlide, deleteSlide, moveSlide, toggleAddSlide,
  openPresenter,
}
window.loadEstudio = loadEstudio

})()
