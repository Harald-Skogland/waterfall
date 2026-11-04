# Code syntax page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the placeholder Code syntax page (`#v-code`, hotkey `2`) with a folder tree and a code preview. From it, developers copy Names or chain-keeping Definitions for Web, Android or iOS: one token, a folder, a tier, or everything.

**Architecture:**
- **Generator:** all output is produced by a pure, DOM-free module, `src/codesyntax.js`, from the existing snapshot (`window.WATERFALL`). The module is unit-tested with `node --test`.
- **Build:** `scripts/build.py` inlines it into the page at a new `/*CODESYNTAX*/` marker, the same way `/*DATA*/` works today.
- **UI:** the page code in `src/template.html` only renders the tree, the preview and the toolbar from the module's output.

**Tech Stack:** plain JavaScript (no libraries), Node 24 `node:test` for tests, Python 3 build script, single-file HTML page.

**Spec:** `docs/superpowers/specs/2026-11-04-code-syntax-page-design.md`

## Global Constraints

- **Single-file page:** no new libraries, light theme only, and it follows the existing look (`.tabs`/`.seg` segmented controls, `.prob` cards, `.copy` buttons, CSS tokens in `:root`).
- **One platform at a time:** Web, Android or iOS, never mixed in one output.
- **Definitions keep the chain:**
  - Foundation is a hex value.
  - Alias points at its source.
  - Mapped and Components point at their source: an Alias, a Foundation (when the token skips Alias), or a Mapped token (Components → Mapped).
  - A raw hex stays a literal.
- **Partial copies are bare lines:** a single token, folder or tier copies its own lines only, with no wrapper and no helpers. Only Copy all is a complete file.
- **Web:**
  - Light goes in `:root { … }`, Dark in `[data-theme="dark"] { … }`.
  - Opacity override: `color-mix(in srgb, var(--src) 60%, transparent)`.
- **Android:**
  - `res/values/colors.xml` and `res/values-night/colors.xml`, using `@color/` references.
  - Hex is written `#AARRGGBB`.
  - An opacity override is baked into `#AARRGGBB`.
  - Copy all wraps each file in `<?xml version="1.0" encoding="utf-8"?>` + `<resources>…</resources>`.
- **iOS:**
  - A SwiftUI `extension Color { … }` targeting iOS 15+.
  - `Color(light:dark:)` is built on `UIColor(dynamicProvider:)`, and `Color(hex:alpha:)` takes an optional alpha.
  - The helpers are included in Copy all only.
  - Opacity override: `.opacity(0.6)`.
- **Dark contents:** the Web Dark block and the Android night file contain every Mapped or Components token whose **resolved** Dark color differs from its resolved Light color.
- **Names mode:** Web `var(--x)`, Android `R.color.x`, iOS `.x`.
- **Defaults:** the page opens on the Mapped tier.
  - localStorage keys `wf2-cs-platform` and `wf2-cs-mode`, each read and write wrapped in try/catch.
  - The existing Search (S) filters the tree and the preview while this page is open.
  - Under 600 px, the tree stacks above the preview.
- **Duplicate names:** if two tokens share a name on the current platform, show a warning above the preview naming the clash, and still generate the output.
- **Workflow:**
  1. Edit `src/template.html` and `src/codesyntax.js`.
  2. Run `python3 scripts/build.py`.
  3. Publish `dist/artifact.html` to `https://claude.ai/artifact/6eiHzXXDcqcrCyyFPAsk3X`.
  4. Commit and push; Pages deploys on push.

## Review Focus

1. **Components that point at a Mapped token whose own Dark changes.** `components/button/primary/surface` has the same reference in Light and Dark, but must appear in the Web Dark block and the Android night file. Pinned in Task 2 and Task 3.
2. **Raw 8-digit hex with alpha** (`surface/overlay/overlay-hover` = `#33000040`, `A/overlay/light` = `#6C6C6C91`):
   - Android must reorder it to `#AARRGGBB`.
   - iOS must split out the alpha.
   - Web keeps it as is.

   Pinned in Tasks 2–4.
