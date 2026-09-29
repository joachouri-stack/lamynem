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
  ARTIST_PHOTO, BIO, CONTACT, COUNTRIES, DEFAULT_LANG, EXHIBITIONS, FEATURED_ROBES, HERO, IMAGES, LANGS,
  MOTION_VIDEO, PRESS, PRESS_KIT, ROUTES, SITE_URL, WORKS,
} from './src/content/site.mjs';
import { STRINGS } from './src/content/i18n.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist');
const MANIFEST = JSON.parse(readFileSync(join(SRC, 'assets/img/manifest.json'), 'utf8'));
const LOCALES = { fr: 'fr_FR', en: 'en_US', ru: 'ru_RU' };
const TODOS = new Set();
// Version publique (par défaut) : aucun marqueur « à compléter » n'est affiché,
// un champ manquant disparaît simplement. `node build.mjs --preview` les montre,
// pour relire le site. A-COMPLETER.md est généré dans les deux cas.
const SHOW_TODO = process.argv.includes('--preview');

// --- Utilitaires ---------------------------------------------------------

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Valeur localisée : objet {fr,en,ru} ou chaîne invariable. */
const tr = (v, lang) => (v && typeof v === 'object' && !Array.isArray(v) ? v[lang] : v);

/** Note un champ manquant et renvoie le marqueur visible « à compléter ». */
function todo(lang, what) {
  TODOS.add(what);
  return SHOW_TODO ? `<span class="todo">${esc(STRINGS[lang].todo)}</span>` : '';
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

/** Photo de couverture réservée au mobile : <source media> seulement, l'<img> de repli
 *  est une image vide, donc rien n'est téléchargé sur ordinateur. */
function heroMobile(lang) {
  const key = HERO.mobileImage;
  if (!key || HERO.image) return '';
  const m = MANIFEST[key];
  const base = `/assets/img/${key}`;
  const set = ext => m.widths.map(w => `${base}-${w}.${ext} ${w}w`).join(', ');
  const q = '(max-width: 720px)';
  return `<picture class="hero__mobile">`
    + `<source media="${q}" type="image/avif" srcset="${set('avif')}" sizes="100vw">`
    + `<source media="${q}" type="image/webp" srcset="${set('webp')}" sizes="100vw">`
    + `<source media="${q}" srcset="${set('jpg')}" sizes="100vw">`
    + `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="${esc(tr(IMAGES[key]?.alt, lang) || '')}" width="${m.width}" height="${m.height}" fetchpriority="high" decoding="async" style="object-position:${HERO.mobileFocus}">`
    + '</picture>';
}

/** Aplat coloré de remplacement quand la photo d'une œuvre n'est pas encore fournie. */
function swatch(tone, lang, note = true) {
  const [c1, c2, c3] = tone;
  return `<div class="swatch" style="--c1:${c1};--c2:${c2};--c3:${c3}"><div class="swatch__inner"></div><div class="grain"></div>`
    + (note && SHOW_TODO ? `<p class="eyebrow swatch__note">${esc(STRINGS[lang].visualTodo)}</p>` : '') + '</div>';
}

function workMedia(w, lang, sizes) {
  if (w.image) return picture(w.image, lang, { sizes });
  TODOS.add(`Photo de l'œuvre « ${w.title} »`);
  return swatch(w.tone, lang);
}

function workCard(w, lang, num) {
  const s = STRINGS[lang];
  // Sous le titre, seulement ce qui n'est pas déjà la catégorie de la page :
  // la technique (ex. Installation) ou, pour une masterclass, le lieu.
  const medium = tr(w.medium, lang);
  const kind = w.category === 'masterclass' ? tr(w.place, lang)
    : medium && medium.toLowerCase() !== s.categories[w.category].toLowerCase() ? medium : '';
  // Sans photo : sur mobile, la carte devient une ligne compacte (voir main.css).
  return `<a class="card reveal${w.image ? '' : ' card--noimg'}" href="${workPath(lang, w)}">`
    + `<div class="card__media">${workMedia(w, lang, '(max-width: 720px) 100vw, 50vw')}`
    + (num ? `<span class="card__big" aria-hidden="true">${num}</span>` : '')
    + `<span class="eyebrow card__view" aria-hidden="true">${esc(s.work.view)} →</span></div>`
    + `<div class="card__meta"><h3 class="card__title">${esc(w.title)}</h3>`
    + (kind ? `<p class="eyebrow">${esc(kind)}</p>` : '') + '</div></a>';
}

/** Robe verticale des « Œuvres sélectionnées » : lien vers l'œuvre dès qu'elle est confirmée. */
function robeCard(r, lang, num) {
  const s = STRINGS[lang];
  const w = r.work && workBySlug(r.work);
  if (!w) TODOS.add(`Œuvres sélectionnées : titre de l’œuvre (${r.label}), lieu et crédit photo`);
  const title = w ? esc(w.title) : SHOW_TODO ? `<span class="todo">${esc(s.todo)}</span>` : '';
  const inner = `<div class="robe__media">${picture(r.image, lang, { sizes: '(max-width: 1024px) 50vw, 26vw' })}</div>`
    + `<div class="robe__meta"><span class="robe__num">${num}</span>${title ? `<h3 class="robe__title">${title}</h3>` : ''}`
    + `<p class="eyebrow">${esc(tr(r.medium, lang))}</p></div>`;
  // Sur mobile, la robe déjà affichée en couverture n'est pas répétée dans le carrousel.
  const cls = `robe reveal${!HERO.image && r.image === HERO.mobileImage ? ' robe--hero' : ''}`;
  return w
    ? `<a class="${cls}" href="${workPath(lang, w)}">${inner}</a>`
    : `<div class="${cls}">${inner}</div>`;
}

// --- Gabarit commun -------------------------------------------------------

function langSwitch(lang, alternates, extraCls = '') {
  const s = STRINGS[lang];
  return `<nav class="lang-switch ${extraCls}" aria-label="${esc(s.langSwitch)}">`
    + LANGS.map(l => `<a href="${alternates[l]}" hreflang="${l}" lang="${l}" data-lang="${l}"${l === lang ? ' aria-current="true"' : ''}>`
      + `<span aria-hidden="true">${l.toUpperCase()}</span><span class="visually-hidden">${esc(STRINGS[l].langName)}</span></a>`).join('')
    + '</nav>';
}

const BRAND_THREAD = '<svg class="brand__thread" viewBox="0 0 120 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M0 4 Q7.5 0 15 4 T30 4 T45 4 T60 4 T75 4 T90 4 T105 4 T120 4"/></svg>';

function header(lang, current, alternates, over) {
  const s = STRINGS[lang], c = s.contact;
  const items = [
    ['work', path(lang, 'work')],
    ['exhibitions', path(lang, 'exhibitions')],
    ['about', path(lang, 'about')],
    ['press', path(lang, 'press')],
    ['contact', '#contact'],
  ];
  const cur = k => (k === current ? ' aria-current="page"' : '');
  const sub = CATEGORIES.map(k => `<li><a href="${catPath(lang, k)}">${esc(s.categories[k])}</a></li>`).join('');
  const deskItem = ([k, href]) => {
    if (k === 'contact') return `<a class="nav-cta" href="${href}">${esc(s.nav[k])} <span aria-hidden="true">→</span></a>`;
    const a = `<a class="nav-link" href="${href}"${cur(k)}>${esc(s.nav[k])}</a>`;
    return k === 'work' ? `<div class="nav-drop">${a}<ul class="nav-drop__panel">${sub}</ul></div>` : a;
  };
  const mobSub = CATEGORIES.map(k => `<li><a href="${catPath(lang, k)}">${esc(s.categories[k])} <sup>${WORKS.filter(w => w.category === k).length}</sup></a></li>`).join('');
  const mobItem = ([k, href], i) => `<li style="--i:${i}"><a class="menu-link" href="${href}"${cur(k)}>`
    + `<span class="menu-num" aria-hidden="true">${pad2(i + 1)}</span><span class="menu-label">${esc(s.nav[k])}</span>`
    + `<span class="menu-arrow" aria-hidden="true">→</span></a>`
    + (k === 'work' ? `<ul class="menu-sub">${mobSub}</ul>` : '') + '</li>';
  const menuLang = `<nav class="menu-lang" aria-label="${esc(s.langSwitch)}">`
    + LANGS.map(l => `<a href="${alternates[l]}" hreflang="${l}" lang="${l}" data-lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${esc(STRINGS[l].langName)}</a>`).join('')
    + '</nav>';
  const socials = [['Instagram', CONTACT.instagram], ['Facebook', CONTACT.facebook]].filter(([, u]) => u)
    .map(([n, u]) => `<a href="${esc(u)}" rel="me noopener" target="_blank">${n} <span aria-hidden="true">↗</span><span class="visually-hidden"> ${esc(c.newTab)}</span></a>`).join('');
  const brand = `<a class="brand" href="${path(lang, 'home')}"><span class="brand__name">LAMYNE M</span>${BRAND_THREAD}</a>`;
  return `<header class="site-header${over ? ' site-header--over' : ''}" id="top" data-header>`
    + brand
    + `<div class="nav-desktop"><nav aria-label="${esc(s.mainNav)}" class="nav-links">${items.map(deskItem).join('')}</nav>`
    + `<span class="nav-sep" aria-hidden="true"></span>${langSwitch(lang, alternates)}</div>`
    + `<div class="header-mobile">${langSwitch(lang, alternates)}`
    + `<button class="burger" type="button" data-menu-open aria-expanded="false" aria-controls="menu"><span class="burger__label">${esc(s.menu)}</span><span class="burger__lines" aria-hidden="true"><span></span><span></span></span></button></div>`
    + '<span class="site-header__progress" aria-hidden="true"></span>'
    + '</header>'
    + `<div class="menu-overlay on-dark" id="menu" role="dialog" aria-modal="true" aria-label="${esc(s.menu)}" inert>`
    + '<div class="glow" aria-hidden="true"></div><div class="grain" aria-hidden="true"></div>'
    + '<p class="menu-mark" aria-hidden="true">M</p>'
    + `<div class="menu-overlay__top">${brand}`
    + `<button class="menu-close" type="button" data-menu-close><span class="menu-close__label">${esc(s.close)}</span><span class="menu-close__icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 18 18"><path d="M1 1l16 16M17 1L1 17" stroke="currentColor" stroke-width="1.2"/></svg></span></button></div>`
    + `<p class="eyebrow menu-tagline">${esc(s.tagline)}</p>`
    + `<nav class="menu-nav" aria-label="${esc(s.mainNav)}"><ul>${items.map(mobItem).join('')}</ul></nav>`
    + `<div class="menu-foot"><p class="eyebrow">${esc(c.write)}</p>`
    + `<a class="menu-mail" href="mailto:${CONTACT.email}">${esc(CONTACT.email)} <span aria-hidden="true">→</span></a>`
    + (socials ? `<p class="menu-social">${socials}</p>` : '')
    + menuLang + '</div>'
    + '<svg class="menu-thread" viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M0 6 Q12.5 0 25 6 T50 6 T75 6 T100 6 T125 6 T150 6 T175 6 T200 6 T225 6 T250 6 T275 6 T300 6 T325 6 T350 6 T375 6 T400 6"/></svg>'
    + '</div>';
}

/** Fil cousu (vague en pointillés) qui traverse le pied de page — clin d'œil au textile. */
function stitchLine() {
  let d = 'M0 12';
  for (let x = 0; x < 1200; x += 60) d += ` Q${x + 15} 2 ${x + 30} 12 T${x + 60} 12`;
  return `<svg class="stitch" viewBox="0 0 1200 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
    + `<path class="stitch__thread" d="${d}"/><path class="stitch__dash" d="${d}"/></svg>`;
}

function contactFooter(lang, alternates) {
  const s = STRINGS[lang], c = s.contact;
  const socials = [['Instagram', CONTACT.instagram], ['Facebook', CONTACT.facebook]];
  socials.forEach(([n, u]) => { if (!u) TODOS.add(`URL du profil ${n}`); });
  const socialLinks = socials.filter(([, u]) => u)
    .map(([n, u]) => `<li><a href="${esc(u)}" rel="me noopener" target="_blank">${n} <span aria-hidden="true">↗</span><span class="visually-hidden"> ${esc(c.newTab)}</span></a></li>`).join('');
  const col = (title, items) => `<div class="foot-col"><p class="eyebrow">${esc(title)}</p><ul>${items}</ul></div>`;
  const li = (href, text) => `<li><a href="${href}">${esc(text)}</a></li>`;
  return `<footer class="section section--dark contact on-dark" id="contact" aria-labelledby="contact-title">`
    + '<div class="glow" aria-hidden="true"></div><div class="glow glow--b" aria-hidden="true"></div><div class="grain" aria-hidden="true"></div>'
    + `<div class="contact__top">${label(c.eyebrow, { tag: 'h2', id: 'contact-title' })}`
    + `<p class="contact__lines">${esc(c.lines)}<span>${esc(c.accent)}</span></p></div>`
    + `<a class="contact__mail" href="mailto:${CONTACT.email}">`
    + `<span class="eyebrow contact__mail-label">${esc(c.write)}</span>`
    + `<span class="contact__mail-addr">${esc(CONTACT.email)}</span>`
    + `<span class="contact__mail-arrow" aria-hidden="true">→</span></a>`
    + stitchLine()
    + `<div class="foot-grid">`
    + `<nav aria-label="${esc(c.explore)}">${col(c.explore, li(path(lang, 'work'), s.nav.work) + li(path(lang, 'exhibitions'), s.nav.exhibitions) + li(path(lang, 'about'), s.nav.about) + li(path(lang, 'press'), s.nav.press))}</nav>`
    + `<nav class="foot-cats" aria-label="${esc(s.work.browse)}">${col(s.nav.work, CATEGORIES.map(k => li(catPath(lang, k), s.categories[k])).join(''))}</nav>`
    + col(c.eyebrow, `<li><a href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a></li><li>${esc(c.basedLine(tr(CONTACT.location, lang))).replace(/(Saint-Denis|Сен-Дени)/, '<span class="nobr">$1</span>')}</li>`)
    + col(c.social, socialLinks || `<li>${todo(lang, 'Liens réseaux sociaux')}</li>`)
    + '</div>'
    + '<p class="wordmark" aria-hidden="true">LAMYNE M</p>'
    + `<div class="site-foot"><p class="eyebrow">© ${new Date().getFullYear()} Lamyne M</p>`
    + `<p class="eyebrow site-credit">Design by Johane A.</p>`
    + `${langSwitch(lang, alternates)}`
    + `<a class="eyebrow to-top" href="#top">${esc(c.top)} <span aria-hidden="true">↑</span></a></div>`
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
${fabric ? `<script>(function(h){try{var c=navigator.connection;if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!(c&&c.saveData)){h.classList.add('has-fabric');try{if(!sessionStorage.getItem('entered'))h.classList.add('needs-enter')}catch(e){}}}catch(e){}})(document.documentElement)</script>\n` : ''}<script src="/assets/js/main.js?v=${ASSET_V.main}" defer></script>
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
  const secondeVie = EXHIBITIONS.find(e => e.id === 'seconde-vie');
  if (ARTIST_PHOTO.image) TODOS.add('Bloc « L’artiste » : confirmer que la personne photographiée est Lamyne M, et le crédit photo');
  if (!HERO.image) TODOS.add('Photo de couverture de l’accueil en haute définition (≥ 3000 px de large), avec titre, lieu et crédit');

  const video = MOTION_VIDEO
    ? `<button class="video__play" type="button" data-video="/assets/${esc(MOTION_VIDEO.src)}"${MOTION_VIDEO.poster ? ` data-poster="/assets/${esc(MOTION_VIDEO.poster)}"` : ''} aria-label="${esc(s.home.play)} — ${esc(tr(MOTION_VIDEO.title, lang) || '')}"></button>`
    : (TODOS.add('Vidéo « Art in Motion »'), SHOW_TODO ? `<span class="video__play" aria-hidden="true"></span><p class="eyebrow video__note">[${esc(h.videoTodo)}]</p>` : '');

  // Écran « Entrer » : affiché seulement si le rideau est actif (classe posée dans <head>).
  // Le clic est le geste qui autorise le son du rideau.
  const enter = `<div class="enter" data-enter role="dialog" aria-modal="true" aria-labelledby="enter-t">
  <div class="enter__inner">
    <svg class="enter__thread" viewBox="0 0 64 10" aria-hidden="true"><path d="M1 5c5 0 5-4 10-4s5 8 10 8 5-8 10-8 5 8 10 8 5-8 10-8 5 4 12 4"/></svg>
    <p class="enter__name" id="enter-t">LAMYNE M</p>
    <p class="eyebrow enter__tag">${esc(s.tagline)}</p>
    <button class="enter__btn" type="button" data-enter-btn><span>${esc(s.enter)}</span></button>
  </div>
</div>`;

  const body = `${enter}
<section class="hero${HERO.image ? '' : ' hero--plain'}" data-hero data-header-over aria-labelledby="hero-title">
  <div class="hero__stage">
    ${HERO.image ? picture(HERO.image, lang, { eager: true, cls: 'hero__media', style: `object-position:${HERO.focus}` }) : heroMobile(lang)}
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
  <div class="robes" data-carousel>
    ${FEATURED_ROBES.map((r, i) => robeCard(r, lang, roman(i + 2))).join('\n    ')}
  </div>
  <div class="carousel-bar" aria-hidden="true"><span class="carousel-bar__count" data-carousel-count>1 / ${FEATURED_ROBES.filter(r => HERO.image || r.image !== HERO.mobileImage).length}</span><span class="carousel-bar__track"><span class="carousel-bar__fill" data-carousel-fill></span></span></div>
  <div class="works-more"><a class="eyebrow link-line" href="${path(lang, 'work')}">${esc(h.allWorks)} ${ARROW}</a></div>
</section>

<section class="section artist" aria-labelledby="artist-title">
  <figure class="artist__figure reveal">
    <div class="artist__mat"><div class="artist__frame">${ARTIST_PHOTO.image
      ? picture(ARTIST_PHOTO.image, lang, { sizes: '(max-width: 860px) 100vw, 40vw', style: `object-position:${ARTIST_PHOTO.focus}` })
      : swatch(['#e0a06a', '#a2643a', '#2a1810'], lang)}</div></div>
    <figcaption class="eyebrow artist__route">${esc(h.artistRoute)}</figcaption>
  </figure>
  <div class="artist__text reveal">
    <p class="watermark" aria-hidden="true">02</p>
    ${label(h.artistEyebrow, { tag: 'h2', id: 'artist-title' })}
    <p class="h-lead artist__lead">${esc(h.artistLead)}</p>
    <dl class="artist__facts">${h.artistFacts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="eyebrow">${esc(v)}</dd></div>`).join('')}</dl>
    <div class="artist__themes">
      <p class="eyebrow">${esc(h.artistThemesLabel)}</p>
      <ul>${h.artistThemes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    </div>
    <a class="artist__cta" href="${path(lang, 'about')}">${esc(h.artistCta)} <span aria-hidden="true">→</span></a>
  </div>
</section>

<section class="section section--dark motion on-dark" aria-labelledby="motion-title">
  <div class="glow" aria-hidden="true"></div>
  <p class="watermark" aria-hidden="true">03</p>
  <div class="section__head motion__head">
    ${label(h.motionEyebrow, { tag: 'h2', id: 'motion-title' })}
    <p class="motion__title">${esc(h.motionTitle)}</p>
  </div>
  <div class="motion__grid">
    <div class="video reveal${MOTION_VIDEO ? '' : ' video--empty'}">
      ${motionWaves()}
      <div class="grain" aria-hidden="true"></div>
      <span class="video__corner video__corner--tl" aria-hidden="true"></span><span class="video__corner video__corner--br" aria-hidden="true"></span>
      ${motionRing(h.motionRing)}
      ${video}
    </div>
    <nav class="motion__prog" aria-label="${esc(h.motionProgramme)}">
      <p class="eyebrow">${esc(h.motionProgramme)}</p>
      <ol>${WORKS.filter(w => w.category === 'performance').map((w, i) =>
        `<li><a href="${workPath(lang, w)}"><span class="motion__num">${pad2(i + 1)}</span><span class="motion__name">${esc(w.title)}</span><span class="motion__arrow" aria-hidden="true">→</span></a></li>`).join('')}</ol>
      <a class="eyebrow link-line" href="${catPath(lang, 'performance')}">${esc(h.motionAll)} ${ARROW}</a>
    </nav>
  </div>
</section>

<section class="section exhibitions" aria-labelledby="ex-title">
  <p class="watermark" aria-hidden="true">04</p>
  <div class="ex-home">
    <div class="ex-home__aside">
      ${label(h.exhibitionsEyebrow)}
      <h2 class="h-section" id="ex-title">${esc(h.exhibitionsTitle)}</h2>
      <p class="ex-home__intro">${esc(h.exhibitionsIntro)}</p>
      <a class="eyebrow link-line" href="${path(lang, 'exhibitions')}">${esc(h.allExhibitions)} ${ARROW}</a>
    </div>
    <div class="ex-home__list">
      ${exTimeline(lang)}
      <a class="eyebrow link-line ex-home__more" href="${path(lang, 'exhibitions')}">${esc(h.allExhibitions)} ${ARROW}</a>
    </div>
  </div>
  <div class="territories">
    <p class="eyebrow">${esc(h.territories)}</p>
    <ul>${COUNTRIES[lang].map((c, i) => `<li>${i ? THREAD : ''}<span>${esc(c)}</span></li>`).join('')}</ul>
  </div>
</section>

<section class="section section--sand masterclass" aria-labelledby="mc-title">
  <p class="watermark" aria-hidden="true">05</p>
  <div class="mc-top">
    <div class="mc-top__text">
      ${label(h.masterclassEyebrow, { tag: 'h2', id: 'mc-title' })}
      <p class="h-lead">${esc(h.masterclassTitle)}</p>
    </div>
    <ol class="mc-pillars" aria-label="${esc(h.masterclassEyebrow)}">${h.masterclassPillars.map((w, i) => `<li><span class="mc-pillars__num">${pad2(i + 1)}</span><span class="mc-pillars__word">${esc(w)}</span></li>`).join('')}</ol>
  </div>
  <div class="mc-sessions">
    <p class="eyebrow">${esc(h.masterclassSessions)}</p>
    <ul>${WORKS.filter(w => w.category === 'masterclass').map((w, i) => {
      const place = tr(w.place, lang);
      return `<li><a class="mc-session reveal" href="${workPath(lang, w)}">`
        + `<span class="mc-session__num">${roman(i + 1)}</span>`
        + `<span class="mc-session__title">${esc(w.title)}</span>`
        + `<span class="eyebrow mc-session__place">${place ? esc(place) : esc(s.categories.masterclass)}</span>`
        + `<span class="mc-session__arrow" aria-hidden="true">→</span></a></li>`;
    }).join('')}</ul>
  </div>
  <div class="mc-actions">
    <a class="eyebrow link-line" href="${catPath(lang, 'masterclass')}">${esc(h.masterclassCta)} ${ARROW}</a>
    <a class="mc-host" href="mailto:${CONTACT.email}?subject=Masterclass">${esc(h.masterclassHost)} <span aria-hidden="true">→</span></a>
  </div>
</section>

<section class="section press" aria-labelledby="press-title">
  <p class="watermark" aria-hidden="true">06</p>
  <div class="press__head">
    <div>
      ${label(h.pressEyebrow)}
      <h2 class="h-section" id="press-title">${esc(h.pressTitle)}</h2>
    </div>
    <a class="eyebrow link-line" href="${path(lang, 'press')}">${esc(h.pressAll)} ${ARROW}</a>
  </div>
  ${pressMarquee()}
  <div class="press__grid">
    <div class="press__aside">
      <p class="press__intro">${esc(h.pressIntro)}</p>
      <dl class="press__meta">
        ${PRESS_KIT || SHOW_TODO ? `<div><dt class="eyebrow">${esc(h.pressKitLabel)}</dt><dd>${pressKit(lang)}</dd></div>` : (pressKit(lang), '')}
        <div><dt class="eyebrow">${esc(s.press.contactPress)}</dt><dd><a class="link-line" href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a></dd></div>
      </dl>
    </div>
    <ol class="press-rows">${PRESS.map((p, i) => {
      const inner = `<span class="press-row__num">${pad2(i + 1)}</span><span class="press-row__name">${esc(p.name)}</span>`
        + `<span class="press-row__arrow" aria-hidden="true">${p.url ? '↗' : '→'}</span>`;
      return `<li>${p.url
        ? `<a class="press-row" href="${esc(p.url)}" rel="noopener" target="_blank">${inner}<span class="visually-hidden"> ${esc(s.contact.newTab)}</span></a>`
        : `<a class="press-row" href="${path(lang, 'press')}">${inner}</a>`}</li>`;
    }).join('')}</ol>
  </div>
</section>`;

  page({
    lang, route: 'home', alternates, xDefault: '/', current: null, over: true, fabric: true, ogImage: HERO.image || undefined,
    title: h.title, description: h.description, body,
    jsonld: [personLd(lang), { '@type': 'WebSite', name: 'Lamyne M', url: `${SITE_URL}/`, inLanguage: lang }],
  });
}

/** Ondulations de tissu (SVG) qui dérivent lentement derrière le lecteur vidéo. */
function motionWaves() {
  const wave = (y, amp, len) => {
    let d = `M-200 ${y}`;
    for (let x = -200; x < 1600; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
    return d;
  };
  const paths = [[140, 26, 240, .5], [220, 40, 320, .35], [300, 22, 200, .45], [380, 34, 280, .3], [460, 18, 180, .4]]
    .map(([y, a, l, o], i) => `<path class="wave wave--${i % 3}" d="${wave(y, a, l)}" style="opacity:${o}"/>`).join('');
  return `<svg class="video__waves" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** Texte circulaire qui tourne autour du bouton lecture. */
function motionRing(text) {
  const t = esc(text.repeat(2));
  return `<svg class="video__ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><defs><path id="ring-path" d="M100 100 m-78 0 a78 78 0 1 1 156 0 a78 78 0 1 1 -156 0"/></defs>`
    + `<text><textPath href="#ring-path" textLength="488">${t}</textPath></text></svg>`;
}

/** Le lieu figure déjà dans le titre (« Seconde vie — Villa D » / « Villa D ») ? */
function venueInTitle(e, lang) {
  const t = String(tr(e.title, lang) || '').toLowerCase();
  const v = String(e.venue || '').toLowerCase();
  const after = t.split(' — ').pop().replace(/[«»"]/g, '').trim();
  return !!v && (t.includes(v) || (after.length > 3 && v.startsWith(after)));
}

/** Frise des expositions de l'accueil : année, type, titre, lieu ; lien vers la fiche. */
function exTimeline(lang) {
  const s = STRINGS[lang];
  return `<ol class="ex-tl">${EXHIBITIONS.map(e => {
    const detail = tr(e.detail, lang);
    if (!e.year) TODOS.add(`Année : ${tr(e.title, 'fr')}`);
    const thumb = e.image ? `<span class="ex-tl__thumb" aria-hidden="true">${picture(e.image, lang, { sizes: '220px' })}</span>` : '';
    return `<li class="reveal"><a class="ex-tl__item" href="${path(lang, 'exhibitions')}#${e.id}">`
      + `<span class="ex-tl__year">${e.year ? esc(e.year) : '<span aria-hidden="true">—</span>'}</span>`
      + `<span class="ex-tl__dot" aria-hidden="true"></span>`
      + `<span class="ex-tl__body"><span class="eyebrow ex-tl__type">${esc(s.exhibitions.types[e.type])}</span>`
      + `<span class="ex-tl__title">${esc(tr(e.title, lang))}</span>`
      + (detail ? `<span class="ex-tl__detail">${esc(detail)}</span>` : '')
      + `<span class="eyebrow ex-tl__place">${esc(tr(e.city, lang))}, ${esc(tr(e.country, lang))}</span></span>`
      + `<span class="ex-tl__arrow" aria-hidden="true">→</span>${thumb}</a></li>`;
  }).join('')}</ol>`;
}

/** Bandeau défilant des noms (décoratif : la liste accessible est juste en dessous). */
function pressMarquee() {
  const seq = PRESS.map(p => `<span class="press-marquee__name">${esc(p.name)}</span>${THREAD}`).join('');
  return `<div class="press-marquee" aria-hidden="true"><div class="press-marquee__track"><div class="press-marquee__seq">${seq}</div><div class="press-marquee__seq">${seq}</div></div></div>`;
}

function pressKit(lang) {
  const s = STRINGS[lang];
  if (PRESS_KIT) return `<a class="eyebrow press-kit link-line" href="/assets/${esc(PRESS_KIT)}" download>${esc(s.pressKit)} <span aria-hidden="true">↓</span></a>`;
  TODOS.add('Dossier de presse PDF');
  return SHOW_TODO ? `<span class="press-kit"><span class="todo">${esc(s.pressKitTodo)}</span></span>` : '';
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
  const panels = CATEGORIES.map((cat, i) => {
    const list = WORKS.filter(w => w.category === cat);
    const cover = list.find(w => w.image) || list[0];
    return `<li class="practice reveal"><a class="practice__link" href="${catPath(lang, cat)}">
  <span class="practice__media">${cover.image ? picture(cover.image, lang, { sizes: '(max-width: 860px) 100vw, 34vw' }) : swatch(cover.tone, lang, false)}</span>
  <span class="practice__num">${pad2(i + 1)}</span>
  <span class="practice__text">
    <span class="eyebrow practice__count">${esc(s.work.count(list.length))}</span>
    <span class="practice__title">${esc(s.categories[cat])}</span>
    <span class="practice__intro">${esc(s.categoryIntro[cat])}</span>
    <span class="eyebrow practice__cta">${esc(s.work.seeCat(s.categories[cat]))} →</span>
  </span></a></li>`;
  }).join('\n');
  let n = 0;
  const index = CATEGORIES.map(cat => `<li class="w-index__group" aria-hidden="true"><span>${esc(s.categories[cat])}</span><span>${WORKS.filter(w => w.category === cat).length}</span></li>` + WORKS.filter(w => w.category === cat).map(w => {
    n++;
    const kind = tr(w.medium, lang) || s.categories[w.category];
    return `<li><a class="w-index__row" href="${workPath(lang, w)}">`
      + `<span class="w-index__num">${pad2(n)}</span>`
      + `<span class="w-index__title">${esc(w.title)}</span>`
      + `<span class="eyebrow w-index__cat">${esc(s.categories[w.category])}${kind !== s.categories[w.category] ? ` · ${esc(kind)}` : ''}</span>`
      + `<span class="w-index__year${w.year ? '' : ' w-index__year--none'}">${w.year ? esc(w.year) : '<span aria-hidden="true">—</span>'}</span>`
      + `<span class="w-index__arrow" aria-hidden="true">→</span></a></li>`;
  }).join('')).join('');
  const body = `
<div class="page-intro works-intro">
  <p class="watermark" aria-hidden="true">01</p>
  ${label(s.work.eyebrow)}
  <h1>${esc(s.work.heading)}</h1>
  <p>${esc(s.work.intro(WORKS.length))}</p>
</div>
${catNav(lang, null)}
<section class="practices" aria-label="${esc(s.work.practices)}">
  <ol class="practices__list" data-carousel>
${panels}
  </ol>
  <div class="carousel-bar" aria-hidden="true"><span class="carousel-bar__count" data-carousel-count>1 / ${CATEGORIES.length}</span><span class="carousel-bar__track"><span class="carousel-bar__fill" data-carousel-fill></span></span></div>
</section>
<section class="w-index" aria-labelledby="w-index-t">
  <div class="w-index__head">${label(s.work.eyebrow)}<h2 class="h-section" id="w-index-t">${esc(s.work.indexTitle)}</h2></div>
  <ol class="w-index__list">${index}</ol>
</section>`;
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
      : medium && medium.toLowerCase() === s.categories[w.category].toLowerCase()
        ? [] // technique = catégorie (ex. Performance) : pas de redite
        : [[s.work.medium, medium ? esc(medium) : todo(lang, `Médium de « ${w.title} »`)]]),
  ].filter(([, v]) => v);

  const prev = inCat[(num - 2 + inCat.length) % inCat.length];
  const related = inCat.filter(x => x !== w);
  const catName = s.categories[w.category];
  // Ligne sous le titre : ce qu'on sait (technique ou lieu, année), sinon la pratique.
  const sub = [w.category === 'masterclass' ? place : (medium && medium.toLowerCase() !== catName.toLowerCase() ? medium : ''), w.year]
    .filter(Boolean).map(esc).join(' · ') || esc(catName);
  // Fiche technique : uniquement des informations confirmées.
  const specs = [
    [s.work.artist, 'Lamyne M'],
    [s.work.category, esc(catName)],
    ...facts.filter(([k]) => k !== s.work.category),
  ];
  const shown = EXHIBITIONS.filter(e => e.work === w.slug);
  const mail = `mailto:${CONTACT.email}?subject=${encodeURIComponent(`${w.title} — Lamyne M`)}`;
  const paras = text ? (Array.isArray(text) ? text : [text]) : [];
  // Sans photo : une « étoffe » encadrée comme un cartel de galerie, pas un aplat vide.
  const stage = w.image
    ? picture(w.image, lang, { eager: true, sizes: '(max-width: 960px) 100vw, 58vw' })
    : `<div class="etoffe">${swatch(w.tone, lang, false)}<span class="etoffe__frame" aria-hidden="true"></span>`
      + `<span class="etoffe__num" aria-hidden="true">${roman(num)}</span>`
      + `<span class="etoffe__sig" aria-hidden="true">Lamyne M — ${esc(w.title)}</span></div>`;
  const body = `
<article class="pdp">
  <div class="pdp__media">
    <figure class="pdp__stage${w.image ? '' : ' pdp__stage--etoffe'}">${stage}</figure>
  </div>
  <div class="pdp__info">
    <div class="pdp__panel">
      <div class="pdp__top">
        <nav class="crumbs eyebrow" aria-label="${esc(s.work.crumbs)}"><a href="${path(lang, 'work')}">${esc(s.work.eyebrow)}</a> <span aria-hidden="true">/</span> <a href="${catPath(lang, w.category)}">${esc(catName)}</a></nav>
        <div class="pdp__pager">
          <a href="${workPath(lang, prev)}" aria-label="${esc(s.work.prev)} : ${esc(prev.title)}"><span aria-hidden="true">←</span></a>
          <span class="eyebrow">${pad2(num)} <span class="pdp__of">/ ${pad2(inCat.length)}</span></span>
          <a href="${workPath(lang, next)}" aria-label="${esc(s.work.next)} : ${esc(next.title)}"><span aria-hidden="true">→</span></a>
        </div>
      </div>
      <p class="eyebrow pdp__maker">Lamyne M</p>
      <h1 class="pdp__title">${esc(w.title)}</h1>
      <p class="pdp__sub">${sub}</p>
      <div class="pdp__actions">
        <a class="pdp__cta" href="${mail}" data-pdp-cta>${esc(s.work.ask)} <span aria-hidden="true">→</span></a>
        <a class="eyebrow link-line pdp__more" href="${catPath(lang, w.category)}">${esc(s.work.seeCat(catName))} ${ARROW}</a>
      </div>
      <div class="pdp__acc">
        <details open><summary>${esc(s.work.specs)}</summary>
          <dl class="pdp__specs">${specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
        </details>
        ${paras.length ? `<details open><summary>${esc(s.work.about)}</summary><div class="pdp__text">${paras.map(p => `<p>${esc(p)}</p>`).join('')}</div></details>`
          : SHOW_TODO ? `<p class="todo-block">${esc(s.work.textTodo)}</p>` : ''}
        ${shown.length ? `<details><summary>${esc(s.work.shownIn)} <sup>${shown.length}</sup></summary><ul class="pdp__shows">${shown.map(e => `<li><a href="${path(lang, 'exhibitions')}#${e.id}"><span class="pdp__show-t">${esc(tr(e.title, lang))}</span><span class="eyebrow">${e.year ? `${esc(e.year)} · ` : ''}${esc(tr(e.city, lang))}</span></a></li>`).join('')}</ul></details>` : ''}
        <details><summary>${esc(s.work.practice)}</summary><p class="pdp__practice">${esc(s.categoryIntro[w.category])} <a class="link-line" href="${catPath(lang, w.category)}">${esc(s.work.count(inCat.length))}</a></p></details>
      </div>
    </div>
  </div>
</article>
<div class="pdp-bar" data-pdp-bar aria-hidden="true">
  <span class="pdp-bar__t"><span class="eyebrow">${pad2(num)} / ${pad2(inCat.length)}</span>${esc(w.title)}</span>
  <a class="pdp-bar__btn" href="${mail}" tabindex="-1">${esc(s.work.askShort)} <span aria-hidden="true">→</span></a>
</div>
${related.length ? `<section class="related" aria-labelledby="rel-t">
  <div class="related__head">${label(s.work.related, { tag: 'h2', id: 'rel-t' })}<a class="eyebrow link-line" href="${catPath(lang, w.category)}">${esc(s.work.seeCat(s.categories[w.category]))} ${ARROW}</a></div>
  <ul class="related__list" data-carousel>${related.map(x => `<li><a class="related__card" href="${workPath(lang, x)}"><span class="related__media${x.image ? '' : ' related__media--noimg'}">${x.image ? picture(x.image, lang, { sizes: '260px' }) : swatch(x.tone, lang, false)}<span class="related__num" aria-hidden="true">${roman(inCat.indexOf(x) + 1)}</span></span><span class="related__title">${esc(x.title)}</span></a></li>`).join('')}</ul><div class="carousel-bar" aria-hidden="true"><span class="carousel-bar__count" data-carousel-count>1 / ${related.length}</span><span class="carousel-bar__track"><span class="carousel-bar__fill" data-carousel-fill></span></span></div>
</section>` : ''}
<nav class="work-nav on-dark" aria-label="${esc(s.work.browse)}">
  <a class="work-nav__link work-nav__link--prev" href="${workPath(lang, prev)}"><span class="eyebrow"><span aria-hidden="true">←</span> ${esc(s.work.prev)}</span><span class="work-nav__title">${esc(prev.title)}</span></a>
  <a class="work-nav__link work-nav__link--next" href="${workPath(lang, next)}"><span class="eyebrow">${esc(s.work.next)} <span aria-hidden="true">→</span></span><span class="work-nav__title">${esc(next.title)}</span></a>
</nav>`;

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
    current: 'work', ogType: 'article', ogImage: w.image || undefined,
    title: `${w.title} — Lamyne M`, description: desc, body,
    jsonld: [ld, personLd(lang)],
  });
}

