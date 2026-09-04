import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Port de api/scan-receipt.js (función serverless de Vercel) a Route Handler
// de Next.js. Sin headers CORS — mismo origen ahora. Se agrega chequeo de
// sesión: el original no tenía ninguno (cualquiera podía llamar la ruta y
// gastar la cuota de la API de Anthropic).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Sin la key, la llamada a Anthropic devuelve un 401 críptico. Mejor decir
  // qué falta: la pantalla parece rota en vez de decir "no configurado".
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Escanear no está configurado: falta ANTHROPIC_API_KEY en el entorno." },
      { status: 503 },
    );
  }

  const { imageBase64, mediaType, extraContext } = await req.json();
  if (!imageBase64 || !mediaType) {
    return NextResponse.json(
      { error: "imageBase64 y mediaType son requeridos" },
      { status: 400 },
    );
  }

  const basePrompt =
    "Analiza esta imagen. Puede ser una factura, recibo o comprobante de pago. Extrae: tipo (factura_recurrente o gasto_puntual), descripción del servicio/producto, monto total, fecha, y categoría sugerida (servicios/mercado/salud/tecnologia/hogar/restaurantes/transporte/herramientas/otros). Responde SOLO en JSON sin backticks: {tipo, descripcion, monto, fecha, categoria, confianza (alta/media/baja), pregunta (null o pregunta si necesitas más info)}";
  const promptText = extraContext
    ? `${basePrompt} El usuario aclaró: "${extraContext}"`
    : basePrompt;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: imageBase64 },
              },
              { type: "text", text: promptText },
            ],
          },
        ],
      }),
    });

    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Error de Anthropic" },
        { status: anthropicRes.status },
      );
    }

    const rawText = data.content?.[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      return NextResponse.json(
        { error: "La IA no devolvió JSON válido", raw: rawText },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno: " + (err as Error).message },
      { status: 500 },
    );
  }
}
