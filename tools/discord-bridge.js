// Optional Discord bridge — mirrors Batomon Showdown announcements into the app in real time.
//
// ── The compliant setup (important) ─────────────────────────────────────────
// Automating YOUR OWN user account ("self-bot") is a Discord ToS violation and
// a ban risk. Don't. The clean route uses Discord's built-in channel FOLLOW:
//
//   1. Create your own private Discord server (1 click).
//   2. In the Batomon Showdown server, open the announcements channel →
//      click "Follow" → target: your private server. Discord now auto-crossposts
//      every announcement into your server. (Works for any "Announcement"-type channel.)
//   3. Create a bot: https://discord.com/developers/applications → New Application
//      → Bot → copy token. Enable "MESSAGE CONTENT INTENT" under Privileged Intents.
//   4. Invite the bot TO YOUR OWN SERVER (OAuth2 → URL Generator → scope: bot,
//      perms: Read Messages/View Channels, Read Message History).
//   5. npm install discord.js  (in this tools/ folder)
//   6. Set env vars and run:
//        DISCORD_TOKEN=<bot token> DISCORD_CHANNEL_ID=<your channel id> node discord-bridge.js
//
// The bridge writes tools/news-discord.json; the companion server serves it at
// /api/discord and the News tab merges it with Steam news.
//
// Note: berrymint posts patch notes to Steam too (the News tab already pulls those
// live) — the Discord bridge adds anything Discord-only: beta pings, hotfix chatter.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const OUT = path.join(__dirname, 'news-discord.json');

if (!TOKEN || !CHANNEL_ID) {
  console.log('Set DISCORD_TOKEN and DISCORD_CHANNEL_ID (see setup comments at the top of this file).');
  process.exit(1);
}

let Client, GatewayIntentBits;
try { ({ Client, GatewayIntentBits } = require('discord.js')); }
catch { console.log('Run: npm install discord.js   (inside tools/)'); process.exit(1); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function load() { try { return JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { return []; } }
function saveMsg(m) {
  const all = load();
  if (all.some(x => x.id === m.id)) return;
  all.unshift({
    id: m.id,
    date: Math.floor(m.createdTimestamp / 1000),
    author: m.author ? m.author.username : 'unknown',
    title: (m.content || '').split('\n')[0].slice(0, 120) || '(embed)',
    contents: m.content || (m.embeds && m.embeds[0] && (m.embeds[0].title + '\n' + (m.embeds[0].description || ''))) || '',
    source: 'discord',
  });
  fs.writeFileSync(OUT, JSON.stringify(all.slice(0, 200), null, 1));
  console.log('saved:', all[0].title);
}

client.once('ready', async () => {
  console.log('Bridge online as', client.user.tag, '— watching channel', CHANNEL_ID);
  try { // backfill last 50
    const ch = await client.channels.fetch(CHANNEL_ID);
    const msgs = await ch.messages.fetch({ limit: 50 });
    [...msgs.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp).forEach(saveMsg);
    console.log('backfilled', msgs.size, 'messages');
  } catch (e) { console.log('backfill failed:', e.message); }
});
client.on('messageCreate', (m) => { if (m.channelId === CHANNEL_ID) saveMsg(m); });
client.login(TOKEN);
