// Contenu du site — source unique pour les trois langues.
//
// RÈGLE : n'inscrire ici que des informations confirmées par Lamyne M.
// Toute donnée inconnue reste à `TODO` : le build affiche alors un espace
// « à compléter » sur la page et liste le champ manquant dans la console.
// Ne jamais remplacer un TODO par une information supposée.
//
// Les textes russes (ru) sont une première version : relecture humaine
// obligatoire avant mise en ligne (voir README).

export const TODO = null;

export const SITE_URL = 'https://lamyne-m.com';

export const LANGS = ['fr', 'en', 'ru'];
export const DEFAULT_LANG = 'fr';

// Slugs localisés des rubriques.
export const ROUTES = {
  home: { fr: '', en: '', ru: '' },
  work: { fr: 'oeuvres', en: 'work', ru: 'raboty' },
  exhibitions: { fr: 'expositions', en: 'exhibitions', ru: 'vystavki' },
  about: { fr: 'a-propos', en: 'about', ru: 'o-khudozhnike' },
  press: { fr: 'presse', en: 'press', ru: 'pressa' },
};

export const CONTACT = {
  email: 'lamyne@yahoo.fr',
  location: { fr: 'Paris', en: 'Paris', ru: 'Париж' },
  instagram: 'https://www.instagram.com/lamyne_m',
  facebook: 'https://www.facebook.com/ben.lamyne',
};

// Dossier de presse PDF (chemin relatif à src/assets/, ex. 'press/dossier-de-presse.pdf').
export const PRESS_KIT = TODO;

// Vidéo « Art in Motion » : { src: 'video/xxx.mp4', poster: 'img/xxx-1200.jpg', title: {fr,en,ru} }
export const MOTION_VIDEO = TODO;

// Photos disponibles (générées par scripts/images.py depuis src/originals/).
export const IMAGES = {
  'robe-doree-cape-rouge-vitraux': {
    alt: {
      fr: 'Une haute robe bleu nuit au plastron brodé d’or et à la cape rouge bordée d’or, dressée sur un chapiteau de pierre entre deux vitraux ; un homme pieds nus, vêtu de lin clair, la contemple.',
      en: 'A tall midnight-blue gown with a gold-embroidered bodice and a gold-trimmed red cape, raised on a stone capital between two stained-glass windows; a barefoot man in pale linen gazes up at it.',
      ru: 'Высокое тёмно-синее платье с расшитым золотом лифом и красной накидкой с золотой каймой, установленное на каменной капители между двумя витражами; босой мужчина в светлом льне смотрит на него.',
    },
  },
  'robe-brune-traine-au-vent': {
    alt: {
      fr: 'Une robe monumentale en tissu brun, coiffée d’une collerette de volants bruns et bleus, dressée seule dans un champ ; sa longue traîne se soulève au vent sous un ciel nuageux.',
      en: 'A monumental gown in brown fabric, crowned with a ruffled collar of brown and blue, standing alone in a field; its long train lifts in the wind under a cloudy sky.',
      ru: 'Монументальное платье из коричневой ткани с воротником из коричневых и синих оборок, одиноко стоящее в поле; длинный шлейф поднимается на ветру под облачным небом.',
    },
  },
  'robe-patchwork-jean-donjon': {
    alt: {
      fr: 'Une robe monumentale en patchwork de jeans aux nombreuses nuances de bleu, sur mannequin, photographiée en contre-plongée ; sa longue traîne s’étale sur le gravier devant un donjon médiéval et un clocher de pierre.',
      en: 'A monumental gown made of patchwork denim in many shades of blue, on a mannequin, photographed from below; its long train spreads over the gravel in front of a medieval keep and a stone bell tower.',
      ru: 'Монументальное платье из лоскутов джинсовой ткани разных оттенков синего на манекене, снятое снизу; длинный шлейф расстилается по гравию перед средневековым донжоном и каменной колокольней.',
    },
  },
  'robe-vitraux-voute-bleue': {
    alt: {
      fr: 'Une longue robe à motifs rouges et or, bordée de pans aux imprimés colorés, éclairée par un faisceau de lumière dans une salle voûtée plongée dans la pénombre bleue, entre deux vitraux.',
      en: 'A long gown with red and gold patterns, edged with panels of colourful prints, lit by a beam of light in a vaulted room steeped in blue shadow, between two stained-glass windows.',
      ru: 'Длинное платье с красно-золотым узором и вставками из ярких набивных тканей, освещённое лучом света в сводчатом зале, погружённом в синий полумрак, между двумя витражами.',
    },
  },
  'seconde-vie-villa-d-2026': {
    alt: {
      fr: "Vue de l'exposition Seconde vie à la Villa D : une grande robe patchwork à pois, rouge, violette et bleue, à longue traîne, sur un socle blanc ; au fond, un mannequin en costume patchwork coiffé de bois de cerf et des œuvres graphiques encadrées.",
      en: 'View of the Seconde vie exhibition at Villa D: a long-trained patchwork gown with polka dots in red, purple and blue on a white plinth; in the background, a mannequin in a patchwork outfit with an antler headdress and framed graphic works.',
      ru: 'Вид выставки «Seconde vie» на Вилле D: длинное лоскутное платье в горошек красного, фиолетового и синего цветов со шлейфом на белом подиуме; на заднем плане — манекен в лоскутном костюме с головным убором из рогов и графические работы в рамах.',
    },
  },
};

