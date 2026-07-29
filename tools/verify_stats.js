// Independent verification of synergy-stats.json against runs-raw.json.
// Deliberately re-implements the aggregation with a DIFFERENT approach
// (per-round flat event list + filter/count) so a shared bug can't hide.
// Also checks structural invariants and the lift math.
const fs = require('fs');
const path = require('path');

const runs = JSON.parse(fs.readFileSync(path.join(__dirname, 'runs-raw.json'), 'utf8'));
const S = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'synergy-stats.json'), 'utf8'));

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); }
}
const close = (a, b, tol = 0.051) => Math.abs(a - b) <= tol; // rounding tolerance on 1dp percentages

// ---- flat event table: one record per (round, unique board species) ----
const events = []; // {trainer, day, won, mons:[ids], monLevels:{id:maxLvl?}, monShiny:{id:bool}, trinkets:[ids]}
for (const run of runs) {
  for (const rd of run.rounds || []) {
    if (!rd.board || !rd.board.length) continue;
    const mons = {};
    for (const b of rd.board) {
      if (!b.speciesId) continue;
      mons[b.speciesId] = mons[b.speciesId] || [];
      mons[b.speciesId].push(b);
    }
    events.push({
      runId: run.id, trainer: run.trainerId || 'unknown',
      day: Math.min(rd.round || 1, 15), won: !!rd.won,
      mons, trinkets: [...new Set((rd.trinkets || []).map(t => t.id).filter(Boolean))],
    });
  }
}
console.log('events (board-rounds):', events.length);
check('total rounds match', events.length === S.sample.rounds, `${events.length} vs ${S.sample.rounds}`);
check('total runs match', runs.length === S.sample.runs, `${runs.length} vs ${S.sample.runs}`);

// ---- monster stats: verify 12 monsters (highest-round + random) ----
const monIds = Object.keys(S.monsters);
const sorted = monIds.slice().sort((a, b) => S.monsters[b].rounds - S.monsters[a].rounds);
const sample = [...sorted.slice(0, 6), ...sorted.filter((_, i) => i % 13 === 7).slice(0, 6)];
for (const id of sample) {
  const ev = events.filter(e => e.mons[id]);
  const wins = ev.filter(e => e.won).length;
  const wr = +(100 * wins / ev.length).toFixed(1);
  const st = S.monsters[id];
  check(`monster ${id} rounds`, ev.length === st.rounds, `${ev.length} vs ${st.rounds}`);
  check(`monster ${id} WR`, close(wr, st.winRate), `${wr} vs ${st.winRate}`);
  // pickRate: fraction of runs containing it
  const runsWith = new Set(ev.map(e => e.runId)).size;
  check(`monster ${id} pickRate`, close(+(100 * runsWith / runs.length).toFixed(1), st.pickRate), `${(100 * runsWith / runs.length).toFixed(1)} vs ${st.pickRate}`);
  // byDay: verify one day with data
  const day = Object.keys(st.byDay || {})[0];
  if (day) {
    const dev = ev.filter(e => e.day === +day);
    const dwr = +(100 * dev.filter(e => e.won).length / dev.length).toFixed(1);
    check(`monster ${id} byDay[${day}]`, dev.length === st.byDay[day].rounds && close(dwr, st.byDay[day].winRate), `${dev.length}/${dwr} vs ${st.byDay[day].rounds}/${st.byDay[day].winRate}`);
  }
  // byLevel: verify one level (a species instance counts once per round at each level it appears... NOTE: analyzer counts PER BOARD ENTRY for levels, so duplicates count twice)
}

