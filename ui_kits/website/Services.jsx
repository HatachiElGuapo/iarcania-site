// IArcanIA — Services section

const SERVICES = [
  { icon: '🤖', title: 'Agentes de WhatsApp', desc: 'Un asistente inteligente que responde preguntas, toma pedidos, agenda citas y hace seguimiento a tus clientes — directamente desde WhatsApp, sin horarios.', tags: ['Atención 24/7','Pedidos'], tagsGold: ['WhatsApp'] },
  { icon: '⚡', title: 'Automatización de Procesos', desc: 'Conectamos tus herramientas actuales — hojas de cálculo, correo, CRM — y eliminamos el trabajo manual repetitivo que consume tiempo y genera errores.', tags: ['Flujos de trabajo','Integraciones'], tagsGold: ['Sin código'] },
  { icon: '📈', title: 'Seguimiento de Ventas', desc: 'Tu equipo de ventas nunca pierde un lead. El agente hace el seguimiento automático, recuerda cotizaciones pendientes y registra toda la información.', tags: ['Leads','CRM'], tagsGold: ['Recordatorios'] },
  { icon: '📚', title: 'Gestión de Inventario', desc: 'Controla existencias, recibe alertas cuando el stock es bajo y genera reportes automáticos. Todo sin salir de WhatsApp o tu herramienta favorita.', tags: ['Stock','Alertas'], tagsGold: ['Reportes'] },
  { icon: '🌐', title: 'Agentes Web', desc: 'Integramos un asistente de IA en tu sitio web que atiende visitantes, captura datos de contacto y responde preguntas frecuentes en tiempo real.', tags: ['Chat en vivo','Captura leads'], tagsGold: ['Web'] },
  { icon: '🔭', title: 'Flujos con IA a Medida', desc: '¿Tienes un proceso muy específico? Diseñamos flujos de automatización personalizados con inteligencia artificial adaptados exactamente a tu operación.', tags: ['Personalizado','IA'], tagsGold: ['A tu medida'] },
];

function ServiceCard({ icon, title, desc, tags, tagsGold }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
         style={{ background:'#13131f', border:`1px solid ${hov ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.15)'}`, borderRadius:16, padding:'36px 32px', position:'relative', overflow:'hidden', transition:'all 0.3s', transform: hov ? 'translateY(-4px)' : 'none' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#7c3aed,#d4af37)', transform: hov ? 'scaleX(1)' : 'scaleX(0)', transformOrigin:'left', transition:'transform 0.4s ease' }}/>
      <div style={{ width:54, height:54, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24, fontSize:24, background:'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(212,175,55,0.1))', border:'1px solid rgba(212,175,55,0.25)' }}>{icon}</div>
      <h3 style={{ fontSize:19, fontWeight:700, marginBottom:12, color:'#f1f0f7' }}>{title}</h3>
      <p style={{ fontSize:15, color:'#9896b0', lineHeight:1.7, marginBottom:20 }}>{desc}</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {tags.map(t => <span key={t} style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:100, background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.2)', color:'#c084fc' }}>{t}</span>)}
        {tagsGold.map(t => <span key={t} style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:100, background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.2)', color:'#d4af37' }}>{t}</span>)}
      </div>
    </div>
  );
}

function Services() {
  return (
    <section id="servicios" style={{ padding:'100px 0', background:'#0f0f1a', position:'relative' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,#7c3aed,transparent)' }}/>
      <div style={{ maxWidth:1160, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ textAlign:'center', maxWidth:620, margin:'0 auto 72px' }}>
          <div className="section-label" style={{ marginBottom:16 }}>Servicios</div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(28px,4vw,44px)', fontWeight:700, marginBottom:16, color:'#f1f0f7' }}>
            Todo lo que necesitas para <span style={{ background:'linear-gradient(135deg,#c084fc,#f0d060)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>automatizar</span>
          </h2>
          <p style={{ color:'#9896b0', fontSize:17, lineHeight:1.7 }}>Soluciones diseñadas para negocios pequeños y medianos que quieren crecer sin contratar más personal.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }} className="services-grid">
          {SERVICES.map(s => <ServiceCard key={s.title} {...s}/>)}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Services, ServiceCard });
