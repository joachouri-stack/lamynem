/* Lamyne M — interactions de base : menu mobile, révélations au scroll,
   lecture vidéo à la demande, mémorisation de la langue. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Écran « Entrer » : géré par fabric.js. Filet de sécurité : si ce script ne
  // s'est pas exécuté (réseau, erreur), l'écran est retiré pour ne jamais bloquer la page.
  window.addEventListener('load', function () {
    var en = document.querySelector('[data-enter]');
    if (en && !en.hasAttribute('data-ready')) {
      root.classList.remove('needs-enter');
      en.remove();
    }
  });

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
    // Hauteur de référence, mesurée hors état compact : la barre ivoire rétrécit
    // sur mobile, et le seuil ne doit pas bouger avec elle (pas d'oscillation).
    var baseH = hdr.offsetHeight;

    var updateHeader = function () {
      ticking = false;
      var y = window.scrollY;
      // Fin de la zone sombre, mesurée en coordonnées de page.
      var limit = overEl ? overEl.getBoundingClientRect().bottom + y - baseH : 0;
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
    window.addEventListener('resize', function () {
      if (!hdr.classList.contains('is-solid')) baseH = hdr.offsetHeight;
      updateHeader();
    }, { passive: true });
    // Hauteur finale connue une fois la transition terminée (barre d'onglets fixe).
    hdr.addEventListener('transitionend', function (e) {
      if (e.target === hdr && e.propertyName === 'padding-top') {
        document.documentElement.style.setProperty('--header-h', hdr.offsetHeight + 'px');
      }
    });
    updateHeader();
  }

  // --- Page Expositions : filtre par type (liste complète sans JS) --------
  var filter = document.querySelector('.ex-filter');
  if (filter) {
    filter.hidden = false;
    var cards = document.querySelectorAll('.ex-card');
    filter.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      var t = btn.getAttribute('data-filter');
      filter.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      cards.forEach(function (c) { c.hidden = t !== 'all' && c.getAttribute('data-type') !== t; });
    });
  }

  // --- Carrousels mobiles : compteur et barre de progression ------------
  document.querySelectorAll('[data-carousel]').forEach(function (track) {
    var bar = track.nextElementSibling;
    if (!bar || !bar.classList.contains('carousel-bar')) return;
    var count = bar.querySelector('[data-carousel-count]');
    var fill = bar.querySelector('[data-carousel-fill]');
    var update = function () {
      // Seuls les éléments affichés comptent (ex. robe de couverture masquée sur mobile).
      var n = Array.prototype.filter.call(track.children, function (c) { return c.offsetParent !== null; }).length || 1;
      var max = track.scrollWidth - track.clientWidth;
      var p = max > 0 ? track.scrollLeft / max : 0;
      fill.style.transform = 'scaleX(' + (1 / n + p * (1 - 1 / n)).toFixed(3) + ')';
      count.textContent = Math.min(n, Math.round(p * (n - 1)) + 1) + ' / ' + n;
    };
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  });

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