// ---- byLevel accounting model check (analyzer counts per board-entry, not per unique species) ----
// Recompute for one high-volume monster both ways to detect which model the output uses.
{
  const id = sorted[0];
  const st = S.monsters[id];
  let perEntry = {}, perUnique = {};
  for (const e of events) {
    const entries = e.mons[id];
    if (!entries) continue;
    const uniqLvls = new Set();
    for (const b of entries) {
      const l = Math.min(Math.max(b.level || 1, 1), 5);
      perEntry[l] = perEntry[l] || { r: 0, w: 0 };
      perEntry[l].r++; if (e.won) perEntry[l].w++;
      uniqLvls.add(l);
    }
    for (const l of uniqLvls) {
      perUnique[l] = perUnique[l] || { r: 0, w: 0 };
      perUnique[l].r++; if (e.won) perUnique[l].w++;
    }
  }
  const lvl = Object.keys(st.byLevel || {})[0];
  if (lvl) {
    const pu = perUnique[lvl];
    check(`byLevel per-unique model for ${id}`, pu && st.byLevel[lvl].rounds === pu.r && close(+(100 * pu.w / pu.r).toFixed(1), st.byLevel[lvl].winRate),
      `stats=${st.byLevel[lvl].rounds}/${st.byLevel[lvl].winRate}, recomputed=${pu && pu.r}/${pu && (100 * pu.w / pu.r).toFixed(1)}`);
  }
  // shiny-split: recompute shiny-presence WR
  {
    const st0 = S.monsters[id];
    if (st0.shinyWR != null) {
      const ev = events.filter(e => e.mons[id]);
      const sEv = ev.filter(e => e.mons[id].some(b => b.shiny));
      const swr = +(100 * sEv.filter(e => e.won).length / sEv.length).toFixed(1);
      check(`monster ${id} shinyWR`, sEv.length === st0.shinyRounds && close(swr, st0.shinyWR), `${sEv.length}/${swr} vs ${st0.shinyRounds}/${st0.shinyWR}`);
    }
  }
}

// ---- pairs & trios: verify top 5 + invariants ----
function comboEvents(ids) { return events.filter(e => ids.every(id => e.mons[id])); }
for (const p of (S.combos['2'] || []).slice(0, 5)) {
  const ev = comboEvents(p.ids);
  const wr = +(100 * ev.filter(e => e.won).length / ev.length).toFixed(1);
  check(`pair ${p.ids.join('+')} rounds`, ev.length === p.rounds, `${ev.length} vs ${p.rounds}`);
  check(`pair ${p.ids.join('+')} WR`, close(wr, p.winRate), `${wr} vs ${p.winRate}`);
  // lift math: wr - avg(member overall WR)
  const expected = p.ids.reduce((a, id) => a + S.monsters[id].winRate, 0) / p.ids.length;
  check(`pair ${p.ids.join('+')} lift math`, close(p.lift, +(p.winRate - expected).toFixed(1), 0.15), `${p.lift} vs ${(p.winRate - expected).toFixed(1)}`);
  // runs breadth
  const distinctRuns = new Set(ev.map(e => e.runId)).size;
  check(`pair ${p.ids.join('+')} runs`, distinctRuns === p.runs, `${distinctRuns} vs ${p.runs}`);
}
for (const t of (S.combos['3'] || []).slice(0, 3)) {
  const ev = comboEvents(t.ids);
  const wr = +(100 * ev.filter(e => e.won).length / ev.length).toFixed(1);
  check(`trio ${t.ids.join('+')} rounds+WR`, ev.length === t.rounds && close(wr, t.winRate), `${ev.length}/${wr} vs ${t.rounds}/${t.winRate}`);
  // subset monotonicity: trio rounds <= each contained pair's rounds (if that pair is in output)
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const pr = (S.combos['2'] || []).find(p => p.ids[0] === t.ids[i] && p.ids[1] === t.ids[j]);
    if (pr) check(`subset ${t.ids[i]}+${t.ids[j]} ⊇ trio`, pr.rounds >= t.rounds, `${pr.rounds} < ${t.rounds}`);
  }
  // phase splits sum to total
  const phSum = Object.values(t.phases || {}).reduce((a, v) => a + (v ? v.rounds : 0), 0);
  check(`trio ${t.ids.join('+')} phases ≤ total`, phSum <= t.rounds, `${phSum} > ${t.rounds}`);
}

// ---- trainer combos: verify top 3 of +2 ----
for (const tc of (S.trainerCombos['2'] || []).slice(0, 3)) {
  const ev = comboEvents(tc.ids).filter(e => e.trainer === tc.trainer);
  const wr = +(100 * ev.filter(e => e.won).length / ev.length).toFixed(1);
  check(`trainerCombo ${tc.trainer}+${tc.ids.join('+')}`, ev.length === tc.rounds && close(wr, tc.winRate), `${ev.length}/${wr} vs ${tc.rounds}/${tc.winRate}`);
  // trainer lift = wr - comboWR(ids overall)
  const overall = comboEvents(tc.ids);
  const overallWR = 100 * overall.filter(e => e.won).length / overall.length;
  check(`trainerCombo ${tc.trainer}+${tc.ids.join('+')} lift`, close(tc.lift, +(tc.winRate - overallWR).toFixed(1), 0.15), `${tc.lift} vs ${(tc.winRate - overallWR).toFixed(1)}`);
}

