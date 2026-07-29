// Engine self-test: loads the browser modules in Node and fuzz-sweeps the
// scoring engine for NaN/negative/crash across the full monster space,
// plus behavioral assertions on merge/evolution/affordability/real-data logic.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {}, console };
ctx.window.window = ctx.window;
vm.createContext(ctx);
for (const f of ['data.js', 'guide.js', 'engine.js', 'synergy.js']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
// engine reads window.SYNERGY / window.GUIDE via bare `window` — already in ctx.
const W = ctx.window;
const E = W.Engine, D = W.BATODEX;
if (!E || !D) { console.error('failed to load modules'); process.exit(1); }

let pass = 0, fail = 0;
const failures = [];
const check = (name, cond, detail) => { if (cond) pass++; else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); } };

// ---- 1) power() sweep: every monster × level 1-4 × shiny × representative days ----
let swept = 0;
for (const m of D.monsters) {
  for (const lvl of [1, 2, 3, 4]) {
    for (const shiny of [false, true]) {
      for (const day of [1, 5, 9]) {
        const p = E.power(m, lvl, { shiny, day });
        swept++;
        if (!isFinite(p.total) || p.total < 0) {
          check(`power finite ${m.id} L${lvl}${shiny ? 's' : ''}d${day}`, false, String(p.total));
        }
      }
    }
  }
}
check('power sweep all finite/positive (' + swept + ' evals)', failures.length === 0);

// ---- 2) scoreShop sweep: rotating offer sets across days, all pcts sane ----
const pool = D.monsters.filter(m => m.cost > 0 && !(Array.isArray(m.tags) && m.tags.length));
let shopEvals = 0, shopBad = 0;
for (let day = 1; day <= 12; day += 2) {
  for (let off = 0; off < pool.length; off += 5) {
    const offers = pool.slice(off, off + 5).map((m, i) => ({ monsterId: m.id, level: 1, shiny: i === 2 }));
    if (!offers.length) continue;
    const team = pool.slice((off + 7) % pool.length, (off + 7) % pool.length + 3).map(m => ({ monsterId: m.id, level: 2, shiny: false }));
    const res = E.scoreShop(offers, { day, gold: 60, trainerId: 'pyromaniac', team, ownedCounts: {}, trinkets: ['zenith_stone'] });
    shopEvals++;
    for (const r of res.rows) {
      if (!isFinite(r.raw) || r.raw < 0 || r.pct < 0 || r.pct > 100) { shopBad++; failures.push('scoreShop bad row ' + r.m.id + ' raw=' + r.raw + ' pct=' + r.pct); }
    }
    // top pick reads 100% only when SOMETHING is affordable; an all-unaffordable
    // shop anchors to the pre-cap max so capped rows show honestly low percents.
    const anyAfford = res.rows.some(r => r.affordable);
    if (res.rows.length && anyAfford && res.rows[0].pct !== 100) { shopBad++; failures.push('top pick not 100% on day ' + day); }
    if (res.rows.length && !anyAfford && res.rows[0].pct > 45) { shopBad++; failures.push('unaffordable shop inflated to ' + res.rows[0].pct + '% on day ' + day); }
  }
}
check(`scoreShop sweep (${shopEvals} shops) all sane`, shopBad === 0);

// ---- 2b) all-unaffordable shop shows low percents, not a fake 100% ----
{
  const rich = D.monsters.filter(m => m.cost >= 40).slice(0, 3).map(m => ({ monsterId: m.id, level: 1, shiny: false }));
  const res = E.scoreShop(rich, { day: 1, gold: 5, trainerId: null, team: [], ownedCounts: {} });
  check('all-unaffordable shop: top pct <= 45 (was inflating to 100)', res.rows.length > 0 && res.rows[0].pct <= 45 && res.rows.every(r => !r.affordable));
}

