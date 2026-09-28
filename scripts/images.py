#!/usr/bin/env python3
"""Génère les variantes responsive (AVIF / WebP / JPEG) des photos sources.

Usage : python3 scripts/images.py
Dépendance : Pillow (pip install pillow) — compilé avec le support AVIF et WebP.

Chaque fichier de src/originals/ produit, dans src/assets/img/ :
  <nom>-<largeur>.avif / .webp / .jpg   pour chaque largeur de WIDTHS (sans agrandir,
                                         sauf les photos listées dans UPSCALE_TO)
  <nom>-og.jpg                           image 1200x630 pour Open Graph
Les largeurs réellement produites sont écrites dans src/assets/img/manifest.json,
lu par build.mjs pour construire les srcset.
"""
import json
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "originals"
OUT = ROOT / "src" / "assets" / "img"
WIDTHS = [480, 800, 1200, 1600, 2400]

# Photos dont aucun original plus grand n'existe mais qui servent en plein écran :
# on les agrandit jusqu'à cette largeur (Lanczos + accentuation légère).
# À retirer dès qu'un original en haute définition est disponible.
UPSCALE_TO = {}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for path in sorted(SRC.iterdir()):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".tif", ".tiff"}:
            continue
        name = path.stem
        img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        w, h = img.size
        target = max(w, UPSCALE_TO.get(name, 0))
        widths = [x for x in WIDTHS if x < target] + [target]
        for width in widths:
            height = round(h * width / w)
            resized = img.resize((width, height), Image.LANCZOS)
            if width > w:
                resized = resized.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
            resized.save(OUT / f"{name}-{width}.jpg", quality=82, optimize=True, progressive=True)
            resized.save(OUT / f"{name}-{width}.webp", quality=78, method=6)
            resized.save(OUT / f"{name}-{width}.avif", quality=60)
        og = ImageOps.fit(img, (1200, 630), Image.LANCZOS, centering=(0.5, 0.3))
        og.save(OUT / f"{name}-og.jpg", quality=85, optimize=True)
        largest = widths[-1]
        manifest[name] = {"width": largest, "height": round(h * largest / w), "widths": widths}
        print(f"{name}: {w}x{h} -> {widths}")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