function renderExhibitions(lang) {
  const s = STRINGS[lang], x = s.exhibitions;
  const sv = EXHIBITIONS.find(e => e.image);
  const types = [...new Set(EXHIBITIONS.map(e => e.type))];
  const yearOf = e => (e.year ? esc(e.year) : '<span aria-hidden="true">—</span>');
  const placeOf = e => `${esc(tr(e.city, lang))}, ${esc(tr(e.country, lang))}`;

  const feature = sv ? `
<article class="ex-hl reveal" aria-labelledby="hl-${sv.id}">
  <a class="ex-hl__media" href="#${sv.id}" tabindex="-1" aria-hidden="true">${picture(sv.image, lang, { sizes: '(max-width: 860px) 100vw, 58vw' })}</a>
  <div class="ex-hl__text">
    <p class="eyebrow ex-hl__kicker">${esc(x.featured)} · ${esc(x.types[sv.type])}</p>
    <p class="ex-hl__year">${yearOf(sv)}</p>
    <h2 class="ex-hl__title" id="hl-${sv.id}">${esc(tr(sv.title, lang))}</h2>
    ${tr(sv.detail, lang) ? `<p class="ex-hl__detail">${esc(tr(sv.detail, lang))}</p>` : ''}
    <dl class="ex-hl__meta"><div><dt class="eyebrow">${esc(x.venue)}</dt><dd>${esc(sv.venue)} — ${placeOf(sv)}</dd></div></dl>
  </div>
</article>` : '';

  const rows = EXHIBITIONS.map((e, i) => {
    const detail = tr(e.detail, lang);
    const work = e.work && workBySlug(e.work);
    return `<li class="ex-card reveal" id="${e.id}" data-type="${e.type}">
  <span class="ex-card__num">${pad2(i + 1)}</span>
  <span class="ex-card__year${e.year ? '' : ' ex-card__year--none'}">${yearOf(e)}</span>
  <div class="ex-card__body">
    <p class="eyebrow ex-card__type">${esc(x.types[e.type])}</p>
    <h2 class="ex-card__title">${esc(tr(e.title, lang))}</h2>
    ${detail ? `<p class="ex-card__detail">${esc(detail)}</p>` : ''}
    ${work ? `<a class="eyebrow link-line ex-card__work" href="${workPath(lang, work)}">${esc(x.linkedWork)} ${ARROW}</a>` : ''}
  </div>
  <div class="ex-card__place"><p class="ex-card__venue${venueInTitle(e, lang) ? ' ex-card__venue--dup' : ''}">${esc(e.venue)}</p><p class="eyebrow">${placeOf(e)}</p></div>
</li>`;
  }).join('\n');

  const body = `
<div class="page-intro ex-intro">
  <p class="watermark" aria-hidden="true">04</p>
  ${label(x.eyebrow)}
  <h1>${esc(x.heading)}</h1>
  <p>${esc(x.intro)}</p>
</div>
${feature}
<section class="ex-archive" aria-label="${esc(x.eyebrow)}">
  <div class="ex-filter" role="group" aria-label="${esc(x.filterLabel)}" hidden>
    <button type="button" data-filter="all" aria-pressed="true">${esc(x.filterAll)} <sup>${EXHIBITIONS.length}</sup></button>
    ${types.map(t => `<button type="button" data-filter="${t}" aria-pressed="false">${esc(x.types[t])} <sup>${EXHIBITIONS.filter(e => e.type === t).length}</sup></button>`).join('\n    ')}
  </div>
  <ol class="ex-cards">
${rows}
  </ol>
</section>
<div class="territories about-territories">
  <p class="eyebrow">${esc(s.home.territories)}</p>
  <ul>${COUNTRIES[lang].map((c, i) => `<li>${i ? THREAD : ''}<span>${esc(c)}</span></li>`).join('')}</ul>
</div>
<section class="about-cta" aria-label="${esc(s.contact.eyebrow)}">
  <p class="about-cta__title">${esc(x.ctaTitle)}</p>
  <div class="about-cta__actions">
    <a class="mc-host" href="mailto:${CONTACT.email}?subject=${encodeURIComponent(x.ctaMail)}">${esc(x.ctaMail)} <span aria-hidden="true">→</span></a>
    <a class="eyebrow link-line" href="${path(lang, 'work')}">${esc(s.about.ctaWorks)} ${ARROW}</a>
  </div>
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
  const s = STRINGS[lang], a = s.about, h = s.home;
  if (!BIO.approach) TODOS.add('Texte de démarche artistique (page À propos)');
  if (!BIO.residencies) TODOS.add('Liste des résidences (CV)');
  if (!ARTIST_PHOTO.image) TODOS.add('Portrait de l’artiste');

  const approach = tr(BIO.approach, lang);
  const cvRows = types => EXHIBITIONS.filter(e => types.includes(e.type)).map(e =>
    `<li><a class="cv-row" href="${path(lang, 'exhibitions')}#${e.id}">`
    + `<span class="cv-row__year${e.year ? '' : ' cv-row__year--none'}">${e.year ? esc(e.year) : '<span aria-hidden="true">—</span>'}</span>`
    + `<span class="cv-row__title">${esc(tr(e.title, lang))}</span>`
    + `<span class="eyebrow cv-row__place">${esc(tr(e.city, lang))}, ${esc(tr(e.country, lang))}</span></a></li>`).join('');
  const cvGroup = (i, title, types, empty) => {
    const n = EXHIBITIONS.filter(e => types.includes(e.type)).length;
    if (!n && !empty) return ''; // rubrique vide : retirée de la version publique
    return `<div class="cv-group reveal"><div class="cv-group__head"><span class="cv-group__num">${pad2(i)}</span><h3>${esc(title)}</h3>`
      + (n ? `<p class="eyebrow">${esc(a.entries(n))}</p>` : '') + '</div>'
      + (n ? `<ol class="cv-rows">${cvRows(types)}</ol>` : `<div class="cv-empty">${empty}</div>`) + '</div>';
  };

  const photo = ARTIST_PHOTO.image
    ? picture(ARTIST_PHOTO.image, lang, { eager: true, sizes: '(max-width: 860px) 100vw, 42vw', style: `object-position:${ARTIST_PHOTO.focus}` })
    : swatch(['#e0a06a', '#a2643a', '#2a1810'], lang);

  const body = `
<header class="about-hero">
  <div class="about-hero__text">
    ${label(a.eyebrow)}
    <h1>${esc(a.heading)}</h1>
    <p class="about-hero__tagline">${esc(s.tagline)}</p>
    <ul class="about-hero__disciplines">${s.disciplines.split(' • ').map(d => `<li>${esc(d)}</li>`).join('')}</ul>
  </div>
  <figure class="about-hero__figure artist__figure">
    <div class="artist__mat"><div class="artist__frame">${photo}</div></div>
    <figcaption class="eyebrow artist__route">${esc(h.artistRoute)}</figcaption>
  </figure>
</header>

<dl class="about-facts">${h.artistFacts.map(([k, v]) => `<div class="reveal"><dt>${esc(k)}</dt><dd class="eyebrow">${esc(v)}</dd></div>`).join('')}</dl>

<section class="about-part" aria-labelledby="bio-t">
  <div class="about-part__side"><span class="about-part__num">01</span>${label(a.bioTitle, { tag: 'h2', id: 'bio-t' })}</div>
  <div class="about-part__body reveal">
    <p class="h-lead">${esc(h.artistLead)}</p>
    <p>${esc(h.artistBody)}</p>
  </div>
</section>

<section class="about-approach section--dark on-dark" aria-labelledby="app-t">
  <div class="glow" aria-hidden="true"></div>
  <div class="about-part">
    <div class="about-part__side"><span class="about-part__num">02</span>${label(a.approachTitle, { tag: 'h2', id: 'app-t' })}</div>
    <div class="about-part__body reveal">
      <blockquote class="about-quote">${esc(a.approachLead)}</blockquote>
      <ul class="about-themes">${h.artistThemes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      ${approach ? (Array.isArray(approach) ? approach : [approach]).map(p => `<p>${esc(p)}</p>`).join('') : SHOW_TODO ? `<p class="todo-block">${esc(s.work.textTodo)}</p>` : ''}
    </div>
  </div>
</section>

<section class="about-part about-cv" aria-labelledby="cv-t">
  <div class="about-part__side"><span class="about-part__num">03</span>${label(a.cvTitle)}<h2 class="h-section" id="cv-t">${esc(a.cvTitle)} — Lamyne M</h2>
    <dl class="cv-id">
      <div><dt class="eyebrow">${esc(a.bornLabel)}</dt><dd>${esc(BIO.born)}, ${esc(tr(BIO.birthplace, lang))}</dd></div>
      <div><dt class="eyebrow">${esc(a.basedLabel)}</dt><dd>${esc(tr(BIO.basedIn, lang))}</dd></div>
    </dl>
  </div>
  <div class="about-part__body">
    ${cvGroup(1, a.cvExhibitions, ['exhibition', 'event'])}
    ${cvGroup(2, a.cvCollections, ['collection'])}
    ${cvGroup(3, a.cvRepresentation, ['representation'])}
    ${cvGroup(4, a.cvResidencies, [], BIO.residencies ? '' : todo(lang, 'Liste des résidences (CV)'))}
  </div>
</section>

<div class="territories about-territories">
  <p class="eyebrow">${esc(h.territories)}</p>
  <ul>${COUNTRIES[lang].map((c, i) => `<li>${i ? THREAD : ''}<span>${esc(c)}</span></li>`).join('')}</ul>
</div>

<section class="about-cta" aria-label="${esc(s.contact.eyebrow)}">
  <p class="about-cta__title">${esc(a.ctaTitle)}</p>
  <div class="about-cta__actions">
    <a class="mc-host" href="mailto:${CONTACT.email}">${esc(s.contact.write)} <span aria-hidden="true">→</span></a>
    <a class="eyebrow link-line" href="${path(lang, 'work')}">${esc(a.ctaWorks)} ${ARROW}</a>
  </div>
</section>`;

  page({
    lang, route: 'about', alternates: alts('about'), xDefault: path(DEFAULT_LANG, 'about'), current: 'about', ogType: 'profile',
    ogImage: ARTIST_PHOTO.image || undefined,
    title: a.title, description: a.description, body,
    jsonld: [{ '@type': 'ProfilePage', url: `${SITE_URL}${path(lang, 'about')}`, inLanguage: lang, mainEntity: { '@id': `${SITE_URL}/#lamyne-m` } }, personLd(lang)],
  });
}

