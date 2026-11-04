// Unit tests for src/codesyntax.js against the real snapshot in src/data.js.
// Run: node --test tests/
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
  const k = [key("text/default/body")];
  assert.equal(CS.toText(CS.namesLines(m, k, "web")), "var(--ga-color-text-body)");
  assert.equal(CS.toText(CS.namesLines(m, k, "android")), "R.color.ga_color_text_body");
  assert.equal(CS.toText(CS.namesLines(m, k, "ios")), ".gaColorTextBody");
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
