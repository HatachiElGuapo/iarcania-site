// IArcanIA — Navbar component
// Usage: <Navbar />

function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    padding: scrolled ? '14px 0' : '20px 0',
    background: scrolled ? 'rgba(9,9,16,0.85)' : 'transparent',
    backdropFilter: scrolled ? 'blur(20px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(168,85,247,0.15)' : 'none',
    transition: 'all 0.3s',
  };

  const links = ['Servicios', 'Proceso', 'Por qué nosotros', 'Clientes'];

  return (
    <nav style={navStyle}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <a href="#hero" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <svg width="28" height="28" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
            <path d="M36 14 Q58 36 36 58 Q14 36 36 14 Z" fill="none" stroke="#F1F0F7" strokeWidth="1.5"/>
            <circle cx="36" cy="36" r="14" fill="none" stroke="#94A3B8" strokeWidth="0.75"/>
            <g stroke="#CBD5E1" strokeWidth="1" opacity="0.7">
              <line x1="36" y1="24" x2="36" y2="20"/><line x1="36" y1="48" x2="36" y2="52"/>
              <line x1="24" y1="36" x2="20" y2="36"/><line x1="48" y1="36" x2="52" y2="36"/>
              <line x1="27.9" y1="27.9" x2="25.1" y2="25.1"/><line x1="44.1" y1="44.1" x2="46.9" y2="46.9"/>
              <line x1="44.1" y1="27.9" x2="46.9" y2="25.1"/><line x1="27.9" y1="44.1" x2="25.1" y2="46.9"/>
            </g>
            <circle cx="36" cy="36" r="6" fill="#F1F0F7"/>
            <circle cx="36" cy="36" r="2.5" fill="#090910"/>
            <g stroke="#475569" strokeWidth="1" strokeLinecap="round">
              <line x1="36" y1="14" x2="36" y2="10"/><line x1="36" y1="58" x2="36" y2="62"/>
              <line x1="14" y1="36" x2="10" y2="36"/><line x1="58" y1="36" x2="62" y2="36"/>
            </g>
          </svg>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, letterSpacing: '0.15em' }}>
            <span style={{ color: '#94A3B8' }}>I</span>
            <span style={{ color: '#F1F0F7' }}>Arcan</span>
            <span style={{ color: '#94A3B8' }}>IA</span>
          </span>
        </a>

        {/* Desktop links */}
        <ul style={{ display: 'flex', alignItems: 'center', gap: 36, listStyle: 'none', margin: 0, padding: 0 }}
            className="nav-desktop">
          {links.map(l => (
            <li key={l}>
              <a href={`#${l.toLowerCase().replace(/\s+/g, '-').replace(/é/g, 'e').replace(/ó/g, 'o').replace(/¿/g, '').replace(/\?/g, '')}`}
                 style={{ fontSize: 14, fontWeight: 500, color: '#9896b0', textDecoration: 'none', transition: 'color 0.2s' }}
                 onMouseEnter={e => e.target.style.color = '#f1f0f7'}
                 onMouseLeave={e => e.target.style.color = '#9896b0'}>
                {l}
              </a>
            </li>
          ))}
          <li>
            <a href="#contacto"
               style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', padding: '10px 22px', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none', transition: 'opacity 0.2s', display: 'inline-block' }}
               onMouseEnter={e => e.target.style.opacity = '0.85'}
               onMouseLeave={e => e.target.style.opacity = '1'}>
              Hablemos
            </a>
          </li>
        </ul>

        {/* Hamburger */}
        <button onClick={() => setMobileOpen(true)}
                style={{ display: 'none', flexDirection: 'column', gap: 5, cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}
                className="nav-hamburger">
          {[0,1,2].map(i => <span key={i} style={{ display: 'block', width: 24, height: 2, background: '#f1f0f7', borderRadius: 2 }}/>)}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,16,0.97)', zIndex: 99, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
          <button onClick={() => setMobileOpen(false)} style={{ position: 'absolute', top: 24, right: 24, fontSize: 28, cursor: 'pointer', color: '#9896b0', background: 'none', border: 'none' }}>✕</button>
          {[...links, 'Hablemos'].map(l => (
            <a key={l} href="#" onClick={() => setMobileOpen(false)}
               style={{ fontSize: 24, fontWeight: 600, color: '#f1f0f7', textDecoration: 'none' }}>
              {l}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

Object.assign(window, { Navbar });
