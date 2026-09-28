/* Lamyne M — interactions de base : menu mobile, révélations au scroll,
   lecture vidéo à la demande, mémorisation de la langue. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Menu mobile ------------------------------------------------------
  var burger = document.querySelector('[data-menu-open]');
  var menu = document.getElementById('menu');
  var lastFocus = null;

  function focusables() {
    return menu.querySelectorAll('a[href], button:not([disabled])');
  }

  function openMenu() {
    lastFocus = document.activeElement;
    menu.classList.add('is-open');
    menu.removeAttribute('inert');
    document.body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    var f = focusables();
    if (f.length) f[0].focus();
  }

  function closeMenu() {
    menu.classList.remove('is-open');
    menu.setAttribute('inert', '');
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    if (lastFocus) lastFocus.focus();
  }

  if (burger && menu) {
    burger.addEventListener('click', openMenu);
    menu.querySelector('[data-menu-close]').addEventListener('click', closeMenu);
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a[href^="#"]')) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (!menu.classList.contains('is-open')) return;
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        var first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // --- En-tête : transparent sur les zones sombres, barre ivoire ensuite,
  //     caché en descendant, visible en remontant, fil de progression ------
  var hdr = document.querySelector('[data-header]');
  if (hdr) {
    var overEl = document.querySelector('[data-header-over]');
    var startsOver = hdr.classList.contains('site-header--over');
    var lastY = window.scrollY;
    var ticking = false;

    var updateHeader = function () {
      ticking = false;
      var y = window.scrollY;
      // Fin de la zone sombre, mesurée en coordonnées de page.
      var limit = overEl ? overEl.getBoundingClientRect().bottom + y - hdr.offsetHeight : 0;
      var solid = y > Math.max(limit, 8);
      hdr.classList.toggle('is-solid', solid);
      if (startsOver) hdr.classList.toggle('site-header--over', !solid);
      if (Math.abs(y - lastY) > 6) {
        var down = y > lastY;
        hdr.classList.toggle('is-hidden', down && solid && y > limit + 240 && !document.body.classList.contains('menu-open'));
        lastY = y;
      }
      // Barre d'onglets fixe (rubrique Œuvres) : se range sous l'en-tête quand il est visible.
      document.body.classList.toggle('header-shown', solid && !hdr.classList.contains('is-hidden'));
      document.documentElement.style.setProperty('--header-h', hdr.offsetHeight + 'px');
      var max = document.documentElement.scrollHeight - window.innerHeight;
      hdr.style.setProperty('--progress', max > 0 ? Math.min(y / max, 1).toFixed(4) : '0');
    };

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(updateHeader); }
    }, { passive: true });
    window.addEventListener('resize', updateHeader, { passive: true });
    updateHeader();
  }

  // --- Mémorisation de la langue choisie (utilisée par la page racine) ----
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-lang]');
    if (!a) return;
    try { localStorage.setItem('lang', a.getAttribute('data-lang')); } catch (err) { /* stockage indisponible */ }
  });

  // --- Révélations au scroll --------------------------------------------
  var items = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window && items.length) {
    root.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach(function (el) { io.observe(el); });
  }

  // --- Vidéo « Art in Motion » : chargée seulement au clic -----------------
  document.querySelectorAll('[data-video]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var box = btn.closest('.video');
      var v = document.createElement('video');
      v.src = btn.getAttribute('data-video');
      var poster = btn.getAttribute('data-poster');
      if (poster) v.poster = poster;
      v.controls = true;
      v.playsInline = true;
      v.setAttribute('aria-label', btn.getAttribute('aria-label'));
      box.innerHTML = '';
      box.appendChild(v);
      v.play().catch(function () {});
      v.focus();
    });
  });
})();
