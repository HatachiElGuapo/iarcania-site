export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { raw, idea, canal, formato, modo, q1, q2, q3, libre_text } = req.body || {}

  // --- Modo texto libre → estructurar en 4 bloques ---
  if (libre_text) {
    const systemPrompt = `Eres el asistente de guiones de Miguel Aguilar (IArcanIA / Void Stoic). El usuario escribió su guión en texto libre. Tu trabajo es dividirlo en exactamente 4 bloques sin cambiar el sentido ni agregar ideas nuevas — solo reorganizar lo que ya escribió.

Responde SOLO en JSON sin backticks:
{"b1":"lo que va primero — qué muestra o cómo arranca","b2":"el problema o tensión central","b3":"la explicación o desarrollo","b4":"el cierre con perspectiva"}`
    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: 'user', content: libre_text }]
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
    return
  }

  // --- Modo 3 preguntas → guión en 4 bloques ---
  if (modo && q1 && q2 && q3) {
    const isScreen = modo === 'pantalla'
    const systemPrompt = isScreen
      ? `Eres el asistente de guiones de Miguel Aguilar, fundador de IArcanIA. Miguel tiene 25 años, es desarrollador independiente en Bogotá, construye automatizaciones con n8n, Supabase y agentes de IA. Su estilo es directo, sin hype, muestra cosas reales que construyó.

Con base en las 3 respuestas del usuario, genera un guión en 4 bloques para un video corto (máx 3 min). El guión debe sonar como Miguel habla, no como marketing.

Formato de respuesta — JSON estricto, sin backticks, sin texto extra:
{"pantalla_inicio":"qué tiene en pantalla y qué dice en los primeros 15 segundos","problema":"qué dice sobre el problema que resuelve, 1-2 frases en su voz","explicacion":"la idea central explicada con sus palabras, máx 3 frases","cierre":"una frase de perspectiva, no CTA, que cierre con una idea propia"}`
      : `Eres el asistente de guiones de Miguel Aguilar, creador de Void Stoic. Miguel sintetiza filosofía de Marco Aurelio, Musashi, Frankl y Taoísmo. Habla desde experiencia personal, no desde teoría. Su principio es "aprende de todos, sigue a nadie".

Con base en las 3 respuestas del usuario, genera un guión en 4 bloques para un video reflexivo (máx 4 min). Sin motivación vacía, sin frases de Instagram. Que suene a alguien que está construyéndose, no a alguien que ya llegó.

Formato de respuesta — JSON estricto, sin backticks, sin texto extra:
{"contradiccion":"cómo arranca el video con la contradicción personal, directo sin presentación","tension":"desarrolla la tensión sin resolverla todavía, deja que el problema respire","aprendizaje":"lo que aprendió desde sus fuentes filosóficas, en sus palabras no citando","cambio_real":"acción concreta que tomó en su vida, no consejo genérico"}`
    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: 'user', content: `1. ${q1}\n2. ${q2}\n3. ${q3}` }]
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
    return
  }

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
          model: 'claude-sonnet-4-6',
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

  // --- Modo gráfica: generar datos en formato Etiqueta, Valor ---
  if (req.body?.grafica) {
    const tema = req.body.grafica
    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          system: 'Devuelve SOLO datos en formato Etiqueta, Valor — una por línea, sin texto adicional, sin explicaciones. Los valores deben ser números. Máximo 8 filas. Si no tienes datos exactos, usa estimaciones razonables.',
          messages: [{ role: 'user', content: `Genera datos para una gráfica sobre: ${tema}` }]
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
        model: 'claude-sonnet-4-6',
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