// ---- trinket combos + sets: verify top 3 each ----
for (const tk of (S.trinketCombos['1'] || []).slice(0, 3)) {
  const ev = comboEvents(tk.ids).filter(e => e.trinkets.includes(tk.trinket));
  const wr = +(100 * ev.filter(e => e.won).length / ev.length).toFixed(1);
  check(`trinketCombo ${tk.trinket}+${tk.ids.join('+')}`, ev.length === tk.rounds && close(wr, tk.winRate), `${ev.length}/${wr} vs ${tk.rounds}/${tk.winRate}`);
}
for (const ts of (S.trinketSets['2'] || []).slice(0, 3)) {
  const ev = events.filter(e => ts.ids.every(id => e.trinkets.includes(id)));
  const wr = +(100 * ev.filter(e => e.won).length / ev.length).toFixed(1);
  check(`trinketSet ${ts.ids.join('+')}`, ev.length === ts.rounds && close(wr, ts.winRate), `${ev.length}/${wr} vs ${ts.rounds}/${ts.winRate}`);
}

// ---- deeper families: trainer +3, trinket +2, trinket sets x3, avgCopies/avgLevel ----
for (const tc of (S.trainerCombos['3'] || []).slice(0, 3)) {
  const ev = comboEvents(tc.ids).filter(e => e.trainer === tc.trainer);
  const wr = +(100 * ev.filter(e => e.won).length / ev.length).toFixed(1);
  check(`trainerCombo+3 ${tc.trainer}+${tc.ids.join('+')}`, ev.length === tc.rounds && close(wr, tc.winRate), `${ev.length}/${wr} vs ${tc.rounds}/${tc.winRate}`);
}
for (const tk of (S.trinketCombos['2'] || []).slice(0, 3)) {
  const ev = comboEvents(tk.ids).filter(e => e.trinkets.includes(tk.trinket));
  const wr = +(100 * ev.filter(e => e.won).length / ev.length).toFixed(1);
  check(`trinketCombo+2 ${tk.trinket}+${tk.ids.join('+')}`, ev.length === tk.rounds && close(wr, tk.winRate), `${ev.length}/${wr} vs ${tk.rounds}/${tk.winRate}`);
  // lift baseline = the monster combo's own WR
  const overall = comboEvents(tk.ids);
  const oWR = 100 * overall.filter(e => e.won).length / overall.length;
  check(`trinketCombo+2 ${tk.trinket} lift math`, close(tk.lift, +(tk.winRate - oWR).toFixed(1), 0.15), `${tk.lift} vs ${(tk.winRate - oWR).toFixed(1)}`);
}
for (const ts of (S.trinketSets['3'] || []).slice(0, 2)) {
  const ev = events.filter(e => ts.ids.every(id => e.trinkets.includes(id)));
  const wr = +(100 * ev.filter(e => e.won).length / ev.length).toFixed(1);
  check(`trinketSet x3 ${ts.ids.join('+')}`, ev.length === ts.rounds && close(wr, ts.winRate), `${ev.length}/${wr} vs ${ts.rounds}/${ts.winRate}`);
}
{
  // avgCopies & avgLevel recompute for the top-volume monster
  const id = sorted[0];
  const st = S.monsters[id];
  let copies = 0, lvlSum = 0, entries = 0, rounds = 0;
  for (const e of events) {
    const b = e.mons[id]; if (!b) continue;
    rounds++; copies += b.length;
    for (const x of b) { lvlSum += x.level || 1; entries++; }
  }
  check(`monster ${id} avgCopies`, close(+(copies / rounds).toFixed(2), st.avgCopies, 0.011), `${(copies / rounds).toFixed(2)} vs ${st.avgCopies}`);
  check(`monster ${id} avgLevel`, close(+(lvlSum / entries).toFixed(2), st.avgLevel, 0.011), `${(lvlSum / entries).toFixed(2)} vs ${st.avgLevel}`);
}
{
  // phase WR recompute for the top trio
  const t = (S.combos['3'] || [])[0];
  if (t) {
    const ev = comboEvents(t.ids);
    for (const [ph, range] of [['early', [1, 3]], ['mid', [4, 6]], ['late', [7, 99]]]) {
      const pe = ev.filter(e => { const d = e.day; return d >= range[0] && d <= range[1]; });
      const st = t.phases[ph];
      if (st) {
        const wr = +(100 * pe.filter(e => e.won).length / pe.length).toFixed(1);
        check(`trio phase ${ph} WR`, pe.length === st.rounds && close(wr, st.winRate), `${pe.length}/${wr} vs ${st.rounds}/${st.winRate}`);
      }
    }
  }
}

