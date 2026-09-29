# lamyne-m.com — refonte

Site statique trilingue (FR / EN / RU) de Lamyne M, artiste plasticien et performeur.
HTML / CSS / JavaScript vanilla, sans CMS ni framework, sans dépendance serveur.

## Déployer

Le dossier **`dist/`** est le site final, prêt à copier sur le VPS :

```sh
rsync -av --delete dist/ user@vps:/var/www/lamyne-m/
```

Une configuration Nginx d'exemple (HTTPS, cache, redirections des anciennes URLs, page 404)
se trouve dans `deploy/nginx.conf.example`. Aucun build n'est nécessaire côté serveur.

## Modifier le contenu

Tout le contenu vit dans deux fichiers :

| Fichier | Contenu |
| --- | --- |
| `src/content/site.mjs` | œuvres, expositions, presse, contact, biographie, photos |
| `src/content/i18n.mjs` | textes éditoriaux et d'interface, par langue |

Puis régénérer le site (Node ≥ 18, aucune dépendance à installer) :

```sh
node build.mjs
```

Le build liste dans **`A-COMPLETER.md`** chaque information encore manquante (années,
médiums, textes, photos, liens presse, réseaux sociaux…). Dans la version publique, un champ
manquant n'apparaît simplement pas (pas de mention « À compléter ») ; il s'affiche dès qu'il est
renseigné. Pour relire le site avec les marqueurs visibles : `node build.mjs --preview`
(ne pas déployer ce build). **Règle absolue : ne jamais inventer d'information** — seules les
données confirmées par Lamyne M sont saisies.

### Ajouter une photo

1. Déposer l'original (nom descriptif, ex. `marabout-3-0-installation.jpg`) dans `src/originals/`.
2. `pip install pillow && python3 scripts/images.py` → génère AVIF / WebP / JPEG en plusieurs largeurs
   + une image Open Graph 1200×630.
3. Déclarer l'image et son texte alternatif (3 langues) dans `IMAGES` (`site.mjs`), puis
   l'associer à l'œuvre (`image: 'marabout-3-0-installation'`).
4. `node build.mjs`.

### Ajouter la vidéo « Art in Motion » / le dossier de presse

Déposer le fichier dans `src/assets/` puis renseigner `MOTION_VIDEO` ou `PRESS_KIT` dans `site.mjs`.
La vidéo n'est chargée qu'au clic (performance).

## Architecture

```
/                     choix de langue + redirection (langue mémorisée ou du navigateur) — x-default
/fr/  /en/  /ru/      accueil : hero → œuvres → artiste → Art in Motion → expositions → masterclasses → presse → contact
/fr/oeuvres/                     sommaire : les 3 catégories et la liste de leurs œuvres, visibles d'un coup d'œil
/fr/oeuvres/art/                 une page par catégorie (art, performance, masterclass)
/fr/oeuvres/<catégorie>/<slug>/  page d'œuvre (gabarit unique : photo, titre, année, médium/lieu, texte,
                                 œuvre suivante dans la même catégorie)
/fr/expositions/      liste chronologique (expositions, collections, représentation)
/fr/a-propos/         biographie, démarche, CV
/fr/presse/           mentions presse, dossier de presse
```

Slugs localisés : `work / exhibitions / about / press` (en), `raboty / vystavki / o-khudozhnike / pressa` (ru).
Le contact est la section de fermeture de chaque page (`#contact`).

Navigation dans les œuvres : sous-menu Art / Performance / Masterclass sous « Œuvres » dans l'en-tête
(desktop et menu mobile), barre d'onglets fixe (Tout · Art · Performance · Masterclass) sur le sommaire
et les pages de catégorie, fil d'Ariane sur les pages de catégorie et d'œuvre.

## SEO

