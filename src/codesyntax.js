// Code syntax generator for the Code syntax page. Pure: no DOM.
// Works in Node (module.exports, for tests/codesyntax.test.js) and in the page (window.CodeSyntax).
// Input is window.WATERFALL; row layouts are documented in scripts/convert-export.js.
(function (root) {
  const TIERS = ["Foundation", "Alias", "Mapped", "Components"];
  const parse = r => { if (!r) return null; if (r[0] === "#") return { raw: r.slice(1).toUpperCase() };
    const m = /^([FAM])(\d+)(?:@(\d+))?$/.exec(r); return m ? { k: m[1] + m[2], op: m[3] ? +m[3] : null } : null; };
  const stripVar = s => (s || "").replace(/^var\((.*)\)$/, "$1");

  function buildModel(T) {
    const tokens = [];
    const add = (k, tier, name, web, android, ios, L, D) => {
      const parts = name.split("/");
      tokens.push({ k, tier, name, folder: parts.slice(0, -1).join("/"), leaf: parts[parts.length - 1], web: stripVar(web), android: android || "", ios: ios || "", L, D });
    };
    T.F.forEach((r, i) => add("F" + i, "Foundation", r[0], r[6], r[4], r[5], r[1], null));
    T.A.forEach((r, i) => add("A" + i, "Alias", r[0], r[2], r[6], r[7], r[1], null));
    const mp = [], comp = [];
    T.M.forEach((r, i) => (r[0].startsWith("components/") ? comp : mp).push([r, i]));
    for (const [r, i] of [...mp, ...comp]) add("M" + i, r[0].startsWith("components/") ? "Components" : "Mapped", r[0], r[3], r[7], r[8], r[1], r[2]);
    const byKey = {}; tokens.forEach(t => byKey[t.k] = t);
    const tiers = TIERS.map(name => { const list = tokens.filter(t => t.tier === name), folders = [], at = {};
      list.forEach(t => { if (!(t.folder in at)) { at[t.folder] = folders.length; folders.push({ path: t.folder, keys: [] }); } folders[at[t.folder]].keys.push(t.k); });
      return { name, count: list.length, folders }; });
    return { tokens, byKey, tiers };
  }

  // "#RRGGBBAA"; in Dark a Mapped source is followed through its own Dark ref
  function resolve(model, ref, dark) {
    let p = parse(ref), alpha = 1;
    for (let g = 0; p && g < 20; g++) {
      if (p.op != null) alpha *= p.op / 100;
      if (p.raw) { const hex = p.raw.length === 6 ? p.raw + "FF" : p.raw;
        const a = Math.round(parseInt(hex.slice(6), 16) * alpha);
        return "#" + hex.slice(0, 6) + a.toString(16).padStart(2, "0").toUpperCase(); }
      const t = model.byKey[p.k];
      p = parse(dark && t.D != null ? t.D : t.L);
    }
    return "#00000000";
  }

  const nameFor = (t, platform) => platform === "web" ? t.web : platform === "android" ? t.android : t.ios;
  function namesLines(model, keys, platform) {
    return keys.map(k => { const t = model.byKey[k], n = nameFor(t, platform);
      return { k, text: platform === "web" ? "var(" + n + ")" : platform === "android" ? "R.color." + n : "." + n }; });
  }
  const toText = lines => lines.map(l => l.text).join("\n");

  const api = { buildModel, resolve, namesLines, toText, parse, nameFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CodeSyntax = api;
})(this);
