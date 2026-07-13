export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { tipo, idea, canal, formato, cliente } = req.body || {}

  const BASE_CSS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:#090910;color:#f1f0f7;line-height:1.6;overflow-x:hidden;position:relative}
body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");pointer-events:none;z-index:0;opacity:0.4}
.orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:0.15}
.orb-1{width:500px;height:500px;background:#7c3aed;top:-150px;right:-80px}
.orb-2{width:350px;height:350px;background:#b8962e;bottom:5%;left:-80px}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#090910}::-webkit-scrollbar-thumb{background:#7c3aed;border-radius:3px}
.page{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:64px 56px 80px}
.section-label{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#d4af37;margin-bottom:18px}
.section-label::before{content:'';display:block;width:24px;height:1px;background:#d4af37}
h1,h2{font-family:'Playfair Display',Georgia,serif;letter-spacing:-0.3px;color:#f1f0f7}
.gradient-text{background:linear-gradient(135deg,#c084fc 0%,#f0d060 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.card{background:#13131f;border:1px solid rgba(168,85,247,0.15);border-radius:16px;padding:28px;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#7c3aed,#d4af37)}
.sep{height:1px;background:linear-gradient(90deg,transparent,#b8962e,transparent);border:none;margin:48px 0}
.sep-purple{height:1px;background:linear-gradient(90deg,transparent,#7c3aed,transparent);border:none}
</style>`

  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 240 72"><path d="M36 14 Q58 36 36 58 Q14 36 36 14 Z" fill="none" stroke="#F1F0F7" stroke-width="1.5"/><circle cx="36" cy="36" r="14" fill="none" stroke="#94A3B8" stroke-width="0.75"/><g stroke="#CBD5E1" stroke-width="1" opacity="0.7"><line x1="36" y1="24" x2="36" y2="20"/><line x1="36" y1="48" x2="36" y2="52"/><line x1="24" y1="36" x2="20" y2="36"/><line x1="48" y1="36" x2="52" y2="36"/><line x1="27.9" y1="27.9" x2="25.1" y2="25.1"/><line x1="44.1" y1="44.1" x2="46.9" y2="46.9"/><line x1="44.1" y1="27.9" x2="46.9" y2="25.1"/><line x1="27.9" y1="44.1" x2="25.1" y2="46.9"/></g><circle cx="36" cy="36" r="6" fill="#F1F0F7"/><circle cx="36" cy="36" r="2.5" fill="#090910"/><g stroke="#475569" stroke-width="1" stroke-linecap="round"><line x1="36" y1="14" x2="36" y2="10"/><line x1="36" y1="58" x2="36" y2="62"/><line x1="14" y1="36" x2="10" y2="36"/><line x1="58" y1="36" x2="62" y2="36"/></g><text x="80" y="44" font-family="Georgia,serif" font-size="22" font-weight="700" letter-spacing="3" fill="#94A3B8">I</text><text x="93" y="44" font-family="Georgia,serif" font-size="22" font-weight="700" letter-spacing="3" fill="#F1F0F7">Arcan</text><text x="176" y="44" font-family="Georgia,serif" font-size="22" font-weight="700" letter-spacing="3" fill="#94A3B8">IA</text></svg>`

  const DESIGN_TOKENS = `
IMPORTANTE: El HTML debe comenzar exactamente así (copia literal):
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>TITULO</title>${BASE_CSS}</head><body><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="page">

Colores exactos:
- Fondo body: #090910 (MUY IMPORTANTE — negro casi puro, no gris)
- Cards: #13131f | bg-card-2: #17172a
- Purple: #7c3aed / #a855f7 / #c084fc
- Gold: #d4af37 / #f0d060 / #b8962e
- Texto: #f1f0f7 (primary) / #9896b0 (muted) / #5a5870 (dim)
- Border: rgba(168,85,247,0.15) | border-gold: rgba(212,175,55,0.25)

Logo IArcanIA inline: ${LOGO_SVG}

Tipografías: Playfair Display (títulos h1/h2) + Inter (todo lo demás). Ya incluidas en el BASE_CSS.

El CSS base ya incluye: noise texture, orbs, scrollbar, .page, .section-label, .card, .sep, .gradient-text.
Puedes añadir más estilos en un <style> adicional dentro del <head> ANTES de cerrar </head>.
Todo el contenido va dentro de <div class="page">.
Cierra con </div></body></html>
`

  let systemPrompt = ''
  let userContent = ''

  if (tipo === 'guion') {
    const isVoidStoic = canal === 'voidstoic'
    systemPrompt = `Eres el generador de presentaciones HTML de IArcanIA. Generas un HTML completo y auto-contenido con el guión de ${isVoidStoic ? 'Void Stoic' : 'IArcanIA'} y la marca visual exacta de IArcanIA.

${DESIGN_TOKENS}

${isVoidStoic
  ? `Perfil Void Stoic: Miguel sintetiza Marco Aurelio, Musashi, Frankl y Taoísmo. Habla desde experiencia personal. Principio: "aprende de todos, sigue a nadie". Sin motivación vacía. Suena a alguien construyéndose, no a alguien que ya llegó.
Estructura del guión (4 bloques): CONTRADICCIÓN → TENSIÓN → APRENDIZAJE → CAMBIO REAL`
  : `Perfil IArcanIA: Miguel, 25 años, fundador de IArcanIA, desarrollador en Bogotá. Construye automatizaciones con n8n, Supabase y agentes de IA. Estilo: directo, sin hype, muestra cosas reales.
Estructura del guión (4 bloques): ARRANQUE (pantalla+primeras palabras) → PROBLEMA → EXPLICACIÓN → CIERRE`}

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
    const isVoidStoic = canal === 'voidstoic'
    systemPrompt = `Eres el generador de presentaciones visuales HTML de IArcanIA. Generas un HTML elegante, limpio y visualmente impactante — pensado para que el PÚBLICO lo vea, no para el presentador.

${DESIGN_TOKENS}

Reglas estrictas para la vista de audiencia:
- Sin notas de producción, sin tiempos, sin bloques internos — solo lo que el espectador debe ver y sentir
- Máximo 15-20 palabras por slide/sección
- Usa tipografía grande, espaciado generoso, mucho aire
- Estructura: portada impactante → 4-6 secciones visuales → slide de cierre con CTA
- Cada sección tiene: un número/icono, una frase corta con gradient-text en el punto clave, y 2-3 líneas de apoyo
- Colores según canal: ${isVoidStoic ? 'Void Stoic usa el mismo sistema visual de IArcanIA pero el tono es más filosófico, introspectivo' : 'IArcanIA — tecnología, IA, automatización'}
- Añade separadores visuales (.sep o .sep-purple) entre secciones
- El resultado debe verse profesional en pantalla — como las diapositivas de una charla TED

Responde SOLO con el HTML completo. Sin explicaciones. Sin backticks. Empieza con <!DOCTYPE html>`

    userContent = `Canal: ${canal || 'iarcania'}\nFormato: ${formato || 'largo'}\nContenido del guión:\n${idea}`

  } else if (tipo === 'propuesta') {
    systemPrompt = `Eres el generador de propuestas comerciales HTML de IArcanIA. Generas un HTML completo y auto-contenido con la propuesta comercial y la marca visual exacta de IArcanIA.

${DESIGN_TOKENS}

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
        model: 'claude-sonnet-4-20250514',
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
