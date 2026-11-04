"""Build the page by inlining src/data.js and src/codesyntax.js into src/template.html.

Usage:  python3 scripts/build.py

Writes two files:
  dist/index.html     standalone web page (GitHub Pages). Adds the document
                      skeleton and the base styles the page relies on.
  dist/artifact.html  the same page without a skeleton, for publishing as a
                      Claude artifact (the artifact host adds its own).
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
template = (ROOT / "src" / "template.html").read_text()
data = (ROOT / "src" / "data.js").read_text()

if "/*DATA*/" not in template:
    raise SystemExit("src/template.html is missing the /*DATA*/ marker")

codesyntax = (ROOT / "src" / "codesyntax.js").read_text()
if "/*CODESYNTAX*/" not in template:
    raise SystemExit("src/template.html is missing the /*CODESYNTAX*/ marker")

# code first: data.js is generated and must never be scanned for the code marker
page = template.replace("/*CODESYNTAX*/", codesyntax, 1).replace("/*DATA*/", data, 1)

# Same skeleton and reset the artifact host provides, so both builds look alike.
SKELETON_HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
</head>
<body>
"""
SKELETON_TAIL = "\n</body>\n</html>\n"

dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
(dist / "artifact.html").write_text(page)
(dist / "index.html").write_text(SKELETON_HEAD + page + SKELETON_TAIL)
for name in ("index.html", "artifact.html"):
    f = dist / name
    print(f"Built {f.relative_to(ROOT)} ({f.stat().st_size:,} bytes)")
