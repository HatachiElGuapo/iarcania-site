import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Port de api/generar-presentacion.js — solo tipo 'guion' (vista presentador)
// y 'audiencia'. El tipo 'propuesta' (generador de propuestas comerciales
// para clientes) no es parte de Guiones — pertenece al futuro dominio CRM
// (consolidación de crm.html), y se deja fuera de esta migración.
//
// El original leía colores/config por marca desde una tabla `brands` (no
// migrada — ver NOTES.md: Guiones no depende de ella para funcionar, el
// propio original cae a estos mismos valores por defecto cuando no hay
// marca). Aquí se usa siempre esa paleta por defecto — si en el futuro se
// necesita theming real por canal, se construye `brands` entonces.
function buildHead(title: string) {
  const bodyBg = "#090910";
  const bodyColor = "#f1f0f7";
  const primario = "#7c3aed";
  const acento = "#d4af37";
  const fontCuerpo = "Inter";
  const fontTitulo = "Playfair Display";
  const fontsUrl =
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap";
  const cardBg = "#13131f";
  const cardBorder = "rgba(168,85,247,0.15)";
  const cardTop = `linear-gradient(90deg,${primario},${acento})`;
  const sep = `linear-gradient(90deg,transparent,${acento},transparent)`;
  const sep2 = `linear-gradient(90deg,transparent,${primario},transparent)`;
  const gradText = `linear-gradient(135deg,${primario} 0%,${acento} 100%)`;
  const scrollbar = primario;
  const labelColor = acento;

  const noiseRule = `body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");pointer-events:none;z-index:0;opacity:0.4}`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontsUrl}" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'${fontCuerpo}',system-ui,sans-serif;background:${bodyBg}!important;color:${bodyColor}!important;line-height:1.6;overflow-x:hidden;position:relative}
${noiseRule}
.orb{position:fixed;border-radius:50%;filter:blur(120px);pointer-events:none;z-index:0;opacity:0.15}
.orb-1{width:500px;height:500px;background:${primario}!important;top:-150px;right:-80px}
.orb-2{width:350px;height:350px;background:${acento}!important;bottom:5%;left:-80px}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${bodyBg}}::-webkit-scrollbar-thumb{background:${scrollbar};border-radius:3px}
.page{position:relative;z-index:1;max-width:860px;margin:0 auto;padding:64px 56px 80px}
.section-label{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${labelColor}!important;margin-bottom:18px}
.section-label::before{content:'';display:block;width:24px;height:1px;background:${labelColor}!important}
h1,h2{font-family:'${fontTitulo}',Georgia,serif;letter-spacing:-0.3px;color:${bodyColor}!important}
h3,h4,h5,h6,p,li,span,td,th{color:inherit}
.gradient-text{background:${gradText}!important;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.card{background:${cardBg}!important;border:1px solid ${cardBorder}!important;border-radius:16px;padding:28px;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:${cardTop}!important}
.sep{height:1px;background:${sep}!important;border:none;margin:48px 0}
.sep-purple{height:1px;background:${sep2}!important;border:none}
</style>`;
}

function buildNavScript(tipo: string) {
  const bodyBg = "#090910";
  const bodyColor = "#f1f0f7";
  const primario = "#7c3aed";

  if (tipo === "guion") {
    return `<script>
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var labels = document.querySelectorAll('.section-label')
    if(!labels.length) return
    labels.forEach(function(el, i){ el.id = 'sec-' + i })
    var nav = document.createElement('nav')
    nav.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:${bodyBg}ee;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgba(128,128,128,0.12);display:flex;align-items:center;gap:6px;padding:8px 20px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch'
    var anchors = []
    labels.forEach(function(el, i){
      var a = document.createElement('a')
      a.href = '#sec-' + i
      a.textContent = el.textContent.trim().replace(/^[—–-]+\\s*/, '').slice(0, 28)
      a.style.cssText = 'font-size:10px;font-weight:600;letter-spacing:.06em;text-decoration:none;color:${bodyColor};opacity:.5;white-space:nowrap;padding:4px 10px;border-radius:20px;border:1px solid rgba(128,128,128,0.2);transition:all .15s;flex-shrink:0'
      a.addEventListener('mouseenter', function(){ if(!a._active){ a.style.opacity='0.85' } })
      a.addEventListener('mouseleave', function(){ if(!a._active){ a.style.opacity='0.5' } })
      nav.appendChild(a)
      anchors.push(a)
    })
    document.body.prepend(nav)
    var page = document.querySelector('.page')
    if(page) page.style.paddingTop = '72px'
    function setActive(idx){
      anchors.forEach(function(a, i){
        a._active = i === idx
        a.style.opacity      = i === idx ? '1' : '.5'
        a.style.background   = i === idx ? '${primario}22' : 'transparent'
        a.style.borderColor  = i === idx ? '${primario}88' : 'rgba(128,128,128,0.2)'
        a.style.color        = i === idx ? '${primario}' : '${bodyColor}'
      })
    }
    setActive(0)
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          var idx = parseInt(e.target.id.replace('sec-',''))
          setActive(idx)
          var a = anchors[idx]
          if(a) a.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'})
        }
      })
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 })
    labels.forEach(function(el){ io.observe(el) })
  })
})()
</script>`;
  }

  if (tipo === "audiencia") {
    return `<style>
