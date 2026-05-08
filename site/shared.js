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

/* Admin auth — show/hide navbar elements based on localStorage */
(function initAuth() {
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  function setVis(sel, displayVal) {
    document.querySelectorAll(sel).forEach(el => { el.style.display = displayVal; });
  }
  if (isAdmin) {
    setVis('.nav-link-admin', 'inline-flex');
    setVis('.nav-admin-sep', 'inline-flex');
    setVis('.nav-logout', 'inline-flex');
    setVis('.nav-login-admin', 'none');
  } else {
    setVis('.nav-link-admin, .nav-admin-sep, .nav-logout', 'none');
    /* nav-login-admin visible by default — no change needed */
  }
})();

/* Helper: WhatsApp link builder + logout */
window.IArc = {
  wa: (text) => `https://wa.me/573006709840${text ? `?text=${encodeURIComponent(text)}` : ''}`,
  fmtCOP: (n) => '$' + Math.round(n).toLocaleString('es-CO') + ' COP',
  logout: () => { localStorage.removeItem('isAdmin'); window.location.href = 'index.html'; },
};
