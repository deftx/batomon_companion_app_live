const fs = require('fs');

function decodeFlight(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  const chunks = [...html.matchAll(re)].map(m => JSON.parse('"' + m[1] + '"'));
  return chunks.join('');
}

// Parse a balanced JSON value starting at index `start` in string `s`
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
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced from ' + start);
}

function extractAll(flight, marker) {
  const results = [];
  let idx = 0;
  while ((idx = flight.indexOf(marker, idx)) !== -1) {
    const arrStart = flight.indexOf('[', idx + marker.length - 1);
    try {
      const raw = parseBalanced(flight, arrStart);
      results.push(JSON.parse(raw));
    } catch (e) { /* skip malformed */ }
    idx += marker.length;
  }
  return results;
}

const file = process.argv[2];
const what = process.argv[3]; // e.g. monsters | trainers | trinkets | items | probe
const flight = decodeFlight(file);

if (what === 'probe') {
  // Show all "category":"X","entries" markers and other big keys
  const cats = [...flight.matchAll(/"category":"(\w+)","entries":/g)].map(m => m[1]);
  console.log('categories found:', cats);
  // probe for stats-like keys
  for (const key of ['winRate', 'pickRate', 'win_rate', 'pick_rate', 'wins', 'picks', 'usage', 'abilities', 'evolution', 'ranked']) {
    const i = flight.indexOf(key);
    console.log(`key "${key}":`, i === -1 ? 'NOT FOUND' : 'found @' + i);
  }
  process.exit(0);
}

const marker = `"category":"${what}","entries":`;
const found = extractAll(flight, marker);
if (!found.length) { console.error('No entries found for', what); process.exit(1); }
// take the largest array found
found.sort((a, b) => b.length - a.length);
const entries = found[0];
const out = `data_${what}.json`;
fs.writeFileSync(out, JSON.stringify(entries, null, 1));
console.log(what, '->', entries.length, 'entries ->', out);
console.log('first entry keys:', Object.keys(entries[0]).join(', '));
