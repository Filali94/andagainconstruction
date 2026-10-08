/* ══════════════════════════════════════════════════════════════
   effects.js — shared micro-interactions for every page
   · word-by-word heading reveals
   · photo depth inside frames + filling process timelines
   · full-screen viewer for the project gallery
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

  /* ── 3. Project gallery: full-screen viewer ([data-gallery]) ── */
  document.querySelectorAll('[data-gallery]').forEach((gallery) => {
    const tiles = Array.from(gallery.querySelectorAll('[data-full]'));
    if (!tiles.length) return;
    const da = () => document.documentElement.getAttribute('data-lang') !== 'en';
    const icon = (id) => '<svg class="ic" aria-hidden="true"><use href="icons.svg?v=2#' + id + '"/></svg>';
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML =
      '<span class="lb-count"></span>' +
      '<button type="button" class="lb-btn lb-close">' + icon('i-close') + '</button>' +
      '<button type="button" class="lb-btn lb-prev">' + icon('i-chev-left') + '</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lb-btn lb-next">' + icon('i-chev-right') + '</button>';
    document.body.appendChild(box);
    const img = box.querySelector('img');
    const cap = box.querySelector('figcaption');
    const count = box.querySelector('.lb-count');
    const btnClose = box.querySelector('.lb-close');
    const btnPrev = box.querySelector('.lb-prev');
    const btnNext = box.querySelector('.lb-next');
    let index = 0;
    let opener = null;

    function show(i) {
      index = (i + tiles.length) % tiles.length;
      const t = tiles[index];
      const text = t.getAttribute(da() ? 'data-cap-da' : 'data-cap-en') || '';
      img.src = t.dataset.full;
      img.alt = text;
      cap.textContent = text;
      count.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(tiles.length).padStart(2, '0');
    }
    function open(i) {
      opener = tiles[i];
      btnClose.setAttribute('aria-label', da() ? 'Luk' : 'Close');
      btnPrev.setAttribute('aria-label', da() ? 'Forrige billede' : 'Previous image');
      btnNext.setAttribute('aria-label', da() ? 'Næste billede' : 'Next image');
      box.setAttribute('aria-label', da() ? 'Billedgalleri' : 'Image gallery');
      show(i);
      box.classList.add('open');
      document.body.style.overflow = 'hidden';
      btnClose.focus();
    }
    function close() {
      box.classList.remove('open');
      document.body.style.overflow = '';
      if (opener) opener.focus();
    }
    tiles.forEach((t, i) => t.addEventListener('click', () => open(i)));
    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', () => show(index - 1));
    btnNext.addEventListener('click', () => show(index + 1));
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    document.addEventListener('keydown', (e) => {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
    });
    // Swipe left/right on touch screens
    let x0 = null;
    box.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    box.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    });
  });

  if (!finePointer || reduced) return;

  /* ── 4. Magnetic buttons ─────────────────────────────────── */
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

  /* ── 5. 3D tilt + glare on project images ───────────────── */
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

  /* ── 6. Cursor spotlight on cards ───────────────────────── */
  document.querySelectorAll('.cap-card, .why-cell, .testimonial, .lp-switch-card, .feat').forEach((el) => {
    el.classList.add('has-spotlight');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
    });
  });
})();
