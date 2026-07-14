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
let _directorWin  = null

// ── Constantes ────────────────────────────────────────────────
const ESTADOS      = ['idea', 'borrador', 'aprobado', 'grabado', 'publicado']
const PLATAFORMAS  = ['tiktok', 'reels', 'youtube', 'linkedin']
const TIPOS_SLIDE  = ['portada', 'punto', 'cita', 'dato', 'cierre']

const ESTADO_COLORS = {
  idea:      '#64748B',
  borrador:  '#EF9F27',
  aprobado:  '#5DCAA5',
  grabado:   '#378ADD',
  publicado: '#8B6CF6',
}

// ── Utilidades ────────────────────────────────────────────────
const $      = id => document.getElementById(id)
const esc    = s  => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const uid    = () => typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c==='x'?r:(r&0x3|0x8)).toString(16)
    })
const fmtDate  = d  => d ? new Date(d).toLocaleDateString('es-CO',{day:'2-digit',month:'short'}) : ''
const brand    = id => _brands.find(b => b.id === id)
const capFirst = s  => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''

// Luminancia relativa — determina si un color hex es oscuro
function isDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return true
  const r = parseInt(hex.slice(1,3),16)/255
  const g = parseInt(hex.slice(3,5),16)/255
  const b = parseInt(hex.slice(5,7),16)/255
  return 0.299*r + 0.587*g + 0.114*b < 0.5
}

// hex → rgba string
function rgba(hex, a) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(120,120,120,${a})`
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

// Carga una fuente de Google Fonts si no está ya cargada
const _loadedFonts = new Set()
function ensureFont(family) {
  if (!family || _loadedFonts.has(family)) return
  _loadedFonts.add(family)
  const link = document.createElement('link')
  link.rel  = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`
  document.head.appendChild(link)
}

// ── CSS base (estático — no depende de marca) ──────────────────
function injectStyles() {
  if ($('est-styles')) return
  const s = document.createElement('style')
  s.id = 'est-styles'
  s.textContent = `
/* ── Layout ── */
#section-estudio { overflow-y:auto; }
.est-wrap { padding:24px; max-width:960px; }

/* ── Lista ── */
.est-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
.est-page-title { font-family:'Playfair Display',serif; font-size:22px; color:var(--text); }
.est-filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; align-items:center; }
.est-filter-sel { height:30px; padding:0 10px; border-radius:6px; border:1px solid var(--border);
  background:#111; color:var(--text-muted); font-family:'Outfit',sans-serif; font-size:12px;
  outline:none; cursor:pointer; }
.est-filter-sel:focus { border-color:#333; color:var(--text); }
.est-grid { display:flex; flex-direction:column; gap:8px; }
.est-card { background:var(--bg-card); border:1px solid var(--border); border-radius:10px;
  padding:14px 16px; cursor:pointer; transition:border-color .15s; }
.est-card:hover { border-color:#2a2a2a; }
.est-card-top { display:flex; align-items:center; gap:10px; margin-bottom:5px; }
.est-brand-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.est-card-title { font-size:14px; font-weight:600; color:var(--text); flex:1;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.est-badge { display:inline-block; font-size:10px; font-weight:600; letter-spacing:.5px;
  padding:2px 8px; border-radius:100px; white-space:nowrap; }
.est-card-meta { font-size:11px; color:var(--text-muted); display:flex; gap:10px;
  margin-left:18px; flex-wrap:wrap; }

/* ── Botones base ── */
.est-btn { height:34px; padding:0 16px; border-radius:7px; border:none;
  font-family:'Outfit',sans-serif; font-size:13px; font-weight:500; cursor:pointer;
  display:inline-flex; align-items:center; gap:6px; transition:opacity .12s; }
.est-btn-sm { height:28px; padding:0 10px; font-size:11px; }
.est-btn-ghost  { background:transparent; border:1px solid var(--border); color:var(--text-muted); }
.est-btn-ghost:hover { border-color:#444; color:var(--text); }
.est-btn-danger { background:transparent; border:1px solid rgba(226,75,74,.3); color:#E24B4A; }
.est-btn-danger:hover { background:rgba(226,75,74,.08); }

/* ── Back ── */
.est-back { display:inline-flex; align-items:center; gap:6px; font-size:12px; cursor:pointer;
  padding:0; background:none; border:none; margin-bottom:20px; opacity:.6;
  transition:opacity .15s; font-family:'Outfit',sans-serif; }
.est-back:hover { opacity:1; }

/* ── Editor branded container ── */
.est-editor-branded {
  --ed-fondo:    #0a0a0a;
  --ed-primario: #7C3AED;
  --ed-texto:    #FFFFFF;
  --ed-acento:   #22D3EE;
  --ed-surface:  #111111;
  --ed-border:   rgba(124,58,237,.25);
  --ed-muted:    rgba(255,255,255,.5);
  background: var(--ed-fondo);
  color: var(--ed-texto);
  border-radius: 14px;
  padding: 24px;
  transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
  border: 1px solid var(--ed-border);
  position: relative;
}
.est-editor-branded * { transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease; }

/* Logo de marca en corner */
.est-brand-logo-corner {
  position:absolute; top:20px; right:20px;
  max-height:32px; max-width:100px; opacity:.7;
  object-fit:contain; pointer-events:none;
}

/* ── Detail grid ── */
.est-detail { display:grid; grid-template-columns:1fr 300px; gap:20px; align-items:start; }
@media(max-width:760px){ .est-detail{ grid-template-columns:1fr; } }

/* ── Form dentro del editor branded ── */
.est-form { display:flex; flex-direction:column; gap:14px; }
.est-field { display:flex; flex-direction:column; gap:4px; }
.est-label {
  font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
  color: var(--ed-muted);
}
.est-input {
  background: var(--ed-surface);
  border: 1px solid var(--ed-border);
  border-radius: 8px; padding: 9px 11px;
  color: var(--ed-texto);
  font-family: inherit; font-size: 13px;
  outline: none; width: 100%; box-sizing: border-box;
}
.est-input:focus { border-color: var(--ed-primario); }
.est-textarea { resize:vertical; min-height:80px; }
.est-select { cursor:pointer; }
.est-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.est-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:4px; }

/* Botones que usan los colores de marca */
.est-btn-branded {
  background: var(--ed-primario); color: var(--ed-texto);
  font-family:'Outfit',sans-serif;
}
.est-btn-branded:hover { opacity:.85; }
.est-btn-accent {
  background: var(--ed-acento); color: #000;
  font-family:'Outfit',sans-serif;
}
.est-btn-accent:hover { opacity:.85; }
.est-btn-present {
  background: linear-gradient(135deg, var(--ed-primario) 0%, var(--ed-acento) 100%);
  color: var(--ed-texto); font-weight:600;
  font-family:'Outfit',sans-serif;
}
.est-btn-present:hover { opacity:.88; }

/* Título del guion en el editor */
.est-script-title {
  font-family: 'Playfair Display', serif; font-size: 18px;
  color: var(--ed-texto); margin-bottom: 16px; display:flex;
  align-items:center; gap:10px;
}
.est-script-title .dot {
  width:10px; height:10px; border-radius:50%; flex-shrink:0;
  background: var(--ed-primario);
}

/* ── Panel de slides (columna derecha) ── */
.est-slides-panel {
  background: var(--ed-surface);
  border: 1px solid var(--ed-border);
  border-radius: 10px; padding: 14px;
  position: sticky; top: 20px;
}
.est-slides-hdr {
  display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;
}
.est-slides-label { font-size:12px; font-weight:600; color: var(--ed-texto); }
.est-slides-hdr-btns { display:flex; gap:6px; }

/* ── Miniatura de slide (16:9) ── */
.est-slide-thumb {
  position:relative; width:100%; aspect-ratio:16/9;
  border-radius:6px; overflow:hidden; margin-bottom:8px;
  cursor:default;
}
.est-slide-thumb-inner {
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  padding:8%;
}
.est-slide-thumb-ctrl {
  position:absolute; top:4px; right:4px;
  display:flex; gap:2px; opacity:0; transition:opacity .12s;
}
.est-slide-thumb:hover .est-slide-thumb-ctrl { opacity:1; }
.est-slide-thumb-ctrl button {
  background:rgba(0,0,0,.55); border:none; color:#fff; cursor:pointer;
  font-size:11px; padding:2px 5px; border-radius:3px; line-height:1;
}
.est-slide-thumb-ctrl button:hover { background:rgba(0,0,0,.85); }
.est-slide-thumb-del { color:#ff6b6b !important; }
.est-slide-thumb-num {
  position:absolute; bottom:4px; left:6px;
  font-size:9px; opacity:.4; font-family:'Outfit',sans-serif;
}

/* ── Add slide form ── */
.est-add-form {
  border: 1px dashed var(--ed-border);
  border-radius: 8px; padding:12px; margin-top:8px;
  display:flex; flex-direction:column; gap:8px;
}

/* ─────────────────────────────────────────────────────────────
   PRESENTER
───────────────────────────────────────────────────────────── */
#est-presenter {
  display:none; position:fixed; inset:0; z-index:9999;
  flex-direction:column;
  background: var(--pres-bg,#0A0A0A);
  color: var(--pres-texto,#fff);
}
#est-presenter.pres-open { display:flex; }
.est-pres-body {
  flex:1; display:flex; align-items:center; justify-content:center;
  padding:48px 80px; overflow:hidden;
}
.est-pres-foot {
  height:4px; background:rgba(255,255,255,.07); flex-shrink:0; position:relative;
}
.est-pres-bar  { height:100%; transition:width .3s ease; }
.est-pres-counter {
  position:absolute; bottom:10px; right:18px;
  font-size:11px; font-family:'Outfit',sans-serif; color:rgba(255,255,255,.2);
}
.est-pres-hint {
  position:absolute; bottom:10px; left:18px;
  font-size:11px; font-family:'Outfit',sans-serif; color:rgba(255,255,255,.15);
}
/* Slide layouts fullscreen */
.sl-portada { text-align:center; display:flex; flex-direction:column; align-items:center; gap:28px; max-width:800px; width:100%; }
.sl-portada .logo { max-height:64px; opacity:.9; }
.sl-portada .tit  { font-size:clamp(34px,5.5vw,72px); font-weight:700; line-height:1.12; letter-spacing:-.5px; }
.sl-portada .sub  { font-size:clamp(16px,2.2vw,26px); opacity:.6; }
.sl-punto { display:flex; flex-direction:column; gap:20px; max-width:800px; width:100%; }
.sl-punto .main { font-size:clamp(28px,4.5vw,60px); font-weight:700; line-height:1.18; }
.sl-punto .sub  { font-size:clamp(16px,2.2vw,26px); opacity:.65; line-height:1.55; }
.sl-cita { max-width:780px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:16px; }
.sl-cita .qmark  { font-size:96px; line-height:.7; opacity:.2; font-family:Georgia,serif; }
.sl-cita .main   { font-size:clamp(22px,3.5vw,48px); font-style:italic; font-weight:500; line-height:1.38; }
.sl-cita .author { font-size:clamp(14px,1.6vw,22px); opacity:.5; margin-top:6px; }
.sl-dato { text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; }
.sl-dato .num { font-size:clamp(64px,12vw,140px); font-weight:800; line-height:1; }
.sl-dato .ctx { font-size:clamp(16px,2.2vw,28px); opacity:.6; max-width:600px; }
.sl-cierre { text-align:center; display:flex; flex-direction:column; align-items:center; gap:22px; max-width:780px; width:100%; }
.sl-cierre .cta  { font-size:clamp(24px,4vw,56px); font-weight:700; line-height:1.25; }
.sl-cierre .sub  { font-size:clamp(14px,1.8vw,24px); opacity:.55; }
.sl-cierre .logo { max-height:54px; opacity:.8; margin-top:8px; }
`
  document.head.appendChild(s)
}

