// js/slides.js — Editor de presentaciones IArcanIA OS
;(function () {
'use strict'

// ── Estado ────────────────────────────────────────────────────
let _slides = []
let _activeIdx = 0
let _selectedId = null
let _presId = null
let _presName = 'Mi Presentación'
let _dirty = false
let _h2cLoaded = false
let _jszipLoaded = false
let _rainActive = false
let _rainAnimId = null
let _rainCtx = null
let _rainDrops = []
let _drag = null
let _resize = null
let _thumbDrag = null
let _changingImageId = null
let _initialized = false
let _autoSaveTimer = null
let _history = []
let _charts = {}
let _chartJsLoading = null

// ── Historial ─────────────────────────────────────────────────
function saveHistory() {
  const s = slide()
  if (!s) return
  if (_history.length >= 20) _history.shift()
  _history.push(JSON.parse(JSON.stringify(s)))
}

// ── Utilidades ────────────────────────────────────────────────
const $  = id => document.getElementById(id)
const uid = () => 'e' + Math.random().toString(36).slice(2, 10)
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const toast = msg => typeof showToast === 'function' && showToast(msg)
const slide = () => _slides[_activeIdx]
const findEl = id => (slide()?.elementos || []).find(e => e.id === id)

// ── Factories ─────────────────────────────────────────────────
function newSlide(n) {
  return { id: uid(), nombre: 'Slide ' + n, fondo: 'radial-gradient(ellipse at center, #12082a 0%, #08060f 60%, #04030a 100%)', lluvia: true, logo: true, elementos: [] }
}

function newEl(tipo) {
  const base = { id: uid(), tipo, x: 15, y: 20, w: 55, h: 25, props: {} }
  switch (tipo) {
    case 'texto':
      base.w = 65; base.h = 14
      base.props = { text: 'Doble click para editar', fontSize: 32, color: '#ffffff', fontWeight: 400, align: 'left' }
      break
    case 'forma':
      base.props = { bg: 'rgba(83,74,183,0.15)', border: 'rgba(127,119,221,0.35)', opacity: 1, radius: 8 }
      break
    case 'imagen':
      base.w = 40; base.h = 35
      base.props = { src: '', opacity: 1 }
      break
    case 'flecha':
      base.w = 35; base.h = 6; base.y = 47
      base.props = { color: '#7F77DD', strokeWidth: 2 }
      break
    case 'tabla':
      base.w = 70; base.h = 40
      base.props = { rows: 3, cols: 3, cells: [] }
      break
    case 'grafica':
      base.w = 65; base.h = 42; base.x = 17; base.y = 18
      base.props = { tipo_grafica: 'barras', titulo: '', datos_raw: 'WhatsApp, 45\nInstagram, 30\nEmail, 25' }
      break
    case 'diagrama':
      base.w = 70; base.h = 35; base.x = 15; base.y = 25
      base.props = { definicion: 'WhatsApp → n8n\nn8n → GPT-4\nGPT-4 → Supabase\nSupabase → Respuesta' }
      break
  }
  return base
}

// ── CSS ───────────────────────────────────────────────────────
function injectStyles() {
  if ($('sld-styles')) return
  const s = document.createElement('style')
  s.id = 'sld-styles'
  s.textContent = `
#section-slides { padding:0!important; overflow:hidden; }
#sld-editor { position:fixed; top:0; left:220px; right:0; bottom:0; z-index:50; display:flex; flex-direction:column; background:#0a0a0a; user-select:none; }
#sld-toolbar { display:flex; align-items:center; gap:4px; padding:0 12px; height:44px; background:#0d0d0d; border-bottom:1px solid #1e1e1e; flex-shrink:0; overflow-x:auto; }
#sld-body { display:flex; flex:1; overflow:hidden; min-height:0; }
#sld-panel-left { width:160px; min-width:160px; background:#111; border-right:1px solid #1e1e1e; overflow-y:auto; display:flex; flex-direction:column; }
#sld-canvas-area { flex:1; display:flex; align-items:center; justify-content:center; background:#0a0a0a; overflow:hidden; padding:20px; }
#sld-canvas-wrap { position:relative; flex-shrink:0; }
#sld-canvas { position:relative; width:100%; aspect-ratio:16/9; overflow:hidden; border-radius:6px; box-shadow:0 0 0 1px #2a2a2a; }
#sld-panel-right { width:200px; min-width:200px; background:#111; border-left:1px solid #1e1e1e; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:10px; }
#sld-strip { height:108px; min-height:108px; background:#0d0d0d; border-top:1px solid #1e1e1e; display:flex; align-items:center; gap:8px; padding:0 12px; overflow-x:auto; flex-shrink:0; }
.sld-tb-btn { height:30px; padding:0 10px; border-radius:5px; border:1px solid transparent; background:transparent; color:#777; cursor:pointer; font-family:'Outfit',sans-serif; font-size:12px; font-weight:500; display:inline-flex; align-items:center; gap:5px; transition:all .12s; white-space:nowrap; flex-shrink:0; }
.sld-tb-btn:hover { background:#1e1e1e; color:#e8e8e8; border-color:#2a2a2a; }
.sld-tb-sep { width:1px; height:20px; background:#1e1e1e; margin:0 4px; flex-shrink:0; }
#sld-pres-name { background:transparent; border:1px solid transparent; border-radius:5px; padding:5px 8px; color:#666; font-family:'Outfit',sans-serif; font-size:13px; outline:none; min-width:150px; transition:all .15s; }
#sld-pres-name:hover,#sld-pres-name:focus { border-color:#333; color:#e8e8e8; background:#111; }
.sld-panel-sec { font-size:9px; color:#333; text-transform:uppercase; letter-spacing:.1em; padding:10px 12px 4px; }
.sld-el-type-btn { display:flex; align-items:center; gap:8px; padding:10px 12px; border:none; background:transparent; color:#777; cursor:pointer; font-family:'Outfit',sans-serif; font-size:12px; width:100%; text-align:left; transition:all .12s; }
.sld-el-type-btn:hover { background:#1a1a1a; color:#e8e8e8; }
.sld-el { cursor:move; }
.sld-el-sel { outline:2px dashed #534AB7!important; outline-offset:2px; }
.sld-resize { position:absolute; bottom:-5px; right:-5px; width:11px; height:11px; background:#534AB7; border-radius:2px; cursor:se-resize; z-index:10; }
#sld-logo-bg { position:absolute; width:35%; top:50%; left:50%; transform:translate(-50%,-50%); opacity:.06; filter:blur(1px); pointer-events:none; z-index:1; }
#sld-rain { position:absolute; inset:0; width:100%; height:100%; z-index:2; pointer-events:none; }
#sld-vignette { position:absolute; inset:0; background:radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%); pointer-events:none; z-index:3; }
#sld-elements { position:absolute; inset:0; z-index:4; }
.sld-prop-label { font-size:10px; color:#555; text-transform:uppercase; letter-spacing:.08em; margin-bottom:3px; }
.sld-prop-group { display:flex; flex-direction:column; gap:4px; }
.sld-prop-input { width:100%; background:#161616; border:1px solid #2a2a2a; border-radius:5px; padding:6px 8px; font-family:'Outfit',sans-serif; font-size:12px; color:#e8e8e8; outline:none; transition:border-color .12s; box-sizing:border-box; }
.sld-prop-input:focus { border-color:#444; }
select.sld-prop-input { cursor:pointer; }
.sld-prop-btn { width:100%; padding:7px; border-radius:5px; font-family:'Outfit',sans-serif; font-size:12px; font-weight:500; cursor:pointer; border:none; background:#fff; color:#000; transition:opacity .12s; }
.sld-prop-btn:hover { opacity:.85; }
.sld-prop-btn.ghost { background:transparent; border:1px solid #2a2a2a; color:#888; }
.sld-prop-btn.ghost:hover { border-color:#444; color:#e8e8e8; }
.sld-prop-btn.danger { background:transparent; border:1px solid rgba(226,75,74,0.3); color:#E24B4A; }
.sld-prop-divider { height:1px; background:#1e1e1e; margin:4px 0; }
.sld-thumb { flex-shrink:0; width:152px; height:86px; border-radius:5px; cursor:pointer; position:relative; border:2px solid transparent; overflow:hidden; transition:border-color .15s; }
.sld-thumb.sld-thumb-active { border-color:#534AB7; }
.sld-thumb:hover:not(.sld-thumb-active) { border-color:#444; }
.sld-thumb-label { position:absolute; bottom:0; left:0; right:0; padding:3px 6px; font-size:9px; font-family:'Outfit',sans-serif; color:rgba(255,255,255,.4); background:rgba(0,0,0,.4); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sld-thumb-num { position:absolute; top:3px; left:5px; font-size:9px; color:rgba(255,255,255,.35); font-family:'Outfit',sans-serif; }
.sld-thumb-del { position:absolute; top:2px; right:4px; color:rgba(255,255,255,.25); cursor:pointer; font-size:11px; padding:2px 3px; transition:color .12s; line-height:1; }
.sld-thumb-del:hover { color:#E24B4A; }
.sld-thumb-add { flex-shrink:0; width:90px; height:86px; border-radius:5px; border:1px dashed #2a2a2a; display:flex; align-items:center; justify-content:center; color:#444; cursor:pointer; font-size:22px; transition:all .15s; }
.sld-thumb-add:hover { border-color:#534AB7; color:#534AB7; }
.sld-table-cell { border:1px solid rgba(127,119,221,.2); padding:5px 7px; color:#c8c0f0; font-size:12px; font-family:'Outfit',sans-serif; outline:none; vertical-align:middle; }
.sld-table-cell:focus { background:rgba(83,74,183,.12); }
.sld-dialog-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); z-index:9999; display:flex; align-items:center; justify-content:center; }
.sld-dialog { background:#111; border:1px solid #2a2a2a; border-radius:10px; padding:20px 22px; min-width:250px; }
.sld-dialog h3 { color:#E8E0D0; font-size:15px; margin-bottom:16px; font-family:'Playfair Display',serif; }
.sld-dialog-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.sld-text-inner { width:100%; height:100%; outline:none; white-space:pre-wrap; overflow-wrap:break-word; display:block; }
.sld-tb-select { height:30px; padding:0 8px; border-radius:5px; border:1px solid #2a2a2a; background:#161616; color:#888; font-family:'Outfit',sans-serif; font-size:12px; outline:none; cursor:pointer; max-width:190px; transition:border-color .12s; flex-shrink:0; }
.sld-tb-select:hover,.sld-tb-select:focus { border-color:#444; color:#e8e8e8; }
#sld-ctx-menu { position:fixed; z-index:9999; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,.6); padding:4px 0; min-width:160px; }
.sld-ctx-item { display:flex; align-items:center; padding:8px 14px; font-size:13px; color:#e8e8e8; cursor:pointer; transition:background .1s; white-space:nowrap; }
.sld-ctx-item:hover { background:#2a2a2a; }
.sld-ctx-sep { height:1px; background:#2a2a2a; margin:4px 0; }
`
  document.head.appendChild(s)
}

// ── Construcción del editor ───────────────────────────────────
function buildEditor() {
  $('section-slides').innerHTML = `
<div id="sld-editor">
  <div id="sld-toolbar">
    <button class="sld-tb-btn" onclick="_sld.addSlide()">+ Nuevo slide</button>
    <button class="sld-tb-btn" onclick="_sld.dupSlide()">⧉ Duplicar</button>
    <button class="sld-tb-btn" onclick="_sld.delSlide()">✕ Eliminar</button>
    <div class="sld-tb-sep"></div>
    <button class="sld-tb-btn" id="sld-btn-png" onclick="_sld.downloadPNG()">⬇ PNG</button>
    <button class="sld-tb-btn" id="sld-btn-zip" onclick="_sld.exportZip()">⬇ ZIP</button>
    <button class="sld-tb-btn" onclick="_sld.save()">💾 Guardar</button>
    <div class="sld-tb-sep"></div>
    <button class="sld-tb-btn" onclick="_sld.newPresentation()">📁 Nueva</button>
    <select id="sld-pres-select" class="sld-tb-select" onchange="_sld.loadFromSelect(this.value)">
      <option value="">— Cargar presentación —</option>
    </select>
    <button class="sld-tb-btn" onclick="_sld.deletePresentation()" title="Eliminar presentación" style="color:#E24B4A;padding:0 8px;flex-shrink:0">🗑</button>
    <div class="sld-tb-sep"></div>
    <input id="sld-pres-name" placeholder="Nombre de la presentación" value="${esc(_presName)}" oninput="_sld.setName(this.value)">
  </div>
  <div id="sld-body">
    <div id="sld-panel-left">
      <div class="sld-panel-sec">Agregar elemento</div>
      <button class="sld-el-type-btn" onclick="_sld.addEl('texto')">T&nbsp; Texto</button>
      <button class="sld-el-type-btn" onclick="_sld.addEl('forma')">▭&nbsp; Forma</button>
      <button class="sld-el-type-btn" onclick="_sld.addElTabla()">⬜ Tabla</button>
      <button class="sld-el-type-btn" onclick="_sld.addElImagen()">🖼 Imagen</button>
      <button class="sld-el-type-btn" onclick="_sld.addEl('flecha')">➡ Flecha</button>
      <button class="sld-el-type-btn" onclick="_sld.addElGrafica()">📊 Gráfica</button>
      <button class="sld-el-type-btn" onclick="_sld.addElDiagrama()">🔀 Diagrama</button>
      <input type="file" id="sld-img-input" accept=".jpg,.jpeg,.png,.webp,.svg,image/*" style="display:none" onchange="_sld.handleImage(this)">
    </div>
    <div id="sld-canvas-area">
      <div id="sld-canvas-wrap">
        <div id="sld-canvas">
          <div id="sld-logo-bg"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <circle cx="100" cy="100" r="95" fill="none" stroke="#8b7ed8" stroke-width="1"/>
            <path d="M100 30 L145 100 L100 170 L55 100 Z" fill="none" stroke="#8b7ed8" stroke-width="1.5"/>
            <circle cx="100" cy="100" r="28" fill="none" stroke="#8b7ed8" stroke-width="1.5"/>
            <circle cx="100" cy="100" r="10" fill="#c8c0f0"/>
            <line x1="100" y1="72" x2="100" y2="58" stroke="#8b7ed8" stroke-width="1"/>
            <line x1="100" y1="128" x2="100" y2="142" stroke="#8b7ed8" stroke-width="1"/>
            <line x1="72" y1="100" x2="58" y2="100" stroke="#8b7ed8" stroke-width="1"/>
            <line x1="128" y1="100" x2="142" y2="100" stroke="#8b7ed8" stroke-width="1"/>
            <line x1="80" y1="80" x2="70" y2="70" stroke="#8b7ed8" stroke-width="1"/>
            <line x1="120" y1="80" x2="130" y2="70" stroke="#8b7ed8" stroke-width="1"/>
            <line x1="80" y1="120" x2="70" y2="130" stroke="#8b7ed8" stroke-width="1"/>
            <line x1="120" y1="120" x2="130" y2="130" stroke="#8b7ed8" stroke-width="1"/>
          </svg></div>
          <canvas id="sld-rain"></canvas>
          <div id="sld-vignette"></div>
          <div id="sld-elements"></div>
        </div>
      </div>
    </div>
    <div id="sld-panel-right"></div>
  </div>
  <div id="sld-strip"></div>
</div>`

  sizCanvas()
  window.addEventListener('resize', sizCanvas)

  $('sld-canvas').addEventListener('mousedown', ev => {
    const t = ev.target
    if (t === $('sld-canvas') || t === $('sld-elements') || t.id === 'sld-rain' || t.id === 'sld-logo-bg') {
      deselectEl()
    }
  })

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  $('sld-canvas').addEventListener('contextmenu', ev => {
    ev.preventDefault()
    showCtxMenu(ev.clientX, ev.clientY)
  })
}

function sizCanvas() {
  const area = $('sld-canvas-area')
  const wrap = $('sld-canvas-wrap')
  if (!area || !wrap) return
  const W = area.clientWidth - 40
  const H = area.clientHeight - 40
  const w = Math.min(W, H * 16 / 9)
  wrap.style.width = Math.max(320, w) + 'px'
}

// ── Teclas globales ───────────────────────────────────────────
function bindGlobalKeys() {
  document.addEventListener('keydown', ev => {
    const sec = $('section-slides')
    if (!sec || !sec.classList.contains('active')) return
    const tag = document.activeElement?.tagName
    const ce  = document.activeElement?.contentEditable === 'true'
    if (tag === 'INPUT' || tag === 'TEXTAREA' || ce) return
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && _selectedId) {
      ev.preventDefault(); deleteSelectedEl()
    }
    if (ev.key === 'Escape') deselectEl()
    if (ev.key === 'z' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault()
      if (_history.length) {
        _slides[_activeIdx] = _history.pop()
        _selectedId = null; _dirty = true; renderAll()
      }
    }
    if (ev.key === 'x' && (ev.ctrlKey || ev.metaKey) && _selectedId) {
      ev.preventDefault(); saveHistory(); deleteSelectedEl()
    }
  })

  document.addEventListener('paste', ev => {
    const slidesSection = document.getElementById('section-slides')
    if (!slidesSection || !slidesSection.classList.contains('active')) return
    const items = ev.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image')) {
        const file = item.getAsFile()
        if (!file) return
        const reader = new FileReader()
        reader.onload = e => addImageElement(e.target.result)
        reader.readAsDataURL(file)
        return
      }
    }
  })
}

