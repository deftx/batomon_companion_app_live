# 🎮 Batomon Companion

A **Path of Building / Mobalytics-style companion** for [Batomon Showdown](https://store.steampowered.com/app/4557380/Batomon_Showdown/) — runs entirely on your own machine, reads your live run, and tells you what to buy, where to stand, and whether you're actually favored to win the next fight.

Unofficial fan project. Free, local, no account, no telemetry.

---

## Install & run

You need [Node.js](https://nodejs.org) (v18+). No dependencies, no build step.

1. **[⬇ Download the latest version](https://github.com/deftx/batomon_companion_app_live/releases/latest/download/batomon-companion.zip)** and unzip it anywhere.
2. Open a terminal in that folder and run:

```bash
node server.js
```

3. Open **http://localhost:8137** in your browser.

That's it. To update later, download again and unzip over the same folder — your runs, rank and settings live in the browser and are kept.

### Windows shortcut

Double-click **`start.cmd`** instead of using a terminal.

---

## What it does

- **⚔️ Battle Brain** — simulates the coming fight with wiki-exact mechanics (burn ticks, poison ramp, shock-per-hit, shields, cooldown donations) and gives you a real win %.
- **🔌 Live sync** — reads the game's own run save, so your board, bench, shop, trinkets and *the actual opponent you're about to face* are mirrored automatically.
- **🧭 This turn** — one ordered directive that makes every panel agree: what to buy, what to sell, how to position.
- **♟️ Strategy plays** — detects the engines available in your state (poison ramp, burn, bug feeder, CDS chain…), lets you adopt up to 3, and reasons about which to chase against the enemy you're facing.
- **📈 Profile** — skill radar, rank progression, per-trainer records, career stats, and every finished run archived with a day-by-day breakdown.
- **📖 Batodex** — full monster/item/trinket database with real Master-ranked win rates.

## Data

Ships with a **pinned data snapshot** so every install runs the same tested numbers. Hit **⟳ Refresh** in the Patches tab any time you want to pull the latest from [batodex.com](https://batodex.com) yourself.

## Privacy

Everything is local. Your runs and settings are stored in your browser's localStorage; the server only reads the game's save file on your own disk. Nothing is uploaded.

---

## Credits

**Batomon Showdown** is made by **berrymint** — [wishlist and play it on Steam](https://store.steampowered.com/app/4557380/Batomon_Showdown/), and leave them a review. All game assets, names and data belong to their creators. Live database courtesy of [batodex.com](https://batodex.com).

See [NOTICE](NOTICE.md) for asset attribution.
