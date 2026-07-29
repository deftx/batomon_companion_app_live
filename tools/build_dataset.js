// Builds the full dataset for the Batomon companion app.
// 1. Loads extracted category JSON (monsters/trainers/trinkets/items)
// 2. Fetches the 3 level-locked evolved forms' pages and extracts their entries
// 3. Parses real Master-Ranked stats tables (trainers, trinkets)
// 4. Emits data.js for the app
const fs = require('fs');

const OUT_DIR = process.argv[2] || '.';

function decodeFlightFromHtml(html) {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  return [...html.matchAll(re)].map(m => JSON.parse('"' + m[1] + '"')).join('');
}

function parseBalanced(s, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  throw new Error('unbalanced');
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (companion-builder)' } });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return await r.text();
}

// Extract a single monster entry {"id":"X",...} with full keys from a monster page flight
function extractEntry(flight, id) {
  const marker = `{"id":"${id}","name":`;
  let best = null;
  let idx = 0;
  while ((idx = flight.indexOf(marker, idx)) !== -1) {
    try {
      const raw = parseBalanced(flight, idx);
      const obj = JSON.parse(raw);
      if (obj.levels && (!best || raw.length > JSON.stringify(best).length)) best = obj;
    } catch (e) {}
    idx += marker.length;
  }
  return best;
}

// Parse a stats table: rows with <img alt="Name"> then percentage cells
function parseStatsTable(html) {
  const rows = html.split(/<tr\b/).slice(1);
  const out = [];
  for (const row of rows) {
    const alt = row.match(/alt="([^"]+)"/);
    if (!alt) continue;
    alt[1] = alt[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
    const pcts = [...row.matchAll(/>(\d{1,3}\.\d)%/g)].map(m => parseFloat(m[1]));
    const count = row.match(/\(([\d,]+)\)/);
    if (pcts.length >= 2) {
      out.push({
        name: alt[1],
        winRate: pcts[0],
        pickRate: pcts[1],
        picks: count ? parseInt(count[1].replace(/,/g, '')) : null,
      });
    }
  }
  return out;
}