// Photo de couverture de l'accueil (sous l'effet « tissu numérique »).
// TODO tant qu'aucune photo en haute définition (≥ 3000 px de large) n'est fournie :
// le hero reste alors un fond sombre, le tissu se soulève sur le nom seul.
// focus : cadrage CSS (object-position) de la photo une fois ajoutée.
export const HERO = {
  image: TODO,
  focus: 'center 50%',
};

// ---------------------------------------------------------------------------
// Œuvres
// category : 'art' | 'performance' | 'masterclass'
// image    : clé de IMAGES, ou TODO (un aplat coloré « visuel à fournir » s'affiche)
// tone     : couleurs de l'aplat de remplacement tant qu'aucune photo n'existe
// ---------------------------------------------------------------------------
const work = (slug, category, title, extra = {}) => ({
  slug, category, title,
  year: TODO, medium: TODO, text: TODO, image: TODO,
  ...extra,
});

const TONES = [
  ['#b89a5e', '#5c5230', '#1c1912'],
  ['#6f8a63', '#2e3a26', '#101410'],
  ['#e0a06a', '#a2643a', '#2a1810'],
  ['#c9793f', '#6b2f1c', '#140805'],
  ['#9a7fa0', '#43304a', '#150f17'],
  ['#c98f7a', '#7a3420', '#1c0d08'],
];

export const WORKS = [
  // Art — installations, pièces textiles
  work('ventilate', 'art', 'VENTiLATE'),
  work('corona-curius', 'art', 'Corona curius'),
  work('marabout-3-0', 'art', 'Marabout 3.0', {
    medium: { fr: 'Installation', en: 'Installation', ru: 'Инсталляция' },
  }),
  work('sculpter-par-le-vent', 'art', 'Sculpter par le vent'),
  work('lamyne-melchiore', 'art', 'LAMYNE Melchiore'),
  work('sur-leurs-31', 'art', 'Sur leurs 31'),
  work('djins-et-foret', 'art', 'Djins et forêt'),
  work('autoportrait', 'art', 'Autoportrait'),
  work('nombrilisme', 'art', 'Nombrilisme'),
  work('je-les-voies-grandes', 'art', 'Je les voies grandes'),
  work('les-grandes-robes-royales', 'art', 'Les Grandes robes royales'),
  // Performance
  work('peau-d-ane', 'performance', "Peau d'âne", {
    medium: { fr: 'Performance', en: 'Performance', ru: 'Перформанс' },
  }),
  work('teintuer', 'performance', 'Teintuer', {
    medium: { fr: 'Performance', en: 'Performance', ru: 'Перформанс' },
  }),
  work('endormissement', 'performance', 'Endormissement', {
    medium: { fr: 'Performance', en: 'Performance', ru: 'Перформанс' },
  }),
  work('lockdown', 'performance', 'Lockdown', {
    medium: { fr: 'Performance', en: 'Performance', ru: 'Перформанс' },
  }),
  work('page-blanche', 'performance', 'Page Blanche', {
    medium: { fr: 'Performance', en: 'Performance', ru: 'Перформанс' },
  }),
  // Masterclass
  work('masterclass-grandes-robes', 'masterclass', 'Masterclass Grandes robes', { place: TODO }),
  work('masterclass-bordeaux', 'masterclass', 'Masterclass Bordeaux', {
    place: { fr: 'Bordeaux', en: 'Bordeaux', ru: 'Бордо' },
  }),
  work('masterclass-taiwan', 'masterclass', 'Masterclass Taiwan', {
    place: { fr: 'Taïwan', en: 'Taiwan', ru: 'Тайвань' },
  }),
].map((w, i) => ({ ...w, tone: TONES[i % TONES.length] }));