@keyframes _sIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.slide-active{animation:_sIn .25s ease}
</style>
<script>
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var page = document.querySelector('.page')
    if(!page) return
    var nodes = Array.from(page.childNodes)
    var groups = [], buf = []
    nodes.forEach(function(n){
      var isSep = n.nodeType === 1 && (n.classList.contains('sep') || n.classList.contains('sep-purple') || (n.tagName === 'HR'))
      if(isSep){ if(buf.length){ groups.push(buf); buf=[] } }
      else { buf.push(n) }
    })
    if(buf.length) groups.push(buf)
    groups = groups.filter(function(g){ return g.some(function(n){ return n.nodeType===1 || (n.nodeType===3 && n.textContent.trim()) }) })
    if(groups.length <= 1) return
    page.innerHTML = ''
    var slideEls = groups.map(function(nodes, i){
      var div = document.createElement('div')
      div.className = 'slide' + (i===0 ? ' slide-active' : '')
      div.style.cssText = 'display:' + (i===0?'flex':'none') + ';flex-direction:column;justify-content:center;min-height:calc(100vh - 160px);padding-bottom:80px'
      nodes.forEach(function(n){ div.appendChild(n) })
      page.appendChild(div)
      return div
    })
    var cur = 0
    var total = slideEls.length
    var ui = document.createElement('div')
    ui.style.cssText = 'position:fixed;bottom:24px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:14px;z-index:999'
    var btnP = document.createElement('button')
    btnP.innerHTML = '&#8592;'
    btnP.style.cssText = 'width:42px;height:42px;border-radius:50%;border:1px solid rgba(128,128,128,0.25);background:transparent;color:${bodyColor};font-size:20px;cursor:pointer;transition:all .15s;opacity:.4'
    var counter = document.createElement('span')
    counter.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.12em;color:${bodyColor};opacity:.4;min-width:44px;text-align:center;font-family:system-ui,sans-serif'
    var btnN = document.createElement('button')
    btnN.innerHTML = '&#8594;'
    btnN.style.cssText = 'width:42px;height:42px;border-radius:50%;border:none;background:${primario};color:#fff;font-size:20px;cursor:pointer;transition:all .15s'
    function go(n){
      slideEls[cur].style.display = 'none'
      slideEls[cur].classList.remove('slide-active')
      cur = ((n % total) + total) % total
      slideEls[cur].style.display = 'flex'
      slideEls[cur].classList.add('slide-active')
      counter.textContent = (cur+1) + ' / ' + total
      btnP.style.opacity  = cur === 0 ? '.25' : '1'
      btnP.style.borderColor = cur === 0 ? 'rgba(128,128,128,0.2)' : '${primario}66'
      btnN.style.background  = cur === total-1 ? 'transparent' : '${primario}'
      btnN.style.borderColor = cur === total-1 ? 'rgba(128,128,128,0.25)' : '${primario}'
      btnN.style.color       = cur === total-1 ? '${bodyColor}' : '#fff'
      btnN.style.opacity     = cur === total-1 ? '.3' : '1'
    }
    btnP.onclick = function(){ go(cur-1) }
    btnN.onclick = function(){ go(cur+1) }
    document.addEventListener('keydown', function(e){
      if(e.key==='ArrowRight'||e.key==='ArrowDown') go(cur+1)
      if(e.key==='ArrowLeft'||e.key==='ArrowUp')   go(cur-1)
    })
    ui.append(btnP, counter, btnN)
    document.body.appendChild(ui)
    go(0)
  })
})()
</script>`;
  }

  return "";
}

function wrapContent(head: string, rawContent: string, tipo: string) {
  let content = rawContent;
  content = content.replace(/^```html\s*/i, "").replace(/\s*```$/, "").trim();
  if (/<html[\s>]/i.test(content)) {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    content = bodyMatch
      ? bodyMatch[1]
      : content.replace(/[\s\S]*?<\/head>/i, "").replace(/<\/?body[^>]*>/gi, "").trim();
  }
  content = content.replace(/<style[\s\S]*?<\/style>/gi, "");
  content = content.replace(/<link[^>]*>/gi, "");
  content = content.replace(/\s+style="[^"]*"/gi, "");
  content = content
    .replace(/^[\s\S]*?(<div[^>]+class="page"[^>]*>)/i, "")
    .replace(/<\/div>\s*<\/body[\s\S]*$/i, "")
    .trim();

  const bodyBg = "#090910";
  const bodyColor = "#f1f0f7";
  const primario = "#7c3aed";
  const acento = "#d4af37";
  const cardBg = "#13131f";
  const cardBorder = "rgba(168,85,247,0.15)";
  const gradText = `linear-gradient(135deg,${primario} 0%,${acento} 100%)`;
  const labelColor = acento;

  const overrideCSS = `<style id="brand-override">
html,body{background:${bodyBg}!important;color:${bodyColor}!important}
.orb-1{background:${primario}!important}
.orb-2{background:${acento}!important}
h1,h2,h3,h4,h5,h6{color:${bodyColor}!important}
p,li,span,td,th{color:${bodyColor}!important}
.section-label,.section-label *{color:${labelColor}!important}
.section-label::before{background:${labelColor}!important}
.card{background:${cardBg}!important;border-color:${cardBorder}!important}
.gradient-text{background:${gradText}!important;-webkit-background-clip:text!important;-webkit-text-fill-color:transparent!important;background-clip:text!important}
</style>`;

  const navScript = buildNavScript(tipo);

  return `${head}</head><body><div class="orb orb-1"></div><div class="orb orb-2"></div><div class="page">
${content}
</div>${overrideCSS}${navScript}</body></html>`;
}

const CSS_GUIDE = `Clases CSS disponibles (ya definidas — úsalas sin redefinir estilos):
- .section-label — etiqueta en mayúsculas con línea decorativa
- .card — tarjeta con borde y línea superior de color
- .sep — separador horizontal (acento)
- .sep-purple — separador horizontal (primario)
- .gradient-text — texto con degradado de marca

REGLA ABSOLUTA: NO escribas <style>, atributos style="", colores hexadecimales (#...) ni propiedades CSS de ningún tipo.
Usa EXCLUSIVAMENTE las clases anteriores y etiquetas HTML semánticas (h1-h6, p, ul, li, strong, em, hr, div, section).`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { tipo, idea, canal, formato } = await req.json();
  if (!idea) {
    return NextResponse.json({ error: "Falta el contenido del guión" }, { status: 400 });
  }

  const nombreCanal = canal === "voidstoic" ? "Void Stoic" : "IArcanIA";

  let systemPrompt = "";
  if (tipo === "guion") {
    systemPrompt = `Eres el generador de vistas de guión HTML de ${nombreCanal}.
Tu tarea: generar SOLO el contenido HTML que va dentro de <div class="page">. NO generes <!DOCTYPE>, <html>, <head>, <body> ni ningún <style>.
${CSS_GUIDE}
Formato del video: ${formato || "largo"}.
Genera: 1) Header con título del guión + tags (canal, formato, estado Draft) 2) El guión completo en bloques con tiempos estimados 3) Notas de producción por bloque en .card 4) 3 opciones de título (resultado / problema / provocador) 5) Stack técnico o fuentes filosóficas según el canal
Responde SOLO con el HTML interno (desde el primer elemento hasta el último).`;
  } else if (tipo === "audiencia") {
    systemPrompt = `Eres el generador de vistas de audiencia HTML de ${nombreCanal}.
Tu tarea: generar SOLO el contenido HTML que va dentro de <div class="page">. NO generes <!DOCTYPE>, <html>, <head>, <body> ni ningún <style>.
${CSS_GUIDE}
Reglas para la vista de audiencia:
- Sin notas de producción, sin tiempos — solo lo que el espectador ve y siente
- Máximo 15-20 palabras por sección
- Tipografía grande, espaciado generoso, mucho aire
- Estructura: portada impactante → 4-6 secciones visuales → cierre con CTA
- Cada sección: número/icono + frase corta con .gradient-text en el punto clave + 2-3 líneas de apoyo
- Usa .sep y .sep-purple entre secciones
Responde SOLO con el HTML interno (sin <!DOCTYPE> ni <html>).`;
  } else {
    return NextResponse.json({ error: `tipo desconocido: ${tipo}` }, { status: 400 });
  }

  const userContent = `Canal: ${canal || "iarcania"}\nFormato: ${formato || "largo"}\nContenido del guión:\n${idea}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: data.error?.message || "Error de API" }, { status: r.status });
    }
    const head = buildHead("Guión");
    const html = wrapContent(head, data.content?.[0]?.text || "", tipo);
    return NextResponse.json({ html });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Error interno" }, { status: 500 });
  }
}