// ── Render ────────────────────────────────────────────────────
function renderAll() { renderCanvas(); renderStrip(); renderProps() }

function renderCanvas() {
  const s = slide()
  if (!s) return
  const cvs = $('sld-canvas')
  if (!cvs) return
  cvs.style.backgroundColor = '#0d0920'
  cvs.style.backgroundImage = s.fondo.startsWith('#') ? 'none' : s.fondo
  const logo = $('sld-logo-bg')
  if (logo) logo.style.display = s.logo ? '' : 'none'
  updateRain(s.lluvia)
  Object.values(_charts).forEach(c => { try { c.destroy() } catch {} })
  _charts = {}
  const container = $('sld-elements')
  container.innerHTML = ''
  s.elementos.forEach(e => {
    const dom = makeElDOM(e)
    if (dom) container.appendChild(dom)
  })
  s.elementos.filter(e => e.tipo === 'grafica').forEach(e => {
    const chartCvs = document.getElementById('sld-chart-' + e.id)
    if (chartCvs) renderGraficaCanvas(e, chartCvs)
  })
}

// ── Elemento DOM ──────────────────────────────────────────────
function makeElDOM(e) {
  const d = document.createElement('div')
  d.id = 'sldel-' + e.id
  d.className = 'sld-el' + (e.id === _selectedId ? ' sld-el-sel' : '')
  d.style.cssText = `position:absolute;left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%;box-sizing:border-box;`

  switch (e.tipo) {
    case 'texto': {
      Object.assign(d.style, {
        color: e.props.color,
        fontSize: e.props.fontSize + 'px',
        fontWeight: e.props.fontWeight,
        textAlign: e.props.align,
        fontFamily: "'Outfit',sans-serif",
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      })
      const inner = document.createElement('div')
      inner.className = 'sld-text-inner'
      inner.textContent = e.props.text
      d.appendChild(inner)
      d.addEventListener('dblclick', ev => { ev.stopPropagation(); startTextEdit(e.id, inner) })
      break
    }
    case 'forma': {
      Object.assign(d.style, {
        background: e.props.bg,
        border: '1.5px solid ' + e.props.border,
        borderRadius: e.props.radius + 'px',
        opacity: e.props.opacity,
      })
      break
    }
    case 'tabla': {
      d.style.overflow = 'hidden'
      d.appendChild(makeTableDOM(e))
      break
    }
    case 'imagen': {
      if (e.props.src) {
        const img = document.createElement('img')
        img.src = e.props.src
        img.style.cssText = `width:100%;height:100%;object-fit:contain;opacity:${e.props.opacity};pointer-events:none;`
        d.appendChild(img)
      } else {
        d.style.cssText += 'background:#161616;border:1px dashed #333;display:flex;align-items:center;justify-content:center;'
        d.innerHTML = '<span style="color:#444;font-size:28px;pointer-events:none">🖼</span>'
      }
      break
    }
    case 'flecha': {
      const svgNS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(svgNS, 'svg')
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;'
      svg.setAttribute('overflow', 'visible')
      const defs = document.createElementNS(svgNS, 'defs')
      const mk = document.createElementNS(svgNS, 'marker')
      mk.setAttribute('id', 'ah' + e.id)
      mk.setAttribute('markerWidth', '8'); mk.setAttribute('markerHeight', '8')
      mk.setAttribute('refX', '7'); mk.setAttribute('refY', '3')
      mk.setAttribute('orient', 'auto')
      const mkPath = document.createElementNS(svgNS, 'path')
      mkPath.setAttribute('d', 'M0,0 L0,6 L8,3 z')
      mkPath.setAttribute('fill', e.props.color)
      mk.appendChild(mkPath); defs.appendChild(mk)
      const line = document.createElementNS(svgNS, 'line')
      line.setAttribute('x1', '2%'); line.setAttribute('y1', '50%')
      line.setAttribute('x2', '94%'); line.setAttribute('y2', '50%')
      line.setAttribute('stroke', e.props.color)
      line.setAttribute('stroke-width', e.props.strokeWidth)
      line.setAttribute('marker-end', 'url(#ah' + e.id + ')')
      svg.appendChild(defs); svg.appendChild(line)
      d.appendChild(svg)
      break
    }
    case 'grafica': {
      d.style.cssText += 'background:transparent;overflow:hidden;'
      const chartCvs = document.createElement('canvas')
      chartCvs.id = 'sld-chart-' + e.id
      chartCvs.style.cssText = 'width:100%;height:100%;display:block;'
      d.appendChild(chartCvs)
      d.addEventListener('dblclick', ev => { ev.stopPropagation(); showGraficaModal(e) })
      break
    }
    case 'diagrama': {
      d.style.cssText += 'background:transparent;overflow:hidden;'
      d.appendChild(buildDiagramaSVG(e))
      d.addEventListener('dblclick', ev => { ev.stopPropagation(); showDiagramaModal(e) })
      break
    }
  }

  // Resize handle
  const handle = document.createElement('div')
  handle.className = 'sld-resize'
  d.appendChild(handle)

  // Events
  d.addEventListener('mousedown', ev => {
    if (ev.target === handle) return
    if (ev.target.contentEditable === 'true') return
    ev.stopPropagation()
    selectEl(e.id)
    initDrag(ev, e.id)
  })
  handle.addEventListener('mousedown', ev => {
    ev.stopPropagation()
    selectEl(e.id)
    initResize(ev, e.id)
  })
  d.addEventListener('click', ev => { ev.stopPropagation(); selectEl(e.id) })

  return d
}

