# 🎮 Batomon Companion

A **Path of Building / Mobalytics-style companion** for [Batomon Showdown](https://store.steampowered.com/app/4557380/Batomon_Showdown/) — runs entirely on your own machine, reads your live run, and tells you what to buy, where to stand, and whether you're actually favored to win the next fight.

Unofficial fan project. Free, local, no account, no telemetry.

---

## Install (Windows) — no terminal needed

**Step 1 — Install Node.js (once, ~1 minute).**
Go to **[nodejs.org/en/download](https://nodejs.org/en/download)**, download the Windows **LTS** version, run the installer and click Next until it finishes. This is what runs the app on your PC. You never have to touch it again.

**Step 2 — Download the app.**
**[⬇ batomon-companion.zip](https://github.com/deftx/batomon_companion_app_live/releases/latest/download/batomon-companion.zip)**

**Step 3 — Unzip it. This part matters.**
Find the file in your **Downloads**, **right-click → "Extract All…" → Extract**. Anywhere is fine (Desktop is easiest).

> ⚠️ Don't skip this. If you double-click the zip, Windows *shows* you the files but they're not really on your PC yet, and the app won't start. You must extract first.

**Step 4 — Double-click `start.cmd`** inside the extracted folder.

A black window opens and your browser follows a few seconds later. **That's it — you're running.**

**Leave the black window open while you play.** It *is* the app. Closing it stops it. To play again another day, just double-click `start.cmd` again.

### If something goes wrong

| What you see | What it means |
|---|---|
| **The browser says it can't reach the page** | The app needs a few seconds to start. Wait, then refresh — or go to **http://localhost:8137** yourself. |
| **The black window says Node.js is not installed** | Step 1 was skipped or didn't finish. It'll open the download page for you. |
| **The black window mentions the zip** | Step 3 was skipped — extract the zip, then run `start.cmd` from the extracted folder. |
| **The black window flashes and vanishes** | `start.cmd` was moved out of the folder on its own. Re-extract and keep it with the other files. |

Still stuck? Open an [issue](https://github.com/deftx/batomon_companion_app_live/issues) or ping me on Discord (**jonthegym**) — tell me what the black window said and I'll sort it.

### Updating

Download the zip again and extract it over the same folder. Your runs, rank and settings live in your browser, so nothing is lost.

### Mac / Linux

No `start.cmd` there — open a terminal in the folder and run `node server.js`, then visit **http://localhost:8137**.

---

## What it does

### 🔌 It reads your live run

Turn on **Sync** and the app mirrors the game's own save: your board, bench, shop, gold, trinkets — and the **actual opponent** you're matched against. No typing anything in.

![The live cockpit — win%, this-turn plan and your synced board](docs/img/cockpit.png)

### ⚔️ It tells you if you're going to win — and why

The Battle Brain simulates the coming fight with wiki-exact mechanics (burn ticks, poison ramp that never decays, shock-per-hit, shields, cooldown donations) and gives you a real win %, not a power score. When you're synced it reads the opponent's shape and names the counter.

![Battle Brain — expected fight, counter-read and the full damage breakdown](docs/img/battle-brain.png)

### 🕰 It catches the counter-intuitive calls

Some boards get *stronger* the longer a fight runs. When yours does, a shield or heal body can be worth **more** than another attacker — even though it lowers your burst. The app measures that and says so, and tells you the opposite when your board is front-loaded.

![The fight-length read](docs/img/fight-length.png)

### ♟️ It commits to a plan with you

It detects the engines live in your state (poison ramp, burn, bug feeder, CDS chain…), lets you run up to **three at once**, and reasons about which to chase *right now* against the enemy you're facing — and when to flip.

![Strategy plays and the which-to-chase read](docs/img/strategy.png)

### 📈 It coaches you from your own games

Rank progression, a skill radar built from your runs, per-trainer records, and every finished run archived with a day-by-day breakdown.

![Profile — rank progression, skill radar and career stats](docs/img/profile.png)

### 📖 And it ships the whole database

Every monster, item and trinket with real Master-ranked win rates.

![Batodex](docs/img/batodex.png)

## Data

Ships with a **pinned data snapshot** so every install runs the same tested numbers. Hit **⟳ Refresh** in the Patches tab any time you want to pull the latest from [batodex.com](https://batodex.com) yourself.

## Privacy

Everything is local. Your runs and settings are stored in your browser's localStorage; the server only reads the game's save file on your own disk. Nothing is uploaded.

---

## Credits

**Batomon Showdown** is made by **berrymint** — [wishlist and play it on Steam](https://store.steampowered.com/app/4557380/Batomon_Showdown/), and leave them a review. All game assets, names and data belong to their creators. Live database courtesy of [batodex.com](https://batodex.com).

See [NOTICE](NOTICE.md) for asset attribution.