// ── Presenter DOM ─────────────────────────────────────────────
function buildPresenterDOM() {
  if ($('est-presenter')) return
  const div = document.createElement('div')
  div.id = 'est-presenter'
  div.innerHTML = `
    <button id="est-director-btn" onclick="_est.openDirector()" style="
      position:absolute;top:12px;right:16px;z-index:10;
      background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
      color:#fff;border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;
      font-family:'Outfit',sans-serif;letter-spacing:.03em;
    ">🎬 Vista Director</button>
    <div class="est-pres-body" id="est-pres-body"></div>
    <div class="est-pres-foot">
      <div class="est-pres-bar" id="est-pres-bar"></div>
      <span class="est-pres-counter" id="est-pres-counter"></span>
      <span class="est-pres-hint">← → Espacio · Esc salir</span>
    </div>`
  document.body.appendChild(div)
  document.addEventListener('keydown', onPresKey)
  window.addEventListener('message', onPresMessage)
  window.addEventListener('message', onDeckMessage)
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
    SB_P.from('scripts').select('*').eq('user_id', USER_ID).order('created_at',{ascending:false}),
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
      <button class="est-btn est-btn-branded" style="background:var(--purple);color:#fff"
        onclick="_est.newScript()">+ Nuevo guion</button>
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
  const b   = brand(s.brand_id)
  const dot = b?.colores?.primario || '#555'
  const ec  = ESTADO_COLORS[s.estado] || '#555'
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

  const b       = brand(s.brand_id)
  const colores = b?.colores || {}

  const bOpts = _brands.map(b2 =>
    `<option value="${esc(b2.id)}" ${s.brand_id===b2.id?'selected':''}>${esc(b2.nombre)}</option>`
  ).join('')
  const platOpts = [['','— Plataforma —'], ...PLATAFORMAS.map(p=>[p,p])].map(([v,l]) =>
    `<option value="${v}" ${s.plataforma===v?'selected':''}>${esc(l)}</option>`
  ).join('')
  const estOpts = ESTADOS.map(e =>
    `<option value="${e}" ${s.estado===e?'selected':''}>${capFirst(e)}</option>`
  ).join('')

  const logoCorner = b?.logo_url
    ? `<img class="est-brand-logo-corner" src="${esc(b.logo_url)}" alt="${esc(b.nombre)}" onerror="this.style.display='none'">`
    : ''

  el.innerHTML = `<div class="est-wrap">
    <button class="est-back" onclick="_est.backToList()" id="est-back-btn">← Estudio</button>

    <div id="est-editor-branded" class="est-editor-branded">
      ${logoCorner}

      <div class="est-script-title" id="est-script-title-hdr">
        <div class="dot"></div>
        <span>${esc(s.titulo || 'Sin título')}</span>
      </div>

      <div class="est-detail">

        <!-- ── Formulario ── -->
        <div class="est-form">

          <div class="est-form-row">
            <div class="est-field">
              <div class="est-label">Marca</div>
              <select class="est-input est-select" id="est-brand-sel"
                onchange="_est.changeBrand(this.value)">
                ${bOpts}
              </select>
            </div>
            <div class="est-field">
              <div class="est-label">Plataforma</div>
              <select class="est-input est-select"
                onchange="_est.setField('plataforma',this.value)">
                ${platOpts}
              </select>
            </div>
          </div>

          <div class="est-form-row">
            <div class="est-field">
              <div class="est-label">Título</div>
              <input class="est-input" id="est-titulo-input" value="${esc(s.titulo)}"
                oninput="_est.setField('titulo',this.value)">
            </div>
            <div class="est-field">
              <div class="est-label">Estado</div>
              <select class="est-input est-select"
                onchange="_est.setField('estado',this.value)">
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
            <textarea class="est-input est-textarea" id="est-hook-input"
              oninput="_est.setField('hook',this.value)">${esc(s.hook)}</textarea>
          </div>

          <div class="est-field">
            <div class="est-label">Contenido</div>
            <textarea class="est-input est-textarea" style="min-height:130px"
              id="est-contenido-input"
              oninput="_est.setField('contenido',this.value)">${esc(s.contenido)}</textarea>
          </div>

          <div class="est-field">
            <div class="est-label">CTA</div>
            <input class="est-input" id="est-cta-input" value="${esc(s.cta)}"
              oninput="_est.setField('cta',this.value)" placeholder="Llamada a la acción">
          </div>

          <div class="est-actions">
            <button class="est-btn est-btn-branded" onclick="_est.saveScript()">Guardar</button>
            <button class="est-btn est-btn-present" onclick="_est.openPresenter()">▶ Presentar</button>
            <button class="est-btn est-btn-danger est-btn-sm" style="margin-left:auto"
              onclick="_est.deleteScript()">Eliminar</button>
          </div>
          <div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.06);padding-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">

            <!-- ── Presentación (espectador) ── -->
            <div style="display:flex;flex-direction:column;gap:6px">
              <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ed-acento,#22D3EE);opacity:.7">📽 Presentación</div>
              ${s.deck_data
                ? `<div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:2px">Generado ${fmtDate(s.deck_generado_at)}</div>
                   <div style="display:flex;gap:5px;flex-wrap:wrap">
                     <button class="est-btn est-btn-branded est-btn-sm" style="background:var(--ed-acento,#22D3EE);color:#000"
                       onclick="_est.abrirDeckEspectador()">🔎 Abrir</button>
                     <button class="est-btn est-btn-ghost est-btn-sm" onclick="_est.descargarDeckEspectador()">⬇</button>
                     <button class="est-btn est-btn-ghost est-btn-sm" onclick="_est.regenerarDeckEspectador()"
                       title="Sobrescribe la presentación con el contenido actual">↻</button>
                   </div>`
                : `<button class="est-btn est-btn-accent est-btn-sm" onclick="_est.generarDeckEspectador()">⚡ Generar presentación</button>`
              }
            </div>

            <!-- ── Guion (para el director) ── -->
            <div style="display:flex;flex-direction:column;gap:6px">
              <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8;opacity:.7">📖 Guion para mí</div>
              ${s.deck_guion
                ? `<div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:2px">Generado ${fmtDate(s.deck_guion_at)}</div>
                   <div style="display:flex;gap:5px;flex-wrap:wrap">
                     <button class="est-btn est-btn-ghost est-btn-sm" style="border-color:rgba(148,163,184,.3)"
                       onclick="_est.abrirDeckGuion()">🔎 Abrir</button>
                     <button class="est-btn est-btn-ghost est-btn-sm" onclick="_est.descargarDeckGuion()">⬇</button>
                     <button class="est-btn est-btn-ghost est-btn-sm" onclick="_est.regenerarDeckGuion()"
                       title="Sobrescribe el guion con el contenido actual">↻</button>
                   </div>`
                : `<button class="est-btn est-btn-ghost est-btn-sm" onclick="_est.generarDeckGuion()" style="border-color:rgba(148,163,184,.25)">⚡ Generar guion</button>`
              }
            </div>

          </div>
        </div>

        <!-- ── Panel de slides ── -->
        <div class="est-slides-panel" id="est-slides-panel">
          <div class="est-slides-hdr">
            <div class="est-slides-label">
              Slides <span id="est-sl-count" style="opacity:.5">(${_slides.length})</span>
            </div>
            <div class="est-slides-hdr-btns">
              <button class="est-btn est-btn-accent est-btn-sm"
                style="color:#000" onclick="_est.generateSlides()" title="Generar slides desde el guion">
                ✨ Generar
              </button>
              <button class="est-btn est-btn-ghost est-btn-sm"
                onclick="_est.toggleAddSlide()">+ Agregar</button>
            </div>
          </div>
          <div id="est-slides-list">${renderSlidesListHTML()}</div>
          <div id="est-add-form" style="display:none" class="est-add-form">
            ${addSlideFormHTML()}
          </div>
        </div>

      </div>
    </div>
  </div>`

  // Aplicar tema de la marca al editor
  applyEditorTheme(s.brand_id, false)
}

