const SB_URL  = 'https://gpfidxxawcwsbuzsbeob.supabase.co'
const SB_KEY  = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZmlkeHhhd2N3c2J1enNiZW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjgxOTksImV4cCI6MjA4ODMwNDE5OX0.i96CvvseJCPSvEveUCx2FWECNKEuWHj51EP_3b2mCkc'

async function fetchBrand(nombre) {
  const r = await fetch(
    `${SB_URL}/rest/v1/brands?nombre=eq.${encodeURIComponent(nombre)}&limit=1`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  )
  const rows = await r.json()
  return Array.isArray(rows) ? rows[0] : null
}

// Normaliza canal al mismo formato que brands.nombre
function normCanal(canal) {
  return (canal || 'iarcania').toLowerCase().replace(/\s+/g, '_')
}

// Lee la fila de brands y construye BASE_CSS + LOGO_SVG + instrucciones
function buildBrandAssets(brand) {
  const cfg = brand?.config || {}
  const col = brand?.colores || {}

  const bodyBg     = col.fondo    || '#090910'
  const bodyColor  = col.texto    || '#f1f0f7'
  const primario   = col.primario || '#7c3aed'
  const acento     = col.acento   || '#d4af37'
  const darkMode   = cfg.dark_mode !== false  // default true

  const fontCuerpo = cfg.font_cuerpo || 'Inter'
  const fontTitulo = cfg.font_titulo || 'Playfair Display'
  const fontsUrl   = cfg.google_fonts_url || 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap'

  const orb1       = cfg.orb_1_color    || primario
  const orb2       = cfg.orb_2_color    || acento
  const cardBg     = cfg.card_bg        || (darkMode ? '#13131f' : '#eef0ea')
  const cardBorder = cfg.card_border    || `rgba(168,85,247,0.15)`
  const cardTop    = cfg.card_top       || `linear-gradient(90deg,${primario},${acento})`
  const sep        = cfg.sep            || `linear-gradient(90deg,transparent,${acento},transparent)`
  const sep2       = cfg.sep2           || `linear-gradient(90deg,transparent,${primario},transparent)`
  const gradText   = cfg.gradient_text  || `linear-gradient(135deg,${primario} 0%,${acento} 100%)`
  const scrollbar  = cfg.scrollbar_color || primario
  const labelColor = cfg.section_label_color || acento

  const noiseFilter = darkMode
    ? `body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");pointer-events:none;z-index:0;opacity:0.4}`
    : ''

  const BASE_CSS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontsUrl}" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'${fontCuerpo}',system-ui,sans-serif;background:${bodyBg};color:${bodyColor};line-height:1.6;overflow-x:hidden;position:relative}
