/* master_bench.js — build a per-day MASTER board-strength benchmark from the
 * 712-run Master-Ranked corpus (tools/runs-raw.json). For every WON board at each
 * day it computes a synergy-aware strength = Σ Engine.power(mon, level, {team,
 * day, trainerId}).total, then stores per-day percentiles (p25/p50/p75/p90).
 *
 * The LIVE cockpit computes your board's strength with the SAME metric
 * (window.Engine.power summed over the board) and reports where you land in the
 * day's distribution — "your day-N board vs a winning Master board". Apples-to-
 * apples because both sides use identical Engine.power scoring.
 *
 * Won boards only = the aspirational target ("to win at day N, be ~this strong").
 * Run from the repo root or tools/:  node tools/master_bench.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = fs.existsSync(path.join(process.cwd(), 'data.js')) ? process.cwd() : path.join(__dirname, '..');

// load data.js + engine.js into a shared vm context (same pattern as selftest_engine.js)
const sb = { window: {}, console };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'), sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine.js'), 'utf8'), sb);
// Apply the same live-patch overrides the app applies in the browser. Without
// this the baseline is built on the database's stale numbers while the app
// scores boards with the patched ones, skewing every "Board vs Master" percentile.
try {
  const po = require(path.join(ROOT, 'patch-overrides.js'));
  const res = po.applyPatchOverrides(sb.window.BATODEX, po.PATCH_OVERRIDES);
  if (res.applied.length) console.log(`[patch ${res.patch}] baseline built with ${res.applied.length} override(s)`);
} catch (e) { console.log('patch overrides not applied:', e.message); }
const E = sb.window.Engine, D = sb.window.BATODEX;
if (!E || !D) { console.error('failed to load engine/data'); process.exit(1); }

const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'runs-raw.json'), 'utf8'));
const runs = Array.isArray(RAW) ? RAW : (RAW.runs || Object.values(RAW)[0]);

// board strength = Σ over units of the engine's team-aware power at that day.
function boardStrength(board, day, trainerId) {
  const team = board.map(b => ({ monsterId: b.speciesId, level: b.level || 1, shiny: !!b.shiny }));
  let s = 0;
  for (const b of board) {
    const m = E.monster(b.speciesId);
    if (!m) continue;
    try { s += (E.power(m, b.level || 1, { team, day, shiny: !!b.shiny, trainerId }).total) || 0; } catch (e) {}
  }
  return s;
}

const byDay = {}; // day -> [strength, ...] over WON boards
let boards = 0;
for (const run of runs) {
  for (const r of (run.rounds || [])) {
    if (!r.won) continue;
    const board = (r.board || []).filter(b => b && b.speciesId);
    if (!board.length) continue;
    const st = boardStrength(board, r.round, run.trainerId);
    if (st > 0) { (byDay[r.round] = byDay[r.round] || []).push(st); boards++; }
  }
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return Math.round(s[Math.floor((s.length - 1) * p)]); };
const out = {
  generatedAt: new Date().toISOString(),
  source: 'runs-raw.json (Master-Ranked corpus), WON boards only',
  metric: 'sum of Engine.power(mon, level, {team, day, trainerId}).total over the board',
  runs: runs.length, boards,
  byDay: {},
};
Object.keys(byDay).map(Number).sort((a, b) => a - b).forEach(day => {
  const arr = byDay[day];
  if (arr.length < 8) return; // too few winning boards at this day to be meaningful
  out.byDay[day] = { n: arr.length, p25: pct(arr, 0.25), p50: pct(arr, 0.5), p75: pct(arr, 0.75), p90: pct(arr, 0.9) };
});

fs.writeFileSync(path.join(ROOT, 'master-bench.json'), JSON.stringify(out));
console.log(`wrote master-bench.json — ${Object.keys(out.byDay).length} days, ${boards} winning boards over ${runs.length} runs`);
console.log('sample:', [3, 6, 9, 12].map(d => out.byDay[d] ? `d${d} p50=${out.byDay[d].p50} (n=${out.byDay[d].n})` : `d${d} —`).join(' · '));