// ── Branding dinámico del editor ──────────────────────────────
function applyEditorTheme(brandId, animate) {
  const b  = brand(brandId)
  const el = $('est-editor-branded')
  if (!el || !b) return

  const c      = b.colores || {}
  const fondo  = c.fondo    || '#0a0a0a'
  const prim   = c.primario || '#7C3AED'
  const texto  = c.texto    || '#FFFFFF'
  const acento = c.acento   || '#22D3EE'
  const dark   = isDark(fondo)
  // surface: ligeramente distinto del fondo para que los inputs sean legibles
  const surface = dark
    ? lighten(fondo, 0.06)
    : darken(fondo, 0.06)

  if (!animate) {
    el.style.transition = 'none'
    el.querySelectorAll('*').forEach(n => { n.style.transition = 'none' })
    // Forzar reflow para que la transición none surta efecto
    void el.offsetWidth
    el.style.transition = ''
  }

  el.style.setProperty('--ed-fondo',    fondo)
  el.style.setProperty('--ed-primario', prim)
  el.style.setProperty('--ed-texto',    texto)
  el.style.setProperty('--ed-acento',   acento)
  el.style.setProperty('--ed-surface',  surface)
  el.style.setProperty('--ed-border',   rgba(prim, 0.25))
  el.style.setProperty('--ed-muted',    rgba(texto, 0.5))

  // Fondo y color de texto del contenedor raíz
  el.style.background  = fondo
  el.style.color       = texto
  el.style.borderColor = rgba(prim, 0.2)

  // Tipografía de la marca
  if (b.tipografia) {
    ensureFont(b.tipografia)
    el.style.fontFamily = `'${b.tipografia}', sans-serif`
  } else {
    el.style.fontFamily = ''
  }

  // Logo en corner
  const logoEl = el.querySelector('.est-brand-logo-corner')
  if (logoEl) {
    if (b.logo_url) { logoEl.src = b.logo_url; logoEl.style.display = '' }
    else logoEl.style.display = 'none'
  }

  // Botón back con color de marca
  const back = $('est-back-btn')
  if (back) back.style.color = prim

  // Refrescar thumbnails con los nuevos colores
  refreshSlidesList()
}

// Helpers para aclarar/oscurecer hex
function lighten(hex, amount) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#1a1a1a'
  let r = Math.min(255, parseInt(hex.slice(1,3),16) + Math.round(255*amount))
  let g = Math.min(255, parseInt(hex.slice(3,5),16) + Math.round(255*amount))
  let b = Math.min(255, parseInt(hex.slice(5,7),16) + Math.round(255*amount))
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')
}
function darken(hex, amount) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return '#e0e0e0'
  let r = Math.max(0, parseInt(hex.slice(1,3),16) - Math.round(255*amount))
  let g = Math.max(0, parseInt(hex.slice(3,5),16) - Math.round(255*amount))
  let b = Math.max(0, parseInt(hex.slice(5,7),16) - Math.round(255*amount))
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')
}

// Cambio de marca en vivo con transición
function changeBrand(brandId) {
  if (!_activeScript) return
  _activeScript.brand_id = brandId
  applyEditorTheme(brandId, true)
}

// ── Miniaturas de slides con branding ────────────────────────
function renderSlidesListHTML() {
  if (!_slides.length)
    return `<div style="font-size:11px;color:var(--ed-muted);padding:6px 0">Sin slides — usa ✨ Generar o + Agregar</div>`
  return _slides.map((sl, i) => slideThumbnailHTML(sl, i)).join('')
}

