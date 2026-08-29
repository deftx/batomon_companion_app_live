/* Batomon Companion — scoring engine.
 * Blends real Batodex Master-Ranked data (trainers, trinkets) with a transparent
 * heuristic power model for monsters (no public monster win rates exist).
 */
window.Engine = (function () {
  const D = () => window.BATODEX;

  // ---------- helpers ----------
  const byId = {};
  function monster(id) {
    if (!Object.keys(byId).length) D().monsters.forEach(m => (byId[m.id] = m));
    return byId[id];
  }
  const phase = (day) => (day <= 3 ? 'early' : day <= 6 ? 'mid' : 'late');
  const fightLen = (day) => 12 + day * 3; // seconds; fights get longer as HP scales per day

  function levelData(m, level, shiny) {
    const arr = shiny && Array.isArray(m.shinyLevels) && m.shinyLevels.length ? m.shinyLevels : m.levels;
    if (!Array.isArray(arr)) return null;
    return arr.find(l => l.level === level) || arr[Math.max(1, Math.min(level, arr.length)) - 1]; // clamp so a stray level 0/5 can't index arr[-1]/overrun
  }
  function stat(ld, key) {
    if (!ld || !Array.isArray(ld.stats)) return 0;
    const s = ld.stats.find(s => s.key === key);
    return s ? s.value : 0;
  }
  function abilityText(m, level, shiny) {
    const ab = shiny && m.shinyAbility ? m.shinyAbility : m.ability;
    if (!ab) return { trigger: null, text: '' };
    const text = (ab.byLevel && ab.byLevel[String(level)]) || ab.description || '';
    return { trigger: ab.trigger, text };
  }

  // ---------- raw power model ----------
  // Returns effective "damage-equivalent per second" style index + breakdown.
  function power(m, level, opts) {
    const o = Object.assign({ shiny: false, day: 5, team: [], trainerId: null }, opts || {});
    const ld = levelData(m, level, o.shiny);
    if (!ld) return { total: 0, parts: {}, notes: [] };
    const cd = Math.max(ld.cooldown || 5, 0.1); // 0.1s is the game's floor (was clamped at 0.5s)
    const mc = ld.multicast || 1;
    const T = fightLen(o.day);
    const parts = {};
    const notes = [];

    const dmg = stat(ld, 'damage');
    parts.direct = (dmg * mc) / cd;

    // Burn: applies B stacks/cast, decays 1 per 0.5s, ticks stacks per 0.5s.
    const burn = stat(ld, 'burn');
    if (burn) parts.burn = ((burn * (burn + 1)) / 2 / Math.max(cd, burn * 0.5)) * Math.min(mc, 3) * 0.9;

    // Poison: permanent stacks, ticks 1/s -> quadratic ramp; avg DPS ≈ P*T/(2cd)
    const poison = stat(ld, 'poison');
    if (poison) parts.poison = ((poison * T) / (2 * cd)) * Math.min(mc, 4) * 0.55;

    // Shock: permanent amp on direct hits; value scales with team hit frequency
    const shock = stat(ld, 'shock');
    if (shock) {
      const teamHits = teamHitRate(o.team, o.day);
      parts.shock = ((shock * T) / (2 * cd)) * Math.min(mc, 4) * 0.35 * teamHits;
    }

    const heal = stat(ld, 'heal');
    if (heal) parts.heal = ((heal * mc) / cd) * 0.5;
    const shield = stat(ld, 'shield');
    if (shield) parts.shield = ((shield * mc) / cd) * 0.6;

    // ---- ability text heuristics ----
    const ab = abilityText(m, level, o.shiny);
    let abilityBonus = 0;
    const t = (ab.text || '').toLowerCase();
    const trig = (ab.trigger || '').toLowerCase();
    const perCastRate = 1 / cd;

    const num = (re) => { const mt = t.match(re); return mt ? parseFloat(mt[1].replace(/,/g, '')) : 0; };

    if (t) {
      // flat stat gains
      const dmgGain = num(/\+(\d+)%?\s*damage/);
      if (dmgGain && !t.includes('%')) {
        if (t.includes('permanently') && trig.includes('cast')) {
          abilityBonus += dmgGain * perCastRate * (T / 2) * 0.9; // snowballs inside battle AND across run
          notes.push('Permanent stacking — snowballs across the whole run');
        } else if (t.includes('permanently')) {
          abilityBonus += dmgGain * 0.6;
          notes.push('Permanent stat gain');
        } else if (trig.includes('cast')) {
          abilityBonus += dmgGain * perCastRate * (T / 3);
        } else {
          abilityBonus += dmgGain * 0.4;
        }
      }
      if (t.includes('cooldown speed')) {
        const cds = num(/\+(\d+)%\s*cooldown speed/);
        abilityBonus += (parts.direct || 5) * (cds / 100) * (t.includes('permanently') ? 1.2 : 0.7);
        notes.push('Cooldown Speed scaling');
      }
      if (t.includes('multicast')) {
        abilityBonus += 12 * (level >= 3 ? 2 : 1);
        notes.push('Multicast enabler');
      }
      if (t.includes('trigger')) {
        abilityBonus += 10 + 4 * level;
        notes.push('Trigger chain piece');
      }
      if (t.includes('charge')) {
        abilityBonus += 8 + 3 * level;
        notes.push('Charge engine');
      }
      if (t.includes('knockout') && !t.includes('knockout self')) {
        abilityBonus += 15 + 8 * level;
        notes.push('Knockout removal');
      }
      if (t.includes('knockout self')) {
        abilityBonus -= 5;
        notes.push('Kamikaze — one big hit then gone');
      }
      if (t.includes('sell value')) {
        abilityBonus += o.day <= 5 ? 12 : 4;
        notes.push('Economy engine (sell value)');
      }
      if (t.includes('gain $')) {
        abilityBonus += o.day <= 6 ? 14 : 6;
        notes.push('Gold generator');
      }
      if (t.includes('trinket')) {
        abilityBonus += 16;
        notes.push('Trinket generator');
      }
      if (t.includes('additional damage equal')) {
        abilityBonus += 20 + 8 * level;
        notes.push('Ongoing damage multiplier — scales with board');
      }
      if (t.includes('transform')) {
        abilityBonus += 15;
        notes.push('Transform effect');
      }
      if (t.includes('evolve')) notes.push('Evolves — buy toward the evolution');
      if (t.includes('item')) {
        abilityBonus += o.trainerId === 'shopkeeper' ? 14 : 7;
      }
      if (trig.includes('battle start')) abilityBonus *= 1.15; // reliable
      if (trig.includes('victory')) abilityBonus *= 0.9; // needs wins but compounds
    }
    parts.ability = abilityBonus;

    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return { total: Math.max(total, 0.5), parts, notes, cd, mc };
  }

  function teamHitRate(team, day) {
    if (!team || !team.length) return 1.0;
    let hits = 0;
    team.forEach(slot => {
      if (!slot || !slot.monsterId) return;
      const m = monster(slot.monsterId);
      const ld = levelData(m, slot.level || 1, slot.shiny);
      if (!ld) return;
      if (stat(ld, 'damage') > 0) hits += (ld.multicast || 1) / Math.max(ld.cooldown || 5, 0.5);
    });
    return Math.min(0.6 + hits * 0.5, 2.2);
  }

  // ---------- synergy model ----------
  // ON-BUY feeders: board units that permanently grow whenever you BUY a matching
  // type — buying their food is extra value, and buying the feeder FIRST beats
  // buying it after the food.
  const ON_BUY_FEEDERS = {
    guardiant: { type: 'bug', gain: '+7 Damage' },
    cinderfly: { type: 'bug', gain: '+10% Cooldown Speed' },
    shogapede: { type: 'bug', gain: '+10% Cooldown Speed' },
  };

  const TRAINER_TYPE_AFFINITY = {
    pyromaniac: ['fire'],       // Chef: single-typed gain Fire; Fire +2 Burn
    redhead: ['fire'],
    chemist: ['toxic'],
    swim_coach: ['water'],
    bug_catcher: ['bug'],
    musician: ['electric'],
  };

  function synergy(m, ctx) {
    const chips = [];
    let mult = 1.0;
    const types = (m.types || []).map(t => t.id);
    const teamMons = (ctx.team || []).filter(s => s && s.monsterId).map(s => monster(s.monsterId)).filter(Boolean);
    const teamTypes = teamMons.flatMap(tm => (tm.types || []).map(t => t.id));

    // trainer affinity
    const aff = TRAINER_TYPE_AFFINITY[ctx.trainerId];
    if (aff && aff.some(a => types.includes(a))) {
      if (ctx.trainerId === 'musician') {
        const electricCount = teamMons.filter(tm => (tm.types || []).some(t => t.id === 'electric')).length;
        if (electricCount === 0) { mult *= 1.35; chips.push('Musician: your ONE Electric carry (+150% Shock)'); }
        else { mult *= 0.55; chips.push('Musician wants EXACTLY 1 Electric — this breaks the bonus'); }
      } else {
        mult *= 1.22;
        chips.push(trainerName(ctx.trainerId) + ' synergy (' + aff.join('/') + ')');
      }
    }
    // Chef: single-typed monsters become Fire too
    if (ctx.trainerId === 'pyromaniac' && types.length === 1 && !types.includes('fire')) {
      mult *= 1.1;
      chips.push('Chef cooks it Fire (single-typed)');
    }

    // type stacking on team
    const shared = types.filter(ty => teamTypes.filter(x => x === ty).length >= 2);
    if (shared.length) { mult *= 1.08 + 0.03 * shared.length; chips.push('Type stack: ' + shared.join(', ')); }

    // status archetypes
    const abT = ((m.ability && JSON.stringify(m.ability)) || '').toLowerCase();
    const teamAb = teamMons.map(tm => ((tm.ability && JSON.stringify(tm.ability)) || '').toLowerCase()).join(' ');
    const teamHasStat = (key) => teamMons.some(tm => { const ld = levelData(tm, 1, false); return ld && stat(ld, key) > 0; });
    const hasStat = (key) => { const ld = levelData(m, 1, false); return ld && stat(ld, key) > 0; };

    if ((hasStat('poison') || abT.includes('poison')) && (teamHasStat('poison') || teamAb.includes('poison'))) {
      mult *= 1.12; chips.push('Poison package deepens');
    }
    if ((hasStat('burn') || abT.includes('burn')) && (teamHasStat('burn') || teamAb.includes('burn'))) {
      mult *= 1.1; chips.push('Burn package deepens');
    }
    if (hasStat('shock') && teamMons.length >= 2) {
      const dps = teamHitRate(ctx.team, ctx.day);
      if (dps > 1.3) { mult *= 1.12; chips.push('Shock amplifies your fast attackers'); }
    }
    // charge engines want electric / specific targets
    if (abT.includes('charge') && abT.includes('electric') && teamTypes.includes('electric')) {
      mult *= 1.15; chips.push('Charges your Electric units');
    }
    // trigger-chain pieces want matching type neighbours
    if (abT.includes('trigger') && types.some(ty => teamTypes.includes(ty))) {
      mult *= 1.08; chips.push('Trigger chain has targets');
    }
    // item-scaling units under Shopkeeper / Berroon economy
    if (abT.includes('item') && (ctx.trainerId === 'shopkeeper' || teamMons.some(tm => tm.id === 'berroon' || tm.id === 'faebloom'))) {
      mult *= 1.15; chips.push('Item engine online');
    }
    return { mult, chips };
  }

  function trainerName(id) {
    const t = D().trainers.find(t => t.id === id);
    return t ? t.name : id;
  }
  function trinketDisplayName(id) {
    const t = D().trinkets.find(t => t.id === id);
    return t ? t.name : String(id).replace(/_/g, ' ');
  }

  // ---------- meta adjustments (patch-history informed; see guide.js sources) ----------
  const META_ADJ = (window.GUIDE && window.GUIDE.MONSTER_META_ADJ) || {};

  // ---------- shop pick scoring ----------
  function dayWeights(day) {
    if (day <= 2) return { now: 0.62, scale: 0.18, econ: 0.2 };
    if (day <= 4) return { now: 0.48, scale: 0.32, econ: 0.2 };
    if (day <= 6) return { now: 0.38, scale: 0.47, econ: 0.15 };
    if (day <= 8) return { now: 0.32, scale: 0.58, econ: 0.1 };
    return { now: 0.42, scale: 0.53, econ: 0.05 }; // championship push: need power ON BOARD
  }

  function scoreShop(offers, ctx) {
    // offers: [{monsterId, shiny, level}], ctx: {day, gold, trainerId, team, ownedCounts, badges}
    let w = dayWeights(ctx.day);
    // ENDGAME re-weighting: within ~3 wins of the 10-badge championship, a unit
    // bought now will NOT reach its L3/L4 ceiling before the run ends — so stop
    // paying for scaling/economy and buy IMMEDIATE board power. Redistributes the
    // scale+econ weight into `now` as winsLeft shrinks. Fixes "8/10 badges, day 12
    // → still advised a fresh tier-1 Mosslug". No-op when ctx.badges is absent
    // (older callers / selftests), so nothing else changes.
    const winsLeft = ctx.badges != null ? Math.max(10 - ctx.badges, 0) : null;
    if (winsLeft != null && winsLeft <= 3) {
      const k = winsLeft <= 1 ? 0.15 : winsLeft === 2 ? 0.35 : 0.6; // fraction of scale/econ weight that survives
      w = { now: w.now + (w.scale + w.econ) * (1 - k), scale: w.scale * k, econ: w.econ * k };
    }
    const rows = offers.map((o, idx) => {
      const m = monster(o.monsterId);
      if (!m) return null;
      const chips = [];

      // Merge modeling (3-copy rule, verified in-game 2026-07-23: "merge 3 is 3 lvl1 makes a
      // lvl2 up to lvl3"): THREE same-level copies combine into ONE of the next
      // level (3×L1→L2, 3×L2→L3) — two copies do NOT merge. So owning `owned`
      // copies + this buy = owned+1 copies, whose best single unit is L2 at 3+ and
      // L3 at 9+. Score the unit the purchase actually creates, not the raw L1 body.
      // Merging CAPS at L3 (Level 4 exists but only via level-up items).
      const owned = (ctx.ownedCounts && ctx.ownedCounts[m.id]) || 0;
      const nCopies = owned + 1;
      const mergeLevel = nCopies >= 9 ? 3 : nCopies >= 3 ? 2 : 1;
      let effLevel = Math.min(Math.max(o.level || 1, mergeLevel), 4);
      // Evolution: the merge result IS the evolved species (needs L3 = 9 copies).
      let effMon = m;
      const evoTarget = m.evolution && m.evolution.trigger === 'level' && m.evolution.targetId ? monster(m.evolution.targetId) : null;
      if (evoTarget && effLevel >= (m.evolution.level || 3)) {
        effMon = evoTarget;
        chips.push('Completes EVOLUTION → ' + evoTarget.name + ' at Level ' + effLevel);
      }
      if (owned === 1) chips.push('2nd copy — spare body (1 more 3-merges to Level 2)');
      else if (owned === 2) chips.push('3rd copy → 3-merges to Level 2 now');
      else if (owned >= 3) chips.push(nCopies >= 9 ? 'Completes Level 3 (9 copies)' : nCopies + ' copies → Level ' + effLevel);

      const pNow = power(effMon, effLevel, { shiny: o.shiny, day: ctx.day, team: ctx.team, trainerId: ctx.trainerId });
      const scaleMon = evoTarget || m;
      const p3 = power(scaleMon, 3, { shiny: o.shiny, day: Math.min(ctx.day + 3, 12), team: ctx.team, trainerId: ctx.trainerId });
      const p4 = power(scaleMon, 4, { shiny: o.shiny, day: Math.min(ctx.day + 5, 14), team: ctx.team, trainerId: ctx.trainerId });
      const syn = synergy(effMon, ctx);
      chips.push(...syn.chips);
      const notes = [...new Set([...pNow.notes])];

      // trainer mechanics that change effective PRICE
      const td = ctx.trainerData || {};
      let effCost = m.cost;
      const isBug = (m.types || []).some(t => t.id === 'bug');
      if (ctx.trainerId === 'bug_catcher' && !td.bugBought && isBug) {
        effCost = 0;
        chips.push(`FREE — first Bug this round ($${m.cost} → $0, Bug Catcher)`);
      }
      // held Coupon: −$5 on every monster this round — cheaper picks, better econ
      if (Array.isArray(ctx.heldItems) && ctx.heldItems.includes('coupon') && effCost > 0) {
        effCost = Math.max(effCost - 5, 0);
        chips.push(`Coupon held: $${m.cost} → $${effCost}`);
      }
      // Monster Ranger: the tracked species gets a free copy every 2 days — merge fuel
      if (ctx.trainerId === 'monster_ranger' && td.rangerMonId && (m.id === td.rangerMonId || effMon.id === td.rangerMonId)) {
        chips.push('Ranger target — free copy every 2 days keeps this merging');
      }

      // ON-BUY feeders on your board: buying their food type grows them permanently
      // (multipliers collected here, applied after `raw` is computed below)
      let feederMult = 1;
      {
        const offerTypes = (m.types || []).map(t => t.id);
        for (const slot of ctx.team || []) {
          if (!slot) continue;
          const f = ON_BUY_FEEDERS[slot.monsterId];
          if (f && offerTypes.includes(f.type)) {
            feederMult *= 1.08;
            chips.push(`Feeds ${monster(slot.monsterId).name}'s passive (${f.gain} on this buy)`);
          }
        }
        feederMult = Math.min(feederMult, 1.25);
        // the offer IS a feeder and the shop holds its food → buy it FIRST
        const asFeeder = ON_BUY_FEEDERS[m.id] || ON_BUY_FEEDERS[effMon.id];
        if (asFeeder && offers.some(o2 => o2 !== o && ((monster(o2.monsterId) || {}).types || []).some(t => t.id === asFeeder.type))) {
          feederMult *= 1.1;
          chips.push(`Buy FIRST — every later ${asFeeder.type} purchase feeds it (${asFeeder.gain})`);
        }
      }

      // scaling index: what this becomes if invested
      const scale = p3.total * 0.65 + p4.total * 0.35;
      // econ: value per dollar (avoid div by 0 for eggs)
      const econ = pNow.total / Math.max(effCost || 10, 5);

      // endgame: a FRESH unit (owned 0) delivers almost none of its ramping-ability
      // value in the ~winsLeft fights that remain — a "+X Damage per cast" self-
      // scaler (Mosslug) or a heal/scale piece is mostly potential you won't cash.
      // Score it on IMMEDIATE output by discounting the ability-bonus slice of pNow.
      // (Merges/owned copies keep it — they're already ramping on the board.)
      let effNow = pNow.total, scaleMul = 0.45;
      if (winsLeft != null && winsLeft <= 2 && owned === 0) {
        effNow = pNow.total - (pNow.parts.ability || 0) * 0.7; // ability ramp won't cash in time
        scaleMul = 0.45 * 0.25; // a fresh unit won't reach its L3/L4 ceiling in the fights left
      }
      // ATTAINABILITY: `scale` prices the L2/L3 ceiling, but you only reach it if
      // you can BUILD the unit there. Under the 3-copy merge rule reaching L2 needs
      // 3 copies total (this buy + 2 more), L3 needs 9 — harder than the old 2-copy
      // assumption. Finding that many of a RARE unit is unlikely, so a tier-5 you own
      // 0 of almost never reaches its ceiling. Discount `scale` by how findable the
      // remaining copies are (tier odds). owned≥2 (this buy 3-merges to L2 NOW) =
      // fully attainable. Doesn't touch immediate output (now) or combo value.
      const tierOdds = [1, 0.9, 0.72, 0.5, 0.3, 0.16][Math.min((m.tier || 1) - 1, 5)] || 0.3;
      const attain = owned >= 2 ? 1 : Math.pow(tierOdds, Math.max(2 - owned, 0) * 0.7);
      let raw = w.now * effNow + w.scale * scale * scaleMul * attain + w.econ * econ * 18;
      if (attain < 0.5 && scale > pNow.total * 2) notes.push('ceiling discounted — hard to build to L3/L4');
      if (effCost === 0 && m.cost > 0) raw *= 1.18; // free tempo is real tempo
      if (ctx.trainerId === 'monster_ranger' && td.rangerMonId && (m.id === td.rangerMonId || effMon.id === td.rangerMonId)) raw *= 1.15;

      // merge tempo: a copy that 3-merges to a higher level THIS turn beats
      // equivalent stats later. A lone 2nd copy only adds a spare body + merge
      // progress (small nudge); the 3rd copy actually levels up (real tempo).
      if (owned === 1) raw *= 1.05;
      else if (owned === 2) raw *= 1.18;
      else if (owned >= 3) raw *= 1.2;

      // apply on-buy feeder value collected above
      raw *= feederMult;

      // shiny
      if (o.shiny) { raw *= 1.32; chips.push('SHINY: ~+20% stats' + (m.shinyAbility ? ' + upgraded ability' : '') + ' + Batopedia Star'); }

      // evolution potential (victory chain = huge lategame)
      if (m.evolution && m.evolution.trigger === 'victory') { raw *= 1.12; chips.push('Victory evolution line (→ ' + (m.evolution.targetId || '') + ')'); }

      // synergy multiplier
      raw *= syn.mult;

      // meta adjustment (use the unit the purchase produces)
      const adj = META_ADJ[effMon.id] || META_ADJ[m.id];
      if (adj) { raw *= adj.mult; if (adj.note) chips.push(adj.note); }

      // composition plan: pieces of the user's chosen build get hunted
      if (ctx.compIds && (ctx.compIds.has(m.id) || ctx.compIds.has(effMon.id))) {
        raw *= 1.25;
        chips.unshift('🎯 Comp piece — your run plan');
      }
      // adopted STRATEGY: its pieces and its food get hunted too
      if (ctx.stratIds && (ctx.stratIds.has(m.id) || ctx.stratIds.has(effMon.id))) {
        raw *= 1.35;
        chips.unshift('♟️ Strategy piece — your adopted play');
      } else if (ctx.stratTypes && (m.types || []).some(t => ctx.stratTypes.has(t.id))) {
        raw *= 1.2;
        chips.unshift('♟️ Strategy food — feeds your adopted play');
      }

      // REAL Master-tier data (from top-player run histories, if crawled).
      // Evidence is COLLECTED here as terms and applied ADDITIVELY in a second
      // pass scaled to the roster's top raw score — so strong measured signals
      // can actually re-rank offers instead of nudging a bad model score by 10%.
      const SY = window.SYNERGY;
      const real = { wr: 0, combo: 0, trainer: 0, trinket: 0 };
      if (SY && SY.monsters) {
        const rs = SY.monsters[effMon.id] || SY.monsters[m.id];
        const g = (SY.sample && SY.sample.globalRoundWR) || 66; // par WR — match app.js's fallback so the WR delta baseline is consistent cross-module
        if (rs && rs.rounds >= 80) {
          const conf = Math.min(rs.rounds / 300, 1);
          // prefer the win rate around the current day window when sampled enough
          let wr = rs.winRate;
          const dayKey = String(Math.min(ctx.day, 15));
          if (rs.byDay && rs.byDay[dayKey] && rs.byDay[dayKey].rounds >= 40) wr = (rs.byDay[dayKey].winRate + wr) / 2;
          real.wr = Math.max(-0.2, Math.min(0.25, (wr - g) / 100)) * conf;
          chips.push(`Real Master data: ${wr.toFixed(1)}% round WR · ${rs.pickRate}% of top runs (${rs.rounds.toLocaleString()} rounds)`);
        }
        // proven pairs with current board (supports old {a,b} and new {ids:[..]} shapes)
        const pairsArr = (SY.combos && SY.combos['2']) || SY.pairs;
        if (pairsArr && ctx.team) {
          const teamIds = new Set(ctx.team.filter(s => s && s.monsterId).map(s => s.monsterId));
          let best = null;
          for (const p of pairsArr) {
            const [pa, pb] = p.ids || [p.a, p.b];
            const other = pa === effMon.id ? pb : pb === effMon.id ? pa : null;
            if (other && teamIds.has(other) && (!best || p.winRate > best.winRate)) best = { ...p, other };
          }
          if (best) {
            real.combo = Math.max(real.combo, Math.max(-0.1, Math.min(0.3, best.lift / 100)) * Math.min(best.rounds / 120, 1));
            const otherName = (monster(best.other) || {}).name || best.other;
            chips.push(`Proven pair with ${otherName}: ${best.winRate}% WR (${best.lift >= 0 ? '+' : ''}${best.lift}pp lift, ${best.rounds} rounds)`);
          }
        }
        // proven larger combos: if 2+ team members complete a known trio/quad with this pick
        if (SY.combos && ctx.team) {
          const teamIds = new Set(ctx.team.filter(s => s && s.monsterId).map(s => s.monsterId));
          let bestCombo = null;
          for (const k of ['3', '4']) {
            for (const c of SY.combos[k] || []) {
              if (!c.ids.includes(effMon.id)) continue;
              if (c.ids.filter(id => id !== effMon.id).every(id => teamIds.has(id))) {
                if (!bestCombo || c.winRate > bestCombo.winRate) bestCombo = c;
              }
            }
          }
          if (bestCombo) {
            real.combo = Math.max(real.combo, Math.max(-0.1, Math.min(0.35, bestCombo.lift / 100)) * Math.min(bestCombo.rounds / 100, 1) * 1.15);
            const others = bestCombo.ids.filter(id => id !== effMon.id).map(id => (monster(id) || { name: id }).name).join(' + ');
            chips.push(`Completes a proven ${bestCombo.ids.length}-combo with ${others}: ${bestCombo.winRate}% WR (${bestCombo.rounds} rounds)`);
          }
        }
        // trainer-specific real data: best trainer+combo this pick completes with the current board
        if (SY.trainerCombos && ctx.trainerId && ctx.team) {
          const teamIds = new Set(ctx.team.filter(s => s && s.monsterId).map(s => s.monsterId));
          let bestTC = null;
          for (const k of ['3', '2', '1']) {
            for (const c of SY.trainerCombos[k] || []) {
              if (c.trainer !== ctx.trainerId || !c.ids.includes(effMon.id)) continue;
              if (c.ids.filter(id => id !== effMon.id).every(id => teamIds.has(id))) {
                if (!bestTC || c.winRate > bestTC.winRate) bestTC = c;
              }
            }
            if (bestTC) break; // prefer the deepest combo size that matches
          }
          if (bestTC) {
            real.trainer = Math.max(-0.08, Math.min(0.25, bestTC.lift / 100)) * Math.min(bestTC.rounds / 80, 1);
            const label = bestTC.ids.length > 1
              ? `${trainerName(ctx.trainerId)} + ${bestTC.ids.map(id => (monster(id) || { name: id }).name).join(' + ')}`
              : `With ${trainerName(ctx.trainerId)} at top ranks`;
            chips.push(`${label}: ${bestTC.winRate}% WR (${bestTC.lift >= 0 ? '+' : ''}${bestTC.lift}pp trainer lift, ${bestTC.rounds} rounds)`);
          }
        } else if (SY.trainerMon && ctx.trainerId) {
          const tm = SY.trainerMon.find(x => x.trainer === ctx.trainerId && (x.monster === effMon.id || x.monster === m.id));
          if (tm) chips.push(`With ${trainerName(ctx.trainerId)} at top ranks: ${tm.winRate}% WR (${tm.rounds} rounds)`);
        }
        // owned-trinket real data: does a trinket you HOLD pair with this pick?
        if (SY.trinketCombos && Array.isArray(ctx.trinkets) && ctx.trinkets.length) {
          const teamIds3 = new Set((ctx.team || []).filter(s => s && s.monsterId).map(s => s.monsterId));
          let bestTK = null;
          for (const k of ['2', '1']) {
            for (const c of SY.trinketCombos[k] || []) {
              if (!ctx.trinkets.includes(c.trinket) || !c.ids.includes(effMon.id)) continue;
              if (c.ids.filter(x => x !== effMon.id).every(x => teamIds3.has(x))) {
                if (!bestTK || c.winRate > bestTK.winRate) bestTK = c;
              }
            }
            if (bestTK) break;
          }
          if (bestTK) {
            real.trinket = Math.max(-0.06, Math.min(0.2, bestTK.lift / 100)) * Math.min(bestTK.rounds / 80, 1);
            chips.push(`Your ${trinketDisplayName(bestTK.trinket)} + this pick: ${bestTK.winRate}% WR (${bestTK.lift >= 0 ? '+' : ''}${bestTK.lift}pp, ${bestTK.rounds} rounds)`);
          }
        }
      }

      // affordability (uses trainer-adjusted effective cost)
      let affordable = true;
      if (ctx.gold != null && effCost > ctx.gold) { affordable = false; raw *= 0.25; chips.unshift('Cannot afford ($' + effCost + ' > $' + ctx.gold + ')'); }

      // availability sanity
      const tags = Array.isArray(m.tags) ? m.tags : [];
      if (tags.includes('UNAVAILABLE')) { chips.unshift('Not in normal shop pool'); }

      return { idx, m, effId: effMon.id, offer: o, raw, real, chips, notes, pNow, scale, econ, affordable };
    }).filter(Boolean);

    // Second pass: apply real-data evidence additively, scaled to the roster's
    // top model score. Coefficients weight evidence quality: direct WR > combo
    // completion > trainer fit > trinket fit. This lets measured 90%-WR combo
    // completions re-rank support units the DPS model undervalues.
    const preMax = Math.max(...rows.map(r => r.raw), 0.001);
    rows.forEach(r => {
      const e = r.real || {};
      const bonus = preMax * ((e.wr || 0) * 1.2 + (e.combo || 0) * 1.0 + (e.trainer || 0) * 0.7 + (e.trinket || 0) * 0.55);
      r.raw = Math.max(r.raw + bonus, r.raw * 0.4);
    });
    // The player's DECLARED intent must LEAD the buy order — a ×-boost alone
    // can't lift a support/enabler over a carry that real-data WR inflates, so
    // we FLOOR declared pieces above the field, tie-broken by their own raw.
    // Priority: adopted strategy piece > comp/run-plan piece > everything else.
    // (Observed: an obvious comp piece like Magmalith was ranking #4 behind
    // flat-stat/WR picks — the run plan is the point, it should be #1.)
    const fieldMax = Math.max(...rows.map(r => r.raw), 0.001);
    const isStrat = (r) => ctx.stratIds && (ctx.stratIds.has(r.m.id) || (r.effId && ctx.stratIds.has(r.effId)));
    const isComp = (r) => ctx.compIds && (ctx.compIds.has(r.m.id) || (r.effId && ctx.compIds.has(r.effId)));
    rows.forEach(r => {
      if (isStrat(r)) r.raw = Math.max(r.raw, fieldMax * 1.08 + r.raw * 0.02);
      else if (isComp(r)) r.raw = Math.max(r.raw, fieldMax * 1.0 + r.raw * 0.02);
    });
    // Keep unaffordable rows below buyable ones WITHOUT flattening their
    // ordering: a hard per-row clamp tied every strong row at the ceiling,
    // so strategy boosts (♟️ ×1.35) vanished whenever the whole shop was
    // out of budget. Squash them proportionally under preMax*0.3 instead.
    const unaffMax = Math.max(...rows.filter(r => !r.affordable).map(r => r.raw), 0);
    if (unaffMax > preMax * 0.3) {
      const squash = (preMax * 0.3) / unaffMax;
      rows.forEach(r => { if (!r.affordable) r.raw *= squash; });
    }

    // Normalize against the best AFFORDABLE-or-model score: if nothing is
    // affordable, anchor at the pre-cap max so capped rows read ≤~30% instead
    // of everything inflating to a meaningless 100%.
    const anyAffordable = rows.some(r => r.affordable);
    const max = Math.max(...rows.map(r => r.raw), anyAffordable ? 0.001 : preMax, 0.001);
    const avg = rows.reduce((a, r) => a + r.raw, 0) / Math.max(rows.length, 1);
    rows.forEach(r => {
      r.pct = Math.round((r.raw / max) * 100);
      r.vsAvg = avg > 0 ? Math.round(((r.raw - avg) / avg) * 100) : 0;
    });
    rows.sort((a, b) => b.raw - a.raw);

    // reroll advice: compare best offer to a day-baseline expectation
    const base = baselineForDay(ctx);
    const best = rows[0];
    let reroll = null;
    if (best && best.raw < base * 0.75) {
      reroll = 'Weak shop for day ' + ctx.day + ' — reroll if you have free rerolls or spare gold.';
    } else if (best && best.raw > base * 1.3) {
      reroll = 'Strong shop — buy the top pick before rerolling anything.';
    }
    return { rows, reroll, baseline: base };
  }

  let _baseCache = {};
  function baselineForDay(ctx) {
    const key = ctx.day + '|' + (ctx.trainerId || '');
    if (_baseCache[key]) return _baseCache[key];
    const pool = D().monsters.filter(m => !(Array.isArray(m.tags) && (m.tags.includes('UNAVAILABLE') || m.tags.includes('SECRET'))) && !m.isEvolvedForm && m.cost > 0);
    // approximate what tiers the shop offers by day
    const maxTier = ctx.day <= 2 ? 2 : ctx.day <= 4 ? 3 : ctx.day <= 6 ? 4 : ctx.day <= 8 ? 5 : 6;
    const eligible = pool.filter(m => m.tier <= maxTier);
    const vals = eligible.map(m => {
      const p = power(m, 1, { day: ctx.day });
      const w = dayWeights(ctx.day);
      const p3 = power(m, 3, { day: Math.min(ctx.day + 3, 12) });
      return w.now * p.total + w.scale * (p3.total * 0.65) * 0.45 + w.econ * (p.total / Math.max(m.cost, 5)) * 18;
    }).sort((a, b) => a - b);
    const med = vals[Math.floor(vals.length / 2)] || 1;
    _baseCache[key] = med;
    return med;
  }

  // ---------- monster tier list (phase-based) ----------
  function tierList(phaseName) {
    const day = phaseName === 'early' ? 2 : phaseName === 'mid' ? 5 : 9;
    const lvl = phaseName === 'early' ? 1 : phaseName === 'mid' ? 2 : 3;
    const pool = D().monsters.filter(m => !m.isEvolvedForm);
    const rows = pool.map(m => {
      const tags = Array.isArray(m.tags) ? m.tags : [];
      const unavailable = tags.includes('UNAVAILABLE') || tags.includes('SECRET');
      const p = power(m, lvl, { day });
      const p4 = power(m, 4, { day: day + 4 });
      let v = p.total + p4.total * (phaseName === 'late' ? 0.5 : 0.22);
      const adj = META_ADJ[m.id];
      if (adj) v *= adj.mult;
      // cost-effectiveness matters early
      if (phaseName === 'early') v = v * (14 / Math.max(m.cost, 8));
      // tier availability by phase
      if (phaseName === 'early' && m.tier > 3) v *= 0.3;
      if (phaseName === 'mid' && m.tier > 4) v *= 0.6;
      return { m, v, unavailable, notes: p.notes };
    });
    const avail = rows.filter(r => !r.unavailable);
    avail.sort((a, b) => b.v - a.v);
    const n = avail.length;
    avail.forEach((r, i) => {
      const q = i / n;
      r.band = q < 0.1 ? 'S' : q < 0.28 ? 'A' : q < 0.55 ? 'B' : q < 0.8 ? 'C' : 'D';
    });
    return { rows: avail, hidden: rows.filter(r => r.unavailable) };
  }

  // trainer & trinket tier lists come straight from real data
  function trainerTiers() {
    const t = D().trainers.filter(t => t.stats).slice();
    t.sort((a, b) => b.stats.winRate - a.stats.winRate);
    t.forEach(tr => {
      const wr = tr.stats.winRate;
      tr.band = wr >= 57 ? 'S' : wr >= 54 ? 'A' : wr >= 52 ? 'B' : wr >= 50 ? 'C' : 'D';
    });
    return t;
  }
  function trinketTiers() {
    const t = D().trinkets.filter(t => t.stats).slice();
    t.sort((a, b) => b.stats.winRate - a.stats.winRate);
    t.forEach(tr => {
      const wr = tr.stats.winRate;
      tr.band = wr >= 66 ? 'S' : wr >= 60 ? 'A' : wr >= 55 ? 'B' : wr >= 51 ? 'C' : 'D';
    });
    return t;
  }

  // trinket gift advisor: rank a set of offered trinkets by real WR (+context nudges)
  function scoreTrinkets(ids, ctx) {
    const rows = ids.map(id => {
      const t = D().trinkets.find(x => x.id === id);
      if (!t) return null;
      let v = t.stats ? t.stats.winRate : 50;
      const chips = [];
      if (t.stats) chips.push('Real win rate: ' + t.stats.winRate + '% · picked ' + t.stats.pickRate + '%');
      else chips.push('No ranked data');
      const desc = (t.description || '').toLowerCase();
      if (ctx && ctx.day <= 4 && /at the start of each day, gain \$/.test(desc)) { v += 3; chips.push('Economy compounds — better early'); }
      if (ctx && ctx.day >= 8 && /gain \$\d+\./.test(desc) && desc.includes('start of each day')) { v -= 2; chips.push('Less time for gold to compound'); }
      if (ctx && ctx.day >= 7 && desc.includes('shop')) chips.push('Late shops are high-rarity — shop mods hit harder');
      return { t, v, chips };
    }).filter(Boolean);
    rows.sort((a, b) => b.v - a.v);
    const max = Math.max(...rows.map(r => r.v), 1);
    rows.forEach(r => (r.pct = Math.round((r.v / max) * 100)));
    return rows;
  }

  // ================= EVENT-BASED COMBAT SIMULATOR =================
  // Discrete-time battle engine (architecture per twanvl's HSBG simulator:
  // step loop + explicit state; per PoB: pure inputs → full breakdown out).
  // Batomon facts honored: shared TEAM HP pools (units never die mid-fight),
  // casts land at t = cd, 2cd, … (first cast NOT at 0), multicast = N hits per
  // cast, burn ticks every 0.5s then decays 1 stack, poison ticks every 1s and
  // never decays, shock: every direct hit deals +stacks flat bonus (stacks never
  // decay), shields absorb (status damage pierces 25% of shield efficiency).
  // Dynamic donor events modeled DISCRETELY (the whole point vs closed-form):
  //   cds    → +rate% permanent cooldown-speed to the receiver PER CAST
  //   charge → advance receiver's next cast by amt seconds
  //   feed   → +amt burn/poison/heal per cast, permanent, to the receiver
  //   trigger→ force the receiver to cast (depth-capped)
  // Static donor kinds (auras, amps, mirrors, multicast) must be pre-baked
  // into the unit specs by the caller (they're rate multipliers, not events).
  //
  // spec: { cd, mc, dmg, heal, shield, burn, poison, shock,   // per-CAST amounts (dmg is per single hit; hits = mc)
  //         donor: {kind, rate?, amt?, stat?, targetIdx}|null, // resolved target within own side (or -1)
  //         label }
  // Returns { tKill, tDie, duration, margin, winner, timeline: {casts, burnTicks}, perUnit: [{label, direct, status}] }
  function simEvents(specsA, specsB, hpA, hpB, opts) {
    const o = opts || {};
    const TMAX = o.tmax || 90, DT = 0.05, MIN_CD = 0.1; // 0.1s is the game's hard cooldown floor
    const mkSide = (specs, hp) => ({
      units: specs.map((s, i) => ({
        ...s, i, cds: 0, next: s.cd, // first cast at t = cd
        addBurn: 0, addPoison: 0, addHeal: 0, // feed accruals
        direct: 0, status: 0, casts: 0,
      })),
      hp, hp0: hp, shieldPool: 0,
      burn: 0, poison: 0, shock: 0, // stacks ON this side (applied by the enemy)
      nextBurnTick: 0.5, nextPoisonTick: 1.0,
      dead: -1,
    });
    const A = mkSide(specsA, hpA), B = mkSide(specsB, hpB);
    // Damage into a side: shields absorb before HP. Per the batodex wiki, status
    // damage (Burn/Poison/Shock) is REDUCED against shields — patch 0.8.5 softened
    // that reduction from 25% to 15%, so status now bites harder than it did.
    //
    // The old formula had this inverted AND over-punished shields: a 100 shield hit
    // by 100 status lost its whole pool *and* still leaked damage to HP. Correct
    // behaviour is the opposite — the incoming status is weakened, so a 100 shield
    // eats a 100 status hit with pool to spare and HP untouched. Poison was being
    // massively overrated against shield boards.
    const STATUS_SHIELD_REDUCTION = 0.15; // 0.8.5 (was 0.25)
    const dealTo = (side, amt, isStatus, attacker) => {
      if (side.dead >= 0 || amt <= 0) return;
      let rem = amt;
      if (side.shieldPool > 0) {
        // vs shields a status point only spends (1 - reduction) of the pool,
        // so the pool can eat more raw status damage than its face value.
        const perPoint = isStatus ? (1 - STATUS_SHIELD_REDUCTION) : 1;
        const canEat = side.shieldPool / perPoint;
        const eaten = Math.min(canEat, rem);
        side.shieldPool -= eaten * perPoint;
        rem -= eaten;
      }
      side.hp -= rem;
      if (attacker) { if (isStatus) attacker.status += amt; else attacker.direct += amt; }
    };
    const doCast = (me, foe, u, t, depth) => {
      u.casts++;
      const hits = Math.max(u.mc || 1, 1);
      const dmgPerHit = u.dmg || 0;
      for (let h = 0; h < hits; h++) {
        if (dmgPerHit > 0) {
          dealTo(foe, dmgPerHit, false, u);
          if (foe.shock > 0) dealTo(foe, foe.shock, false, u); // shock cashes on every direct hit
        }
      }
      // status applications (per cast, ×mc as in the closed-form model)
      if (u.burn + u.addBurn > 0) foe.burn += (u.burn + u.addBurn) * hits;
      if (u.poison + u.addPoison > 0) foe.poison += (u.poison + u.addPoison) * hits;
      if (u.shock > 0) foe.shock += u.shock * hits;
      if (u.heal + u.addHeal > 0) me.hp = Math.min(me.hp + (u.heal + u.addHeal) * hits, me.hp0);
      if (u.shield > 0) me.shieldPool += u.shield * hits;
      // dynamic donor event
      const d = u.donor;
      if (d && d.targetIdx >= 0) {
        const tgt = me.units[d.targetIdx];
        if (tgt) {
          if (d.kind === 'cds') { // permanent cooldown-speed, lands stepwise — remaining wait shrinks proportionally
            const oldInt = Math.max(tgt.cd / (1 + tgt.cds / 100), MIN_CD);
            tgt.cds += (d.rate || 0.04) * 100;
            const newInt = Math.max(tgt.cd / (1 + tgt.cds / 100), MIN_CD);
            tgt.next = t + Math.max((tgt.next - t) * (newInt / oldInt), 0.05);
          } else if (d.kind === 'charge') tgt.next = Math.max(tgt.next - (d.amt || 1), t + 0.05);
          else if (d.kind === 'feed') {
            if (d.stat === 'burn') tgt.addBurn += d.amt || 2;
            else if (d.stat === 'poison') tgt.addPoison += d.amt || 2;
            else if (d.stat === 'heal') tgt.addHeal += d.amt || 20;
          } else if (d.kind === 'trigger' && (depth || 0) < 1) doCast(me, foe, tgt, t, (depth || 0) + 1);
        }
      }
    };
    let t = 0;
    while (t < TMAX && A.dead < 0 && B.dead < 0) {
      t = Math.round((t + DT) * 1000) / 1000;
      for (const [me, foe] of [[A, B], [B, A]]) {
        for (const u of me.units) {
          while (u.next <= t + 1e-9 && me.dead < 0 && foe.dead < 0) {
            doCast(me, foe, u, u.next, 0);
            if (u.cdGrow) u.cd += u.cdGrow; // Draconarch: self-slowing cooldown, per cast
            // Wiki: "The minimum cooldown is 0.1s. Reducing the value below this is
            // possible, but has no effect." Nothing enforced that here, so a
            // CDS-stacked carry could cast faster than the game ever allows and the
            // sim overrated exactly the Boomagon-chain line the app recommends.
            u.next = u.once ? Infinity : u.next + Math.max(u.cd / (1 + u.cds / 100), MIN_CD); // self-KO: one cast then gone
            if (foe.hp <= 0 && foe.dead < 0) foe.dead = t;
          }
        }
        if (me.nextBurnTick <= t) { dealTo(me, me.burn, true, null); me.burn = Math.max(me.burn - 1, 0); me.nextBurnTick += 0.5; if (me.hp <= 0 && me.dead < 0) me.dead = t; }
        if (me.nextPoisonTick <= t) { dealTo(me, me.poison, true, null); me.nextPoisonTick += 1.0; if (me.hp <= 0 && me.dead < 0) me.dead = t; }
      }
    }
    // survivor's death time: EXTRAPOLATE from the damage rate they actually
    // absorbed (same semantics as the closed-form's independent kill clocks) —
    // a TMAX penalty would inflate margins absurdly on early resolutions.
    const extrap = (side) => {
      if (side.dead >= 0) return side.dead;
      const absorbed = side.hp0 - side.hp;
      const rate = absorbed / Math.max(t, 0.1);
      // CAP the extrapolation: a healer that offsets nearly all incoming damage
      // absorbs ~0 net over the fight → rate→0 → hp0/rate exploded tDie to 10^5 s,
      // which then blew EHP (= HP + heal·tDie) up to ~10^8. 4× the fight horizon
      // is "effectively unkillable" for margin/EHP purposes without the runaway.
      const CAP = TMAX * 4;
      return rate > 0.01 ? Math.min(side.hp0 / rate, CAP) : CAP;
    };
    const tKill = extrap(B);
    const tDie = extrap(A);
    const duration = Math.min(tKill, tDie, TMAX);
    const margin = Math.round(((tDie - tKill) / Math.max(duration, 1)) * 100);
    return {
      tKill, tDie, duration, margin, winner: tKill < tDie ? 'A' : tKill > tDie ? 'B' : 'tie',
      hpLeftA: Math.max(A.hp, 0), hpLeftB: Math.max(B.hp, 0),
      perUnit: A.units.map(u => ({ label: u.label, direct: Math.round(u.direct), status: Math.round(u.status), casts: u.casts })),
    };
  }

  return { monster, power, levelData, stat, abilityText, scoreShop, tierList, trainerTiers, trinketTiers, scoreTrinkets, phase, dayWeights, synergy, simEvents };
})();
