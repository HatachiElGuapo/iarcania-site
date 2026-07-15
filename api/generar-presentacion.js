// generar-presentacion.js
// Brand data viene del frontend (allBrands ya cargado en memoria).
// El serverless NUNCA toca Supabase para leer marcas — excepción: propuestas.

const SB_URL = 'https://gpfidxxawcwsbuzsbeob.supabase.co'
const SB_KEY = process.env.SUPABASE_ANON_KEY

// Solo se usa para tipo=propuesta (el frontend de propuestas no pasa brandColores aún)
async function fetchBrand(nombre) {
  const r = await fetch(
    `${SB_URL}/rest/v1/brands?nombre=eq.${encodeURIComponent(nombre)}&limit=1`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  )
  const rows = await r.json()
  return Array.isArray(rows) ? rows[0] : null
}

// ─── HEAD ────────────────────────────────────────────────────────────────────
// Construye el <head> completo con los colores de la marca.
// El modelo NUNCA modifica esto — solo genera el contenido interior.
function buildHead(brand, title = 'Guión') {
  const cfg = brand?.config  || {}
  const col = brand?.colores || {}

  const bodyBg     = col.fondo    || '#090910'
  const bodyColor  = col.texto    || '#f1f0f7'
  const primario   = col.primario || '#7c3aed'
  const acento     = col.acento   || '#d4af37'
  const darkMode   = cfg.dark_mode !== false

  const fontCuerpo = cfg.font_cuerpo || 'Inter'
  const fontTitulo = cfg.font_titulo || 'Playfair Display'
  const fontsUrl   = cfg.google_fonts_url ||
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap'

  const orb1       = cfg.orb_1_color         || primario
  const orb2       = cfg.orb_2_color         || acento
  const cardBg     = cfg.card_bg             || (darkMode ? '#13131f' : '#eef0ea')
  const cardBorder = cfg.card_border         || `rgba(168,85,247,0.15)`
  const cardTop    = cfg.card_top            || `linear-gradient(90deg,${primario},${acento})`
  const sep        = cfg.sep                 || `linear-gradient(90deg,transparent,${acento},transparent)`
  const sep2       = cfg.sep2                || `linear-gradient(90deg,transparent,${primario},transparent)`
  const gradText   = cfg.gradient_text       || `linear-gradient(135deg,${primario} 0%,${acento} 100%)`
  const scrollbar  = cfg.scrollbar_color     || primario
  const labelColor = cfg.section_label_color || acento

  const noiseRule = darkMode
    ? `body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");pointer-events:none;z-index:0;opacity:0.4}`
    : ''

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontsUrl}" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'${fontCuerpo}',system-ui,sans-serif;background:${bodyBg}!important;color:${bodyColor}!important;line-height:1.6;overflow-x:hidden;position:relative}
${noiseRule}
.orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:0.15}
.orb-1{width:500px;height:500px;background:${orb1}!important;top:-150px;right:-80px}
.orb-2{width:350px;height:350px;background:${orb2}!important;bottom:5%;left:-80px}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${bodyBg}}::-webkit-scrollbar-thumb{background:${scrollbar};border-radius:3px}
.page{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:64px 56px 80px}
.section-label{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${labelColor}!important;margin-bottom:18px}
.section-label::before{content:'';display:block;width:24px;height:1px;background:${labelColor}!important}
h1,h2{font-family:'${fontTitulo}',Georgia,serif;letter-spacing:-0.3px;color:${bodyColor}!important}
h3,h4,h5,h6,p,li,span,td,th{color:inherit}
.gradient-text{background:${gradText}!important;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.card{background:${cardBg}!important;border:1px solid ${cardBorder}!important;border-radius:16px;padding:28px;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:${cardTop}!important}
.sep{height:1px;background:${sep}!important;border:none;margin:48px 0}
.sep-purple{height:1px;background:${sep2}!important;border:none}
</style>`
}

// ─── WRAP ─────────────────────────────────────────────────────────────────────
// Envuelve el contenido interno generado por el modelo.
// STRIP NUCLEAR: elimina TODO CSS que el modelo haya generado — los estilos
// los impone únicamente buildHead + el override final con !important.
function wrapContent(head, logoSvg, rawContent, brand, tipo) {
  // Log para diagnóstico — muestra si el modelo mete <style> o colores inline
  console.log('[model-raw] primeros 500 chars:', rawContent.slice(0, 500))

  let content = rawContent

  // 1. Quitar bloque ```html ... ```
  content = content.replace(/^```html\s*/i, '').replace(/\s*```$/, '').trim()

  // 2. Si el modelo devolvió HTML completo, extraer solo el cuerpo
  if (/<html[\s>]/i.test(content)) {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    content = bodyMatch ? bodyMatch[1] : content.replace(/[\s\S]*?<\/head>/i, '').replace(/<\/?body[^>]*>/gi, '').trim()
  }

  // 3. Strip nuclear: eliminar TODOS los <style> que el modelo haya generado
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '')

  // 4. Strip: eliminar <link> de fuentes u hojas de estilo que el modelo meta
  content = content.replace(/<link[^>]*>/gi, '')

  // 5. Strip: eliminar TODOS los atributos style="" del contenido del modelo
  //    (el modelo no debe dictar ningún estilo — solo estructura y clases)
  content = content.replace(/\s+style="[^"]*"/gi, '')

  // 6. Si el contenido tiene su propio <div class="page">, quitarlo para no anidar
  content = content.replace(/^[\s\S]*?(<div[^>]+class="page"[^>]*>)/i, '').replace(/<\/div>\s*<\/body[\s\S]*$/i, '').trim()

  // Override CSS al final — gana sobre cualquier cosa residual (cascade order)
  const col = brand?.colores || {}
  const cfg = brand?.config  || {}
  const bodyBg    = col.fondo    || '#090910'
  const bodyColor = col.texto    || '#f1f0f7'
  const primario  = col.primario || '#7c3aed'
  const acento    = col.acento   || '#d4af37'
  const cardBg    = cfg.card_bg  || (cfg.dark_mode === false ? '#eef0ea' : '#13131f')
  const cardBorder = cfg.card_border || 'rgba(168,85,247,0.15)'
  const gradText   = cfg.gradient_text || `linear-gradient(135deg,${primario} 0%,${acento} 100%)`
  const labelColor = cfg.section_label_color || acento
  const orb1 = cfg.orb_1_color || primario
  const orb2 = cfg.orb_2_color || acento

  const overrideCSS = `<style id="brand-override">
html,body{background:${bodyBg}!important;color:${bodyColor}!important}
.orb-1{background:${orb1}!important}
.orb-2{background:${orb2}!important}
h1,h2,h3,h4,h5,h6{color:${bodyColor}!important}
p,li,span,td,th{color:${bodyColor}!important}
.section-label,.section-label *{color:${labelColor}!important}
.section-label::before{background:${labelColor}!important}
.card{background:${cardBg}!important;border-color:${cardBorder}!important}
.gradient-text{background:${gradText}!important;-webkit-background-clip:text!important;-webkit-text-fill-color:transparent!important;background-clip:text!important}
</style>`

  const navScript = buildNavScript(tipo, brand)

  return `${head}</head><body><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="page">
${logoSvg ? `<div style="margin-bottom:32px">${logoSvg}</div>` : ''}
${content}
</div>${overrideCSS}${navScript}</body></html>`
}

// ─── NAV SCRIPTS ──────────────────────────────────────────────────────────────
function buildNavScript(tipo, brand) {
  const col      = brand?.colores || {}
  const cfg      = brand?.config  || {}
  const bodyBg   = col.fondo    || '#090910'
  const bodyColor = col.texto   || '#f1f0f7'
  const primario  = col.primario || '#7c3aed'
  const darkMode  = cfg.dark_mode !== false

  // ── Presentador: sticky nav con anclas a cada sección ──────────────────────
  if (tipo === 'guion') {
    return `<script>
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var labels = document.querySelectorAll('.section-label')
    if(!labels.length) return

    labels.forEach(function(el, i){ el.id = 'sec-' + i })

    var nav = document.createElement('nav')
    nav.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:${bodyBg}ee;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(128,128,128,0.12);display:flex;align-items:center;gap:6px;padding:8px 20px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch'

    var anchors = []
    labels.forEach(function(el, i){
      var a = document.createElement('a')
      a.href = '#sec-' + i
      a.textContent = el.textContent.trim().replace(/^[—–-]+\\s*/, '').slice(0, 28)
      a.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.06em;text-decoration:none;color:${bodyColor};opacity:.5;white-space:nowrap;padding:4px 10px;border-radius:20px;border:1px solid rgba(128,128,128,0.2);transition:all .15s;flex-shrink:0'
      a.addEventListener('mouseenter', function(){ if(!a._active){ a.style.opacity='0.85' } })
      a.addEventListener('mouseleave', function(){ if(!a._active){ a.style.opacity='0.5' } })
      nav.appendChild(a)
      anchors.push(a)
    })

    document.body.prepend(nav)
    var page = document.querySelector('.page')
    if(page) page.style.paddingTop = '72px'

    function setActive(idx){
      anchors.forEach(function(a, i){
        a._active = i === idx
        a.style.opacity      = i === idx ? '1' : '.5'
        a.style.background   = i === idx ? '${primario}22' : 'transparent'
        a.style.borderColor  = i === idx ? '${primario}88' : 'rgba(128,128,128,0.2)'
        a.style.color        = i === idx ? '${primario}' : '${bodyColor}'
      })
    }

    setActive(0)
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          var idx = parseInt(e.target.id.replace('sec-',''))
          setActive(idx)
          var a = anchors[idx]
          if(a) a.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'})
        }
      })
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 })

    labels.forEach(function(el){ io.observe(el) })
  })
})()
</script>`
  }

  // ── Audiencia: slides con flechas y teclado ─────────────────────────────────
  if (tipo === 'audiencia') {
    return `<style>