(async () => {
  const monsters = JSON.parse(fs.readFileSync('data_monsters.json', 'utf8'));

  // Resolve RSC dedup references: "$17:props:children:0:props:entries:38:evolvedForm:tags"
  // means "same value as <category array>[38].evolvedForm.tags".
  function resolveRscRefs(arr, label) {
    function resolveRef(str) {
      const m = str.match(/^\$\d+.*?:entries:(\d+):?(.*)$/);
      if (!m) return undefined;
      let node = arr[parseInt(m[1], 10)];
      if (!node) return undefined;
      const segs = m[2] ? m[2].split(':') : [];
      for (const seg of segs) {
        if (node == null) return undefined;
        node = node[/^\d+$/.test(seg) ? parseInt(seg, 10) : seg];
      }
      return node;
    }
    function resolveTree(node) {
      if (Array.isArray(node)) {
        node.forEach((v, i) => {
          if (typeof v === 'string' && v.startsWith('$') && /:entries:\d+/.test(v)) { const r = resolveRef(v); if (r !== undefined) node[i] = r; }
          else if (v && typeof v === 'object') resolveTree(v);
        });
      } else if (node && typeof node === 'object') {
        for (const k of Object.keys(node)) {
          const v = node[k];
          if (typeof v === 'string' && v.startsWith('$') && /:entries:\d+/.test(v)) {
            const r = resolveRef(v);
            if (r !== undefined) node[k] = r;
          } else if (v && typeof v === 'object') resolveTree(v);
        }
      }
    }
    resolveTree(arr); resolveTree(arr); // two passes so refs-to-refs settle
    const remaining = JSON.stringify(arr).match(/"\$\d+[^"]*:entries:[^"]*"/g);
    console.log(label, 'unresolved RSC refs:', remaining ? remaining.length : 0);
  }
  resolveRscRefs(monsters, 'monsters');
  const trainers = JSON.parse(fs.readFileSync('data_trainers.json', 'utf8'));
  const trinkets = JSON.parse(fs.readFileSync('data_trinkets.json', 'utf8'));
  const items = JSON.parse(fs.readFileSync('data_items.json', 'utf8'));
  let events = [];
  try { events = JSON.parse(fs.readFileSync('data_events.json', 'utf8')); } catch { console.log('no events data — run: node extract_data.js page_events.html events'); }
  resolveRscRefs(trainers, 'trainers');
  resolveRscRefs(trinkets, 'trinkets');
  resolveRscRefs(items, 'items');
  resolveRscRefs(events, 'events');

  // --- evolved forms: embedded as evolvedForm on base entries ---
  for (const m of [...monsters]) {
    if (m.evolvedForm && typeof m.evolvedForm === 'object' && m.evolvedForm.levels) {
      const evo = m.evolvedForm;
      if (!monsters.some(x => x.id === evo.id)) {
        evo.isEvolvedForm = true;
        evo.evolvesFrom = m.id;
        monsters.push(evo);
        console.log('evolved form added:', evo.id, '(from', m.id + ') | tier', evo.tier);
      }
      m.evolvedForm = evo.id; // deduplicate: keep reference only
    } else if (m.evolvedForm && typeof m.evolvedForm === 'object') {
      m.evolvedForm = m.evolvedForm.id || null; // RSC ref without data
    }
  }
  // mark evolvesFrom on already-listed evolution targets (victory chain)
  for (const m of monsters) {
    if (m.evolution && m.evolution.targetId) {
      const target = monsters.find(x => x.id === m.evolution.targetId);
      if (target && !target.evolvesFrom) target.evolvesFrom = m.id;
    }
  }

  // --- stats tables ---
  const trainerStats = parseStatsTable(fs.readFileSync('page_stats.html', 'utf8'));
  const trinketStats = parseStatsTable(fs.readFileSync('page_stats_trinkets.html', 'utf8'));
  console.log('trainer stats rows:', trainerStats.length, '| trinket stats rows:', trinketStats.length);

  // attach stats to entries by name
  const byName = (arr) => Object.fromEntries(arr.map(e => [e.name.toLowerCase(), e]));
  const tsMap = byName(trainerStats), trMap = byName(trinketStats);
  trainers.forEach(t => { const s = tsMap[t.name.toLowerCase()]; if (s) t.stats = s; });
  trinkets.forEach(t => { const s = trMap[t.name.toLowerCase()]; if (s) t.stats = s; });
  console.log('trainers with stats:', trainers.filter(t => t.stats).length + '/' + trainers.length);
  console.log('trinkets with stats:', trinkets.filter(t => t.stats).length + '/' + trinkets.length);
  const matchedTrainerNames = new Set(trainers.filter(t => t.stats).map(t => t.stats.name));
  const matchedTrinketNames = new Set(trinkets.filter(t => t.stats).map(t => t.stats.name));
  console.log('unmatched trainer stat rows:', trainerStats.filter(s => !matchedTrainerNames.has(s.name)).map(s => s.name));
  console.log('unmatched trinket stat rows:', trinketStats.filter(s => !matchedTrinketNames.has(s.name)).map(s => s.name));
  console.log('trainers without stats:', trainers.filter(t => !t.stats).map(t => t.name));

  const data = {
    generatedAt: new Date().toISOString(),
    source: 'batodex.com (live Master Ranked stats + full database)',
    monsters, trainers, trinkets, items, events,
    trainerStats, trinketStats,
  };
  fs.writeFileSync(OUT_DIR + '/dataset.json', JSON.stringify(data, null, 1));
  fs.writeFileSync(OUT_DIR + '/data.js', 'window.BATODEX = ' + JSON.stringify(data) + ';\n');
  console.log('WROTE', OUT_DIR + '/data.js', '| monsters:', monsters.length);

  // --- sprite list ---
  const spriteSet = new Set();
  monsters.forEach(m => { if (m.sprite) spriteSet.add(m.sprite); if (m.shinySprite) spriteSet.add(m.shinySprite); });
  trainers.forEach(t => t.sprite && spriteSet.add(t.sprite));
  trinkets.forEach(t => t.sprite && spriteSet.add(t.sprite));
  items.forEach(t => t.sprite && spriteSet.add(t.sprite));
  events.forEach(t => t.sprite && spriteSet.add(t.sprite));
  fs.writeFileSync('sprite_list.txt', [...spriteSet].join('\n'));
  console.log('sprites to download:', spriteSet.size);
})();
