// Downloads all sprites listed in sprite_list.txt into the companion app folder.
const fs = require('fs');
const path = require('path');

const OUT_ROOT = process.argv[2];
const list = fs.readFileSync('sprite_list.txt', 'utf8').split('\n').filter(Boolean);

async function dl(rel) {
  const url = 'https://batodex.com' + rel;
  const dest = path.join(OUT_ROOT, rel.replace(/^\//, ''));
  if (fs.existsSync(dest)) return 'skip';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (companion-builder)' } });
  if (!r.ok) return 'FAIL ' + r.status;
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return 'ok ' + buf.length + 'b';
}

(async () => {
  let ok = 0, fail = 0, skip = 0;
  const failures = [];
  // small concurrency pool
  const queue = [...list];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const rel = queue.shift();
      try {
        const res = await dl(rel);
        if (res.startsWith('ok')) ok++;
        else if (res === 'skip') skip++;
        else { fail++; failures.push(rel + ' ' + res); }
      } catch (e) { fail++; failures.push(rel + ' ' + e.message); }
    }
  });
  await Promise.all(workers);
  console.log(`done: ${ok} downloaded, ${skip} skipped, ${fail} failed`);
  failures.slice(0, 20).forEach(f => console.log('  ' + f));
})();
