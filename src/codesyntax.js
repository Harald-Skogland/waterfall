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

  // Mapped/Components tokens whose resolved Dark color differs from their resolved Light color
  function darkKeys(model) {
    return model.tokens.filter(t => t.D != null && resolve(model, t.L, false) !== resolve(model, t.D, true)).map(t => t.k);
  }

  // ---------- Definitions ----------
  // per platform: comment(text), line(token, value), value(token-ref parse result, dark)
  const WEB = {
    comment: s => "/* " + s + " */",
    line: (t, v) => t.web + ": " + v + ";",
    value: (model, p) => {
      if (p.raw) return "#" + p.raw;
      const src = "var(" + model.byKey[p.k].web + ")";
      return p.op != null ? "color-mix(in srgb, " + src + " " + p.op + "%, transparent)" : src;
    },
  };
  const argb = rgba => "#" + rgba.slice(7, 9) + rgba.slice(1, 7); // "#RRGGBBAA" -> "#AARRGGBB"
  const ANDROID = {
    comment: s => "<!-- " + s + " -->",
    line: (t, v) => '<color name="' + t.android + '">' + v + "</color>",
    value: (model, p, dark, t) => {
      if (p.raw) return argb(resolve(model, "#" + p.raw, dark));
      // @color/ can't add opacity: bake the resolved color for this mode
      if (p.op != null) return argb(resolve(model, dark ? t.D : t.L, dark));
      return "@color/" + model.byKey[p.k].android;
    },
  };
  // lines for keys (kept in model order), grouped under "Tier · folder" comments
  function section(model, keys, P, dark, indent) {
    const want = new Set(keys), out = []; let last = null;
    for (const t of model.tokens) {
      if (!want.has(t.k)) continue;
      const head = t.tier + " · " + (t.folder || "(root)");
      if (head !== last) { out.push({ k: null, text: indent + P.comment(head) }); last = head; }
      out.push({ k: t.k, text: indent + P.line(t, P.value(model, parse(dark ? t.D : t.L), dark, t)) });
    }
    return out;
  }

  function defLines(model, keys, platform, opts) {
    const full = !!(opts && opts.full), dk = new Set(darkKeys(model)), darkOnes = keys.filter(k => dk.has(k));
    if (platform === "web") {
      if (full) return [{ k: null, text: ":root {" }, ...section(model, keys, WEB, false, "  "), { k: null, text: "}" },
        { k: null, text: '[data-theme="dark"] {' }, ...section(model, darkOnes, WEB, true, "  "), { k: null, text: "}" }];
      const out = [{ k: null, text: WEB.comment("Light: paste into :root") }, ...section(model, keys, WEB, false, "")];
      if (darkOnes.length) out.push({ k: null, text: "" }, { k: null, text: WEB.comment('Dark: paste into [data-theme="dark"]') }, ...section(model, darkOnes, WEB, true, ""));
      return out;
    }
    if (platform === "android") {
      const night = opts && opts.file === "night", lines = section(model, night ? darkOnes : keys, ANDROID, night, full ? "    " : "");
      return full ? [{ k: null, text: '<?xml version="1.0" encoding="utf-8"?>' }, { k: null, text: "<resources>" }, ...lines, { k: null, text: "</resources>" }] : lines;
    }
    throw new Error("unknown platform " + platform);
  }

  const api = { buildModel, resolve, namesLines, toText, parse, nameFor, darkKeys, defLines };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CodeSyntax = api;
})(this);
