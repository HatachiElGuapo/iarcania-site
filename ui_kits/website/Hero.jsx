// IArcanIA — Hero section component

function Hero() {
  const c1Ref = React.useRef(null);
  const c2Ref = React.useRef(null);

  React.useEffect(() => {
    function animateCounter(el, target, suffix, duration) {
      let start = null;
      const step = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    const t = setTimeout(() => {
      if (c1Ref.current) animateCounter(c1Ref.current, 20, 'h', 1600);
      if (c2Ref.current) animateCounter(c2Ref.current, 80, '%', 1800);
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <section id="hero" style={{ minHeight: '100vh', paddingTop: 100, display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Blobs */}
      <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)', filter:'blur(90px)', top:-150, left:-200, animation:'float1 8s ease-in-out infinite' }}/>
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)', filter:'blur(90px)', bottom:50, right:-100, animation:'float2 10s ease-in-out infinite' }}/>
      <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)', filter:'blur(90px)', top:'40%', left:'55%', animation:'float3 12s ease-in-out infinite' }}/>
      {/* Grid */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px)', backgroundSize:'60px 60px' }}/>

      <div style={{ maxWidth:1160, margin:'0 auto', padding:'0 24px', position:'relative', zIndex:1, width:'100%' }}>
        <div style={{ maxWidth: 760 }}>
          {/* Badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.25)', borderRadius:100, padding:'6px 16px', fontSize:13, fontWeight:500, color:'#d4af37', marginBottom:32 }}>
            <span style={{ width:6, height:6, background:'#d4af37', borderRadius:'50%', display:'inline-block', animation:'pulse-gold 2s ease-in-out infinite' }}/>
            Automatización con IA para negocios colombianos
          </div>

          <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:'clamp(40px,6vw,72px)', lineHeight:1.1, fontWeight:700, marginBottom:24, letterSpacing:'-0.5px', color:'#f1f0f7' }}>
            Tu negocio trabaja<br/>
            <span style={{ background:'linear-gradient(135deg,#c084fc,#f0d060)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>sin parar.</span><br/>
            Tú decides cuándo.
          </h1>

          <p style={{ fontSize:'clamp(16px,2vw,19px)', color:'#9896b0', maxWidth:580, lineHeight:1.7, marginBottom:44 }}>
            Automatizamos los procesos repetitivos de tu negocio con agentes de IA —
            atención al cliente, seguimiento de ventas, gestión de inventario —
            por WhatsApp o web, <strong style={{ color:'#f1f0f7' }}>sin que tengas que cambiar cómo trabajas.</strong>
          </p>

          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:16 }}>
            <HeroBtn href="#contacto" primary>
              Quiero automatizar mi negocio
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </HeroBtn>
            <HeroBtn href="#servicios">Ver servicios</HeroBtn>
          </div>

          {/* Stats */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:40, marginTop:60, paddingTop:40, borderTop:'1px solid rgba(168,85,247,0.15)' }}>
            {[
              { ref: c1Ref, val: '0h', label: 'ahorradas por semana en promedio' },
              { ref: c2Ref, val: '0%', label: 'reducción de tareas manuales' },
              { ref: null,  val: '24/7', label: 'tu negocio disponible siempre' },
            ].map(({ ref, val, label }) => (
              <div key={label}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:700, lineHeight:1, background:'linear-gradient(135deg,#c084fc,#f0d060)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                  {ref ? <span ref={ref}>{val}</span> : val}
                </div>
                <div style={{ fontSize:13, color:'#9896b0', marginTop:4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroBtn({ href, primary, children }) {
  const [hov, setHov] = React.useState(false);
  const base = primary
    ? { background:'linear-gradient(135deg,#7c3aed,#a855f7)', color:'#fff', boxShadow: hov ? '0 8px 40px rgba(124,58,237,0.5)' : '0 0 30px rgba(124,58,237,0.35)', transform: hov ? 'translateY(-2px)' : 'none' }
    : { background:'transparent', color: hov ? '#f1f0f7' : '#9896b0', borderColor: hov ? '#a855f7' : 'rgba(168,85,247,0.15)' };
  return (
    <a href={href} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
       style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:15, fontWeight: primary ? 600 : 500, padding:'16px 32px', borderRadius:8, textDecoration:'none', border:'1px solid transparent', transition:'all 0.2s', ...base }}>
      {children}
    </a>
  );
}

Object.assign(window, { Hero, HeroBtn });
