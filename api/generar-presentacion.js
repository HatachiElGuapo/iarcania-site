const SB_URL  = 'https://gpfidxxawcwsbuzsbeob.supabase.co'
const SB_KEY  = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZmlkeHhhd2N3c2J1enNiZW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjgxOTksImV4cCI6MjA4ODMwNDE5OX0.i96CvvseJCPSvEveUCx2FWECNKEuWHj51EP_3b2mCkc'

async function fetchBrand(nombre) {
  const r = await fetch(
    `${SB_URL}/rest/v1/brands?nombre=eq.${encodeURIComponent(nombre)}&limit=1`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  )
  const rows = await r.json()
  const row = Array.isArray(rows) ? rows[0] : null
  console.log('[brands] fetch nombre=%s status=%s row_nombre=%s colores=%s', nombre, r.status, row?.nombre, JSON.stringify(row?.colores))
  return row
}

// Mapea los valores del dropdown (sin guion bajo) al nombre exacto en brands (con guion bajo)
const CANAL_MAP = { voidstoic: 'void_stoic', iarcania: 'iarcania' }
function normCanal(canal) {
  const bare = (canal || 'iarcania').toLowerCase().replace(/[\s_-]+/g, '')
  return CANAL_MAP[bare] || bare
}

// Construye el <head> completo con los colores de brands — el modelo nunca lo toca
function buildHead(brand, title = 'TITULO') {
  const cfg = brand?.config || {}
  const col = brand?.colores || {}

  const bodyBg     = col.fondo    || '#090910'
  const bodyColor  = col.texto    || '#f1f0f7'
  const primario   = col.primario || '#7c3aed'
  const acento     = col.acento   || '#d4af37'
  const darkMode   = cfg.dark_mode !== false

  const fontCuerpo = cfg.font_cuerpo || 'Inter'
  const fontTitulo = cfg.font_titulo || 'Playfair Display'
  const fontsUrl   = cfg.google_fonts_url || 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap'

  const orb1       = cfg.orb_1_color        || primario
  const orb2       = cfg.orb_2_color        || acento
  const cardBg     = cfg.card_bg            || (darkMode ? '#13131f' : '#eef0ea')
  const cardBorder = cfg.card_border        || 'rgba(168,85,247,0.15)'
  const cardTop    = cfg.card_top           || `linear-gradient(90deg,${primario},${acento})`
  const sep        = cfg.sep               || `linear-gradient(90deg,transparent,${acento},transparent)`
  const sep2       = cfg.sep2              || `linear-gradient(90deg,transparent,${primario},transparent)`
  const gradText   = cfg.gradient_text      || `linear-gradient(135deg,${primario} 0%,${acento} 100%)`
  const scrollbar  = cfg.scrollbar_color    || primario
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
body{font-family:'${fontCuerpo}',system-ui,sans-serif;background:${bodyBg};color:${bodyColor};line-height:1.6;overflow-x:hidden;position:relative}
${noiseRule}
.orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:0.15}
.orb-1{width:500px;height:500px;background:${orb1};top:-150px;right:-80px}
.orb-2{width:350px;height:350px;background:${orb2};bottom:5%;left:-80px}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${bodyBg}}::-webkit-scrollbar-thumb{background:${scrollbar};border-radius:3px}
.page{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:64px 56px 80px}
.section-label{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${labelColor};margin-bottom:18px}
.section-label::before{content:'';display:block;width:24px;height:1px;background:${labelColor}}
h1,h2{font-family:'${fontTitulo}',Georgia,serif;letter-spacing:-0.3px;color:${bodyColor}}
.gradient-text{background:${gradText};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.card{background:${cardBg};border:1px solid ${cardBorder};border-radius:16px;padding:28px;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:${cardTop}}
.sep{height:1px;background:${sep};border:none;margin:48px 0}
.sep-purple{height:1px;background:${sep2};border:none}
</style>`
}

// Envuelve el contenido generado por el modelo con el shell HTML de la marca
function wrapContent(head, logoSvg, innerContent) {
  // Guard: si el modelo devolvió HTML completo, extraer solo lo que va dentro de <body>
  let content = innerContent

  // Quitar posible ```html ... ``` wrapper
  content = content.replace(/^```html\s*/i, '').replace(/\s*```$/, '').trim()

  // Si el modelo ignoró las instrucciones y devolvió HTML completo, extraer el interior de <body>
  if (/<html[\s>]/i.test(content)) {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) {
      content = bodyMatch[1]
    } else {
      // Quitar todo hasta y después de </head> si no hay </body>
      content = content.replace(/[\s\S]*?<\/head>/i, '').replace(/<\/?body[^>]*>/gi, '').trim()
    }
  }

  // Si el contenido ya tiene <div class="page"> propio (el modelo a veces lo añade), quitarlo
  content = content.replace(/^<div[^>]+class="page"[^>]*>/i, '').replace(/<\/div>\s*$/, '').trim()

  // Strip cualquier <style> que el modelo haya añadido — los colores los impone buildHead
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '')

  return `${head}</head><body><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="page">
${logoSvg ? `<div style="margin-bottom:32px">${logoSvg}</div>` : ''}
${content}
</div></body></html>`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { tipo, idea, canal, formato, cliente } = req.body || {}

  const canalNorm  = normCanal(canal)
  const brandRow   = await fetchBrand(canalNorm)
  const cfg        = brandRow?.config || {}
  const col        = brandRow?.colores || {}
  const logoSvg    = cfg.logo_svg || ''
  const copyPerfil = cfg.copy_perfil || ''
  const copyEstr   = cfg.copy_estructura || ''
  const nombreCanal = canalNorm === 'void_stoic' ? 'Void Stoic' : 'IArcanIA'
  const primario   = col.primario || '#7c3aed'
  const acento     = col.acento   || '#d4af37'

  // Clases CSS disponibles (el modelo las usa para estructura, no decide colores)
  const cssGuide = `
Clases CSS disponibles (ya definidas, úsalas sin redefinir colores):
- .page — contenedor principal (ya aplicado, no lo añadas)
- .section-label — etiqueta de sección en mayúsculas
- .card — tarjeta con borde y línea superior
- .sep — separador horizontal (acento)
- .sep-purple — separador horizontal (primario)
- .gradient-text — texto con degradado de marca
Logo de la marca (úsalo tal cual): ${logoSvg}

REGLA CRÍTICA: NO escribas ningún color hexadecimal (#...) ni propiedad de color/background en el HTML o en <style> adicionales. Los colores están definidos en el CSS base y no deben sobreescribirse. Usa solo las clases y atributos de estructura.`

  let systemPrompt = ''
  let userContent  = ''

  if (tipo === 'guion') {
    systemPrompt = `Eres el generador de vistas de guión HTML de ${nombreCanal}.

Tu tarea: generar SOLO el contenido HTML que va dentro de <div class="page">. NO generes <!DOCTYPE>, <html>, <head>, <body> ni ningún <style>. El shell HTML ya existe — solo rellenas el interior.

${cssGuide}
${copyPerfil ? `\nPerfil del canal: ${copyPerfil}` : ''}
${copyEstr   ? `\n${copyEstr}` : ''}

Formato del video: ${formato || 'largo'}.

Genera el contenido que incluya:
1. Header con el logo (ya incluido arriba) + título del guión + tags (canal, formato, estado Draft)
2. El guión completo en 4 bloques (con tiempos estimados para formato largo)
3. Notas de producción por bloque (qué mostrar en pantalla), en .card
4. 3 opciones de título con su ángulo (resultado / problema / provocador)
5. Stack técnico o fuentes filosóficas según el canal

Responde SOLO con el HTML interno (desde el primer elemento hasta el último, sin <!DOCTYPE> ni <html>).`

    userContent = `Canal: ${canal || 'iarcania'}\nFormato: ${formato || 'largo'}\nContenido del guión:\n${idea}`

  } else if (tipo === 'audiencia') {
    systemPrompt = `Eres el generador de vistas de audiencia HTML de ${nombreCanal}.

Tu tarea: generar SOLO el contenido HTML que va dentro de <div class="page">. NO generes <!DOCTYPE>, <html>, <head>, <body> ni ningún <style>. El shell HTML ya existe — solo rellenas el interior.

${cssGuide}

Reglas para la vista de audiencia:
- Sin notas de producción, sin tiempos, sin bloques internos — solo lo que el espectador ve y siente
- Máximo 15-20 palabras por sección
- Tipografía grande, espaciado generoso, mucho aire
- Estructura: portada impactante → 4-6 secciones visuales → cierre con CTA
- Cada sección: número/icono + frase corta con .gradient-text en el punto clave + 2-3 líneas de apoyo
- Usa .sep y .sep-purple entre secciones
- Resultado profesional — como diapositivas de una charla TED

Responde SOLO con el HTML interno (sin <!DOCTYPE> ni <html>).`

    userContent = `Canal: ${canal || 'iarcania'}\nFormato: ${formato || 'largo'}\nContenido del guión:\n${idea}`

  } else if (tipo === 'propuesta') {
    const iaBrand   = await fetchBrand('iarcania')
    const iaCfg     = iaBrand?.config || {}
    const iaLogoSvg = iaCfg.logo_svg || logoSvg

    const iaCssGuide = `
Clases CSS disponibles (ya definidas):
- .section-label, .card, .sep, .sep-purple, .gradient-text
Logo IArcanIA: ${iaLogoSvg}

REGLA CRÍTICA: NO escribas ningún color hexadecimal ni propiedad de color/background. Usa solo las clases de estructura.`

    systemPrompt = `Eres el generador de propuestas comerciales HTML de IArcanIA.

Tu tarea: generar SOLO el contenido HTML que va dentro de <div class="page">. NO generes <!DOCTYPE>, <html>, <head>, <body> ni ningún <style>. El shell HTML ya existe.

${iaCssGuide}

Posicionamiento IArcanIA: Agentes de IA que venden 24/7 automático. Miguel lo construye personalmente. Garantía 30 días.

Estructura:
1. Header con logo + fecha + nombre cliente
2. Hero: título con .gradient-text, subtítulo
3. "El problema" — 2da persona, máx 4 líneas
4. "La solución" — qué construirás, resultado concreto. Una de estas frases: "Tu agente trabaja mientras tú duermes." / "El tiempo que pierdes en esto es dinero que no estás ganando." / "Mientras tú lo haces a mano, tu competencia ya lo automatizó."
5. "Por qué IArcanIA" — 3 bullets sin hype
6. "Inversión" — tabla con precios, pago 50/50. Si hay oferta fundadora: 3 tiers (3 referidos→setup gratis+primer mes, 2→1/3, 1→2/3)
7. "Próximos pasos" — 3 steps con círculos numerados
8. Footer: Miguel Aguilar — IArcanIA — "Válida por 7 días"

Responde SOLO con el HTML interno (sin <!DOCTYPE> ni <html>).`

    userContent = `Cliente: ${cliente?.nombre || 'Sin nombre'}
Empresa/negocio: ${cliente?.empresa || ''}
Problema principal: ${cliente?.problema || ''}
Solución ofrecida: ${cliente?.solucion || ''}
Precio: ${cliente?.precio || 'A definir'}
Forma de pago: ${cliente?.pago || '50% inicio / 50% entrega'}
Incluir oferta fundadora: ${cliente?.fundadora ? 'Sí' : 'No'}`

    // Para propuestas, usar brand iarcania en el wrapper
    const iaHead = buildHead(iaBrand, `Propuesta — ${cliente?.nombre || 'Cliente'}`)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, system: systemPrompt, messages: [{ role: 'user', content: userContent }] })
      })
      const data = await r.json()
      if (!r.ok) { res.status(r.status).json({ error: data.error?.message || 'Error de API' }); return }
      const html = wrapContent(iaHead, iaLogoSvg, data.content?.[0]?.text || '')
      res.status(200).json({ html })
    } catch (e) { res.status(500).json({ error: e.message || 'Error interno' }) }
    return
  }

  // guion y audiencia comparten este bloque final
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, system: systemPrompt, messages: [{ role: 'user', content: userContent }] })
    })
    const data = await r.json()
    if (!r.ok) { res.status(r.status).json({ error: data.error?.message || 'Error de API' }); return }
    const head = buildHead(brandRow, 'Guión')
    const html = wrapContent(head, logoSvg, data.content?.[0]?.text || '')
    res.status(200).json({ html })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error interno' })
  }
}