// Œuvres mises en avant sur l'accueil (après la pièce « Seconde vie » en plein cadre).
// Robes en format vertical des « Œuvres sélectionnées » (accueil), dans l'ordre
// d'affichage. work : slug de l'œuvre correspondante, à renseigner une fois
// confirmé par Lamyne M — la carte prend alors son titre et renvoie vers sa page.
const robe = (image, label) => ({
  image, label, work: TODO,
  medium: { fr: 'Textile', en: 'Textile', ru: 'Текстиль' },
});
export const FEATURED_ROBES = [
  robe('robe-doree-cape-rouge-vitraux', 'robe dorée à la cape rouge (vitraux)'),
  robe('robe-brune-traine-au-vent', 'robe brune à la traîne au vent'),
  robe('robe-vitraux-voute-bleue', 'robe rouge et or sous la voûte bleue'),
  robe('robe-patchwork-jean-donjon', 'robe en patchwork de jeans'),
];

// ---------------------------------------------------------------------------
// Expositions, collections, représentation — informations confirmées seulement.
// year : chaîne, ou TODO (affiché « — »)
// type : 'exhibition' | 'collection' | 'event' | 'representation'
// ---------------------------------------------------------------------------
export const EXHIBITIONS = [
  {
    id: 'seconde-vie',
    type: 'exhibition',
    year: '2026',
    title: {
      fr: 'Seconde vie — Villa D',
      en: 'Seconde vie — Villa D',
      ru: '«Seconde vie» — Вилла D',
    },
    detail: {
      fr: 'tissus des JO Paris 2024',
      en: 'fabrics from the Paris 2024 Olympic Games',
      ru: 'ткани Олимпийских игр «Париж-2024»',
    },
    venue: 'Villa D',
    city: { fr: 'Saint-Denis', en: 'Saint-Denis', ru: 'Сен-Дени' },
    country: { fr: 'France', en: 'France', ru: 'Франция' },
    image: 'seconde-vie-villa-d-2026',
  },
  {
    id: 'harn-museum',
    type: 'collection',
    year: '2021',
    title: {
      fr: 'Collections permanentes — Harn Museum',
      en: 'Permanent collection — Harn Museum',
      ru: 'Постоянная коллекция — Harn Museum',
    },
    detail: TODO,
    venue: 'Harn Museum of Art',
    city: { fr: 'Floride', en: 'Florida', ru: 'Флорида' },
    country: { fr: 'États-Unis', en: 'United States', ru: 'США' },
  },
  {
    id: 'teintuer-friche',
    type: 'event',
    year: TODO,
    title: {
      fr: 'Teintuer — Friche la Belle de Mai',
      en: 'Teintuer — Friche la Belle de Mai',
      ru: '«Teintuer» — Friche la Belle de Mai',
    },
    detail: TODO,
    venue: 'Friche la Belle de Mai',
    city: { fr: 'Marseille', en: 'Marseille', ru: 'Марсель' },
    country: { fr: 'France', en: 'France', ru: 'Франция' },
    work: 'teintuer',
  },
  {
    id: 'axis-gallery',
    type: 'representation',
    year: TODO,
    title: {
      fr: 'Représentation — Axis Gallery',
      en: 'Representation — Axis Gallery',
      ru: 'Представительство — Axis Gallery',
    },
    detail: TODO,
    venue: 'Axis Gallery',
    city: { fr: 'New York', en: 'New York', ru: 'Нью-Йорк' },
    country: { fr: 'États-Unis', en: 'United States', ru: 'США' },
  },
];

export const COUNTRIES = {
  fr: ['Cameroun', 'France', 'États-Unis'],
  en: ['Cameroon', 'France', 'United States'],
  ru: ['Камерун', 'Франция', 'США'],
};

// Mentions presse — url : lien vers l'article, TODO tant qu'il n'est pas fourni.
export const PRESS = [
  { name: 'Axis Gallery', url: TODO },
  { name: 'La Friche Belle de Mai', url: TODO },
  { name: 'Explore Paris', url: TODO },
  { name: '14 Minutes de Paris', url: TODO },
];

// Biographie : seuls les faits confirmés. Les sections vides s'affichent « à compléter ».
export const BIO = {
  born: '1977',
  birthplace: { fr: 'Cameroun', en: 'Cameroon', ru: 'Камерун' },
  basedIn: { fr: 'Saint-Denis', en: 'Saint-Denis', ru: 'Сен-Дени' },
  approach: TODO, // texte de démarche artistique fourni par l'artiste
  residencies: TODO, // liste de résidences confirmées
};
