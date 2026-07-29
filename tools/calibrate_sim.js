/* calibrate_sim.js — the honest SCOREBOARD for the battle sim.
 *
 * Replays every board in the Master-Ranked corpus (tools/runs-raw.json) through
 * the EXACT prediction path the live Battle Brain uses — boardOutputs →
 * buildEventSpecs → E.simEvents vs the day-average enemy, 100-draw Monte-Carlo
 * winProb — and compares the predicted win% to what actually happened (round.won).
 *
 * FAITHFULNESS: app.js is loaded headless in a vm (permissive DOM stubs) and its
 * private prediction core is captured via the browser-inert `module.exports` hook
 * at the end of the IIFE — so this harness calls the SAME functions the UI does and
 * can never drift from the live model.
 *
 * KEY FINDING (2026-07-24): on this corpus the sim's win% is ~BLIND to the outcome
 * — AUC ≈ 0.52, and every predicted bucket's ACTUAL win-rate hugs the ~63% base
 * rate. That's not a sim bug: ranked matchmaking pairs similar-strength boards and
 * the real OPPONENT isn't recorded, so the board alone can't explain the win/loss.
 * => The corpus CANNOT calibrate the sim, and NO live prior is derived from it.
 * Self-calibration stays on the player's OWN battles (calibrationCorrection), which
 * carry the real outcome. This tool is therefore a REGRESSION/SANITY canary:
 *   - a Brier/AUC that suddenly craters flags a broken boardOutputs/sim change;
 *   - the SCALE diagnostic shows the dayProfiles enemy drifting ~2.5× too strong by
 *     late game vs the boardOutputs metric (a real model inconsistency to review).
 *
 * Output: tools/sim-diagnostic.json  (metrics + reliability curve + verdict).
 *
 * Run:  node tools/calibrate_sim.js            (from repo root or tools/)
 *       node tools/calibrate_sim.js --quick    (first 40 runs — smoke test)
 *       ENEMY=consistent node tools/calibrate_sim.js   (boardOutputs-derived enemy)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = fs.existsSync(path.join(process.cwd(), 'data.js')) ? process.cwd() : path.join(__dirname, '..');
const QUICK = process.argv.includes('--quick');
const MC = 100;            // Monte-Carlo draws per board — matches the Battle Brain's winProb (N=100)
const MAX_DAY = 15;        // dayProfiles cap; day>15 is off-balance extended mode → excluded
const NOISE = { foe: 0.12, own: 0.08 }; // winProb defaults (no bc_simnoise fit in the harness)

// ---------- headless DOM / window stubs (just enough that app.js loads) ----------
// a live-collection stub: any numeric index yields a no-op element (so
// `nav.children[i].click()` never throws), length 0, iterates empty.
const elList = () => new Proxy([], {
  get(t, p) {
    if (p === 'length') return 0;
    if (typeof p === 'string' && /^\d+$/.test(p)) return makeEl();
    if (p === Symbol.iterator) return t[Symbol.iterator].bind(t);
    return t[p];
  },
});
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), nodeType: 1,
    style: new Proxy({}, { get: () => '', set: () => true }),
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {}, children: elList(), childNodes: elList(), attributes: [],
    firstChild: null, lastChild: null, parentNode: null, nextSibling: null, previousSibling: null,
    innerHTML: '', outerHTML: '', textContent: '', innerText: '', value: '', checked: false,
    className: '', id: '', href: '', src: '', title: '', disabled: false,
    width: 0, height: 0, offsetWidth: 0, offsetHeight: 0, clientWidth: 0, clientHeight: 0,
    scrollHeight: 0, scrollTop: 0, scrollWidth: 0, selectionStart: 0, selectionEnd: 0,
    appendChild: (c) => c, append: () => {}, prepend: () => {}, removeChild: (c) => c, remove: () => {},
    insertBefore: (c) => c, replaceChild: (c) => c, replaceChildren: () => {}, cloneNode: () => makeEl(tag),
    setAttribute: () => {}, getAttribute: () => null, removeAttribute: () => {}, hasAttribute: () => false, toggleAttribute: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
    querySelector: () => makeEl(), querySelectorAll: () => [], getElementsByClassName: () => [], getElementsByTagName: () => [],
    closest: () => null, matches: () => false, contains: () => false,
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }),
    getContext: () => null, focus: () => {}, blur: () => {}, click: () => {}, scrollIntoView: () => {}, scrollTo: () => {},
    insertAdjacentHTML: () => {}, insertAdjacentElement: () => {}, setSelectionRange: () => {}, select: () => {},
    animate: () => ({ onfinish: null, cancel() {}, finish() {} }), getAnimations: () => [],
  };
  return el;
}
function storageStub() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] || null,
    get length() { return m.size; },
  };
}
const documentStub = Object.assign(makeEl('html'), {
  documentElement: makeEl('html'), body: makeEl('body'), head: makeEl('head'),
  createElement: (t) => makeEl(t), createElementNS: () => makeEl(), createDocumentFragment: () => makeEl(),
  createTextNode: () => makeEl(), getElementById: () => makeEl(),
  querySelector: () => makeEl(), querySelectorAll: () => [],
  addEventListener: () => {}, removeEventListener: () => {},
  cookie: '', title: '', readyState: 'complete', visibilityState: 'visible', hidden: false,
  activeElement: null, referrer: '', location: { href: '', search: '', hash: '', origin: 'http://localhost' },
});

const sandbox = {
  console, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Map, Set, Promise, Symbol, Error,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  URL, URLSearchParams, TextEncoder, TextDecoder,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  fetch: () => new Promise(() => {}), // pending forever → app.js's boot Promise.all never fires renderX()
  matchMedia: () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, scrollX: 0, scrollY: 0, scrollTo() {},
  alert() {}, confirm() { return false; }, prompt() { return null; },
  EventSource: class { addEventListener() {} close() {} },
  Image: class { set src(v) {} },
  btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
  atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
  performance: { now: () => 0 },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  open() { return null; }, close() {}, postMessage() {}, focus() {}, blur() {},
  getSelection: () => ({ toString: () => '', removeAllRanges() {} }),
  history: { pushState() {}, replaceState() {}, back() {}, forward() {} },
  location: { href: 'http://localhost:8137/', search: '', hash: '', origin: 'http://localhost:8137', pathname: '/', reload() {}, assign() {}, replace() {} },
  navigator: { language: 'en', languages: ['en'], userAgent: 'node', onLine: true, clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') } },
  document: documentStub,
  localStorage: storageStub(), sessionStorage: storageStub(),
  module: { exports: {} },
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
process.on('unhandledRejection', () => {}); // swallow any stray boot-promise rejections

// ---------- load the app stack into the vm (same order as index.html) ----------
vm.createContext(sandbox);
const load = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return false;
  vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: rel });
  return true;
};
for (const f of ['data.js', 'guide.js', 'guide.fr.js', 'lang.js', 'engine.js', 'exemplars.js', 'community.js']) load(f);
sandbox.module = { exports: {} }; // only app.js's hook should populate this
load('app.js');
const core = sandbox.module.exports;
if (!core || !core.boardOutputs || !core.E) {
  console.error('FAILED to capture app.js prediction core — export hook missing or app.js threw at load.');
  process.exit(1);
}

// synergy dataset (day-average enemy profiles) — prune removed units, same as boot
const syRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'synergy-stats.json'), 'utf8'));
sandbox.SYNERGY = core.pruneSynergy ? core.pruneSynergy(syRaw) : syRaw;
const SY = sandbox.SYNERGY;
if (!SY || !SY.dayProfiles) { console.error('synergy-stats.json has no dayProfiles'); process.exit(1); }

// ---------- deterministic RNG (mulberry32) so the prior is stable across re-runs ----------
let SEED = 0x9e3779b9;
function mulberry32() {
  SEED |= 0; SEED = (SEED + 0x6D2B79F5) | 0;
  let t = Math.imul(SEED ^ (SEED >>> 15), 1 | SEED);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const gauss = () => { const u = Math.max(mulberry32(), 1e-9), v = mulberry32(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const scaleSpecs = (sp, k) => sp.map(s => ({ ...s, dmg: s.dmg * k, heal: s.heal * k, shield: s.shield * k, burn: s.burn * k, poison: s.poison * k, shock: s.shock * k }));

// 'consistent' = day-average enemy derived from boardOutputs over the corpus (SAME
// metric as the player's board → apples-to-apples). 'profile' = the legacy
// synergy-stats dayProfiles enemy (which drifts ~2× too strong by late game).
const ENEMY_MODE = process.env.ENEMY || 'profile'; // default mirrors the LIVE Battle Brain (dayProfiles enemy)
const dpsDiag = {};

// Compute a board's per-unit outputs via boardOutputs (clean live state first).
function boardMine(slots, day, trinkets, trainerId) {
  Object.assign(core.live, {
    day, trainerId: trainerId || null, trinkets: trinkets || [], trainerData: {},
    history: [], board: slots, bench: [], items: [], heldItems: [], hp: 0, lives: 5, badges: 0,
  });
  const baseT = 12 + 3 * day;
  try {
    const mine = core.boardOutputs(slots, day, baseT);
    if (!mine || !mine.units || !mine.units.length) return null;
    return { mine, baseT };
  } catch (e) { return null; }
}
// aggregate a team's per-unit outputs into scalar enemy dimensions
function boardAgg(mine) {
  const a = { dps: 0, heal: 0, shield: 0, burnApp: 0, poisonApp: 0, shockApp: 0, hitRate: 0 };
  for (const u of mine.units) {
    a.dps += u.dps || 0; a.heal += u.heal || 0; a.shield += u.shield || 0;
    a.burnApp += u.burnApp || 0; a.poisonApp += u.poisonApp || 0; a.shockApp += u.shockApp || 0;
    a.hitRate += (u.mc || 1) / Math.max(u.cd || 5, 0.4);
  }
  return a;
}

// ---------- load corpus ----------
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'runs-raw.json'), 'utf8'));
let runs = Array.isArray(RAW) ? RAW : (RAW.runs || Object.values(RAW)[0]);
if (QUICK) runs = runs.slice(0, 40);

// ---------- PASS 1: board outputs + a self-consistent day-average enemy ----------
const boards = [];      // {slots, day, won, trinkets, trainerId, mine, baseT, agg}
const enemyAcc = {};    // day -> summed board aggregates
let skipped = 0, t0 = Date.now();
for (const run of runs) {
  for (const rd of (run.rounds || [])) {
    const day = rd.round;
    if (!day || day > MAX_DAY || rd.won == null) continue;
    const bd = (rd.board || []).filter(b => b && b.speciesId);
    if (!bd.length) continue;
    const slots = new Array(6).fill(null);
    bd.slice(0, 6).forEach((b, i) => { slots[i] = { monsterId: b.speciesId, level: b.level || 1, shiny: !!b.shiny }; });
    const bm = boardMine(slots, day, rd.trinkets || [], run.trainerId);
    if (!bm) { skipped++; continue; }
    const agg = boardAgg(bm.mine);
    boards.push({ slots, day, won: rd.won ? 1 : 0, trinkets: rd.trinkets || [], trainerId: run.trainerId, mine: bm.mine, baseT: bm.baseT, agg });
    const a = (enemyAcc[day] = enemyAcc[day] || { dps: 0, heal: 0, shield: 0, burnApp: 0, poisonApp: 0, shockApp: 0, hitRate: 0, n: 0 });
    for (const k in agg) a[k] += agg[k];
    a.n++;
  }
}
// self-consistent enemy = the day's average board (measured with the same boardOutputs)
const consistentEnemy = {};
for (const d in enemyAcc) {
  const a = enemyAcc[d]; if (a.n < 8) continue;
  consistentEnemy[d] = { dps: a.dps / a.n, heal: a.heal / a.n, shield: a.shield / a.n, burnApp: a.burnApp / a.n, poisonApp: a.poisonApp / a.n, shockApp: a.shockApp / a.n, hitRate: a.hitRate / a.n };
}
function profileEnemyFor(day) {
  const d = Math.min(day, MAX_DAY);
  const prof = SY.dayProfiles[String(d)] || SY.dayProfiles[String(MAX_DAY)];
  return { dps: prof.dps, heal: prof.heal, shield: prof.shield, burnApp: prof.burnApp, poisonApp: prof.poisonApp, shockApp: prof.shockApp, hitRate: prof.hitRate != null ? prof.hitRate : prof.dps / 40 };
}
function enemyFor(day) {
  const d = Math.min(day, MAX_DAY);
  if (ENEMY_MODE === 'consistent' && consistentEnemy[d]) return consistentEnemy[d];
  return profileEnemyFor(day);
}
// win% for a board vs an ARBITRARY enemy profile (used by --compare)
function predictVsEnemy(b, enemy) {
  const specs = core.buildEventSpecs(b.mine.units, b.slots, b.baseT);
  const foeSpecs = core.avgEnemySpecs(enemy);
  Object.assign(core.live, { day: b.day, trinkets: b.trinkets || [], trainerId: b.trainerId || null, trainerData: {}, history: [] });
  const myHP = core.suggestedHP(b.day), enemyHP = core.baseHPFor(b.day);
  const tmax = Math.max(b.baseT * 2.5, 60);
  const E = core.E;
  let w = 0;
  for (let i = 0; i < MC; i++) {
    const r = E.simEvents(scaleSpecs(specs, Math.max(1 + NOISE.own * gauss(), 0.6)), scaleSpecs(foeSpecs, Math.max(1 + NOISE.foe * gauss(), 0.5)), myHP, enemyHP, { tmax });
    if (r.tKill < r.tDie) w++;
  }
  return Math.round((w / MC) * 20) * 5;
}

// ---------- --compare: per-day before/after (profile enemy → self-consistent enemy) ----------
if (process.argv.includes('--compare')) {
  const rows = {};
  for (const b of boards) {
    const cEn = consistentEnemy[Math.min(b.day, MAX_DAY)];
    const pp = predictVsEnemy(b, profileEnemyFor(b.day));
    const pc = cEn ? predictVsEnemy(b, cEn) : pp;
    const r = (rows[b.day] = rows[b.day] || { n: 0, act: 0, pp: 0, pc: 0 });
    r.n++; r.act += b.won; r.pp += pp; r.pc += pc;
  }
  console.log('\nBEFORE / AFTER — per-day mean win% (current dayProfiles enemy → self-consistent enemy) vs ACTUAL:');
  console.log('  day    n    actual    before    after     Δ');
  for (let d = 1; d <= MAX_DAY; d++) {
    const r = rows[d]; if (!r || r.n < 10) continue;
    const act = 100 * r.act / r.n, bp = r.pp / r.n, cp = r.pc / r.n;
    console.log(`  ${String(d).padStart(2)}   ${String(r.n).padStart(4)}    ${act.toFixed(0).padStart(3)}%     ${bp.toFixed(0).padStart(3)}%     ${cp.toFixed(0).padStart(3)}%    ${(cp - bp >= 0 ? '+' : '')}${(cp - bp).toFixed(0)}pp`);
  }
  console.log('\n(actual = real win-rate of Master boards that day; before/after = mean predicted win%.\n after should track actual more closely if the self-consistent enemy helps.)');
  process.exit(0);
}

// ---------- PASS 2: predict each board vs the day enemy (100-MC winProb) ----------
function predictVs(b) {
  const specs = core.buildEventSpecs(b.mine.units, b.slots, b.baseT);
  const enemy = enemyFor(b.day);
  const foeSpecs = core.avgEnemySpecs(enemy);
  Object.assign(core.live, { day: b.day, trinkets: b.trinkets || [], trainerId: b.trainerId || null, trainerData: {}, history: [] });
  const myHP = core.suggestedHP(b.day), enemyHP = core.baseHPFor(b.day);
  const tmax = Math.max(b.baseT * 2.5, 60);
  const E = core.E;
  (dpsDiag[b.day] = dpsDiag[b.day] || []).push({ my: b.agg.dps, en: enemy.dps });
  let w = 0;
  for (let i = 0; i < MC; i++) {
    const r = E.simEvents(scaleSpecs(specs, Math.max(1 + NOISE.own * gauss(), 0.6)), scaleSpecs(foeSpecs, Math.max(1 + NOISE.foe * gauss(), 0.5)), myHP, enemyHP, { tmax });
    if (r.tKill < r.tDie) w++;
  }
  return Math.round((w / MC) * 20) * 5; // 0..100, nearest 5 — identical to winProb.win
}
const samples = [];
for (const b of boards) samples.push({ pred: predictVs(b), won: b.won, day: b.day });
const secs = ((Date.now() - t0) / 1000).toFixed(1);

// ---------- aggregate ----------
const n = samples.length;
if (!n) { console.error('no scorable boards'); process.exit(1); }
const meanPred = samples.reduce((a, s) => a + s.pred / 100, 0) / n;
const meanActual = samples.reduce((a, s) => a + s.won, 0) / n;
const brier = samples.reduce((a, s) => a + Math.pow(s.pred / 100 - s.won, 2), 0) / n;

// reliability curve: 10%-wide predicted buckets
const NB = 10;
const bins = [];
for (let b = 0; b < NB; b++) {
  const lo = b * 10, hi = b === NB - 1 ? 100 : (b + 1) * 10;
  const inBin = samples.filter(s => s.pred >= lo && (b === NB - 1 ? s.pred <= hi : s.pred < hi));
  if (!inBin.length) { bins.push({ lo, hi, n: 0, pred: null, actual: null }); continue; }
  bins.push({
    lo, hi, n: inBin.length,
    pred: +(inBin.reduce((a, s) => a + s.pred / 100, 0) / inBin.length).toFixed(4),
    actual: +(inBin.reduce((a, s) => a + s.won, 0) / inBin.length).toFixed(4),
  });
}
const ece = bins.reduce((a, bn) => bn.n ? a + (bn.n / n) * Math.abs(bn.pred - bn.actual) : a, 0);

// per-day bias
const byDay = {};
for (let d = 1; d <= MAX_DAY; d++) {
  const inD = samples.filter(s => s.day === d);
  if (inD.length >= 20) {
    const mp = inD.reduce((a, s) => a + s.pred / 100, 0) / inD.length;
    const ma = inD.reduce((a, s) => a + s.won, 0) / inD.length;
    byDay[d] = { n: inD.length, bias: +(mp - ma).toFixed(4) };
  }
}

// DISCRIMINATION: does the sim predict higher for boards that actually WON than for boards that LOST?
const won = samples.filter(s => s.won), lost = samples.filter(s => !s.won);
const mpArr = (arr) => arr.length ? arr.reduce((a, s) => a + s.pred, 0) / arr.length : 0;
const meanPredWon = mpArr(won), meanPredLost = mpArr(lost);
const sortedByPred = samples.slice().sort((a, b) => a.pred - b.pred); // AUC via tie-averaged rank-sum (Mann-Whitney U)
let ri = 0, rankSumWon = 0;
while (ri < sortedByPred.length) { let j = ri; while (j < sortedByPred.length && sortedByPred[j].pred === sortedByPred[ri].pred) j++; const avgRank = (ri + 1 + j) / 2; for (let k = ri; k < j; k++) if (sortedByPred[k].won) rankSumWon += avgRank; ri = j; }
const auc = (won.length && lost.length) ? +((rankSumWon - won.length * (won.length + 1) / 2) / (won.length * lost.length)).toFixed(4) : null;
const canCalibrate = auc != null && auc >= 0.62; // below this, the board barely predicts the outcome → corpus can't calibrate

const out = {
  generatedAt: new Date().toISOString(),
  source: 'runs-raw.json (Master-Ranked corpus) — sim replay vs day-average enemy',
  method: `${MC}-draw Monte-Carlo winProb per board, identical path to the Battle Brain (via app.js export hook)`,
  enemyMode: ENEMY_MODE,
  runs: runs.length, n, skipped,
  brier: +brier.toFixed(4), ece: +ece.toFixed(4),
  meanPred: +meanPred.toFixed(4), meanActual: +meanActual.toFixed(4),
  auc, meanPredWon: +(meanPredWon / 100).toFixed(4), meanPredLost: +(meanPredLost / 100).toFixed(4),
  canCalibrate,
  verdict: canCalibrate
    ? 'Board predicts round outcome well enough — corpus is a usable calibration set.'
    : 'Board barely predicts round outcome (AUC≈0.5): ranked matchmaking pairs similar-strength boards and the actual opponent is NOT in the corpus, so the recorded board explains almost none of the win/loss. The corpus CANNOT calibrate the sim — do NOT derive a live prior from this. Self-calibration must stay on the player\'s OWN battles, which carry the real outcome. This file is a regression/sanity canary only.',
  bins, byDay,
};
fs.writeFileSync(path.join(ROOT, 'tools', 'sim-diagnostic.json'), JSON.stringify(out, null, 2));

// ---------- report ----------
console.log(`\ncalibrate_sim — ${n} boards from ${runs.length} runs in ${secs}s (${skipped} unscorable) · enemy=${ENEMY_MODE}`);
console.log(`Brier ${out.brier}  ·  ECE ${out.ece}  ·  meanPred ${(meanPred * 100).toFixed(1)}%  meanActual ${(meanActual * 100).toFixed(1)}%`);
console.log(`DISCRIMINATION  meanPred(won)=${meanPredWon.toFixed(1)}%  meanPred(lost)=${meanPredLost.toFixed(1)}%  spread=${(meanPredWon - meanPredLost).toFixed(1)}pp  ·  AUC=${auc}  (0.5=blind, 1.0=perfect; won ${won.length} / lost ${lost.length})`);
console.log(`VERDICT: ${canCalibrate ? '✅ corpus is calibratable' : '❌ corpus CANNOT calibrate the sim (AUC≈0.5) — board doesn\'t predict the matchmade outcome; keep self-calibration on the player\'s own battles'}`);
console.log('\nreliability curve (predicted bucket → actual win-rate):');
console.log('  bucket    n     predicted   actual    gap');
for (const bn of bins) {
  if (!bn.n) { console.log(`  ${String(bn.lo).padStart(2)}–${String(bn.hi).padStart(3)}%   —`); continue; }
  const gap = (bn.pred - bn.actual) * 100;
  const bar = gap > 0 ? 'over' : 'under';
  console.log(`  ${String(bn.lo).padStart(2)}–${String(bn.hi).padStart(3)}%  ${String(bn.n).padStart(4)}    ${(bn.pred * 100).toFixed(1).padStart(5)}%     ${(bn.actual * 100).toFixed(1).padStart(5)}%   ${gap >= 0 ? '+' : ''}${gap.toFixed(1)}pp ${Math.abs(gap) >= 5 ? bar : ''}`);
}
console.log(`\nwrote tools/sim-diagnostic.json  (regression/sanity canary — NOT a live prior)\n`);

console.log('SCALE DIAGNOSTIC — avg board dps (via boardOutputs) vs day-average enemy dps:');
console.log('  day   n     avgBoardDps   enemyDps   ratio');
for (let d = 1; d <= MAX_DAY; d++) {
  const arr = dpsDiag[d]; if (!arr || arr.length < 10) continue;
  const my = arr.reduce((a, x) => a + x.my, 0) / arr.length;
  const en = arr.reduce((a, x) => a + x.en, 0) / arr.length;
  console.log(`  ${String(d).padStart(2)}   ${String(arr.length).padStart(4)}    ${my.toFixed(1).padStart(8)}     ${en.toFixed(1).padStart(6)}    ${(my / en).toFixed(2)}x`);
}
