"""
Line-art figure cleanup for scanned PYQ figures.

Source PYQ figures are low-resolution scans, so cropping/upscaling alone looks
blurry. Because they are line art (black lines on white), we can make them crisp
with a simple, dependency-light pipeline (Pillow + numpy only; no potrace/OpenCV
needed in this environment):

    upscale (LANCZOS)  ->  binarize to solid black/white  ->  light anti-alias

This turns soft gray edges into clean, well-defined black lines that stay sharp
when displayed larger. Run on every cropped figure (stem and option) before
uploading to storage. Part of the PYQ ingestion standard
(see docs/pyq-ingestion-standard.md).

Usage:
    python scripts/ingest/figures/clean_lib.py fig1.png fig2.png ...
    # or import: from clean_lib import clean; clean("fig.png")
"""

from __future__ import annotations
import os
import sys

from PIL import Image, ImageFilter
import numpy as np


def clean(path: str, target: int = 1100, thr: int = 165, aa: float = 0.6) -> None:
    """Clean a line-art figure in place.

    target: approximate longest-side pixels after upscaling.
    thr:    grayscale threshold; below -> black, else white.
    aa:     gaussian radius for a light anti-alias on the binarized edges.
    """
    im = Image.open(path).convert("L")
    w, h = im.size
    scale = max(3, round(target / max(w, h)))
    up = im.resize((w * scale, h * scale), Image.LANCZOS)
    a = np.array(up)
    b = np.where(a < thr, 0, 255).astype("uint8")
    out = Image.fromarray(b)
    if aa > 0:
        out = out.filter(ImageFilter.GaussianBlur(aa))
    out.save(path)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        clean(p)
        print("cleaned", os.path.basename(p))
