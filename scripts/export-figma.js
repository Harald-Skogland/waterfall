// Read-only export of the color variables in the Scarlet Playground Figma file.
// Run with the Figma MCP `use_figma` tool (fileKey oCjWQuQcYhos1Y9iW77TVs).
//
// Run it four times, once per PART: "F", "A", "M1", "M2".
// Each call reads ONE collection, one variable at a time by ID. It never loads
// every variable in the file: those heavy calls time out on this file
// ("The connector's server returned an error").
// Only foundation, alias and mapped are read; .admin, .responsive,
// .AG Grid adapter and corner radius are never touched.
//
// Each call returns rows joined by "|", with fields joined by "=":
//   F:  id = name = RRGGBB[AA]               = scopes = hidden = WEB = ANDROID = iOS
//   A:  id = name = ref                      = scopes = hidden = WEB = ANDROID = iOS
//   M*: id = name = Light ref = Dark ref     = scopes = hidden = WEB = ANDROID = iOS
// scopes: short codes joined by "," (all, fills, frame, shape, text, stroke, effect);
// hidden: "1" when the variable is hidden from publishing, else empty;
// WEB / ANDROID / iOS: the variable's code syntax for that platform.
// A ref is "@<variable id>", "@<variable id>%<opacity>" for an alias with an
// opacity override, or "#RRGGBB[AA]" for a raw value. Ids have the
// "VariableID:" prefix removed. Names have the "color-foundation/",
// "color-alias/" (or old "color/") prefix removed.
//
// Save the four results as F.txt, A.txt, M1.txt and M2.txt in one folder, then
// run:  node scripts/convert-export.js <that folder>
// That turns the IDs into F/A/M refs and writes src/data.js. Descriptions are
// kept from the current src/data.js (matched by name), because data.js holds
// hand-shortened versions of them.

const PART = "F"; // "F" | "A" | "M1" | "M2"

const name = { F: "foundation", A: "alias", M1: "mapped", M2: "mapped" }[PART];
const col = (await figma.variables.getLocalVariableCollectionsAsync()).find(c => c.name === name);
const sid = id => id.replace("VariableID:", "");
const strip = n => n.replace(/^color(-foundation|-alias)?\//, "");
const hx = c => [c.r, c.g, c.b].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase()
  + ((c.a !== undefined && c.a < 1) ? Math.round(c.a * 255).toString(16).padStart(2, "0").toUpperCase() : "");
const ref = x => {
  if (!x) return "";
  if (x.type === "VARIABLE_ALIAS") return "@" + sid(x.id);
  if (x.color && x.color.type === "VARIABLE_ALIAS") return "@" + sid(x.color.id) + "%" + Math.round(x.opacity);
  if ("r" in x) return "#" + hx(x);
  return "?";
};
const SC = { ALL_SCOPES: "all", ALL_FILLS: "fills", FRAME_FILL: "frame", SHAPE_FILL: "shape", TEXT_FILL: "text", STROKE_COLOR: "stroke", EFFECT_COLOR: "effect" };
const meta = v => [(v.scopes || []).map(x => SC[x] || x).join(","), v.hiddenFromPublishing ? "1" : "",
  ...["WEB", "ANDROID", "iOS"].map(p => (v.codeSyntax && v.codeSyntax[p]) || "")];

let ids = col.variableIds;
if (PART === "M1" || PART === "M2") { const half = Math.ceil(ids.length / 2); ids = PART === "M1" ? ids.slice(0, half) : ids.slice(half); }
const [m0, m1] = col.modes.map(m => m.modeId);

const out = [];
for (const id of ids) {
  const v = await figma.variables.getVariableByIdAsync(id);
  if (!v || v.resolvedType !== "COLOR") continue;
  if (PART === "F") { const x = v.valuesByMode[m0]; out.push([sid(id), strip(v.name), x && "r" in x ? hx(x) : "?", ...meta(v)].join("=")); }
  else if (PART === "A") out.push([sid(id), strip(v.name), ref(v.valuesByMode[m0]), ...meta(v)].join("="));
  else out.push([sid(id), v.name, ref(v.valuesByMode[m0]), ref(v.valuesByMode[m1]), ...meta(v)].join("="));
}
return out.join("|");
