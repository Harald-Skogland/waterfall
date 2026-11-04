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
- **Clear selection** clears it (`Esc`).

**Trace panel.** Fixed on the right. It shows the Light and Dark values, each route step by step, code syntax with a copy button, the description and flags.

**Zoom and pan.**
- Use − / + / Fit / 100% in the bottom-right corner of the pane.
- The mouse wheel zooms; this can be turned off.
- Click and drag to pan.

**Problems** (hotkey `2`). Five checks, each with its tokens in cards by folder:
- mapped tokens that skip Alias
- Dark = Light
- duplicate code syntax
- missing code syntax
- aliases no mapped token uses

## Project layout

```
src/template.html     page: CSS, markup and app script, with a /*DATA*/ marker
src/data.js           snapshot of the variables (window.WATERFALL)
scripts/build.py      inlines data.js into the template -> dist/index.html
scripts/export-figma.js  read-only Figma export used to refresh data.js
dist/index.html       built, self-contained page (what gets published)
CLAUDE.md             notes for Claude to resume work
```

## Build

```bash
python3 scripts/build.py
```

Open `dist/index.html` in a browser, or publish it as an artifact.

## Refresh the data

Run `scripts/export-figma.js` through the Figma MCP `use_figma` tool against file `oCjWQuQcYhos1Y9iW77TVs`, three times (`PART` = `FA`, `M1`, `M2`). Paste the results into `src/data.js` and rebuild. The full steps are in `CLAUDE.md`.