function makeTableDOM(e) {
  const { rows, cols, cells } = e.props
  const tbl = document.createElement('table')
  tbl.style.cssText = 'width:100%;height:100%;border-collapse:collapse;'
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr')
    tr.style.height = (100 / rows) + '%'
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td')
      td.className = 'sld-table-cell'
      td.style.background = r === 0
        ? 'rgba(83,74,183,0.4)'
        : r % 2 === 0 ? 'rgba(83,74,183,0.1)' : 'rgba(83,74,183,0.05)'
      if (r === 0) td.style.fontWeight = '600'
      td.contentEditable = 'true'
      td.textContent = (cells[r] && cells[r][c] !== undefined) ? cells[r][c] : (r === 0 ? 'Col ' + (c + 1) : '')
      td.addEventListener('input', () => {
        if (!cells[r]) cells[r] = []
        cells[r][c] = td.textContent
        _dirty = true
      })
      td.addEventListener('mousedown', ev => ev.stopPropagation())
      td.addEventListener('click', ev => ev.stopPropagation())
      tr.appendChild(td)
    }
    tbl.appendChild(tr)
  }
  return tbl
}

// ── Text edit ─────────────────────────────────────────────────
function startTextEdit(elId, inner) {
  inner.contentEditable = 'true'
  inner.focus()
  const range = document.createRange()
  range.selectNodeContents(inner)
  const sel = window.getSelection()
  sel.removeAllRanges(); sel.addRange(range)

  const save = () => {
    const el = findEl(elId)
    if (el) { el.props.text = inner.textContent; _dirty = true }
    inner.contentEditable = 'false'
  }
  inner.addEventListener('blur', save, { once: true })
  inner.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); inner.blur() }
    if (ev.key === 'Escape') inner.blur()
    ev.stopPropagation()
  })
  inner.addEventListener('mousedown', ev => ev.stopPropagation())
  inner.addEventListener('click', ev => ev.stopPropagation())
}

