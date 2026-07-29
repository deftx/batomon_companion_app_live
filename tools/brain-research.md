# Batomon Companion — Brain Deep-Dive (overnight research pass)

Phase 1 inventory → Phase 2 external research → Phase 3 incorporation + pre-mortem → Phase 4 implementation log.

---

## PHASE 1 — Every capability of the current brain (with weights)

### A. Shop pick scoring (`engine.scoreShop`) — "what to buy and why"
The core ranking. Every shop offer gets `raw = w.now·powerNow + w.scale·scale·0.45 + w.econ·econ·18`, then multipliers, then real-data blending, then normalization to a %.

1. **Day-phase weights** — the now/later/econ tradeoff shifts by day:
   | Day | now | scale | econ | read |
   |---|---|---|---|---|
   | 1–2 | .62 | .18 | .20 | tempo is king |
   | 3–4 | .48 | .32 | .20 | start building |
   | 5–6 | .38 | .47 | .15 | scaling matters most |
   | 7–8 | .32 | .58 | .10 | invest hard |
   | 9+ | .42 | .53 | .05 | championship: power ON BOARD |
   *Example: a Common statball ranks high day 1, sinks by day 6 when a scaling engine piece outgrows it.*
2. **Scaling index** `scale = power(L3)·0.65 + power(L4)·0.35` — what the unit becomes if invested (evolution target used when the merge crosses its level threshold).
3. **Econ** `power/max(cost,5)` — value per dollar. *Example: $10 Stingarde with 72% WR beats a $30 statball early.*
4. **Merge modeling** — with N copies owned, the offer is scored as the unit it CREATES (level N+1, or the evolution). Chips: "2nd copy → merges to Level 2", "Completes EVOLUTION → Sunsage". Tempo mults ×1.1 (2nd) / ×1.2 (3rd).
5. **Trainer economics** — Bug Catcher first-bug-free (effCost 0, ×1.18 "free tempo"), Coupon −$5, Monster Ranger target ×1.15.
6. **Synergy multiplier** — type stacks with your board + measured combo completion.
7. **Meta adjustment** — per-monster META_ADJ from patch analysis (e.g. "Reworked to damage; no longer a shock bot").
8. **Declared-intent floors** — adopted ♟️ strategy piece: ×1.35 AND floored to fieldMax×1.08 (always #1); 🎯 comp/run-plan piece: ×1.25 AND floored to fieldMax×1.0; ♟️ strategy food (type match): ×1.2. *This is why Boomagon leads the list while boom_chain is adopted even if a statball sims higher.*
9. **Real Master data (additive second pass)** — `bonus = preMax·(wrTerm·1.2 + comboTerm·1.0 + trainerTerm·0.7 + trinketTerm·0.55)`; wrTerm = clamp(−0.2…0.25, (WR−66)/100)·confidence(rounds); per-day WR blended when ≥40 rounds. Additive so measured 90%-WR combos can re-rank what the model undervalues.
10. **Affordability** — unaffordable ×0.25, then order-preserving squash of the unaffordable set under preMax×0.3 (floored strategy pieces exempt by design — declared intent outranks wallet).
11. **Space awareness** — buy order skips offers with no board/bench room (copies merge, new species need a slot): "skips N for SPACE".
12. **Item advice** — BUY/MAYBE/SKIP per shop item with uses-left gate (`items_bought_this_round/max`), berry target advice (bottom-right slot), feeder notes (Alpinine +Dmg/Shield per use).

### B. Reroll / mulligan intelligence (`shopEV`, `rerollVerdict`)
Analytic expected value of a FRESH shop: each slot draws a rarity by exact wiki odds at your shop level, then uniform species within rarity, each scored by the live engine vs YOUR board — max-order-statistic across slots ⇒ "expected fresh-roll best ≈ X%". Compared to current best ⇒ **KEEP / REROLL ($3) / LOCK** verdicts, gold-gated. *Example: "REROLL — a fresh shop's best is ~93% better".*

### C. Battle Brain (fight simulation)
- **unitOutput**: per-second dps/heal/shield/burnApp/poisonApp/shockApp/hitRate per unit, folding base stats, level/shiny, trinket mods (incl. per-slot scopes: topMid crown, rightCol crest, type orbs — Chef-converted types included), Chef +2 burn, permanent feeds (save perm_buffs: dmg/shield/burn/**+cds key-10 fraction**), multicast.
- **Wiki-exact status model**: shock = flat dmg per hit × stacks (never decays; cross-product hits/s × stacks); burn ticks 2×/s decaying 1/tick (ramps only past 2 stacks/s); poison pure ramp (T²/2).
- **HP model**: measured base curve (day: 300/500/…/25 700 at d12; Julian-corrected), learned per-run overrides, interpolation + accelerating 38·day² extrapolation; trinket HP mods (Barbell +5000, charms %).
- **Sim**: EHP = HP + sustain·tDie; tKill/tDie ⇒ verdict + % margin; live opponent board when battle-synced (shape-defensive).
- **Self-ramps**: Bambudo +35 dmg/cast, Galvanine CDS+shock, Prismagon per-type, Clawnetic shock-charged — fight-averaged.
- **Per-unit breakdown table**: casts (cascade-aware), per-cast → totals per stat, status damage attributed by application share, ⚡ CDS-donated column, Σ team row with real column totals.

### D. Positioning brain (`positionalBonuses` + optimizers)
- **DONORS table** (single source for arrows + engine + optimizer): boomagon behind +4% CDS/cast permanent; dracana behind charge; magmalith/noxalith above burn/poison feeds; saberhorn/zephyrex front multicast; pylong behind shock ×2; formiqueen adjacent-commons 33% CDS aura; gaiadrasil mirror; aegistruct shield copy; Link Cable = all-adjacent.
- **CDS cascade** (2-pass): donors accelerate donors — Boomagon behind Boomagon compounds (cast counts use cascade-adjusted cooldowns).
- **arrangementValue**: team output + depth heuristics (front column favors tank score ×0.4; back column protects carries ×0.06 dps; squishy-carry-in-front penalty) + team shock cross-product + burn ramp value.
- **arrangementValueFocused** (strategy adopted): focus own output ×2.2 + received donations ×3 + everyone else ×0.55 + back-column preference — concentrates the engine on the focus.
- **🎯 posTarget tracker**: brute-forced best arrangement (bench promotions included) applied as preview + tracked against the real game board via sync; per-slot ✓; staleness guards (day change, roster multiset).

### E. Strategy brain (♟️ engine plays)
- **6 detectors** with score/focus/worth/whyWorth: boom_chain (greed-gated by lives×days-to-amortize; Chef burn-carry preference — "two engines stack"), bug_feeder (Guardiant/Cinderfly/Shogapede permanent feeds), item_engine (Alpinine+Berroon), shock_hits (stacks want hits/s), poison_ramp (never decays; wants fight length), burn_chef (2/s ramp threshold; Magmalith feed).
- **Adoption** re-aims the WHOLE advisor: buy floors (A.8), sell protections, focused positioning, 📋 budgeted plan (buy → sell-to-fund → make-room → optimize), rotation advice at focus cd ≤2.2s, donor-missing detection ("no donor can feed it — buy one").
- **Worth gates**: e.g. boom_chain requires lives + days left to amortize a permanent ramp.

### F. Sell / economy brain
- **saleValueOf** = enginePower × dup 0.55 × leveled 1.3 × benched 0.6 (revealed preference).
- **protectedUnitIds** = plan core/lateCore + adopted strategy focus+wants + DETECTED worth-it engines' focus & owned wants + eggs (never sellable).
- **Cut order** with labels; SWAP verdicts (sell weakest → buy shop standout) gated by relative strength (row.raw/top ≥0.85) or feeder/combo/strategy chips; income unified via `nextIncomeL()` (base + passive trinket gold).
- **Greed meter**: income formula 25+min(80,day·5), trinket gold (trophies/grail on win), lock-vs-spend advice.

### G. Turn coordinator (🧭 This turn)
One ordered directive built from the SAME helpers every panel uses (single scoreShop call shared with 🛒): strategy → buy target (honest about $ shortfall) → sell-to-fund/lock (same saleValueOf + protections) → 🥚 egg timeline (hatch turns + what emerges) → optimize focus. Exists to make contradiction structurally impossible.

### H. Event & level-up advisors
- **scoreEventOption**: per-reward-type EV — named monster (real WR + board combo lift + merge fuel), random-rarity EV over the pool, trinket-gift EV (pool avg +2 "you'll beat average with a choice"), flat gold 47+amt/8, shiny 58, level-up 56, shop-rank 51+n, typing conversion 52, Recombobulator (58+fielded, −14 if committed to a strategy/plan — randomizes your board).
- **levelUpValue** (💎 free-level picker): unitOutput-value delta at T=20 (dps + poison·T/2 + burn·2 + shock·hits·T/2 + heal·.5 + shield·.6) — NOT flat power (multicast/burn/shield bodies valued correctly); evolution ×1.7 + floor; strategy focus ×1.35; comp piece ×1.15; concrete stat-diff line (Multicast ×3→×5, CD 7→3.5s, EVOLVES → Sunsage).

### I. Trainer layer
Per-trainer passives modeled: Chef fire-conversion (+2 burn, single-typed) incl. type-scoped trinkets on converted units; Bug Catcher free bug/day; Egg Breeder hatch day 6; Monster Ranger tracked species; Second Chance; greed/econ trainers; trainer-specific real-data combos (trainerCombos).

### J. Memory / meta layers
- **Game History** archive + 🧠 coaching insights (phase WR, best/worst trainer, typical death day, strategy-adoption badge lift).
- **HP curve learning** from typed corrections; **run log** (strategies adopted, event choices) → per-day drill-down.
- **AI Battle Brain+** (Claude API second opinion over full state + patch notes + Steam discussions).
- **Community ingestion scaffold** (v1, gated off) — future data flywheel.

### Decision hierarchy (what outranks what)
1. Declared intent (adopted strategy > run plan) — floors in buy, protections in sell, focus in positioning.
2. Measured reality (real Master WR/combos, learned HP, perm-buff state from save).
3. Model (power/scale/econ by day-phase).
4. Tempo/economy modifiers (merge, free, coupon, space).
5. Presentation invariants (single scoreShop per render; one income helper; shared valuation/protections) — coherence by construction.

---

## PHASE 2 — What the best companions actually do (research findings)

### 1. Bob's Buddy — HSReplay/HDT & Firestone (Hearthstone Battlegrounds)
- **Algorithm**: ~10,000 Monte Carlo combat simulations per round → **win/tie/loss % + lethal %**. Validated by comparing predicted probabilities vs thousands of real outcomes (published calibration chart).
- **Design lessons**: show results *after* the decision window (non-intrusive); **gracefully deactivate** when mechanics are unpredictable (Akazamzarak secrets) rather than guess; probabilities beat point-estimates for trust.

### 2. MetaTFT / tactics.tools / MetaBot (Teamfight Tactics)
- **Rolldown odds calculator**: "exact gold for a **50% / 80% / 95%** chance to hit your target" — models shop slots (rarity tier roll → uniform draw within tier, pool-aware: copies held by anyone are removed).
- **Live overlay**: comp pinning, augment stats vs average placement (delta stats), win-chance estimates per round, lobby scouting.
- **Match graph**: placement/health/econ/XP curves across the game; click a round → board screenshot + details. Post-game becomes a coaching artifact.

### 3. Mobalytics GPI (LoL) + Mobalytics TFT/PoE2/Bazaar
- **GPI**: ML scores **8 skill dimensions 0–100 against the rank population** (Aggression, Consistency, Farming, Fighting, Survivability, Teamplay, Versatility, Vision) → radar chart → "your weakest area is X, do Y". The insight loop: *measure → compare to population → prescribe one focus*.
- Mobalytics now ships The Bazaar guides/builds — validates the genre's appetite for companions.

### 4. Path of Building (PoE 1/2)
- **Exact stat engine** (Lua, full game database): DPS/EHP with complete per-modifier breakdowns; the gold standard for "trust the numbers".
- **What-if diffing**: hover ANY item/gem/tree node → **±DPS / ±EHP delta vs current build** before committing. The single most-loved mechanic: decisions become diffs.
- 4-stage workflow (import → plan → compare → export); ecosystem interop (poe.ninja ladder → PoB import code → pobb.in sharing).

### 5. poe.ninja
- **Ladder aggregation**: top-character builds scraped via official APIs → popularity/usage stats; **outlier-filtered** price confidence (not naive averages). Lesson: aggregate + clean + expose "what winners do", and make every aggregate CLICKABLE down to the source.

### 6. chess.com Game Review
- **Expected Points Model**: every decision classified by **Δ win-probability** (Best/Excellent/Good/Inaccuracy/Mistake/Blunder + Brilliant/Great/Miss), rating-relative; accuracy = % agreement with best moves. Lesson: grade decisions *relative to the player*, phrase as deltas, keep classes few and legible.

### 7. The Bazaar tooling (BazaarDB / BazaarPlanner) — no official companion
- Run tracker records **board+stash+skills per day**, replayable day-by-day; build simulator vs top-seen builds; deep hidden-stat DB. (Batomon companion already has run recording + day drill-down — we're at parity there; their build-vs-top-builds sim is the next rung.)

### PHASE 2b — The GAMES themselves (not the tools): decision systems worth stealing

| Game | Its core decision system | Lesson → Batomon brain |
|---|---|---|
| **TFT** | Econ is interest breakpoints (10g steps) + streaks; "when to roll vs level" is THE skill; shop odds by level; shared unit pool makes contested picks worse | Batomon income is flat (25+min(80,5·day)) — the real "interest" is **lives**: greeding costs lives, not gold. Brain already gates greed strategies by lives×days (boom_chain worth). Shop-odds-by-level already modeled; pool sharing unknown → odds stay pool-blind, labeled |
| **Hearthstone Battlegrounds** | **Health is a resource you spend** to greed tavern tiers; comp taxonomy = tempo vs scaling; triples force buy-order discipline | Same taxonomy as our STRATEGY_LIB (tempo engines vs permanent ramps); the "spend lives to greed" framing is exactly the Run Health gauge's lives-buffer dimension |
| **Super Auto Pets** | Fixed 10g turns make every reroll a % of your whole economy; **freeze** = carry value across turns; snowball units compound per-turn | Batomon's 🔒 lock = freeze — our LOCK verdict already prices it ("tomorrow's +$N covers it"); snowball units = our feeders/donors with permanent accrual (already modeled via perm_buffs) |
| **The Bazaar** | Days of 6 hours (choices), PvP checkpoint per day; **losing later costs MORE** (−day Prestige); Sandstorm forces convergence (no infinite sustain); 10 wins ends the run | Structurally Batomon's twin (10 badges, per-day battle). Two steals: (a) late losses hurt more → the pace/lives math should tighten late — gauge thresholds already band by absolute lives; (b) convergence timer → fight-length model matters: our sim duration IS that (fights lengthen ~12+3·day, sustain matters more late — already in EHP) |
| **PoE 1/2** | Build theory = **breakpoints & layers**: res caps, attack-time thresholds, defense layering; deaths are the real currency (HC) | Breakpoint surfacing: we already expose burn's 2/s ramp threshold + the ~1s CD floor (rotation trigger ≤2.2s). Defense layering = our EHP (HP + heal + shield×0.9). Lesson honored: name the thresholds, advise AT them |
| **LoL** | **Power-spike calendar** (item/level timings) governs when to fight; win-condition identification; tempo trades | Batomon's spike calendar is the ENEMY HP CURVE — measured: 500→1400 (d2→4 ×2.8), 2400→5700 (d5→7 ×2.4), 11600→25700 (d9→12 ×2.2). NEW FEATURE: **📅 danger-day forecast** — warn BEFORE the next big HP jump so levels/evolutions come online in time |

**Net-new implementable from the games pass**: the 📅 power-spike forecast (shipped below) — everything else the brain already embodied, now documented as deliberate design rather than accident.

### Cross-cutting patterns (the actual algorithms)
| Pattern | Who | Core math |
|---|---|---|
| Monte Carlo combat win% | Bob's Buddy | N sims over RNG outcomes → P(win/tie/loss), calibrated |
| Hit-odds / rolldown EV | MetaTFT, tactics.tools | per-slot P = P(tier)×(1/species-in-tier), P(roll)=1−(1−p)^slots, gold-for-q = ceil(ln(1−q)/ln(1−P(roll)))×cost |
| Decision Δwin-prob grading | chess.com | classify each choice by change in expected outcome |
| Population-relative skill dims | Mobalytics GPI | score 0–100 vs rank distribution, prescribe weakest |
| What-if diffing | PoB | recompute full sim under hypothetical change, show ± deltas |
| Winner aggregation | poe.ninja | ladder scrape → cleaned aggregates → drill-down |
| Run replay/graph | MetaTFT, BazaarDB | time-series of health/econ/placement + per-round drill-in |

---

## PHASE 3 — Incorporation table + pre-mortem

### What to incorporate
| # | Feature (source) | What it does in Batomon Companion | Ship tonight? |
|---|---|---|---|
| 1 | **⚔️ Win probability** (Bob's Buddy) | Battle Brain shows "Win ~72% · close 18%" — parameter-jitter Monte Carlo (N=400) over the SAME closed-form sim (±12% on dps/sustain/HP both sides) → probability band instead of a bare verdict | ✅ |
| 2 | **🎲 Gold-to-hit odds** (MetaTFT rolldown) | For strategy/plan targets: "≈$9 for 80% to see Boomagon at Shop Lv 5" — exact rarity odds × species pool, per-roll hit chance, gold for 50/80/95% | ✅ |
| 3 | **📊 Run graph** (MetaTFT match graph) | Game History drill-down gets a gold/lives/badges sparkline across days | ✅ |
| 4 | **♟️ Day notes** (chess.com-lite) | Loss-day heuristic observations in the timeline: "lost with $148 banked — over-saving", "no strategy adopted by day 6", "3 losses by day 4 — lives bled early" | ✅ |
| 5 | **🧭 Run Health gauge** (Mobalytics) | One meter atop the Brain: ON TRACK / AT RISK / CRITICAL from lives buffer + badge pace + sim margin, with the weakest dimension named | ✅ |
| 6 | Per-decision EV grading (full chess.com) | Grade each BUY/SELL/REROLL vs the engine's top line at that moment | ⏳ later — needs decision-time shop logging (add to runLog first) |
| 7 | Pool-aware odds | Deplete species pool by copies seen/held | ⏳ later — pool sizes unknown; needs ingestion data or wiki |
| 8 | What-if hover diffs (PoB) | Hover a bench/shop unit → ±team output if swapped in | ⏳ later — partially covered by SWAP tips; UI scope |
| 9 | Winner-board aggregation (poe.ninja) | "Top Master boards on day N" gallery from crawled runs | ⏳ later — crawler stores aggregates, not per-day boards |

### Pre-mortem — bugs/incoherences pre-run and designed out
| Risk | Mitigation (designed in) |
|---|---|
| Win% contradicts the FAVORED/BEHIND verdict | Both derive from the SAME sim numbers in the same function; jitter is centered on them; monotonicity holds by construction (margin>0 ⇒ win%>50) |
| Win% false precision / wrong enemy | Rounded to 5%, "~" prefix, labeled vs day-average or the synced foe (existing label); no decimals |
| Rolldown odds disagree with 🎰 shopEV | Same `shopOdds(shopRank)` rarity table + same species-pool counting as shopEV — one source |
| Target not in pool at current shop rank (P=0) | Guard before ln(): show "not in the Shop Lv N pool — raise shop level", never divide by zero |
| Free rerolls (trainer) ignored | Cost line subtracts `trainerData.freeRerolls` when present |
| Run graph divide-by-zero / 1-day runs | Hide graph below 2 points; pad flat ranges |
| Day notes accuse wrongly | Conservative thresholds, LOSS days only, day ≥2, phrased as observations not verdicts |
| Gauge runs a second sim that drifts from the Brain | Gauge is computed INSIDE battleBrainHTML from the same sim object — zero drift possible |
| Unknown starting lives per trainer | Gauge uses absolute lives bands (≥5 ok / 2–4 caution / ≤1 critical) + badge pace vs day, no "start lives" assumption |
| XSS via names | All strings through esc() as everywhere else |
| FR mode breaks | PATTERNS_INLINE additions for every new user-facing string |

---

## PHASE 4 — Implementation log (what shipped tonight)

| Feature | Where | How it works | Verified |
|---|---|---|---|
| ⚔️ **Win probability** | Battle Brain "Expected battle" line | 400 draws of ±12% multiplicative noise on the SAME tKill/tDie the verdict uses (seeded PRNG from state → stable across re-renders; Box-Muller normals; rounded to 5%). Shows "~N% win chance (margin · M% coin-flip close)" | Live: "BEHIND ~0% win chance (−353% margin)" on a weak test board — monotone with verdict by construction |
| 🧭 **Run Health gauge** | Top of Battle Brain card | 3 dims scored 0–2: lives buffer (≥5/≥2 bands), today's win% (from the sim margin), badge pace vs champion tempo (0.55 🏅/day) → ON TRACK / AT RISK / CRITICAL + "focus: <weakest>" | Live: "🧭 CRITICAL · 4❤ · ~0% today · 3🏅 d7 · focus: behind today" |
| 🎲 **Gold-to-hit odds** | Strategy plan reroll-targets + Build-path next-piece | MetaTFT rolldown math on the SAME effectiveOdds table as the 🎰 verdict: pSlot = P(tier)/speciesInTier; pRoll = 1−(1−pSlot)^slots; gold(q) = ceil(ln(1−q)/ln(1−pRoll))·$3 − free rerolls. Pool-blind, labeled ≈. Guards: not-in-pool at low shop Lv (no ln(0)), pRoll cap .999 | Live: Boomagon @ Shop Lv 6 → "🎲 ~$72 for 80%" (hand-checked vs odds table) |
| 📊 **Run graph** | Game History drill-down | Inline SVG: gold/lives/badges polylines per day (each scaled to own max, ≥2 points required), point tooltips | Live: renders on his real 11-battle archived run |
| ♟️ **Day notes** | Game History timeline | Loss-days only, once/twice per run: 2 worst gold-hoards ("lost with $201 banked"), lives-bleed day (3rd loss ≤ day 4), no-strategy note ONLY when the run truly never adopted one (legacy runs with undated strategy stay silent) | Live: exactly 2 notes on his real run (days 11 & 9) — the repetition + false-claim bugs found in verification and fixed |

| 📅 **Danger-day forecast** (games pass: LoL spike calendar × measured HP curve) | Battle Brain, under the gauge | Scans the next 3 days on baseHPFor; warns when a jump ≥18% is coming ("Power spike day 8: +52% → ~8,650 — get merges/evolutions online BEFORE it"), extra caution line when today's margin ≤10% | Live: day-6 test → "day 8 +52%, tomorrow +41%" — hand-checked vs curve (4050→5700→8650) |

Pre-mortem hit rate: 2 real issues surfaced during live verification that the table had missed (note spam; legacy-run false "no strategy" claim) — both fixed before delivery. All other pre-mortem mitigations held. Suites: 20/20 engine + 128/128 stats, console clean, FR strings added for every new surface.

Deferred (documented in Phase 3 table): per-decision EV grading (needs decision-time shop logging), pool-aware odds (needs pool sizes), PoB-style hover what-ifs, winner-board gallery (needs per-day board crawl).

---

## PHASE 5 — Deep-dive v2: closing the real depth gap (source-informed)

### Source dives (done BEFORE building)
- **twanvl/hearthstone-battlegrounds-simulator (C++)**: step-based event loop, explicit board state, Monte Carlo N=1000 default, results as win/tie/loss + 11-point damage percentiles, state snapshots for RNG re-rolls. Lesson: separate pure sim from presentation; report distributions.
- **PoB calc pipeline (Lua)**: collect modifiers → aggregate (ModDB) → offence pass → defence pass → per-stat breakdowns; what-ifs recompute only affected branches. Lesson: pure inputs → full breakdown out; builders at module scope for reuse.
- Bob's Buddy repo is private; its published design (sim-after-decision-window, calibration chart, graceful deactivation) was already extracted in Phase 2.

### 1. Event-based combat simulator — `E.simEvents` (engine.js, pure)
Batomon fact honored: **shared team-HP pools** (units never die mid-fight) — so the event sim's value is *discrete timing*, exactly what the closed-form integral smooths away:
- casts at t = cd, 2cd, … (first cast waits a full cooldown); multicast = N hits/cast
- **CDS donations land stepwise** per donor cast (receiver's remaining wait rescales); charge advances the receiver's next cast; feeds accrue per cast; triggers force full casts (depth-capped)
- **shock cashes per hit** against current stacks (true quadratic coupling); burn ticks every 0.5s then decays 1; poison ticks 1/s forever; shields absorb with 25% status pierce
- survivor death time extrapolated from absorbed rate (closed-form clock semantics — no TMAX inflation)
- deterministic given inputs; dt = 0.05s
**Validated (7 new selftests, suite 27/27)**: exact kill times (10dmg/1s vs 100hp = 10.00s; multicast case = 30.00s), CDS chain strictly accelerates kills, shock coupling (1-dmg hitter cashes 840 damage), margin band sanity, determinism, 40-config NaN fuzz. **Model finding**: the closed-form burn term genuinely UNDERCOUNTS (each applied stack burns ~(n+1)/2 ticks before decaying; the integral credited ~1) — the event sim is the more faithful model and is now primary; a ⚖️ divergence note appears when the two disagree on sign by >60 points.
Integration: `buildEventSpecs` (module scope) converts unitOutput rates → per-cast amounts, folds STATIC positional passives via stat-wise team scale (dynamic donor kinds excluded — they're simulated as events; `positionalBonuses(..., {skipDynamic})`), resolves each dynamic donor's receiver by direction. Day-average enemies become 3 virtual units (hitter / statuses / sustain) preserving rates AND hit granularity. Win% = **true Monte Carlo**: N=100 event sims with spec-level noise (foe ±12%, own ±8%), seeded per state.

### 2. Calibration — `calibrationReport(run)` (Bob's Buddy's trust move)
Replays every archived battle through the event sim vs that day's average enemy (final trinkets, positions approximated — all disclosed in the line). Shown per run in Game History: "🎯 would have called H/T battles (Brier B)".
**First real result (Julian's 2W-9L Chef run): 3/11, Brier 0.72** — investigated before trusting: his recorded day-7/11 boards were STRONG (2× Magmite L3, Alpinine L3) yet lost ⇒ not an inversion bug but a true finding: **real opponents on a losing streak run stronger than the day-average** (matchmaking pairs records). That takeaway now renders inside the calibration line when hit-rate < 50% — calibration exposing model limits honestly is the feature.

### 3. Pool tracking — `live.shopSeen`
Counts species appearances across this run's DISTINCT shops (a shop whose id-multiset is a subset of the previous = a purchase, not a fresh roll — not recounted). Feeds the 🎲 chip: "seen 2×/14 shops this run", with a COLD flag when expected ≥2.5 sightings and seen 0. Resets on new run. Verified live: "≈7% per roll … seen 0×/8 shops this run".

### 4. Decision-time logging + grading — chess.com's Expected-Points idea, adapted
`lastShopRanks`/`lastRerollVerdict` snapshot what the brain said at render time; same-day sync diffs detect what the player DID (BUY: gold drop ≈ a vanished offer's cost; REROLL: −$3 + shop swap; mutually exclusive). Each decision logs with its decision-time grade ("🛒 bought X — brain rank #1 ✓ top pick" / "· 62% below the top pick"). Run detail aggregates: "🧠 followed the brain's #1 in a/b tracked buys · c big divergences", per-day entries in the timeline (🧠 icon). Conservative by design — only unambiguous actions are graded.

## PHASE 6 — "Improve 1–6 + five features" batch (same night)

**Improvements shipped**
1. **Ground-truth loop**: every battle's LIVE prediction (full state) is now stored on its history entry (`pred`) → 📼 live-model calibration line accumulates real predicted-vs-actual; berrymint message gained 5 combat-constants questions.
2. **Δwin% buy chips**: every shop offer shows `⚔️ +N% win` from the event sim (merge/evolution-aware placement, 24-draw MC, honest "board full" skip).
3. **Sim-verified positioning**: optimizer pre-ranks with the closed-form, event-sims the top-10 shortlist, sim has the final word (within a 0.8× sanity band).
4. **Noise fitting**: `fitSimNoise()` grid-searches (σfoe, σown) minimizing Brier over the archive; auto-runs from the History tab; refuses to fit under 3 runs/25 battles; consumed by both win% paths; fitted status shown in the header.
5. **Wider grading**: SELL (✓ recommended cut / ⚠️ was PROTECTED) and ITEM buys (vs cached BUY/MAYBE/SKIP advice) now logged + graded alongside buys/rerolls.
6. **Ingest pools**: opt-in payload now carries observed-shop counts (`shops:{n,c}`, server shape-cleaned) → community pool-size estimation at v1.

**Features shipped**
- **📊 Per-run GPI radar** (Tempo/Battles/Econ/Commit/Align, fixed anchors documented in tooltips) in every Game History run + as bars on the card.
- **📤 Summary card**: hand-drawn 720×405 canvas (result, tiles, 3-line sparkline, dims, calibration, watermark) with PNG download + clipboard copy; buttons in run detail + breakdown modal.
- **🏆 Winner-board gallery**: `tools/build_exemplars.js` → `exemplars.js` (90 real winning Master boards from the 753-run crawl cache, deduped, top-MMR) → Day-by-Day tab shows the day's 6 real winning boards.
- **🗖 Overlay**: Document Picture-in-Picture window (popup fallback) mirroring the 🧭 This-turn card + status strip, repainted on every sync tick.
- **🔔 Notifications**: opt-in bell; run-archived (all three end paths) + power-spike-tomorrow (≥18%, once/day).
- `DISCORD_USERNAME = 'jonthegym'`.

Verified live: Δwin chips (+0/+8/+4 on the burn board — Magmalith correctly top), gallery (3516-MMR day-7 boards), radar (Tempo 100 — his pace beat champion tempo; Econ 42 — the hoards), summary PNG (39KB), noise-status note. Suites 27/27 + 128/128 throughout.

### Honest limitations (so nobody over-trusts)
- Adjacent dynamic donors approximate to their single strongest eligible neighbour.
- Calibration replays lack per-unit feeds, real positions, and the real opponent — it measures the *day-average* model, not the live one (which has full state).
- Pool tracking is observational (no true pool sizes) — it annotates, never adjusts the math.
- Decision grading only sees sync-observable actions; manual-mode play isn't graded.
