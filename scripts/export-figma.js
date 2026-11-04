// Read-only export of the color variables in the Scarlet Playground Figma file.
// Run with the Figma MCP `use_figma` tool (fileKey oCjWQuQcYhos1Y9iW77TVs).
//
// use_figma returns at most 48 KB, so run it three times with PART set to
// "FA", "M1" and "M2", then paste the results into src/data.js:
//   F and A  -> window.WATERFALL.F / .A
//   M1 + M2  -> window.WATERFALL.M (concatenate, keep the order)
// Update window.WATERFALL.snapshot with the date.
//
// Row formats (all in Variables-panel order, color variables only):
//   F: [name without "color/", "#RRGGBB[AA]"]
//   A: [name without "color/", ref, WEB code syntax, description]
//   M: [full name, Light ref, Dark ref, WEB code syntax, description]
// A ref is "F12" / "A34" / "M5" (index into that list), "#RRGGBB[AA]" for a
// raw value, or "F11@60" for an alias with an opacity override (percent).
//
// Descriptions: in data.js the "Light: … · Dark: …" endings are cut off by hand
// (the page shows those values itself) and the boilerplate on generic aliases
// (primary, secondary, neutral, basic) is left empty. Do the same on refresh.

const PART = "FA"; // "FA" | "M1" | "M2"

const cols = await figma.variables.getLocalVariableCollectionsAsync();
const all = await figma.variables.getLocalVariablesAsync();
const byId = Object.fromEntries(all.map(v => [v.id, v]));
const F = cols.find(c => c.name === "foundation"), A = cols.find(c => c.name === "alias"), M = cols.find(c => c.name === "mapped");
const list = c => c.variableIds.map(id => byId[id]).filter(v => v && v.resolvedType === "COLOR");
const Fl = list(F), Al = list(A), Ml = list(M);
const idx = {}; Fl.forEach((v, i) => idx[v.id] = "F" + i); Al.forEach((v, i) => idx[v.id] = "A" + i); Ml.forEach((v, i) => idx[v.id] = "M" + i);
const hx = c => [c.r, c.g, c.b].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase()
  + ((c.a !== undefined && c.a < 1) ? Math.round(c.a * 255).toString(16).padStart(2, "0").toUpperCase() : "");
const ref = x => { if (!x) return ""; if (x.type === "VARIABLE_ALIAS") return idx[x.id] || "?";
  if (x.color?.type === "VARIABLE_ALIAS") return (idx[x.color.id] || "?") + "@" + Math.round(x.opacity);
  if ("r" in x) return "#" + hx(x); return "?"; };
const d = s => (s || "").replace(/\s+/g, " ").trim();
const mRow = v => [v.name, ref(v.valuesByMode[M.modes[0].modeId]), ref(v.valuesByMode[M.modes[1].modeId]), v.codeSyntax?.WEB || "", d(v.description)];

if (PART === "FA") return JSON.stringify({
  F: Fl.map(v => [v.name.replace(/^color\//, ""), ref(v.valuesByMode[F.modes[0].modeId])]),
  A: Al.map(v => [v.name.replace(/^color\//, ""), ref(v.valuesByMode[A.modes[0].modeId]), v.codeSyntax?.WEB || "", d(v.description)])
});
const half = Math.ceil(Ml.length / 2);
return JSON.stringify((PART === "M1" ? Ml.slice(0, half) : Ml.slice(half)).map(mRow));
