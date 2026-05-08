// IArcanIA — HowItWorks + WhyUs + Fundadores + Footer components

const STEPS = [
  { n: '01', title: 'Diagnóstico gratuito', desc: 'Analizamos tu negocio y tus procesos para identificar dónde la IA puede generar más impacto.' },
  { n: '02', title: 'Diseño del flujo', desc: 'Creamos el flujo de automatización adaptado exactamente a cómo opera tu negocio hoy.' },
  { n: '03', title: 'Implementación', desc: 'Desplegamos los agentes y automatizaciones en tu entorno. Sin interrumpir tu operación.' },
  { n: '04', title: 'Soporte continuo', desc: 'Te acompañamos, ajustamos y mejoramos los flujos para que siempre funcionen mejor.' },
];

function HowItWorks() {
  return (
    <section id="como-funciona" style={{ padding:'100px 0', background:'#090910' }}>
      <div style={{ maxWidth:1160, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ textAlign:'center', maxWidth:620, margin:'0 auto 72px' }}>
          <div className="section-label" style={{ marginBottom:16 }}>Proceso</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(28px,4vw,44px)', fontWeight:700, marginBottom:16, color:'#f1f0f7' }}>
            En marcha en <span style={{ background:'linear-gradient(135deg,#c084fc,#f0d060)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>días, no meses</span>
          </h2>
          <p style={{ color:'#9896b0', fontSize:17, lineHeight:1.7 }}>Un proceso simple y guiado para que tu automatización esté funcionando lo antes posible.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24, position:'relative' }}>
          <div style={{ position:'absolute', top:36, left:'12%', right:'12%', height:1, background:'linear-gradient(90deg,transparent,rgba(168,85,247,0.15),rgba(168,85,247,0.15),transparent)' }}/>
          {STEPS.map(s => (
            <div key={s.n} style={{ textAlign:'center', padding:'32px 24px' }}>
              <div style={{ width:72, height:72, borderRadius:'50%', background:'#13131f', border:'1px solid rgba(212,175,55,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:'#d4af37', position:'relative', zIndex:1 }}>{s.n}</div>
              <h3 style={{ fontSize:16, fontWeight:700, marginBottom:10, color:'#f1f0f7' }}>{s.title}</h3>
              <p style={{ fontSize:14, color:'#9896b0', lineHeight:1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const METRICS = [
  { label: 'Tiempo de respuesta al cliente', val: '-92%', pct: 92 },
  { label: 'Tareas manuales eliminadas', val: '-78%', pct: 78 },
  { label: 'Leads perdidos por falta de seguimiento', val: '-85%', pct: 85 },
  { label: 'Satisfacción del cliente', val: '+65%', pct: 65 },
];

const WHY_POINTS = [
  { icon: '🇨🇴', title: 'Hecho para Colombia', desc: 'Entendemos el contexto local: horarios, herramientas y la forma en que operan los negocios colombianos.' },
  { icon: '🔓', title: 'Sin cambios drásticos', desc: 'No tienes que abandonar las herramientas que ya usas. Integramos la automatización en tu flujo actual.' },
  { icon: '📈', title: 'Resultados medibles', desc: 'Cada implementación incluye métricas claras para que veas exactamente cuánto tiempo y dinero estás ahorrando.' },
  { icon: '🤝', title: 'Acompañamiento real', desc: 'No desaparecemos después de la entrega. Somos tu equipo técnico de confianza para ajustar y mejorar.' },
];

function WhyUs() {
  return (
    <section id="por-que" style={{ padding:'100px 0', background:'#0f0f1a', position:'relative' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,#b8962e,transparent)' }}/>
      <div style={{ maxWidth:1160, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:56, alignItems:'center' }} className="why-grid">
          {/* Metrics card */}
          <div style={{ background:'#13131f', border:'1px solid rgba(168,85,247,0.15)', borderRadius:24, padding:40, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-80, right:-80, width:200, height:200, background:'radial-gradient(circle,rgba(124,58,237,0.25),transparent)', borderRadius:'50%' }}/>
            <div className="section-label" style={{ marginBottom:20 }}>Resultados reales</div>
            {METRICS.map(m => (
              <div key={m.label} style={{ padding:'16px 0', borderBottom:'1px solid rgba(168,85,247,0.1)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#9896b0', marginBottom:6 }}>
                  <span>{m.label}</span><strong style={{ color:'#d4af37' }}>{m.val}</strong>
                </div>
                <div style={{ height:6, background:'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${m.pct}%`, height:'100%', borderRadius:3, background:'linear-gradient(90deg,#7c3aed,#d4af37)' }}/>
                </div>
              </div>
            ))}
          </div>
          {/* Points */}
          <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
            <div>
              <div className="section-label" style={{ marginBottom:12 }}>Por qué elegirnos</div>
              <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(28px,4vw,44px)', fontWeight:700, color:'#f1f0f7' }}>
                IA que trabaja <span style={{ background:'linear-gradient(135deg,#c084fc,#f0d060)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>a tu ritmo</span>
              </h2>
            </div>
            {WHY_POINTS.map(p => (
              <div key={p.title} style={{ display:'flex', gap:18 }}>
                <div style={{ width:44, height:44, minWidth:44, borderRadius:8, background:'rgba(124,58,237,0.12)', border:'1px solid rgba(168,85,247,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{p.icon}</div>
                <div>
                  <h4 style={{ fontSize:16, fontWeight:700, marginBottom:6, color:'#f1f0f7' }}>{p.title}</h4>
                  <p style={{ fontSize:14, color:'#9896b0', lineHeight:1.6 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FUNDADORES_OPTS = [
  { icon: '🎁', title: 'Gratis', desc: 'Setup completo + 3 meses de mantenimiento sin costo.', detail: 'Solo para los primeros 10 negocios fundadores.', gradient: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'rgba(168,85,247,0.3)' },
  { icon: '🤝', title: 'Referidos', desc: 'Setup completo + 3 meses gratis.', detail: 'A cambio de traernos 2 clientes más.', gradient: 'linear-gradient(135deg,#b8860b,#daa520)', border: 'rgba(218,165,32,0.3)' },
  { icon: '🎥', title: 'Testimonio', desc: 'Setup completo + 3 meses gratis.', detail: 'A cambio de grabar un video contando tu experiencia.', gradient: 'linear-gradient(135deg,#1a6e4a,#2ecc71)', border: 'rgba(46,204,113,0.3)' },
];

function Fundadores() {
  const [showModal, setShowModal] = React.useState(false);
  const TOTAL = 10, LEFT = 10;
  return (
    <section id="fundadores" style={{ padding:'96px 0', background:'#0f0f1a', position:'relative' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,#daa520,transparent)' }}/>
      <div style={{ maxWidth:1160, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 16px' }}>
          <div className="section-label" style={{ marginBottom:16 }}>Oferta limitada</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(28px,4vw,44px)', fontWeight:700, marginBottom:16, color:'#f1f0f7' }}>
            Oferta Fundadores —{' '}
            <span style={{ background:'linear-gradient(135deg,#c084fc,#f0d060)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Solo 10 cupos</span>
          </h2>
          <p style={{ color:'#9896b0', fontSize:18, lineHeight:1.7 }}>Estamos construyendo nuestros primeros casos de éxito en Colombia. Si tu negocio entra ahora, tienes 3 opciones:</p>
        </div>

        {/* Counter */}
        <div style={{ display:'flex', justifyContent:'center', margin:'24px 0 48px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:12, background:'#13131f', border:'1px solid rgba(218,165,32,0.4)', borderRadius:100, padding:'12px 24px' }}>
            <div style={{ display:'flex', gap:4 }}>
              {Array.from({length:TOTAL}).map((_,i) => <span key={i} style={{ width:12, height:12, borderRadius:'50%', background: i < LEFT ? '#daa520' : 'rgba(168,85,247,0.2)' }}/>)}
            </div>
            <span style={{ fontSize:14, fontWeight:600, color:'#daa520' }}>Quedan {LEFT}/{TOTAL} cupos</span>
          </div>
        </div>

        {/* Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24, marginBottom:48 }}>
          {FUNDADORES_OPTS.map(o => (
            <div key={o.title} style={{ background:'#13131f', border:`1px solid ${o.border}`, borderRadius:20, padding:32, display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ width:48, height:48, borderRadius:12, background:o.gradient, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{o.icon}</div>
              <div>
                <h3 style={{ fontSize:20, fontWeight:700, marginBottom:4, color:'#f1f0f7' }}>{o.title}</h3>
                <p style={{ fontSize:14, color:'#f1f0f7', lineHeight:1.6 }}>{o.desc}</p>
                <p style={{ fontSize:13, color:'#9896b0', marginTop:4 }}>{o.detail}</p>
              </div>
              <div style={{ height:1, background:o.gradient, opacity:0.3, marginTop:'auto' }}/>
            </div>
          ))}
        </div>

        <div style={{ textAlign:'center' }}>
          <button onClick={() => setShowModal(true)}
                  style={{ display:'inline-flex', alignItems:'center', gap:8, background:'linear-gradient(135deg,#b8860b,#daa520)', color:'#fff', fontWeight:600, padding:'16px 40px', borderRadius:12, border:'none', fontSize:15, cursor:'pointer', boxShadow:'0 4px 24px rgba(212,175,55,0.2)', fontFamily:"'Inter',sans-serif" }}>
            Quiero mi cupo →
          </button>
          <p style={{ fontSize:12, color:'#5a5870', marginTop:10 }}>Llamada de 20 minutos · Sin costo · Sin compromiso</p>
        </div>
      </div>

      {/* Calendly modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'#13131f', border:'1px solid rgba(168,85,247,0.15)', borderRadius:20, overflow:'hidden', width:'100%', maxWidth:640 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid rgba(168,85,247,0.15)', background:'#17172a' }}>
              <span style={{ fontSize:14, fontWeight:600, color:'#f1f0f7' }}>Agendar llamada con Miguel</span>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', color:'#9896b0', fontSize:20, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:40, textAlign:'center' }}>
              <p style={{ color:'#9896b0', fontSize:15 }}>Calendly embed — conecta a <strong style={{color:'#f1f0f7'}}>calendly.com/miguelangel4793039/30min</strong></p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background:'#090910', borderTop:'1px solid rgba(168,85,247,0.15)', padding:'40px 0' }}>
      <div style={{ maxWidth:1160, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
        <div>
          <div style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, letterSpacing:'0.15em', marginBottom:8 }}>
            <span style={{color:'#94A3B8'}}>I</span><span style={{color:'#F1F0F7'}}>Arcan</span><span style={{color:'#94A3B8'}}>IA</span>
          </div>
          <p style={{ fontSize:14, color:'#5a5870' }}>© 2026 IArcanIA. Automatización con IA para Colombia.</p>
        </div>
        <div style={{ display:'flex', gap:24 }}>
          {['Servicios','Nosotros','Contacto'].map(l => (
            <a key={l} href="#" style={{ fontSize:13, color:'#5a5870', textDecoration:'none', transition:'color 0.2s' }}
               onMouseEnter={e => e.target.style.color = '#d4af37'}
               onMouseLeave={e => e.target.style.color = '#5a5870'}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { HowItWorks, WhyUs, Fundadores, Footer });
