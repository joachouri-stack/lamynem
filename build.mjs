#!/usr/bin/env node
// Générateur statique du site Lamyne M — Node ≥ 18, aucune dépendance.
//
//   node build.mjs          → génère dist/ (HTML statique FR / EN / RU)
//
// Le dossier dist/ se déploie tel quel sur n'importe quel serveur de fichiers
// statiques (Nginx, Apache) : pas de PHP, pas de base de données.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BIO, CONTACT, COUNTRIES, DEFAULT_LANG, EXHIBITIONS, FEATURED, HERO, IMAGES, LANGS,
  MOTION_VIDEO, PRESS, PRESS_KIT, ROUTES, SITE_URL, WORKS,
} from './src/content/site.mjs';
import { STRINGS } from './src/content/i18n.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');
const MANIFEST = JSON.parse(readFileSync(join(SRC, 'assets/img/manifest.json'), 'utf8'));
const LOCALES = { fr: 'fr_FR', en: 'en_US', ru: 'ru_RU' };
const TODOS = new Set();

// --- Utilitaires ---------------------------------------------------------

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Valeur localisée : objet {fr,en,ru} ou chaîne invariable. */
const tr = (v, lang) => (v && typeof v === 'object' && !Array.isArray(v) ? v[lang] : v);

/** Note un champ manquant et renvoie le marqueur visible « à compléter ». */
function todo(lang, what) {
  TODOS.add(what);
  return `<span class="todo">${esc(STRINGS[lang].todo)}</span>`;
}

function path(lang, route, slug) {
  const seg = ROUTES[route][lang];
  return `/${lang}/${seg ? seg + '/' : ''}${slug ? slug + '/' : ''}`;
}

const CATEGORIES = ['art', 'performance', 'masterclass'];
const catPath = (lang, cat) => path(lang, 'work', cat);
const workPath = (lang, w) => `${catPath(lang, w.category)}${w.slug}/`;
const workBySlug = slug => WORKS.find(w => w.slug === slug);

const hash = file => createHash('sha1').update(readFileSync(join(SRC, file))).digest('hex').slice(0, 8);
const ASSET_V = {
  css: hash('assets/css/main.css'),
  main: hash('assets/js/main.js'),
  fabric: hash('assets/js/fabric.js'),
};

const roman = n => ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'][n - 1] || String(n);
const pad2 = n => String(n).padStart(2, '0');

const THREAD = '<svg class="thread" viewBox="0 0 30 8" aria-hidden="true" focusable="false"><path d="M0 4 Q4 0 8 4 T16 4 T24 4 T30 4" stroke="#B5502E" stroke-width="1" fill="none"/></svg>';
const ARROW = '<span class="arrow" aria-hidden="true">→</span>';

function label(text, { tag = 'p', id } = {}) {
  return `<div class="label">${THREAD}<${tag} class="eyebrow"${id ? ` id="${id}"` : ''}>${esc(text)}</${tag}></div>`;
}

