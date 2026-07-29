#!/usr/bin/env node
// discover_builds.js — learn build archetypes from the run corpus, CLASSIFIED BY
// TRAINER and gated on real ladder outcomes.
//
// Two passes:
//   1) COMBO pass  — clusters the mined k-combos (synergy-stats.json) into
//      archetypes, then enriches each with the trainer that actually runs it and
//      its badge outcomes (avg badges, champion rate, rank-up rate).
//   2) TRAINER pass — for each trainer, clusters the FINAL BOARDS of their
//      high-badge runs straight out of runs-raw.json. Champion tier = 10+ badges
//      (+5★, a full division); rank-up tier = 8+ (+3★). Only these count — a
//      5-badge run is "No Change" on the ladder and teaches nothing about climbing.
//
// Ranking favours championship evidence (champRate) over raw popularity.
// Output: discovered-builds.json  ·  re-runs offline from existing data.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const load = (file, sb) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sb);

const REMOVED_TRINKETS = new Set(['shady_contract']); // cut in 0.8.0, still in old crawled runs
const CHAMP_BADGES = 10;  // +5★ — a full division
const RANKUP_BADGES = 8;  // +3★ — still climbs

const jac = (a, b) => {
  const A = a instanceof Set ? a : new Set(a), B = b instanceof Set ? b : new Set(b);
  let i = 0; for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i || 1);
};

