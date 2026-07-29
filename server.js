// Batomon Companion server — static hosting + live APIs.
//   node server.js            (port 8137)
// Endpoints:
//   /api/news        live patch notes via Steam GetNewsForApp (main app + demo), cached 10 min
//   /api/refresh     re-scrapes batodex dataset + synergies (runs tools/ scripts), streams progress
//   /api/discord     returns tools/news-discord.json if the optional Discord bridge is running
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = process.env.PORT || 8137;
// live game link: the game writes its run state here in PLAIN JSON (since ~0.8.x)
const RUN_SAVE = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'Godot', 'app_userdata', 'Batomon Showdown', 'run_save.json');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// ---- Steam news (patches/updates/hotfixes, real time) ----
const STEAM_APPS = [4557380, 4646330]; // main + demo (shared feed, but merge to be safe)
let newsCache = { at: 0, data: null };
async function getNews() {
  if (newsCache.data && Date.now() - newsCache.at < 10 * 60 * 1000) return newsCache.data;
  const all = [];
  for (const appid of STEAM_APPS) {
    try {
      const r = await fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=25&maxlength=6000&format=json`);
      const j = await r.json();
      for (const it of (j.appnews && j.appnews.newsitems) || []) {
        all.push({ gid: it.gid, title: it.title, url: it.url, author: it.author, date: it.date, feed: it.feedlabel, contents: it.contents, appid });
      }
    } catch (e) { console.log('steam news fail', appid, e.message); }
  }
  const seen = new Set();
  const merged = all.filter(n => { const k = n.title + '|' + n.date; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.date - a.date);
  newsCache = { at: Date.now(), data: merged };
  return merged;
}

// ---- live-run push: watch the save dir, stream changes over SSE ----
// The game rewrites run_save.json on every action; fs.watch catches it in
// ~50ms and pushes to every connected app tab — no polling latency.
async function readRunSave() {
  if (!fs.existsSync(RUN_SAVE)) return { exists: false };
  let data = null;
  for (let attempt = 0; attempt < 3 && !data; attempt++) {
    try { data = JSON.parse(fs.readFileSync(RUN_SAVE, 'utf8')); }
    catch (e) { await new Promise(r => setTimeout(r, 50)); } // mid-write
  }
  return data ? { exists: true, mtimeMs: fs.statSync(RUN_SAVE).mtimeMs, data } : { exists: false, midWrite: true };
}
const sseClients = new Set();
let saveWatcher = null;
function ensureSaveWatch() {
  if (saveWatcher) return;
  const dir = path.dirname(RUN_SAVE);
  if (!fs.existsSync(dir)) return;
  let t = null;
  try {
    saveWatcher = fs.watch(dir, (ev, fn) => {
      if (fn && !String(fn).startsWith('run_save')) return;
      clearTimeout(t);
      t = setTimeout(async () => {
        if (!sseClients.size) return;
        const payload = JSON.stringify(await readRunSave());
        for (const c of sseClients) { try { c.write(`data: ${payload}\n\n`); } catch (e) { sseClients.delete(c); } }
      }, 60); // debounce write bursts
    });
  } catch (e) { console.log('save watch failed:', e.message); }
}

// ---- Steam community discussions (public forum — meta talk + bug reports) ----
let discCache = { at: 0, data: null };
async function getDiscussions() {
  if (discCache.data && Date.now() - discCache.at < 10 * 60 * 1000) return discCache.data;
  const topics = [];
  for (const appid of STEAM_APPS) {
    try {
      const r = await fetch(`https://steamcommunity.com/app/${appid}/discussions/`, { headers: { 'user-agent': 'Mozilla/5.0' } });
      const html = await r.text();
      // one block per topic row; pull name / poster / reply count from within
      const strip = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      for (const b of html.split(/class="forum_topic[ "]/).slice(1, 24)) {
        const title = strip((b.match(/forum_topic_name\s*"?>([\s\S]*?)<\/div>/) || [])[1]);
        const op = strip((b.match(/forum_topic_op"?>([\s\S]*?)<\/div>/) || [])[1]);
        const replies = +(((b.match(/forum_topic_reply_count"?>\s*([\d,]+)/) || [])[1] || '0').replace(/,/g, ''));
        const gid = (b.match(/data-gidforumtopic="(\d+)"/) || [])[1];
        const forum = (b.match(/id="forum_[A-Za-z]+_(\d+)_/) || [])[1];
        const preview = strip((b.match(/topic_hover_text&quot;&gt;([\s\S]*?)&lt;\/div/) || [])[1] || '').replace(/&lt;[^&]*&gt;/g, ' ').slice(0, 220);
        if (title) topics.push({
          appid, title, op, replies,
          url: gid && forum ? `https://steamcommunity.com/app/${appid}/discussions/0/${gid}/` : `https://steamcommunity.com/app/${appid}/discussions/`,
          preview,
        });
      }
    } catch (e) { console.log('steam discussions fail', appid, e.message); }
  }
  const seen = new Set();
  const merged = topics.filter(t => { if (seen.has(t.title)) return false; seen.add(t.title); return true; });
  discCache = { at: Date.now(), data: merged };
  return merged;
}

// ---- AI analysis (Claude API — key stays server-side) ----
const AI_KEY_FILE = path.join(ROOT, 'tools', 'ai-key.txt');
const aiKey = () => (process.env.ANTHROPIC_API_KEY || (fs.existsSync(AI_KEY_FILE) ? fs.readFileSync(AI_KEY_FILE, 'utf8').trim() : ''));
const AI_MODEL = process.env.BATOMON_AI_MODEL || 'claude-sonnet-5';
const AI_SYSTEM = `You are the "AI Battle Brain+" of a Batomon Showdown companion app (PvP autobattler, patch 0.8.4 era).
Core mechanics (batodex wiki, exact): Damage = direct, absorbed by Shield before HP. Heal restores HP, resolved after damage. Shield absorbs first; status damage (Burn/Poison/Shock) is 25% weaker into shields. Burn ticks every 0.5s for stack count then loses 1 stack. Poison ticks every 1s, never decays (pure ramp). Shock: attacks vs a shocked target gain +stacks flat damage, never decays, direct hits only — scales with hit frequency. Cooldown floor 0.1s. Both teams share a base HP that grows per day (day 1 = 300). Income = 25 + min(80, day×5) at day start. Reroll $3. Locking the shop carries offers to the next day. Board is side-view, enemies to the RIGHT: "behind" = LEFT neighbour, "in front" = RIGHT, "above" = top row same column. NOTE: Boomagon's arrow points RIGHT (buffs ally in FRONT) despite older text saying behind.
You receive: the player's LIVE run state (auto-synced from the game's save file), the companion app's computed advice (engine verdicts, event-based combat sim with Monte-Carlo win chance, streak-scaled opponent model, live calibration record, per-run skill radar — plus real day-average enemies from Master-rank crawled runs), recent patch notes and Steam community discussion titles (meta talk / bug reports). Trust the "sim" block's win chance and loss-streak scaling — they are calibrated against the player's own recorded battles.
Deliver sharp, actionable coaching in this order: 1) THE next action (one line, imperative). 2) Buy/reroll/lock reasoning vs the app's verdict — agree or overrule WITH numbers. 3) Positioning moves. 4) Build direction for the next 2–3 days (name exact Batomon/trinkets). 5) Traps to avoid (incl. anything community/bug reports suggest is currently broken or bugged). Be blunt, concrete, cite names and numbers. If the app's advice looks wrong, say so and why. Under 400 words. Game terms stay in English.`;

async function aiAnalyze(body, res) {
  const key = aiKey();
  const hdr = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (!key) { res.writeHead(200, hdr); res.end(JSON.stringify({ error: 'no_key' })); return; }
  try {
    const [news, disc] = await Promise.all([getNews().catch(() => []), getDiscussions().catch(() => [])]);
    const context = {
      runState: body.state || {},
      appAdvice: body.advice || {},
      patchNotes: (news || []).slice(0, 3).map(n => ({ date: new Date(n.date * 1000).toISOString().slice(0, 10), title: n.title, excerpt: (n.contents || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').slice(0, 400) })),
      communityDiscussions: (disc || []).slice(0, 14).map(t => `${t.title} — by ${t.op || '?'} (${t.replies} replies)${t.preview ? ': ' + t.preview : ''}`),
    };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: AI_MODEL, max_tokens: 1100, system: AI_SYSTEM,
        messages: [{ role: 'user', content: (body.question ? `Player's question: ${String(body.question).slice(0, 500)}\n\n` : '') + 'Analyze my live run:\n' + JSON.stringify(context) }],
      }),
    });
    const j = await r.json();
    if (j.error) { res.writeHead(200, hdr); res.end(JSON.stringify({ error: j.error.message || 'api_error' })); return; }
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    res.writeHead(200, hdr);
    res.end(JSON.stringify({ text, model: AI_MODEL, usage: j.usage }));
  } catch (e) {
    res.writeHead(200, hdr); res.end(JSON.stringify({ error: String(e.message || e) }));
  }
}

// ---- community data ingestion (v1 feature — scaffolded, gated OFF) ----
// Players who OPT IN contribute anonymized day-snapshots (board, result,
// trainer, trinkets — no names, no ids beyond a random per-run hash). The
// analyzer merges them with the batodex crawl so every user's games sharpen
// the stats for the next user. Enable by creating tools/ingest-on.txt or
// setting INGEST=1. Data lands in tools/runs-community.jsonl.
const INGEST_FILE = path.join(ROOT, 'tools', 'runs-community.jsonl');
const ingestEnabled = () => process.env.INGEST === '1' || fs.existsSync(path.join(ROOT, 'tools', 'ingest-on.txt'));
const ingestLast = new Map();
function handleIngest(body, ip, res) {
  const hdr = { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
  if (!ingestEnabled()) { res.writeHead(200, hdr); res.end(JSON.stringify({ disabled: true })); return; }
  const now = Date.now();
  if (ingestLast.get(ip) && now - ingestLast.get(ip) < 5000) { res.writeHead(429, hdr); res.end(JSON.stringify({ error: 'rate' })); return; }
  // strict shape: only the fields the analyzer needs, hard caps everywhere
  const clean = {
    v: 1, at: new Date().toISOString(),
    run: String(body.run || '').replace(/[^a-z0-9]/gi, '').slice(0, 24),
    day: Math.min(Math.max(+body.day || 1, 1), 40),
    won: !!body.won,
    trainer: String(body.trainer || '').slice(0, 32),
    badges: Math.min(+body.badges || 0, 10), lives: Math.min(+body.lives || 0, 20),
    board: (Array.isArray(body.board) ? body.board : []).slice(0, 6).map(u => u && ({
      id: String(u.id || '').slice(0, 32), lvl: Math.min(+u.lvl || 1, 4), shiny: !!u.shiny,
    })),
    trinkets: (Array.isArray(body.trinkets) ? body.trinkets : []).slice(0, 12).map(t => String(t).slice(0, 40)),
  };
  // optional observed-shop counts → community pool-size estimation at v1
  if (body.shops && typeof body.shops === 'object') {
    const n = Math.min(Math.max(+body.shops.n || 0, 0), 500);
    const c = {};
    Object.entries(body.shops.c || {}).slice(0, 80).forEach(([k, v]) => {
      const key = String(k).replace(/[^a-z0-9_ ]/gi, '').slice(0, 32);
      if (key) c[key] = Math.min(Math.max(+v || 0, 0), 500);
    });
    if (n > 0) clean.shops = { n, c };
  }
  if (!clean.run || !clean.board.some(Boolean)) { res.writeHead(400, hdr); res.end(JSON.stringify({ error: 'bad payload' })); return; }
  ingestLast.set(ip, now);
  try {
    fs.appendFileSync(INGEST_FILE, JSON.stringify(clean) + '\n');
    res.writeHead(200, hdr); res.end(JSON.stringify({ ok: true }));
  } catch (e) { res.writeHead(500, hdr); res.end(JSON.stringify({ error: e.message })); }
}

// ---- feedback relay: form → the maintainer's email + private Discord ----
// Email goes through formsubmit.co (zero-setup relay — the FIRST submission
// sends a one-time activation link to the inbox; click it once and it flows).
// Discord uses a webhook kept SERVER-side: env DISCORD_WEBHOOK or the one-line
// file tools/discord-webhook.txt (create a webhook in any private channel of
// your own server: channel settings → Integrations → Webhooks → copy URL).
// Kept OUT of the public repo: env FEEDBACK_EMAIL, or the one-line gitignored file
// tools/feedback-email.txt. Without either, the email relay is simply skipped (the
// Discord webhook and the in-app contact links still work).
const EMAIL_FILE = path.join(ROOT, 'tools', 'feedback-email.txt');
const FEEDBACK_EMAIL = process.env.FEEDBACK_EMAIL || (fs.existsSync(EMAIL_FILE) ? fs.readFileSync(EMAIL_FILE, 'utf8').trim() : '');
const WEBHOOK_FILE = path.join(ROOT, 'tools', 'discord-webhook.txt');
const discordWebhook = () => (process.env.DISCORD_WEBHOOK || (fs.existsSync(WEBHOOK_FILE) ? fs.readFileSync(WEBHOOK_FILE, 'utf8').trim() : ''));
const fbLast = new Map(); // naive per-IP rate limit
async function handleFeedback(body, ip, res) {
  const hdr = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  const now = Date.now();
  if (fbLast.get(ip) && now - fbLast.get(ip) < 20000) { res.writeHead(429, hdr); res.end(JSON.stringify({ error: 'slow down — one message per 20s' })); return; }
  const subject = String(body.subject || '').slice(0, 150).trim();
  const message = String(body.message || '').slice(0, 4000).trim();
  const name = String(body.name || '').slice(0, 80).trim();
  const contact = String(body.contact || '').slice(0, 120).trim();
  if (body.website) { res.writeHead(200, hdr); res.end(JSON.stringify({ ok: true })); return; } // honeypot: pretend success
  if (!subject || !message) { res.writeHead(400, hdr); res.end(JSON.stringify({ error: 'subject and message required' })); return; }
  fbLast.set(ip, now);
  const out = { email: 'skipped', discord: 'skipped' };
  if (FEEDBACK_EMAIL) {
    try {
      const r = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`, {
        method: 'POST',
        // formsubmit rejects requests without a web origin — present as the app
        headers: { 'content-type': 'application/json', accept: 'application/json', origin: `http://localhost:${PORT}`, referer: `http://localhost:${PORT}/` },
        body: JSON.stringify({ _subject: `[Batomon Companion] ${subject}`, name: name || 'anonymous', contact: contact || 'not given', message, _template: 'box', _captcha: 'false' }),
      });
      const j = await r.json().catch(() => ({}));
      out.email = j.success === 'true' || j.success === true ? 'sent' : 'failed: ' + (j.message || r.status);
    } catch (e) { out.email = 'failed: ' + e.message; }
  }
  const hook = discordWebhook();
  if (hook) {
    try {
      const r2 = await fetch(hook, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `💬 ${subject}`.slice(0, 250),
            description: message.slice(0, 3900),
            color: 0x54a8fc,
            fields: [{ name: 'From', value: `${name || 'anonymous'}${contact ? ` · ${contact}` : ''}`.slice(0, 1000) }],
            footer: { text: 'Batomon Companion feedback' },
            timestamp: new Date().toISOString(),
          }],
        }),
      });
      out.discord = r2.ok ? 'sent' : 'failed: ' + r2.status;
    } catch (e) { out.discord = 'failed: ' + e.message; }
  } else out.discord = 'no webhook configured';
  const ok = out.email === 'sent' || out.discord === 'sent';
  res.writeHead(ok ? 200 : 502, hdr);
  res.end(JSON.stringify({ ok, channels: out }));
}

// ---- refresh pipeline ----
let refreshing = false;
function runRefresh(res, auto) {
  if (refreshing) { if (res) { res.writeHead(409); res.end('refresh already running'); } return; }
  refreshing = true;
  if (res) res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-cache' });
  const write = (s) => { if (res) res.write(s); }; // stream only to a manual caller; headless auto-runs stay quiet
  if (auto) console.log('[auto-refresh] dataset stale — re-scraping batodex in the background…');
  const steps = [
    [process.execPath, ['-e', "try{require('fs').copyFileSync('../dataset.json','./dataset.prev.json');console.log('snapshot ok')}catch(e){console.log('no prior dataset')}"]],
    ['sh', ['refresh.sh']],
    [process.execPath, ['diff_dataset.js']],   // → tools/patch-diff.json (Patches tab)
    [process.execPath, ['crawl_synergies.js', '30']],
    [process.execPath, ['build_exemplars.js']], // → exemplars.js (winner-board gallery)
    [process.execPath, ['analyze_community.js']], // → community.js (pool sizes + WR at v1; placeholder until then)
  ];
  let i = 0;
  const next = () => {
    if (i >= steps.length) {
      if (res) res.end('\nALL DONE — reload the app.');
      if (auto) console.log('[auto-refresh] done — dataset rebuilt, reload the app to pick it up.');
      refreshing = false; return;
    }
    const [cmd, args] = steps[i++];
    write(`\n== ${cmd} ${args.join(' ')} ==\n`);
    const p = spawn(cmd, args, { cwd: path.join(ROOT, 'tools'), shell: cmd === 'sh' });
    p.stdout.on('data', d => write(d));
    p.stderr.on('data', d => write(d));
    p.on('close', c => { write(`\n[exit ${c}]\n`); next(); });
    p.on('error', e => { write('spawn error: ' + e.message); if (auto) console.log('[auto-refresh] step error:', e.message); next(); });
  };
  next();
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/news') {
      const data = await getNews();
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify(data));
      return;
    }
    if (url.pathname === '/api/refresh') {
      // deploy safety: when REFRESH_TOKEN is set (public hosting), the pipeline
      // only runs with ?token=<value>. Unset locally = no friction.
      const gate = process.env.REFRESH_TOKEN;
      if (gate && url.searchParams.get('token') !== gate) { res.writeHead(403); res.end('refresh requires ?token=…'); return; }
      runRefresh(res); return;
    }
    if (url.pathname === '/api/patch-diff') {
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      try { res.end(fs.readFileSync(path.join(ROOT, 'tools', 'patch-diff.json'))); }
      catch (e) { res.end(JSON.stringify({ none: true })); }
      return;
    }
    if (url.pathname === '/api/discussions') {
      const data = await getDiscussions();
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify(data));
      return;
    }
    if (url.pathname === '/api/ai-analyze' && req.method === 'POST') {
      let raw = '';
      req.on('data', d => { raw += d; if (raw.length > 300000) req.destroy(); });
      req.on('end', () => {
        let body = {};
        try { body = JSON.parse(raw || '{}'); } catch (e) {}
        aiAnalyze(body, res);
      });
      return;
    }
    if (url.pathname === '/api/ingest' && req.method === 'POST') {
      let raw = '';
      req.on('data', d => { raw += d; if (raw.length > 20000) req.destroy(); });
      req.on('end', () => {
        let body = {};
        try { body = JSON.parse(raw || '{}'); } catch (e) {}
        handleIngest(body, req.socket.remoteAddress || 'x', res);
      });
      return;
    }
    if (url.pathname === '/api/feedback' && req.method === 'POST') {
      let raw = '';
      req.on('data', d => { raw += d; if (raw.length > 50000) req.destroy(); });
      req.on('end', () => {
        let body = {};
        try { body = JSON.parse(raw || '{}'); } catch (e) {}
        handleFeedback(body, req.socket.remoteAddress || 'x', res);
      });
      return;
    }
    if (url.pathname === '/api/live-run') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify(await readRunSave()));
      return;
    }
    if (url.pathname === '/api/live-run/stream') {
      // Server-Sent Events: instant push on every save change
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'access-control-allow-origin': '*' });
      res.write('retry: 1500\n\n');
      sseClients.add(res);
      ensureSaveWatch();
      readRunSave().then(p => { try { res.write(`data: ${JSON.stringify(p)}\n\n`); } catch (e) {} }); // initial state
      req.on('close', () => sseClients.delete(res));
      return;
    }
    if (url.pathname === '/api/discord') {
      const f = path.join(ROOT, 'tools', 'news-discord.json');
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(fs.existsSync(f) ? fs.readFileSync(f) : '[]');
      return;
    }
    // static
    let p = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (url.pathname === '/') p = path.join(ROOT, 'index.html');
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    const headers = { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' };
    // sprites never change per filename — long cache. Everything else (html/css/
    // js/data) is small and actively developed: no-cache so fixes land instantly.
    headers['cache-control'] = url.pathname.startsWith('/sprites/') ? 'public, max-age=604800' : 'no-cache';
    res.writeHead(200, headers);
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    res.writeHead(500); res.end(String(e.message || e));
  }
}).listen(PORT, () => console.log('Batomon Companion on http://localhost:' + PORT));

