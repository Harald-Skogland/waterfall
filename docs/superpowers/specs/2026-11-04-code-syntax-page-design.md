# Code syntax page: design

Date: 2026-11-04 · Status: agreed with the user in brainstorming, not yet built.

## Intent

Developers need to find and copy the color tokens' code syntax for their platform as easily as possible. Today the code syntax shows only one token at a time, in the details panel. The new **Code syntax** page (tab "Code syntax (2)", hotkey `2`, hash `#code-syntax`; a placeholder already exists as `#v-code`) is where they copy it: one token, a folder, a tier, or everything.

Developers use the code syntax in two ways, and the page serves both:

1. **Using** a token in component code. They need only the token's name.
2. **Defining** the tokens in a theme file. They need every token with its value, and the user wants the values to **keep the chain, mirroring Figma**: Foundation is hex, Alias points at Foundation, Mapped points at Alias (or wherever it points), Components point at Mapped or Alias.

## Goals

- Pick one platform at a time: **Web, Android or iOS**. Platforms are never mixed in one copy.
- Pick what to copy: **Names** (for using tokens) or **Definitions** (for the theme file, chain kept).
- Copy at any size: a **single token**, a **folder**, a **tier** (Foundation / Alias / Mapped / Components), or **Copy all** for the current platform and mode.
- Always show the developer exactly what will be copied before they copy it.

## Non-goals

- Editing tokens or code syntax. The page is read-only, like the rest of the app.
- Mixing platforms, or offering a flattened "hex only" export. The user chose the chain explicitly.
- Changing the waterfall, the details panel or the Problems page.

## Anti-goals (a failure even if it works)

- A copy that doesn't paste and work. A definitions file must be valid for its platform.
- Output that breaks the chain where the platform can keep it.
- Reading Figma live. The page works only from the data snapshot (`src/data.js`), like the rest of the app.

## Decided by the user

- **Layout B: folder tree + code preview.**
  - **Left:** a folder tree with Foundation, Alias, Mapped and Components, each expanding into its folders, with counts.
  - **Right:** a code preview of the selected tier or folder, already in the chosen platform and mode, with a **Copy folder** button.
  - **Single tokens:** clicking a single line in the preview copies that one token.
- **Toolbar:** platform switch (Web / Android / iOS), mode switch (Names / Definitions), **Copy all**.
- **Definitions keep the chain.**
- **Default formats** (the user accepted these):
  - **Web:** CSS custom properties.
  - **Android:** XML color resources, `res/values/colors.xml` for Light plus `res/values-night/colors.xml` for Dark. Android swaps them by itself in Dark mode.
  - **iOS:** a SwiftUI `Color` extension, using `Color(light:dark:)` for tokens that change in Dark, with the two small helpers it needs included.
- **Partial copies are bare lines (decided 4 Nov).** A single token, folder or tier copies only its own lines, with no file wrapper and no helpers, ready to paste into a theme file the developer already has. Only **Copy all** produces a complete, self-contained file, with the wrapper, the helpers and every token.
- **Android shows two tabs (decided 4 Nov).** In Android Definitions mode, the preview has two tabs, `values/colors.xml` (Light) and `values-night/colors.xml` (Dark). Every copy button, including Copy all, acts on the tab that is showing.
- **Alias naming:** every alias now has code syntax. The 124 multipurpose aliases were given `--ga-color-alias-<path>` on 4 Nov 2026. Generic aliases keep their existing names, such as `--ga-color-brand-neutral-10` and `--ga-color-primary-90`.

## Data available (already in `src/data.js`)

Row layouts are documented in `scripts/convert-export.js`. Every Foundation, Alias and Mapped color has Web, Android and iOS code syntax:

| Platform | Format | Example |
|---|---|---|
| Web | `var(--…)` | `var(--ga-color-text-body)` |
| Android | snake_case | `ga_color_text_body` |
| iOS | camelCase | `gaColorTextBody` |

References between tokens are `F<i>` / `A<i>` / `M<i>` keys. `F11@60` means a source with a 60% opacity override, and `#hex` is a raw value. Mapped rows have a Light and a Dark reference. Components are the Mapped rows whose name starts with `components/`. They may reference Mapped-root tokens, never other Components.

## Output per platform

### Names mode

One name per line, in the platform's usage form.

| Platform | Form | Example |
|---|---|---|
| Web | `var(--…)`, as stored | `var(--ga-color-text-body)` |
| Android | `R.color.<snake>` | `R.color.ga_color_text_body` |
| iOS | `.<camel>` | `.gaColorTextBody` |

### Definitions mode

**Web**

```css
:root {
  --ga-color-grey-100: #141414;
  --ga-color-alias-text-body: var(--ga-color-grey-100);
  --ga-color-text-body: var(--ga-color-alias-text-body);
}
[data-theme="dark"] {
  --ga-color-text-body: var(--ga-color-grey-10);
}
```

