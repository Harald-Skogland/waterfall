"""Build dist/index.html by inlining src/data.js into src/template.html.

Usage:  python3 scripts/build.py
The template holds the page (CSS, markup, app script) with a /*DATA*/ marker
where the variables snapshot goes. The output is a single self-contained file
that can be published as a Claude artifact or hosted anywhere.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
template = (ROOT / "src" / "template.html").read_text()
data = (ROOT / "src" / "data.js").read_text()

if "/*DATA*/" not in template:
    raise SystemExit("src/template.html is missing the /*DATA*/ marker")

out = ROOT / "dist" / "index.html"
out.parent.mkdir(exist_ok=True)
out.write_text(template.replace("/*DATA*/", data, 1))
print(f"Built {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes)")