function slideThumbnailHTML(sl, i) {
  const b      = brand(_activeScript?.brand_id)
  const c      = b?.colores || {}
  const fondo  = c.fondo    || '#0a0a0a'
  const prim   = c.primario || '#7C3AED'
  const texto  = c.texto    || '#FFFFFF'
  const acento = c.acento   || '#22D3EE'
  const isFirst = i === 0
  const isLast  = i === _slides.length - 1
  const logo    = b?.logo_url || ''
  const logoHtml = logo
    ? `<img src="${esc(logo)}" style="max-height:12%;max-width:40%;object-fit:contain;opacity:.85;margin-bottom:4%" onerror="this.style.display='none'">`
    : ''

  let inner = ''
  switch (sl.tipo) {
    case 'portada':
      inner = `<div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:6%;width:100%">
        ${logoHtml}
        <div style="font-size:1.4em;font-weight:700;line-height:1.2;color:${esc(texto)}">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div style="font-size:.9em;opacity:.55;color:${esc(texto)}">${esc(sl.texto_secundario)}</div>` : ''}
      </div>`
      break
    case 'punto':
      inner = `<div style="display:flex;flex-direction:column;gap:6%;width:100%">
        <div style="font-size:1.5em;font-weight:700;line-height:1.2;color:${esc(texto)}">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div style="font-size:.9em;opacity:.55;color:${esc(texto)}">${esc(sl.texto_secundario)}</div>` : ''}
      </div>`
      break
    case 'cita':
      inner = `<div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:4%;width:100%">
        <div style="font-size:2.5em;line-height:.7;color:${esc(prim)};opacity:.4;font-family:Georgia,serif">"</div>
        <div style="font-size:1.1em;font-style:italic;line-height:1.35;color:${esc(texto)}">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div style="font-size:.8em;opacity:.5;color:${esc(texto)}">— ${esc(sl.texto_secundario)}</div>` : ''}
      </div>`
      break
    case 'dato':
      inner = `<div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:4%;width:100%">
        <div style="font-size:2.8em;font-weight:800;line-height:1;color:${esc(prim)}">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div style="font-size:.9em;opacity:.55;color:${esc(texto)}">${esc(sl.texto_secundario)}</div>` : ''}
      </div>`
      break
    case 'cierre':
      inner = `<div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:6%;width:100%">
        <div style="font-size:1.3em;font-weight:700;line-height:1.25;color:${esc(texto)}">${esc(_activeScript?.cta || sl.texto_principal)}</div>
        ${sl.texto_secundario ? `<div style="font-size:.8em;opacity:.5;color:${esc(texto)}">${esc(sl.texto_secundario)}</div>` : ''}
        ${logoHtml}
      </div>`
      break
    default:
      inner = `<div style="font-size:1.2em;color:${esc(texto)}">${esc(sl.texto_principal)}</div>`
  }

  // Tipo badge con color de acento
  const tipoBadge = `<div style="
    position:absolute;top:5px;left:6px;
    font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
    padding:1px 5px;border-radius:3px;
    background:${rgba(prim,.15)};border:1px solid ${rgba(prim,.3)};color:${esc(prim)};
    font-family:'Outfit',sans-serif;
  ">${esc(sl.tipo)}</div>`

  return `<div class="est-slide-thumb" id="est-sl-${sl.id}" style="background:${esc(fondo)};border:1px solid ${rgba(prim,.2)}">
    <div class="est-slide-thumb-inner" style="font-family:${b?.tipografia?`'${b.tipografia}',`:''}sans-serif;font-size:11px">
      ${inner}
    </div>
    ${tipoBadge}
    <div class="est-slide-thumb-num">${i+1}</div>
    <div class="est-slide-thumb-ctrl">
      ${!isFirst ? `<button onclick="_est.moveSlide('${sl.id}',-1)" title="Subir">↑</button>` : ''}
      ${!isLast  ? `<button onclick="_est.moveSlide('${sl.id}',1)"  title="Bajar">↓</button>`  : ''}
      <button class="est-slide-thumb-del" onclick="_est.deleteSlide('${sl.id}')" title="Eliminar">✕</button>
    </div>
  </div>`
}

