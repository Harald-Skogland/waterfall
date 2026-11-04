// Turn the four export-figma.js results into src/data.js.
//
// Usage:  node scripts/convert-export.js <folder with F.txt A.txt M1.txt M2.txt> [snapshot label]
//
// - Resolves every "@<variable id>" ref to an F<i> / A<i> / M<i> index (with "@<pct>" for opacity).
// - Keeps descriptions from the current src/data.js, matched by name.
// - Prints what changed in resolved Light/Dark colors and code syntax, compared with the current data.js.
const fs = require("fs"), path = require("path");
const dir = process.argv[2];
if (!dir) { console.error("Usage: node scripts/convert-export.js <folder> [snapshot label]"); process.exit(1); }
const root = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(dir, f), "utf8").trim().split("|").map(s => s.split("="));
const Fx = read("F.txt"), Ax = read("A.txt"), Mx = [...read("M1.txt"), ...read("M2.txt")];

const key = {};
Fx.forEach((r, i) => key[r[0]] = "F" + i); Ax.forEach((r, i) => key[r[0]] = "A" + i); Mx.forEach((r, i) => key[r[0]] = "M" + i);
const ref = s => {
  if (!s) return "";
  if (s[0] === "#") return s;
  const m = /^@([^%]+)(?:%(\d+))?$/.exec(s);
  const k = m && key[m[1]];
  if (!k) throw new Error("Unresolved ref " + s + " (points outside foundation/alias/mapped?)");
  return m[2] ? k + "@" + m[2] : k;
};

global.window = {};
require(path.join(root, "src/data.js"));
const OLD = window.WATERFALL;
const aDesc = Object.fromEntries(OLD.A.map(r => [r[0], r[3]])), mDesc = Object.fromEntries(OLD.M.map(r => [r[0], r[4]]));

// Row formats in data.js:
//   F: [name, "#hex", scopes, hidden, csAndroid, csIOS, csWeb]
//   A: [name, ref, csWeb, description, scopes, hidden, csAndroid, csIOS]
//   M: [name, Light ref, Dark ref, csWeb, description, scopes, hidden, csAndroid, csIOS]
// (the first columns keep their old positions so the page code stays simple)
const NEW = {
  F: Fx.map(r => [r[1], "#" + r[2], r[3], r[4], r[6], r[7], r[5]]),
  A: Ax.map(r => [r[1], ref(r[2]), r[5], aDesc[r[1]] ?? "", r[3], r[4], r[6], r[7]]),
  M: Mx.map(r => [r[1], ref(r[2]), ref(r[3]), r[6], mDesc[r[1]] ?? "", r[4], r[5], r[7], r[8]]),
};

// resolved color of a ref; dark = follow mapped sources through their Dark value
const resolve = (T, r, dark) => {
  let op = "";
  for (let g = 0; r && g < 15; g++) {
    if (r[0] === "#") return r + op;
    const m = /^([FAM])(\d+)(?:@(\d+))?$/.exec(r);
    if (m[3]) op = "@" + m[3];
    const row = T[m[1]][+m[2]];
    r = m[1] === "M" && dark ? row[2] : row[1];
  }
  return "?";
};
const changes = [];
for (const t of ["A", "M"]) {
  const old = Object.fromEntries(OLD[t].map((r, i) => [r[0], i]));
  NEW[t].forEach(r => {
    const j = old[r[0]];
    if (j === undefined) { changes.push(`new ${t} ${r[0]}`); return; }
    const o = OLD[t][j];
    const l0 = resolve(OLD, o[1], false), l1 = resolve(NEW, r[1], false);
    if (l0 !== l1) changes.push(`${t} ${r[0]} Light ${l0} → ${l1}`);
    if (t === "M") { const d0 = resolve(OLD, o[2], true), d1 = resolve(NEW, r[2], true); if (d0 !== d1) changes.push(`M ${r[0]} Dark ${d0} → ${d1}`); }
    const ci = t === "M" ? 3 : 2;
    if (o[ci] !== r[ci]) changes.push(`${t} ${r[0]} code syntax ${o[ci] || "(none)"} → ${r[ci] || "(none)"}`);
  });
  const now = new Set(NEW[t].map(r => r[0]));
  OLD[t].forEach(r => { if (!now.has(r[0])) changes.push(`removed ${t} ${r[0]}`); });
}

const label = process.argv[3] || OLD.snapshot;
const q = JSON.stringify;
fs.writeFileSync(path.join(root, "src/data.js"),
  `window.WATERFALL = {\nsnapshot: ${q(label)},\nF: ${q(NEW.F)},\nA: ${q(NEW.A)},\nM: ${q(NEW.M)}\n};\n`);
console.log(`Wrote src/data.js: ${NEW.F.length} foundation, ${NEW.A.length} alias, ${NEW.M.length} mapped`);
console.log(changes.length ? changes.join("\n") : "No color, code-syntax or name changes (order may differ).");
