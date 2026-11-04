# Scarlet Token Waterfall: notes for Claude

## What this is
- **The page:** a single-file web page that visualises the color variables of the Figma file **Gaia UI Kit – Scarlet Playground** (fileKey `oCjWQuQcYhos1Y9iW77TVs`, main branch, called "playground" by the user).
- **Where it's published:** as a private Claude artifact at https://claude.ai/artifact/6eiHzXXDcqcrCyyFPAsk3X. Republish to that URL; never create a new artifact for updates.
- **Who it's for:** the user (Harald, UX / design-system owner for Scarlet) and the Scarlet team.

## Files
- `src/template.html`: the whole page (CSS tokens, markup, app script) with a `/*DATA*/` marker. **Edit this, not dist.**
- `src/codesyntax.js`: the pure generator behind the Code syntax page (`buildModel`, `resolve`, `namesLines`, `defLines`, `darkKeys`, `duplicates`, `toText`). It has no DOM. The build inlines it at the `/*CODESYNTAX*/` marker. Tests: `node --test tests/*.test.js` (run before building).
- `src/data.js`: `window.WATERFALL = { snapshot, F, A, M }`. The row formats are documented at the top of `scripts/export-figma.js`.
- `scripts/build.py`: run `python3 scripts/build.py` to produce two files.
  - `dist/index.html`: the standalone page for GitHub Pages, with a doctype, charset and base styles. The page needs `[hidden]{display:none!important}` from that base.
  - `dist/artifact.html`: the same page without a skeleton. **Publish this one as the Claude artifact.**
- Commit `dist/` after every build.

## Local preview
`.claude/launch.json` in `/Users/haraldskogland/claude-projects/navigation` has a `waterfall` entry: `python3 -m http.server 4175` serving `dist/`. Start it with the preview tool (`preview_start {name: "waterfall"}`) after building; the browser pane can't drive `file://` pages.

## Workflow for a change
1. Edit `src/template.html`.
2. Run `node --test tests/*.test.js`, then `python3 scripts/build.py`.
3. Syntax-check the script:
   `node -e "const s=require('fs').readFileSync('dist/index.html','utf8');new Function(s.split('<script>')[1].split('</script>')[0]);console.log('ok')"`
4. Publish `dist/artifact.html` with the Artifact tool, passing `url: https://claude.ai/artifact/6eiHzXXDcqcrCyyFPAsk3X`. From a new conversation, read the artifact first.
5. Commit and push.

## Refreshing the data from Figma
1. Load the `figma-use` skill.
2. Run `scripts/export-figma.js` with `use_figma` on `oCjWQuQcYhos1Y9iW77TVs`, four times, with `PART` set to `F`, `A`, `M1` and `M2`.
   - Each call reads one collection, variable by variable, by ID. **Don't go back to `getLocalVariablesAsync()` over the whole file**: on this file those heavy calls fail at random with "The connector's server returned an error".
   - Only foundation, alias and mapped are read. `.admin`, `.responsive`, `.AG Grid adapter` and `corner radius` are ignored until the user says otherwise.
3. Save the four results as `F.txt`, `A.txt`, `M1.txt`, `M2.txt` in one scratch folder.
4. Run `node scripts/convert-export.js <folder> "Gaia UI Kit – Scarlet Playground · <date>"`.
   - It resolves IDs to `F<i>` / `A<i>` / `M<i>` refs, keeps descriptions from the current `src/data.js` by name, writes `src/data.js`, and prints every resolved-color, code-syntax and name change.
   - Descriptions for new tokens come in empty; fill them in by hand if needed.
5. Build and publish.

**Verifying a local copy against Figma:** compare an order-independent fingerprint (hash of the rows sorted), and take the order separately as a list of variable ids. A few Mapped pairs (e.g. `icon/link` / `doc/spacing`) swap places in `variableIds` after unrelated writes, probably tied sort keys, so an order-dependent fingerprint gives false mismatches.

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
- Hotkeys: `1` Waterfall, `2` Code syntax, `0` Problems, `3` Display Dark mode, `S` focuses search, `Esc` clears the selection. Hotkeys are ignored while typing in a field.
- Views/hashes: `#waterfall`, `#code-syntax` (`#v-code`), `#problems`.
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