3. **Opacity on a reference** (`miscellaneous/scrim` = `F grey/100 @60`):
   - Web: `color-mix`, keeping the chain.
   - Android: baked `#99141414`.
   - iOS: `.opacity(0.6)`.

   Pinned in Tasks 2–4.
4. **A Mapped token that skips Alias** (Dark of `text/default/body` = `F grey/10`): it must reference the Foundation name, not an alias. Pinned in Task 2.
5. **Search that matches nothing on the page:** the tree shows "No match", the preview is empty, and Copy folder is disabled. Copy all still copies everything. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/codesyntax.js` (create) | Pure generator: model, resolver, Names output, Definitions output per platform, duplicates. No DOM. Works in Node (`module.exports`) and in the browser (`window.CodeSyntax`). |
| `tests/codesyntax.test.js` (create) | `node --test` unit tests against the real `src/data.js`. |
| `scripts/build.py` (modify) | Also inline `src/codesyntax.js` at the `/*CODESYNTAX*/` marker. |
| `src/template.html` (modify) | `#v-code` markup and CSS, plus the page script: toolbar, tree, preview, copy, search hook, storage. |
| `CLAUDE.md`, `README.md` (modify) | Document the page, the module and the test command. |

---

### Task 1: Generator module, model and Names output

**Files:**
- Create: `src/codesyntax.js`
- Create: `tests/codesyntax.test.js`
- Modify: `scripts/build.py` (add a second marker); `src/template.html` (add a line `/*CODESYNTAX*/` directly after the existing `/*DATA*/` line at the top of the page `<script>`, before the app's `(function () {`)

**Interfaces:**
- Consumes: `window.WATERFALL = { snapshot, F, A, M }` with these row layouts:
  - `F = [name, "#hex", scopes, hidden, android, ios, web]`
  - `A = [name, ref, web, desc, scopes, hidden, android, ios]`
  - `M = [name, L, D, web, desc, scopes, hidden, android, ios]`
  - A ref matches `/^([FAM])(\d+)(?:@(\d+))?$/` or `#RRGGBB[AA]`.
  - Web code syntax is stored as `var(--x)`.
- Produces (on `CodeSyntax`):
  - `buildModel(T) -> Model`, where `Model = { tokens: Token[], byKey: {[k]: Token}, tiers: Tier[] }`.
    - `Token = { k: "F0"|"A3"|"M7", tier: "Foundation"|"Alias"|"Mapped"|"Components", name, folder, leaf, web /* "--x", var() stripped */, android, ios, L: ref, D: ref|null }`.
    - `Tier = { name, count, folders: [{ path, keys: string[] }] }`, with tiers in the order Foundation, Alias, Mapped, Components and folders in data order.
    - Components are `M` rows whose name starts with `components/`. `folder` is the name without its last segment.
  - `resolve(model, ref, dark: boolean) -> "#RRGGBBAA"`: 8 hex digits, uppercase. It follows refs, and in Dark it follows an `M` source's `D` ref. An `@n` opacity multiplies alpha by n/100.
  - `namesLines(model, keys: string[], platform: "web"|"android"|"ios") -> Line[]`, where `Line = { text: string, k: string|null }`.
  - `toText(lines: Line[]) -> string`: joins the lines with `"\n"`.

- [ ] **Step 1: Write the failing tests** in `tests/codesyntax.test.js`.

  Load `src/data.js` and `src/codesyntax.js` with `globalThis.window = {}; require(...)`, then add a helper `key(name)` that finds a token by name.

  ```js
  test("model tiers", () => {
    assert.deepEqual(m.tiers.map(t => [t.name, t.count]), [["Foundation",143],["Alias",157],["Mapped",190],["Components",139]]);
  });
  test("resolve light/dark", () => {
    assert.equal(CS.resolve(m, m.byKey[key("text/default/body")].L, false), "#141414FF");
    assert.equal(CS.resolve(m, m.byKey[key("text/default/body")].D, true), "#ECECECFF");
    assert.equal(CS.resolve(m, m.byKey[key("miscellaneous/scrim")].L, false), "#14141499");
    assert.equal(CS.resolve(m, m.byKey[key("components/button/primary/surface")].D, true), "#FDE6E6FF");
  });
  test("names per platform", () => {
    const k = [key("text/default/body")];
    assert.equal(CS.toText(CS.namesLines(m, k, "web")), "var(--ga-color-text-body)");
    assert.equal(CS.toText(CS.namesLines(m, k, "android")), "R.color.ga_color_text_body");
    assert.equal(CS.toText(CS.namesLines(m, k, "ios")), ".gaColorTextBody");
  });
  ```

- [ ] **Step 2: Run** `node --test tests/` and expect FAIL (`Cannot find module '../src/codesyntax.js'`).

- [ ] **Step 3: Implement** `buildModel`, `resolve`, `namesLines` and `toText` in `src/codesyntax.js`.
  - Wrap the module in `(function (root) { … if (typeof module !== "undefined") module.exports = api; else root.CodeSyntax = api; })(this);`.
  - Pad 6-digit hex with `FF`.
  - Round alpha to the nearest whole byte.

- [ ] **Step 4: Run** `node --test tests/` and expect PASS.

- [ ] **Step 5: Wire the build.**
  - In `scripts/build.py`, replace `/*CODESYNTAX*/` with the contents of `src/codesyntax.js`, and fail if the marker is missing, like the DATA check does.
  - Run `python3 scripts/build.py`, then the syntax check from `CLAUDE.md`.
  - Expect `ok`, and `CodeSyntax` defined in the page: open `http://localhost:4175/` via `preview_start {name:"waterfall"}` and evaluate `typeof CodeSyntax`, which should be `"object"`.

- [ ] **Step 6: Commit**

  ```bash
  git add src/codesyntax.js tests/codesyntax.test.js scripts/build.py src/template.html dist
  git commit -m "Code syntax: generator module with model, resolver and Names output"
  ```

### Task 2: Web Definitions

**Files:** Modify `src/codesyntax.js`, `tests/codesyntax.test.js`

**Interfaces:**
- Consumes: Task 1's `Model`, `resolve` and `Line`.
- Produces: `defLines(model, keys, platform, opts) -> Line[]`, with `opts = { full: boolean, file?: "light"|"night" }`. `file` is Android only and ignored elsewhere. Also `darkKeys(model) -> string[]`: every M key with `resolve(L,false) !== resolve(D,true)`, in data order.

Web rules:
- **Line format:** each token line is `--name: value;`.
  - The value is a hex as stored, `var(--src)` for a reference, or `color-mix(in srgb, var(--src) N%, transparent)` for an `@N` reference.
  - The source's name is that token's own Web name, whatever its tier.
- **Bare output** (`full: false`):
  - The Light lines of the requested keys, under a comment `/* Light: paste into :root */`.
  - If any requested key is in `darkKeys`, those keys' Dark lines follow under `/* Dark: paste into [data-theme="dark"] */`.
  - Folder comment headers (`/* Mapped · text/default */`) go before each folder's lines, with `k: null`.
- **Full output** (`full: true`): `:root {` with all tokens in tier order, indented two spaces, then `}`, then `[data-theme="dark"] {` with the `darkKeys` lines, then `}`.

- [ ] **Step 1: Write the failing tests**

  ```js
  const L = (name, opts={full:false}) => CS.toText(CS.defLines(m, [key(name)], "web", opts));
  test("web: alias keeps chain", () => assert.match(L("text/body"), /--ga-color-alias-text-body: var\(--ga-color-grey-100\);/));
  test("web: mapped light + dark (dark skips alias -> foundation)", () => {
    const t = L("text/default/body");
    assert.match(t, /--ga-color-text-body: var\(--ga-color-alias-text-body\);/);
    assert.match(t, /\/\* Dark: paste into \[data-theme="dark"\] \*\/\n(.*\n)*--ga-color-text-body: var\(--ga-color-grey-10\);/);
  });
  test("web: component pointing at a dark-changing mapped token is in the dark block", () => {
    assert.ok(CS.darkKeys(m).includes(key("components/button/primary/surface")));
    assert.match(L("components/button/primary/surface"), /Dark[\s\S]*--ga-color-surface-button-primary: var\(--ga-color-surface-action\);/);
  });
  test("web: opacity and raw hex", () => {
    assert.match(L("miscellaneous/scrim"), /--ga-color-miscellaneous-overlay: color-mix\(in srgb, var\(--ga-color-grey-100\) 60%, transparent\);/);
    assert.match(L("surface/overlay/overlay-hover"), /--ga-color-surface-overlay-hover: #33000040;/);
  });
  test("web: full file wraps", () => {
    const t = CS.toText(CS.defLines(m, m.tokens.map(x => x.k), "web", {full:true}));
    assert.ok(t.startsWith(":root {")); assert.match(t, /\n\}\n\[data-theme="dark"\] \{\n/); assert.ok(t.trimEnd().endsWith("}"));
  });
  ```

- [ ] **Step 2: Run** `node --test tests/` and expect the new tests to FAIL (`defLines is not a function`).
- [ ] **Step 3: Implement** `defLines` (the web branch) and `darkKeys` in `src/codesyntax.js`.
- [ ] **Step 4: Run** `node --test tests/` and expect PASS.
- [ ] **Step 5: Commit**: `git commit -am "Code syntax: Web definitions"`

### Task 3: Android Definitions

**Files:** Modify `src/codesyntax.js`, `tests/codesyntax.test.js`

**Interfaces:** Consumes `defLines`, `darkKeys` and `resolve`. Produces the `platform: "android"` branch of `defLines`, with `opts.file` set to `"light"` (`values/colors.xml`) or `"night"` (`values-night/colors.xml`).

Android rules:
- **Line format:** each token line is `<color name="android_name">value</color>`.
  - The value is `#AARRGGBB` for a hex, `@color/src_android_name` for a reference, or, for an `@N` reference, the resolved color (Light for the light file, Dark for the night file) baked into `#AARRGGBB`.
- **`file: "light"`:** every requested key's Light line.
- **`file: "night"`:** only the requested keys that are in `darkKeys`, each with its Dark value.
- **Comments:** headers are `<!-- Mapped · text/default -->`.
- **Full output:** the same lines wrapped in `<?xml version="1.0" encoding="utf-8"?>` / `<resources>` … `</resources>`, indented four spaces.

- [ ] **Step 1: Write the failing tests**

  ```js
  const A = (name, file, full=false) => CS.toText(CS.defLines(m, [key(name)], "android", {full, file}));
  test("android: chain + ARGB", () => {
    assert.match(A("grey/100","light"), /<color name="ga_color_grey_100">#FF141414<\/color>/);
    assert.match(A("text/body","light"), /<color name="ga_color_alias_text_body">@color\/ga_color_grey_100<\/color>/);
    assert.match(A("surface/overlay/overlay-hover","light"), />#40330000</);
    assert.match(A("overlay/light","light"), />#916C6C6C</);
  });
  test("android: night file only holds tokens that change", () => {
    assert.match(A("text/default/body","night"), /<color name="ga_color_text_body">@color\/ga_color_grey_10<\/color>/);
    assert.match(A("components/button/primary/surface","night"), /ga_color_surface_button_primary">@color\/ga_color_surface_action</);
    assert.equal(A("grey/100","night").includes("<color"), false);
  });
  test("android: opacity is baked", () => assert.match(A("miscellaneous/scrim","light"), /ga_color_miscellaneous_overlay">#99141414</));
  test("android: full file wrapper", () => {
    const t = CS.toText(CS.defLines(m, m.tokens.map(x => x.k), "android", {full:true, file:"light"}));
    assert.ok(t.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<resources>')); assert.ok(t.trimEnd().endsWith("</resources>"));
  });
  ```

- [ ] **Step 2: Run** `node --test tests/` and expect FAIL.
- [ ] **Step 3: Implement** the android branch of `defLines`.
- [ ] **Step 4: Run** `node --test tests/` and expect PASS.
- [ ] **Step 5: Commit**: `git commit -am "Code syntax: Android definitions"`

### Task 4: iOS Definitions

**Files:** Modify `src/codesyntax.js`, `tests/codesyntax.test.js`

**Interfaces:** Consumes `defLines` and `resolve`. Produces the `platform: "ios"` branch of `defLines`, plus `IOS_HELPERS: string`.

iOS rules:
- **Line format:** each token line is `static let iosName = expr`.
  - Foundation: `Color(hex: 0xRRGGBB)`, or `Color(hex: 0xRRGGBB, alpha: 0.57)` when the alpha isn't FF, rounded to 2 decimals.
  - A reference: `Color.src`, or `Color.src.opacity(0.6)` for `@60`.
  - A raw hex: the same form as Foundation.
  - A Mapped or Components token whose L ref equals its D ref: the single expression.
  - Otherwise: `Color(light: lightExpr, dark: darkExpr)`, where the inner expressions are written without the `Color` prefix (`.gaColorAliasTextBody`).
- **Comments:** headers are `// Mapped · text/default`.
- **Full output:** `import SwiftUI`, then `IOS_HELPERS`, then `extension Color {`, the lines indented two spaces, and `}`.
- **`IOS_HELPERS`:** exactly these two extensions.
  - `extension Color { init(hex: UInt32, alpha: Double = 1) { … } }`, using sRGB components from the hex.
  - `extension Color { init(light: Color, dark: Color) { self.init(UIColor { $0.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light) }) } }`.

- [ ] **Step 1: Write the failing tests**

  ```js
  const I = (name, full=false) => CS.toText(CS.defLines(m, [key(name)], "ios", {full}));
  test("ios: foundation, alias, alpha", () => {
    assert.match(I("grey/100"), /static let gaColorGrey100 = Color\(hex: 0x141414\)/);
    assert.match(I("text/body"), /static let gaColorAliasTextBody = Color\.gaColorGrey100/);
    assert.match(I("overlay/light"), /static let gaColorAliasOverlayLight = Color\(hex: 0x6C6C6C, alpha: 0\.57\)/);
  });
  test("ios: light/dark and opacity", () => {
    assert.match(I("text/default/body"), /static let gaColorTextBody = Color\(light: \.gaColorAliasTextBody, dark: \.gaColorGrey10\)/);
    assert.match(I("components/button/primary/surface"), /static let gaColorSurfaceButtonPrimary = Color\.gaColorSurfaceAction$/m);
    assert.match(I("miscellaneous/scrim"), /static let gaColorMiscellaneousOverlay = Color\.gaColorGrey100\.opacity\(0\.6\)/);
  });
  test("ios: helpers only in full", () => {
    assert.equal(I("grey/100").includes("UIColor"), false);
    const t = CS.toText(CS.defLines(m, m.tokens.map(x => x.k), "ios", {full:true}));
    assert.ok(t.startsWith("import SwiftUI")); assert.equal(t.split("init(light:").length - 1, 1);
  });
  ```

- [ ] **Step 2: Run** `node --test tests/` and expect FAIL.
- [ ] **Step 3: Implement** the iOS branch and `IOS_HELPERS`.
- [ ] **Step 4: Run** `node --test tests/` and expect PASS.
- [ ] **Step 5: Commit**: `git commit -am "Code syntax: iOS definitions"`

### Task 5: The page (toolbar, tree, preview, copy)

**Files:** Modify `src/template.html` (replace the `#v-code` placeholder markup, add CSS near the `.problems` rules, add the page script after `renderProblems`); Modify `src/codesyntax.js` and `tests/codesyntax.test.js` (only for `duplicates`).

**Interfaces:**
- Consumes: everything above, plus existing page helpers:
  - `$`, `esc`, `sw(css)`, and `val[k].css` for swatches;
  - the `#q` input, `setView`, and the `.copy` button pattern with `data-copy`.
- Produces:
  - `CodeSyntax.duplicates(model, platform) -> [{ name, keys }]`;
  - in the page, `renderCode()`, called from `setView("code")` and whenever a control, the tree selection or the search changes.

Page structure inside `#v-code`:
- **Toolbar:**
  - `.seg` with Web / Android / iOS;
  - `.seg` with Names / Definitions;
  - a primary **Copy all** button;
  - in Android Definitions only, a second `.seg` with `values/colors.xml` / `values-night/colors.xml`.
- **Two-column grid:** the tree on the left (~240 px) and the preview on the right. Under 600 px it's one column with the tree first.
- **Tree:**
  - Tier rows, with folder rows nested by path segment, each showing its count.
  - The selected row has `aria-current="true"`.
  - Default selection: the Mapped tier.
- **Preview:**
  - A header with the selection's name and a **Copy folder** button.
  - A `<pre>` with one element per `Line`. Lines with a `k` are `role="button"` and copy their own text on click. Header lines are plain.
- **Copy feedback:** the button text changes to "Copied" for 1.2 s.
  - Copy all uses `defLines(..., {full:true})` (or `namesLines` in Names mode) over all tokens, for the current platform and file.
- **Search:** while `view === "code"`, input in `#q` filters which tokens are listed, using the same AND-terms matching as the waterfall search (name + Web/Android/iOS names). The `#hits` dropdown stays hidden on this page.
  - Folders with no match disappear from the tree.
  - If nothing matches, show "No match", empty the preview and disable Copy folder. Copy all ignores the filter.
- **Duplicates:** if `duplicates(model, platform)` isn't empty, show a `.flag.warn` line above the preview: "Duplicate name on <platform>: <name> (<token names>)".
- **Storage:** `wf2-cs-platform` and `wf2-cs-mode` are read on load and written on change, each wrapped in try/catch.

- [ ] **Step 1: Write the failing test for `duplicates`**

  ```js
  test("no duplicate names today", () => { for (const p of ["web","android","ios"]) assert.deepEqual(CS.duplicates(m, p), []); });
  test("duplicates are detected", () => { const m2 = structuredClone(m); m2.tokens[1].web = m2.tokens[0].web; assert.equal(CS.duplicates(m2, "web").length, 1); });
  ```

- [ ] **Step 2: Run** `node --test tests/` and expect FAIL, then implement `duplicates` and expect PASS.

- [ ] **Step 3: Build the page markup, CSS and script** as described above. Reuse the existing `.seg`, `.copy`, `.prob` and `.flag` styles.

- [ ] **Step 4: Verify in the browser.**
  1. Run `python3 scripts/build.py`, then `preview_start {name:"waterfall"}`, then press `2`.
  2. With `javascript_tool`, check these:
     - The default tree selection is "Mapped", and the preview shows `var(--ga-color-text-body)` in Names / Web.
     - After clicking Android + Definitions + `values-night`, selecting the `components/button` folder lists `ga_color_surface_button_primary`.
     - Typing `zzz` in `#q` shows "No match" and disables Copy folder.
     - Clicking a preview line puts exactly that line on the clipboard: stub `navigator.clipboard.writeText` and read back the argument.
     - At a 375 px wide viewport the tree sits above the preview.
     - There are no console errors.
  3. Take a screenshot for the user.

- [ ] **Step 5: Commit**: `git add -A && git commit -m "Code syntax page: tree, preview, copy"`

### Task 6: Docs and publish

**Files:** Modify `CLAUDE.md` and `README.md`.

- [ ] **Step 1: Update the docs.**
  - **`CLAUDE.md`:** remove the "placeholder, don't add content" note. Describe `src/codesyntax.js` (API and row layouts), the `/*CODESYNTAX*/` marker, `node --test tests/` in the workflow before building, and the localStorage keys.
  - **`README.md`:** describe the Code syntax page in two or three lines, and add `src/codesyntax.js` and `tests/` to the project layout.
- [ ] **Step 2: Run** `node --test tests/` (all pass), then `python3 scripts/build.py`, then the syntax check.
- [ ] **Step 3: Publish** `dist/artifact.html` to the existing artifact URL.
- [ ] **Step 4: Commit and push**: `git add -A && git commit -m "Docs: Code syntax page" && git push`