function discover(opts) {
  opts = opts || {};
  const sb = { window: {} }; vm.createContext(sb);
  load('data.js', sb); load('guide.js', sb);
  const D = sb.window.BATODEX, G = sb.window.GUIDE;
  const S = JSON.parse(fs.readFileSync(opts.synergyPath || path.join(ROOT, 'synergy-stats.json'), 'utf8'));
  let RAW = [];
  try { RAW = JSON.parse(fs.readFileSync(opts.rawPath || path.join(ROOT, 'tools', 'runs-raw.json'), 'utf8')); } catch (e) {}

  const monById = {}; D.monsters.forEach(m => (monById[m.id] = m));
  const nameOf = (id) => (monById[id] || {}).name || id;
  const typesOf = (id) => ((monById[id] || {}).types || []).map((t) => t.id);
  const trainerName = (id) => ((D.trainers || []).find((t) => t.id === id) || {}).name || id;
  const globalWR = S.sample.globalRoundWR || 66;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const domTypes = (ids) => {
    const tc = {}; ids.forEach((id) => typesOf(id).forEach((t) => (tc[t] = (tc[t] || 0) + 1)));
    return Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 2).filter((e) => e[1] >= 2).map((e) => e[0]);
  };
  const guideCores = G.BUILDS.map((b) => ({ id: b.id, name: b.name, set: new Set((b.core || []).concat(b.lateCore || [])) }));
  const novelty = (coreIds) => {
    const cs = new Set(coreIds); let best = null, bestJ = 0;
    for (const gb of guideCores) { const j = jac(cs, gb.set); if (j > bestJ) { bestJ = j; best = gb; } }
    if (bestJ >= 0.55) return { tag: 'known', build: best, j: bestJ };
    if (bestJ >= 0.3) return { tag: 'variant', build: best, j: bestJ };
    return { tag: 'novel', build: null, j: bestJ };
  };

  // ---- digest every run: trainer, badges, finished board, trinkets, round record
  const digest = RAW.map((r) => {
    const rounds = r.rounds || [];
    const last = rounds[rounds.length - 1] || {};
    const board = [...new Set((last.board || []).map((b) => b.speciesId).filter((id) => monById[id]))];
    return {
      id: r.id, trainer: r.trainerId || null, badges: +r.wins || 0, mmr: +r.mmr || 0,
      board, rounds: rounds.length, roundWins: rounds.filter((x) => x.won).length,
      trinkets: [...new Set((last.trinkets || []).map((t) => t && t.id).filter((id) => id && !REMOVED_TRINKETS.has(id)))],
    };
  }).filter((d) => d.board.length >= 3);

  // Outcome stats for a core across a run LIST. Measured over EVERY run that
  // fielded it (all badge levels) — never only the high-badge pool it was mined
  // from, which would make champRate a tautological 100%. This is the real signal:
  // "when this comp gets fielded, how often does it actually reach 10 badges?"
  const statsForCoreIn = (coreIds, list) => {
    const need = Math.max(2, Math.ceil(coreIds.length * 0.5));
    const hits = list.filter((d) => coreIds.filter((id) => d.board.indexOf(id) >= 0).length >= need);
    if (!hits.length) return null;
    const totRounds = hits.reduce((a, h) => a + h.rounds, 0);
    return {
      fieldedRuns: hits.length,
      avgBadges: +(hits.reduce((a, h) => a + h.badges, 0) / hits.length).toFixed(1),
      champRate: Math.round((hits.filter((h) => h.badges >= CHAMP_BADGES).length / hits.length) * 100),
      rankUpRate: Math.round((hits.filter((h) => h.badges >= RANKUP_BADGES).length / hits.length) * 100),
      avgMMR: Math.round(hits.reduce((a, h) => a + h.mmr, 0) / hits.length),
      roundWR: +((hits.reduce((a, h) => a + h.roundWins, 0) / Math.max(totRounds, 1)) * 100).toFixed(1),
      totRounds,
    };
  };
  const statsForCore = (coreIds) => {
    const st = statsForCoreIn(coreIds, digest);
    if (!st) return null;
    const need = Math.max(2, Math.ceil(coreIds.length * 0.5));
    const hits = digest.filter((d) => coreIds.filter((id) => d.board.indexOf(id) >= 0).length >= need);
    const tf = {}; hits.forEach((h) => { if (h.trainer) tf[h.trainer] = (tf[h.trainer] || 0) + 1; });
    const topT = Object.entries(tf).sort((a, b) => b[1] - a[1])[0];
    return Object.assign(st, { trainer: topT ? topT[0] : null, trainerShare: topT ? Math.round((topT[1] / hits.length) * 100) : 0 });
  };

  // ================= PASS 1: combo-clustered archetypes =================
  const cand = [];
  for (const k of ['3', '4', '5', '6']) for (const c of S.combos[k] || []) {
    if (c.winRate < globalWR + 5 || c.lift < 3 || c.runs < 4) continue;
    const kk = +k;
    cand.push({ ids: c.ids, set: new Set(c.ids), k: kk, winRate: c.winRate, lift: c.lift, rounds: c.rounds, runs: c.runs, phases: c.phases, layouts: c.layouts,
      q: (c.winRate - globalWR) * Math.log2(c.runs + 1) * (1 + c.lift / 20) * (1 + (kk - 3) * 0.15) });
  }
  cand.sort((a, b) => b.q - a.q);
  const used = new Array(cand.length).fill(false);
  const comboBuilds = [];
  for (let i = 0; i < cand.length; i++) {
    if (used[i]) continue;
    const seed = cand[i]; used[i] = true;
    const members = [seed];
    const freq = {}; seed.ids.forEach((id) => (freq[id] = seed.runs));
    for (let j = i + 1; j < cand.length; j++) {
      if (used[j]) continue;
      const c = cand[j];
      const shared = [...c.set].filter((x) => seed.set.has(x)).length;
      if (jac(seed.set, c.set) >= 0.4 || (shared >= Math.min(c.set.size, 3) && c.set.size <= seed.set.size + 1)) {
        used[j] = true; members.push(c); c.ids.forEach((id) => (freq[id] = (freq[id] || 0) + c.runs));
      }
    }
    const core = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6).map((e) => e[0]);
    const rep = members.filter((m) => m.runs >= 5).sort((a, b) => b.winRate - a.winRate)[0] || seed;
    const nov = novelty(core);
    const st = statsForCore(core) || {};
    const types = domTypes(core);
    const phase = rep.phases ? (Object.entries(rep.phases).filter(([, v]) => v).sort((a, b) => (b[1].winRate || 0) - (a[1].winRate || 0))[0] || [null])[0] : null;
    comboBuilds.push({
      id: 'disc_' + core.slice(0, 3).join('_'), source: 'combo',
      name: nov.tag === 'known' ? ((G.BUILDS.find((b) => b.id === nov.build.id) || {}).name || nov.build.name)
        : nov.tag === 'variant' ? `${nov.build.name} variant · ${nameOf(core[0])}`
        : `${types.map(cap).join('·') || 'Hybrid'} — ${nameOf(core[0])} core`,
      novelty: nov.tag, mapsTo: nov.build ? nov.build.id : null, overlap: +nov.j.toFixed(2),
      coreIds: core, coreNames: core.map(nameOf), types,
      winRate: rep.winRate, lift: rep.lift, rounds: rep.rounds, runs: rep.runs,
      phase, layout: (rep.layouts && rep.layouts[0]) || null,
      trainer: st.trainer || null, trainerName: st.trainer ? trainerName(st.trainer) : null, trainerShare: st.trainerShare || 0,
      avgBadges: st.avgBadges != null ? st.avgBadges : null, champRate: st.champRate != null ? st.champRate : null,
      rankUpRate: st.rankUpRate != null ? st.rankUpRate : null, fieldedRuns: st.fieldedRuns || 0, avgMMR: st.avgMMR || null,
      badgeTier: (st.champRate || 0) >= 50 ? 'champion' : (st.rankUpRate || 0) >= 50 ? 'rankup' : 'mixed',
      trinkets: [],
      exemplars: members.slice(0, 4).map((m) => ({ ids: m.ids, winRate: m.winRate, lift: m.lift, runs: m.runs })),
    });
  }

  // ================= PASS 2: per-trainer builds from HIGH-BADGE runs =================
  const byTrainer = {};
  digest.forEach((d) => { if (d.trainer) (byTrainer[d.trainer] = byTrainer[d.trainer] || []).push(d); });
  const trainerBuilds = [];
  for (const [tid, list] of Object.entries(byTrainer)) {
    let pool = list.filter((d) => d.badges >= CHAMP_BADGES), tier = 'champion';
    if (pool.length < 5) {
      const p8 = list.filter((d) => d.badges >= RANKUP_BADGES);
      if (p8.length > pool.length) { pool = p8; tier = 'rankup'; }
    }
    if (pool.length < 3) continue; // too thin to claim an archetype
    pool = pool.slice().sort((a, b) => b.badges - a.badges || b.mmr - a.mmr);
    const minRuns = pool.length >= 15 ? 3 : 2;
    const seen = new Array(pool.length).fill(false);
    for (let i = 0; i < pool.length; i++) {
      if (seen[i]) continue;
      const seed = pool[i]; seen[i] = true;
      const members = [seed];
      for (let j = i + 1; j < pool.length; j++) {
        if (seen[j]) continue;
        if (jac(seed.board, pool[j].board) >= 0.45) { seen[j] = true; members.push(pool[j]); }
      }
      if (members.length < minRuns) continue;
      const freq = {}; members.forEach((m) => m.board.forEach((id) => (freq[id] = (freq[id] || 0) + 1)));
      const half = Math.max(2, Math.ceil(members.length * 0.5));
      let core = Object.entries(freq).filter(([, n]) => n >= half).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      if (core.length < 3) core = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map((e) => e[0]);
      core = core.slice(0, 6);
      if (core.length < 3) continue;
      // stats over ALL this trainer's runs fielding the core (not just the champion
      // seeds) so champRate means "how often it converts", and drop thin evidence
      const st = statsForCoreIn(core, list);
      if (!st || st.fieldedRuns < 4) continue;
      const tf = {}; members.forEach((m) => m.trinkets.forEach((id) => (tf[id] = (tf[id] || 0) + 1)));
      const nov = novelty(core);
      const types = domTypes(core);
      trainerBuilds.push({
        id: 'tb_' + tid + '_' + core.slice(0, 2).join('_'), source: 'trainer',
        name: `${types.map(cap).join('·') || 'Hybrid'} — ${nameOf(core[0])} core`,
        novelty: nov.tag, mapsTo: nov.build ? nov.build.id : null, overlap: +nov.j.toFixed(2),
        coreIds: core, coreNames: core.map(nameOf), types,
        trainer: tid, trainerName: trainerName(tid), trainerShare: 100,
        badgeTier: st.champRate >= 50 ? 'champion' : st.rankUpRate >= 50 ? 'rankup' : 'mixed',
        minedFrom: tier, champSeeds: members.length, // how many 10+/8+ runs seeded this cluster
        runs: st.fieldedRuns, fieldedRuns: st.fieldedRuns,
        avgBadges: st.avgBadges, champRate: st.champRate, rankUpRate: st.rankUpRate, avgMMR: st.avgMMR,
        winRate: st.roundWR, rounds: st.totRounds, lift: null, phase: 'late', layout: null,
        trinkets: Object.entries(tf).sort((a, b) => b[1] - a[1]).slice(0, 4).map((e) => e[0]),
        exemplars: members.slice(0, 4).map((m) => ({ ids: m.board, winRate: Math.round((m.roundWins / Math.max(m.rounds, 1)) * 100), lift: null, runs: 1, badges: m.badges, mmr: m.mmr })),
      });
    }
  }

  // ---- merge, dedupe (per trainer), rank: championship evidence leads
  const score = (b) => (b.champRate || 0) * 1.4 + (b.avgBadges || 0) * 4 + Math.min(b.runs || 0, 25) * 1.5
    + ((b.winRate || 0) - globalWR) * 0.8 + (b.source === 'trainer' ? 8 : 0);
  const all = comboBuilds.concat(trainerBuilds).sort((a, b) => score(b) - score(a));
  const kept = [];
  for (const b of all) {
    const bs = new Set(b.coreIds);
    // dedupe only WITHIN the same trainer — the same shell under a different
    // trainer is a genuinely different build (different passive carrying it)
    if (kept.some((k) => k.trainer === b.trainer && jac(bs, new Set(k.coreIds)) >= 0.6)) continue;
    kept.push(b);
  }
  const seenName = {};
  for (const b of kept) {
    const key = (b.trainer || '-') + '|' + b.name;
    if (seenName[key]) b.name = b.name.replace(/ core$/, '') + `+${b.coreNames[1] || ''} core`;
    seenName[key] = 1;
  }
  const final = kept.slice(0, opts.limit || 40).map((b) => Object.assign(b, { q: +score(b).toFixed(1) }));

  // ---- badge outcomes for the CURATED builds too, so all builds are comparable
  // and filter by the same ladder tiers ("including the builds you gave me already")
  const curatedStats = {};
  G.BUILDS.forEach((b) => {
    const core = (b.core || []).concat(b.lateCore || []).filter((id) => monById[id]);
    const st = core.length >= 3 ? statsForCore(core) : null;
    if (!st) return;
    curatedStats[b.id] = {
      avgBadges: st.avgBadges, champRate: st.champRate, rankUpRate: st.rankUpRate,
      fieldedRuns: st.fieldedRuns, roundWR: st.roundWR, avgMMR: st.avgMMR,
      topTrainer: st.trainer, topTrainerName: st.trainer ? trainerName(st.trainer) : null, trainerShare: st.trainerShare,
      badgeTier: st.champRate >= 50 ? 'champion' : st.rankUpRate >= 50 ? 'rankup' : 'mixed',
    };
  });

  const out = {
    generatedAt: S.generatedAt, source: 'discover_builds v2 · trainer-classified, badge-gated',
    globalWR, sample: S.sample, curatedStats,
    thresholds: { champion: CHAMP_BADGES, rankup: RANKUP_BADGES },
    corpus: { runs: digest.length, champion: digest.filter((d) => d.badges >= CHAMP_BADGES).length, rankup: digest.filter((d) => d.badges >= RANKUP_BADGES).length },
    builds: final,
  };
  if (opts.outPath !== false) fs.writeFileSync(opts.outPath || path.join(ROOT, 'discovered-builds.json'), JSON.stringify(out));
  return out;
}

module.exports = { discover };

if (require.main === module) {
  const out = discover();
  console.log(`\n${out.builds.length} archetypes · corpus ${out.corpus.runs} runs (${out.corpus.champion} champion 10+, ${out.corpus.rankup} rank-up 8+)\n`);
  const byT = {};
  out.builds.forEach((b) => ((byT[b.trainerName || '— unassigned —'] = byT[b.trainerName || '— unassigned —'] || []).push(b)));
  for (const [t, list] of Object.entries(byT)) {
    console.log(`\x1b[1m${t}\x1b[0m`);
    for (const b of list) {
      const tag = b.novelty === 'novel' ? '🧬' : b.novelty === 'variant' ? '🔀' : '✓';
      const tier = b.badgeTier === 'champion' ? '👑10+' : b.badgeTier === 'rankup' ? '📈8+' : '  ~ ';
      console.log(`  ${tag} ${tier} ${String(b.avgBadges ?? '?').padStart(4)}🏅 champ${String(b.champRate ?? '?').padStart(3)}% ${String(b.runs).padStart(3)}r  ${b.name}`);
      console.log(`        ${b.coreNames.join(', ')}`);
    }
  }
  console.log('\n→ wrote discovered-builds.json');
}