**Details (trace) panel**
- Routes read top to bottom: Foundation first, the selected token last (bold, not a link). Raw values are not a route step; the hex sits under the swatch.
- After the routes, in this order: Description, Scope (chips), Hide from publishing (Yes/No), Code syntax (Web, Android, iOS, each with Copy). For Foundation and Alias, Feeds directly and Ends up in follow.
- Feeds directly is a one-column list; item text aligns top left and wraps.
- Tags: "skips alias", "not used by mapped" and "Dark = Light (known)" (utility red/orange/green/purple) are neutral grey.
- Row layouts in data.js (incl. scopes, hidden, Android/iOS) are documented in `scripts/convert-export.js`.

**Controls**
- Button labels carry their hotkey in the text: "Waterfall (1)", "Code syntax (2)", "Display Dark mode (3)", "Clear (Esc)", "Problems (0)"; the search placeholder is "Search (S)".
- Header toolbar is three groups: left = Waterfall / Code syntax tabs + Display Dark mode; center = search (about 280 px), Clear, Show all connections; far right = Problems. Under 1200 px the center group moves to its own centered row.
- Search matches every typed word in any order (AND), across name, Light/Dark hex and Web/Android/iOS code syntax; up to 60 hits are listed, with a count when there are more.
- **Code syntax page** (`#code-syntax`):
  - Folder tree on the left, code preview on the right.
  - Toolbar: Web / Android / iOS, Names / Definitions, and Copy all. In Android Definitions, a `values/colors.xml` / `values-night/colors.xml` toggle.
  - Click a line to copy that token; Copy folder copies the preview. Partial copies are bare lines; only Copy all is a full file.
  - **Whole theme** (top of the tree) previews exactly what Copy all copies (full file, unfiltered); its header button reads Copy all.
  - Lines show a "Copy" badge at the far right on hover, which turns into "Copied" on click. The View arrival highlight is a blue band with a left accent bar, held for 4 s.
  - All copying goes through `copyText()`, which uses the Clipboard API and falls back to a hidden textarea + `execCommand` where the API is blocked (sandboxed frames, the app's browser pane).
  - The code pane is IDE style and always dark (light text on `#141414`, green comments, blue token names), whatever the page theme.
  - The known Dark = Light utilities (`CodeSyntax.KNOWN_DARK_SAME`: utility red/orange/green/purple in Mapped and Components) always get a Dark entry: in the Web Dark block, the Android night file, and as `Color(light:dark:)` on iOS, even though Dark equals Light. The same pattern drives the Problems page's Notes section.
  - Names output carries folder comment headers too (`/* … */` on Web, `// …` on Android/iOS).
  - Search (S) filters the tree on this page; Esc clears the search here (on the Waterfall, Esc clears the selection).
  - localStorage keys `wf2-cs-platform` and `wf2-cs-mode`.
  - Design and plan: `docs/superpowers/specs/2026-11-04-code-syntax-page-design.md` and `docs/superpowers/plans/2026-11-04-code-syntax-page.md`.
- Details panel: each code syntax row has Copy and **View**. View opens the token's folder on the Code syntax page, in Names mode, with its line highlighted (`openInCode(k, platform)`).
- "Show all connections" has no hotkey and is off by default.

**Problems page**
- Two groups: **Problems** first, then **Notes**. Notes are listed for reference and are not issues. "Mapped tokens that skip Alias" lives under Notes, with a neutral grey count and a neutral "skips alias" tag in the trace panel. "Utility red, orange, green and purple use the same values in Light and Dark" is also a Notes section (20 tokens: 8 in Mapped utility, 12 in components/utility). Those tokens are left out of Dark = Light; the user calls it a known inconsistency, so don't suggest fixing it. "Aliases not used by any mapped token" is a Notes section too (neutral "not used by mapped" tag in the trace panel).
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
- There used to be a static Figma printout of the waterfall on a page `_Color token waterfall`. The user had it deleted on 4 Nov 2026 as obsolete; this web page replaces it. Don't rebuild it unless asked.

## GitHub and hosting
- **Repo:** https://github.com/Harald-Skogland/waterfall (public).
- **No brand names on the public face.** The repo name, the description and README.md must not mention Gaia, Scarlet or Visma. The page and the rest of the project may.
- **Hosting:** GitHub Pages at https://harald-skogland.github.io/waterfall/. `.github/workflows/pages.yml` builds `dist/` and deploys on every push to `main`, so pushing is enough to update the public page.
- **The Claude artifact** (https://claude.ai/artifact/6eiHzXXDcqcrCyyFPAsk3X) is a separate copy. Republish it too when the user wants it in sync.
