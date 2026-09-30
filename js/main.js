(() => {
  const doc = document.documentElement;
  doc.classList.add('js');

  /* Sticky call bar: shown once the hero has scrolled out of view. */
  const hero = document.querySelector('[data-hero]');
  const callbar = document.querySelector('[data-callbar]');
  if (hero && callbar && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting;
      callbar.classList.toggle('is-visible', show);
      callbar.toggleAttribute('inert', !show);
      doc.classList.toggle('has-callbar', show);
    }, { rootMargin: '0px 0px -40% 0px' });
    io.observe(hero);
  }

  /* Gallery lightbox: <dialog>, arrow keys, swipe, focus returns to the thumbnail. */
  const dialog = document.querySelector('[data-lightbox]');
  const items = [...document.querySelectorAll('[data-gallery-item]')];
  if (dialog && items.length && typeof dialog.showModal === 'function') {
    const img = dialog.querySelector('[data-lightbox-img]');
    const caption = dialog.querySelector('[data-lightbox-caption]');
    const counter = dialog.querySelector('[data-lightbox-counter]');
    let index = 0;
    let opener = null;

    const show = (i) => {
      index = (i + items.length) % items.length;
      const item = items[index];
      const thumb = item.querySelector('img');
      img.src = item.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      caption.textContent = item.dataset.caption || (thumb ? thumb.alt : '');
      counter.textContent = `${index + 1} / ${items.length}`;
    };

    items.forEach((item, i) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        opener = item;
        show(i);
        dialog.showModal();
        doc.classList.add('is-locked');
      });
    });

    dialog.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(index - 1));
    dialog.querySelector('[data-lightbox-next]').addEventListener('click', () => show(index + 1));
    dialog.querySelector('[data-lightbox-close]').addEventListener('click', () => dialog.close());

    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    // Click on the backdrop (outside the figure) closes.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });

    dialog.addEventListener('close', () => {
      doc.classList.remove('is-locked');
      if (opener) opener.focus();
    });

    // Horizontal swipe on touch screens.
    let startX = null;
    let startY = null;
    img.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; });
    img.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
      startX = startY = null;
    });
  }

  /* Reveal: elements marked data-reveal get .is-in once they scroll into view. */
  const reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length && 'IntersectionObserver' in window) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        ro.unobserve(entry.target);
      });
    }, { threshold: 0.25 });
    reveals.forEach((el) => ro.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* Horizontal photo strip: prev/next buttons scroll by one card. */
  const smooth = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  document.querySelectorAll('[data-strip]').forEach((strip) => {
    const track = strip.querySelector('[data-strip-track]');
    if (!track) return;
    const step = () => {
      const first = track.firstElementChild;
      return first ? first.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
    };
    const prev = strip.querySelector('[data-strip-prev]');
    const next = strip.querySelector('[data-strip-next]');
    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: smooth }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: smooth }));
  });

  /* Scroll-linked effects. Transforms only; skipped entirely for reduced motion. */
  const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const effects = [];

  // Container scroll (after Aceternity's ContainerScroll): the photo card tilts
  // from rotateX(20deg) to flat and the title rises 100px as the block scrolls in.
  const cscroll = document.querySelector('[data-cscroll]');
  if (cscroll) {
    const card = cscroll.querySelector('[data-cscroll-card]');
    const head = cscroll.querySelector('[data-cscroll-header]');
    effects.push({
      el: cscroll,
      run(r, vh) {
        // 0 when the block's top enters the viewport, 1 when its bottom reaches the viewport bottom
        const p = clamp((vh - r.top) / r.height);
        const [s0, s1] = window.innerWidth <= 768 ? [0.7, 0.9] : [1.05, 1];
        card.style.transform = `rotateX(${(20 * (1 - p)).toFixed(2)}deg) scale(${(s0 + (s1 - s0) * p).toFixed(3)})`;
        head.style.transform = `translateY(${(-100 * p).toFixed(1)}px)`;
      },
    });
  }

  // Tapes: each band slides sideways with the scroll, in opposite directions.
  document.querySelectorAll('[data-tape]').forEach((track) => {
    const dir = Number(track.dataset.tape) || 1;
    const start = dir > 0 ? -640 : -160;
    effects.push({
      el: track.parentElement,
      run(r, vh) {
        track.style.transform = `translate3d(${(start + (vh - r.top) * 0.4 * dir).toFixed(1)}px, 0, 0)`;
      },
    });
  });

  // Route: the orange line fills as the steps scroll past; each stop lights up when reached.
  const route = document.querySelector('[data-route]');
  const stops = route ? [...route.querySelectorAll('.route__num')] : [];
  if (route) {
    effects.push({
      el: route,
      run(r, vh) {
        const p = clamp((vh * 0.7 - r.top) / r.height);
        route.style.setProperty('--p', p.toFixed(3));
        const horizontal = window.innerWidth >= 960;
        stops.forEach((n) => {
          const b = n.getBoundingClientRect();
          const at = horizontal ? (b.left - r.left) / r.width : (b.top + b.height / 2 - r.top) / r.height;
          n.classList.toggle('is-lit', at <= p);
        });
      },
    });
  }

  // Hero: the machine turns toward the cursor. Targets are set in the event handler,
  // transforms are written only inside one rAF loop that eases toward them and stops when idle.
  const stage = document.querySelector('[data-hero-stage]');
  const heroAtv = stage && stage.querySelector('[data-hero-atv]');
  if (stage && heroAtv && motionOK) {
    const types = stage.querySelectorAll('[data-hero-type]');
    const shadow = stage.querySelector('[data-hero-shadow]');
    const glow = stage.querySelector('[data-hero-glow]');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let raf = 0;
    let onScreen = true;
    const paint = ({ x, y }) => {
      heroAtv.style.transform = `translate3d(${(x * 22).toFixed(2)}px, ${(y * 12).toFixed(2)}px, 0) rotateY(${(x * 10).toFixed(2)}deg) rotateX(${(-y * 5).toFixed(2)}deg)`;
      const back = `translate3d(${(-x * 7).toFixed(2)}px, ${(-y * 4).toFixed(2)}px, 0)`;   // about a third, the other way
      types.forEach((el) => { el.style.transform = back; });
      if (shadow) shadow.style.transform = `translate3d(${(-x * 26).toFixed(2)}px, 0, 0) scaleX(${(1 + Math.abs(x) * 0.12).toFixed(3)})`;
      if (glow) glow.style.transform = `translate3d(${(x * 60).toFixed(1)}px, ${(y * 40).toFixed(1)}px, 0)`;
    };
    const loop = () => {
      cur.x += (target.x - cur.x) * 0.09;
      cur.y += (target.y - cur.y) * 0.09;
      paint(cur);
      const moving = Math.abs(target.x - cur.x) > 0.0005 || Math.abs(target.y - cur.y) > 0.0005;
      raf = onScreen && moving ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf && onScreen) raf = requestAnimationFrame(loop); };
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !finePointer.matches) return;
      const r = stage.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      kick();
    });
    stage.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; kick(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) kick(); }).observe(stage);
    }

    // Touch / no hover: a slight turn linked to scrolling instead of the cursor.
    if (window.matchMedia('(hover: none)').matches) {
      effects.push({
        el: stage,
        run(r) {
          const p = clamp(-r.top / r.height);
          heroAtv.style.transform = `translate3d(0, ${(p * 28).toFixed(1)}px, 0) rotateY(${(-12 * p).toFixed(2)}deg)`;
        },
      });
    }
  }

  if (motionOK && effects.length && 'IntersectionObserver' in window) {
    if (route) route.style.setProperty('--p', '0');
    let queued = false;
    const frame = () => {
      queued = false;
      const vh = window.innerHeight;
      effects.forEach((fx) => { if (fx.on) fx.run(fx.el.getBoundingClientRect(), vh); });
    };
    const request = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
    const eo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        effects.forEach((fx) => { if (fx.el === entry.target) fx.on = entry.isIntersecting; });
      });
      request();
    }, { rootMargin: '120px 0px' });
    effects.forEach((fx) => eo.observe(fx.el));
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
  } else {
    stops.forEach((n) => n.classList.add('is-lit'));
  }

  /* Current year in the footer. */
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