// ── Selección ─────────────────────────────────────────────────
function selectEl(id) {
  if (_selectedId === id) return
  if (_selectedId) $('sldel-' + _selectedId)?.classList.remove('sld-el-sel')
  _selectedId = id
  $('sldel-' + id)?.classList.add('sld-el-sel')
  renderProps()
}

function deselectEl() {
  if (_selectedId) $('sldel-' + _selectedId)?.classList.remove('sld-el-sel')
  _selectedId = null
  renderProps()
}

function deleteSelectedEl() {
  if (!_selectedId) return
  const s = slide()
  if (!s) return
  saveHistory()
  s.elementos = s.elementos.filter(e => e.id !== _selectedId)
  _selectedId = null
  _dirty = true
  renderCanvas(); renderProps()
}

// ── Drag & Resize ─────────────────────────────────────────────
function initDrag(ev, elId) {
  const el = findEl(elId)
  if (!el) return
  saveHistory()
  _drag = { elId, startX: ev.clientX, startY: ev.clientY, origX: el.x, origY: el.y }
  ev.preventDefault()
}

function initResize(ev, elId) {
  const el = findEl(elId)
  if (!el) return
  saveHistory()
  _resize = { elId, startX: ev.clientX, startY: ev.clientY, origW: el.w, origH: el.h }
  ev.preventDefault()
}

function onMouseMove(ev) {
  if (_drag) {
    const rect = $('sld-canvas')?.getBoundingClientRect()
    if (!rect) return
    const el = findEl(_drag.elId)
    if (!el) return
    const dx = (ev.clientX - _drag.startX) / rect.width  * 100
    const dy = (ev.clientY - _drag.startY) / rect.height * 100
    el.x = clamp(_drag.origX + dx, 0, 100 - el.w)
    el.y = clamp(_drag.origY + dy, 0, 100 - el.h)
    const dom = $('sldel-' + _drag.elId)
    if (dom) { dom.style.left = el.x + '%'; dom.style.top = el.y + '%' }
    _dirty = true
  }
  if (_resize) {
    const rect = $('sld-canvas')?.getBoundingClientRect()
    if (!rect) return
    const el = findEl(_resize.elId)
    if (!el) return
    const dw = (ev.clientX - _resize.startX) / rect.width  * 100
    const dh = (ev.clientY - _resize.startY) / rect.height * 100
    el.w = clamp(_resize.origW + dw, 5, 100 - el.x)
    el.h = clamp(_resize.origH + dh, 3, 100 - el.y)
    const dom = $('sldel-' + _resize.elId)
    if (dom) { dom.style.width = el.w + '%'; dom.style.height = el.h + '%' }
    _dirty = true
  }
  if (_thumbDrag) {
    _thumbDrag.moved = true
  }
}

function onMouseUp(ev) {
  if (_thumbDrag && _thumbDrag.moved) {
    const strip = $('sld-strip')
    if (strip) {
      const thumbs = [...strip.querySelectorAll('.sld-thumb')]
      let toIdx = null
      thumbs.forEach((t, i) => {
        const r = t.getBoundingClientRect()
        if (ev.clientX >= r.left && ev.clientX <= r.right) toIdx = i
      })
      if (toIdx !== null && toIdx !== _thumbDrag.from) {
        const [moved] = _slides.splice(_thumbDrag.from, 1)
        _slides.splice(toIdx, 0, moved)
        _activeIdx = toIdx
        _dirty = true
        renderAll()
      }
    }
  }
  _drag = null; _resize = null; _thumbDrag = null
}

// ── Tira de miniaturas ────────────────────────────────────────
function renderStrip() {
  const strip = $('sld-strip')
  if (!strip) return
  strip.innerHTML = ''
  _slides.forEach((s, i) => {
    const thumb = document.createElement('div')
    thumb.className = 'sld-thumb' + (i === _activeIdx ? ' sld-thumb-active' : '')
    thumb.style.background = s.fondo
    thumb.innerHTML = `
      <span class="sld-thumb-num">${i + 1}</span>
      <span class="sld-thumb-del" title="Eliminar">✕</span>
      <div class="sld-thumb-label">${esc(s.nombre)}</div>`
    thumb.addEventListener('click', ev => {
      if (ev.target.classList.contains('sld-thumb-del')) return
      switchSlide(i)
    })
    thumb.querySelector('.sld-thumb-del').addEventListener('click', ev => {
      ev.stopPropagation(); _sld.delSlideAt(i)
    })
    thumb.addEventListener('mousedown', ev => {
      if (ev.target.classList.contains('sld-thumb-del')) return
      _thumbDrag = { from: i, moved: false }
    })
    strip.appendChild(thumb)
  })
  const add = document.createElement('div')
  add.className = 'sld-thumb-add'
  add.title = 'Nuevo slide'
  add.textContent = '+'
  add.addEventListener('click', _sld.addSlide)
  strip.appendChild(add)
}

function switchSlide(i) {
  if (i === _activeIdx) return
  _selectedId = null
  _activeIdx = i
  renderAll()
}

