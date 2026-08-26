import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Port de api/generate-script.js (función serverless de Vercel) a Route
// Handler de Next.js. Sin headers CORS — mismo origen ahora. Se agrega
// chequeo de sesión: el original no tenía ninguno.
//
// Simplificación: el original le pedía al modelo "4 bloques" (b1-b4) porque
// esa era la unidad de edición en el cliente, pero la persistencia real
// siempre colapsaba a 3 columnas (hook/body/cta) — ver lib/db/schema/guiones.ts.
// Aquí el modelo genera directo hook/body/cta, sin el paso intermedio.
// También se omiten los modos 'raw' (estructurar idea en 2 oraciones — no es
// específico de Guiones) y 'grafica' (datos para gráficas — solo lo usaba el
// editor de Slides, fuera de alcance de esta sección). Ver NOTES.md.

async function callAnthropic(system: string | undefined, userContent: string, maxTokens: number) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Error de Anthropic");
  }
  const text: string = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Respuesta inesperada de la IA");
  return JSON.parse(match[0]);
}

function guionSystemPrompt(canal: string) {
  const canalLabel = canal === "iarcania" ? "IArcanIA" : "Void Stoic";
  const canalDesc =
    canal === "iarcania"
      ? "automatización con IA para PYMEs colombianas"
      : "filosofía estoica y productividad personal";
  return `Eres un experto en creación de contenido para redes sociales B2B. Creas guiones que desafían creencias existentes de la audiencia y generan conversación. El canal ${canalLabel} habla sobre ${canalDesc}. Responde SOLO en JSON con este formato exacto: {"titulo":"título del video","hook":"gancho inicial impactante (primeros 3 segundos)","body":"desarrollo del contenido","cta":"llamada a acción final","notas":"tips de producción y grabación"}`;
}

function libreSystemPrompt() {
  return `Eres el asistente de guiones de Miguel Aguilar (IArcanIA / Void Stoic). El usuario escribió su guión en texto libre. Tu trabajo es dividirlo en hook, desarrollo y cierre sin cambiar el sentido ni agregar ideas nuevas — solo reorganizar lo que ya escribió.

Responde SOLO en JSON sin backticks:
{"hook":"lo que va primero — qué muestra o cómo arranca","body":"el desarrollo — problema, tensión y explicación","cta":"el cierre con perspectiva"}`;
}

function preguntasSystemPrompt(modo: string) {
  if (modo === "pantalla") {
    return `Eres el asistente de guiones de Miguel Aguilar, fundador de IArcanIA. Miguel tiene 25 años, es desarrollador independiente en Bogotá, construye automatizaciones con n8n, Supabase y agentes de IA. Su estilo es directo, sin hype, muestra cosas reales que construyó.

Con base en las 3 respuestas del usuario, genera un guión para un video corto (máx 3 min). El guión debe sonar como Miguel habla, no como marketing.

Formato de respuesta — JSON estricto, sin backticks, sin texto extra:
{"hook":"qué tiene en pantalla y qué dice en los primeros 15 segundos","body":"el problema que resuelve y la idea central explicada con sus palabras","cta":"una frase de perspectiva, no CTA, que cierre con una idea propia"}`;
  }
  return `Eres el asistente de guiones de Miguel Aguilar, creador de Void Stoic. Miguel sintetiza filosofía de Marco Aurelio, Musashi, Frankl y Taoísmo. Habla desde experiencia personal, no desde teoría. Su principio es "aprende de todos, sigue a nadie".

Con base en las 3 respuestas del usuario, genera un guión para un video reflexivo (máx 4 min). Sin motivación vacía, sin frases de Instagram. Que suene a alguien que está construyéndose, no a alguien que ya llegó.

Formato de respuesta — JSON estricto, sin backticks, sin texto extra:
{"hook":"cómo arranca el video con la contradicción personal, directo sin presentación","body":"la tensión sin resolverla del todo, y el aprendizaje desde sus fuentes filosóficas en sus palabras","cta":"acción concreta que tomó en su vida, no consejo genérico"}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { idea, canal, formato, libre_text, modo, q1, q2, q3 } = await req.json();

  try {
    if (libre_text) {
      const json = await callAnthropic(libreSystemPrompt(), libre_text, 1200);
      return NextResponse.json(json);
    }

    if (modo && q1 && q2 && q3) {
      const json = await callAnthropic(
        preguntasSystemPrompt(modo),
        `1. ${q1}\n2. ${q2}\n3. ${q3}`,
        1200,
      );
      return NextResponse.json(json);
    }

    if (idea) {
      const json = await callAnthropic(
        guionSystemPrompt(canal || "iarcania"),
        `Crea un guión de ${formato || "Video largo"} sobre: ${idea}`,
        1500,
      );
      return NextResponse.json(json);
    }

    return NextResponse.json({ error: "Falta el campo idea o libre_text" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Error interno" }, { status: 500 });
  }
}