${noiseFilter}
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

  const LOGO_SVG = cfg.logo_svg || ''

  const DESIGN_TOKENS = `
IMPORTANTE: El HTML debe comenzar exactamente así (copia literal):
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>TITULO</title>${BASE_CSS}</head><body><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="page">

Colores exactos:
- Fondo body: ${bodyBg}
- Color texto: ${bodyColor}
- Primario: ${primario}
- Acento: ${acento}
- Cards: ${cardBg}
- Card border: ${cardBorder}
- Gradient texto: ${gradText}

Logo inline: ${LOGO_SVG}

Tipografías: ${fontTitulo} (títulos h1/h2) + ${fontCuerpo} (todo lo demás). Ya incluidas en el BASE_CSS.

El CSS base ya incluye: ${darkMode ? 'noise texture, ' : ''}orbs, scrollbar, .page, .section-label, .card, .sep, .gradient-text.
Puedes añadir más estilos en un <style> adicional dentro del <head> ANTES de cerrar </head>.
Todo el contenido va dentro de <div class="page">.
Cierra con </div></body></html>
`

  return { BASE_CSS, LOGO_SVG, DESIGN_TOKENS }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { tipo, idea, canal, formato, cliente } = req.body || {}

  // Leer branding desde brands según canal
  const canalNorm = normCanal(canal)
  const brandRow  = await fetchBrand(canalNorm)
  const { DESIGN_TOKENS } = buildBrandAssets(brandRow)

  const cfg            = brandRow?.config || {}
  const copyPerfil     = cfg.copy_perfil     || ''
  const copyEstructura = cfg.copy_estructura || ''
  const nombreCanal    = canalNorm === 'void_stoic' ? 'Void Stoic' : 'IArcanIA'

  let systemPrompt = ''
  let userContent  = ''

  if (tipo === 'guion') {
    systemPrompt = `Eres el generador de presentaciones HTML de ${nombreCanal}. Generas un HTML completo y auto-contenido con el guión y la marca visual exacta del canal.

${DESIGN_TOKENS}

${copyPerfil ? `Perfil del canal: ${copyPerfil}` : ''}
${copyEstructura ? `\n${copyEstructura}` : ''}

Formato del video: ${formato || 'largo'}.

Genera un HTML completo que incluya:
1. El guión completo en 4 bloques (con tiempos estimados para formato largo)
2. Notas de producción por bloque (qué mostrar en pantalla)
3. 3 opciones de título con su ángulo (resultado / problema / provocador)
4. Stack técnico o fuentes filosóficas según el canal
5. Tags de canal, formato y estado Draft

Responde SOLO con el HTML completo. Sin explicaciones. Sin backticks. Empieza con <!DOCTYPE html>`

    userContent = `Canal: ${canal || 'iarcania'}\nFormato: ${formato || 'largo'}\nContenido del guión:\n${idea}`

  } else if (tipo === 'audiencia') {
    const col = brandRow?.colores || {}
    const primario = col.primario || '#7c3aed'
    const acento   = col.acento   || '#d4af37'

    systemPrompt = `Eres el generador de presentaciones visuales HTML de ${nombreCanal}. Generas un HTML elegante, limpio y visualmente impactante — pensado para que el PÚBLICO lo vea, no para el presentador.

${DESIGN_TOKENS}

Reglas estrictas para la vista de audiencia:
- Sin notas de producción, sin tiempos, sin bloques internos — solo lo que el espectador debe ver y sentir
- Máximo 15-20 palabras por slide/sección
- Usa tipografía grande, espaciado generoso, mucho aire
- Estructura: portada impactante → 4-6 secciones visuales → slide de cierre con CTA
- Cada sección tiene: un número/icono, una frase corta con gradient-text en el punto clave, y 2-3 líneas de apoyo
- Paleta: primario ${primario}, acento ${acento}. Mantén la coherencia visual del canal.
- Añade separadores visuales (.sep o .sep-purple) entre secciones
- El resultado debe verse profesional en pantalla — como las diapositivas de una charla TED

Responde SOLO con el HTML completo. Sin explicaciones. Sin backticks. Empieza con <!DOCTYPE html>`

    userContent = `Canal: ${canal || 'iarcania'}\nFormato: ${formato || 'largo'}\nContenido del guión:\n${idea}`

  } else if (tipo === 'propuesta') {
    // Propuestas siempre son IArcanIA — forzar brand iarcania
    const iaBrand = await fetchBrand('iarcania')
    const { DESIGN_TOKENS: IA_TOKENS } = buildBrandAssets(iaBrand)

    systemPrompt = `Eres el generador de propuestas comerciales HTML de IArcanIA. Generas un HTML completo y auto-contenido con la propuesta comercial y la marca visual exacta de IArcanIA.

${IA_TOKENS}

Posicionamiento de IArcanIA: Agentes de IA que venden 24/7 automático. O ahorras tiempo y dinero, o te quedas atrás. Miguel lo construye personalmente. Garantía 30 días.

Estructura de la propuesta:
1. Header con logo + fecha + nombre cliente
2. Hero: título con gradient text, subtítulo
3. Sección "El problema" — 2da persona, máx 4 líneas, que el cliente sienta que lo entendiste
4. Sección "La solución" — qué construirás, cómo funciona, resultado concreto. Incluye una de: "Tu agente trabaja mientras tú duermes." / "El tiempo que pierdes en esto es dinero que no estás ganando." / "Mientras tú lo haces a mano, tu competencia ya lo automatizó."
5. Sección "Por qué IArcanIA" — 3 bullets sin hype
6. Sección "Inversión" — tabla de servicios con precios, forma de pago 50/50. Si hay oferta fundadora, incluirla con los 3 tiers (3 referidos→setup gratis+primer mes, 2→1/3, 1→2/3)
7. Sección "Próximos pasos" — 3 steps con círculos numerados en gradient-cta
8. Footer: Miguel Aguilar — IArcanIA — contacto — "Válida por 7 días"

Responde SOLO con el HTML completo. Sin explicaciones. Sin backticks. Empieza con <!DOCTYPE html>`

    userContent = `Cliente: ${cliente?.nombre || 'Sin nombre'}
Empresa/negocio: ${cliente?.empresa || ''}
Problema principal: ${cliente?.problema || ''}
Solución ofrecida: ${cliente?.solucion || ''}
Precio: ${cliente?.precio || 'A definir'}
Forma de pago: ${cliente?.pago || '50% inicio / 50% entrega'}
Incluir oferta fundadora: ${cliente?.fundadora ? 'Sí' : 'No'}`
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }]
      })
    })
    const data = await r.json()
    if (!r.ok) { res.status(r.status).json({ error: data.error?.message || 'Error de API' }); return }
    const html = data.content?.[0]?.text || ''
    res.status(200).json({ html })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error interno' })
  }
}