function addSlideFormHTML() {
  const tipoOpts = TIPOS_SLIDE.map(t => `<option value="${t}">${capFirst(t)}</option>`).join('')
  return `
    <div class="est-field">
      <div class="est-label">Tipo</div>
      <select class="est-input est-select" id="new-sl-tipo">${tipoOpts}</select>
    </div>
    <div class="est-field">
      <div class="est-label">Texto principal</div>
      <textarea class="est-input est-textarea" id="new-sl-main"
        style="min-height:52px" placeholder="Texto principal del slide"></textarea>
    </div>
    <div class="est-field">
      <div class="est-label">Texto secundario (opcional)</div>
      <input class="est-input" id="new-sl-sec" placeholder="Subtítulo, contexto…">
    </div>
    <div class="est-field">
      <div class="est-label">Notas del orador (solo tú las ves)</div>
      <textarea class="est-input est-textarea" id="new-sl-notas"
        style="min-height:60px;font-size:12px;opacity:.8" placeholder="Lo que vas a decir en este slide…"></textarea>
    </div>
    <div style="display:flex;gap:6px;margin-top:4px">
      <button class="est-btn est-btn-branded est-btn-sm" onclick="_est.addSlide()">Agregar</button>
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
  if (!_activeScript) return
  _activeScript[key] = val
  // Actualizar el título visible en el header del editor
  if (key === 'titulo') {
    const hdr = $('est-script-title-hdr')
    if (hdr) hdr.querySelector('span').textContent = val || 'Sin título'
  }
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
  const tipo  = $('new-sl-tipo')?.value || 'punto'
  const main  = ($('new-sl-main')?.value   || '').trim()
  const sec   = ($('new-sl-sec')?.value    || '').trim() || null
  const notas = ($('new-sl-notas')?.value  || '').trim() || null
  if (!main) { showToast('⚠️ El texto principal es obligatorio'); return }

  const maxOrden = _slides.length ? Math.max(..._slides.map(s => s.orden)) : -1
  const { data, error } = await SB_P.from('script_slides').insert({
    id: uid(), script_id: _activeScript.id,
    orden: maxOrden + 1, tipo,
    texto_principal: main, texto_secundario: sec, notas,
    created_at: new Date().toISOString(),
  }).select().single()
  if (error) { showToast('❌ ' + error.message); return }
  _slides.push(data)
  showToast('✅ Slide agregado')
  refreshSlidesList()
  toggleAddSlide()
  if ($('new-sl-main'))  $('new-sl-main').value  = ''
  if ($('new-sl-sec'))   $('new-sl-sec').value   = ''
  if ($('new-sl-notas')) $('new-sl-notas').value = ''
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
    SB_P.from('script_slides').update({orden:idx }).eq('id', _slides[idx].id),
    SB_P.from('script_slides').update({orden:next}).eq('id', _slides[next].id),
  ])
  _slides[idx].orden  = idx
  _slides[next].orden = next
  refreshSlidesList()
}

function refreshSlidesList() {
  const el  = $('est-slides-list')
  if (el) el.innerHTML = renderSlidesListHTML()
  const cnt = $('est-sl-count')
  if (cnt) cnt.textContent = `(${_slides.length})`
}

// ── Generador automático de slides ───────────────────────────
async function generateSlides() {
  if (!_activeScript) return
  const s = _activeScript

  // Leer los valores actuales de los textareas (pueden haber cambiado sin guardar)
  const hook      = ($('est-hook-input')?.value     || s.hook     || '').trim()
  const contenido = ($('est-contenido-input')?.value || s.contenido || '').trim()
  const cta       = ($('est-cta-input')?.value       || s.cta      || '').trim()
  const titulo    = ($('est-titulo-input')?.value    || s.titulo   || 'Sin título').trim()

  if (!hook && !contenido && !cta) {
    showToast('⚠️ Escribe el hook, contenido o CTA antes de generar slides')
    return
  }
  if (_slides.length && !confirm('¿Reemplazar los slides actuales con los generados?')) return

  const sugeridos = []
  let orden = 0

  // 1. Portada — siempre
  sugeridos.push({ tipo:'portada', texto_principal: titulo, texto_secundario: null })

  // 2. Hook → cita
  if (hook) {
    sugeridos.push({ tipo:'cita', texto_principal: hook, texto_secundario: null })
  }

  // 3. Parsear párrafos del contenido
  if (contenido) {
    const parrafos = contenido
      .split(/\n{2,}|\n(?=[-•\d])/)
      .map(p => p.replace(/^[-•]\s*/, '').trim())
      .filter(p => p.length > 0)

    for (const p of parrafos) {
      // Párrafo con número/estadística → dato
      const numMatch = p.match(/^([\d,.%$]+[%x]?)\s*[-–—:]\s*(.+)$/) ||
                       p.match(/^(.+)[:]\s*([\d,.%$]+[%x]?)$/)
      if (numMatch) {
        sugeridos.push({
          tipo: 'dato',
          texto_principal: numMatch[1].trim(),
          texto_secundario: numMatch[2].trim(),
        })
        continue
      }
      // Párrafo corto con número al inicio
      if (/^[\d,.%$]+/.test(p) && p.length < 30) {
        sugeridos.push({ tipo:'dato', texto_principal: p, texto_secundario: null })
        continue
      }
      // Párrafo con pregunta → punto
      if (p.startsWith('¿') || p.startsWith('?') || p.endsWith('?')) {
        sugeridos.push({ tipo:'punto', texto_principal: p, texto_secundario: null })
        continue
      }
      // Párrafo largo (>100 chars) — dividir en principal + secundario
      if (p.length > 100) {
        const sentences = p.split(/(?<=[.!?])\s+/)
        sugeridos.push({
          tipo: 'punto',
          texto_principal: sentences[0],
          texto_secundario: sentences.slice(1).join(' ') || null,
        })
      } else {
        sugeridos.push({ tipo:'punto', texto_principal: p, texto_secundario: null })
      }
    }
  }

  // 4. CTA → cierre
  if (cta) {
    sugeridos.push({ tipo:'cierre', texto_principal: cta, texto_secundario: null })
  }

  // Eliminar slides anteriores y guardar los nuevos
  await SB_P.from('script_slides').delete().eq('script_id', s.id)

  const inserts = sugeridos.map((sl, i) => ({
    id: uid(), script_id: s.id, orden: i,
    tipo: sl.tipo, texto_principal: sl.texto_principal,
    texto_secundario: sl.texto_secundario || null,
    created_at: new Date().toISOString(),
  }))

  const { data, error } = await SB_P.from('script_slides').insert(inserts).select()
  if (error) { showToast('❌ ' + error.message); return }

  _slides = (data || []).sort((a,b) => a.orden - b.orden)
  showToast(`✅ ${_slides.length} slides generados`)
  refreshSlidesList()
}

// ── Navegación ────────────────────────────────────────────────
function backToList()    { _activeScript = null; _slides = []; renderList() }
function filterBrand(v)  { _filterBrand  = v; renderList() }
function filterEstado(v) { _filterEstado = v; renderList() }

// ── Presenter ─────────────────────────────────────────────────
function applyPresenterVars(b) {
  const pres = $('est-presenter')
  if (!pres || !b) return
  const c = b.colores || {}
  pres.style.setProperty('--pres-bg',      c.fondo    || '#0A0A0A')
  pres.style.setProperty('--pres-primario', c.primario || '#7C3AED')
  pres.style.setProperty('--pres-texto',   c.texto    || '#FFFFFF')
  pres.style.setProperty('--pres-acento',  c.acento   || '#22D3EE')
  pres.style.background = c.fondo || '#0A0A0A'
  pres.style.color      = c.texto || '#FFFFFF'
  pres.style.fontFamily = b.tipografia ? `'${b.tipografia}', sans-serif` : "'Inter', system-ui, sans-serif"
}

async function openPresenter() {
  if (!_activeScript) return
  if (!_slides.length) { showToast('⚠️ Agrega al menos un slide antes de presentar'); return }
  const b = brand(_activeScript.brand_id)
  applyPresenterVars(b)
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
    ;(document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen)?.call(document)
  } catch {}
}

function renderPresSlide() {
  const sl   = _slides[_presIdx]
  const b    = brand(_activeScript?.brand_id)
  const body = $('est-pres-body')
  if (!body || !sl) return
  body.innerHTML = buildSlideHTML(sl, _activeScript, b)
  const bar = $('est-pres-bar')
  if (bar) {
    bar.style.background = b?.colores?.primario || '#7C3AED'
    bar.style.width = (((_presIdx+1) / _slides.length) * 100) + '%'
  }
  const cnt = $('est-pres-counter')
  if (cnt) cnt.textContent = `${_presIdx+1} / ${_slides.length}`
}

function buildSlideHTML(sl, script, b) {
  const primario = b?.colores?.primario || '#7C3AED'
  const logoUrl  = b?.logo_url || ''
  const logoHtml = logoUrl
    ? `<img class="logo" src="${esc(logoUrl)}" alt="${esc(b?.nombre||'')}" onerror="this.style.display='none'">`
    : ''
  switch (sl.tipo) {
    case 'portada':
      return `<div class="sl-portada">${logoHtml}
        <div class="tit">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario?`<div class="sub">${esc(sl.texto_secundario)}</div>`:''}</div>`
    case 'punto':
      return `<div class="sl-punto">
        <div class="main">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario?`<div class="sub">${esc(sl.texto_secundario)}</div>`:''}</div>`
    case 'cita':
      return `<div class="sl-cita">
        <div class="qmark" style="color:${esc(primario)}">"</div>
        <div class="main">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario?`<div class="author">— ${esc(sl.texto_secundario)}</div>`:''}</div>`
    case 'dato':
      return `<div class="sl-dato">
        <div class="num" style="color:${esc(primario)}">${esc(sl.texto_principal)}</div>
        ${sl.texto_secundario?`<div class="ctx">${esc(sl.texto_secundario)}</div>`:''}</div>`
    case 'cierre':
      return `<div class="sl-cierre">
        <div class="cta">${esc(script?.cta || sl.texto_principal)}</div>
        ${sl.texto_secundario?`<div class="sub">${esc(sl.texto_secundario)}</div>`:''}
        ${logoHtml}</div>`
    default:
      return `<div class="sl-punto"><div class="main">${esc(sl.texto_principal)}</div></div>`
  }
}

function syncDirector() {
  if (_directorWin && !_directorWin.closed) {
    _directorWin.postMessage({ type: 'sync', cur: _presIdx }, location.origin)
  }
}

function presNext() {
  if (_presIdx < _slides.length - 1) { _presIdx++; fadeToSlide(); syncDirector() }
}
function presPrev() {
  if (_presIdx > 0) { _presIdx--; fadeToSlide(); syncDirector() }
}

function fadeToSlide() {
  if (_presFading) return
  _presFading = true
  const body = $('est-pres-body')
  if (body) {
    body.style.opacity = '0'
    body.style.transition = 'opacity .15s'
    setTimeout(() => { renderPresSlide(); body.style.opacity = '1'; _presFading = false }, 160)
  }
}

function onPresKey(ev) {
  if (!_presOpen) return
  if (ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); presNext() }
  if (ev.key === 'ArrowLeft')                    { ev.preventDefault(); presPrev() }
  if (ev.key === 'Escape')                       { ev.preventDefault(); closePresenter() }
}

function onPresMessage(ev) {
  if (ev.origin !== location.origin) return
  const d = ev.data
  if (!d || !_presOpen) return
  if (d.type === 'nav') {
    if (d.dir === 'next') presNext()
    else if (d.dir === 'prev') presPrev()
  }
  if (d.type === 'ready') {
    syncDirector()
  }
}

function openDirector() {
  if (!_activeScript) return
  const url = `/director.html?scriptId=${_activeScript.id}`
  _directorWin = window.open(url, 'director', 'width=1100,height=720')
}

// ── Deck HTML ─────────────────────────────────────────────────

function slidesToDeckData(slides) {
  return slides.map(sl => ({
    tipo:  sl.tipo             || 'punto',
    p:     sl.texto_principal  || '',
    s:     sl.texto_secundario || '',
    notas: sl.notas            || '',
  }))
}

// Slides cortas para el espectador: una idea por pantalla
function trocearEnSlides(texto) {
  if (!texto?.trim()) return []
  const partes = texto
    .split(/\n{2,}|\n(?=[-•])/)
    .flatMap(bloque => {
      const limpio = bloque.replace(/^[-•]\s*/, '').trim()
      if (!limpio) return []
      // dividir bloques largos en oraciones si superan ~120 chars
      if (limpio.length > 120) {
        return limpio.split(/(?<=[.!?])\s+/).map(o => o.trim()).filter(o => o.length > 8)
      }
      return [limpio]
    })
    .filter(p => p.length > 8)

  const slides = []
  for (const p of partes) {
    // unir fragmentos muy cortos al slide anterior
    if (slides.length && p.length < 30 && slides[slides.length - 1].p.length < 70) {
      slides[slides.length - 1].p += ' ' + p
    } else {
      slides.push({ tipo: 'punto', p, s: '', notas: '' })
    }
  }
  return slides
}

// Páginas de teleprompter: ~90 palabras por hoja
function trocearEnPaginas(texto, wpp = 90) {
  if (!texto?.trim()) return []
  const words = texto.trim().split(/\s+/)
  const pages = []
  for (let i = 0; i < words.length; i += wpp) {
    pages.push({ tipo: 'pagina', p: words.slice(i, i + wpp).join(' '), s: '', notas: '' })
  }
  return pages
}

function _textoCompleto(s) {
  return [s.hook, s.contenido, s.cta].filter(Boolean).join('\n\n')
}

function _buildEspectadorData() {
  const s = _activeScript
  if (_slides.length) return slidesToDeckData(_slides)
  const texto = _textoCompleto(s)
  const slides = [{ tipo: 'portada', p: s.titulo || '', s: '', notas: '' }]
  slides.push(...trocearEnSlides(texto))
  return slides
}

function _buildGuionData() {
  const texto = _textoCompleto(_activeScript)
  return trocearEnPaginas(texto)
}

function _makeBlob(data, modo) {
  const b    = brand(_activeScript.brand_id)
  const html = generarDeckHTML(data, b, _activeScript.titulo, modo)
  return new Blob([html], { type: 'text/html' })
}

async function generarDeckEspectador() {
  if (!_activeScript) return
  const data = _buildEspectadorData()
  if (!data.length) { showToast('⚠️ Escribe el contenido antes de generar'); return }
  const { error } = await SB_P.from('scripts').update({
    deck_data: data, deck_generado_at: new Date().toISOString(),
  }).eq('id', _activeScript.id)
  if (error) { showToast('❌ ' + error.message); return }
  _activeScript.deck_data = data
  _activeScript.deck_generado_at = new Date().toISOString()
  showToast('✅ Presentación generada')
  renderDetail()
  abrirDeckEspectador()
}

async function regenerarDeckEspectador() {
  if (!confirm('¿Regenerar la presentación? Sobrescribe las ediciones hechas dentro del deck.')) return
  await generarDeckEspectador()
}

function abrirDeckEspectador() {
  if (!_activeScript?.deck_data) return
  window.open(URL.createObjectURL(_makeBlob(_activeScript.deck_data, 'espectador')), '_blank')
}

function descargarDeckEspectador() {
  if (!_activeScript?.deck_data) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(_makeBlob(_activeScript.deck_data, 'espectador'))
  a.download = (_activeScript.titulo || 'deck').replace(/[^a-z0-9\-_]/gi, '_') + '-presentacion.html'
  a.click()
}

async function generarDeckGuion() {
  if (!_activeScript) return
  const data = _buildGuionData()
  if (!data.length) { showToast('⚠️ Escribe el contenido antes de generar'); return }
  const { error } = await SB_P.from('scripts').update({
    deck_guion: data, deck_guion_at: new Date().toISOString(),
  }).eq('id', _activeScript.id)
  if (error) { showToast('❌ ' + error.message); return }
  _activeScript.deck_guion = data
  _activeScript.deck_guion_at = new Date().toISOString()
  showToast('✅ Guion generado')
  renderDetail()
  abrirDeckGuion()
}

async function regenerarDeckGuion() {
  if (!confirm('¿Regenerar el guion? Sobrescribe las ediciones hechas dentro del deck.')) return
  await generarDeckGuion()
}

function abrirDeckGuion() {
  if (!_activeScript?.deck_guion) return
  window.open(URL.createObjectURL(_makeBlob(_activeScript.deck_guion, 'guion')), '_blank')
}

function descargarDeckGuion() {
  if (!_activeScript?.deck_guion) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(_makeBlob(_activeScript.deck_guion, 'guion'))
  a.download = (_activeScript.titulo || 'guion').replace(/[^a-z0-9\-_]/gi, '_') + '-guion.html'
  a.click()
}

async function onDeckMessage(ev) {
  const d = ev.data || {}
  if (d.type !== 'guardar-deck' || !d.scriptId || !d.slides) return
  const col = d.cual === 'guion' ? 'deck_guion' : 'deck_data'
  const { error } = await SB_P.from('scripts')
    .update({ [col]: d.slides })
    .eq('id', d.scriptId)
  if (!error && _activeScript?.id === d.scriptId) {
    _activeScript[col] = d.slides
  }
}

function generarDeckHTML(deckData, b, titulo, modo) {
  modo = modo || 'espectador'
  if (modo === 'guion') return _generarGuionHTML(deckData, b, titulo)
  return _generarEspectadorHTML(deckData, b, titulo)
}

function _generarEspectadorHTML(deckData, b, titulo) {
  const scriptId = _activeScript?.id || ''
  const c        = b?.colores || {}
  const bg       = c.fondo    || '#0A0A0A'
  const prim     = c.primario || '#7C3AED'
  const texto    = c.texto    || '#FFFFFF'
  const acento   = c.acento   || '#22D3EE'
  const font     = b?.tipografia ? `'${b.tipografia}', sans-serif` : "'Inter', sans-serif"
  const logoUrl  = b?.logo_url || ''
  const brandNom = b?.nombre || ''

  const isDarkBg = (hex) => {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return true
    const r = parseInt(hex.slice(1,3),16)/255
    const g = parseInt(hex.slice(3,5),16)/255
    const bv = parseInt(hex.slice(5,7),16)/255
    return 0.299*r + 0.587*g + 0.114*bv < 0.5
  }
  const textOnPrim = isDarkBg(prim) ? '#fff' : '#000'

  const slidesJson = JSON.stringify(deckData)
    .replace(/<\/script>/gi, '<\\/script>')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo.replace(/</g,'&lt;')} — Deck</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:${bg};--prim:${prim};--texto:${texto};--acento:${acento};
  --prim-on:${textOnPrim};--font:${font};
}
body{background:var(--bg);color:var(--texto);font-family:var(--font);
  height:100vh;display:flex;flex-direction:column;overflow:hidden;user-select:none}

/* ── Toolbar ── */
#toolbar{
  display:flex;align-items:center;gap:10px;padding:8px 16px;
  background:rgba(0,0,0,.35);backdrop-filter:blur(8px);
  border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;z-index:10;
}
#toolbar-title{font-size:12px;font-weight:600;color:rgba(255,255,255,.5);flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb-btn{
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);
  color:rgba(255,255,255,.8);border-radius:6px;padding:4px 11px;font-size:11px;
  font-family:var(--font);cursor:pointer;white-space:nowrap;
}
.tb-btn:hover{background:rgba(255,255,255,.15)}
#btn-save{background:var(--prim);color:var(--prim-on);border-color:transparent}
#btn-save:hover{opacity:.88}
#btn-edit.active{background:var(--acento);color:#000;border-color:transparent}
#slide-count{font-size:11px;color:rgba(255,255,255,.3);font-variant-numeric:tabular-nums}

/* ── Slide area ── */
#slide-wrap{flex:1;display:flex;align-items:stretch;overflow:hidden;position:relative}
#slide-stage{
  flex:1;display:flex;align-items:center;justify-content:center;
  padding:60px 10%;position:relative;overflow:hidden;
}
#slide-content{
  max-width:880px;width:100%;text-align:center;
  animation:fadeIn .2s ease;
}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* ── Slide layouts ── */
.sl-portada .logo{max-height:64px;max-width:220px;object-fit:contain;margin-bottom:6%;opacity:.9}
.sl-portada .tit{font-size:clamp(28px,5vw,64px);font-weight:700;line-height:1.15;margin-bottom:4%}
.sl-portada .sub{font-size:clamp(14px,2vw,22px);opacity:.55}
.sl-punto .main{font-size:clamp(22px,4vw,52px);font-weight:700;line-height:1.2;margin-bottom:5%}
.sl-punto .sub{font-size:clamp(14px,1.8vw,24px);opacity:.55}
.sl-cita .qmark{font-size:clamp(60px,10vw,120px);line-height:.6;color:var(--prim);opacity:.35;font-family:Georgia,serif}
.sl-cita .main{font-size:clamp(18px,3vw,40px);font-style:italic;line-height:1.4;margin:5% 0 3%}
.sl-cita .author{font-size:clamp(12px,1.5vw,20px);opacity:.5}
.sl-dato .num{font-size:clamp(50px,10vw,120px);font-weight:800;line-height:1;color:var(--prim);margin-bottom:4%}
.sl-dato .ctx{font-size:clamp(14px,2vw,28px);opacity:.55}
.sl-cierre .cta{font-size:clamp(22px,4vw,54px);font-weight:700;line-height:1.2;margin-bottom:5%}
.sl-cierre .sub{font-size:clamp(14px,1.8vw,24px);opacity:.55;margin-bottom:6%}
.sl-cierre .logo{max-height:54px;max-width:180px;object-fit:contain;opacity:.8}

/* ── Progress bar ── */
#progress{position:absolute;bottom:0;left:0;height:3px;background:var(--prim);transition:width .25s ease}

/* ── Nav buttons (hover) ── */
.nav-arrow{
  position:absolute;top:50%;transform:translateY(-50%);
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.5);border-radius:8px;padding:14px 10px;
  font-size:20px;cursor:pointer;z-index:5;transition:all .15s;
}
.nav-arrow:hover{background:rgba(255,255,255,.15);color:#fff}
#btn-prev{left:12px}
#btn-next{right:12px}
.nav-arrow:disabled{opacity:.15;cursor:default}

/* ── Edit panel ── */
#edit-panel{
  width:320px;background:#0D1526;border-left:1px solid rgba(255,255,255,.08);
  display:none;flex-direction:column;flex-shrink:0;overflow-y:auto;padding:16px;gap:12px;
}
#edit-panel.open{display:flex}
.ep-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:#475569;margin-bottom:4px}
.ep-field{display:flex;flex-direction:column;gap:4px}
.ep-input,.ep-ta{
  background:#0A1018;border:1px solid rgba(255,255,255,.1);color:#E2E8F0;
  border-radius:6px;padding:8px 10px;font-family:var(--font);font-size:13px;
  resize:vertical;line-height:1.5;
}
.ep-input:focus,.ep-ta:focus{outline:none;border-color:var(--acento)}
.ep-ta{min-height:70px}
.ep-ta.notas{min-height:110px;font-size:12px;color:#94A3B8}
.ep-tipo-badge{
  display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.07em;padding:2px 8px;border-radius:4px;
  background:rgba(255,255,255,.07);color:rgba(255,255,255,.4);margin-bottom:8px;
}
</style>
</head>
<body>

<!-- Toolbar -->
<div id="toolbar">
  <div id="toolbar-title">${titulo.replace(/</g,'&lt;')} ${brandNom ? '· ' + brandNom : ''}</div>
  <span id="slide-count">1 / 1</span>
  <button class="tb-btn" id="btn-edit" onclick="toggleEdit()">✏️ Editar</button>
  <button class="tb-btn" id="btn-save" onclick="guardar()">💾 Guardar</button>
  <button class="tb-btn" onclick="descargar()">⬇ .html</button>
</div>

<!-- Main -->
<div id="slide-wrap">
  <div id="slide-stage">
    <button class="nav-arrow" id="btn-prev" onclick="nav(-1)">&#8592;</button>
    <div id="slide-content"></div>
    <button class="nav-arrow" id="btn-next" onclick="nav(1)">&#8594;</button>
    <div id="progress"></div>
  </div>
  <div id="edit-panel">
    <div class="ep-tipo-badge" id="ep-tipo"></div>
    <div class="ep-field">
      <div class="ep-label">Texto principal</div>
      <textarea class="ep-ta" id="ep-p" oninput="updateSlide('p',this.value)" rows="3"></textarea>
    </div>
    <div class="ep-field">
      <div class="ep-label">Texto secundario</div>
      <textarea class="ep-ta" id="ep-s" oninput="updateSlide('s',this.value)" rows="2"></textarea>
    </div>
    <div class="ep-field">
      <div class="ep-label">Notas del orador</div>
      <textarea class="ep-ta notas" id="ep-notas" oninput="updateSlide('notas',this.value)" rows="5"
        placeholder="Lo que vas a decir en este slide…"></textarea>
    </div>
  </div>
</div>

<script>
const SCRIPT_ID = ${JSON.stringify(scriptId)};
const MODO      = 'espectador';
const DECK_ID   = 'deck-' + MODO + '-' + SCRIPT_ID;
const LOGO_URL  = ${JSON.stringify(logoUrl)};
let slides = ${slidesJson};
let cur    = 0;
let edited = false;

const logoHtml = LOGO_URL
  ? '<img class="logo" src="' + LOGO_URL + '" onerror="this.style.display=\'none\'">'
  : '';

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function buildSlide(sl){
  switch(sl.tipo){
    case 'portada':
      return '<div class="sl-portada">' + logoHtml +
        '<div class="tit">' + esc(sl.p) + '</div>' +
        (sl.s ? '<div class="sub">' + esc(sl.s) + '</div>' : '') + '</div>';
    case 'cita':
      return '<div class="sl-cita"><div class="qmark">"</div>' +
        '<div class="main">' + esc(sl.p) + '</div>' +
        (sl.s ? '<div class="author">— ' + esc(sl.s) + '</div>' : '') + '</div>';
    case 'dato':
      return '<div class="sl-dato"><div class="num">' + esc(sl.p) + '</div>' +
        (sl.s ? '<div class="ctx">' + esc(sl.s) + '</div>' : '') + '</div>';
    case 'cierre':
      return '<div class="sl-cierre"><div class="cta">' + esc(sl.p) + '</div>' +
        (sl.s ? '<div class="sub">' + esc(sl.s) + '</div>' : '') + logoHtml + '</div>';
    default:
      return '<div class="sl-punto"><div class="main">' + esc(sl.p) + '</div>' +
        (sl.s ? '<div class="sub">' + esc(sl.s) + '</div>' : '') + '</div>';
  }
}

function render(){
  const sl = slides[cur];
  document.getElementById('slide-content').innerHTML = buildSlide(sl);
  document.getElementById('slide-count').textContent = (cur+1) + ' / ' + slides.length;
  document.getElementById('btn-prev').disabled = cur === 0;
  document.getElementById('btn-next').disabled = cur === slides.length - 1;
  document.getElementById('progress').style.width = ((cur+1)/slides.length*100) + '%';

  // edit panel
  document.getElementById('ep-tipo').textContent  = sl.tipo || '';
  document.getElementById('ep-p').value           = sl.p     || '';
  document.getElementById('ep-s').value           = sl.s     || '';
  document.getElementById('ep-notas').value       = sl.notas || '';
}

function nav(dir){
  const next = cur + dir;
  if (next < 0 || next >= slides.length) return;
  cur = next;
  render();
}

function toggleEdit(){
  const panel = document.getElementById('edit-panel');
  const btn   = document.getElementById('btn-edit');
  const open  = panel.classList.toggle('open');
  btn.classList.toggle('active', open);
}

function updateSlide(key, val){
  slides[cur][key] = val;
  // re-render slide without touching edit panel
  document.getElementById('slide-content').innerHTML = buildSlide(slides[cur]);
  edited = true;
}

function guardar(){
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type:'guardar-deck', scriptId: SCRIPT_ID, cual: MODO, slides }, '*');
    showFlash('💾 Guardado en el guion');
  } else {
    try { localStorage.setItem(DECK_ID, JSON.stringify(slides)); } catch(e){}
    showFlash('💾 Guardado localmente');
  }
  edited = false;
}

function descargar(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([document.documentElement.outerHTML],{type:'text/html'}));
  a.download = ${JSON.stringify((titulo||'deck').replace(/[^a-z0-9\-_]/gi,'_') + '.html')};
  a.click();
}

function showFlash(msg){
  let el = document.getElementById('flash');
  if (!el){ el = document.createElement('div'); el.id='flash';
    Object.assign(el.style,{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',
      background:'rgba(0,0,0,.85)',color:'#fff',padding:'8px 18px',borderRadius:'8px',
      fontSize:'13px',fontFamily:'Outfit,sans-serif',zIndex:'999',transition:'opacity .3s'});
    document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity = '1';
  clearTimeout(el._t); el._t = setTimeout(() => el.style.opacity='0', 2000);
}

document.addEventListener('keydown', ev => {
  const tag = document.activeElement?.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return;
  if (ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); nav(1); }
  if (ev.key === 'ArrowLeft')                    { ev.preventDefault(); nav(-1); }
  if (ev.key === 's' && (ev.ctrlKey||ev.metaKey)){ ev.preventDefault(); guardar(); }
});

window.addEventListener('beforeunload', ev => {
  if (edited){ ev.preventDefault(); ev.returnValue=''; }
});

render();
</script>
</body>
</html>`
}