@keyframes _sIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.slide-active{animation:_sIn .25s ease}
</style>
<script>
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var page = document.querySelector('.page')
    if(!page) return

    // Agrupar nodos entre .sep / .sep-purple en slides
    var nodes = Array.from(page.childNodes)
    var groups = [], buf = []
    nodes.forEach(function(n){
      var isSep = n.nodeType === 1 && (n.classList.contains('sep') || n.classList.contains('sep-purple') || (n.tagName === 'HR'))
      if(isSep){ if(buf.length){ groups.push(buf); buf=[] } }
      else { buf.push(n) }
    })
    if(buf.length) groups.push(buf)

    // Filtrar grupos vacíos
    groups = groups.filter(function(g){ return g.some(function(n){ return n.nodeType===1 || (n.nodeType===3 && n.textContent.trim()) }) })
    if(groups.length <= 1) return

    page.innerHTML = ''
    var slideEls = groups.map(function(nodes, i){
      var div = document.createElement('div')
      div.className = 'slide' + (i===0 ? ' slide-active' : '')
      div.style.cssText = 'display:' + (i===0?'flex':'none') + ';flex-direction:column;justify-content:center;min-height:calc(100vh - 160px);padding-bottom:80px'
      nodes.forEach(function(n){ div.appendChild(n) })
      page.appendChild(div)
      return div
    })

    var cur = 0
    var total = slideEls.length

    // UI
    var ui = document.createElement('div')
    ui.style.cssText = 'position:fixed;bottom:24px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:14px;z-index:999'

    var btnP = document.createElement('button')
    btnP.innerHTML = '&#8592;'
    btnP.style.cssText = 'width:42px;height:42px;border-radius:50%;border:1px solid rgba(128,128,128,0.25);background:transparent;color:${bodyColor};font-size:20px;cursor:pointer;transition:all .15s;opacity:.4'

    var counter = document.createElement('span')
    counter.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.12em;color:${bodyColor};opacity:.4;min-width:44px;text-align:center;font-family:system-ui,sans-serif'

    var btnN = document.createElement('button')
    btnN.innerHTML = '&#8594;'
    btnN.style.cssText = 'width:42px;height:42px;border-radius:50%;border:none;background:${primario};color:#fff;font-size:20px;cursor:pointer;transition:all .15s'

    function go(n){
      slideEls[cur].style.display = 'none'
      slideEls[cur].classList.remove('slide-active')
      cur = ((n % total) + total) % total
      slideEls[cur].style.display = 'flex'
      slideEls[cur].classList.add('slide-active')
      counter.textContent = (cur+1) + ' / ' + total
      btnP.style.opacity  = cur === 0 ? '.25' : '1'
      btnP.style.borderColor = cur === 0 ? 'rgba(128,128,128,0.2)' : '${primario}66'
      btnN.style.background  = cur === total-1 ? 'transparent' : '${primario}'
      btnN.style.borderColor = cur === total-1 ? 'rgba(128,128,128,0.25)' : '${primario}'
      btnN.style.color       = cur === total-1 ? '${bodyColor}' : '#fff'
      btnN.style.opacity     = cur === total-1 ? '.3' : '1'
    }

    btnP.onclick = function(){ go(cur-1) }
    btnN.onclick = function(){ go(cur+1) }
    document.addEventListener('keydown', function(e){
      if(e.key==='ArrowRight'||e.key==='ArrowDown') go(cur+1)
      if(e.key==='ArrowLeft'||e.key==='ArrowUp')   go(cur-1)
    })

    ui.append(btnP, counter, btnN)
    document.body.appendChild(ui)
    go(0)
  })
})()
</script>`
  }

  return ''
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { tipo, idea, canal, formato, cliente, brandColores, brandConfig } = req.body || {}

  // ── Tipo: propuesta (único caso que aún fetchea brands desde serverless) ──
  if (tipo === 'propuesta') {
    let iaBrand = { colores: brandColores || null, config: brandConfig || null }
    if (!brandColores) {
      iaBrand = await fetchBrand('iarcania') || iaBrand
    }
    const iaCfg     = iaBrand?.config || {}
    const iaLogoSvg = iaCfg.logo_svg || ''
    const iaCssGuide = `Clases CSS disponibles: .section-label, .card, .sep, .sep-purple, .gradient-text, .page
