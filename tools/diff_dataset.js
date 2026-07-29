// Diffs the previous dataset snapshot against the freshly built one and emits
// tools/patch-diff.json — the Patches tab renders it as "what changed".
// Called by the server's refresh pipeline (snapshot BEFORE, diff AFTER).
const fs = require('fs');
const path = require('path');

const prevPath = path.join(__dirname, 'dataset.prev.json');
const curPath = path.join(__dirname, '..', 'dataset.json');
const outPath = path.join(__dirname, 'patch-diff.json');

if (!fs.existsSync(prevPath) || !fs.existsSync(curPath)) {
  console.log('diff_dataset: nothing to compare (no snapshot)');
  process.exit(0);
}
const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
const cur = JSON.parse(fs.readFileSync(curPath, 'utf8'));

const FIELDS = {
  monsters: ['cost', 'tier', 'levels', 'ability', 'evolution', 'types', 'tags'],
  trainers: ['description', 'sets'],
  trinkets: ['description', 'tier', 'isUnique'],
  items: ['description', 'cost', 'tier'],
  events: ['description', 'options'],
};
const diff = { generatedAt: new Date().toISOString(), prevStamp: prev.generatedAt, curStamp: cur.generatedAt, sections: {} };
let total = 0;
for (const [sec, fields] of Object.entries(FIELDS)) {
  const o = Object.fromEntries((prev[sec] || []).map(x => [x.id, x]));
  const n = Object.fromEntries((cur[sec] || []).map(x => [x.id, x]));
  const added = Object.keys(n).filter(k => !o[k]).map(k => ({ id: k, name: n[k].name }));
  const removed = Object.keys(o).filter(k => !n[k]).map(k => ({ id: k, name: o[k].name }));
  const changed = [];
  for (const id of Object.keys(n)) {
    if (!o[id]) continue;
    const fs2 = fields.filter(f => JSON.stringify(o[id][f]) !== JSON.stringify(n[id][f]));
    if (fs2.length) changed.push({ id, name: n[id].name, fields: fs2 });
  }
  if (added.length || removed.length || changed.length) {
    diff.sections[sec] = { added, removed, changed };
    total += added.length + removed.length + changed.length;
  }
}
diff.total = total;
fs.writeFileSync(outPath, JSON.stringify(diff, null, 1));
console.log(`diff_dataset: ${total} change(s) → patch-diff.json`);
