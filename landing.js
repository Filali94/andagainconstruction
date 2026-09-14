/* ══════════════════════════════════════════
   Landing pages — idioma, tema, menú y reveals
   (mismo comportamiento que index.html)
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {

  // ── Idioma (danés por defecto) ──
  const langBtns = document.querySelectorAll('[data-lang-btn]');
  function setLang(lang) {
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang === 'da' ? 'da' : 'en');
    document.querySelectorAll('[data-en], [data-da]').forEach(el => {
      const txt = el.getAttribute('data-' + lang);
      if (txt) el.innerHTML = txt;
    });
    langBtns.forEach(b => { b.style.opacity = b.dataset.langBtn === lang ? '1' : '0.6'; });
  }
  langBtns.forEach(b => b.addEventListener('click', () => setLang(b.dataset.langBtn)));
  setLang('da');

  // ── Tema (compartido con la home vía localStorage) ──
  const themeToggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }

  // ── Menú ──
  const burger = document.getElementById('burger');
  const menuOverlay = document.getElementById('menuOverlay');
  function closeMenu() {
    if (!menuOverlay) return;
    menuOverlay.classList.remove('open');
    document.body.style.overflow = '';
    if (burger) burger.classList.remove('open');
  }
  if (burger && menuOverlay) {
    burger.addEventListener('click', () => {
      if (menuOverlay.classList.contains('open')) {
        closeMenu();
      } else {
        menuOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        burger.classList.add('open');
      }
    });
    document.querySelectorAll('.menu-nav a, .menu-cta').forEach(a => a.addEventListener('click', closeMenu));
  }

  // ── Reveal al hacer scroll ──
  // Se usa un barrido por posición (no sólo IntersectionObserver) para que el
  // contenido también aparezca al saltar por un ancla o al recargar a media
  // página — casos en los que el observador nunca ve el elemento "entrar".
  const revealEls = Array.from(document.querySelectorAll('.reveal'));
  function sweepReveals() {
    const h = window.innerHeight;
    for (let i = revealEls.length - 1; i >= 0; i--) {
      const el = revealEls[i];
      if (el.getBoundingClientRect().top < h - 40) {
        el.classList.add('in');
        revealEls.splice(i, 1);
      }
    }
  }
  let sweepTick = false;
  window.addEventListener('scroll', () => {
    if (sweepTick) return;
    sweepTick = true;
    requestAnimationFrame(() => { sweepReveals(); sweepTick = false; });
  }, { passive: true });
  window.addEventListener('resize', sweepReveals);
  window.addEventListener('load', sweepReveals);
  sweepReveals();

  // ── Barra de progreso de scroll ──
  const progressBar = document.getElementById('scrollProgress');
  const header = document.getElementById('header');
  let lastScrollY = 0;
  window.addEventListener('scroll', () => {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar && docH > 0) progressBar.style.width = (window.scrollY / docH * 100) + '%';

    if (header) {
      if (window.scrollY > 100) {
        if (window.scrollY > lastScrollY + 5) header.classList.add('is-bottom');
        else if (window.scrollY < lastScrollY - 5) header.classList.remove('is-bottom');
      } else {
        header.classList.remove('is-bottom');
      }
    }
    lastScrollY = window.scrollY;

    // Parallax suave del hero
    const bg = document.querySelector('.lp-hero-bg');
    if (bg) bg.style.transform = 'scale(1.06) translate3d(0,' + (window.scrollY * 0.12) + 'px,0)';
  }, { passive: true });

});