Logo IArcanIA: ${iaLogoSvg}
REGLA CRÍTICA: NO escribas ningún <style>, color hexadecimal ni propiedad style="". Usa solo clases de estructura.`

    const systemPrompt = `Eres el generador de propuestas comerciales HTML de IArcanIA.
Tu tarea: generar SOLO el contenido HTML que va dentro de <div class="page">. NO generes <!DOCTYPE>, <html>, <head>, <body> ni ningún <style>.
${iaCssGuide}
Posicionamiento IArcanIA: Agentes de IA que venden 24/7 automático. Miguel lo construye personalmente. Garantía 30 días.
Estructura: 1) Header con logo + fecha + nombre cliente 2) Hero: título con .gradient-text 3) El problema (2da persona, máx 4 líneas) 4) La solución (resultado concreto) 5) Por qué IArcanIA (3 bullets) 6) Inversión (tabla, 50/50, oferta fundadora si aplica) 7) Próximos pasos (3 steps) 8) Footer: Miguel Aguilar — IArcanIA — "Válida por 7 días"
Responde SOLO con el HTML interno (sin <!DOCTYPE> ni <html>).`

    const userContent = `Cliente: ${cliente?.nombre || 'Sin nombre'}
Empresa/negocio: ${cliente?.empresa || ''}
Problema principal: ${cliente?.problema || ''}
Solución ofrecida: ${cliente?.solucion || ''}
Precio: ${cliente?.precio || 'A definir'}
Forma de pago: ${cliente?.pago || '50% inicio / 50% entrega'}
Incluir oferta fundadora: ${cliente?.fundadora ? 'Sí' : 'No'}`

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, system: systemPrompt, messages: [{ role: 'user', content: userContent }] })
      })
      const data = await r.json()
      if (!r.ok) { res.status(r.status).json({ error: data.error?.message || 'Error de API' }); return }
      const iaHead = buildHead(iaBrand, `Propuesta — ${cliente?.nombre || 'Cliente'}`)
      const html   = wrapContent(iaHead, iaLogoSvg, data.content?.[0]?.text || '', iaBrand)
      res.status(200).json({ html })
    } catch (e) { res.status(500).json({ error: e.message || 'Error interno' }) }
    return
  }

  // ── Tipos: guion y audiencia ──────────────────────────────────────────────
  if (!brandColores) {
    console.warn('[brand] brandColores no recibido — brand data faltante en request')
  }

  const cfg      = brandConfig  || {}
  const col      = brandColores || {}
  const brandRow = { colores: col, config: cfg }
  const logoSvg  = cfg.logo_svg || ''

  const nombreCanal = cfg.nombre_canal ||
    ((canal || '').toLowerCase().replace(/[\s_-]+/g, '') === 'voidstoic' ? 'Void Stoic' : 'IArcanIA')

  const copyPerfil = cfg.copy_perfil   || ''
  const copyEstr   = cfg.copy_estructura || ''

  const cssGuide = `Clases CSS disponibles (ya definidas — úsalas sin redefinir estilos):
