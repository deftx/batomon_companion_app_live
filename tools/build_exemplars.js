// Builds exemplars.js — top Master WINNING boards per day (poe.ninja pattern:
// aggregate the ladder, keep clickable exemplars). Reads the raw crawl cache
// (runs-raw.json, written by crawl_synergies.js) so no re-crawl is needed.
// Ranking: winning rounds only, from high-MMR runs; dedup by board signature;
// keep the strongest 6 per day.
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'runs-raw.json'), 'utf8'));
const byDay = {};
for (const run of raw) {
  for (const r of run.rounds || []) {
    if (!r.won || !Array.isArray(r.board) || r.board.length < 3) continue;
    const day = Math.min(r.round, 15);
    (byDay[day] = byDay[day] || []).push({
      mmr: run.mmr || 0, wins: run.wins || 0, trainerId: run.trainerId || null,
      trinkets: (r.trinkets || []).slice(0, 8),
      board: r.board.slice(0, 6).map(b => ({ id: b.speciesId, lvl: b.level || 1, shiny: !!b.shiny })),
    });
  }
}
const out = {};
for (const day of Object.keys(byDay)) {
  const seen = new Set();
  out[day] = byDay[day]
    .sort((a, b) => b.mmr - a.mmr || b.wins - a.wins)
    .filter(x => {
      const sig = x.board.map(b => b.id + b.lvl).sort().join(',');
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    })
    .slice(0, 6);
}
const totalBoards = Object.values(out).reduce((a, v) => a + v.length, 0);
fs.writeFileSync(path.join(__dirname, '..', 'exemplars.js'),
  'window.SYNERGY_EX = ' + JSON.stringify({ generatedAt: raw.length + ' runs crawled', days: out }) + ';\n');
console.log('WROTE ../exemplars.js |', totalBoards, 'exemplar boards across', Object.keys(out).length, 'days');
