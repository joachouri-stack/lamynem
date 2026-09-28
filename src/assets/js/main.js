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
