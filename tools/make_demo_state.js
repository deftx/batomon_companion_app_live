// Builds ../demo-state.json — a realistic mid-run state used for README
// screenshots (and for eyeballing every panel at once without playing a run).
// Load it in the browser with:
//   fetch('/demo-state.json').then(r=>r.json()).then(d=>{Object.entries(d).forEach(([k,v])=>localStorage.setItem(k,v));location.reload()})
const fs = require('fs');
const path = require('path');

const now = Date.UTC(2026, 6, 29, 12, 0, 0); // fixed stamp → regenerating gives the same file
const DAY = 86400000;

const live = {
  day: 9, gold: 34, lives: 3, badges: 5, shopRank: 4, trainerId: 'chemist',
  board: [
    { monsterId: 'venopuff', level: 3, shiny: false },
    { monsterId: 'noxnimbus', level: 2, shiny: false },
    { monsterId: 'shogapede', level: 2, shiny: true },
    { monsterId: 'spinarai', level: 2, shiny: false },
    { monsterId: 'wishwash', level: 2, shiny: false },
    { monsterId: 'coalem', level: 2, shiny: false },
  ],
  bench: [{ monsterId: 'boomagon', level: 1, shiny: false }],
  shop: [{ monsterId: 'shogapede' }, { monsterId: 'magmalith' }, { monsterId: 'humbolt' }, { monsterId: 'guardiant' }],
  shopItems: ['coffee'],
  trinkets: [],
  strategies: [
    { id: 'poison_ramp', focusId: 'venopuff', day: 9 },
    { id: 'bug_feeder', focusId: 'shogapede', day: 9 },
  ],
  posTarget: null, runEnded: null,
  // history entries carry `board` — the shape the app itself writes
  history: [8, 7, 6].map((d, i) => ({
    day: d, won: true,
    board: [{ id: 'venopuff', lvl: 2 }, { id: 'noxnimbus', lvl: 2 }, { id: 'spinarai', lvl: 1 }],
    after: { badges: 5 - i, lives: 3, gold: 34 - i * 6 }, income: 65 - i * 5, pred: 66 - i * 4,
  })),
  runLog: [{ type: 'strategy', day: 5, detail: 'Adopted Poison ramp → focus Venopuff' }],
  enemyBoard: {
    units: [
      { monsterId: 'wishwash', level: 3 }, { monsterId: 'sirenade', level: 2 },
      { monsterId: 'coalem', level: 3 }, { monsterId: 'torrantler', level: 2 },
      { monsterId: 'aegistruct', level: 2 }, null,
    ],
    trinkets: [], name: 'a matched opponent', mmr: 512, round: 9,
  },
};
live.strategy = live.strategies[0]; // invariant: strategy === strategies[0]

const TRAINERS = [['chemist', 'Chemist'], ['pyromaniac', 'Chef'], ['bug_catcher', 'Bug Catcher'],
  ['monster_ranger', 'Monster Ranger'], ['swim_coach', 'Swim Coach']];
const MONS = ['venopuff', 'noxnimbus', 'shogapede', 'spinarai', 'wishwash', 'coalem', 'boomagon', 'magmalith', 'humbolt', 'guardiant'];
const BADGES = [4, 10, 6, 3, 8, 10, 5, 7, 9, 6, 10, 8];

const runs = [];
BADGES.forEach((b, i) => {
  const [tid, tname] = TRAINERS[i % TRAINERS.length];
  const result = b >= 10 ? 'won' : b <= 3 ? 'lost' : 'ended';
  const day = result === 'won' ? 15 : 9 + Math.round(b / 2);
  const board = MONS.slice(i % 5, i % 5 + 6).map((id, j) => ({ id, lvl: 1 + (j % 3), shiny: j === 0 && i % 4 === 0 }));
  const history = [];
  let badges = 0, lives = 3;
  for (let d = 1; d <= day; d++) {
    const won = (d + i) % 3 !== 0 && badges < b;
    if (won) badges++; else lives = Math.max(0, lives - 1);
    history.push({ day: d, won, board, after: { badges, lives, gold: 10 + ((d * 7) % 70) }, income: 25 + Math.min(80, d * 5), pred: won ? 63 : 44 });
  }
  runs.unshift({
    id: 'demo' + i, result, endedReason: result, trainer: tid, trainerName: tname,
    badges: b, lives: result === 'won' ? 9 : 0, day, wins: b, losses: Math.max(1, 10 - b),
    finalBoard: board, trinkets: [], strategy: 'poison_ramp', strategies: ['poison_ramp'],
    history, runLog: [], savedAtDay: day, endedAt: now - (BADGES.length - 1 - i) * DAY, isRanked: true,
  });
});

const mmrs = [460, 480, 495, 500, 505, 510, 520, 530, 540, 550, 470, 505, 515, 490];
const out = {
  bc_live: JSON.stringify(live),
  bc_runs: JSON.stringify(runs),
  bc_sync: '0',
  bc_rankmanual: JSON.stringify({ tier: 'Gold', div: 4, stars: 3, mmr: null, at: now }),
  bc_mmrEst: JSON.stringify({ n: mmrs.length, sum: mmrs.reduce((a, b) => a + b, 0) }),
  bc_mmrSamples: JSON.stringify(mmrs.map((m, i) => ({ m, run: 'd' + i, day: 7 }))),
};

const dest = path.join(__dirname, '..', 'demo-state.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log('wrote', dest, '(' + Math.round(fs.statSync(dest).size / 1024) + ' KB)');
console.log('\nLoad it: open http://localhost:8137, press F12 → Console, paste:\n');
console.log("fetch('/demo-state.json').then(r=>r.json()).then(d=>{Object.entries(d).forEach(([k,v])=>localStorage.setItem(k,v));location.reload()})");