// ---- periodic auto re-scrape ----
// Keep the dataset fresh without anyone remembering to hit the Refresh button.
// On start (after a short settle) + once a day, if data.js is older than a week
// we re-run the same scrape pipeline as /api/refresh, headless in the background.
// Whenever the companion is open, batodex data self-heals toward current.
const STALE_DAYS = 7;
function dataAgeDays() {
  try {
    const m = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8').match(/"generatedAt"\s*:\s*"([^"]+)"/);
    if (!m) return Infinity;
    return (Date.now() - new Date(m[1]).getTime()) / 86400000;
  } catch (e) { return 0; } // can't read → don't thrash; manual refresh still works
}
// RELEASE builds ship a PINNED dataset snapshot: everyone runs identical, tested data
// until the next release, instead of each install silently drifting as batodex changes.
// The ⟳ Refresh button always works (manual, on demand). Devs opt back into the old
// self-healing behaviour with BC_AUTO_REFRESH=1 (set for you in dev.cmd / npm run dev).
const AUTO_REFRESH = process.env.BC_AUTO_REFRESH === '1';
function maybeAutoRefresh() {
  if (refreshing) return;
  if (!AUTO_REFRESH) return;             // release default: pinned snapshot, manual ⟳ only
  if (process.env.REFRESH_TOKEN) return; // public host: token-gated manual only, never auto
  const age = dataAgeDays();
  if (age > STALE_DAYS) {
    console.log(`[auto-refresh] dataset ${Math.round(age)}d old (> ${STALE_DAYS}d) → refreshing.`);
    runRefresh(null, true);
  }
}
if (AUTO_REFRESH) {
  setTimeout(maybeAutoRefresh, 15000);                  // 15s after boot, once the server has settled
  setInterval(maybeAutoRefresh, 24 * 60 * 60 * 1000);   // then a quiet daily check
}
