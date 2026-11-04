// Unit tests for src/codesyntax.js against the real snapshot in src/data.js.
// Run: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

globalThis.window = {};
require(path.join(__dirname, "../src/data.js"));
const CS = require(path.join(__dirname, "../src/codesyntax.js"));
const m = CS.buildModel(window.WATERFALL);
// key of the token with this name; Foundation and Alias share some names, so prefer the given tier
const key = (name, tier) => {
  const t = m.tokens.find(x => x.name === name && (!tier || x.tier === tier)) || m.tokens.find(x => x.name === name);
  if (!t) throw new Error("no token " + name);
  return t.k;
};

test("model tiers", () => {
  assert.deepEqual(m.tiers.map(t => [t.name, t.count]), [["Foundation", 143], ["Alias", 157], ["Mapped", 190], ["Components", 139]]);
});

test("resolve light/dark", () => {
  assert.equal(CS.resolve(m, m.byKey[key("text/default/body")].L, false), "#141414FF");
  assert.equal(CS.resolve(m, m.byKey[key("text/default/body")].D, true), "#ECECECFF");
  assert.equal(CS.resolve(m, m.byKey[key("miscellaneous/scrim")].L, false), "#14141499");
  assert.equal(CS.resolve(m, m.byKey[key("components/button/primary/surface")].D, true), "#FDE6E6FF");
});

test("names per platform", () => {
  const k = [key("text/default/body")], only = l => CS.toText(l.filter(x => x.k));
  assert.equal(only(CS.namesLines(m, k, "web")), "var(--ga-color-text-body)");
  assert.equal(only(CS.namesLines(m, k, "android")), "R.color.ga_color_text_body");
  assert.equal(only(CS.namesLines(m, k, "ios")), ".gaColorTextBody");
});

// ---------- Task 2: Web definitions ----------
const L = (name, opts = { full: false }) => CS.toText(CS.defLines(m, [key(name, "Alias")], "web", opts));
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
  const t = CS.toText(CS.defLines(m, m.tokens.map(x => x.k), "web", { full: true }));
  assert.ok(t.startsWith(":root {")); assert.match(t, /\n\}\n\[data-theme="dark"\] \{\n/); assert.ok(t.trimEnd().endsWith("}"));
});

