import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const dir = "components/ai-elements";

const walk = (d, out = []) => {
  for (const entry of readdirSync(d)) {
    const p = join(d, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(p);
  }
  return out;
};

const specifiers = (file) => {
  const src = readFileSync(file, "utf8");
  const found = [];
  for (const m of src.matchAll(/from\s+"([^"]+)"/g)) found.push(m[1]);
  return found;
};

const all = walk(join(root, dir)).map((p) => relative(root, p));
const byName = new Map(all.map((p) => [p.replace(/^components\/ai-elements\//, "").replace(/\.tsx?$/, ""), p]));

const outside = walk(root)
  .filter((p) => !p.includes("ai-elements") && !p.includes(".agents/") && !p.includes("node_modules/") && !p.includes("/.next/"));

const keep = new Set();
const queue = [];
for (const file of outside) {
  for (const spec of specifiers(file)) {
    const m = spec.match(/^@\/components\/ai-elements\/(.+)$/);
    if (m && byName.has(m[1])) queue.push(byName.get(m[1]));
  }
}
while (queue.length) {
  const file = queue.pop();
  if (keep.has(file)) continue;
  keep.add(file);
  for (const spec of specifiers(join(root, file))) {
    const m = spec.match(/^\.\/(.+)$/);
    if (m && byName.has(m[1])) queue.push(byName.get(m[1]));
  }
}

const kept = all.filter((p) => keep.has(p)).sort();
const dead = all.filter((p) => !keep.has(p)).sort();
console.log(`kept ${kept.length}`);
kept.forEach((p) => console.log(`  ${p}`));
console.log(`dead ${dead.length}`);
dead.forEach((p) => console.log(`  ${p}`));
