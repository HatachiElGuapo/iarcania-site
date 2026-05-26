/* ═══════════════════════════════════════════════════════
   IArcanIA Agency — Shared scripts (particles, nav, reveal)
═══════════════════════════════════════════════════════ */

/* Particles canvas */
(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const count = Math.floor(window.innerWidth / 18);
    particles = Array.from({ length: Math.min(count, 80) }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.5 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.05 - Math.random() * 0.25,
      op: 0.12 + Math.random() * 0.22,
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(155, 114, 240, ${p.op})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize();
  draw();
})();

/* Navbar scroll behavior */
(function initNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  function check() {
    if (window.scrollY > 50) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', check, { passive: true });
  check();

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
  }
})();

/* IntersectionObserver reveal */
(function initReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(e => e.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.reveal').forEach(e => obs.observe(e));
})();

/* Admin auth — floating launcher when logged in, hidden nav admin links */
(function initAuth() {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  function setVis(sel, val) {
    document.querySelectorAll(sel).forEach(el => { el.style.display = val; });
  }
  // Admin nav links and separator always stay hidden — launcher FAB handles navigation
  setVis('.nav-link-admin, .nav-admin-sep, .nav-logout', 'none');

  if (isAdmin) {
    setVis('.nav-login-admin', 'none');
    const fab = document.createElement('div');
    fab.id = 'admin-fab-wrap';
    fab.innerHTML = `
      <div id="admin-fab-menu">
        <a href="/os.html" class="admin-fab-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          OS Personal
        </a>
        <a href="/planner.html" class="admin-fab-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          Planner
        </a>
        <a href="/platform.html" class="admin-fab-link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>
          Platform
        </a>
        <button class="admin-fab-logout" onclick="window.IArc.logout()">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Cerrar sesión
        </button>
      </div>
      <button id="admin-fab-btn" aria-label="Admin">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/></svg>
      </button>`;
    document.body.appendChild(fab);

    document.getElementById('admin-fab-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      fab.classList.toggle('open');
    });
    document.addEventListener('click', () => fab.classList.remove('open'));
  }
})();

/* Helper: WhatsApp link builder + logout */
window.IArc = {
  wa: (text) => `https://wa.me/573006709840${text ? `?text=${encodeURIComponent(text)}` : ''}`,
  fmtCOP: (n) => '$' + Math.round(n).toLocaleString('es-CO') + ' COP',
  logout: () => { localStorage.removeItem('isAdmin'); window.location.href = 'index.html'; },
};
