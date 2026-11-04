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
