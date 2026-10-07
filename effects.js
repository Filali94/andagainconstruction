/* ══════════════════════════════════════════════════════════════
   effects.js — shared micro-interactions for every page
   · word-by-word heading reveals
   · photo depth inside frames + filling process timelines
   · magnetic buttons
   · 3D tilt + light glare on project images
   · cursor spotlight on cards
══════════════════════════════════════════════════════════════ */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── 1. Word-by-word heading reveal ──────────────────────────
     Each word sits in a clipped box and slides up when the
     heading gets its `.in` class from the existing reveal logic. */
  function hasLooseText(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim() && !(node.parentElement && node.parentElement.closest('.swi'))) return true;
    }
    return false;
  }

  function splitHeading(el) {
    let i = 0;
    (function walk(node) {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          if (!child.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span');
            outer.className = 'sw';
            const inner = document.createElement('span');
            inner.className = 'swi';
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR' && !child.classList.contains('sw')) {
          walk(child);
        }
      });
    })(el);
    el.classList.add('split-ready');
  }

  if (!reduced) {
    document.querySelectorAll('.section-title.reveal, .build3d-title').forEach((h) => {
      splitHeading(h);
      // The language switch replaces the heading's HTML — split it again.
      const mo = new MutationObserver(() => {
        if (!hasLooseText(h)) return;
        mo.disconnect();
        splitHeading(h);
        mo.observe(h, { childList: true, subtree: true });
      });
      mo.observe(h, { childList: true, subtree: true });
    });
  }

  /* ── 2. Scroll-linked depth ─────────────────────────────────
     · framed photos drift inside their frame ([data-depth])
     · process timelines fill their line as you read (.tl) */
  const depthEls = Array.from(document.querySelectorAll('[data-depth]'));
  const timelines = Array.from(document.querySelectorAll('.tl'));
  if (!reduced && (depthEls.length || timelines.length)) {
    let tick = false;
    const update = () => {
      tick = false;
      const vh = window.innerHeight;
      depthEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        const img = el.querySelector('img');
        if (!img) return;
        const t = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // -1 … 1
        img.style.transform = 'translate3d(0,' + (t * 6).toFixed(2) + '%,0)';
      });
      timelines.forEach((el) => {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (vh * 0.62 - r.top) / r.height));
        el.style.setProperty('--p', p.toFixed(3));
      });
    };
    const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  if (!finePointer || reduced) return;

  /* ── 3. Magnetic buttons ─────────────────────────────────── */
  document.querySelectorAll('.btn, .header-cta').forEach((btn) => {
    const pull = btn.classList.contains('header-cta') ? 0.18 : 0.26;
    btn.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1), background .3s, color .3s, border-color .3s, box-shadow .3s';
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * pull;
      const y = (e.clientY - (r.top + r.height / 2)) * pull * 1.3;
      btn.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });

  /* ── 4. 3D tilt + glare on project images ───────────────── */
  document.querySelectorAll('.project').forEach((card) => {
    const glare = document.createElement('span');
    glare.className = 'tilt-glare';
    glare.setAttribute('aria-hidden', 'true');
    card.appendChild(glare);
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.transform = 'perspective(1100px) rotateX(' + ((0.5 - py) * 7).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 9).toFixed(2) + 'deg)';
      card.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });

  /* ── 5. Cursor spotlight on cards ───────────────────────── */
  document.querySelectorAll('.cap-card, .why-cell, .testimonial, .lp-switch-card, .feat').forEach((el) => {
    el.classList.add('has-spotlight');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    });
  });
})();
