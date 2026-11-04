// Code syntax generator for the Code syntax page. Pure: no DOM.
// Works in Node (module.exports, for tests/codesyntax.test.js) and in the page (window.CodeSyntax).
// Input is window.WATERFALL; row layouts are documented in scripts/convert-export.js.
(function (root) {
  const TIERS = ["Foundation", "Alias", "Mapped", "Components"];
  // utility red/orange/green/purple: known Dark = Light (no Dark values yet). Their Dark entry is still printed, so it's there to change.
  const KNOWN_DARK_SAME = /^(components\/)?utility\/(red|orange|green|purple)(-accent)?(\/|$)/;
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
  // names for use in code, grouped under "Tier · folder" comments in the platform's comment style
  function namesLines(model, keys, platform) {
    const want = new Set(keys), out = []; let last = null;
    const comment = s => platform === "web" ? "/* " + s + " */" : "// " + s;
    for (const t of model.tokens) {
      if (!want.has(t.k)) continue;
      const head = t.tier + " · " + (t.folder || "(root)");
      if (head !== last) { out.push({ k: null, text: comment(head) }); last = head; }
      const n = nameFor(t, platform);
      out.push({ k: t.k, text: platform === "web" ? "var(" + n + ")" : platform === "android" ? "R.color." + n : "." + n });
    }
    return out;
  }
  const toText = lines => lines.map(l => l.text).join("\n");

  // Mapped/Components tokens whose resolved Dark color differs from their resolved Light color
  function darkKeys(model) {
    return model.tokens.filter(t => t.D != null && (KNOWN_DARK_SAME.test(t.name) || resolve(model, t.L, false) !== resolve(model, t.D, true))).map(t => t.k);
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
  // iOS: SwiftUI Color extension (iOS 15+); helpers are only added to a full copy
  const IOS_HELPERS = [
    "extension Color {",
    "  init(hex: UInt32, alpha: Double = 1) {",
    "    self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: alpha)",
    "  }",
    "}",
    "extension Color {",
    "  init(light: Color, dark: Color) {",
    "    self.init(UIColor { t in (t.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)).resolvedColor(with: t) })",
    "  }",
    "}",
  ].join("\n");
  const hexExpr = raw => { const h = raw.length === 6 ? raw + "FF" : raw, a = Math.round(parseInt(h.slice(6), 16) / 255 * 1000) / 1000;
    return "Color(hex: 0x" + h.slice(0, 6) + (a < 1 ? ", alpha: " + a : "") + ")"; };
  // inner = inside Color(light:dark:), where members are written without the Color prefix
  const iosExpr = (model, ref, inner) => { const p = parse(ref);
    if (p.raw) return hexExpr(p.raw);
    return (inner ? "." : "Color.") + model.byKey[p.k].ios + (p.op != null ? ".opacity(" + p.op / 100 + ")" : ""); };
  const IOS = {
    comment: s => "// " + s,
    line: (t, v) => "static let " + t.ios + " = " + v,
    value: (model, p, dark, t) => t.D == null || (t.D === t.L && !KNOWN_DARK_SAME.test(t.name)) ? iosExpr(model, t.L, false)
      : "Color(light: " + iosExpr(model, t.L, true) + ", dark: " + iosExpr(model, t.D, true) + ")",
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
    if (platform === "ios") {
      const lines = section(model, keys, IOS, false, full ? "  " : "");
      return full ? [{ k: null, text: "import SwiftUI" }, { k: null, text: "" }, ...IOS_HELPERS.split("\n").map(text => ({ k: null, text })), { k: null, text: "" },
        { k: null, text: "extension Color {" }, ...lines, { k: null, text: "}" }] : lines;
    }
    throw new Error("unknown platform " + platform);
  }

  // search, same as the waterfall's: every term (a leading # is ignored) must appear in the name, a code syntax, or the Light/Dark hex
  function matches(model, t, terms) {
    const hex = [resolve(model, t.L, false), t.D != null ? resolve(model, t.D, true) : ""].map(h => h.slice(1, 7));
    const hay = [t.name, t.web, t.android, t.ios, ...hex].join(" ").toLowerCase();
    return terms.every(x => hay.includes(x.replace(/^#/, "").toLowerCase()));
  }

  // names shared by more than one token on a platform (those won't build on Android/iOS)
  function duplicates(model, platform) {
    const by = {};
    model.tokens.forEach(t => { const n = nameFor(t, platform); if (n) (by[n] = by[n] || []).push(t.k); });
    return Object.entries(by).filter(([, keys]) => keys.length > 1).map(([name, keys]) => ({ name, keys }));
  }

  const api = { buildModel, resolve, namesLines, toText, parse, nameFor, darkKeys, defLines, duplicates, matches, IOS_HELPERS, KNOWN_DARK_SAME };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CodeSyntax = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