/** <picture> responsive AVIF / WebP / JPEG. */
function picture(key, lang, { sizes = '100vw', eager = false, cls = '', style = '' } = {}) {
  const m = MANIFEST[key];
  const base = `/assets/img/${key}`;
  const set = ext => m.widths.map(w => `${base}-${w}.${ext} ${w}w`).join(', ');
  const alt = tr(IMAGES[key]?.alt, lang);
  if (!alt) todo(lang, `Texte alternatif de l'image ${key} (${lang})`);
  const largest = m.widths[m.widths.length - 1];
  return `<picture${cls ? ` class="${cls}"` : ''}>`
    + `<source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">`
    + `<source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">`
    + `<img src="${base}-${largest}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${m.width}" height="${m.height}" alt="${esc(alt || '')}"`
    + (eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"')
    + (style ? ` style="${style}"` : '') + '></picture>';
}

/** Aplat coloré de remplacement quand la photo d'une œuvre n'est pas encore fournie. */
function swatch(tone, lang, note = true) {
  const [c1, c2, c3] = tone;
  return `<div class="swatch" style="--c1:${c1};--c2:${c2};--c3:${c3}"><div class="swatch__inner"></div><div class="grain"></div>`
    + (note ? `<p class="eyebrow swatch__note">${esc(STRINGS[lang].visualTodo)}</p>` : '') + '</div>';
}

function workMedia(w, lang, sizes) {
  if (w.image) return picture(w.image, lang, { sizes });
  TODOS.add(`Photo de l'œuvre « ${w.title} »`);
  return swatch(w.tone, lang);
}

function workCard(w, lang, num) {
  const s = STRINGS[lang];
  const kind = tr(w.medium, lang) || s.categories[w.category];
  return `<a class="card reveal" href="${workPath(lang, w)}">`
    + `<div class="card__media">${workMedia(w, lang, '(max-width: 720px) 100vw, 50vw')}</div>`
    + `<div class="card__meta"><h3 class="card__title">${num ? `<span class="card__num">${num}.</span> ` : ''}${esc(w.title)}</h3>`
    + `<p class="eyebrow">${esc(kind)}</p></div></a>`;
}

// --- Gabarit commun -------------------------------------------------------

function langSwitch(lang, alternates, extraCls = '') {
  const s = STRINGS[lang];
  return `<nav class="lang-switch ${extraCls}" aria-label="${esc(s.langSwitch)}">`
    + LANGS.map(l => `<a href="${alternates[l]}" hreflang="${l}" lang="${l}" data-lang="${l}"${l === lang ? ' aria-current="true"' : ''}>`
      + `<span aria-hidden="true">${l.toUpperCase()}</span><span class="visually-hidden">${esc(STRINGS[l].langName)}</span></a>`).join('')
    + '</nav>';
}

function header(lang, current, alternates, over) {
  const s = STRINGS[lang];
  const items = [
    ['work', path(lang, 'work')],
    ['exhibitions', path(lang, 'exhibitions')],
    ['about', path(lang, 'about')],
    ['press', path(lang, 'press')],
    ['contact', '#contact'],
  ];
  const link = ([k, href]) => `<a href="${href}"${k === current ? ' aria-current="page"' : ''}>${esc(s.nav[k])}</a>`;
  const sub = CATEGORIES.map(c => `<li><a href="${catPath(lang, c)}">${esc(s.categories[c])}</a></li>`).join('');
  const deskItem = i => (i[0] === 'work'
    ? `<div class="nav-drop">${link(i)}<ul class="nav-drop__panel">${sub}</ul></div>`
    : link(i));
  const mobItem = i => (i[0] === 'work'
    ? `<li>${link(i)}<ul class="menu-sub">${sub}</ul></li>`
    : `<li>${link(i)}</li>`);
  return `<header class="site-header${over ? ' site-header--over' : ''}">`
    + `<a class="brand" href="${path(lang, 'home')}">LAMYNE M</a>`
    + `<div class="nav-desktop"><nav aria-label="${esc(s.mainNav)}" class="nav-links">${items.map(deskItem).join('')}</nav>`
    + `<span class="nav-sep" aria-hidden="true"></span>${langSwitch(lang, alternates)}</div>`
    + `<div class="header-mobile">${langSwitch(lang, alternates)}`
    + `<button class="burger" type="button" data-menu-open aria-expanded="false" aria-controls="menu"><span></span><span></span><span class="visually-hidden">${esc(s.menu)}</span></button></div>`
    + '</header>'
    + `<div class="menu-overlay on-dark" id="menu" role="dialog" aria-modal="true" aria-label="${esc(s.menu)}" inert>`
    + `<div class="menu-overlay__top"><a class="brand" href="${path(lang, 'home')}">LAMYNE M</a>`
    + `<button class="menu-close" type="button" data-menu-close><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M1 1l16 16M17 1L1 17" stroke="currentColor" stroke-width="1"/></svg><span class="visually-hidden">${esc(s.close)}</span></button></div>`
    + `<nav class="menu-nav" aria-label="${esc(s.mainNav)}"><ul>${items.map(mobItem).join('')}</ul></nav>`
    + `<div class="menu-foot"><p class="eyebrow">${esc(s.tagline)}</p>${langSwitch(lang, alternates)}</div>`
    + '</div>';
}

function contactFooter(lang, alternates) {
  const s = STRINGS[lang];
  const socials = [['Instagram', CONTACT.instagram], ['Facebook', CONTACT.facebook]];
  socials.forEach(([n, u]) => { if (!u) TODOS.add(`URL du profil ${n}`); });
  const socialLinks = socials.filter(([, u]) => u)
    .map(([n, u]) => `<a href="${esc(u)}" rel="me noopener" target="_blank">${n}</a>`).join('');
  return `<footer class="section section--dark contact on-dark" id="contact" aria-labelledby="contact-title">`
    + '<div class="glow" aria-hidden="true"></div>'
    + `<h2 class="visually-hidden" id="contact-title">${esc(s.contact.eyebrow)}</h2>`
    + `<p class="contact__lines">${esc(s.contact.lines)}<span>${esc(s.contact.accent)}</span></p>`
    + `<a class="contact__mail" href="mailto:${CONTACT.email}">${esc(CONTACT.email)} ${ARROW}</a>`
    + '<dl class="contact__info">'
    + `<div><dt class="eyebrow">${esc(s.contact.based)}</dt><dd>${esc(tr(CONTACT.location, lang))}</dd></div>`
    + `<div><dt class="eyebrow">${esc(s.contact.social)}</dt><dd>${socialLinks || todo(lang, 'Liens réseaux sociaux')}</dd></div>`
    + '</dl>'
    + `<div class="site-foot"><p class="eyebrow">© ${new Date().getFullYear()} Lamyne M</p>${langSwitch(lang, alternates)}</div>`
    + `<p class="eyebrow site-credit">Design by Johane A.</p>`
    + '</footer>';
}

function fontsHref(lang) {
  let fam = 'family=Archivo:wght@400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,400';
  if (lang === 'ru') fam += '&family=Onest:wght@400;500';
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

function personLd(lang) {
  const s = STRINGS[lang];
  const sameAs = [CONTACT.instagram, CONTACT.facebook].filter(Boolean);
  return {
    '@type': 'Person',
    '@id': `${SITE_URL}/#lamyne-m`,
    name: 'Lamyne M',
    url: `${SITE_URL}${path(lang, 'home')}`,
    jobTitle: s.tagline,
    birthDate: BIO.born,
    birthPlace: { '@type': 'Country', name: tr(BIO.birthplace, lang) },
    homeLocation: { '@type': 'Place', name: `${tr(BIO.basedIn, lang)}, France` },
    email: `mailto:${CONTACT.email}`,
    knowsAbout: s.disciplines.split(' • '),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

function page({ lang, route, slug, alternates, xDefault, title, description, body, current, over = false, jsonld = [], ogType = 'website', ogImage, fabric = false }) {
  const s = STRINGS[lang];
  const self = `${SITE_URL}${alternates[lang]}`;
  const img = `${SITE_URL}/assets/img/${ogImage || 'seconde-vie-villa-d-2026'}-og.jpg`;
  const ld = jsonld.length
    ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonld }).replace(/</g, '\\u003c')}</script>`
    : '';
  const head = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${self}">
${LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}${alternates[l]}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${SITE_URL}${xDefault}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Lamyne M">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${self}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${LOCALES[lang]}">
${LANGS.filter(l => l !== lang).map(l => `<meta property="og:locale:alternate" content="${LOCALES[l]}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${img}">
<meta name="theme-color" content="#140805">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref(lang)}">
<link rel="stylesheet" href="/assets/css/main.css?v=${ASSET_V.css}">
${fabric ? `<script>(function(h){try{var n=navigator,c=n.connection,low=(n.hardwareConcurrency&&n.hardwareConcurrency<4)||(n.deviceMemory&&n.deviceMemory<4)||(c&&c.saveData);if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!low)h.classList.add('has-fabric')}catch(e){}})(document.documentElement)</script>\n` : ''}<script src="/assets/js/main.js?v=${ASSET_V.main}" defer></script>
${fabric ? `<script src="/assets/js/fabric.js?v=${ASSET_V.fabric}" defer></script>\n` : ''}${ld}
</head>
<body>
<a class="skip-link" href="#main">${esc(s.skip)}</a>
${header(lang, current, alternates, over)}
<main id="main" tabindex="-1">
${body}
</main>
${contactFooter(lang, alternates)}
</body>
</html>
`;
  const file = join(OUT, alternates[lang], 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, head);
  SITEMAP.push({ route, slug, alternates, xDefault, lang });
}

const SITEMAP = [];

const alts = (route, slug) => Object.fromEntries(LANGS.map(l => [l, path(l, route, slug)]));

// --- Pages -----------------------------------------------------------------

function renderHome(lang) {
  const s = STRINGS[lang], h = s.home;
  const alternates = alts('home');
  const featured = FEATURED.map(slug => WORKS.find(w => w.slug === slug));
  const secondeVie = EXHIBITIONS.find(e => e.id === 'seconde-vie');
  if (!HERO.work) TODOS.add('Photo de couverture : titre de l’œuvre (robe en patchwork de jeans)');
  if (!HERO.place) TODOS.add('Photo de couverture : lieu de la prise de vue');
  if (!HERO.credit) TODOS.add('Photo de couverture : nom du photographe (crédit)');

  const video = MOTION_VIDEO
    ? `<button class="video__play" type="button" data-video="/assets/${esc(MOTION_VIDEO.src)}"${MOTION_VIDEO.poster ? ` data-poster="/assets/${esc(MOTION_VIDEO.poster)}"` : ''} aria-label="${esc(s.home.play)} — ${esc(tr(MOTION_VIDEO.title, lang) || '')}"></button>`
    : (TODOS.add('Vidéo « Art in Motion »'), `<span class="video__play" aria-hidden="true"></span><p class="eyebrow video__note">[${esc(h.videoTodo)}]</p>`);

  const body = `
<section class="hero" data-hero aria-labelledby="hero-title">
  <div class="hero__stage">
    ${picture(HERO.image, lang, { eager: true, cls: 'hero__media', style: `object-position:${HERO.focus}` })}
    <div class="hero__veil hero__veil--a" aria-hidden="true"></div>
    <div class="glow" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>
    <div class="hero__veil hero__veil--b" aria-hidden="true"></div>
    <div class="hero__veil hero__veil--c" aria-hidden="true"></div>
    <div class="hero__content">
      <h1 class="hero__title" id="hero-title"><span class="hero__l1">LAMYNE</span> <span class="hero__m">M</span></h1>
      <div class="hero__meta">
        <p class="hero__tagline">${esc(s.tagline)}</p>
        <p class="eyebrow">${esc(s.disciplines)}</p>
      </div>
    </div>
    <canvas class="hero__fabric" aria-hidden="true"></canvas>
    <div class="hero__scroll" aria-hidden="true"><span class="eyebrow">${esc(s.scroll)}</span><i></i></div>
  </div>
</section>

<section aria-labelledby="works-title">
  <div class="featured">
    ${picture('seconde-vie-villa-d-2026', lang, {})}
    <p class="watermark watermark--light" aria-hidden="true">01</p>
    <div class="featured__caption">
      <div>
        <p class="eyebrow">${esc(h.worksEyebrow)}</p>
        <h2 class="featured__title" id="works-title">${esc(h.worksTitle)}</h2>
      </div>
      <div class="featured__work">
        <a class="display" href="${path(lang, 'exhibitions')}#${secondeVie.id}">${esc(tr(secondeVie.title, lang))}</a>
        <p class="eyebrow">${esc(h.featuredCaption)}</p>
      </div>
    </div>
  </div>
  <div class="works-pair">
    ${featured.map((w, i) => workCard(w, lang, roman(i + 2))).join('\n    ')}
  </div>
  <div class="works-more"><a class="eyebrow link-line" href="${path(lang, 'work')}">${esc(h.allWorks)} ${ARROW}</a></div>
</section>

<section class="section artist" aria-labelledby="artist-title">
  <div class="artist__media reveal">${swatch(['#e0a06a', '#a2643a', '#2a1810'], lang)}</div>
  <div class="artist__text reveal">
    <p class="watermark" aria-hidden="true">02</p>
    ${label(h.artistEyebrow, { tag: 'h2', id: 'artist-title' })}
    <p class="h-lead artist__lead">${esc(h.artistLead)}</p>
    <p class="artist__body">${esc(h.artistBody)}</p>
    <a class="eyebrow link-line" href="${path(lang, 'about')}">${esc(h.artistCta)} ${ARROW}</a>
  </div>
</section>

<section class="section section--dark motion on-dark" aria-labelledby="motion-title">
  <div class="glow" aria-hidden="true"></div>
  <div class="section__head">
    ${label(h.motionEyebrow, { tag: 'h2', id: 'motion-title' })}
    <p class="h-section">${esc(h.motionTitle)}</p>
  </div>
  <div class="video reveal"><div class="grain" aria-hidden="true"></div>${video}</div>
</section>

<section class="section exhibitions" aria-labelledby="ex-title">
  <p class="watermark" aria-hidden="true">04</p>
  <div class="section__head">
    ${label(h.exhibitionsEyebrow)}
    <h2 class="h-section" id="ex-title">${esc(h.exhibitionsTitle)}</h2>
  </div>
  ${exList(lang)}
  <ul class="countries">${COUNTRIES[lang].map(c => `<li class="eyebrow">${esc(c)}</li>`).join('')}</ul>
  <p style="position:relative;margin-top:40px"><a class="eyebrow link-line" href="${path(lang, 'exhibitions')}">${esc(h.allExhibitions)} ${ARROW}</a></p>
</section>

<section class="section section--sand masterclass" aria-labelledby="mc-title">
  <div>
    ${label(h.masterclassEyebrow, { tag: 'h2', id: 'mc-title' })}
    <p class="h-lead">${esc(h.masterclassTitle)}</p>
  </div>
  <a class="eyebrow link-line" href="${catPath(lang, 'masterclass')}">${esc(h.masterclassCta)} ${ARROW}</a>
</section>

<section class="section press" aria-labelledby="press-title">
  <div class="section__head">
    ${label(h.pressEyebrow)}
    <h2 class="h-section" id="press-title">${esc(h.pressTitle)}</h2>
  </div>
  <ul class="press-names">${PRESS.map(p => `<li>${p.url ? `<a href="${esc(p.url)}" rel="noopener" target="_blank">${esc(p.name)}</a>` : esc(p.name)}</li>`).join('')}</ul>
  ${pressKit(lang)}
</section>`;

  page({
    lang, route: 'home', alternates, xDefault: '/', current: null, over: true, fabric: true, ogImage: HERO.image,
    title: h.title, description: h.description, body,
    jsonld: [personLd(lang), { '@type': 'WebSite', name: 'Lamyne M', url: `${SITE_URL}/`, inLanguage: lang }],
  });
}

function exList(lang, { detailed = false } = {}) {
  const s = STRINGS[lang];
  return `<ul class="ex-list">${EXHIBITIONS.map(e => {
    const place = `${tr(e.city, lang)}, ${tr(e.country, lang)}`;
    const detail = tr(e.detail, lang);
    const title = detailed
      ? `<span class="ex-title">${esc(tr(e.title, lang))}</span>`
        + `<span class="ex-sub eyebrow">${esc(s.exhibitions.types[e.type])}${detail ? ` · ${esc(detail)}` : ''}`
        + (e.work ? `<a href="${workPath(lang, workBySlug(e.work))}">${esc(s.exhibitions.linkedWork)}</a>` : '') + '</span>'
      : `<span class="ex-title">${esc(tr(e.title, lang))}${detail ? ` <small>(${esc(detail)})</small>` : ''}</span>`;
    if (!e.year) TODOS.add(`Année : ${tr(e.title, 'fr')}`);
    return `<li class="ex-item reveal"${detailed ? ` id="${e.id}"` : ''}><div class="ex-item__main"><span class="ex-year">${e.year ? esc(e.year) : '<span aria-hidden="true">—</span>'}</span><div>${title}</div></div>`
      + `<p class="eyebrow">${esc(place)}</p></li>`;
  }).join('')}</ul>`;
}

function pressKit(lang) {
  const s = STRINGS[lang];
  if (PRESS_KIT) return `<a class="eyebrow press-kit link-line" href="/assets/${esc(PRESS_KIT)}" download>${esc(s.pressKit)} <span aria-hidden="true">↓</span></a>`;
  TODOS.add('Dossier de presse PDF');
  return `<p class="press-kit"><span class="todo">${esc(s.pressKitTodo)}</span></p>`;
}

/** Barre d'onglets fixe : Tout · Art · Performance · Masterclass. */
function catNav(lang, current) {
  const s = STRINGS[lang];
  const tab = (href, text, n, on) => `<li><a href="${href}"${on ? ' aria-current="page"' : ''}>${esc(text)} <sup>${n}</sup></a></li>`;
  return `<nav class="cat-nav" aria-label="${esc(s.work.browse)}"><ul>`
    + tab(path(lang, 'work'), s.work.all, WORKS.length, !current)
    + CATEGORIES.map(c => tab(catPath(lang, c), s.categories[c], WORKS.filter(w => w.category === c).length, c === current)).join('')
    + '</ul></nav>';
}

function renderWorkIndex(lang) {
  const s = STRINGS[lang];
  const body = `
<div class="page-intro">
  <p class="watermark" aria-hidden="true">01</p>
  ${label(s.work.eyebrow)}
  <h1>${esc(s.work.heading)}</h1>
</div>
${catNav(lang, null)}
<div class="cat-rows">
${CATEGORIES.map((cat, i) => {
  const list = WORKS.filter(w => w.category === cat);
  const cover = list.find(w => w.image) || list[0];
  return `<section class="cat-row reveal" aria-labelledby="c-${cat}">
  <a class="cat-row__media" href="${catPath(lang, cat)}" tabindex="-1" aria-hidden="true">${cover.image ? picture(cover.image, lang, { sizes: '(max-width: 860px) 100vw, 50vw' }) : swatch(cover.tone, lang, false)}</a>
  <div class="cat-row__text">
    <p class="eyebrow">${pad2(i + 1)} · ${esc(s.work.count(list.length))}</p>
    <h2 id="c-${cat}"><a href="${catPath(lang, cat)}">${esc(s.categories[cat])}</a></h2>
    <p class="cat-row__intro">${esc(s.categoryIntro[cat])}</p>
    <ul class="cat-row__list">${list.map(w => `<li><a href="${workPath(lang, w)}">${esc(w.title)}</a></li>`).join('')}</ul>
    <a class="eyebrow link-line" href="${catPath(lang, cat)}">${esc(s.work.seeCat(s.categories[cat]))} ${ARROW}</a>
  </div>
</section>`;
}).join('\n')}
</div>`;
  page({
    lang, route: 'work', alternates: alts('work'), xDefault: path(DEFAULT_LANG, 'work'), current: 'work',
    title: s.work.title, description: s.work.description, body,
    jsonld: [{
      '@type': 'CollectionPage', name: s.work.title, url: `${SITE_URL}${path(lang, 'work')}`, inLanguage: lang,
      hasPart: CATEGORIES.map(c => ({ '@type': 'CollectionPage', name: s.categories[c], url: `${SITE_URL}${catPath(lang, c)}` })),
    }],
  });
}

function renderCategory(cat, lang) {
  const s = STRINGS[lang];
  const list = WORKS.filter(w => w.category === cat);
  const body = `
<div class="page-intro page-intro--cat">
  <p class="watermark" aria-hidden="true">${pad2(CATEGORIES.indexOf(cat) + 1)}</p>
  <nav class="crumbs eyebrow" aria-label="${esc(s.work.crumbs)}"><a href="${path(lang, 'work')}">${esc(s.work.eyebrow)}</a> <span aria-hidden="true">/</span> <span aria-current="page">${esc(s.categories[cat])}</span></nav>
  <h1>${esc(s.categories[cat])}</h1>
  <p>${esc(s.categoryIntro[cat])} — ${esc(s.work.count(list.length))}</p>
</div>
${catNav(lang, cat)}
<section class="work-group" aria-labelledby="g-${cat}">
  <h2 class="visually-hidden" id="g-${cat}">${esc(s.categories[cat])}</h2>
  <div class="work-grid">${list.map((w, i) => workCard(w, lang, roman(i + 1))).join('')}</div>
</section>`;
  page({
    lang, route: 'work', slug: cat, alternates: Object.fromEntries(LANGS.map(l => [l, catPath(l, cat)])),
    xDefault: catPath(DEFAULT_LANG, cat), current: 'work',
    title: `${s.categories[cat]} — ${s.work.title}`, description: `${s.categoryIntro[cat]} ${s.work.description}`, body,
    jsonld: [{
      '@type': 'CollectionPage', name: `${s.categories[cat]} — Lamyne M`, url: `${SITE_URL}${catPath(lang, cat)}`, inLanguage: lang,
      hasPart: list.map(w => ({ '@type': 'CreativeWork', name: w.title, url: `${SITE_URL}${workPath(lang, w)}` })),
    }],
  });
}

function renderWork(w, lang) {
  const s = STRINGS[lang];
  const inCat = WORKS.filter(x => x.category === w.category);
  const num = inCat.indexOf(w) + 1;
  const next = inCat[num % inCat.length];
  const medium = tr(w.medium, lang);
  const place = w.category === 'masterclass' ? tr(w.place, lang) : undefined;
  const text = tr(w.text, lang);
  if (!w.year) TODOS.add(`Année de « ${w.title} »`);
  if (!medium && w.category !== 'masterclass') TODOS.add(`Médium de « ${w.title} »`);
  if (!text) TODOS.add(`Texte de présentation de « ${w.title} » (fr, en, ru)`);
  if (w.category === 'masterclass' && !place) TODOS.add(`Lieu de « ${w.title} »`);

  const facts = [
    [s.work.category, esc(s.categories[w.category])],
    [s.work.year, w.year ? esc(w.year) : todo(lang, `Année de « ${w.title} »`)],
    ...(w.category === 'masterclass'
      ? [[s.work.place, place ? esc(place) : todo(lang, `Lieu de « ${w.title} »`)]]
      : [[s.work.medium, medium ? esc(medium) : todo(lang, `Médium de « ${w.title} »`)]]),
  ];

  const body = `
<article>
  <header class="work-hero">
    ${w.image ? picture(w.image, lang, { eager: true }) : swatch(w.tone, lang)}
    <p class="watermark watermark--light" aria-hidden="true">${pad2(num)}</p>
    <div class="work-hero__caption">
      <nav class="crumbs eyebrow" aria-label="${esc(s.work.crumbs)}"><a href="${path(lang, 'work')}">${esc(s.work.eyebrow)}</a> <span aria-hidden="true">/</span> <a href="${catPath(lang, w.category)}">${esc(s.categories[w.category])}</a>${w.year ? ` <span aria-hidden="true">·</span> ${esc(w.year)}` : ''}</nav>
      <h1>${esc(w.title)}</h1>
    </div>
  </header>
  <div class="work-body">
    <dl class="facts">${facts.map(([k, v]) => `<div><dt class="eyebrow">${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <div class="work-text">${text ? (Array.isArray(text) ? text : [text]).map(p => `<p>${esc(p)}</p>`).join('') : `<p class="todo-block">${esc(s.work.textTodo)}</p>`}</div>
  </div>
</article>
<p class="back-link"><a class="eyebrow link-line" href="${catPath(lang, w.category)}"><span aria-hidden="true">←</span> ${esc(s.work.backCat(s.categories[w.category]))}</a></p>
<a class="next-work on-dark" href="${workPath(lang, next)}" style="margin-top:clamp(64px,8vw,120px)">
  <span class="glow" aria-hidden="true"></span>
  <span class="eyebrow">${esc(s.work.next)} · ${esc(s.categories[w.category])} ${num % inCat.length + 1}/${inCat.length}</span>
  <span class="next-work__title" style="display:block">${esc(next.title)} ${ARROW}</span>
</a>`;

  const url = `${SITE_URL}${workPath(lang, w)}`;
  const creator = { '@id': `${SITE_URL}/#lamyne-m` };
  const ld = w.category === 'masterclass'
    ? {
      '@type': 'EducationEvent', name: w.title, url, inLanguage: lang, performer: creator, organizer: creator,
      ...(place ? { location: { '@type': 'Place', name: place } } : {}),
      ...(w.year ? { startDate: w.year } : {}),
    }
    : {
      '@type': 'VisualArtwork', name: w.title, url, inLanguage: lang, creator,
      artform: s.categories[w.category],
      ...(medium ? { artMedium: medium } : {}),
      ...(w.year ? { dateCreated: w.year } : {}),
      ...(text ? { description: Array.isArray(text) ? text[0] : text } : {}),
      ...(w.image ? { image: `${SITE_URL}/assets/img/${w.image}-og.jpg` } : {}),
    };

  const desc = text
    ? (Array.isArray(text) ? text[0] : text).slice(0, 155)
    : `${w.title} — ${medium || s.categories[w.category]}, Lamyne M.`;

  page({
    lang, route: 'work', slug: w.slug, alternates: Object.fromEntries(LANGS.map(l => [l, workPath(l, w)])), xDefault: workPath(DEFAULT_LANG, w),
    current: 'work', over: true, ogType: 'article', ogImage: w.image || undefined,
    title: `${w.title} — Lamyne M`, description: desc, body,
    jsonld: [ld, personLd(lang)],
  });
}

function renderExhibitions(lang) {
  const s = STRINGS[lang];
  const sv = EXHIBITIONS.find(e => e.image);
  const body = `
<div class="page-intro">
  <p class="watermark" aria-hidden="true">04</p>
  ${label(s.exhibitions.eyebrow)}
  <h1>${esc(s.exhibitions.heading)}</h1>
  <p>${esc(s.exhibitions.intro)}</p>
</div>
${sv ? `<figure class="ex-feature reveal">${picture(sv.image, lang, { sizes: '100vw' })}<figcaption class="eyebrow">${esc(tr(sv.title, lang))} · ${esc(sv.year)}</figcaption></figure>` : ''}
<section class="section ex-page" style="padding-top:0" aria-label="${esc(s.exhibitions.eyebrow)}">
  ${exList(lang, { detailed: true })}
  <ul class="countries">${COUNTRIES[lang].map(c => `<li class="eyebrow">${esc(c)}</li>`).join('')}</ul>
</section>`;

  const events = EXHIBITIONS.filter(e => e.type === 'exhibition').map(e => ({
    '@type': 'ExhibitionEvent',
    name: tr(e.title, lang),
    ...(e.year ? { startDate: e.year } : {}),
    location: {
      '@type': 'Place', name: e.venue,
      address: { '@type': 'PostalAddress', addressLocality: tr(e.city, lang), addressCountry: tr(e.country, lang) },
    },
    ...(tr(e.detail, lang) ? { description: tr(e.detail, lang) } : {}),
    ...(e.image ? { image: `${SITE_URL}/assets/img/${e.image}-og.jpg` } : {}),
    performer: { '@id': `${SITE_URL}/#lamyne-m` },
    url: `${SITE_URL}${path(lang, 'exhibitions')}#${e.id}`,
  }));

  page({
    lang, route: 'exhibitions', alternates: alts('exhibitions'), xDefault: path(DEFAULT_LANG, 'exhibitions'), current: 'exhibitions',
    title: s.exhibitions.title, description: s.exhibitions.description, body,
    jsonld: [...events, personLd(lang)],
  });
}

function renderAbout(lang) {
  const s = STRINGS[lang], a = s.about;
  const cvList = types => `<ul class="ex-list">${EXHIBITIONS.filter(e => types.includes(e.type)).map(e =>
    `<li class="ex-item"><div class="ex-item__main"><span class="ex-year">${e.year ? esc(e.year) : '<span aria-hidden="true">—</span>'}</span><span class="ex-title">${esc(tr(e.title, lang))}</span></div><p class="eyebrow">${esc(tr(e.city, lang))}, ${esc(tr(e.country, lang))}</p></li>`).join('')}</ul>`;
  if (!BIO.approach) TODOS.add('Texte de démarche artistique (page À propos)');
  if (!BIO.residencies) TODOS.add('Liste des résidences (CV)');
  TODOS.add('Portrait de l’artiste');

  const approach = tr(BIO.approach, lang);
  const body = `
<div class="page-intro">
  <p class="watermark" aria-hidden="true">02</p>
  ${label(a.eyebrow)}
  <h1>${esc(a.heading)}</h1>
  <p>${esc(s.tagline)} — ${esc(s.disciplines)}</p>
</div>
<div class="about-grid">
  <div class="artist__media reveal">${swatch(['#e0a06a', '#a2643a', '#2a1810'], lang)}</div>
  <div>
    <section class="about-block reveal" aria-labelledby="bio-t">
      ${label(a.bioTitle, { tag: 'h2', id: 'bio-t' })}
      <p class="h-lead">${esc(s.home.artistLead)}</p>
      <p>${esc(s.home.artistBody)}</p>
    </section>
    <section class="about-block reveal" aria-labelledby="app-t">
      ${label(a.approachTitle, { tag: 'h2', id: 'app-t' })}
      <p>${esc(a.approachLead)}</p>
      ${approach ? (Array.isArray(approach) ? approach : [approach]).map(p => `<p>${esc(p)}</p>`).join('') : `<p class="todo-block">${esc(s.work.textTodo)}</p>`}
    </section>
  </div>
</div>
<section class="cv" aria-labelledby="cv-t">
  <div class="section__head">${label(a.cvTitle)}<h2 class="h-section" id="cv-t">${esc(a.cvTitle)} — Lamyne M</h2></div>
  <dl class="facts" style="max-width:560px;margin-bottom:56px">
    <div><dt class="eyebrow">${esc(a.bornLabel)}</dt><dd>${esc(BIO.born)}, ${esc(tr(BIO.birthplace, lang))}</dd></div>
    <div><dt class="eyebrow">${esc(a.basedLabel)}</dt><dd>${esc(tr(BIO.basedIn, lang))}</dd></div>
  </dl>
  <div class="cv-group"><h3 class="eyebrow">${esc(a.cvExhibitions)}</h3>${cvList(['exhibition', 'event'])}</div>
  <div class="cv-group"><h3 class="eyebrow">${esc(a.cvCollections)}</h3>${cvList(['collection'])}</div>
  <div class="cv-group"><h3 class="eyebrow">${esc(a.cvRepresentation)}</h3>${cvList(['representation'])}</div>
  <div class="cv-group"><h3 class="eyebrow">${esc(a.cvResidencies)}</h3>${BIO.residencies ? '' : todo(lang, 'Liste des résidences (CV)')}</div>
</section>`;

  page({
    lang, route: 'about', alternates: alts('about'), xDefault: path(DEFAULT_LANG, 'about'), current: 'about', ogType: 'profile',
    title: a.title, description: a.description, body,
    jsonld: [{ '@type': 'ProfilePage', url: `${SITE_URL}${path(lang, 'about')}`, inLanguage: lang, mainEntity: { '@id': `${SITE_URL}/#lamyne-m` } }, personLd(lang)],
  });
}

function renderPress(lang) {
  const s = STRINGS[lang], p = s.press;
  const body = `
<div class="page-intro">
  <p class="watermark" aria-hidden="true">06</p>
  ${label(p.eyebrow)}
  <h1>${esc(p.heading)}</h1>
</div>
<section class="section" style="padding-top:0" aria-label="${esc(p.eyebrow)}">
  <ul class="press-list">${PRESS.map(x => {
    if (!x.url) TODOS.add(`Lien presse : ${x.name}`);
    return `<li class="reveal"><span class="name">${esc(x.name)}</span>${x.url
      ? `<a class="eyebrow link-line" href="${esc(x.url)}" rel="noopener" target="_blank">${esc(p.read)} ${ARROW}</a>`
      : `<span class="todo">${esc(p.linkTodo)}</span>`}</li>`;
  }).join('')}</ul>
  ${pressKit(lang)}
  <p style="margin-top:48px"><span class="eyebrow">${esc(p.contactPress)} — </span><a class="link-line" href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a></p>
</section>`;
  page({
    lang, route: 'press', alternates: alts('press'), xDefault: path(DEFAULT_LANG, 'press'), current: 'press',
    title: p.title, description: p.description, body,
  });
}

// --- Racine (choix de langue / x-default) et 404 ----------------------------

function bareDoc({ title, description, lang, body, extraHead = '', robots = '' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">\n` : ''}${robots}<meta name="theme-color" content="#140805">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref('ru')}">
<link rel="stylesheet" href="/assets/css/main.css?v=${ASSET_V.css}">
${extraHead}</head>
<body class="on-dark" style="background:var(--night-2);color:var(--ivory)">
${body}
</body>
</html>
`;
}

function langLinks(to) {
  return `<ul>${LANGS.map(l => `<li><a href="${to(l)}" hreflang="${l}" lang="${l}" data-lang="${l}">${esc(STRINGS[l].langName)}</a></li>`).join('')}</ul>`;
}

function renderRoot() {
  const alternates = Object.fromEntries(LANGS.map(l => [l, `/${l}/`]));
  const redirect = `<script>(function(){var L=${JSON.stringify(LANGS)},p=null;try{p=localStorage.getItem('lang')}catch(e){}
if(L.indexOf(p)<0){var n=navigator.languages||[navigator.language||''];for(var i=0;i<n.length&&!p;i++){var c=String(n[i]).slice(0,2).toLowerCase();if(L.indexOf(c)>=0)p=c}}
location.replace('/'+(p&&L.indexOf(p)>=0?p:${JSON.stringify(DEFAULT_LANG)})+'/')})()</script>
`;
  const head = `<link rel="canonical" href="${SITE_URL}/">
${LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}${alternates[l]}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${SITE_URL}/">
${redirect}`;
  writeFileSync(join(OUT, 'index.html'), bareDoc({
    lang: DEFAULT_LANG,
    title: 'Lamyne M',
    description: STRINGS.fr.home.description,
    extraHead: head,
    body: `<main class="bare"><p class="eyebrow">LAMYNE M</p><h1>${LANGS.map(l => `<span lang="${l}" style="display:block">${esc(STRINGS[l].tagline)}</span>`).join('')}</h1>${langLinks(l => `/${l}/`)}</main>`,
  }));
}

function render404() {
  const body = `<main class="bare"><p class="eyebrow">404 — LAMYNE M</p>
<h1>${LANGS.map(l => `<span lang="${l}" style="display:block">${esc(STRINGS[l].notFound.heading)}</span>`).join('')}</h1>
${langLinks(l => `/${l}/`)}</main>`;
  writeFileSync(join(OUT, '404.html'), bareDoc({
    lang: DEFAULT_LANG, title: STRINGS.fr.notFound.title, body, robots: '<meta name="robots" content="noindex">\n',
  }));
}

function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];
  const seen = new Set();
  for (const e of SITEMAP) {
    const loc = `${SITE_URL}${e.alternates[e.lang]}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    urls.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
${LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}${e.alternates[l]}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${e.xDefault}"/>
  </url>`);
  }
  writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`);
  writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

// --- Build -----------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), {
  recursive: true,
  filter: src => !src.endsWith('manifest.json'),
});
if (existsSync(join(SRC, 'static'))) cpSync(join(SRC, 'static'), OUT, { recursive: true });

for (const lang of LANGS) {
  renderHome(lang);
  renderWorkIndex(lang);
  CATEGORIES.forEach(c => renderCategory(c, lang));
  WORKS.forEach(w => renderWork(w, lang));
  renderExhibitions(lang);
  renderAbout(lang);
  renderPress(lang);
}
renderRoot();
render404();
renderSitemap();

console.log(`✓ ${SITEMAP.length} pages générées dans dist/ (${LANGS.join(', ')})`);
const todoList = [...TODOS].sort((a, b) => a.localeCompare(b, 'fr'));
writeFileSync(join(ROOT, 'A-COMPLETER.md'), `# Informations à fournir par Lamyne M

Généré automatiquement par \`node build.mjs\` — ne pas éditer à la main.
Chaque ligne correspond à un espace affiché « à compléter » sur le site.
Compléter \`src/content/site.mjs\` (et \`src/originals/\` pour les photos), puis relancer le build.

${todoList.map(t => `- [ ] ${t}`).join('\n')}
`);
if (todoList.length) console.log(`⚠ ${todoList.length} information(s) à fournir — voir A-COMPLETER.md`);
