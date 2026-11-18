/* ============================================================
   FORTERA — motion & interaction (2026 design system)
   No dependencies. Respects prefers-reduced-motion.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var doc = document.documentElement;

  /* ---- Split headings into words for the reveal ---------------- */
  document.querySelectorAll('.fx-split').forEach(function (el) {
    var html = el.innerHTML.split(/(<br\s*\/?>)/i).map(function (chunk) {
      if (/^<br/i.test(chunk)) return chunk;
      return chunk.split(/\s+/).filter(Boolean).map(function (word) {
        return '<span class="w"><span>' + word + '</span></span>';
      }).join(' ');
    }).join('');
    el.innerHTML = html;
    el.querySelectorAll('.w > span').forEach(function (s, i) {
      s.style.transitionDelay = (0.08 * i).toFixed(2) + 's';
    });
  });

  /* ---- Hero headline reveals straight away --------------------- */
  document.querySelectorAll('.fx-hero .fx-split').forEach(function (el) {
    setTimeout(function () { el.classList.add('is-in'); }, 120);
  });

  /* ---- Reveal on enter (slide-in, wipes, word splits) ---------- */
  var revealTargets = document.querySelectorAll('[data-in], .fx-split, .fx-panels');
  if (reduce || !('IntersectionObserver' in window)) {
    revealTargets.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    revealTargets.forEach(function (el) { io.observe(el); });
  }

  /* ---- Nav: transparent over hero, solid after, hide on scroll down */
  var nav = document.querySelector('.fx-nav');
  var hero = document.querySelector('.fx-hero, .fx-phero');
  var lockSolid = nav && nav.hasAttribute('data-solid');
  var dim = document.querySelector('.fx-hero-dim');
  var lastY = window.scrollY;

  /* ---- Parallax ----------------------------------------------- */
  var parallax = reduce ? [] : Array.prototype.slice.call(document.querySelectorAll('[data-speed]'));

  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    if (nav) {
      var heroEnd = hero ? hero.offsetHeight - 80 : 0;
      nav.classList.toggle('is-solid', lockSolid || !hero || y > heroEnd);
      var menuOpen = doc.classList.contains('menu-open');
      nav.classList.toggle('is-hidden', !menuOpen && y > vh * 1.2 && y > lastY + 4);
      if (y < lastY - 4) nav.classList.remove('is-hidden');
    }
    if (dim && !reduce) dim.style.opacity = Math.min(y / (vh * 0.9), 1) * 0.75;

    for (var i = 0; i < parallax.length; i++) {
      var el = parallax[i];
      var r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      var progress = (r.top + r.height / 2 - vh / 2) / vh; // -1 .. 1 around centre
      var speed = parseFloat(el.getAttribute('data-speed')) || 0.15;
      el.style.transform = 'translate3d(0,' + (progress * speed * -100).toFixed(2) + 'px,0)';
    }
    lastY = y;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  /* ---- Full-screen menu --------------------------------------- */
  var menu = document.getElementById('fxMenu');
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    doc.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    document.querySelectorAll('[data-menu-open]').forEach(function (b) { b.setAttribute('aria-expanded', String(open)); });
    if (open) { var first = menu.querySelector('a, button'); if (first) first.focus(); }
  }
  document.querySelectorAll('[data-menu-open]').forEach(function (b) { b.addEventListener('click', function () { setMenu(true); }); });
  document.querySelectorAll('[data-menu-close]').forEach(function (b) { b.addEventListener('click', function () { setMenu(false); }); });
  if (menu) menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---- Hero video: pause when reduced motion ------------------ */
  if (reduce) document.querySelectorAll('video[autoplay]').forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });

  /* ---- Lazy section videos ------------------------------------ */
  var lazy = document.querySelectorAll('video[data-src]');
  if (lazy.length && !reduce && 'IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (!v.src) { v.src = v.getAttribute('data-src'); } var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (!v.paused) v.pause();
      });
    }, { rootMargin: '200px 0px' });
    lazy.forEach(function (v) { vo.observe(v); });
  }
})();

/* ---- Journal category filter ---------------------------------- */
(function () {
  var pills = document.querySelectorAll('[data-jr-filter]');
  if (!pills.length) return;
  var rows = document.querySelectorAll('.jr-row[data-cat]');
  pills.forEach(function (p) {
    p.addEventListener('click', function () {
      var cat = p.getAttribute('data-jr-filter');
      pills.forEach(function (q) { q.setAttribute('aria-pressed', String(q === p)); });
      rows.forEach(function (r) { r.hidden = !(cat === 'all' || r.getAttribute('data-cat') === cat); });
    });
  });
})();

/* ---- Home panels: still image comes to life on hover ------------ */
(function () {
  var panels = document.querySelectorAll('.fx-panel');
  if (!panels.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function start(panel, v) {
    if (!v.src) { v.src = v.getAttribute('data-hover-src'); v.addEventListener('loadedmetadata', function () { v.currentTime = 0.5; }, { once: true }); }
    var p = v.play();
    if (p && p.then) p.then(function () { panel.classList.add('is-playing'); }).catch(function () {});
    else panel.classList.add('is-playing');
  }
  function stop(panel, v) { panel.classList.remove('is-playing'); v.pause(); }
  var touch = window.matchMedia('(hover: none)').matches;
  var io = touch && 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { var v = e.target.querySelector('video[data-hover-src]'); if (!v) return; if (e.isIntersecting) start(e.target, v); else stop(e.target, v); });
  }, { threshold: 0.6 }) : null;
  panels.forEach(function (panel) {
    var v = panel.querySelector('video[data-hover-src]');
    if (!v) return;
    if (io) { io.observe(panel); return; }
    panel.addEventListener('mouseenter', function () { start(panel, v); });
    panel.addEventListener('mouseleave', function () { stop(panel, v); });
    panel.addEventListener('focus', function () { start(panel, v); });
    panel.addEventListener('blur', function () { stop(panel, v); });
  });
})();
