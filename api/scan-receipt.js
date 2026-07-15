export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { imageBase64, mediaType, extraContext } = req.body || {}
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'imageBase64 y mediaType son requeridos' })
  }

  const basePrompt = 'Analiza esta imagen. Puede ser una factura, recibo o comprobante de pago. Extrae: tipo (factura_recurrente o gasto_puntual), descripción del servicio/producto, monto total, fecha, y categoría sugerida (servicios/mercado/salud/tecnologia/hogar/restaurantes/transporte/herramientas/otros). Responde SOLO en JSON sin backticks: {tipo, descripcion, monto, fecha, categoria, confianza (alta/media/baja), pregunta (null o pregunta si necesitas más info)}'
  const promptText = extraContext
    ? `${basePrompt} El usuario aclaró: "${extraContext}"`
    : basePrompt

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
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            { type: 'text', text: promptText }
          ]
        }]
      })
    })

    const data = await anthropicRes.json()
    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({ error: data.error?.message || 'Error de Anthropic' })
    }

    const rawText = data.content?.[0]?.text || ''
    let parsed
    try {
      parsed = JSON.parse(rawText.trim())
    } catch {
      return res.status(500).json({ error: 'La IA no devolvió JSON válido', raw: rawText })
    }

    return res.status(200).json(parsed)
  } catch (err) {
    return res.status(500).json({ error: 'Error interno: ' + err.message })
  }
}