// ---------- Task 3: Android definitions ----------
const A = (name, file, full = false) => CS.toText(CS.defLines(m, [key(name, "Alias")], "android", { full, file }));
test("android: chain + ARGB", () => {
  assert.match(CS.toText(CS.defLines(m, [key("grey/100", "Foundation")], "android", { file: "light" })), /<color name="ga_color_grey_100">#FF141414<\/color>/);
  assert.match(A("text/body", "light"), /<color name="ga_color_alias_text_body">@color\/ga_color_grey_100<\/color>/);
  assert.match(A("surface/overlay/overlay-hover", "light"), />#40330000</);
  assert.match(A("overlay/light", "light"), />#916C6C6C</);
});
test("android: night file only holds tokens that change", () => {
  assert.match(A("text/default/body", "night"), /<color name="ga_color_text_body">@color\/ga_color_grey_10<\/color>/);
  assert.match(A("components/button/primary/surface", "night"), /ga_color_surface_button_primary">@color\/ga_color_surface_action</);
  assert.equal(CS.toText(CS.defLines(m, [key("grey/100", "Foundation")], "android", { file: "night" })).includes("<color"), false);
});
test("android: opacity is baked", () => assert.match(A("miscellaneous/scrim", "light"), /ga_color_miscellaneous_overlay">#99141414</));
test("android: full file wrapper", () => {
  const t = CS.toText(CS.defLines(m, m.tokens.map(x => x.k), "android", { full: true, file: "light" }));
  assert.ok(t.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<resources>')); assert.ok(t.trimEnd().endsWith("</resources>"));
});

// ---------- Task 4: iOS definitions ----------
const I = (name, full = false) => CS.toText(CS.defLines(m, [key(name, "Alias")], "ios", { full }));
test("ios: foundation, alias, alpha", () => {
  assert.match(CS.toText(CS.defLines(m, [key("grey/100", "Foundation")], "ios", {})), /static let gaColorGrey100 = Color\(hex: 0x141414\)/);
  assert.match(I("text/body"), /static let gaColorAliasTextBody = Color\.gaColorGrey100/);
  assert.match(I("overlay/light"), /static let gaColorAliasOverlayLight = Color\(hex: 0x6C6C6C, alpha: 0\.569\)/);
});
test("ios: light/dark and opacity", () => {
  assert.match(I("text/default/body"), /static let gaColorTextBody = Color\(light: \.gaColorAliasTextBody, dark: \.gaColorGrey10\)/);
  assert.match(I("components/button/primary/surface"), /static let gaColorSurfaceButtonPrimary = Color\.gaColorSurfaceAction$/m);
  assert.match(I("miscellaneous/scrim"), /static let gaColorMiscellaneousOverlay = Color\.gaColorGrey100\.opacity\(0\.6\)/);
});
test("ios: helpers only in full", () => {
  assert.equal(CS.toText(CS.defLines(m, [key("grey/100", "Foundation")], "ios", {})).includes("UIColor"), false);
  const t = CS.toText(CS.defLines(m, m.tokens.map(x => x.k), "ios", { full: true }));
  assert.ok(t.startsWith("import SwiftUI")); assert.equal(t.split("init(light:").length - 1, 1);
});

// ---------- Task 5: duplicates ----------
test("no duplicate names today", () => { for (const p of ["web", "android", "ios"]) assert.deepEqual(CS.duplicates(m, p), []); });
test("duplicates are detected", () => {
  const m2 = structuredClone(m); m2.tokens[1].web = m2.tokens[0].web;
  assert.equal(CS.duplicates(m2, "web").length, 1);
});

// ---------- Final fix: search on the Code syntax page matches like the waterfall search ----------
test("matches: hex (with or without #) and code syntax", () => {
  const grey = m.byKey[key("grey/100", "Foundation")];
  assert.ok(CS.matches(m, grey, ["#141414"]));
  assert.ok(CS.matches(m, grey, ["grey_100"]));
  assert.ok(CS.matches(m, m.byKey[key("text/default/body")], ["ececec"]));  // its Dark value
  assert.equal(CS.matches(m, grey, ["zzz"]), false);
});

// ---------- Minor fixes ----------
test("names: folder headers in each platform's comment style", () => {
  const ks = [key("text/default/body"), key("grey/100", "Foundation")];
  const w = CS.namesLines(m, ks, "web"), a = CS.namesLines(m, ks, "android"), i = CS.namesLines(m, ks, "ios");
  assert.deepEqual(w.filter(l => !l.k).map(l => l.text), ["/* Foundation · grey */", "/* Mapped · text/default */"]);
  assert.equal(a.find(l => !l.k).text, "// Foundation · grey");
  assert.equal(i.find(l => !l.k).text, "// Foundation · grey");
});
test("ios: alpha to 3 decimals", () => assert.match(I("surface/overlay/overlay-disabled"), /alpha: 0\.698\)/));
test("ios: Light/Dark helper resolves the chosen color for the trait", () => assert.match(CS.IOS_HELPERS, /\.resolvedColor\(with: t\)/));
test("dark output: full web dark block and android night file", () => {
  const all = m.tokens.map(x => x.k), web = CS.toText(CS.defLines(m, all, "web", { full: true }));
  const dark = web.slice(web.indexOf('[data-theme="dark"]'));
  assert.match(dark, /--ga-color-surface-button-primary: var\(--ga-color-surface-action\);/);
  assert.equal(dark.includes("--ga-color-miscellaneous-overlay:"), false);  // scrim: same in both modes
  assert.equal(dark.includes("--ga-color-surface-overlay-hover:"), false);
  const night = CS.toText(CS.defLines(m, all, "android", { full: true, file: "night" }));
  assert.match(night, /ga_color_surface_button_primary">@color\/ga_color_surface_action</);
  assert.equal(night.includes("ga_color_miscellaneous_overlay"), false);
});
test("full files: every reference is defined", () => {
  const all = m.tokens.map(x => x.k);
  const css = CS.toText(CS.defLines(m, all, "web", { full: true }));
  const declared = new Set([...css.matchAll(/^\s*(--[\w-]+):/gm)].map(x => x[1]));
  for (const [, ref] of css.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(declared.has(ref), "css ref " + ref);
  for (const line of css.split("\n")) assert.match(line, /^(:root \{|\[data-theme="dark"\] \{|\}|  \/\* .* \*\/|  --[\w-]+: [^;]+;)$/, "css line: " + line);
  const light = CS.toText(CS.defLines(m, all, "android", { full: true, file: "light" }));
  const names = new Set([...light.matchAll(/<color name="(\w+)">/g)].map(x => x[1]));
  for (const f of ["light", "night"]) for (const [, ref] of CS.toText(CS.defLines(m, all, "android", { full: true, file: f })).matchAll(/@color\/(\w+)/g)) assert.ok(names.has(ref), f + " ref " + ref);
  const swift = CS.toText(CS.defLines(m, all, "ios", { full: true }));
  const lets = new Set([...swift.matchAll(/static let (\w+) =/g)].map(x => x[1]));
  for (const [, ref] of swift.matchAll(/(?:Color\.|[(\s]\.)(gaColor\w+)/g)) assert.ok(lets.has(ref), "swift ref " + ref);
});

// ---------- Known Dark = Light utilities still get their Dark entry ----------
test("known Dark=Light utilities are printed in the dark output", () => {
  const k = key("utility/red", "Mapped"), c = key("components/utility/red/border");
  assert.ok(CS.KNOWN_DARK_SAME.test("utility/red-accent") && CS.KNOWN_DARK_SAME.test("components/utility/purple/icon") && !CS.KNOWN_DARK_SAME.test("utility/teal"));
  assert.ok(CS.darkKeys(m).includes(k) && CS.darkKeys(m).includes(c));
  assert.match(CS.toText(CS.defLines(m, [k], "web", {})), /Dark[\s\S]*--ga-color-utility-red: var\(--ga-color-alias-utility-red\);/);
  assert.match(CS.toText(CS.defLines(m, [c], "android", { file: "night" })), /ga_color_utility_red_border">@color\/ga_color_utility_red</);
  assert.match(CS.toText(CS.defLines(m, [k], "ios", {})), /static let gaColorUtilityRed = Color\(light: \.gaColorAliasUtilityRed, dark: \.gaColorAliasUtilityRed\)/);
});
