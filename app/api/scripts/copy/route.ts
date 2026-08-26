import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Port de api/generar-copy.js. Sin CORS (mismo origen); chequeo de sesión
// agregado — el original no tenía ninguno.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { canal, contenido } = await req.json();
  if (!contenido) {
    return NextResponse.json({ error: "Falta contenido del guión" }, { status: 400 });
  }

  const isVoidStoic = canal === "voidstoic";
  const perfilCanal = isVoidStoic
    ? "Void Stoic — canal de filosofía práctica de Miguel Aguilar. Síntesis de Marco Aurelio, Musashi, Frankl y Taoísmo. Tono: introspectivo, honesto, sin motivación vacía. Habla desde experiencia propia."
    : "IArcanIA — canal de automatización e IA de Miguel Aguilar, 25 años, Bogotá. Construye agentes con n8n, Supabase y Claude. Tono: directo, sin hype, muestra cosas reales y funcionales.";

  const system = `Eres el asistente de publicación de ${isVoidStoic ? "Void Stoic" : "IArcanIA"}.

Perfil del canal: ${perfilCanal}

Tu tarea: dado el guión de un video, generar el copy para YouTube e Instagram.

Para YouTube:
- Título: directo, claro, máx 70 caracteres. Sin clickbait vacío pero sí con gancho real. Puede empezar con el resultado o el problema.
- Descripción: 3-4 párrafos. Primero qué aprende el espectador. Luego contexto y recursos mencionados. Termina con CTA (suscribirse, comentar). Incluir sección "🔗 Links" y "📌 Timestamps" con placeholders [0:00] Intro / [X:XX] etc. Máx 500 palabras.

Para Instagram:
- Caption: 3-5 líneas impactantes que resumen la idea central. Primera línea es el gancho (sin "…" hasta el final). Termina con 10-15 hashtags relevantes separados por espacio.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin backticks, sin texto extra):
{
  "yt_titulo": "...",
  "yt_descripcion": "...",
  "ig_caption": "..."
}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: `Guión:\n\n${contenido}` }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: data.error?.message || "Error de API" }, { status: r.status });
    }
    const text = data.content?.[0]?.text || "{}";
    const json = JSON.parse(text.replace(/^```json?\s*/, "").replace(/\s*```$/, ""));
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Error interno" }, { status: 500 });
  }
}
