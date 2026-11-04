# Waterfall

An interactive, left-to-right view of the color variables in a design-system Figma file: Foundation → Alias → Mapped. Click any token to light up its route, read its details in a fixed side panel, and check the Problems page for tier-rule breaks.

Live page: https://harald-skogland.github.io/waterfall/

## What it shows

**Waterfall** (hotkey `1`). The columns, left to right:
1. Foundation
2. Alias · generic (primary, secondary, neutral, basic)
3. Alias · multipurpose
4. Mapped (every mapped token outside `components/`)
5. Components (`components/`, which may source from Mapped)

**Display Dark mode** (hotkey `3`) adds a black *Dark* column right of each Mapped column, linked to the Dark sources with dashed lines.

**Selecting tokens.**
- Clicking a foundation color highlights every branch it feeds.
- Clicking a mapped token highlights its route back to Foundation.
- Lines that aren't on the route are hidden.
- **Show all connections** draws every link when nothing is selected.
- **Clear** clears it (`Esc`). `S` jumps to search. Search matches all the words you type, in any order (for example `button primary`), across names, hex values and code syntax.

**Trace panel.** Fixed on the right. It shows the Light and Dark values, each route from Foundation down to the token, then the description, scope, whether it's hidden from publishing, code syntax for Web, Android and iOS (each with a copy button), and flags.

**Zoom and pan.**
- Use − / + / Fit / 100% in the bottom-right corner of the pane.
- The mouse wheel zooms; this can be turned off.
- Click and drag to pan.

**Code syntax** (hotkey `2`). Pick Web, Android or iOS, and Names (to use in components) or Definitions (a theme file that keeps the Foundation → Alias → Mapped chain). Pick a tier or folder in the tree, then copy one line, the folder, or everything. The details panel's **View** button jumps here.

**Problems** (hotkey `0`, far right in the toolbar). Three checks, each with its tokens in cards by folder:
- Dark = Light
- duplicate code syntax
- missing code syntax

A **Notes** group below lists, for reference only, mapped tokens that skip Alias, the utility colors that use the same values in Light and Dark, and aliases no mapped token uses.

## Project layout

```
src/template.html     page: CSS, markup and app script, with a /*DATA*/ marker
src/data.js           snapshot of the variables (window.WATERFALL)
src/codesyntax.js     code syntax generator (pure, unit-tested)
tests/                node --test tests/*.test.js
scripts/build.py      inlines data.js and codesyntax.js into the template -> dist/index.html
scripts/export-figma.js  read-only Figma export, one collection per call
scripts/convert-export.js  turns the four exports into src/data.js
dist/index.html       built, self-contained page (what gets published)
CLAUDE.md             notes for Claude to resume work
```

## Build

```bash
python3 scripts/build.py
```

Open `dist/index.html` in a browser, or publish it as an artifact.

## Refresh the data

Run `scripts/export-figma.js` through the Figma MCP `use_figma` tool against file `oCjWQuQcYhos1Y9iW77TVs`, four times (`PART` = `F`, `A`, `M1`, `M2`). Save the results as `F.txt`, `A.txt`, `M1.txt`, `M2.txt`, then run `node scripts/convert-export.js <folder>` to write `src/data.js`, and rebuild. The full steps are in `CLAUDE.md`.