- **Dark block** *(my call)*: it re-declares every Mapped and Components token whose **resolved Dark color** differs from its resolved Light color, not only the tokens whose own source changes. This keeps Dark correct wherever the app sets `data-theme="dark"`: on `<html>`, `body` or a container. A component like `--x: var(--ga-color-text-body)` is resolved where it's declared, so it has to be re-declared inside the Dark block.
- **Opacity override:** written as `color-mix(in srgb, var(--src) 60%, transparent)`, which keeps the chain.

**Android**

```xml
<!-- values/colors.xml -->
<color name="ga_color_grey_100">#141414</color>
<color name="ga_color_alias_text_body">@color/ga_color_grey_100</color>
<color name="ga_color_text_body">@color/ga_color_alias_text_body</color>
<!-- values-night/colors.xml -->
<color name="ga_color_text_body">@color/ga_color_grey_10</color>
```

- **Wrapper:** Copy all wraps each file in `<?xml version="1.0" encoding="utf-8"?><resources>…</resources>`. Partial copies are bare `<color>` lines.
- **Night file contents** *(my call)*: `values-night` lists the same tokens as the Web Dark block, meaning every token whose resolved Dark color differs.
- **Hex format:** Android writes colors as `#AARRGGBB`, with alpha first. Figma's `#RRGGBBAA` must be converted.
- **Opacity override:** `@color/` can't add opacity, so those few tokens get a baked-in `#AARRGGBB`. That is the one place the chain breaks.

**iOS**

```swift
extension Color {
  static let gaColorGrey100 = Color(hex: 0x141414)
  static let gaColorAliasTextBody = Color.gaColorGrey100
  static let gaColorTextBody = Color(light: .gaColorAliasTextBody, dark: .gaColorGrey10)
}
```

- **Helpers:** the output includes small `Color(hex:)` and `Color(light:dark:)` helpers, **in Copy all only** (partial copies are bare lines).
  - *(My call)* Target iOS 15+ with SwiftUI. `Color(light:dark:)` is built on `UIColor(dynamicProvider:)`, and `Color(hex:)` takes an optional alpha, because a few tokens are 8-digit hex (`overlay/light`, `surface/overlay/*`).
- **Opacity override:** `.opacity(0.6)` on the source, which keeps the chain.

### How each reference is written

| Reference | Written as |
|---|---|
| Alias | the alias's code syntax |
| Foundation (Mapped tokens that skip Alias) | the Foundation code syntax |
| Mapped (Components → Mapped) | the Mapped code syntax |
| Raw hex | a literal value |

## Behaviour

- **Toolbar:** Web / Android / iOS and Names / Definitions are segmented toggles. Copy all copies the complete output for the current platform and mode, every tier.
- **Tree:**
  - Tier and folder rows show a count.
  - Selecting a row shows its output in the preview.
  - The default selection is *(my call)* the Mapped tier.
- **Preview:**
  - The code is monospaced, with comment headers per folder.
  - Copy folder copies exactly what's shown.
  - Clicking a line copies that token. A short "Copied" confirmation appears on the line and on buttons, as the details panel's Copy already does.
- **Search** *(my call)*: the existing Search (S) filters the tree and the preview while the page is open.
- **Duplicate code syntax** *(my call)*: there are none today. If a future data refresh brings one back, the page shows a warning above the preview naming the clash, because Android and Swift won't build with duplicate names. Output is still generated.
- **Remembered** *(my call)*: platform and mode are remembered in localStorage, wrapped in try/catch like the existing `wf2-*` keys.

## Constraints

- **One file:** it stays a single-file page built from `src/template.html`.
  - No new libraries.
  - The page stays light theme only.
  - It follows the existing look: tabs, segmented controls, cards and colors.
- **Layout:** the page must work in the narrow app pane.
  - Under 600 px, the tree stacks above the preview.
- **Workflow:** edit `src/template.html`, build with `python3 scripts/build.py`, publish `dist/artifact.html`, then commit and push (see `CLAUDE.md`).

## Left to the builder

- Exact styling of the tree and the preview.
- How folders nest in the tree (one level per path segment, like the waterfall's groups).
- How a single line maps back to its token for click-to-copy.

## Calls I made (for the user to check)

- **Web Dark selector:** `[data-theme="dark"]` rather than `@media (prefers-color-scheme: dark)`.
- **Dark contents:** the Web Dark block and the Android `values-night` file re-declare every token whose resolved Dark color differs from Light, so they work wherever the Dark attribute is set.
- **iOS target:** iOS 15+ with SwiftUI; the helpers are built on `UIColor(dynamicProvider:)`.
- **Duplicates:** a future duplicate code syntax shows a warning, and the output is still generated.
- **Other defaults:**
  - The default selection is the Mapped tier.
  - Search filters the tree.
  - Platform and mode are remembered.
