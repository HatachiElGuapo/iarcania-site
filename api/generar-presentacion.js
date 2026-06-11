export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { tipo, idea, canal, formato, cliente } = req.body || {}

  const DESIGN_TOKENS = `
Design system IArcanIA (usa estos valores exactos):
- bg-deep: #090910 | bg-dark: #0f0f1a | bg-card: #13131f | bg-card-2: #17172a
- purple-deep: #7c3aed | purple-mid: #a855f7 | purple-light: #c084fc
- gold: #d4af37 | gold-light: #f0d060 | gold-muted: #b8962e
- text-primary: #f1f0f7 | text-muted: #9896b0 | text-dim: #5a5870
- border: rgba(168,85,247,0.15) | border-gold: rgba(212,175,55,0.25)
- glow-purple: rgba(124,58,237,0.35) | glow-gold: rgba(212,175,55,0.20)
- gradient-text: linear-gradient(135deg,#c084fc 0%,#f0d060 100%)
- gradient-accent: linear-gradient(90deg,#7c3aed,#d4af37)
- gradient-cta: linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)
- gradient-gold: linear-gradient(135deg,#b8860b 0%,#daa520 100%)
- gradient-sep-purple: linear-gradient(90deg,transparent,#7c3aed,transparent)
- gradient-sep-gold: linear-gradient(90deg,transparent,#b8962e,transparent)
- font-display: 'Playfair Display', Georgia, serif
- font-body: 'Inter', system-ui, sans-serif
- radius-sm: 8px | radius-md: 16px | radius-lg: 24px

Logo SVG IArcanIA (inline tal cual):
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="72" viewBox="0 0 240 72"><path d="M36 14 Q58 36 36 58 Q14 36 36 14 Z" fill="none" stroke="#F1F0F7" stroke-width="1.5"/><circle cx="36" cy="36" r="14" fill="none" stroke="#94A3B8" stroke-width="0.75"/><g stroke="#CBD5E1" stroke-width="1" opacity="0.7"><line x1="36" y1="24" x2="36" y2="20"/><line x1="36" y1="48" x2="36" y2="52"/><line x1="24" y1="36" x2="20" y2="36"/><line x1="48" y1="36" x2="52" y2="36"/><line x1="27.9" y1="27.9" x2="25.1" y2="25.1"/><line x1="44.1" y1="44.1" x2="46.9" y2="46.9"/><line x1="44.1" y1="27.9" x2="46.9" y2="25.1"/><line x1="27.9" y1="44.1" x2="25.1" y2="46.9"/></g><circle cx="36" cy="36" r="6" fill="#F1F0F7"/><circle cx="36" cy="36" r="2.5" fill="#090910"/><g stroke="#475569" stroke-width="1" stroke-linecap="round"><line x1="36" y1="14" x2="36" y2="10"/><line x1="36" y1="58" x2="36" y2="62"/><line x1="14" y1="36" x2="10" y2="36"/><line x1="58" y1="36" x2="62" y2="36"/></g><text x="80" y="44" font-family="Georgia, serif" font-size="22" font-weight="700" letter-spacing="3" fill="#94A3B8">I</text><text x="93" y="44" font-family="Georgia, serif" font-size="22" font-weight="700" letter-spacing="3" fill="#F1F0F7">Arcan</text><text x="176" y="44" font-family="Georgia, serif" font-size="22" font-weight="700" letter-spacing="3" fill="#94A3B8">IA</text></svg>

Efectos obligatorios en el body:
1. Noise texture fija: body::before con SVG fractalNoise opacity 0.4
2. Dos orbs fijos blur 120px: orb morado (#7c3aed, top:-150px right:-80px) y dorado (#b8962e, bottom:5% left:-80px), opacity 0.15
3. Scrollbar: width 6px, thumb #7c3aed

Fuentes: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap')

Section labels: display:inline-flex, gap:8px, font-size:11px, font-weight:600, letter-spacing:2px, text-transform:uppercase, color:#d4af37. Con ::before: width:24px, height:1px, background:#d4af37.

Cards: bg #13131f, border rgba(168,85,247,0.15), border-radius:16px. Con ::before: height:2px, background gradient-accent (morado→dorado).

Separadores entre secciones: hr con height:1px, background gradient-sep-gold.
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

    userContent = `Canal: ${canal || 'iarcania'}\nFormato: ${formato || 'largo'}\nTema/idea: ${idea}`

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
