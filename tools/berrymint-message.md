# Message to berrymint — draft (Discord DM or Steam forum). Attach the 3 screenshots.

## Main version

Hey! I'm Julian — been playing a ton of Batomon Showdown and really enjoying it.

I'm a dev, and I ended up building a companion app for it on the side. Kind of a Path of Building / Mobalytics thing but for Batomon: shop pick advice backed by real Master-rank win rates, a battle simulator that gives you a win chance for the fight, positioning help, day-by-day coaching, EN + FR. It uses the public batodex data, and if you want, it can mirror your live run from the save file so the advice keeps up with your game.

Before I put it anywhere I figured I'd ask you first:

- Are you cool with a fan tool like this existing? If anything's off-limits — assets, the save-file reading, scraping, whatever — just tell me and I'll change it.
- If it's cool, would you mind me sharing it in the Discord for feedback?

It's free, no ads or accounts or tracking. It credits you and batodex, and points people to wishlist + review the game first. Happy to send a quick demo or the code if you want to poke at it.

No rush, I know you're busy. Either way, thanks for the game — it's genuinely great.

Julian

---

## Short version (if a DM feels better tight)

Hey — Julian here, been playing a lot of Batomon and loving it. I'm a dev and built a free companion app for it on the side (shop advice with real Master-rank win rates, a battle sim with win %, day-by-day coaching — PoB vibes). Before sharing it anywhere I wanted to check you're okay with a fan tool like this existing, and whether I could post it in the Discord. Anything off-limits — assets, save-reading, whatever — I'll change it. It credits you and sends people to the game first. Happy to demo it. No rush, and thanks for the game!

## Notes for tomorrow (not part of the message)
- If the API topic lands, concrete asks (in order of value): (1) populate `pending_battle_opponent` in run_save.json client-side — the companion already sims real matchups the moment it appears; (2) team HP value in the save; (3) held/unused items in the save; (4) player rank/MMR (e.g. "Gold 5", stars, rating) surfaced in the run save — the companion's Profile page auto-syncs it the moment any rank-ish key appears (it scans defensively).
- Send AFTER: COFFEE_URL filled, deploy target chosen, REFRESH_TOKEN set on public host.
- If they say yes → Discord post draft next; if concerns → offer asset-free mode (text-only, no sprites) as fallback.
- The "official API" ask is the seed for the long game — don't push it, just plant it.
- **Combat-constants questions (only if the conversation goes technical)** — the companion now runs an event-based battle simulator; these 5 answers would make it exact instead of wiki-inferred:
  1. Do units cast first at t = cooldown, t = 0, or with a random/staggered offset?
  2. Burn: tick every 0.5s for stack count then −1 stack — correct? Poison ticks 1/s, no decay?
  3. Shock: bonus damage = current stacks on EVERY direct hit (per multicast hit too)?
  4. Shields: persist until consumed? Do status ticks pierce a % of shield?
  5. Is battle resolution fully deterministic given both boards (no RNG)?