- .section-label — etiqueta en mayúsculas con línea decorativa
- .card — tarjeta con borde y línea superior de color
- .sep — separador horizontal (acento)
- .sep-purple — separador horizontal (primario)
- .gradient-text — texto con degradado de marca

REGLA ABSOLUTA: NO escribas <style>, atributos style="", colores hexadecimales (#...) ni propiedades CSS de ningún tipo.
Usa EXCLUSIVAMENTE las clases anteriores y etiquetas HTML semánticas (h1-h6, p, ul, li, strong, em, hr, div, section).
El logo de la marca se inyecta automáticamente — no lo incluyas.`

  let systemPrompt = ''
  let userContent  = ''

  if (tipo === 'guion') {
    systemPrompt = `Eres el generador de vistas de guión HTML de ${nombreCanal}.
Tu tarea: generar SOLO el contenido HTML que va dentro de <div class="page">. NO generes <!DOCTYPE>, <html>, <head>, <body> ni ningún <style>.
${cssGuide}
${copyPerfil ? `\nPerfil del canal: ${copyPerfil}` : ''}
${copyEstr   ? `\n${copyEstr}` : ''}
Formato del video: ${formato || 'largo'}.
Genera: 1) Header con título del guión + tags (canal, formato, estado Draft) 2) El guión completo en 4 bloques con tiempos estimados 3) Notas de producción por bloque en .card 4) 3 opciones de título (resultado / problema / provocador) 5) Stack técnico o fuentes filosóficas según el canal
Responde SOLO con el HTML interno (desde el primer elemento hasta el último).`
    userContent = `Canal: ${canal || 'iarcania'}\nFormato: ${formato || 'largo'}\nContenido del guión:\n${idea}`

  } else if (tipo === 'audiencia') {
    systemPrompt = `Eres el generador de vistas de audiencia HTML de ${nombreCanal}.