function _generarGuionHTML(deckData, b, titulo) {
  const scriptId  = _activeScript?.id || ''
  const c         = b?.colores || {}
  const bg        = c.fondo    || '#0A0A0A'
  const prim      = c.primario || '#7C3AED'
  const texto     = c.texto    || '#FFFFFF'
  const font      = b?.tipografia ? `'${b.tipografia}', sans-serif` : "'Outfit', sans-serif"
  const brandNom  = b?.nombre || ''

  const slidesJson = JSON.stringify(deckData)
    .replace(/<\/script>/gi, '<\\/script>')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo.replace(/</g,'&lt;')} — Guion</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:${bg};--prim:${prim};--texto:${texto};--font:${font}}
body{background:var(--bg);color:var(--texto);font-family:var(--font);
  height:100vh;display:flex;flex-direction:column;overflow:hidden}

#toolbar{
  display:flex;align-items:center;gap:10px;padding:8px 18px;
  background:rgba(0,0,0,.4);border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0;
}
#tbar-title{font-size:12px;font-weight:600;color:rgba(255,255,255,.4);flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tb-btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);
  color:rgba(255,255,255,.8);border-radius:6px;padding:4px 12px;font-size:11px;
  font-family:var(--font);cursor:pointer}
.tb-btn:hover{background:rgba(255,255,255,.16)}
#btn-save{background:var(--prim);border-color:transparent;color:#fff}