function renderPress(lang) {
  const s = STRINGS[lang], p = s.press, h = s.home;
  const rows = PRESS.map((x, i) => {
    if (!x.url) TODOS.add(`Lien presse : ${x.name}`);
    const inner = `<span class="press-row__num">${pad2(i + 1)}</span><span class="press-row__name">${esc(x.name)}</span>`;
    return `<li class="reveal">${x.url
      ? `<a class="press-row" href="${esc(x.url)}" rel="noopener" target="_blank">${inner}<span class="eyebrow press-row__status">${esc(p.read)} ↗</span><span class="visually-hidden"> ${esc(s.contact.newTab)}</span></a>`
      : `<div class="press-row press-row--static">${inner}${SHOW_TODO ? `<span class="todo press-row__status">${esc(p.linkTodo)}</span><span class="eyebrow press-row__soon">${esc(p.linkSoon)}</span>` : ''}</div>`}</li>`;
  }).join('');
  const body = `
<div class="page-intro press-intro">
  <p class="watermark" aria-hidden="true">06</p>
  ${label(p.eyebrow)}
  <h1>${esc(p.heading)}</h1>
  <p>${esc(h.pressIntro)}</p>
</div>
<nav class="press-quick" aria-label="${esc(p.resources)}">
  ${PRESS_KIT
    ? `<a class="press-quick__btn" href="/assets/${esc(PRESS_KIT)}" download>${esc(h.pressKitLabel)} <span aria-hidden="true">↓</span></a>`
    : SHOW_TODO ? `<span class="press-quick__btn press-quick__btn--off">${esc(h.pressKitLabel)} <small>${esc(p.kitSoon)}</small></span>` : ''}
  <a class="press-quick__btn press-quick__btn--dark" href="mailto:${CONTACT.email}?subject=${encodeURIComponent(p.eyebrow)}">${esc(p.ctaMail)} <span aria-hidden="true">→</span></a>
</nav>
${pressMarquee()}
<div class="press-page">
  <section class="press-page__list" aria-labelledby="mentions-t">
    <p class="eyebrow" id="mentions-t">${esc(p.mentions)} · ${PRESS.length}</p>
    <ol class="press-rows">${rows}</ol>
  </section>
  <aside class="press-page__aside" aria-labelledby="res-t">
    <p class="eyebrow" id="res-t">${esc(p.resources)}</p>
    <dl class="press__meta">
      ${PRESS_KIT || SHOW_TODO ? `<div><dt class="eyebrow">${esc(h.pressKitLabel)}</dt><dd>${pressKit(lang)}</dd></div>` : (pressKit(lang), '')}
      <div><dt class="eyebrow">${esc(p.contactPress)}</dt><dd><a class="link-line" href="mailto:${CONTACT.email}?subject=${encodeURIComponent(p.eyebrow)}">${esc(CONTACT.email)}</a></dd></div>
      <div><dt class="eyebrow">${esc(p.bio)}</dt><dd><a class="link-line" href="${path(lang, 'about')}">${esc(p.bioLink)} →</a></dd></div>
    </dl>
  </aside>
</div>
<section class="about-cta" aria-label="${esc(p.contactPress)}">
  <p class="about-cta__title">${esc(p.ctaTitle)}</p>
  <div class="about-cta__actions">
    <a class="mc-host" href="mailto:${CONTACT.email}?subject=${encodeURIComponent(p.eyebrow)}">${esc(p.ctaMail)} <span aria-hidden="true">→</span></a>
    <a class="eyebrow link-line" href="${path(lang, 'exhibitions')}">${esc(h.allExhibitions)} ${ARROW}</a>
  </div>
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
