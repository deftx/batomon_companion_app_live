// Analyzes raw crawled run histories (runs-raw.json) into synergy-stats.json.
// Separated from the crawler so re-slicing needs no network.
//
// Computes: per-monster real stats (+byDay), k-combinations (k=2..6) with
// win rate, lift and per-phase splits, trainer×monster, trinket×monster.
//
// Usage: node analyze_synergies.js            (reads ./runs-raw.json, writes ../synergy-stats.json + ../synergy.js)
const fs = require('fs');
const path = require('path');

const FLOORS = { 2: 60, 3: 40, 4: 25, 5: 15, 6: 10 }; // min board-rounds per combo size
const TRAINER_FLOORS = { 1: 60, 2: 30, 3: 20, 4: 12, 5: 8, 6: 6 };
const TRINKET_FLOORS = { 1: 50, 2: 25, 3: 15 };
const TRINKETSET_FLOORS = { 2: 30, 3: 15 };
const MIN_RUNS = 3;   // combo must appear in >= N distinct runs (kills one-player pet comps)
const MIN_RUNS_DEEP = 2; // for 5/6-sized combos where data is thin
const CAP_PER_K = 200;
const phaseOf = (round) => (round <= 3 ? 'early' : round <= 6 ? 'mid' : 'late');

function* combinations(arr, k, start = 0, acc = []) {
  if (acc.length === k) { yield acc.slice(); return; }
  for (let i = start; i <= arr.length - (k - acc.length); i++) {
    acc.push(arr[i]);
    yield* combinations(arr, k, i + 1, acc);
    acc.pop();
  }
}