Tu tarea: generar SOLO el contenido HTML que va dentro de <div class="page">. NO generes <!DOCTYPE>, <html>, <head>, <body> ni ningún <style>.
${cssGuide}
Reglas para la vista de audiencia:
- Sin notas de producción, sin tiempos — solo lo que el espectador ve y siente
- Máximo 15-20 palabras por sección
- Tipografía grande, espaciado generoso, mucho aire
- Estructura: portada impactante → 4-6 secciones visuales → cierre con CTA
- Cada sección: número/icono + frase corta con .gradient-text en el punto clave + 2-3 líneas de apoyo
- Usa .sep y .sep-purple entre secciones
Responde SOLO con el HTML interno (sin <!DOCTYPE> ni <html>).`
    userContent = `Canal: ${canal || 'iarcania'}\nFormato: ${formato || 'largo'}\nContenido del guión:\n${idea}`

  } else {
    res.status(400).json({ error: `tipo desconocido: ${tipo}` }); return
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, system: systemPrompt, messages: [{ role: 'user', content: userContent }] })
    })
    const data = await r.json()
    if (!r.ok) { res.status(r.status).json({ error: data.error?.message || 'Error de API' }); return }
    const head = buildHead(brandRow, 'Guión')
    const html = wrapContent(head, logoSvg, data.content?.[0]?.text || '', brandRow, tipo)
    res.status(200).json({ html })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error interno' })
  }
}
