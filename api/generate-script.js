export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { raw, idea, canal, formato } = req.body || {}

  // --- Modo idea: estructurar texto en 2 oraciones ---
  if (raw) {
    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{ role: 'user', content: `Estructura esta idea en máximo 2 oraciones claras y accionables. Sin preámbulos, solo el resultado:\n\n"${raw}"` }]
        })
      })
      const data = await anthropicRes.json()
      if (!anthropicRes.ok) {
        res.status(anthropicRes.status).json({ error: data.error?.message || 'Error de Anthropic' })
        return
      }
      res.status(200).json({ text: data.content?.[0]?.text || null })
    } catch (e) {
      res.status(500).json({ error: e.message || 'Error interno' })
    }
    return
  }

  // --- Modo guión: generar guión estructurado en JSON ---
  if (!idea) { res.status(400).json({ error: 'Falta el campo idea o raw' }); return }

  const canalLabel = canal === 'iarcania' ? 'IArcanIA' : 'Void Stoic'
  const canalDesc  = canal === 'iarcania'
    ? 'automatización con IA para PYMEs colombianas'
    : 'filosofía estoica y productividad personal'

  const systemPrompt = `Eres un experto en creación de contenido para redes sociales B2B. Creas guiones que desafían creencias existentes de la audiencia y generan conversación. El canal ${canalLabel} habla sobre ${canalDesc}. Responde SOLO en JSON con este formato exacto: {"titulo":"título del video","hook":"gancho inicial impactante (primeros 3 segundos)","body":"desarrollo del contenido","cta":"llamada a acción final","notas":"tips de producción y grabación"}`

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Crea un guión de ${formato || 'Video largo'} sobre: ${idea}` }]
      })
    })

    const data = await anthropicRes.json()
    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: data.error?.message || 'Error de Anthropic' })
      return
    }

    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) { res.status(500).json({ error: 'Respuesta inesperada de la IA' }); return }

    res.status(200).json(JSON.parse(match[0]))
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error interno' })
  }
}