function analyze(rawPath, outDir, datasetPath) {
  const runs = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  let tierOf = {}, levelsOf = {};
  try {
    const ds = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    ds.monsters.forEach(m => { tierOf[m.id] = m.tier; levelsOf[m.id] = { levels: m.levels, shinyLevels: m.shinyLevels }; });
  } catch { /* enrichment optional */ }

  // per-board raw output profile (per second where meaningful) for enemy modeling
  function boardProfile(board) {
    const p = { dps: 0, heal: 0, shield: 0, burnApp: 0, poisonApp: 0, shockApp: 0, hitRate: 0, units: 0 };
    for (const b of board || []) {
      const lv = levelsOf[b.speciesId];
      if (!lv || !Array.isArray(lv.levels)) continue;
      const arr = b.shiny && Array.isArray(lv.shinyLevels) && lv.shinyLevels.length ? lv.shinyLevels : lv.levels;
      const ld = arr.find(l => l.level === Math.min(b.level || 1, 4)) || arr[arr.length - 1];
      if (!ld || !Array.isArray(ld.stats)) continue;
      const cd = Math.max(ld.cooldown || 5, 0.5);
      const mc = ld.multicast || 1;
      const g = (key) => { const s = ld.stats.find(s => s.key === key); return s ? s.value : 0; };
      p.dps += (g('damage') * mc) / cd;
      p.heal += (g('heal') * mc) / cd;
      p.shield += (g('shield') * mc) / cd;
      p.burnApp += (g('burn') * mc) / cd;
      p.poisonApp += (g('poison') * mc) / cd;
      p.shockApp += (g('shock') * mc) / cd;
      if (g('damage') > 0) p.hitRate += mc / cd; // direct hits/s — shock trigger rate
      p.units++;
    }
    return p;
  }

  const S = {
    rounds: 0,
    monsters: {}, combos: { 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
    positions: {},
    comboLayouts: { 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
    trainerCombos: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
    trinketCombos: { 1: {}, 2: {}, 3: {} },
    trinketSets: { 2: {}, 3: {} },
    trainerMon: {}, trainers: {}, trinketsHeld: {}, trinketMon: {},
  };
  const bump = (store, key, won, runTracker) => {
    const C = store[key] = store[key] || { rounds: 0, wins: 0, runsSet: 0 };
    C.rounds++; if (won) C.wins++;
    runTracker && runTracker.add(key);
    return C;
  };

  for (const run of runs) {
    const t = run.trainerId || 'unknown';
    S.trainers[t] = S.trainers[t] || { runs: 0, rounds: 0, roundWins: 0, reachedSum: 0 };
    S.trainers[t].runs++; S.trainers[t].reachedSum += run.roundReached || 0;
    const runMons = new Set();
    const tracker = {
      combos: { 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() },
      trainerCombos: { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() },
      trinketCombos: { 1: new Set(), 2: new Set(), 3: new Set() },
      trinketSets: { 2: new Set(), 3: new Set() },
    };

    for (const round of run.rounds || []) {
      if (!round.board || !round.board.length) continue;
      S.rounds++;
      const won = !!round.won;
      const day = Math.min(round.round || 1, 15);
      const phase = phaseOf(round.round || 1);
      S.trainers[t].rounds++; if (won) S.trainers[t].roundWins++;

      // group board entries by species — all per-monster stats count each species
      // ONCE per round (a 2-copy board must not double-weight the round)
      const bySpecies = {};
      for (const b of round.board) {
        if (!b.speciesId) continue;
        (bySpecies[b.speciesId] = bySpecies[b.speciesId] || []).push(b);
      }
      // slot positions — only FULL boards preserve slot identity (array index = slot 0-5)
      if (round.board.length === 6) {
        round.board.forEach((b, slot) => {
          if (!b.speciesId) return;
          const P = S.positions[b.speciesId] = S.positions[b.speciesId] || {};
          const ps = P[slot] = P[slot] || { r: 0, w: 0 };
          ps.r++; if (won) ps.w++;
        });
        // combo LAYOUTS: where do combo members sit relative to the grid?
        // slotOf: first slot per species (duplicates use their first slot)
        const slotOf = {};
        round.board.forEach((b, slot) => { if (b.speciesId && slotOf[b.speciesId] == null) slotOf[b.speciesId] = slot; });
        const uniqIds = Object.keys(slotOf).sort();
        for (let k = 2; k <= Math.min(6, uniqIds.length); k++) {
          for (const combo of combinations(uniqIds, k)) {
            const idsKey = combo.join('|');
            const layoutKey = combo.map(id => slotOf[id]).join(',');
            const CL = S.comboLayouts[k][idsKey] = S.comboLayouts[k][idsKey] || {};
            const L = CL[layoutKey] = CL[layoutKey] || { r: 0, w: 0 };
            L.r++; if (won) L.w++;
          }
        }
      }
      const monsSeen = new Set(Object.keys(bySpecies));
      for (const [id, entries] of Object.entries(bySpecies)) {
        runMons.add(id);
        const M = S.monsters[id] = S.monsters[id] || { rounds: 0, wins: 0, runs: 0, shinyRounds: 0, entryCount: 0, lvlSum: 0, copiesSum: 0, byDay: {}, byLevel: {}, byShiny: { yes: { r: 0, w: 0 }, no: { r: 0, w: 0 } } };
        M.rounds++; if (won) M.wins++;
        M.copiesSum += entries.length;
        M.entryCount += entries.length;
        M.lvlSum += entries.reduce((a, b) => a + (b.level || 1), 0);
        const anyShiny = entries.some(b => b.shiny);
        if (anyShiny) M.shinyRounds++;
        const sh = anyShiny ? M.byShiny.yes : M.byShiny.no;
        sh.r++; if (won) sh.w++;
        const bd = M.byDay[day] = M.byDay[day] || { r: 0, w: 0 };
        bd.r++; if (won) bd.w++;
        // one count per distinct level present this round
        for (const lvl of new Set(entries.map(b => Math.min(Math.max(b.level || 1, 1), 5)))) {
          const bl = M.byLevel[lvl] = M.byLevel[lvl] || { r: 0, w: 0 };
          bl.r++; if (won) bl.w++;
        }
        const tm = t + '|' + id;
        S.trainerMon[tm] = S.trainerMon[tm] || { rounds: 0, wins: 0 };
        S.trainerMon[tm].rounds++; if (won) S.trainerMon[tm].wins++;
      }

      const uniq = [...monsSeen].sort();
      // monster k-combos (with phase splits)
      for (let k = 2; k <= Math.min(6, uniq.length); k++) {
        for (const combo of combinations(uniq, k)) {
          const key = combo.join('|');
          const C = S.combos[k][key] = S.combos[k][key] || { rounds: 0, wins: 0, runsSet: 0, phases: { early: { r: 0, w: 0 }, mid: { r: 0, w: 0 }, late: { r: 0, w: 0 } } };
          C.rounds++; if (won) C.wins++;
          C.phases[phase].r++; if (won) C.phases[phase].w++;
          tracker.combos[k].add(key);
        }
      }
      // trainer + k monsters (k=1..6)
      for (let k = 1; k <= Math.min(6, uniq.length); k++) {
        for (const combo of combinations(uniq, k)) {
          bump(S.trainerCombos[k], t + '||' + combo.join('|'), won, tracker.trainerCombos[k]);
        }
      }
      // trinkets: held stats, trinket + k monsters (k=1..3), trinket sets (2-3 held together)
      const heldIds = [...new Set((round.trinkets || []).map(tk => tk.id).filter(Boolean))].sort();
      for (const tkId of heldIds) {
        S.trinketsHeld[tkId] = S.trinketsHeld[tkId] || { rounds: 0, wins: 0 };
        S.trinketsHeld[tkId].rounds++; if (won) S.trinketsHeld[tkId].wins++;
        for (let k = 1; k <= Math.min(3, uniq.length); k++) {
          for (const combo of combinations(uniq, k)) {
            bump(S.trinketCombos[k], tkId + '||' + combo.join('|'), won, tracker.trinketCombos[k]);
            if (k === 1) { // legacy field
              const key = tkId + '|' + combo[0];
              S.trinketMon[key] = S.trinketMon[key] || { rounds: 0, wins: 0 };
              S.trinketMon[key].rounds++; if (won) S.trinketMon[key].wins++;
            }
          }
        }
      }
      for (let k = 2; k <= Math.min(3, heldIds.length); k++) {
        for (const set of combinations(heldIds, k)) {
          bump(S.trinketSets[k], set.join('|'), won, tracker.trinketSets[k]);
        }
      }
    }
    for (const id of runMons) S.monsters[id] && S.monsters[id].runs++;
    for (const [fam, sizes] of Object.entries(tracker)) {
      for (const [k, keys] of Object.entries(sizes)) {
        for (const key of keys) S[fam][k][key].runsSet++;
      }
    }
  }

  // expected-enemy profiles per day, from every real board seen at that round
  const dayAgg = {}, dayBoards = {};
  for (const run of runs) {
    for (const rd of run.rounds || []) {
      if (!rd.board || !rd.board.length) continue;
      const day = Math.min(rd.round || 1, 15);
      const p = boardProfile(rd.board);
      const a = dayAgg[day] = dayAgg[day] || { n: 0, dps: 0, heal: 0, shield: 0, burnApp: 0, poisonApp: 0, shockApp: 0, hitRate: 0, units: 0 };
      a.n++;
      for (const k of ['dps', 'heal', 'shield', 'burnApp', 'poisonApp', 'shockApp', 'hitRate', 'units']) a[k] += p[k];
      (dayBoards[day] = dayBoards[day] || []).push(p); // keep the raw per-board profiles for archetype clustering
    }
  }
  const dayProfiles = {};
  for (const [day, a] of Object.entries(dayAgg)) {
    dayProfiles[day] = {
      boards: a.n,
      dps: +(a.dps / a.n).toFixed(1),
      heal: +(a.heal / a.n).toFixed(1),
      shield: +(a.shield / a.n).toFixed(1),
      burnApp: +(a.burnApp / a.n).toFixed(2),
      poisonApp: +(a.poisonApp / a.n).toFixed(2),
      shockApp: +(a.shockApp / a.n).toFixed(2),
      hitRate: +(a.hitRate / a.n).toFixed(2),
      units: +(a.units / a.n).toFixed(1),
    };
  }
  // 🎯 ENEMY ARCHETYPES — the mean profile above is one "average blob", but real day-N
  // boards vary (sustain walls vs burst rush vs balanced). Cluster each day's per-board
  // profiles into 2-3 centroids so the app's win% can be "P(beat a real DRAW)" instead of
  // "vs the mean". Lightweight deterministic k-means on the mean-normalized profile vectors.
  const ARCH_KEYS = ['dps', 'heal', 'shield', 'burnApp', 'poisonApp', 'shockApp', 'hitRate'];
  function kmeans(vecs, K, iters) {
    const dim = vecs[0].length;
    const order = vecs.map((v, i) => [i, v.reduce((s, x) => s + x, 0)]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    let cents = Array.from({ length: K }, (_, k) => vecs[order[Math.floor(k * (vecs.length - 1) / Math.max(K - 1, 1))]].slice());
    const assign = new Array(vecs.length).fill(0);
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < vecs.length; i++) {
        let bd = Infinity, bk = 0;
        for (let k = 0; k < K; k++) { let d = 0; for (let j = 0; j < dim; j++) { const e = vecs[i][j] - cents[k][j]; d += e * e; } if (d < bd) { bd = d; bk = k; } }
        assign[i] = bk;
      }
      const sums = Array.from({ length: K }, () => new Array(dim).fill(0)), cnts = new Array(K).fill(0);
      for (let i = 0; i < vecs.length; i++) { cnts[assign[i]]++; for (let j = 0; j < dim; j++) sums[assign[i]][j] += vecs[i][j]; }
      for (let k = 0; k < K; k++) if (cnts[k]) for (let j = 0; j < dim; j++) cents[k][j] = sums[k][j] / cnts[k];
    }
    const cnts = new Array(K).fill(0); assign.forEach(a => cnts[a]++);
    return cents.map((c, k) => ({ c, members: cnts[k] })).filter(x => x.members > 0);
  }
  const dayArchetypes = {};
  for (const [day, boards] of Object.entries(dayBoards)) {
    if (boards.length < 24) continue; // too few to cluster meaningfully → app falls back to the mean
    const mean = {}; ARCH_KEYS.forEach(k => (mean[k] = Math.max(dayProfiles[day][k] || 0.01, 0.01)));
    const vecs = boards.map(p => ARCH_KEYS.map(k => (p[k] || 0) / mean[k])); // mean-normalized so dps scale doesn't dominate
    const clusters = kmeans(vecs, boards.length >= 60 ? 3 : 2, 25);
    dayArchetypes[day] = clusters.map(cl => {
      const arch = { weight: +(cl.members / boards.length).toFixed(3) };
      ARCH_KEYS.forEach((k, j) => (arch[k] = +(cl.c[j] * mean[k]).toFixed(2))); // denormalize back to real units
      return arch;
    }).sort((a, b) => b.weight - a.weight);
  }

  const totalRuns = runs.length;
  const globalWins = Object.values(S.monsters).reduce((a, m) => a + m.wins, 0);
  const globalRounds = Object.values(S.monsters).reduce((a, m) => a + m.rounds, 0);
  const globalWR = globalWins / Math.max(globalRounds, 1);

  const monstersOut = {};
  for (const [id, m] of Object.entries(S.monsters)) {
    monstersOut[id] = {
      rounds: m.rounds, runs: m.runs, tier: tierOf[id] || null,
      winRate: +(100 * m.wins / m.rounds).toFixed(1),
      pickRate: +(100 * m.runs / totalRuns).toFixed(1),
      avgLevel: +(m.lvlSum / Math.max(m.entryCount, 1)).toFixed(2),
      avgCopies: +(m.copiesSum / m.rounds).toFixed(2),
      shinyRate: +(100 * m.shinyRounds / m.rounds).toFixed(1),
      shinyWR: m.byShiny.yes.r >= 20 ? +(100 * m.byShiny.yes.w / m.byShiny.yes.r).toFixed(1) : null,
      normalWR: m.byShiny.no.r >= 20 ? +(100 * m.byShiny.no.w / m.byShiny.no.r).toFixed(1) : null,
      shinyRounds: m.byShiny.yes.r,
      byDay: Object.fromEntries(Object.entries(m.byDay).map(([d, v]) => [d, { rounds: v.r, winRate: +(100 * v.w / v.r).toFixed(1) }])),
      byLevel: Object.fromEntries(Object.entries(m.byLevel).map(([l, v]) => [l, { rounds: v.r, winRate: +(100 * v.w / v.r).toFixed(1) }])),
    };
    // slot placement stats from full boards
    const P = S.positions[id];
    if (P) {
      const totalSlotRounds = Object.values(P).reduce((a, v) => a + v.r, 0);
      if (totalSlotRounds >= 40) {
        const slots = {};
        for (const [slot, v] of Object.entries(P)) {
          slots[slot] = { rounds: v.r, winRate: +(100 * v.w / v.r).toFixed(1), share: +(100 * v.r / totalSlotRounds).toFixed(1) };
        }
        let fav = null, best = null;
        for (const [slot, v] of Object.entries(slots)) {
          if (!fav || v.share > slots[fav].share) fav = slot;
          if (v.rounds >= 25 && (!best || v.winRate > slots[best].winRate)) best = slot;
        }
        monstersOut[id].slots = slots;
        monstersOut[id].slotRounds = totalSlotRounds;
        monstersOut[id].favSlot = +fav;
        monstersOut[id].bestSlot = best != null ? +best : null;
      }
    }
  }
  const monWR = (id) => (S.monsters[id] ? S.monsters[id].wins / S.monsters[id].rounds : globalWR);
  // WR of a monster combo irrespective of trainer/trinket — baseline for cross-entity lift
  const comboWR = (ids) => {
    if (ids.length === 1) return monWR(ids[0]);
    const c = S.combos[ids.length] && S.combos[ids.length][ids.join('|')];
    return c ? c.wins / c.rounds : ids.map(monWR).reduce((a, b) => a + b, 0) / ids.length;
  };

  const combosOut = {};
  for (let k = 2; k <= 6; k++) {
    const rows = [];
    for (const [key, c] of Object.entries(S.combos[k])) {
      if (c.rounds < FLOORS[k] || c.runsSet < MIN_RUNS) continue;
      const ids = key.split('|');
      const memberWRs = ids.map(id => S.monsters[id] ? S.monsters[id].wins / S.monsters[id].rounds : globalWR);
      const wr = c.wins / c.rounds;
      const expected = memberWRs.reduce((a, b) => a + b, 0) / memberWRs.length;
      const phases = {};
      for (const [p, v] of Object.entries(c.phases)) {
        phases[p] = v.r >= 8 ? { rounds: v.r, winRate: +(100 * v.w / v.r).toFixed(1) } : null;
      }
      const row = { ids, rounds: c.rounds, runs: c.runsSet, winRate: +(100 * wr).toFixed(1), lift: +(100 * (wr - expected)).toFixed(1), phases };
      // attach real board layouts (from full boards) for k<=4
      const CL = S.comboLayouts[k] && S.comboLayouts[k][key];
      if (CL) {
        const minPos = k >= 6 ? 8 : k >= 5 ? 10 : 15;
        const minLay = k >= 6 ? 4 : k >= 5 ? 5 : 8;
        const totalLR = Object.values(CL).reduce((a, v) => a + v.r, 0);
        if (totalLR >= minPos) {
          row.posRounds = totalLR;
          row.layouts = Object.entries(CL)
            .filter(([, v]) => v.r >= minLay)
            .map(([lk, v]) => ({ slots: lk.split(',').map(Number), rounds: v.r, winRate: +(100 * v.w / v.r).toFixed(1), share: +(100 * v.r / totalLR).toFixed(1) }))
            .sort((a, b) => b.rounds - a.rounds)
            .slice(0, 3);
          if (!row.layouts.length) delete row.layouts;
        }
      }
      rows.push(row);
    }
    rows.sort((a, b) => b.winRate - a.winRate);
    combosOut[k] = rows.slice(0, CAP_PER_K);
  }

  const trainerMonOut = Object.entries(S.trainerMon)
    .filter(([, v]) => v.rounds >= 60)
    .map(([key, v]) => { const [trainer, mon] = key.split('|'); return { trainer, monster: mon, rounds: v.rounds, winRate: +(100 * v.wins / v.rounds).toFixed(1) }; })
    .sort((a, b) => b.winRate - a.winRate).slice(0, 200);
  const trinketMonOut = Object.entries(S.trinketMon)
    .filter(([, v]) => v.rounds >= 50)
    .map(([key, v]) => { const [trinket, mon] = key.split('|'); return { trinket, monster: mon, rounds: v.rounds, winRate: +(100 * v.wins / v.rounds).toFixed(1) }; })
    .sort((a, b) => b.winRate - a.winRate).slice(0, 200);

  // trainer + k monsters: lift = WR with this trainer minus the combo's overall WR
  const trainerCombosOut = {};
  for (const [k, store] of Object.entries(S.trainerCombos)) {
    const rows = [];
    for (const [key, c] of Object.entries(store)) {
      if (c.rounds < (TRAINER_FLOORS[k] || 10) || c.runsSet < (k >= 5 ? MIN_RUNS_DEEP : MIN_RUNS)) continue;
      const [trainer, monsPart] = key.split('||');
      const ids = monsPart.split('|');
      const wr = c.wins / c.rounds;
      rows.push({ trainer, ids, rounds: c.rounds, runs: c.runsSet, winRate: +(100 * wr).toFixed(1), lift: +(100 * (wr - comboWR(ids))).toFixed(1) });
    }
    rows.sort((a, b) => b.winRate - a.winRate);
    trainerCombosOut[k] = rows.slice(0, CAP_PER_K);
  }
  // trinket + k monsters: lift vs the combo's overall WR (what holding the trinket adds)
  const trinketCombosOut = {};
  for (const [k, store] of Object.entries(S.trinketCombos)) {
    const rows = [];
    for (const [key, c] of Object.entries(store)) {
      if (c.rounds < (TRINKET_FLOORS[k] || 15) || c.runsSet < MIN_RUNS) continue;
      const [trinket, monsPart] = key.split('||');
      const ids = monsPart.split('|');
      const wr = c.wins / c.rounds;
      rows.push({ trinket, ids, rounds: c.rounds, runs: c.runsSet, winRate: +(100 * wr).toFixed(1), lift: +(100 * (wr - comboWR(ids))).toFixed(1) });
    }
    rows.sort((a, b) => b.winRate - a.winRate);
    trinketCombosOut[k] = rows.slice(0, CAP_PER_K);
  }
  // trinket sets (held together): lift vs avg of each trinket's held-WR
  const heldWR = (id) => (S.trinketsHeld[id] ? S.trinketsHeld[id].wins / S.trinketsHeld[id].rounds : globalWR);
  const trinketSetsOut = {};
  for (const [k, store] of Object.entries(S.trinketSets)) {
    const rows = [];
    for (const [key, c] of Object.entries(store)) {
      if (c.rounds < (TRINKETSET_FLOORS[k] || 15) || c.runsSet < MIN_RUNS) continue;
      const ids = key.split('|');
      const wr = c.wins / c.rounds;
      const expected = ids.map(heldWR).reduce((a, b) => a + b, 0) / ids.length;
      rows.push({ ids, rounds: c.rounds, runs: c.runsSet, winRate: +(100 * wr).toFixed(1), lift: +(100 * (wr - expected)).toFixed(1) });
    }
    rows.sort((a, b) => b.winRate - a.winRate);
    trinketSetsOut[k] = rows.slice(0, CAP_PER_K);
  }
  const trainersOut = Object.fromEntries(Object.entries(S.trainers).map(([t, v]) =>
    [t, { runs: v.runs, roundWinRate: +(100 * v.roundWins / Math.max(v.rounds, 1)).toFixed(1), avgRoundReached: +(v.reachedSum / v.runs).toFixed(1) }]));
  const trinketsHeldOut = Object.fromEntries(Object.entries(S.trinketsHeld).filter(([, v]) => v.rounds >= 30).map(([t, v]) =>
    [t, { rounds: v.rounds, winRate: +(100 * v.wins / v.rounds).toFixed(1) }]));

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'batodex.com top-leaderboard player run histories (Master tier)',
    sample: { players: null, runs: totalRuns, rounds: S.rounds, globalRoundWR: +(100 * globalWR).toFixed(1) },
    monsters: monstersOut,
    combos: combosOut,
    pairs: combosOut[2], // back-compat alias
    trainerCombos: trainerCombosOut,
    trinketCombos: trinketCombosOut,
    trinketSets: trinketSetsOut,
    trainerMon: trainerMonOut, trinketMon: trinketMonOut,
    trainers: trainersOut, trinketsHeld: trinketsHeldOut,
    dayProfiles,
    dayArchetypes,
  };
  try { out.sample.players = JSON.parse(fs.readFileSync(path.join(path.dirname(rawPath), 'runs-raw-meta.json'), 'utf8')).players; } catch {}

  fs.writeFileSync(path.join(outDir, 'synergy-stats.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(outDir, 'synergy.js'), 'window.SYNERGY = ' + JSON.stringify(out) + ';\n');
  console.log('ANALYZED:', totalRuns, 'runs,', S.rounds, 'rounds |',
    Object.entries(combosOut).map(([k, v]) => `${k}-combos: ${v.length}`).join(', '));
  console.log('trainer combos:', Object.entries(trainerCombosOut).map(([k, v]) => `+${k}: ${v.length}`).join(', '));
  console.log('trinket combos:', Object.entries(trinketCombosOut).map(([k, v]) => `+${k}: ${v.length}`).join(', '),
    '| trinket sets:', Object.entries(trinketSetsOut).map(([k, v]) => `x${k}: ${v.length}`).join(', '));
  // learn emergent build archetypes from the freshly-written combos
  try {
    const d = require('./discover_builds.js').discover({ synergyPath: path.join(outDir, 'synergy-stats.json'), outPath: path.join(outDir, 'discovered-builds.json') });
    console.log('DISCOVERED:', d.builds.length, 'build archetypes (' + d.builds.filter(b => b.novelty === 'novel').length + ' novel) → discovered-builds.json');
  } catch (e) { console.log('discover_builds skipped:', e.message); }
  return out;
}

module.exports = { analyze };
if (require.main === module) {
  analyze(path.join(__dirname, 'runs-raw.json'), path.join(__dirname, '..'), path.join(__dirname, '..', 'dataset.json'));
}