// ---- 2c) adopted strategy piece leads the buy order, even when broke ----
{
  const shop = [
    { monsterId: 'brawlmantis', level: 1, shiny: false }, // strong carry, high raw + real data
    { monsterId: 'boomagon', level: 1, shiny: false },    // low-raw support = strategy piece
  ];
  const base = { day: 5, gold: 4, trainerId: 'chef', team: [], ownedCounts: {} };
  const plain = E.scoreShop(shop, base);
  const strat = E.scoreShop(shop, Object.assign({}, base, { stratIds: new Set(['boomagon']) }));
  check('no strategy: carry outranks support', plain.rows[0].m.id === 'brawlmantis',
    plain.rows.map(r => r.m.id + ':' + r.pct).join(','));
  check('adopted strategy piece ranked #1 (broke shop)', strat.rows[0].m.id === 'boomagon',
    strat.rows.map(r => r.m.id + ':' + r.pct).join(','));
  check('unaffordable ordering preserved, not flattened', strat.rows[0].pct > strat.rows[1].pct,
    strat.rows.map(r => r.m.id + ':' + r.pct).join(','));
  // comp/run-plan piece leads too (Julian's Magmalith case), and strategy > comp
  const comp = E.scoreShop(shop, Object.assign({}, base, { gold: 50, compIds: new Set(['boomagon']) }));
  check('comp-plan piece ranked #1 over a flat-stat carry', comp.rows[0].m.id === 'boomagon',
    comp.rows.map(r => r.m.id + ':' + r.pct).join(','));
  const both = E.scoreShop([
    { monsterId: 'boomagon', level: 1, shiny: false },
    { monsterId: 'magmalith', level: 1, shiny: false },
  ], Object.assign({}, base, { gold: 50, compIds: new Set(['magmalith']), stratIds: new Set(['boomagon']) }));
  check('adopted strategy outranks comp piece', both.rows[0].m.id === 'boomagon',
    both.rows.map(r => r.m.id + ':' + r.pct).join(','));
}

// ---- 3) behavioral assertions ----
{
  // merge modeling (3-copy rule): 2 owned + this buy = 3 copies -> L2 (NOT L3).
  const res = E.scoreShop([{ monsterId: 'scorchimp', level: 1, shiny: false }], { day: 3, gold: 50, trainerId: null, team: [], ownedCounts: { scorchimp: 2 } });
  const chips = res.rows[0].chips.join(' | ');
  check('3rd copy 3-merges to Level 2', /3-merges to Level 2/.test(chips), chips);
  check('3rd copy does NOT evolve (L3 needs 9 copies)', !/Sunsage|EVOLUTION/.test(chips), chips);
  // L3 evolution requires NINE copies (3×L2): 8 owned + this buy = 9 -> L3 -> Sunsage.
  const res9 = E.scoreShop([{ monsterId: 'scorchimp', level: 1, shiny: false }], { day: 3, gold: 50, trainerId: null, team: [], ownedCounts: { scorchimp: 8 } });
  const chips9 = res9.rows[0].chips.join(' | ');
  check('9th copy completes Level 3', /Level 3|Completes Level 3/.test(chips9), chips9);
  check('9th copy evolves to Sunsage', /Sunsage/.test(chips9), chips9);
}
{
  // affordability cap: unaffordable offer cannot be the top pick vs an affordable good one
  const res = E.scoreShop([
    { monsterId: 'dragonarch', level: 1, shiny: false },   // $60
    { monsterId: 'bambudo', level: 1, shiny: false },      // $10
  ], { day: 5, gold: 15, trainerId: null, team: [], ownedCounts: {} });
  check('unaffordable offer not ranked #1', res.rows[0].m.id !== 'dragonarch', res.rows.map(r => r.m.id + ':' + r.pct).join(','));
  check('cannot-afford chip present', res.rows.some(r => r.chips.some(c => c.includes('Cannot afford'))));
}
{
  // musician exactly-one-electric logic
  const base = { day: 4, gold: 50, trainerId: 'musician', ownedCounts: {} };
  const noElec = E.scoreShop([{ monsterId: 'joltail', level: 1, shiny: false }], { ...base, team: [] });
  const hasElec = E.scoreShop([{ monsterId: 'joltail', level: 1, shiny: false }], { ...base, team: [{ monsterId: 'galvanine', level: 1, shiny: false }] });
  check('musician: first electric boosted over second', noElec.rows[0].raw > hasElec.rows[0].raw,
    noElec.rows[0].raw.toFixed(1) + ' vs ' + hasElec.rows[0].raw.toFixed(1));
}
{
  // real-data negative evidence: a below-baseline monster must not outrank equal-model peers purely on data
  const SY = W.SYNERGY;
  if (SY) {
    const below = Object.entries(SY.monsters).find(([id, s]) => s.rounds > 300 && s.winRate < SY.sample.globalRoundWR - 5 && pool.some(p => p.id === id));
    if (below) {
      const res = E.scoreShop([{ monsterId: below[0], level: 1, shiny: false }], { day: 5, gold: 99, trainerId: null, team: [], ownedCounts: {} });
      check('negative real-data evidence collected for ' + below[0], res.rows[0].real && res.rows[0].real.wr < 0, JSON.stringify(res.rows[0].real));
    }
  }
}
{
  // determinism: same input twice -> identical output
  const args = [[{ monsterId: 'coalem', level: 1, shiny: false }, { monsterId: 'mosslug', level: 1, shiny: true }], { day: 6, gold: 50, trainerId: 'shopkeeper', team: [{ monsterId: 'berroon', level: 2, shiny: false }], ownedCounts: {}, trinkets: [] }];
  const a = JSON.stringify(E.scoreShop(...args).rows.map(r => [r.m.id, r.pct]));
  const b = JSON.stringify(E.scoreShop(...args).rows.map(r => [r.m.id, r.pct]));
  check('scoreShop deterministic', a === b);
}
{
  // tier lists exist and band correctly
  for (const phase of ['early', 'mid', 'late']) {
    const t = E.tierList(phase);
    check(`tierList(${phase}) non-empty + banded`, t.rows.length > 40 && t.rows.every(r => 'SABCD'.includes(r.band)));
  }
  check('trainerTiers sorted desc', (() => { const t = E.trainerTiers(); return t.every((x, i) => i === 0 || t[i - 1].stats.winRate >= x.stats.winRate); })());
  check('trinketTiers sorted desc', (() => { const t = E.trinketTiers(); return t.every((x, i) => i === 0 || t[i - 1].stats.winRate >= x.stats.winRate); })());
}

