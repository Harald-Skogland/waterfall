# Scarlet Token Waterfall: notes for Claude

## What this is
- **The page:** a single-file web page that visualises the color variables of the Figma file **Gaia UI Kit – Scarlet Playground** (fileKey `oCjWQuQcYhos1Y9iW77TVs`, main branch, called "playground" by the user).
- **Where it's published:** as a private Claude artifact at https://claude.ai/artifact/6eiHzXXDcqcrCyyFPAsk3X. Republish to that URL; never create a new artifact for updates.
- **Who it's for:** the user (Harald, UX / design-system owner for Scarlet) and the Scarlet team.

## Files
- `src/template.html`: the whole page (CSS tokens, markup, app script) with a `/*DATA*/` marker. **Edit this, not dist.**
- `src/data.js`: `window.WATERFALL = { snapshot, F, A, M }`. The row formats are documented at the top of `scripts/export-figma.js`.
- `scripts/build.py`: run `python3 scripts/build.py` to produce two files.
  - `dist/index.html`: the standalone page for GitHub Pages, with a doctype, charset and base styles. The page needs `[hidden]{display:none!important}` from that base.
  - `dist/artifact.html`: the same page without a skeleton. **Publish this one as the Claude artifact.**
- Commit `dist/` after every build.

## Workflow for a change
1. Edit `src/template.html`.
2. Run `python3 scripts/build.py`.
3. Syntax-check the script:
   `node -e "const s=require('fs').readFileSync('dist/index.html','utf8');new Function(s.split('<script>')[1].split('</script>')[0]);console.log('ok')"`
4. Publish `dist/artifact.html` with the Artifact tool, passing `url: https://claude.ai/artifact/6eiHzXXDcqcrCyyFPAsk3X`. From a new conversation, read the artifact first.
5. Commit and push.

## Refreshing the data from Figma
1. Load the `figma-use` skill.
2. Run `scripts/export-figma.js` with `use_figma` on `oCjWQuQcYhos1Y9iW77TVs`, three times, with `PART` set to `FA`, `M1` and `M2`. The tool caps returns at 48 KB.
3. Rebuild `src/data.js` from the three results:
   - shorten Mapped descriptions by cutting the "Light: … · Dark: …" endings;
   - leave the generic-alias boilerplate descriptions empty;
   - update `snapshot`.
4. Check that every ref resolves:
   `node -e "global.window={};require('./src/data.js');const d=window.WATERFALL;console.log(d.F.length,d.A.length,d.M.length)"`
5. Build and publish.

The export is read only. **Never change variables in Figma as part of work on this page.**

## How the app works (src/template.html)
**Model**
- Refs are parsed from strings like `A12` or `F11@60`; `chain()` resolves a ref down to a raw hex.
- Keys are `F<i>`, `A<i>`, `M<i>` (Light side of a mapped token) and `D<i>` (Dark side of the same token).
- Edges are `{from, to, m}`, with `m` = `A` (alias source), `L` (mapped Light) or `D` (mapped Dark). Dark edges show only when Display Dark mode is on.

**Columns**
- Foundation | Alias · generic | Alias · multipurpose | Mapped | Components. Components = mapped tokens under `components/`; Mapped = every other mapped token (the old `multi-purpose/` folder was ungrouped into the mapped root on 4 Nov 2026).
- Sourcing rule: a Components token may source from a Mapped token, never from another Components token. `chain(ref, dark)` follows a mapped source through its Dark value when `dark` is true (key `D<i>`), and Dark = Light only counts through a shared mapped source when that source is itself Dark = Light.
- Figma names: foundation and alias variables start with `color-foundation/` and `color-alias/` (formerly `color/`); the export strips either prefix.
- `colsFor(mode)` builds the column list. The Dark columns have class `darkcol` and are pulled close to their Light twin with a negative margin.
- Column headings are a separate overlay (`#heads`) outside the zoomed content. They are positioned by `placeHeads()`, which runs on scroll and on zoom.

**Zoom and drag**
- Zoom is a CSS transform on `#fall`; `#sizer` gets the scaled size.
- Link coordinates are divided by `zoom`.
- A press that moves more than 5 px pans and does not count as a click.

**Selection**
- `route(k)` walks up and down the edges.
- Only the route's links are drawn when something is selected.
- With nothing selected, links are drawn only when **Show all connections** is ticked.

**Hotkeys and storage**
- Hotkeys: `1` Waterfall, `2` Problems, `3` Display Dark mode, `Esc` clears the selection. Hotkeys are ignored while typing in a field.
- localStorage (wrapped in try/catch) remembers the mode (`wf2-mode`), zoom (`wf2-zoom`) and the wheel setting (`wf2-wheel`).

## Design decisions the user made (keep them)
**Theme and colors**
- The page is light theme only, on purpose, even in dark OS mode.
- Dark columns use a basic/black background.
- Token names on white are `#7A6E6D`; folder headers are grey/100 `#141414`.
- On black it's reversed: folder headers `#ECECEC`, token names `#A39796`.
- The selected route uses full ink.

**Swatches and fading**
- Swatches are always full opacity. Only labels fade, both for unused tokens and for tokens off the route.
- No rounded corners on the dark columns.

**Panel and layout**
- The trace panel sits fixed on the right, beside the waterfall pane and the same height as it.
- The waterfall pane scrolls inside itself, both ways.
- The panel moves below the waterfall only under 600 px.

**Controls**
- Button labels carry their hotkey in the text: "Waterfall (1)", "Problems (2)", "Display Dark mode (3)", "Clear selection (Esc)".
- "Show all connections" has no hotkey and is off by default.

**Problems page**
- One long page scroll, with no scrolling inside sections.
- Tokens appear in cards per folder that wrap responsively; duplicate code syntax gets one card per shared value.
- "Foundation colors not used" is not a problem, so it's not listed.

**Header**
- No "Gaia · Scarlet" eyebrow above the title.

## Working with this user
- They write "color" in UI text, although they personally prefer "colour".
- Shorthand: F/ = foundation, A/ = alias, M/ = mapped, L/ = the old legacy folder (now empty), M/multi = mapped `multi-purpose/`.
- A question is not a command: answer it, and change nothing unless asked.
- Keep replies short. Report what changed and anything they need to check.
- The related Figma printout of the waterfall lives on the page `_Color token waterfall` in the same Figma file. It is separate from this web page.

## GitHub and hosting
- **Repo:** https://github.com/Harald-Skogland/waterfall (public).
- **No brand names on the public face.** The repo name, the description and README.md must not mention Gaia, Scarlet or Visma. The page and the rest of the project may.
- **Hosting:** GitHub Pages at https://harald-skogland.github.io/waterfall/. `.github/workflows/pages.yml` builds `dist/` and deploys on every push to `main`, so pushing is enough to update the public page.
- **The Claude artifact** (https://claude.ai/artifact/6eiHzXXDcqcrCyyFPAsk3X) is a separate copy. Republish it too when the user wants it in sync.