- URL distincte par langue, `<html lang>` correct, `hreflang` réciproques + `x-default`, canonique.
- `<title>` et `meta description` traduits par page ; Open Graph + Twitter Cards.
- Schema.org : `Person` (artiste), `VisualArtwork` (œuvres), `EducationEvent` (masterclasses),
  `ExhibitionEvent` (expositions), `ProfilePage`, `CollectionPage`.
- `sitemap.xml` (avec alternates de langue) et `robots.txt` générés.

## Effet « tissu numérique » (hero)

`src/assets/js/fabric.js` — WebGL pur (aucune librairie) : un patchwork bleu roi à pois et coutures
dorés, qui fait ressortir les robes rouges et or de l'artiste, recouvre la photo et le nom ; au scroll il se soulève comme pris dans le vent,
la souris le soulève localement en desktop. Le rendu s'arrête hors écran et une fois le tissu levé.

Son : un bruissement de tissu synthétisé en direct (Web Audio, aucun fichier) accompagne la levée
du rideau, toujours actif, sans bouton ; son volume suit la vitesse du rideau. Limite des navigateurs :
aucun son n'est possible avant un premier geste du visiteur (clic, toucher bref, touche du clavier) —
la molette et le glissé du doigt ne comptent pas. Le son démarre dès que le navigateur l'autorise.

Écran « Entrer » : à la première visite de l'accueil dans la session (onglet), un voile nuit
avec « LAMYNE M » et un bouton « Entrer » précède le rideau ; ce clic est le geste qui autorise
le son. Il n'apparaît pas si le rideau est inactif (mouvement réduit, économie de données, appareil
trop lent, WebGL absent) ni sans JavaScript, et ne peut jamais bloquer la page (filet de sécurité
dans `main.js`). Échap entre aussi. Limite : Safari exige un nouveau geste à chaque chargement de
page ; en revenant sur l'accueil dans la même session, le son y reprend au premier clic ou toucher.

Actif sur tous les appareils, sauf si le visiteur a demandé moins d'animations (`prefers-reduced-motion`)
ou le mode économie de données. Plutôt que de se fier aux cœurs ou à la mémoire annoncés par le
navigateur (peu fiables, surtout sous Safari), le script mesure la fluidité réelle au démarrage : sous
24 images/s, il baisse la résolution du rendu (60 %, puis 40 %) ; si c'est encore trop lent, ou si WebGL
est indisponible ou perd son contexte, le tissu est retiré et le hero reste statique.
Sans JavaScript, le site reste entièrement lisible.

## Typographie & cyrillique

Bricolage Grotesque (400 uniquement, jamais plus gras) et Archivo, via Google Fonts, `display=swap`.
**Aucune des deux ne couvre le cyrillique** (vérifié : sous-ensembles latin, latin-ext, vietnamese).
Sur les pages `lang="ru"` seulement, **Onest** (grotesque géométrique, même esprit) est chargée et
placée en seconde position de la pile : le latin — dont « LAMYNE M » — reste en Bricolage, le
cyrillique bascule en Onest.

## Accessibilité

Landmarks, lien d'évitement, un seul `h1` par page, `aria-labelledby` sur les sections,
textes alternatifs descriptifs, `:focus-visible`, menu mobile au clavier (Échap, piège de focus),
`prefers-reduced-motion` respecté partout. La couleur tertiaire de la palette (`#8A8478`, 3,4:1 sur
l'ivoire) est réservée aux fonds sombres ; les petits textes sur fond clair utilisent `#6A655C`
(5,2:1) pour rester conformes WCAG AA.

## ⚠ Avant la mise en ligne

- **Traductions** : l'anglais et surtout le russe (`src/content/i18n.mjs`, alt-texts dans `site.mjs`)
  sont des premières versions — **relecture par un traducteur humain obligatoire**.
- Compléter les informations listées dans `A-COMPLETER.md` avec Lamyne M.
- Maquette de référence : https://claude.ai/artifact/4WScRXRUQmF1HmFuu2vFfS