#stage{
  flex:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:48px 10%;position:relative;overflow:hidden;
}
#page-text{
  max-width:860px;width:100%;
  font-size:clamp(20px,2.8vw,36px);line-height:1.8;font-weight:400;
  text-align:left;white-space:pre-wrap;word-break:break-word;
  animation:fi .2s ease;
}
@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

#page-counter{
  position:absolute;top:14px;right:20px;
  font-size:11px;color:rgba(255,255,255,.25);font-variant-numeric:tabular-nums;
}
#progress{position:absolute;bottom:0;left:0;height:3px;background:var(--prim);transition:width .25s}

.nav-arrow{
  position:absolute;top:50%;transform:translateY(-50%);
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  color:rgba(255,255,255,.4);border-radius:8px;padding:16px 10px;
  font-size:20px;cursor:pointer;transition:all .15s;
}
.nav-arrow:hover{background:rgba(255,255,255,.14);color:#fff}
.nav-arrow:disabled{opacity:.12;cursor:default}
#btn-prev{left:12px}
#btn-next{right:12px}

#edit-panel{
  width:300px;background:#080D16;border-left:1px solid rgba(255,255,255,.08);
  display:none;flex-shrink:0;flex-direction:column;padding:16px;
}
#edit-panel.open{display:flex}
#ep-ta{
  flex:1;background:#0A1018;border:1px solid rgba(255,255,255,.1);color:#E2E8F0;
  border-radius:6px;padding:10px 12px;font-family:var(--font);font-size:14px;
  line-height:1.7;resize:none;height:100%;
}
#ep-ta:focus{outline:none;border-color:var(--prim)}
.ep-lbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:#475569;margin-bottom:6px}