// ── Panel de propiedades ──────────────────────────────────────
function renderProps() {
  const panel = $('sld-panel-right')
  if (!panel) return
  const s = slide()
  if (!s) { panel.innerHTML = ''; return }

  if (!_selectedId) {
    panel.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:#666;margin-bottom:4px">Slide</div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Nombre</div>
        <input class="sld-prop-input" value="${esc(s.nombre)}" oninput="_sld.setSlideProp('nombre',this.value)">
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Fondo</div>
        <input type="color" class="sld-prop-input" value="${s.fondo}" style="padding:2px;height:30px;cursor:pointer" oninput="_sld.setSlideProp('fondo',this.value)">
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="sld-prop-label" style="margin:0">Lluvia</span>
        <input type="checkbox" ${s.lluvia ? 'checked' : ''} onchange="_sld.setSlideProp('lluvia',this.checked)" style="cursor:pointer">
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="sld-prop-label" style="margin:0">Logo</span>
        <input type="checkbox" ${s.logo ? 'checked' : ''} onchange="_sld.setSlideProp('logo',this.checked)" style="cursor:pointer">
      </div>`
    return
  }

  const el = findEl(_selectedId)
  if (!el) { panel.innerHTML = ''; return }

  let html = `<div style="font-size:11px;font-weight:600;color:#666;margin-bottom:4px;text-transform:capitalize">${el.tipo}</div>`

  if (el.tipo === 'texto') {
    html += `
      <div class="sld-prop-group">
        <div class="sld-prop-label">Tamaño (px)</div>
        <input type="number" class="sld-prop-input" value="${el.props.fontSize}" min="12" max="72" oninput="_sld.updateProp('fontSize',+this.value)">
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Color</div>
        <input type="color" class="sld-prop-input" value="${el.props.color}" style="padding:2px;height:30px;cursor:pointer" oninput="_sld.updateProp('color',this.value)">
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Peso</div>
        <select class="sld-prop-input" onchange="_sld.updateProp('fontWeight',+this.value)">
          <option value="300" ${el.props.fontWeight===300?'selected':''}>Light</option>
          <option value="400" ${el.props.fontWeight===400?'selected':''}>Regular</option>
          <option value="600" ${el.props.fontWeight===600?'selected':''}>Semi Bold</option>
          <option value="700" ${el.props.fontWeight===700?'selected':''}>Bold</option>
        </select>
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Alineación</div>
        <select class="sld-prop-input" onchange="_sld.updateProp('align',this.value)">
          <option value="left" ${el.props.align==='left'?'selected':''}>Izquierda</option>
          <option value="center" ${el.props.align==='center'?'selected':''}>Centro</option>
          <option value="right" ${el.props.align==='right'?'selected':''}>Derecha</option>
        </select>
      </div>`
  } else if (el.tipo === 'forma') {
    html += `
      <div class="sld-prop-group">
        <div class="sld-prop-label">Fondo (rgba)</div>
        <input class="sld-prop-input" value="${esc(el.props.bg)}" oninput="_sld.updateProp('bg',this.value)">
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Borde (rgba)</div>
        <input class="sld-prop-input" value="${esc(el.props.border)}" oninput="_sld.updateProp('border',this.value)">
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Opacidad</div>
        <input type="range" min="0" max="1" step="0.05" value="${el.props.opacity}" style="width:100%;cursor:pointer" oninput="_sld.updateProp('opacity',+this.value)">
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Radio (px)</div>
        <input type="number" class="sld-prop-input" value="${el.props.radius}" min="0" max="100" oninput="_sld.updateProp('radius',+this.value)">
      </div>`
  } else if (el.tipo === 'imagen') {
    html += `
      <div class="sld-prop-group">
        <div class="sld-prop-label">Opacidad</div>
        <input type="range" min="0" max="1" step="0.05" value="${el.props.opacity}" style="width:100%;cursor:pointer" oninput="_sld.updateProp('opacity',+this.value)">
      </div>
      <button class="sld-prop-btn" onclick="_sld.changeImage()">Cambiar imagen</button>`
  } else if (el.tipo === 'flecha') {
    html += `
      <div class="sld-prop-group">
        <div class="sld-prop-label">Color</div>
        <input type="color" class="sld-prop-input" value="${el.props.color}" style="padding:2px;height:30px;cursor:pointer" oninput="_sld.updateProp('color',this.value)">
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Grosor (px)</div>
        <input type="number" class="sld-prop-input" value="${el.props.strokeWidth}" min="1" max="12" oninput="_sld.updateProp('strokeWidth',+this.value)">
      </div>`
  } else if (el.tipo === 'grafica') {
    html += `<button class="sld-prop-btn" onclick="_sld.editGrafica()">Editar gráfica</button>`
  } else if (el.tipo === 'diagrama') {
    html += `<button class="sld-prop-btn" onclick="_sld.editDiagrama()">Editar diagrama</button>`
  }

  html += `
    <div class="sld-prop-divider"></div>
    <button class="sld-prop-btn danger" onclick="_sld.deleteSelected()">Eliminar elemento</button>`

  panel.innerHTML = html
}

// ── Operaciones de slides ──────────────────────────────────────
function addSlide() {
  _slides.push(newSlide(_slides.length + 1))
  _activeIdx = _slides.length - 1
  _selectedId = null; _dirty = true; renderAll()
}

function dupSlide() {
  const s = slide()
  if (!s) return
  const d = JSON.parse(JSON.stringify(s))
  d.id = uid(); d.nombre = s.nombre + ' (copia)'
  d.elementos = d.elementos.map(e => ({ ...e, id: uid() }))
  _slides.splice(_activeIdx + 1, 0, d)
  _activeIdx++; _dirty = true; renderAll()
}

function delSlideAt(idx) {
  if (_slides.length <= 1) { toast('⚠️ Debe existir al menos un slide'); return }
  _slides.splice(idx, 1)
  _activeIdx = clamp(_activeIdx, 0, _slides.length - 1)
  _selectedId = null; _dirty = true; renderAll()
}

function setSlideProp(key, val) {
  const s = slide()
  if (!s) return
  s[key] = val; _dirty = true
  if (key === 'fondo') { const c = $('sld-canvas'); if (c) { c.style.backgroundColor = '#0d0920'; c.style.backgroundImage = val.startsWith('#') ? 'none' : val } }
  if (key === 'logo')  { const l = $('sld-logo-bg'); if (l) l.style.display = val ? '' : 'none' }
  if (key === 'lluvia') updateRain(val)
  if (key === 'nombre') renderStrip()
  else renderStrip()
}

// ── Operaciones de elementos ──────────────────────────────────
function addEl(tipo) {
  const s = slide()
  if (!s) return
  saveHistory()
  const el = newEl(tipo)
  s.elementos.push(el)
  _dirty = true; renderCanvas(); selectEl(el.id)
}

function addElTabla() {
  showTableDialog((rows, cols) => {
    const s = slide()
    if (!s) return
    saveHistory()
    const el = newEl('tabla')
    el.props.rows = rows; el.props.cols = cols; el.props.cells = []
    s.elementos.push(el)
    _dirty = true; renderCanvas(); selectEl(el.id)
  })
}

function addElImagen() {
  _changingImageId = null
  $('sld-img-input').click()
}

function changeImage() {
  _changingImageId = _selectedId
  $('sld-img-input').click()
}

function handleImage(input) {
  const file = input.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    if (_changingImageId) {
      const el = findEl(_changingImageId)
      if (el && el.tipo === 'imagen') {
        el.props.src = ev.target.result
        _dirty = true; renderCanvas(); selectEl(_changingImageId)
      }
      _changingImageId = null
    } else {
      const s = slide()
      if (!s) return
      const el = newEl('imagen')
      el.props.src = ev.target.result
      s.elementos.push(el)
      _dirty = true; renderCanvas(); selectEl(el.id)
    }
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function addImageElement(src) {
  const s = slide()
  if (!s) return
  const tmp = new Image()
  tmp.onload = () => {
    saveHistory()
    const el = newEl('imagen')
    el.w = 60; el.x = 20; el.y = 20
    const ratio = tmp.naturalHeight / tmp.naturalWidth
    el.h = Math.round(Math.min(60 * ratio, 55) * 100) / 100
    el.props.src = src
    s.elementos.push(el)
    _dirty = true; renderCanvas(); selectEl(el.id)
  }
  tmp.onerror = () => {
    saveHistory()
    const el = newEl('imagen')
    el.w = 60; el.x = 20; el.y = 20
    el.props.src = src
    s.elementos.push(el)
    _dirty = true; renderCanvas(); selectEl(el.id)
  }
  tmp.src = src
}

async function pasteImageFromClipboard() {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image'))
      if (imageType) {
        const blob = await item.getType(imageType)
        const reader = new FileReader()
        reader.onload = e => addImageElement(e.target.result)
        reader.readAsDataURL(blob)
        return
      }
    }
  } catch {
    // Fallback via paste event listener
  }
}

function removeCtxMenu() {
  const m = $('sld-ctx-menu')
  if (m) m.remove()
}

function showCtxMenu(x, y) {
  removeCtxMenu()
  const menu = document.createElement('div')
  menu.id = 'sld-ctx-menu'
  menu.style.left = x + 'px'
  menu.style.top  = y + 'px'

  const opts = [
    ['📋', 'Pegar imagen',  () => pasteImageFromClipboard()],
    ['📝', 'Agregar texto', () => addEl('texto')],
    ['⬜', 'Agregar forma', () => addEl('forma')],
  ]
  opts.forEach(([icon, label, fn]) => {
    const item = document.createElement('div')
    item.className = 'sld-ctx-item'
    item.textContent = icon + ' ' + label
    item.addEventListener('click', () => { removeCtxMenu(); fn() })
    menu.appendChild(item)
  })

  if (_selectedId) {
    const sep = document.createElement('div')
    sep.className = 'sld-ctx-sep'
    menu.appendChild(sep)
    const del = document.createElement('div')
    del.className = 'sld-ctx-item'
    del.style.color = '#E24B4A'
    del.textContent = '🗑 Eliminar elemento'
    del.addEventListener('click', () => { removeCtxMenu(); deleteSelectedEl() })
    menu.appendChild(del)
  }

  document.body.appendChild(menu)
  setTimeout(() => document.addEventListener('click', removeCtxMenu, { once: true }), 0)
}

// ── Gráfica ───────────────────────────────────────────────────
const SLD_COLORS = ['#7F77DD', '#534AB7', '#9d8fe0', '#3C3489', '#c8c0f0', '#AFA9EC']

async function ensureChartJs() {
  if (window.Chart) return true
  if (!_chartJsLoading) {
    _chartJsLoading = loadLib('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js', 'Chart')
  }
  return _chartJsLoading
}

function parseGraficaDatos(raw) {
  return (raw || '').split('\n')
    .map(l => l.trim()).filter(Boolean)
    .map(l => {
      const [label, ...rest] = l.split(',')
      return { label: label.trim(), value: parseFloat(rest.join(',')) || 0 }
    })
}

async function renderGraficaCanvas(el, cvs) {
  if (!await ensureChartJs()) return
  if (_charts[el.id]) { try { _charts[el.id].destroy() } catch {} }
  const datos = parseGraficaDatos(el.props.datos_raw)
  const tipo = { barras: 'bar', lineas: 'line', pie: 'pie' }[el.props.tipo_grafica] || 'bar'
  const isRound = tipo === 'pie'
  _charts[el.id] = new Chart(cvs, {
    type: tipo,
    data: {
      labels: datos.map(d => d.label),
      datasets: [{
        label: el.props.titulo || '',
        data: datos.map(d => d.value),
        backgroundColor: SLD_COLORS,
        borderColor: isRound ? 'transparent' : SLD_COLORS,
        borderWidth: 1,
        tension: 0.3,
        fill: false,
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#c8c0f0', font: { family: 'Outfit' } } },
        title: el.props.titulo
          ? { display: true, text: el.props.titulo, color: '#c8c0f0', font: { family: 'Outfit', size: 14 } }
          : { display: false }
      },
      scales: isRound ? {} : {
        x: { ticks: { color: '#c8c0f0' }, grid: { color: 'rgba(127,119,221,0.2)' } },
        y: { ticks: { color: '#c8c0f0' }, grid: { color: 'rgba(127,119,221,0.2)' } }
      }
    }
  })
}

function showGraficaModal(existingEl) {
  const prev = existingEl?.props || {}
  const tipoActivo = t => (prev.tipo_grafica || 'barras') === t ? '' : 'ghost'
  const ov = document.createElement('div')
  ov.className = 'sld-dialog-overlay'
  ov.innerHTML = `
    <div class="sld-dialog" style="min-width:340px;max-width:420px">
      <h3>${existingEl ? 'Editar gráfica' : 'Nueva gráfica'}</h3>
      <div class="sld-prop-group" style="margin-bottom:10px">
        <div class="sld-prop-label">Tipo</div>
        <div style="display:flex;gap:6px">
          <button id="sld-gt-barras" class="sld-prop-btn ${tipoActivo('barras')}" style="flex:1;padding:6px 0">Barras</button>
          <button id="sld-gt-lineas" class="sld-prop-btn ${tipoActivo('lineas')}" style="flex:1;padding:6px 0">Líneas</button>
          <button id="sld-gt-pie"    class="sld-prop-btn ${tipoActivo('pie')}"    style="flex:1;padding:6px 0">Pie</button>
        </div>
      </div>
      <div class="sld-prop-group" style="margin-bottom:10px">
        <div class="sld-prop-label">Título (opcional)</div>
        <input id="sld-gt-titulo" class="sld-prop-input" placeholder="Sin título" value="${esc(prev.titulo || '')}">
      </div>
      <div class="sld-prop-group" style="margin-bottom:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div class="sld-prop-label" style="margin-bottom:0">Datos — Etiqueta, Valor</div>
          <button class="sld-prop-btn ghost" id="sld-gt-ia-btn" style="padding:3px 10px;font-size:12px">✨ Generar con IA</button>
        </div>
        <textarea id="sld-gt-datos" rows="5" class="sld-prop-input" style="resize:vertical;font-family:monospace;font-size:12px">${esc(prev.datos_raw || 'WhatsApp, 45\nInstagram, 30\nEmail, 25')}</textarea>
      </div>
      <div id="sld-gt-ia-panel" style="display:none;margin-bottom:14px">
        <div style="display:flex;gap:6px">
          <input id="sld-gt-ia-tema" class="sld-prop-input" placeholder="¿Sobre qué quieres la gráfica?" style="flex:1">
          <button class="sld-prop-btn" id="sld-gt-ia-gen" style="padding:6px 12px;white-space:nowrap">Generar</button>
        </div>
      </div>
      <div class="sld-dialog-actions">
        <button class="sld-prop-btn ghost" style="padding:7px 14px" onclick="this.closest('.sld-dialog-overlay').remove()">Cancelar</button>
        <button class="sld-prop-btn" style="padding:7px 14px" id="sld-gt-ok">${existingEl ? 'Actualizar' : 'Insertar gráfica'}</button>
      </div>
    </div>`
  document.body.appendChild(ov)
  let tipoSel = prev.tipo_grafica || 'barras'
  ;['barras', 'lineas', 'pie'].forEach(t => {
    ov.querySelector('#sld-gt-' + t).addEventListener('click', () => {
      tipoSel = t
      ;['barras', 'lineas', 'pie'].forEach(b => ov.querySelector('#sld-gt-' + b).classList.toggle('ghost', b !== t))
    })
  })
  ov.querySelector('#sld-gt-ia-btn').addEventListener('click', () => {
    const panel = ov.querySelector('#sld-gt-ia-panel')
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none'
    if (panel.style.display === 'block') ov.querySelector('#sld-gt-ia-tema').focus()
  })
  ov.querySelector('#sld-gt-ia-gen').addEventListener('click', async () => {
    const tema = ov.querySelector('#sld-gt-ia-tema').value.trim()
    if (!tema) return
    const genBtn = ov.querySelector('#sld-gt-ia-gen')
    genBtn.textContent = 'Generando...'
    genBtn.disabled = true
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'Eres un asistente de datos para Miguel Aguilar, fundador de IArcanIA en Colombia. Miguel construye automatizaciones con n8n, agentes de IA con GPT-4, sitios web con Next.js y Supabase. Cuando te pidan datos para una gráfica, devuelve SOLO el formato Etiqueta, Valor — una por línea, sin texto adicional, sin explicaciones. Los valores deben ser números. Máximo 8 filas. Si no tienes datos exactos, usa estimaciones razonables basadas en tu conocimiento.',
          messages: [{ role: 'user', content: `Genera datos para una gráfica sobre: ${tema}` }]
        })
      })
      const data = await res.json()
      const texto = data.content?.[0]?.text || data.text || data.result || ''
      if (texto) {
        ov.querySelector('#sld-gt-datos').value = texto.trim()
        ov.querySelector('#sld-gt-ia-panel').style.display = 'none'
      }
    } catch (e) {
      console.error('Error generando datos con IA:', e)
    } finally {
      genBtn.textContent = 'Generar'
      genBtn.disabled = false
    }
  })
  ov.querySelector('#sld-gt-ok').addEventListener('click', () => {
    const titulo    = ov.querySelector('#sld-gt-titulo').value.trim()
    const datos_raw = ov.querySelector('#sld-gt-datos').value.trim()
    ov.remove()
    if (existingEl) {
      saveHistory()
      existingEl.props.tipo_grafica = tipoSel
      existingEl.props.titulo    = titulo
      existingEl.props.datos_raw = datos_raw
      _dirty = true; renderCanvas(); if (_selectedId) selectEl(_selectedId)
    } else {
      const s = slide(); if (!s) return
      saveHistory()
      const el = newEl('grafica')
      el.props.tipo_grafica = tipoSel
      el.props.titulo    = titulo
      el.props.datos_raw = datos_raw
      s.elementos.push(el)
      _dirty = true; renderCanvas(); selectEl(el.id)
    }
  })
}

// ── Diagrama ──────────────────────────────────────────────────
function parseDiagramaDef(def) {
  const nodes = [], edges = [], nodeMap = {}
  ;(def || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const m = line.match(/^(.+?)\s*(?:→|->)\s*(.+)$/)
    if (!m) return
    const a = m[1].trim(), b = m[2].trim()
    if (nodeMap[a] === undefined) { nodeMap[a] = nodes.length; nodes.push(a) }
    if (nodeMap[b] === undefined) { nodeMap[b] = nodes.length; nodes.push(b) }
    edges.push([nodeMap[a], nodeMap[b]])
  })
  return { nodes, edges }
}

function buildDiagramaSVG(el) {
  const { nodes, edges } = parseDiagramaDef(el.props.definicion)
  const NW = 120, NH = 36, GAP = 55
  const horiz = nodes.length <= 4
  const count = Math.max(nodes.length, 1)
  const vbW = horiz ? count * NW + (count - 1) * GAP + 20 : NW + 20
  const vbH = horiz ? NH + 40 : count * NH + (count - 1) * GAP + 20
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%')
  svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  const defs = document.createElementNS(svgNS, 'defs')
  const mk = document.createElementNS(svgNS, 'marker')
  mk.setAttribute('id', 'dgm-ah-' + el.id)
  mk.setAttribute('markerWidth', '8'); mk.setAttribute('markerHeight', '8')
  mk.setAttribute('refX', '7'); mk.setAttribute('refY', '3'); mk.setAttribute('orient', 'auto')
  const mkp = document.createElementNS(svgNS, 'path')
  mkp.setAttribute('d', 'M0,0 L0,6 L8,3 z'); mkp.setAttribute('fill', '#7F77DD')
  mk.appendChild(mkp); defs.appendChild(mk); svg.appendChild(defs)
  const nodePos = nodes.map((_, i) => ({
    x: horiz ? 10 + i * (NW + GAP) : (vbW - NW) / 2,
    y: horiz ? (vbH - NH) / 2 : 10 + i * (NH + GAP)
  }))
  edges.forEach(([a, b]) => {
    const pa = nodePos[a], pb = nodePos[b]
    const line = document.createElementNS(svgNS, 'line')
    line.setAttribute('x1', horiz ? pa.x + NW  : pa.x + NW / 2)
    line.setAttribute('y1', horiz ? pa.y + NH / 2 : pa.y + NH)
    line.setAttribute('x2', horiz ? pb.x - 2   : pb.x + NW / 2)
    line.setAttribute('y2', horiz ? pb.y + NH / 2 : pb.y - 2)
    line.setAttribute('stroke', '#7F77DD'); line.setAttribute('stroke-width', '1.5')
    line.setAttribute('marker-end', 'url(#dgm-ah-' + el.id + ')')
    svg.appendChild(line)
  })
  nodes.forEach((label, i) => {
    const { x, y } = nodePos[i]
    const rect = document.createElementNS(svgNS, 'rect')
    rect.setAttribute('x', x); rect.setAttribute('y', y)
    rect.setAttribute('width', NW); rect.setAttribute('height', NH); rect.setAttribute('rx', '6')
    rect.setAttribute('fill', 'rgba(83,74,183,0.2)')
    rect.setAttribute('stroke', 'rgba(127,119,221,0.4)'); rect.setAttribute('stroke-width', '1')
    svg.appendChild(rect)
    const text = document.createElementNS(svgNS, 'text')
    text.setAttribute('x', x + NW / 2); text.setAttribute('y', y + NH / 2 + 4.5)
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', '#c8c0f0')
    text.setAttribute('font-size', '13'); text.setAttribute('font-family', 'Outfit,sans-serif')
    text.textContent = label
    svg.appendChild(text)
  })
  return svg
}

function showDiagramaModal(existingEl) {
  const prev = existingEl?.props || {}
  const ov = document.createElement('div')
  ov.className = 'sld-dialog-overlay'
  ov.innerHTML = `
    <div class="sld-dialog" style="min-width:340px;max-width:420px">
      <h3>${existingEl ? 'Editar diagrama' : 'Nuevo diagrama'}</h3>
      <div class="sld-prop-group" style="margin-bottom:14px">
        <div class="sld-prop-label">Definición — A → B</div>
        <textarea id="sld-dgm-def" rows="6" class="sld-prop-input" style="resize:vertical;font-family:monospace;font-size:12px">${esc(prev.definicion || 'WhatsApp → n8n\nn8n → GPT-4\nGPT-4 → Supabase\nSupabase → Respuesta')}</textarea>
      </div>
      <div class="sld-dialog-actions">
        <button class="sld-prop-btn ghost" style="padding:7px 14px" onclick="this.closest('.sld-dialog-overlay').remove()">Cancelar</button>
        <button class="sld-prop-btn" style="padding:7px 14px" id="sld-dgm-ok">${existingEl ? 'Actualizar' : 'Insertar diagrama'}</button>
      </div>
    </div>`
  document.body.appendChild(ov)
  ov.querySelector('#sld-dgm-ok').addEventListener('click', () => {
    const definicion = ov.querySelector('#sld-dgm-def').value.trim()
    ov.remove()
    if (existingEl) {
      saveHistory()
      existingEl.props.definicion = definicion
      _dirty = true; renderCanvas(); if (_selectedId) selectEl(_selectedId)
    } else {
      const s = slide(); if (!s) return
      saveHistory()
      const el = newEl('diagrama')
      el.props.definicion = definicion
      s.elementos.push(el)
      _dirty = true; renderCanvas(); selectEl(el.id)
    }
  })
}

function updateProp(key, val) {
  const el = findEl(_selectedId)
  if (!el) return
  saveHistory()
  el.props[key] = val; _dirty = true
  const dom = $('sldel-' + el.id)
  if (!dom) return
  if (el.tipo === 'texto') {
    if (key === 'color')      dom.style.color      = val
    if (key === 'fontSize')   dom.style.fontSize   = val + 'px'
    if (key === 'fontWeight') dom.style.fontWeight = val
    if (key === 'align')      dom.style.textAlign  = val
  } else if (el.tipo === 'forma') {
    if (key === 'bg')      dom.style.background  = val
    if (key === 'border')  dom.style.borderColor = val
    if (key === 'opacity') dom.style.opacity     = val
    if (key === 'radius')  dom.style.borderRadius = val + 'px'
  } else if (el.tipo === 'imagen') {
    if (key === 'opacity') { const img = dom.querySelector('img'); if (img) img.style.opacity = val }
  } else if (el.tipo === 'flecha') {
    renderCanvas(); if (_selectedId) selectEl(_selectedId)
  }
}

function deleteSelected() { deleteSelectedEl() }

// ── Diálogo tabla ─────────────────────────────────────────────
function showTableDialog(cb) {
  const ov = document.createElement('div')
  ov.className = 'sld-dialog-overlay'
  ov.innerHTML = `
    <div class="sld-dialog">
      <h3>Nueva tabla</h3>
      <div class="sld-prop-group" style="margin-bottom:10px">
        <div class="sld-prop-label">Filas (2–6)</div>
        <input id="sld-tbl-rows" type="number" class="sld-prop-input" value="3" min="2" max="6">
      </div>
      <div class="sld-prop-group">
        <div class="sld-prop-label">Columnas (2–5)</div>
        <input id="sld-tbl-cols" type="number" class="sld-prop-input" value="3" min="2" max="5">
      </div>
      <div class="sld-dialog-actions">
        <button class="sld-prop-btn ghost" style="padding:7px 14px" onclick="this.closest('.sld-dialog-overlay').remove()">Cancelar</button>
        <button class="sld-prop-btn" style="padding:7px 14px" id="sld-tbl-ok">Crear</button>
      </div>
    </div>`
  document.body.appendChild(ov)
  ov.querySelector('#sld-tbl-ok').addEventListener('click', () => {
    const rows = clamp(+($('sld-tbl-rows')?.value || 3), 2, 6)
    const cols = clamp(+($('sld-tbl-cols')?.value || 3), 2, 5)
    ov.remove(); cb(rows, cols)
  })
}

// ── Rain ──────────────────────────────────────────────────────
function updateRain(active) {
  const canvas = $('sld-rain')
  if (!canvas) return
  if (active && !_rainActive) {
    _rainActive = true
    requestAnimationFrame(() => {
      canvas.width  = canvas.offsetWidth  || 800
      canvas.height = canvas.offsetHeight || 450
      _rainCtx = canvas.getContext('2d')
      const count = Math.floor(canvas.width / 5)
      _rainDrops = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: 8 + Math.random() * 18,
        speed: 1.5 + Math.random() * 3,
        opacity: 0.06 + Math.random() * 0.15,
        dark: Math.random() > 0.7,
      }))
      drawRain()
    })
  } else if (!active && _rainActive) {
    _rainActive = false
    if (_rainAnimId) { cancelAnimationFrame(_rainAnimId); _rainAnimId = null }
    if (_rainCtx) _rainCtx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

function drawRain() {
  if (!_rainActive || !_rainCtx) return
  const canvas = $('sld-rain')
  if (!canvas) return
  _rainCtx.clearRect(0, 0, canvas.width, canvas.height)
  _rainDrops.forEach(d => {
    _rainCtx.beginPath()
    _rainCtx.moveTo(d.x, d.y)
    _rainCtx.lineTo(d.x - 1, d.y + d.len)
    _rainCtx.strokeStyle = d.dark ? `rgba(100,80,200,${d.opacity})` : `rgba(150,130,230,${d.opacity})`
    _rainCtx.lineWidth = 0.8
    _rainCtx.stroke()
    d.y += d.speed
    if (d.y > canvas.height) { d.y = -d.len; d.x = Math.random() * canvas.width }
  })
  _rainAnimId = requestAnimationFrame(drawRain)
}

// ── Descarga / Exportación ────────────────────────────────────
async function loadLib(url, check) {
  if (window[check]) return true
  try {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = url; s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
    return !!window[check]
  } catch { return false }
}

async function captureSlide(s, el) {
  if (!await loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas'))
    throw new Error('No se pudo cargar html2canvas')
  const w = el.offsetWidth, h = el.offsetHeight, scale = 2

  // Fondo: gradiente o color sólido sobre canvas temporal
  const bgCvs = document.createElement('canvas')
  bgCvs.width = w * scale; bgCvs.height = h * scale
  const bgCtx = bgCvs.getContext('2d')
  bgCtx.scale(scale, scale)
  const fondo = s?.fondo || ''
  if (fondo.startsWith('#')) {
    bgCtx.fillStyle = fondo
    bgCtx.fillRect(0, 0, w, h)
  } else {
    const cx = w / 2, cy = h / 2, r = Math.max(w, h) * 0.85
    const grad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, '#12082a')
    grad.addColorStop(0.6, '#08060f')
    grad.addColorStop(1, '#04030a')
    bgCtx.fillStyle = grad
    bgCtx.fillRect(0, 0, w, h)
  }

  // Contenido via html2canvas (ignora el canvas de lluvia)
  const content = await html2canvas(el, {
    backgroundColor: null, useCORS: true, scale,
    ignoreElements: e => e.tagName === 'CANVAS',
  })

  // Combinar fondo + contenido
  const final = document.createElement('canvas')
  final.width = w * scale; final.height = h * scale
  const ctx = final.getContext('2d')
  ctx.drawImage(bgCvs, 0, 0)
  ctx.drawImage(content, 0, 0)
  return final
}

async function downloadPNG() {
  const btn = $('sld-btn-png')
  const orig = btn?.textContent
  if (btn) btn.textContent = '⏳ Capturando...'
  try {
    const el = $('sld-canvas')
    if (!el) { toast('❌ Canvas no encontrado'); return }
    const final = await captureSlide(slide(), el)
    const a = document.createElement('a')
    a.download = `slide-${_activeIdx + 1}-${Date.now()}.png`
    a.href = final.toDataURL('image/png')
    a.click()
  } catch(e) {
    toast('❌ Error al capturar: ' + (e?.message || String(e)))
  } finally {
    if (btn && orig) btn.textContent = orig
  }
}

async function exportZip() {
  const btn = $('sld-btn-zip')
  const orig = btn?.textContent
  if (!await loadLib('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip')) {
    toast('❌ Error al cargar JSZip'); return
  }
  // html2canvas se carga dentro de captureSlide pero lo precargamos para el loop
  await loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas')
  const origIdx = _activeIdx
  const zip = new JSZip()
  try {
    for (let i = 0; i < _slides.length; i++) {
      if (btn) btn.textContent = `⏳ ${i + 1}/${_slides.length}...`
      _activeIdx = i; _selectedId = null; renderCanvas()
      await new Promise(r => setTimeout(r, 150))
      const el = $('sld-canvas')
      if (!el) continue
      const final = await captureSlide(_slides[i], el)
      const blob = await new Promise(r => final.toBlob(r, 'image/png'))
      zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(content)
    a.download = `${_presName || 'presentacion'}.zip`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('✅ Presentación exportada')
  } catch(e) {
    toast('❌ Error al exportar: ' + (e?.message || String(e)))
  } finally {
    _activeIdx = origIdx; renderAll()
    if (btn && orig) btn.textContent = orig
  }
}

// ── Supabase ──────────────────────────────────────────────────
async function save() {
  if (typeof SB_P === 'undefined' || typeof USER_ID === 'undefined') { toast('⚠️ No autenticado'); return }
  const payload = { user_id: USER_ID, titulo: _presName, modo: 'presentacion', contenido: { slides: _slides } }
  let result
  if (_presId) {
    result = await SB_P.from('slides').update(payload).eq('id', _presId)
  } else {
    result = await SB_P.from('slides').insert(payload).select('id').single()
    if (!result.error && result.data) _presId = result.data.id
  }
  if (result.error) { toast('❌ ' + result.error.message); return }
  _dirty = false; toast('✅ Presentación guardada')
  loadAllPresentations()
}

async function loadPresentation() {
  if (typeof SB_P === 'undefined' || typeof USER_ID === 'undefined') { initDefault(); return }
  const { data, error } = await SB_P.from('slides')
    .select('*').eq('modo', 'presentacion')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error || !data) { initDefault(); return }
  _presId    = data.id
  _presName  = data.titulo || 'Mi Presentación'
  const inp = $('sld-pres-name')
  if (inp) inp.value = _presName
  _slides = data.contenido?.slides || []
  if (!_slides.length) initDefault()
  else { _activeIdx = 0; renderAll() }
  loadAllPresentations()
}

function initDefault() {
  _slides = [newSlide(1)]
  _activeIdx = 0; renderAll()
}

function startAutoSave() {
  if (_autoSaveTimer) clearInterval(_autoSaveTimer)
  _autoSaveTimer = setInterval(() => { if (_dirty) save() }, 30000)
}

async function newPresentation() {
  if (!confirm('¿Crear nueva presentación? Se guardará la actual.')) return
  if (_dirty) await save()
  _presId     = null
  _presName   = 'Mi Presentación'
  _slides     = [newSlide(1)]
  _activeIdx  = 0
  _selectedId = null
  _dirty      = false
  const inp = $('sld-pres-name')
  if (inp) inp.value = _presName
  renderAll()
  loadAllPresentations()
}

// ── Selector de presentaciones ────────────────────────────────
async function loadAllPresentations() {
  if (typeof SB_P === 'undefined') return
  const { data } = await SB_P.from('slides')
    .select('id,titulo,created_at')
    .eq('modo', 'presentacion')
    .order('created_at', { ascending: false })
  const sel = $('sld-pres-select')
  if (!sel) return
  sel.innerHTML = '<option value="">— Cargar presentación —</option>'
  ;(data || []).forEach(p => {
    const date = new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = `${p.titulo || 'Sin nombre'} · ${date}`
    if (p.id === _presId) opt.selected = true
    sel.appendChild(opt)
  })
}

async function loadFromSelect(id) {
  if (!id) return
  if (_dirty && !confirm('¿Cargar otra presentación? Los cambios no guardados se perderán.')) {
    const sel = $('sld-pres-select')
    if (sel) [...sel.options].forEach(o => { o.selected = (o.value === _presId) })
    return
  }
  const { data, error } = await SB_P.from('slides').select('*').eq('id', id).single()
  if (error || !data) { toast('❌ Error al cargar'); return }
  _presId     = data.id
  _presName   = data.titulo || 'Mi Presentación'
  _slides     = data.contenido?.slides?.length ? data.contenido.slides : [newSlide(1)]
  _activeIdx  = 0
  _selectedId = null
  _dirty      = false
  const inp = $('sld-pres-name')
  if (inp) inp.value = _presName
  renderAll()
  loadAllPresentations()
  toast('✅ Presentación cargada')
}

async function deletePresentation() {
  const sel = $('sld-pres-select')
  const id = sel?.value || _presId
  if (!id) { toast('⚠️ Selecciona una presentación para eliminar'); return }
  if (!confirm('¿Eliminar esta presentación? No se puede deshacer.')) return
  const { error } = await SB_P.from('slides').delete().eq('id', id)
  if (error) { toast('❌ ' + error.message); return }
  toast('🗑 Presentación eliminada')
  if (id === _presId) {
    _presId = null; _presName = 'Mi Presentación'
    _slides = [newSlide(1)]; _activeIdx = 0; _selectedId = null; _dirty = false
    const inp = $('sld-pres-name')
    if (inp) inp.value = _presName
    renderAll()
  }
  loadAllPresentations()
}

// ── Entry point ───────────────────────────────────────────────
function onSlidesEnter() {
  if (!_initialized) {
    _initialized = true
    injectStyles()
    buildEditor()
    bindGlobalKeys()
    startAutoSave()
    loadPresentation()
  } else {
    sizCanvas()
    renderAll()
  }
}

// ── API pública (usada en onclick attrs) ──────────────────────
const _sld = {
  addSlide, dupSlide,
  delSlide: () => delSlideAt(_activeIdx),
  delSlideAt,
  downloadPNG, exportZip, save, newPresentation,
  loadFromSelect, deletePresentation,
  setName: v => { _presName = v; _dirty = true },
  setSlideProp,
  addEl, addElTabla, addElImagen, changeImage, handleImage,
  addElGrafica: () => showGraficaModal(),
  addElDiagrama: () => showDiagramaModal(),
  editGrafica:  () => { const el = findEl(_selectedId); if (el) showGraficaModal(el) },
  editDiagrama: () => { const el = findEl(_selectedId); if (el) showDiagramaModal(el) },
  updateProp, deleteSelected,
}

window._sld = _sld
window.onSlidesEnter = onSlidesEnter

})()
