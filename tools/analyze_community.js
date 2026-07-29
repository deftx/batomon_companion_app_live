// Aggregates opt-in community ingests (runs-community.jsonl) → ../community.js
// Powers pool-size estimation (observed shop appearance rates) and community
// win-rates at v1. No-ops gracefully when there's no data yet.
const fs = require('fs');
const path = require('path');

const IN = path.join(__dirname, 'runs-community.jsonl');
const OUT = path.join(__dirname, '..', 'community.js');

if (!fs.existsSync(IN)) {
  fs.writeFileSync(OUT, 'window.COMMUNITY = null; // no community data yet — populates at v1 when ingestion is on\n');
  console.log('analyze_community: no ingest file — placeholder written');
  process.exit(0);
}
const lines = fs.readFileSync(IN, 'utf8').split('\n').filter(Boolean);
const pools = {}; // speciesId → {seen, shops}
const wr = {};    // speciesId → {w, n} (board presence on won/lost battles)
let totalShops = 0, runs = new Set();
for (const ln of lines) {
  let r; try { r = JSON.parse(ln); } catch (e) { continue; }
  runs.add(r.run);
  if (r.shops && r.shops.n) {
    // shops payloads are cumulative per run — keep the LATEST per run
    pools['__run_' + r.run] = r.shops;
  }
  for (const u of r.board || []) {
    if (!u || !u.id) continue;
    (wr[u.id] = wr[u.id] || { w: 0, n: 0 }).n++;
    if (r.won) wr[u.id].w++;
  }
}
// collapse per-run latest shops into global counts
const agg = {};
for (const [k, v] of Object.entries(pools)) {
  if (!k.startsWith('__run_')) continue;
  totalShops += v.n || 0;
  for (const [id, c] of Object.entries(v.c || {})) (agg[id] = agg[id] || 0), (agg[id] += c);
}
const out = {
  generatedAt: new Date().toISOString(),
  sample: { runs: runs.size, battles: lines.length, shops: totalShops },
  pools: Object.fromEntries(Object.entries(agg).map(([id, seen]) => [id, { seen, shops: totalShops }])),
  wr: Object.fromEntries(Object.entries(wr).filter(([, v]) => v.n >= 20).map(([id, v]) => [id, { w: v.w, n: v.n, pct: +(100 * v.w / v.n).toFixed(1) }])),
};
fs.writeFileSync(OUT, 'window.COMMUNITY = ' + JSON.stringify(out) + ';\n');
console.log(`analyze_community: ${runs.size} runs, ${lines.length} battles, ${totalShops} shops → community.js`);