#bottom-bar{
  display:flex;align-items:center;justify-content:center;gap:16px;
  padding:8px 20px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.06);
  flex-shrink:0;
}
.bb-btn{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);
  color:rgba(255,255,255,.7);border-radius:8px;padding:6px 20px;font-size:13px;
  font-family:var(--font);font-weight:600;cursor:pointer;transition:background .15s}
.bb-btn:hover{background:rgba(255,255,255,.14)}
.bb-btn:disabled{opacity:.2;cursor:default}
#counter-bot{font-size:12px;color:rgba(255,255,255,.3);
  font-variant-numeric:tabular-nums;min-width:70px;text-align:center}
</style>
</head>
<body>

<div id="toolbar">
  <div id="tbar-title">📖 ${titulo.replace(/</g,'&lt;')}${brandNom ? ' · ' + brandNom : ''}</div>
  <button class="tb-btn" id="btn-edit" onclick="toggleEdit()">✏️ Editar</button>
  <button class="tb-btn" id="btn-save" onclick="guardar()">💾 Guardar</button>
  <button class="tb-btn" onclick="descargar()">⬇ .html</button>
</div>

<div style="flex:1;display:flex;overflow:hidden">
  <div id="stage">
    <div id="page-counter"></div>
    <button class="nav-arrow" id="btn-prev" onclick="nav(-1)">&#8592;</button>
    <div id="page-text"></div>
    <button class="nav-arrow" id="btn-next" onclick="nav(1)">&#8594;</button>
    <div id="progress"></div>
  </div>
  <div id="edit-panel">
    <div class="ep-lbl">Texto de esta hoja</div>
    <textarea id="ep-ta" oninput="updatePage(this.value)"></textarea>
  </div>
</div>

<div id="bottom-bar">
  <button class="bb-btn" id="bb-prev" onclick="nav(-1)">← Anterior</button>
  <span id="counter-bot">1 / 1</span>
  <button class="bb-btn" id="bb-next" onclick="nav(1)">Siguiente →</button>
</div>

<script>
const SCRIPT_ID = ${JSON.stringify(scriptId)};
const MODO      = 'guion';
const DECK_ID   = 'deck-guion-' + SCRIPT_ID;
let slides = ${slidesJson};
let cur    = 0;
let edited = false;

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function render(){
  const sl = slides[cur];
  document.getElementById('page-text').textContent    = sl.p || '';
  document.getElementById('page-counter').textContent = 'Hoja ' + (cur+1) + ' / ' + slides.length;
  document.getElementById('counter-bot').textContent  = (cur+1) + ' / ' + slides.length;
  document.getElementById('progress').style.width     = ((cur+1)/slides.length*100) + '%';
  document.getElementById('btn-prev').disabled  = cur === 0;
  document.getElementById('btn-next').disabled  = cur === slides.length - 1;
  document.getElementById('bb-prev').disabled   = cur === 0;
  document.getElementById('bb-next').disabled   = cur === slides.length - 1;
  if (document.getElementById('edit-panel').classList.contains('open')) {
    document.getElementById('ep-ta').value = sl.p || '';
  }
}

function nav(dir){
  const next = cur + dir;
  if (next < 0 || next >= slides.length) return;
  cur = next; render();
}

function toggleEdit(){
  const p   = document.getElementById('edit-panel');
  const btn = document.getElementById('btn-edit');
  const open = p.classList.toggle('open');
  btn.style.background = open ? 'var(--prim)' : '';
  btn.style.borderColor = open ? 'transparent' : '';
  if (open) document.getElementById('ep-ta').value = slides[cur].p || '';
}

function updatePage(val){
  slides[cur].p = val;
  document.getElementById('page-text').textContent = val;
  edited = true;
}

function guardar(){
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type:'guardar-deck', scriptId: SCRIPT_ID, cual: MODO, slides }, '*');
    showFlash('💾 Guardado en el guion');
  } else {
    try { localStorage.setItem(DECK_ID, JSON.stringify(slides)); } catch(e){}
    showFlash('💾 Guardado localmente');
  }
  edited = false;
}

function descargar(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([document.documentElement.outerHTML],{type:'text/html'}));
  a.download = ${JSON.stringify((titulo||'guion').replace(/[^a-z0-9\-_]/gi,'_') + '-guion.html')};
  a.click();
}

function showFlash(msg){
  let el = document.getElementById('flash');
  if (!el){ el = document.createElement('div'); el.id='flash';
    Object.assign(el.style,{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',
      background:'rgba(0,0,0,.9)',color:'#fff',padding:'8px 18px',borderRadius:'8px',
      fontSize:'13px',fontFamily:getComputedStyle(document.body).fontFamily,zIndex:'999',transition:'opacity .3s'});
    document.body.appendChild(el); }
  el.textContent = msg; el.style.opacity='1';
  clearTimeout(el._t); el._t = setTimeout(() => el.style.opacity='0', 2000);
}

document.addEventListener('keydown', ev => {
  const tag = document.activeElement?.tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') return;
  if (ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); nav(1); }
  if (ev.key === 'ArrowLeft')                    { ev.preventDefault(); nav(-1); }
  if (ev.key === 's' && (ev.ctrlKey||ev.metaKey)){ ev.preventDefault(); guardar(); }
});

window.addEventListener('beforeunload', ev => {
  if (edited){ ev.preventDefault(); ev.returnValue=''; }
});

render();
</script>
</body>
</html>`
}

// ── API pública ───────────────────────────────────────────────
window._est = {
  newScript, openScript, saveScript, deleteScript, setField,
  changeBrand,
  backToList, filterBrand, filterEstado,
  addSlide, deleteSlide, moveSlide, toggleAddSlide,
  generateSlides,
  openPresenter, openDirector,
  generarDeckEspectador, abrirDeckEspectador, descargarDeckEspectador, regenerarDeckEspectador,
  generarDeckGuion, abrirDeckGuion, descargarDeckGuion, regenerarDeckGuion,
}
window.loadEstudio = loadEstudio

})()