{
  // ---- event-based combat simulator (E.simEvents) ----
  const mk = (o) => Object.assign({ cd: 99, mc: 1, dmg: 0, heal: 0, shield: 0, burn: 0, poison: 0, shock: 0, donor: null, label: 'u' }, o);
  // exact cast math: 10dmg @1s vs 100hp → kill at t=10.00 (first cast at t=cd)
  let r = E.simEvents([mk({ cd: 1, dmg: 10 })], [mk({})], 1000, 100, {});
  check('simEvents exact kill time (10dmg/1s vs 100hp = 10.0s)', Math.abs(r.tKill - 10) < 0.11, r.tKill);
  // multicast: 25dmg ×2 @2.5s = 50/cast vs 600hp → 12 casts = t=30.00
  r = E.simEvents([mk({ cd: 2.5, mc: 2, dmg: 25 })], [mk({})], 1000, 600, {});
  check('simEvents multicast exact (30.0s)', Math.abs(r.tKill - 30) < 0.11, r.tKill);
  // CDS chain: boomagon feeding an attacker kills FASTER than without
  const atk = mk({ cd: 2, dmg: 10 });
  const withB = E.simEvents([mk({ cd: 6, donor: { kind: 'cds', rate: 0.04, targetIdx: 1 } }), atk], [mk({})], 1000, 500, {});
  const noB = E.simEvents([mk({ cd: 6 }), atk], [mk({})], 1000, 500, {});
  check('simEvents CDS donation accelerates the kill', withB.tKill < noB.tKill, `${withB.tKill} vs ${noB.tKill}`);
  // shock coupling: hitter cashes growing stacks (direct >> raw hits)
  r = E.simEvents([mk({ cd: 1, shock: 2 }), mk({ cd: 0.5, dmg: 1 })], [mk({})], 1000, 800, {});
  check('simEvents shock quadratic coupling', r.perUnit[1].direct > 400, r.perUnit[1].direct);
  // margin extrapolation sane: 2:1 dps mirror ≈ +100% margin, not inflated
  r = E.simEvents([mk({ cd: 1, dmg: 20 })], [mk({ cd: 1, dmg: 10 })], 300, 300, {});
  check('simEvents margin extrapolation band (80..160)', r.margin >= 80 && r.margin <= 160, r.margin);
  // determinism + no NaN across a fuzz spread
  const s1 = E.simEvents([mk({ cd: 3, heal: 30 }), mk({ cd: 2, dmg: 8 })], [mk({ cd: 1, dmg: 15 })], 300, 400, {});
  const s2 = E.simEvents([mk({ cd: 3, heal: 30 }), mk({ cd: 2, dmg: 8 })], [mk({ cd: 1, dmg: 15 })], 300, 400, {});
  check('simEvents deterministic', s1.tKill === s2.tKill && s1.tDie === s2.tDie);
  let nan = 0;
  for (let i = 0; i < 40; i++) {
    const rndU = () => mk({ cd: 0.5 + (i * 7 % 50) / 10, mc: 1 + (i % 3), dmg: i * 3 % 40, heal: i * 5 % 30, shield: i * 11 % 25, burn: i % 6, poison: i * 2 % 5, shock: i % 4 });
    const rr = E.simEvents([rndU(), rndU()], [rndU()], 200 + i * 40, 300 + i * 25, {});
    if (!isFinite(rr.tKill) || !isFinite(rr.tDie) || !isFinite(rr.margin)) nan++;
  }
  check('simEvents fuzz: no NaN/Infinity over 40 configs', nan === 0, nan);
}

console.log(`\n==== ENGINE SELF-TEST: ${pass} passed, ${fail} failed ====`);
failures.slice(0, 20).forEach(f => console.log('FAIL:', f));
process.exit(fail ? 1 : 0);
