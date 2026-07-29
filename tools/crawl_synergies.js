// Crawls top batodex.com players' embedded ranked run histories.
// Dumps raw runs to tools/runs-raw.json, then runs analyze_synergies.js
// (so future re-slicing needs no network — just re-run the analyzer).
//
// Usage: node crawl_synergies.js [maxPlayers=40]
const fs = require('fs');
const path = require('path');
const { analyze } = require('./analyze_synergies.js');

const MAX_PLAYERS = parseInt(process.argv[2] || '40', 10);
const UA = { 'user-agent': 'Mozilla/5.0 (batomon-companion; personal use)' };

function decodeFlight(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  return [...html.matchAll(re)].map(m => JSON.parse('"' + m[1] + '"')).join('');
}
function parseBalanced(s, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  throw new Error('unbalanced');
}
async function fetchText(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return await r.text();
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function extractRuns(flight) {
  const runs = [];
  let idx = 0;
  while ((idx = flight.indexOf('"runs":[', idx)) !== -1) {
    const arrStart = flight.indexOf('[', idx + 7);
    try {
      const raw = parseBalanced(flight, arrStart);
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length && arr[0].rounds) runs.push(...arr);
    } catch (e) { /* skip */ }
    idx += 8;
  }
  return runs;
}

(async () => {
  const lb = await fetchText('https://batodex.com/leaderboard');
  const ids = [...new Set([...lb.matchAll(/href="\/players\/([a-z0-9]+)"/g)].map(m => m[1]))].slice(0, MAX_PLAYERS);
  console.log('leaderboard players:', ids.length);

  const allRuns = [];
  const seen = new Set();
  let done = 0;
  for (const id of ids) {
    try {
      const flight = decodeFlight(await fetchText('https://batodex.com/players/' + id));
      let added = 0;
      for (const r of extractRuns(flight)) {
        if (r.id && seen.has(r.id)) continue;
        if (r.id) seen.add(r.id);
        // strip to what analytics needs (keeps runs-raw.json small)
        allRuns.push({
          id: r.id, trainerId: r.trainerId, mmr: r.mmr, tier: r.tier,
          startedAt: r.startedAt, roundReached: r.roundReached, wins: r.wins, losses: r.losses,
          rounds: (r.rounds || []).map(rd => ({
            round: rd.round, won: rd.won,
            trinkets: (rd.trinkets || []).map(t => ({ id: t.id })),
            board: (rd.board || []).map(b => ({ speciesId: b.speciesId, level: b.level, shiny: !!b.shiny })),
          })),
        });
        added++;
      }
      done++;
      console.log(`[${done}/${ids.length}] ${id}: +${added} (total ${allRuns.length})`);
      await sleep(350);
    } catch (e) { console.log('WARN', id, e.message); }
  }

  fs.writeFileSync(path.join(__dirname, 'runs-raw.json'), JSON.stringify(allRuns));
  fs.writeFileSync(path.join(__dirname, 'runs-raw-meta.json'), JSON.stringify({ players: done, crawledAt: new Date().toISOString() }));
  console.log('WROTE runs-raw.json (' + allRuns.length + ' runs)');
  analyze(path.join(__dirname, 'runs-raw.json'), path.join(__dirname, '..'), path.join(__dirname, '..', 'dataset.json'));
})();