// ---- slot positions (full boards only, array index = slot) ----
{
  const id = 'puffloon';
  const st = S.monsters[id];
  if (st && st.slots) {
    const recomputed = {};
    for (const run of runs) {
      for (const rd of run.rounds || []) {
        if ((rd.board || []).length !== 6) continue;
        rd.board.forEach((b, slot) => {
          if (b.speciesId !== id) return;
          recomputed[slot] = recomputed[slot] || { r: 0, w: 0 };
          recomputed[slot].r++; if (rd.won) recomputed[slot].w++;
        });
      }
    }
    for (const [slot, v] of Object.entries(st.slots)) {
      const rc = recomputed[slot];
      check(`position ${id}@${slot}`, rc && rc.r === v.rounds && close(+(100 * rc.w / rc.r).toFixed(1), v.winRate),
        `${rc && rc.r}/${rc && (100 * rc.w / rc.r).toFixed(1)} vs ${v.rounds}/${v.winRate}`);
    }
    const shareSum = Object.values(st.slots).reduce((a, v) => a + v.share, 0);
    check(`position ${id} shares sum ~100`, Math.abs(shareSum - 100) < 0.5, String(shareSum));
  } else check('puffloon has slot data', false);
}

// ---- combo layouts (full boards, first-slot per species, ids alphabetical) ----
{
  const combo = (S.combos['2'] || []).find(c => c.layouts && c.layouts.length);
  if (combo) {
    const [a, b] = combo.ids;
    const counts = {};
    for (const run of runs) {
      for (const rd of run.rounds || []) {
        if ((rd.board || []).length !== 6) continue;
        const slotOf = {};
        rd.board.forEach((x, slot) => { if (x.speciesId && slotOf[x.speciesId] == null) slotOf[x.speciesId] = slot; });
        if (slotOf[a] == null || slotOf[b] == null) continue;
        const key = slotOf[a] + ',' + slotOf[b];
        counts[key] = counts[key] || { r: 0, w: 0 };
        counts[key].r++; if (rd.won) counts[key].w++;
      }
    }
    const totalLR = Object.values(counts).reduce((x, v) => x + v.r, 0);
    check(`layout ${combo.ids.join('+')} posRounds`, totalLR === combo.posRounds, `${totalLR} vs ${combo.posRounds}`);
    for (const L of combo.layouts) {
      const rc = counts[L.slots.join(',')];
      check(`layout ${combo.ids.join('+')}@${L.slots.join(',')}`, rc && rc.r === L.rounds && close(+(100 * rc.w / rc.r).toFixed(1), L.winRate),
        `${rc && rc.r}/${rc && (100 * rc.w / rc.r).toFixed(1)} vs ${L.rounds}/${L.winRate}`);
    }
  } else check('some pair has layouts', false);
}

// ---- global invariants ----
check('all monster WRs in [0,100]', monIds.every(id => S.monsters[id].winRate >= 0 && S.monsters[id].winRate <= 100));
check('all pair rounds >= floor(60)', (S.combos['2'] || []).every(p => p.rounds >= 60));
check('all trios rounds >= floor(40)', (S.combos['3'] || []).every(p => p.rounds >= 40));
check('global WR consistent', close(S.sample.globalRoundWR,
  +(100 * monIds.reduce((a, id) => a + S.monsters[id].winRate / 100 * S.monsters[id].rounds, 0) / monIds.reduce((a, id) => a + S.monsters[id].rounds, 0)).toFixed(1), 0.2));

console.log(`\n==== VERIFICATION: ${pass} passed, ${fail} failed ====`);
failures.forEach(f => console.log('FAIL:', f));
process.exit(fail ? 1 : 0);
