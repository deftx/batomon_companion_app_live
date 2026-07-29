/* Batomon Companion — UI */
(function () {
  const D = window.BATODEX, G = window.GUIDE, E = window.Engine;
  // 📦 RELEASE IDENTITY — this build's version, and where updates come from.
  // APP_VERSION is bumped at release time and compared against the PUBLIC repo's
  // version.json: older-but-supported → soft update banner; below `minSupported` →
  // hard block (the old build stops working and points at the download).
  const APP_VERSION = '2.1.0';
  const UPDATE_MANIFEST = 'https://raw.githubusercontent.com/deftx/batomon_companion_app_live/main/version.json';
  const DOWNLOAD_PAGE = 'https://github.com/deftx/batomon_companion_app_live';
  // ☕ support link. Empty = the button falls back to opening the Who am I tab.
  const COFFEE_URL = 'https://buymeacoffee.com/jonthegym';
  // 💬 contact shown on the Feedback tab so people can add/DM directly.
  const DISCORD_USERNAME = 'jonthegym';
  const FR = () => window.LANG && window.LANG.lang === 'fr' && G.FR;
  const GDAYS = () => (FR() ? G.FR.DAYS : G.DAYS);
  const GMECH = () => (FR() ? G.FR.MECHANICS : G.MECHANICS);
  const GNOTE = () => (FR() ? G.FR.DATA_NOTE : G.DATA_NOTE);
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const spr = (p) => (p || '').replace(/^\//, '');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rarColor = (m) => (m.rarity && m.rarity.color) || '#70707a';
  const rarLabel = (m) => (m.rarity && m.rarity.label) || ('Tier ' + m.tier);
  const typePills = (m) => (m.types || []).map(t => `<span class="pill type" style="background:${t.color}">${esc(t.name)}</span>`).join(' ');
  // Units removed from the game (tagged UNAVAILABLE on batodex) are filtered
  // out of the entire app: pickers, dex, tier lists, and all synergy data.
  // SECRET units (MissingN. via the ??? trainer) remain — they are obtainable.
  const REMOVED_IDS = new Set(D.monsters.filter(m => Array.isArray(m.tags) && m.tags.includes('UNAVAILABLE')).map(m => m.id));
  const monsters = D.monsters.filter(m => !REMOVED_IDS.has(m.id));
  const monById = Object.fromEntries(D.monsters.map(m => [m.id, m])); // keep all for name lookups
  // type id → {id,name,color}, harvested from every monster's types (for resolving
  // event-granted extra types, which the save stores as bare ids in `extra_types`).
  const TYPE_BY_ID = {};
  D.monsters.forEach(m => (m.types || []).forEach(t => { if (t && t.id && !TYPE_BY_ID[t.id]) TYPE_BY_ID[t.id] = t; }));
  // A slot's EFFECTIVE types = base species types + any event-granted `extraTypes`
  // (e.g. the "genius" event adding Electric to a unit). Per-INSTANCE, so it lives
  // on the slot, never on the shared species card / Batodex.
  function slotTypes(s) {
    const m = s && monById[s.monsterId]; if (!m) return [];
    const base = m.types || [];
    const ex = s.extraTypes;
    if (!ex || !ex.length) return base;
    const have = new Set(base.map(t => t.id));
    const add = ex.filter(id => !have.has(id)).map(id => TYPE_BY_ID[id] || { id, name: id.charAt(0).toUpperCase() + id.slice(1), color: '#8a93a8' });
    return add.length ? base.concat(add) : base;
  }
  // Effective monster for a slot: the shared species object UNCHANGED when there
  // are no extra types (identity preserved → zero behavior change for normal
  // units), else a shallow clone with merged types so trinkets/donors/synergies/
  // the sim all see the granted type through the one `unitOutput` chokepoint.
  function effMon(s) {
    const m = s && monById[s.monsterId]; if (!m) return m;
    if (!s.extraTypes || !s.extraTypes.length) return m;
    const t = slotTypes(s);
    return t === m.types ? m : Object.assign({}, m, { types: t });
  }
  const shopPool = monsters.filter(m => !(Array.isArray(m.tags) && m.tags.includes('SECRET')) && m.cost > 0);
  // Trinkets removed from the game but still present in old crawled runs.
  // Shady Contract: removed entirely in patch 0.8.0 (low-shop-rank bug farming).
  const REMOVED_TRINKETS = new Set(['shady_contract']);
  function pruneSynergy(SY) {
    if (!SY) return SY;
    const ok = (ids) => !ids.some(id => REMOVED_IDS.has(id));
    for (const id of REMOVED_IDS) delete (SY.monsters || {})[id];
    for (const k in SY.combos || {}) SY.combos[k] = SY.combos[k].filter(c => ok(c.ids));
    if (SY.combos && SY.combos['2']) SY.pairs = SY.combos['2'];
    for (const k in SY.trainerCombos || {}) SY.trainerCombos[k] = SY.trainerCombos[k].filter(c => ok(c.ids));
    for (const k in SY.trinketCombos || {}) SY.trinketCombos[k] = SY.trinketCombos[k].filter(c => ok(c.ids) && !REMOVED_TRINKETS.has(c.trinket));
    for (const k in SY.trinketSets || {}) SY.trinketSets[k] = SY.trinketSets[k].filter(s => !(s.ids || []).some(id => REMOVED_TRINKETS.has(id)));
    SY.trainerMon = (SY.trainerMon || []).filter(r => !REMOVED_IDS.has(r.monster));
    SY.trinketMon = (SY.trinketMon || []).filter(r => !REMOVED_IDS.has(r.monster) && !REMOVED_TRINKETS.has(r.trinket));
    for (const id of REMOVED_TRINKETS) delete (SY.trinketsHeld || {})[id]; // keyed by trinket id
    return SY;
  }
  // real-data helpers for board-context displays
  function bestBoardCombo(monId, boardIds) {
    const SY = window.SYNERGY;
    if (!SY || !SY.combos || !boardIds || !boardIds.size) return null;
    let best = null;
    for (const k of ['4', '3', '2']) {
      for (const c of SY.combos[k] || []) {
        if (!c.ids.includes(monId)) continue;
        if (c.ids.filter(x => x !== monId).every(x => boardIds.has(x))) {
          if (!best || c.winRate > best.winRate) best = c;
        }
      }
      if (best) break; // deepest matching combo wins
    }
    return best;
  }
  function bestBoardTrinketCombo(tkId, boardIds) {
    const SY = window.SYNERGY;
    if (!SY || !SY.trinketCombos || !boardIds || !boardIds.size) return null;
    let best = null;
    for (const k of ['3', '2', '1']) {
      for (const c of SY.trinketCombos[k] || []) {
        if (c.trinket !== tkId) continue;
        if (c.ids.every(x => boardIds.has(x))) { if (!best || c.winRate > best.winRate) best = c; }
      }
      if (best) break;
    }
    return best;
  }

  // ---------------- RUN-FIT: does this trinket match the run you're ACTUALLY
  // having? (design goal: not only rely on WR, but on the run you're having.) Each
  // trinket → an effect descriptor; fit is scored 0..1 against the LIVE board's
  // types, damage vectors and mechanics — so Fire Orb rockets up in a burn comp
  // and sinks on a shock board, regardless of its middling global win rate.
  const TRINKET_EFFECT = {
    rainbow_berry: { kind: 'perType' }, fancy_sword: { kind: 'perTrinket' },
    wood_sword: { kind: 'teamDmg' }, heros_sword: { kind: 'teamDmg' }, excalibur: { kind: 'teamDmg' },
    mysterious_gem: { kind: 'teamDmg' }, warhorn: { kind: 'teamDmg' }, metronome: { kind: 'teamDmg' },
    haste_orb: { kind: 'teamCds' },
    power_crown: { kind: 'topMid', carry: true }, winged_crown: { kind: 'topMid', carry: true },
    master_crown: { kind: 'topMid', carry: true }, haste_crown: { kind: 'topMid', carry: false },
    speed_crest: { kind: 'rightCol' },
    sapphire_amulet: { kind: 'recv', stat: 'heal' }, topaz_amulet: { kind: 'recv', stat: 'shield' },
    meteorite: { kind: 'noAbility' }, repeater_charm: { kind: 'obs' }, link_cable: { kind: 'adjacency' },
    zenith_stone: { kind: 'statGain' }, silver_watch: { kind: 'levelup' }, upgrade_disc: { kind: 'levelup' }, mega_upgrade_disc: { kind: 'levelup' },
    training_weights: { kind: 'hp' }, barbell: { kind: 'hp' }, mysterious_charm: { kind: 'hp' }, dryads_charm: { kind: 'hp' },
    gold_nugget: { kind: 'econ' }, gold_bar: { kind: 'econ' }, gold_o_matic: { kind: 'econ' }, piggy_bank: { kind: 'econ' },
    holy_grail: { kind: 'econ' }, gold_trophy: { kind: 'econ' }, power_pouch: { kind: 'tempo' }, membership_card: { kind: 'tempo' }, echo_bell: { kind: 'tempo' },
    market_license: { kind: 'shop' }, research_notes: { kind: 'shop' }, mystic_incense: { kind: 'shop' }, vip_pass: { kind: 'shop' }, rainbow_pearl: { kind: 'shop' },
    // shop buffs are NOT interchangeable — +200 Dmg (Legendary) vs +5% CDS (Common)
    // is ~40× the magnitude. `power` scales the fit; Master players report an early
    // Mighty Bell "basically guarantees a 10-win run" (Steam meta thread, 2026-07).
    quick_bell: { kind: 'shopBuff', power: 0.18 }, power_bell: { kind: 'shopBuff', power: 0.45 },
    blitz_bell: { kind: 'shopBuff', power: 0.42 }, mighty_bell: { kind: 'shopBuff', power: 1 },
    bug_net: { kind: 'shopType', type: 'bug' }, power_band: { kind: 'tempo' },
    mini_duplicator: { kind: 'gift' }, mega_duplicator: { kind: 'gift' }, ultra_duplicator: { kind: 'gift' }, treasure_map: { kind: 'gift' },
    ancient_plume: { kind: 'other' }, mysterious_mask: { kind: 'other' },
  };
  function parseTrinketEffect(tk) {
    if (TRINKET_EFFECT[tk.id]) return TRINKET_EFFECT[tk.id];
    const d = (tk.description || '').toLowerCase();
    const m = d.match(/your (\w+) monsters have \+[\d.]+%?\s*(burn|poison|shock|multicast|damage|cooldown)?/);
    if (m) { const stat = m[2] === 'cooldown' ? 'cds' : m[2] === 'multicast' ? 'mc' : (m[2] || 'damage'); return { kind: 'typeStat', type: m[1], stat }; }
    return { kind: 'other' };
  }
  // rough status→damage equivalence so "what carries my board" is one number
  function vecShare(vec, k) {
    const off = (vec.dps || 0) + (vec.burnApp || 0) * 6 + (vec.poisonApp || 0) * 8 + (vec.shockApp || 0) * 4;
    if (k === 'heal' || k === 'shield') { const tot = off + (vec.heal || 0) + (vec.shield || 0) || 1; return (vec[k] || 0) / tot; }
    const map = { dps: vec.dps || 0, burn: (vec.burnApp || 0) * 6, poison: (vec.poisonApp || 0) * 8, shock: (vec.shockApp || 0) * 4 };
    return off > 0 ? (map[k] || 0) / off : 0;
  }
  let _fitProfileCache = null, _fitProfileKey = '';
  function boardFitProfile(board, day) {
    const key = board.map(s => s ? `${s.monsterId}${s.level}${s.shiny ? 's' : ''}${(s.extraTypes || []).join('')}` : '_').join(',') + '|' + day;
    if (_fitProfileKey === key && _fitProfileCache) return _fitProfileCache;
    const typeCounts = {}; let noAbility = 0, obs = 0, adjDonors = 0, gainers = 0;
    board.forEach(s => {
      if (!s) return;
      slotTypes(s).forEach(t => typeCounts[t.id] = (typeCounts[t.id] || 0) + 1);
      const m = monById[s.monsterId]; if (!m) return;
      if (!(m.ability && (m.ability.byLevel || m.ability.description))) noAbility++;
      if (m.ability && /battle start/i.test(m.ability.trigger || '')) obs++;
      const dn = donorFor(s.monsterId, s.shiny); if (dn && dn.dir === 'adjacent') adjDonors++;
      const abTxt = ((m.ability && (m.ability.description || (m.ability.byLevel && m.ability.byLevel['1']))) || '').toLowerCase();
      if (s.feed || /per cast|permanent|gain \+/.test(abTxt)) gainers++;
    });
    let vec = { dps: 0, heal: 0, shield: 0, burnApp: 0, poisonApp: 0, shockApp: 0 };
    try { const bo = boardOutputs(board, day, 12 + 3 * day); vec = { dps: bo.dps, heal: bo.heal, shield: bo.shield, burnApp: bo.burnApp, poisonApp: bo.poisonApp, shockApp: bo.shockApp }; } catch (e) {}
    _fitProfileKey = key;
    return (_fitProfileCache = { n: board.filter(Boolean).length || 1, typeCounts, uniqueTypes: Object.keys(typeCounts).length, vec, noAbility, obs, adjDonors, gainers, topMid: board[1], rightCol: [board[2], board[5]].filter(Boolean) });
  }
  // → { score: 0..1, why } — how much this trinket helps the board you're building.
  function trinketRunFit(tk, ctx) {
    ctx = ctx || {};
    const eff = parseTrinketEffect(tk);
    const P = boardFitProfile(ctx.board || live.board, ctx.day || live.day);
    const sat = (x, k) => Math.min((x || 0) / k, 1);
    const R = (score, why) => ({ score: Math.max(0, Math.min(1, score)), why });
    switch (eff.kind) {
      case 'typeStat': { const c = P.typeCounts[eff.type] || 0; return c ? R(0.35 + 0.55 * sat(c, 3), `${c} ${eff.type} unit${c > 1 ? 's' : ''} → its +${eff.stat} lands`) : R(0.04, `no ${eff.type} units — nearly dead weight`); }
      case 'perType': return R(0.3 + 0.5 * sat(P.uniqueTypes, 5), `${P.uniqueTypes} unique types on board`);
      case 'perTrinket': return R(0.3 + 0.5 * sat(ctx.ownedTrinkets, 5), `you hold ${ctx.ownedTrinkets || 0} trinkets`);
      case 'teamDmg': { const s = vecShare(P.vec, 'dps'); return R(0.45 + 0.4 * s, `direct damage is ${Math.round(s * 100)}% of your output`); }
      case 'teamCds': return R(0.7, 'faster casts help almost any board');
      case 'topMid': { const u = P.topMid; if (!u) return R(0.08, 'top-middle slot is EMPTY — seat a carry there first'); return R(eff.carry ? 0.85 : 0.62, `buffs your top-middle ${(monById[u.monsterId] || {}).name || 'unit'}`); }
      case 'rightCol': return R(P.rightCol.length ? 0.55 : 0.15, `${P.rightCol.length} unit(s) in the rightmost column`);
      case 'recv': { const s = vecShare(P.vec, eff.stat); return R(0.12 + 0.75 * s, s > 0.12 ? `your board ${eff.stat}s a lot — amplifies it` : `little ${eff.stat} on board`); }
      case 'noAbility': return R(0.1 + 0.28 * P.noAbility, `${P.noAbility} no-ability unit(s) gain +20 Dmg`);
      case 'obs': return R(0.1 + 0.28 * P.obs, `${P.obs} On-Battle-Start unit(s) re-fire`);
      case 'adjacency': return P.adjDonors ? R(0.5 + 0.25 * sat(P.adjDonors, 2), `${P.adjDonors} adjacency donor(s) → all count adjacent`) : R(0.13, 'no adjacency donors to exploit yet');
      case 'statGain': return R(0.2 + 0.6 * sat(P.gainers, 3), `${P.gainers} stat-gaining unit(s) → +80% gains`);
      case 'hp': return R(ctx.lives <= 2 ? 0.78 : ctx.lives <= 3 ? 0.5 : 0.3, ctx.lives <= 3 ? 'HP buys survival at low lives' : 'flat survivability');
      case 'shopType': { const c = P.typeCounts[eff.type] || 0; return R(c ? 0.5 : 0.25, c ? `you run ${c} ${eff.type} — cheaper buys` : `cheaper ${eff.type} buys`); }
      case 'econ': return R((ctx.day || 1) <= 6 ? 0.55 : 0.3, (ctx.day || 1) <= 6 ? 'econ compounds — early is best' : 'gold, but late to snowball');
      case 'tempo': return R(0.4, 'tempo / item value');
      case 'shopBuff': {
        // pays off on EVERY future buy → value = magnitude × how much run is left.
        // Mighty Bell early is a documented near-auto-win; Quick Bell is filler.
        const p = eff.power != null ? eff.power : 0.4;
        const left = Math.max(0, 1 - ((ctx.day || 1) - 1) / 12);
        return R(0.22 + 0.72 * p * (0.45 + 0.55 * left), `buffs every future shop buy · ${Math.round(left * 100)}% of the run still ahead`);
      }
      case 'shop': return R((ctx.day || 1) <= 8 ? 0.5 : 0.35, 'shop quality');
      case 'levelup': return R(0.45, 'accelerates leveling');
      case 'gift': return R(0.4, 'more trinket gifts downstream');
      default: return R(0.35, 'general value');
    }
  }

  // ---------------- LEARNED BUILDS: emergent archetypes mined from the whole run
  // corpus (community + your own history) by tools/discover_builds.js, plus YOUR
  // personal record with each. Lets discovered comps stand beside the curated ones.
  function discoveredBuilds() {
    const raw = (window.DISCOVERED && window.DISCOVERED.builds) || [];
    return raw.filter(b => (b.coreIds || []).some(id => monById[id] && !REMOVED_IDS.has(id)));
  }
  // shape a discovered build like a G.BUILDS entry so every plan consumer reads it
  function discAsGuide(b) {
    // shaped like a full G.BUILDS entry so BOTH the plan consumers AND openBuild()
    // can read it — all fields openBuild touches are present with safe defaults.
    return {
      id: b.id, name: b.name, core: b.coreIds.slice(0, 4), lateCore: b.coreIds.slice(4),
      trinkets: [], items: [], trainer: null, altTrainers: [], discovered: true, novelty: b.novelty, winRate: b.winRate,
      difficulty: b.phase ? b.phase + '-game peak' : 'data-derived', power: `${b.winRate}% WR`,
      lineup: { top: b.coreIds.slice(0, 3), bottom: b.coreIds.slice(3, 6) },
      dayplan: `Assemble the ${b.coreNames.slice(0, 3).join(' + ')} core, then round out with ${b.coreNames.slice(3).join(', ') || 'the late pieces'}. Peaks ${b.phase || 'mid–late'}-game.`,
      counters: 'Emergent comp — no curated counter notes yet; treat the win rate as a real-data prior, not a guarantee.',
      how: `Emergent ${b.novelty} archetype — mined from ${b.runs} winning runs (${b.winRate}% round WR, +${b.lift} lift over its pieces).${b.mapsTo ? ' Closest curated build: ' + b.mapsTo + '.' : ' Not in the curated build list.'}`,
    };
  }
  // unified plan lookup — curated builds first, then discovered. Curated ids are
  // 100% unchanged (fallback), so routing consumers through this is a no-op for them.
  function buildById(id) {
    if (!id) return null;
    const g = G.BUILDS.find(b => b.id === id); if (g) return g;
    const d = discoveredBuilds().find(b => b.id === id); return d ? discAsGuide(d) : null;
  }
  // Evolution-aware ownership: a plan piece counts as OWNED if you hold it OR any
  // monster it evolves INTO (Dribblet → Emperooze — you already evolved it, so
  // don't flag it missing or tell you to re-buy). Walks the chain (Ignit →
  // Flarilisk → Basilord). Returns { have, via } where via = the evolved id held.
  function ownsPieceOrEvo(id, ownedSet) {
    if (ownedSet.has(id)) return { have: true, via: null };
    let cur = monById[id], guard = 0;
    while (cur && cur.evolution && cur.evolution.targetId && guard++ < 6) {
      const t = cur.evolution.targetId;
      if (ownedSet.has(t)) return { have: true, via: t };
      cur = monById[t];
    }
    return { have: false, via: null };
  }
  // YOUR record with a set of core monsters — mines bc_runs (every archived run
  // since you started). A run "ran" the comp if it fielded ≥ half the core.
  function myRecordForCore(coreIds, runs) {
    const core = new Set(coreIds || []); if (!core.size) return null;
    runs = runs || loadRuns();
    const need = Math.max(2, Math.ceil(core.size / 2));
    let ran = 0, champ = 0, badges = 0, wins = 0, losses = 0;
    for (const r of runs) {
      const ids = new Set((r.finalBoard || []).map(b => b.id).concat((r.history || []).flatMap(h => (h.board || []).map(b => b.id))));
      if ([...core].filter(id => ids.has(id)).length < need) continue;
      ran++; badges += r.badges || 0; if ((r.badges || 0) >= 10) champ++;
      wins += r.wins || 0; losses += r.losses || 0;
    }
    return ran ? { ran, champ, avgBadges: +(badges / ran).toFixed(1), battleWR: (wins + losses) ? Math.round(wins / (wins + losses) * 100) : null } : null;
  }
  // 🧑 YOUR builds — cluster the FINAL BOARDS of your OWN archived runs into
  // archetypes: the personal mirror of the community discover_builds miner. Answers
  // the tier-transfer gap the Master corpus structurally can't — what actually works
  // for YOU, at your rank. Few runs → low thresholds (a 2-run cluster is an
  // archetype; a strong singleton still surfaces). Each is tagged KNOWN/VARIANT/NOVEL
  // vs the curated + community builds, so a comp you keep winning with that ISN'T in
  // any list stands out.
  const _cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function personalNovelty(coreIds) {
    const cs = new Set(coreIds);
    const jac = (A, B) => { let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
    let best = null, bestJ = 0, name = null;
    for (const gb of G.BUILDS) { const j = jac(cs, new Set((gb.core || []).concat(gb.lateCore || []))); if (j > bestJ) { bestJ = j; best = { id: gb.id }; name = gb.name; } }
    for (const db of discoveredBuilds()) { const j = jac(cs, new Set(db.coreIds || [])); if (j > bestJ) { bestJ = j; best = { id: db.id }; name = db.name; } }
    if (bestJ >= 0.55) return { tag: 'known', build: best, name, j: bestJ };
    if (bestJ >= 0.3) return { tag: 'variant', build: best, name, j: bestJ };
    return { tag: 'novel', build: null, name: null, j: bestJ };
  }
  function personalBuilds() {
    const runs = loadRuns().filter(r => (r.finalBoard || []).filter(b => b && b.id && monById[b.id]).length >= 3);
    if (runs.length < 2) return { builds: [], runs: runs.length };
    const digest = runs.map(r => ({
      board: [...new Set((r.finalBoard || []).filter(Boolean).map(b => b.id).filter(id => monById[id]))],
      badges: r.badges || 0, result: r.result, trainer: r.trainer,
      finalBoard: (r.finalBoard || []).filter(b => b && monById[b.id]),
    }));
    const jac = (a, b) => { const A = new Set(a), B = new Set(b); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i || 1); };
    const seen = new Array(digest.length).fill(false), out = [];
    for (let i = 0; i < digest.length; i++) {
      if (seen[i]) continue;
      seen[i] = true; const members = [digest[i]];
      for (let j = i + 1; j < digest.length; j++) if (!seen[j] && jac(digest[i].board, digest[j].board) >= 0.45) { seen[j] = true; members.push(digest[j]); }
      const freq = {}; members.forEach(m => m.board.forEach(id => (freq[id] = (freq[id] || 0) + 1)));
      const half = Math.max(1, Math.ceil(members.length / 2));
      let core = Object.entries(freq).filter(([, n]) => n >= half).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      if (core.length < 3) core = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0]);
      core = core.slice(0, 6);
      if (core.length < 3) continue;
      const champs = members.filter(m => m.badges >= 10).length, rankups = members.filter(m => m.badges >= 8).length;
      const tf = {}; members.forEach(m => { if (m.trainer) tf[m.trainer] = (tf[m.trainer] || 0) + 1; });
      const topT = (Object.entries(tf).sort((a, b) => b[1] - a[1])[0] || [null])[0];
      const tc = {}; core.forEach(id => ((monById[id] || {}).types || []).forEach(t => (tc[t.id] = (tc[t.id] || 0) + 1)));
      const types = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(e => e[1] >= 2).map(e => e[0]);
      const nov = personalNovelty(core);
      const nm = (id) => (monById[id] || {}).name || id;
      out.push({
        id: 'me_' + core.slice(0, 3).join('_'), source: 'personal',
        name: nov.tag === 'known' && nov.name ? nov.name : `${types.map(_cap1).join('·') || 'Hybrid'} — ${nm(core[0])} core`,
        coreIds: core, coreNames: core.map(nm), types,
        runs: members.length, avgBadges: +(members.reduce((a, m) => a + m.badges, 0) / members.length).toFixed(1),
        bestBadges: Math.max(...members.map(m => m.badges)), champs, rankups,
        champRate: Math.round((champs / members.length) * 100),
        trainer: topT, trainerName: topT ? (D.trainers.find(t => t.id === topT) || {}).name : null,
        novelty: nov.tag, mapsTo: nov.build ? nov.build.id : null, mapsToName: nov.name || null, overlap: +nov.j.toFixed(2),
        badgeTier: champs / members.length >= 0.5 ? 'champion' : rankups / members.length >= 0.5 ? 'rankup' : 'mixed',
        members: members.map(m => ({ badges: m.badges, result: m.result, board: m.finalBoard })),
      });
    }
    out.sort((a, b) => (b.avgBadges - a.avgBadges) || (b.runs - a.runs));
    return { builds: out, runs: runs.length };
  }
  // render the 🧑 YOUR builds block for the Discovered view (takes precomputed mine + NOV map)
  function personalBuildsSectionHTML(mine, boardIds, NOV) {
    if (!mine.builds.length) {
      return mine.runs >= 1
        ? `<div class="note" style="margin:0 0 10px">🧑 <b>Your builds</b> appear here once you have <b>≥2</b> archived runs with a full final board — you have <b>${mine.runs}</b> so far. Keep playing synced.</div>`
        : '';
    }
    const cards = mine.builds.map(b => {
      const nv = NOV[b.novelty] || NOV.novel;
      const owned = b.coreIds.filter(id => boardIds.has(id));
      const fit = Math.round((owned.length / b.coreIds.length) * 100);
      const sprites = b.coreIds.map(id => `<img class="sprite" src="${spr((monById[id] || {}).sprite || '')}" width="28" height="28" title="${esc((monById[id] || {}).name || id)}${owned.includes(id) ? ' — on your board ✓' : ''}" style="${owned.includes(id) ? 'outline:2px solid var(--green);border-radius:5px' : 'opacity:.82'}">`).join('');
      const tierPill = b.badgeTier === 'champion' ? `<span class="pill" style="color:var(--gold)" title="you reached 10+ badges with this in ${b.champs} of ${b.runs} runs">👑 ${b.champs}× champion</span>`
        : b.badgeTier === 'rankup' ? `<span class="pill" style="color:var(--green)" title="8+ badges (rank-up) in most of your runs with this">📈 rank-up</span>` : '';
      return `<div class="card" style="border-left:3px solid ${nv.color};padding:9px 12px">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <span class="chip" style="background:${nv.color};color:#0b0b10;font-weight:800;font-size:9px" title="${esc(nv.t)}">${nv.icon} ${nv.label}</span>
          <b style="font-size:13px">${esc(b.name)}</b>
          <span class="pill" title="average badges across your runs with this comp">avg <b>${b.avgBadges}</b>🏅</span>
          <span class="pill">best ${b.bestBadges}🏅</span>
          <span class="pill">${b.runs} run${b.runs > 1 ? 's' : ''}</span>
          ${tierPill}
          ${b.trainerName ? `<span class="pill" style="color:var(--muted)">🧑 ${esc(b.trainerName)}</span>` : ''}
          ${b.mapsTo ? `<span class="pill" style="color:var(--muted)" title="closest known build (${b.overlap} overlap)">≈ ${esc(b.mapsToName || b.mapsTo)}</span>` : ''}
        </div>
        <div style="display:flex;gap:3px;margin:8px 0;flex-wrap:wrap">${sprites}</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:11px">
          <span title="how much of this comp is on your board/bench right now">🧩 <b style="color:${fit >= 50 ? 'var(--green)' : 'var(--muted)'}">${fit}% on board</b> <span style="color:var(--muted)">(${owned.length}/${b.coreIds.length})</span></span>
          ${b.mapsTo
            ? `<button class="ghost mine-plan" data-id="${esc(b.mapsTo)}" style="margin-left:auto;font-size:10px;padding:3px 11px;${planIds().includes(b.mapsTo) ? 'border-color:var(--green);color:var(--green);font-weight:800' : ''}">${planIds().includes(b.mapsTo) ? '✓ planned' : '📐 Plan this'}</button>`
            : `<span style="margin-left:auto;color:var(--accent);font-size:10px" title="not in the curated or community lists — your own emergent comp">🧬 your own comp</span>`}
        </div>
      </div>`;
    }).join('');
    return `<div class="card" style="border-left:3px solid var(--gold);background:linear-gradient(180deg,rgba(240,196,64,.05),transparent);padding:11px 14px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px"><b style="font-size:14px">🧑 YOUR builds</b><span class="pill" style="color:var(--muted)">clustered from ${mine.runs} of your runs</span></div>
      <div class="note" style="margin:0 0 9px">Archetypes mined from the final boards of your <b>own</b> archived runs — what actually works at <b>your</b> rank (the Master corpus can't tell you that). <b style="color:var(--accent)">🧬 NOVEL</b> = a comp you keep winning with that isn't in any curated or community list.</div>
      <div style="display:flex;flex-direction:column;gap:8px">${cards}</div></div>`;
  }

  // ---------------- state ----------------
  const state = JSON.parse(localStorage.getItem('bc_state') || 'null') || {
    day: 3, gold: 30, trainerId: 'monster_ranger',
    team: [null, null, null, null, null, null], // 0-2 top row, 3-5 bottom row
    offers: [],
    items: [],
    bench: [null, null, null, null],
    trinkets: [],
    shopRank: null, // null = derived from day
    lives: 10,
  };
  if (!Array.isArray(state.items)) state.items = [];
  if (!Array.isArray(state.heldItems)) state.heldItems = []; // bought/granted, not used yet
  if (!Array.isArray(state.bench)) state.bench = [];
  while (state.bench.length < 4) state.bench.push(null);
  if (!Array.isArray(state.trinkets)) state.trinkets = [];
  if (!(state.lives >= 0)) state.lives = 10;
  const advRankOf = () => Math.min(Math.max(state.shopRank || state.day, 1), 14);
  function save() { localStorage.setItem('bc_state', JSON.stringify(state)); }

  // ---------------- tabs ----------------
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !b.dataset.tab) return; // ignore the collapse toggle
    document.querySelectorAll('#nav button[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    $('#tab-' + b.dataset.tab).classList.add('active');
    if (b.dataset.tab === 'profile') renderProfile(); // profile hosts the run history section
  });
  // ⬅ retractable sidebar — collapses to an emoji rail; choice persists across sessions
  (function () {
    const btn = $('#nav-toggle'); if (!btn) return;
    const apply = (collapsed) => {
      document.body.classList.toggle('nav-collapsed', collapsed);
      btn.textContent = collapsed ? '⟩⟩' : '⟨⟨ Collapse';
      btn.title = collapsed ? 'Expand the sidebar' : 'Collapse the sidebar';
      btn.setAttribute('aria-label', btn.title);
    };
    apply(localStorage.getItem('bc_navCollapsed') === '1');
    btn.onclick = () => {
      const now = !document.body.classList.contains('nav-collapsed');
      localStorage.setItem('bc_navCollapsed', now ? '1' : '0');
      apply(now);
    };
  })();

  // ---------------- modal ----------------
  const modalBg = $('#modal-bg'), modal = $('#modal');
  modalBg.addEventListener('click', (e) => { if (e.target === modalBg) closeModal(); });
  function openModal(html) { modal.innerHTML = ''; if (html instanceof Node) modal.appendChild(html); else modal.innerHTML = html; modalBg.classList.add('open'); }
  function closeModal() { modalBg.classList.remove('open'); }

  function monsterPicker(opts, onPick) {
    // opts: {title, allowClear, defaultLevel, defaultShiny, pool, boardIds, multi}
    // multi: clicking cells collects picks in a tray (duplicates allowed — shops
    // offer the same species twice); confirm returns the ARRAY to onPick.
    const box = el('div');
    box.appendChild(el('h3', null, esc(opts.title || 'Pick a Batomon')));
    const multiSel = [];
    const ctl = el('div', 'dex-controls');
    ctl.innerHTML = `
      <input type="text" id="pk-search" placeholder="Search…" style="flex:1;min-width:140px">
      <select id="pk-sort">
        <option value="rarity">Sort: Rarity ↑</option>
        <option value="wr">Sort: Real WR ↓</option>
        <option value="board">Sort: Board synergy ↓</option>
        <option value="cost">Sort: Cost ↓</option>
        <option value="name">Sort: Name A-Z</option>
      </select>
      <label class="ctl">Level<select id="pk-level">${[1, 2, 3, 4].map(l => `<option ${l === (opts.defaultLevel || 1) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="ctl">Shiny<select id="pk-shiny"><option value="no">No</option><option value="yes" ${opts.defaultShiny ? 'selected' : ''}>Yes ✨</option></select></label>
      ${opts.allowClear ? '<button class="ghost" id="pk-clear">Clear slot</button>' : ''}`;
    box.appendChild(ctl);
    let tray = null, trayBtn = null;
    if (opts.multi) {
      const trayWrap = el('div');
      trayWrap.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin:8px 0;flex-wrap:wrap">
        <div class="offers" id="pk-tray" style="flex:1;min-height:34px"></div>
        <button class="primary" id="pk-confirm" style="display:none"></button></div>`;
      box.appendChild(trayWrap);
      tray = $('#pk-tray', box);
      trayBtn = $('#pk-confirm', box);
      trayBtn.onclick = () => { if (multiSel.length) { onPick(multiSel.slice()); closeModal(); } };
    }
    function renderTray() {
      if (!tray) return;
      tray.innerHTML = multiSel.length ? '' : '<span class="note" style="margin:0;font-size:11px">Click monsters to stack them up (same one twice = duplicate offer), then confirm.</span>';
      multiSel.forEach((p, i) => {
        const m = monById[p.monsterId];
        const c = el('div', 'offer-chip' + (p.shiny ? ' shiny' : ''));
        c.innerHTML = `<img class="sprite" src="${spr(p.shiny && m.shinySprite ? m.shinySprite : m.sprite)}" style="width:26px;height:26px">
          <div style="font-size:11px;font-weight:700">${p.shiny ? '✨' : ''}${esc(m.name)} <span style="color:var(--muted)">L${p.level}</span></div><span class="x">×</span>`;
        c.querySelector('.x').onclick = () => { multiSel.splice(i, 1); renderTray(); };
        tray.appendChild(c);
      });
      trayBtn.style.display = multiSel.length ? '' : 'none';
      trayBtn.textContent = `✓ Add ${multiSel.length} offer${multiSel.length > 1 ? 's' : ''}`;
    }
    const grid = el('div', 'mon-grid');
    box.appendChild(grid);
    const pool = opts.pool || shopPool;
    const boardIds = opts.boardIds || null;
    const SYm = () => (window.SYNERGY && window.SYNERGY.monsters) || {};
    function render(q) {
      grid.innerHTML = '';
      const sort = $('#pk-sort', box).value;
      const rows = pool
        .filter(m => !q || m.name.toLowerCase().includes(q) || (m.types || []).some(t => t.id.includes(q)))
        .map(m => ({ m, rs: SYm()[m.id], combo: boardIds ? bestBoardCombo(m.id, boardIds) : null }));
      const sorters = {
        rarity: (a, b) => a.m.tier - b.m.tier || a.m.name.localeCompare(b.m.name),
        wr: (a, b) => ((b.rs || {}).winRate || -1) - ((a.rs || {}).winRate || -1),
        board: (a, b) => ((b.combo || {}).winRate || -1) - ((a.combo || {}).winRate || -1) || ((b.rs || {}).winRate || -1) - ((a.rs || {}).winRate || -1),
        cost: (a, b) => b.m.cost - a.m.cost,
        name: (a, b) => a.m.name.localeCompare(b.m.name),
      };
      rows.sort(sorters[sort] || sorters.rarity);
      rows.forEach(({ m, rs, combo }) => {
        const shiny = $('#pk-shiny', box).value === 'yes';
        const c = el('div', 'mon-cell' + (combo && combo.winRate >= 78 ? ' combo-glow' : ''));
        c.innerHTML = `<img class="sprite" src="${spr(shiny && m.shinySprite ? m.shinySprite : m.sprite)}" alt="">
          <div class="nm">${esc(m.name)}</div>
          <div class="tier" style="color:${rarColor(m)}">${esc(rarLabel(m))} · $${m.cost}</div>
          ${rs && rs.rounds >= 60 ? `<div style="font-size:10px">${wrSpan(rs.winRate)} WR</div>` : ''}
          ${combo ? `<div class="combo-hit" title="Best measured combo this completes with your current board (${combo.ids.map(id => (monById[id] || { name: id }).name).join(' + ')}, ${combo.rounds} rounds)">⚡ ${combo.winRate}% w/ board</div>` : ''}`;
        c.onclick = () => {
          const pick = { monsterId: m.id, level: +$('#pk-level', box).value, shiny: $('#pk-shiny', box).value === 'yes' };
          if (opts.multi) { multiSel.push(pick); renderTray(); c.classList.add('combo-glow'); setTimeout(() => c.classList.remove('combo-glow'), 350); }
          else { onPick(pick); closeModal(); }
        };
        grid.appendChild(c);
      });
    }
    ctl.addEventListener('input', () => render($('#pk-search', box).value.toLowerCase().trim()));
    if (opts.allowClear) $('#pk-clear', box).onclick = () => { onPick(null); closeModal(); };
    render('');
    if (opts.multi) renderTray();
    openModal(box);
    $('#pk-search', box).focus();
  }

  // ---------------- hover stat card + slot quick actions ----------------
  const hovercard = el('div'); hovercard.id = 'hovercard'; document.body.appendChild(hovercard);
  function hcShow(html, x, y) {
    hovercard.innerHTML = html;
    hovercard.style.display = 'block';
    const r = hovercard.getBoundingClientRect();
    hovercard.style.left = Math.min(Math.max(x + 16, 8), window.innerWidth - r.width - 12) + 'px';
    hovercard.style.top = Math.min(Math.max(y - r.height / 2, 8), window.innerHeight - r.height - 12) + 'px';
  }
  function hcHide() { hovercard.style.display = 'none'; }

  // ---- trinket stat modifiers (display + battle sim) ----
  // Keyed by trinket NAME (slug-proof). scope: team | type:<id> | topMid | rightCol | shop.
  const TRINKET_EFFECTS = {
    'Wood Sword': { scope: 'team', dmgFlat: 5 },
    "Hero's Sword": { scope: 'team', dmgFlat: 12 },
    'Excalibur': { scope: 'team', dmgFlat: 350 },
    'Mysterious Gem': { scope: 'team', dmgPct: 20 },
    'Fancy Sword': { scope: 'team', dmgPctPerTrinket: 3 },
    'Rainbow Berry': { scope: 'team', dmgFlatPerUniqueType: 4 },
    'Haste Orb': { scope: 'team', cdsPct: 15 },
    'Silver Watch': { scope: 'team', cdsPctPerLevel: 15 }, // +15% CDS per level-up → 15×(level−1)
    'Speed Crest': { scope: 'rightCol', cdsPct: 20 },
    'Power Crown': { scope: 'topMid', dmgFlat: 20 },
    'Haste Crown': { scope: 'topMid', cdsPct: 30 },
    'Winged Crown': { scope: 'topMid', mc: 1 },
    'Master Crown': { scope: 'topMid', statsPct: 80 },
    'Fire Orb': { scope: 'type:fire', burnFlat: 3 },
    'Poison Orb': { scope: 'type:toxic', poisonFlat: 3 },
    'Razor Beak': { scope: 'type:flying', mc: 1 },
    'Terrarium': { scope: 'type:bug', dmgPct: 20 },
    'Quick Bell': { scope: 'shop', cdsPct: 5 },
    'Blitz Bell': { scope: 'shop', cdsPct: 30 },
    'Power Bell': { scope: 'shop', dmgFlat: 25 },
    'Mighty Bell': { scope: 'shop', dmgFlat: 200 },
  };
  // Aggregate held-trinket modifiers for one unit. idx = board slot (null for shop entries).
  function unitMods(m, idx, opts) {
    const o = opts || {};
    const mods = { dmgFlat: 0, dmgPct: 0, cdsPct: 0, burnFlat: 0, poisonFlat: 0, mc: 0, statsPct: 0, sources: [] };
    if (!m) return mods;
    const types = (m.types || []).map(t => t.id);
    // Chef converts single-typed non-Fire units to Fire — so type-scoped trinkets
    // (Fire Orb +3 Burn, etc.) apply to them in-game. Add the converted type here
    // or they'd be missed (this is the Boomagon "Burn 5" = base 0 + Chef 2 + Fire
    // Orb 3 case). Only for owned/board units, matching in-game conversion.
    if (!o.isShop) { const cf = chefInfo(m); if (cf && cf.isFire && !types.includes('fire')) types.push('fire'); }
    const heldNames = live.trinkets.map(id => (D.trinkets.find(t => t.id === id) || {}).name).filter(Boolean);
    const uniqueTypes = new Set(live.board.filter(s => s).flatMap(s => slotTypes(s).map(t => t.id))).size;
    for (const name of heldNames) {
      const fx = TRINKET_EFFECTS[name];
      if (!fx) continue;
      const applies =
        (fx.scope === 'team' && !o.isShop) ||
        (fx.scope === 'shop' && o.isShop) ||
        (fx.scope === 'topMid' && idx === 1) ||
        (fx.scope === 'rightCol' && idx != null && idx % 3 === 2) ||
        (fx.scope.startsWith('type:') && !o.isShop && types.includes(fx.scope.slice(5)));
      if (!applies) continue;
      let touched = false;
      if (fx.dmgFlat) { mods.dmgFlat += fx.dmgFlat; touched = true; }
      if (fx.dmgPct) { mods.dmgPct += fx.dmgPct; touched = true; }
      if (fx.dmgPctPerTrinket) { mods.dmgPct += fx.dmgPctPerTrinket * live.trinkets.length; touched = true; }
      if (fx.dmgFlatPerUniqueType) { mods.dmgFlat += fx.dmgFlatPerUniqueType * uniqueTypes; touched = true; }
      if (fx.cdsPct) { mods.cdsPct += fx.cdsPct; touched = true; }
      if (fx.cdsPctPerLevel && (o.level || 1) > 1) { mods.cdsPct += fx.cdsPctPerLevel * ((o.level || 1) - 1); touched = true; }
      if (fx.burnFlat) { mods.burnFlat += fx.burnFlat; touched = true; }
      if (fx.poisonFlat) { mods.poisonFlat += fx.poisonFlat; touched = true; }
      if (fx.mc) { mods.mc += fx.mc; touched = true; }
      if (fx.statsPct) { mods.statsPct += fx.statsPct; touched = true; }
      if (touched) mods.sources.push(name);
    }
    // 🧪 Chemist: "Your Toxic monsters have +1 Poison; +1 more per ANY level-up."
    // The live magnitude is the save's toxic_passive_bonus_count (trainerData.toxicPoison,
    // auto-synced); manual fallback = 1 + levelUps. Board Toxic units only (not shop
    // preview). Previously UNMODELED — the sim under-counted every Chemist poison build
    // by exactly this bonus (his live run had +11 Poison uncounted on 3-4 Toxic units).
    if (!o.isShop && types.includes('toxic') && effectiveTrainerId() === 'chemist') {
      const td = live.trainerData || {};
      const bonus = td.toxicPoison != null ? td.toxicPoison : (1 + (td.levelUps || 0));
      if (bonus > 0) { mods.poisonFlat += bonus; mods.sources.push('Chemist'); }
    }
    return mods;
  }
  // modified vs base display: bold new value + grey struck base
  const modVal = (base, mod, unit) => mod === base
    ? `<b>${base.toLocaleString()}</b>`
    : `<b style="color:var(--green)">${Math.round(mod).toLocaleString()}${unit || ''}</b> <s style="color:var(--muted);font-size:10px">${base.toLocaleString()}${unit || ''}</s>`;

  // Chef (pyromaniac): single-typed units convert to Fire; all Fire units get +2 Burn.
  function chefInfo(m) {
    if (effectiveTrainerId() !== 'pyromaniac') return null;
    const types = (m.types || []).map(t => t.id);
    const converted = types.length === 1 && !types.includes('fire');
    const isFire = types.includes('fire') || converted;
    return { converted, isFire };
  }
  // Multicast badge — mirrors the game's ×N card badge. Shows a unit's innate
  // multicast at its CURRENT level (trinket/aura multicast bonuses still surface
  // in the hover + battle table). Only rendered at ×2 or higher.
  function mcBadge(s) {
    if (!s) return '';
    const m = monById[s.monsterId]; if (!m) return '';
    const ld = E.levelData(m, s.level, s.shiny);
    const mc = ld && ld.multicast > 1 ? ld.multicast : 0;
    return mc ? `<span class="mc-badge" title="Multicast ×${mc} — each activation fires ${mc}× (matches the game's ×${mc} badge)">×${mc}</span>` : '';
  }
  function slotHoverHTML(s) {
    const m = effMon(s); // effective types (event-granted extras merged in)
    if (!m) return '';
    const ld = E.levelData(m, s.level, s.shiny);
    // sandbox (Shop Advisor tab): pure base card — live-run trinkets/Chef don't apply
    const chef = s._sandbox ? null : chefInfo(m);
    const idx = (s._chipMode || s._sandbox) ? null : live.board.findIndex(x => x === s || (x && x.monsterId === s.monsterId && x.level === s.level && x.shiny === s.shiny));
    const mods = s._sandbox
      ? { dmgFlat: 0, dmgPct: 0, cdsPct: 0, burnFlat: 0, poisonFlat: 0, mc: 0, statsPct: 0, sources: [] }
      : unitMods(m, idx >= 0 ? idx : null, { isShop: !!s._chipMode, level: s.level });
    const feedH = Object.assign({ dmg: 0, cds: 0, heal: 0, shield: 0, burn: 0, poison: 0, shock: 0, mc: 0 }, (!s._sandbox && s.feed) ? s.feed : {});
    const statMod = (key, base) => {
      let v = base;
      if (key === 'damage') v = (base + mods.dmgFlat + feedH.dmg) * (1 + mods.dmgPct / 100);
      if (key === 'burn') v = base + mods.burnFlat + feedH.burn + (chef && chef.isFire ? 2 : 0);
      if (key === 'poison') v = base + mods.poisonFlat + feedH.poison;
      if (key === 'heal') v = base + feedH.heal;
      if (key === 'shield') v = base + feedH.shield;
      if (key === 'shock') v = base + feedH.shock;
      if (mods.statsPct && key !== 'cooldown') v *= 1 + mods.statsPct / 100;
      return v;
    };
    const stats = ld && Array.isArray(ld.stats)
      ? ld.stats.map(st => `<span class="hc-stat" style="border-color:${st.color}66">${esc(st.label)} ${modVal(st.value, statMod(st.key, st.value))}</span>`).join('')
      : '';
    const chefBurnNew = chef && chef.isFire && !(ld && ld.stats || []).some(st => st.key === 'burn')
      ? `<span class="hc-stat" style="border-color:#ff7c5c66">Burn <b style="color:var(--green)">+${2 + mods.burnFlat}</b> <span style="color:#ff7c5c">(Chef${mods.burnFlat ? '+trinkets' : ''})</span></span>` : '';
    const dmgNew = (mods.dmgFlat > 0 || feedH.dmg > 0) && !(ld && ld.stats || []).some(st => st.key === 'damage')
      ? `<span class="hc-stat" style="border-color:#ef426b66">Damage <b style="color:var(--green)">+${Math.round((mods.dmgFlat + (feedH.dmg || 0)) * (1 + mods.dmgPct / 100))}</b> <span style="color:var(--gold)">(${feedH.dmg ? 'fed' + (mods.dmgFlat ? '+trinkets' : '') : 'trinkets'})</span></span>` : '';
    // received CDS auras (Formiqueen +33% to adjacent Commons, etc.) — passive, so
    // the game bakes them into the card cooldown; include them for board units.
    const auraCds = (idx != null && idx >= 0 && !s._sandbox && !s._chipMode) ? receivedAuraCds(live.board, idx) : { pct: 0, sources: [] };
    const totalCds = mods.cdsPct + (feedH.cds || 0) + auraCds.pct;
    const effCd = ld ? +(Math.max(ld.cooldown / (1 + totalCds / 100), 0.1)).toFixed(2) : 0;
    const effMc = ld ? (ld.multicast || 1) + mods.mc : 1;
    const cdmc = ld ? `<span class="hc-stat">CD ${totalCds ? `<b style="color:var(--green)">${effCd}s</b> <s style="color:var(--muted);font-size:10px">${ld.cooldown}s</s>` : ld.cooldown + 's'}</span>${effMc > 1 ? `<span class="hc-stat">Multicast ${mods.mc ? `<b style="color:var(--green)">×${effMc}</b> <s style="color:var(--muted);font-size:10px">×${ld.multicast || 1}</s>` : '×' + effMc}</span>` : ''}` : '';
    const feedParts = [
      feedH.dmg ? `+${feedH.dmg} Dmg` : '', feedH.cds ? `+${feedH.cds}% CDS` : '',
      feedH.heal ? `+${feedH.heal} Heal` : '', feedH.shield ? `+${feedH.shield} Shield` : '',
      feedH.burn ? `+${feedH.burn} Burn` : '', feedH.poison ? `+${feedH.poison} Poison` : '',
      feedH.shock ? `+${feedH.shock} Shock` : '', feedH.mc ? `+${feedH.mc} Multicast` : '',
    ].filter(Boolean);
    const auraLine = auraCds.pct ? `<div style="font-size:10px;color:var(--accent);margin-top:3px">⚡ +${auraCds.pct}% CDS aura from ${[...new Set(auraCds.sources)].join(' · ')} (${auraCds.sources.length}× adjacent) → cooldown ${effCd}s</div>` : '';
    const modLine = (mods.sources.length || feedParts.length)
      ? `<div style="font-size:10px;color:var(--gold);margin-top:3px">${mods.sources.length ? '💎 ' + mods.sources.join(' · ') : ''}${feedParts.length ? `${mods.sources.length ? ' · ' : ''}<span style="color:var(--green)">🌱 permanent: ${feedParts.join(', ')}</span>` : ''}</div>` : '';
    const ab = E.abilityText(m, s.level, s.shiny);
    const rs = window.SYNERGY && window.SYNERGY.monsters && window.SYNERGY.monsters[m.id];
    return `<div class="hc2-head"><span>${s.shiny ? '✨ ' : ''}${esc(m.name)}</span><span style="color:${rarColor(m)}">${esc(rarLabel(m))}</span></div>
      <div class="hc2-body">
        <img class="sprite" src="${spr(s.shiny && m.shinySprite ? m.shinySprite : m.sprite)}">
        <div class="hc2-types">${(() => { const baseIds = new Set(((monById[s.monsterId] || {}).types || []).map(t => t.id)); return (m.types || []).map(t => { const evt = !baseIds.has(t.id); return `<span class="hc2-type${evt ? ' evt' : ''}" style="background:${t.color}"${evt ? ' title="Added by event"' : ''}>${evt ? '＋' : ''}${esc(t.name)}</span>`; }).join(''); })()}${chef && chef.converted ? '<span class="hc2-type" style="background:#e2543e">🔥 Fire (Chef)</span>' : ''}</div>
      </div>
      <div class="hc2-statbox">
        <div class="hc2-cd">${totalCds ? `<b style="color:var(--green)">${effCd}</b><s>${ld ? ld.cooldown : ''}</s>` : (ld ? ld.cooldown : '?')}<span>SEC</span></div>
        <div class="hc2-stats">${stats}${chefBurnNew}${dmgNew}${effMc > 1 ? `<span class="hc-stat">Multicast ×${effMc}${mods.mc ? ` <s style="color:var(--muted)">×${(ld && ld.multicast) || 1}</s>` : ''}</span>` : ''}</div>
      </div>
      <div class="hc2-cost"><span>COST</span><span style="color:var(--gold)">$${m.cost}</span></div>
      <div class="hc2-lvls">${[1, 2, 3, 4].map(l => `<span class="hc2-lvl ${l === s.level ? 'on' : ''}">Lv ${l}</span>`).join('')}${s.shiny ? '<span class="hc2-lvl shiny on">SHINY</span>' : ''}</div>
      ${auraLine}${modLine}
      ${ab && ab.text ? `<div class="hc-ability"><b>${esc(ab.trigger || 'Passive')}</b> — ${esc(ab.text.split('\n')[0])}</div>` : ''}
      ${rs && rs.rounds >= 60 ? `<div style="margin-top:5px">Real data: ${wrSpan(rs.winRate)} WR · ${rs.pickRate}% of top runs${rs.byLevel && rs.byLevel[s.level] && rs.byLevel[s.level].rounds >= 15 ? ` · at L${s.level}: ${wrSpan(rs.byLevel[s.level].winRate)}` : ''}</div>` : ''}
      <div class="hc-hint">${s._buyMode ? '<b style="color:var(--green)">Click = BUY</b> · drag onto a board slot = buy there · <b>Shift+click</b> = level · <b>Alt+click</b> = shiny · × = remove' : s._chipMode ? '<b>Shift+click</b> = level → L' + (s.level % 4 + 1) + ' · <b>Alt+click</b> = shiny · × = remove' : 'Click = change · <b>Shift+click</b> = level → L' + (s.level % 4 + 1) + ' · <b>Alt+click</b> = shiny · hover buttons: level / shiny / clear'}</div>`;
  }

  // Wire a filled slot (or offer chip) with hover card, quick buttons and modifier clicks.
  // getS() -> current slot object | setS(next) -> persist + rerender | openPicker() -> default click
  function wireSlot(cell, getS, setS, openPicker, opts) {
    const o = opts || {};
    // opts.sandbox: Shop Advisor tab board — its own context, NOT the live run.
    // Live-run trinket mods / Chef conversion / Link Cable must not leak there.
    cell.addEventListener('mouseenter', (e) => {
      const s = getS();
      if (s) hcShow(slotHoverHTML(Object.assign({}, s, o.noButtons ? { _chipMode: true } : {}, o.sandbox ? { _sandbox: true } : {}, o.buyMode ? { _buyMode: true } : {})), e.clientX, e.clientY);
    });
    cell.addEventListener('mousemove', (e) => { if (hovercard.style.display === 'block') hcShow(hovercard.innerHTML, e.clientX, e.clientY); });
    cell.addEventListener('mouseleave', hcHide);
    cell.addEventListener('click', (e) => {
      const s = getS();
      if (s && e.shiftKey) { e.preventDefault(); setS({ ...s, level: (s.level % 4) + 1 }); hcHide(); return; }
      if (s && e.altKey) { e.preventDefault(); setS({ ...s, shiny: !s.shiny }); hcHide(); return; }
      hcHide(); openPicker();
    });
    const s = getS();
    if (s && !o.noButtons) {
      const qa = el('div', 'qa');
      qa.innerHTML = `
        <button class="qa-lvl" title="Cycle level (Shift+click slot)">L${(s.level % 4) + 1}</button>
        <button class="qa-sh" title="Toggle shiny (Alt+click slot)">✨</button>
        <button class="qa-x" title="Clear slot">×</button>`;
      qa.querySelector('.qa-lvl').onclick = (e) => { e.stopPropagation(); setS({ ...s, level: (s.level % 4) + 1 }); hcHide(); };
      qa.querySelector('.qa-sh').onclick = (e) => { e.stopPropagation(); setS({ ...s, shiny: !s.shiny }); hcHide(); };
      qa.querySelector('.qa-x').onclick = (e) => { e.stopPropagation(); setS(null); hcHide(); };
      cell.appendChild(qa);
    }
  }
  const BOARD_HINT = `<div class="board-hint">💡 Hover for stats & quick buttons · <kbd>Shift</kbd>+click = level · <kbd>Alt</kbd>+click = shiny · click = change · <b>drag</b> to move/swap · drag out = remove</div>`;

  // ---------------- board drag & drop ----------------
  // Drag between slots = move/swap. Drop anywhere outside a slot = delete.
  let dragCtx = null; // {arr, idx, save, render}
  function wireDrag(cell, arr, idx, saveFn, renderFn) {
    if (!arr[idx]) return; // only filled slots drag
    cell.draggable = true;
    cell.addEventListener('dragstart', (e) => {
      dragCtx = { arr, idx, save: saveFn, render: renderFn, dropped: false };
      cell.classList.add('dragging');
      hcHide();
      document.body.classList.add('drag-active');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch {}
    });
    cell.addEventListener('dragend', () => {
      cell.classList.remove('dragging');
      document.body.classList.remove('drag-active');
      if (dragCtx && !dragCtx.dropped) { // released outside any slot → delete
        dragCtx.arr[dragCtx.idx] = null;
        dragCtx.save(); dragCtx.render();
      }
      dragCtx = null;
    });
  }
  function wireDropTarget(cell, arr, idx, saveFn, renderFn) {
    // accepts same-array moves, board↔bench moves (live run AND advisor
    // sandbox), and shop-chip drops (buy into that slot) on the LIVE board/bench.
    const isLiveArr = (a) => a === live.board || a === live.bench;
    const isAdvArr = (a) => a === state.team || a === state.bench;
    const accepts = () => dragCtx && (
      dragCtx.arr === arr ||
      (dragCtx.shopBuy && isLiveArr(arr)) ||
      (dragCtx.arr && isLiveArr(dragCtx.arr) && isLiveArr(arr)) ||
      (dragCtx.arr && isAdvArr(dragCtx.arr) && isAdvArr(arr))
    );
    cell.addEventListener('dragover', (e) => {
      if (!accepts()) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = dragCtx.shopBuy ? 'copy' : 'move';
      cell.classList.add('drop-target');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drop-target'));
    cell.addEventListener('drop', (e) => {
      if (!accepts()) return;
      e.preventDefault();
      dragCtx.dropped = true;
      if (dragCtx.shopBuy) {
        buyFromShop(dragCtx.idx, idx, arr === live.bench ? 'bench' : 'board'); // drag from shop = BUY into this slot
      } else {
        const from = dragCtx.idx, fromArr = dragCtx.arr;
        if (fromArr !== arr || from !== idx) {
          const tmp = arr[idx];
          arr[idx] = fromArr[from];
          fromArr[from] = tmp; // swap (or move into empty) — works across board↔bench
          saveFn(); renderFn();
        }
      }
      cell.classList.remove('drop-target');
    });
  }
  function wireShopDrag(chip, i) {
    chip.draggable = true;
    chip.addEventListener('dragstart', (e) => {
      dragCtx = { shopBuy: true, idx: i, dropped: false };
      hcHide();
      e.dataTransfer.effectAllowed = 'copy';
      try { e.dataTransfer.setData('text/plain', 'shop:' + i); } catch {}
    });
    chip.addEventListener('dragend', () => { dragCtx = null; });
  }

  // ---------------- per-trainer live logic ----------------
  // Each trainer's real mechanic becomes UI + engine context in the cockpit.
  const nextRangerCopyDay = (day) => (day % 2 === 1 ? day + 2 : day + 1); // free copies land on odd days ≥3
  const rangerCopies = (day) => 1 + Math.floor(Math.max(day - 1, 0) / 2);
  // ---------------- EVENTS ADVISOR (real batodex event data) ----------------
  // Every option scores on a WR-ish scale (~45-80) so monsters, trinkets, gold
  // and utilities rank comparably. Random-pool rewards score as expected value.
  const RARITY_TIER = { 'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Super Rare': 4, 'Legendary': 5, 'Mythical': 6 };
  // Some event options came back from the crawler with reward:null (their text
  // is rendered dynamically in-game). Patch the known ones by event id + flavor
  // so every real choice is scored instead of silently dropped.
  const EVENT_REWARD_OVERRIDES = {
    genius_inventor: { 'Test the Recombobulator': 'Randomly transform your monsters 1 rarity higher (max Mythical rarity)' },
  };
  const resolveReward = (sel, o) => o.reward && o.reward !== 'null' ? o.reward : ((EVENT_REWARD_OVERRIDES[sel && sel.id] || {})[o.flavor] || null);

  function scoreEventOption(opt) {
    const txt = opt.reward || '';
    const res = { value: null, chips: [], apply: null };
    if (!txt || txt === 'null') return res;
    const g = () => ((window.SYNERGY && window.SYNERGY.sample) || {}).globalRoundWR || 66;

    // Recombobulator: transform EVERY monster one rarity tier up — but into a
    // RANDOM new species, so it trades your current board (and its synergies)
    // for raw rarity. Great on a generic board, a trap once you're committed.
    if (/transform your monsters?.*rarity higher/i.test(txt) || /Recombobulator/i.test(opt.flavor || '')) {
      const committed = !!(activeStrategy() || live.plan);
      const fielded = live.board.filter(Boolean).length;
      let v = 58 + Math.min(fielded, 6);
      res.chips.push('every monster → +1 rarity tier (RANDOM new species, keeps level)');
      if (committed) { v -= 14; res.chips.push('⚠️ randomizes your board — BREAKS your adopted strategy / comp synergies'); }
      else res.chips.push('no committed synergy yet → mostly a raw power-up');
      res.value = v; res.apply = { kind: 'note' };
      return res;
    }

    // specific monster: "Gain a [level N] [SHINY] Name [with +X Stat]"
    const mm = txt.match(/[Gg]ain an? (?:level (\d+) )?(SHINY )?([A-Z][A-Za-z']+)(?:\s+with \+(\d+)%? (Damage|Multicast|Shield|Heal|Burn|Poison|Shock))?/);
    const monNamed = mm && (monsters.find(m => m.name === mm[3]) || monsters.find(m => m.name.toLowerCase() === (mm[3] || '').toLowerCase()));
    if (monNamed && !/random/i.test(txt)) {
      const level = mm[1] ? +mm[1] : 1;
      const shiny = !!mm[2];
      const rs = window.SYNERGY && window.SYNERGY.monsters && window.SYNERGY.monsters[monNamed.id];
      const p = E.power(monNamed, level, { day: live.day, shiny, team: live.board, trainerId: effectiveTrainerId() });
      let v = (rs && rs.rounds >= 60 ? rs.winRate : 52) + Math.min(15, p.total / 8);
      if (shiny) { v += 4; res.chips.push('SHINY: ~+20% + upgraded ability'); }
      if (level >= 2) res.chips.push(`arrives at Level ${level}`);
      if (mm[4] && mm[5]) { v += Math.min(5, +mm[4] / 8); res.chips.push(`bonus +${mm[4]} ${mm[5]}`); }
      if (rs && rs.rounds >= 60) res.chips.push(`${rs.winRate}% real WR · ${rs.pickRate}% of top runs`);
      const combo = bestBoardCombo(monNamed.id, new Set(live.board.filter(s => s).map(s => s.monsterId)));
      if (combo) { v += Math.min(8, Math.max(0, combo.lift / 2)); res.chips.push(`⚡ ${combo.winRate}% w/ your board (${combo.ids.map(id => (monById[id] || { name: id }).name).join('+')})`); }
      const owned = live.board.filter(s => s && s.monsterId === monNamed.id).length;
      if (owned) { v += 3; res.chips.push(`merge fuel — you own ${owned}`); }
      res.value = v;
      res.apply = { kind: 'mon', id: monNamed.id, level, shiny };
      return res;
    }
    // random rarity monster: "Gain a random level 2 Super Rare monster"
    const rm = txt.match(/random (?:level (\d+) )?(Common|Uncommon|Rare|Super Rare|Legendary|Mythical) monster/i);
    if (rm) {
      const tier = RARITY_TIER[rm[2]];
      const level = rm[1] ? +rm[1] : 1;
      const pool = shopPool.filter(m => m.tier === tier && !m.isEvolvedForm);
      const SYm = (window.SYNERGY && window.SYNERGY.monsters) || {};
      const wrs = pool.map(m => (SYm[m.id] && SYm[m.id].rounds >= 40 ? SYm[m.id].winRate : null)).filter(x => x != null);
      const avgWR = wrs.length ? wrs.reduce((a, b) => a + b, 0) / wrs.length : g();
      const avgP = pool.reduce((a, m) => a + E.power(m, level, { day: live.day }).total, 0) / Math.max(pool.length, 1);
      res.value = avgWR + Math.min(12, avgP / 10) + (level >= 2 ? 2 : 0);
      res.chips.push(`EV over ${pool.length} ${rm[2]} monsters · avg ${avgWR.toFixed(1)}% real WR${level > 1 ? ` · at L${level}` : ''}`);
      res.apply = { kind: 'randMon', tier, level };
      return res;
    }
    // trinket gift of a rarity: "Get a Super Rare trinket gift"
    const rt = txt.match(/(Common|Uncommon|Rare|Super Rare|Legendary|Mythical) trinket gift/i);
    if (rt) {
      const pool = D.trinkets.filter(t => t.rarity && t.rarity.label === rt[1] && t.stats);
      const avg = pool.length ? pool.reduce((a, t) => a + t.stats.winRate, 0) / pool.length : 55;
      const ctx = { board: live.board, day: live.day, lives: live.lives, ownedTrinkets: (live.trinkets || []).length };
      // a gift is a CHOICE — value it by the best-FITTING option for your board, not the pool average
      const top = pool.map(t => ({ t, f: trinketRunFit(t, ctx) })).sort((a, b) => b.f.score - a.f.score)[0];
      res.value = avg + 2 + (top ? 18 * top.f.score : 0);
      res.chips.push(`EV over ${pool.length} ${rt[1]} trinkets · avg ${avg.toFixed(1)}% WR`);
      if (top && top.f.score >= 0.5) res.chips.push(`🎯 best for your run: ${top.t.name} (${Math.round(top.f.score * 100)}% fit — ${top.f.why})`);
      res.apply = { kind: 'randTrinket', rarity: rt[1] };
      return res;
    }
    // specific trinket — blend real WR with how it fits the run you're having
    const tk = D.trinkets.find(t => txt.includes(t.name));
    if (tk) {
      const fit = trinketRunFit(tk, { board: live.board, day: live.day, lives: live.lives, ownedTrinkets: (live.trinkets || []).length });
      const wr = tk.stats ? tk.stats.winRate : 55;
      res.value = 0.6 * wr + 40 * fit.score;
      res.chips.push(`🎯 fit ${Math.round(fit.score * 100)}% — ${fit.why}`);
      if (tk.stats) res.chips.push(`${tk.stats.winRate}% real trinket WR · picked ${tk.stats.pickRate}%`);
      res.apply = { kind: 'trinket', id: tk.id };
      return res;
    }
    // flat gold
    const gm = txt.match(/Gain \$(\d+)/);
    if (gm) {
      res.value = 47 + Math.min(10, +gm[1] / 8);
      res.chips.push(`flat $${gm[1]} — tempo, no scaling`);
      res.apply = { kind: 'gold', amt: +gm[1] };
      return res;
    }
    // utilities
    if (/Turn a monster SHINY/i.test(txt)) { res.value = 58; res.chips.push('~+20% stats + upgraded ability on a unit of your choice'); res.apply = { kind: 'shinyUnit' }; return res; }
    if (/Level up a (?:level 1 )?monster/i.test(txt)) { res.value = 56; res.chips.push('instant merge progress'); res.apply = { kind: 'levelUnit', onlyL1: /level 1/.test(txt) }; return res; }
    if (/Increase shop rank by (\d+)/i.test(txt)) { const n = +txt.match(/by (\d+)/)[1]; res.value = 51 + n; res.chips.push(`shop odds jump ${n} level${n > 1 ? 's' : ''}`); res.apply = { kind: 'shopRank', amt: n }; return res; }
    if (/Dragon Egg/i.test(txt)) { res.value = 57; res.chips.push('hatches a Legendary Dragon in 3 days — needs a slot'); res.apply = { kind: 'note' }; return res; }
    if (/typing/i.test(txt)) { res.value = 52; res.chips.push('type conversion — enables type synergies'); res.apply = { kind: 'note' }; return res; }
    return res;
  }

  function applyEventOption(apply, after) {
    const done = (msg) => { saveLive(); closeModal(); renderLive(); const n = $('#lv-opt-note'); if (n) n.textContent = '🎪 ' + msg; if (after) after(); };
    if (!apply) return;
    if (apply.kind === 'mon') {
      const empty = live.board.findIndex(x => !x);
      if (empty === -1) { done('Board full — reward noted, clear a slot and add manually.'); return; }
      live.board[empty] = { monsterId: apply.id, level: apply.level || 1, shiny: !!apply.shiny };
      done(`Added ${(monById[apply.id] || {}).name} L${apply.level}${apply.shiny ? ' ✨' : ''} to your board.`);
    } else if (apply.kind === 'trinket') {
      live.trinkets.push(apply.id);
      done(`Added ${(D.trinkets.find(t => t.id === apply.id) || {}).name} to your trinkets.`);
    } else if (apply.kind === 'gold') {
      live.gold += apply.amt;
      done(`+$${apply.amt} gold.`);
    } else if (apply.kind === 'shopRank') {
      live.shopRank = Math.min(live.shopRank + apply.amt, 14);
      done(`Shop level +${apply.amt} → ${live.shopRank}.`);
    } else if (apply.kind === 'randMon') {
      closeModal();
      monsterPicker({
        title: `Which ${Object.keys(RARITY_TIER).find(k => RARITY_TIER[k] === apply.tier)} did you get?`,
        defaultLevel: apply.level || 1,
        pool: monsters.filter(m => m.tier === apply.tier),
        boardIds: new Set(live.board.filter(s => s).map(s => s.monsterId)),
      }, (pick) => {
        if (!pick) return;
        const empty = live.board.findIndex(x => !x);
        if (empty !== -1) live.board[empty] = pick;
        saveLive(); renderLive();
      });
    } else if (apply.kind === 'randTrinket') {
      closeModal();
      trinketPicker((id) => { live.trinkets.push(id); saveLive(); renderLive(); },
        { title: `Which ${apply.rarity} trinket did you pick?`, rarity: apply.rarity });
    } else if (apply.kind === 'shinyUnit' || apply.kind === 'levelUnit') {
      closeModal();
      boardUnitPicker(apply.kind === 'shinyUnit' ? 'Which unit turned SHINY?' : '💎 Free level — which unit? (recommendation below)',
        (s) => apply.kind === 'levelUnit' ? (!apply.onlyL1 || s.level === 1) && s.level < 4 : !s.shiny,
        (idx) => {
          if (apply.kind === 'shinyUnit') live.board[idx].shiny = true;
          else live.board[idx].level = Math.min(live.board[idx].level + 1, 4);
          saveLive(); renderLive();
        },
        apply.kind === 'levelUnit' ? { rank: levelUpValue } : {});
    } else {
      done('Noted — apply the effect manually if needed.');
    }
  }

  // Value of giving a FREE level to a board unit. E.power undervalues burn/
  // multicast/shield bodies, so we score off unitOutput (real dps + status
  // application + sustain, multicast-aware) at the live slot — plus a big bump
  // when the level crosses an EVOLUTION, and relevance weight for the strategy
  // focus / comp piece. Also builds a concrete STAT-DIFF line (the "stats" ask).
  function levelUpValue(s, idx) {
    const m = monById[s.monsterId];
    if (!m || s.level >= 4) return null;
    const nextLevel = s.level + 1;
    let nextMon = m, evo = null;
    if (m.evolution && m.evolution.trigger === 'level' && m.evolution.targetId && nextLevel >= (m.evolution.level || 3)) {
      evo = monById[m.evolution.targetId]; if (evo) nextMon = evo;
    }
    // output value (fixed 20s horizon weights statuses like the optimizer does)
    const T = 20;
    const val = (u) => u ? u.dps + u.poisonApp * T / 2 + u.burnApp * 2 + u.shockApp * (u.hitRate || 0) * T / 2 + u.heal * 0.5 + u.shield * 0.6 : 0;
    const outAt = (mon, lvl) => { try { return unitOutput({ monsterId: mon.id, level: lvl, shiny: s.shiny, feed: s.feed }, live.day, idx); } catch (e) { return null; } };
    const cur = val(outAt(m, s.level));
    const nxt = val(outAt(nextMon, nextLevel));
    const delta = Math.max(nxt - cur, 0);
    // concrete stat diffs for the card (what actually changes at the next level)
    const la = E.levelData(m, s.level, s.shiny), lb = E.levelData(nextMon, nextLevel, s.shiny);
    const diffs = [];
    if (evo) diffs.push(`✨ EVOLVES → ${evo.name}`);
    const mcA = (la && la.multicast) || 1, mcB = (lb && lb.multicast) || 1;
    if (mcB > mcA) diffs.push(mcA > 1 ? `Multicast ×${mcA}→×${mcB}` : `unlocks ×${mcB} Multicast`);
    if (lb && la && lb.cooldown < la.cooldown) diffs.push(`CD ${la.cooldown}→${lb.cooldown}s`);
    const byKey = (l) => Object.fromEntries((l && l.stats || []).map(x => [x.key, x.value]));
    const ka = byKey(la), kb = byKey(lb);
    ['damage', 'shield', 'heal', 'burn', 'poison', 'shock'].forEach(k => {
      if (kb[k] != null && kb[k] !== (ka[k] || 0)) diffs.push(`${k[0].toUpperCase() + k.slice(1)} ${ka[k] || 0}→${kb[k]}`);
    });
    // relevance: leveling the unit the whole board feeds is worth more
    let mult = 1, tags = [];
    if (stratFocusIds().has(m.id)) { mult *= 1.35; tags.push('♟️ strategy focus'); }
    const planB = live.plan && buildById(live.plan);
    if (planB && [...(planB.core || []), ...(planB.lateCore || [])].includes(m.id)) { mult *= 1.15; tags.push('🎯 comp piece'); }
    if (evo) mult *= 1.7;
    const score = (evo ? Math.max(delta, cur * 0.6 + 60) : delta) * mult;
    const sub = `${diffs.slice(0, 3).join(' · ') || 'small stat bump'}${tags.length ? ' · ' + tags.join(' · ') : ''}`;
    return { score, badge: diffs[0] || tags[0] || null, sub, delta, evo, diffs };
  }

  function boardUnitPicker(title, filterFn, onPick, opts = {}) {
    const box = el('div');
    box.appendChild(el('h3', null, esc(title)));
    const rank = opts.rank;
    let cells = [];
    live.board.forEach((s, idx) => {
      if (!s || (filterFn && !filterFn(s))) return;
      cells.push({ s, idx, r: rank ? rank(s, idx) : null });
    });
    if (rank) cells.sort((a, b) => ((b.r && b.r.score) || 0) - ((a.r && a.r.score) || 0));
    const best = rank && cells.length ? cells[0] : null;
    const grid = el('div', 'mon-grid');
    cells.forEach((cell, ci) => {
      const { s, idx, r } = cell;
      const m = monById[s.monsterId];
      const c = el('div', 'mon-cell' + (best && ci === 0 && r && r.score > 0 ? ' rec-best' : ''));
      c.innerHTML = `<img class="sprite" src="${spr(s.shiny && m.shinySprite ? m.shinySprite : m.sprite)}">
        <div class="nm">${best && ci === 0 && r && r.score > 0 ? '👉 ' : ''}${esc(m.name)} L${s.level}${s.shiny ? ' ✨' : ''}</div>
        <div class="tier" style="color:var(--muted)">${SLOT_SHORT[idx]}</div>
        ${r ? `<div class="rec-sub" style="font-size:9.5px;margin-top:3px;color:${ci === 0 && r.score > 0 ? 'var(--green)' : 'var(--muted)'}">${esc(r.sub)}</div>` : ''}`;
      c.onclick = () => { onPick(idx); closeModal(); };
      grid.appendChild(c);
    });
    if (!cells.length) grid.innerHTML = '<div class="note">No eligible unit on the board.</div>';
    box.appendChild(grid);
    if (best && best.r && best.r.score > 0) box.appendChild(el('div', 'note', `👉 Recommended: level <b>${esc(monById[best.s.monsterId].name)}</b> — ${best.r.evo ? `it <b>EVOLVES → ${esc(best.r.evo.name)}</b>, a whole power band` : 'biggest real output gain for your board'}. Calculated from live day/team/trainer/trinkets.`, true));
    openModal(box);
  }

  function eventPicker() {
    const events = D.events || [];
    if (!events.length) { openModal('<h3>No event data — hit ⟳ Refresh in Patches.</h3>'); return; }
    const box = el('div');
    const render = (sel) => {
      box.innerHTML = `<h3>🎪 ${sel ? esc(sel.name) : 'Which event did you hit?'}</h3>`;
      if (!sel) {
        const grid = el('div', 'mon-grid');
        events.forEach(ev => {
          const c = el('div', 'mon-cell');
          c.innerHTML = `<img class="sprite" src="${spr(ev.sprite)}" style="width:84px;height:48px;object-fit:cover;border-radius:6px">
            <div class="nm">${esc(ev.name)}</div>
            <div class="tier" style="color:${rarColor(ev)}">${esc(rarLabel(ev))}</div>`;
          c.onclick = () => render(ev);
          grid.appendChild(c);
        });
        box.appendChild(grid);
      } else {
        const scored = sel.options
          .map(o => ({ o, reward: resolveReward(sel, o) }))
          .filter(x => x.reward)
          .map(({ o, reward }) => ({ o: Object.assign({}, o, { reward }), s: scoreEventOption(Object.assign({}, o, { reward })) }));
        const max = Math.max(...scored.map(x => x.s.value || 0), 0.001);
        scored.sort((a, b) => (b.s.value || -1) - (a.s.value || -1));
        const wrap = el('div');
        wrap.innerHTML = `<div class="note" style="margin:6px 0 10px">${esc(sel.description)} <span class="pill">${esc(rarLabel(sel))}</span></div>`;
        scored.forEach(({ o, s }, i) => {
          const applyMon = s.apply && s.apply.kind === 'mon' ? monById[s.apply.id] : null;
          const card = el('div', 'result-card' + (i === 0 && s.value != null ? ' top' : ''));
          card.style.cssText = 'grid-template-columns:56px 1fr 90px;padding:10px 12px;margin-bottom:8px';
          card.innerHTML = `
            ${applyMon ? `<img class="sprite" src="${spr(s.apply.shiny && applyMon.shinySprite ? applyMon.shinySprite : applyMon.sprite)}" style="width:48px;height:48px">` : '<div style="font-size:26px;text-align:center">🎁</div>'}
            <div>${i === 0 && s.value != null ? '<span class="rank-badge">PICK THIS</span>' : ''}
              <div class="name" style="font-size:13.5px">${esc(o.flavor)}</div>
              <div style="font-size:11.5px;color:var(--gold)">→ ${esc(o.reward)}</div>
              <div class="chips">${s.chips.map(ch => `<span class="chip good" style="font-size:10px">${esc(ch)}</span>`).join('')}</div>
              ${s.apply ? `<button class="primary pick-opt" style="margin-top:7px;font-size:11px;padding:5px 12px">✓ Pick this${s.apply.kind === 'randMon' || s.apply.kind === 'randTrinket' ? ' → tell me what you rolled' : ''}</button>` : ''}
            </div>
            <div class="pct ${s.value != null && s.value === max ? 'p90' : 'p70'}" style="text-align:right"><div class="big" style="font-size:22px">${s.value != null ? Math.round((s.value / max) * 100) + '%' : '—'}</div></div>`;
          const btn = card.querySelector('.pick-opt');
          if (btn) btn.onclick = () => { logRun('event', `${sel.name}: ${o.flavor} → ${o.reward}`); applyEventOption(s.apply); };
          wrap.appendChild(card);
        });
        const back = el('button', 'ghost', '← All events');
        back.onclick = () => render(null);
        wrap.appendChild(back);
        box.appendChild(wrap);
      }
    };
    render(null);
    openModal(box);
  }

  // ---------------- composition plan (from Builds tab) ----------------
  function compPlanHTML() {
    const b = buildById(live.plan);
    if (!b) return '';
    const frB = FR() && G.FR.BUILDS && G.FR.BUILDS[b.id];
    const boardIds = [...live.board, ...(live.bench || [])].filter(s => s).map(s => s.monsterId);
    const ownedSet = new Set(boardIds);
    const piece = (id) => {
      const m = monById[id];
      if (!m) return '';
      const evo = ownsPieceOrEvo(id, ownedSet);
      const have = evo.have;
      const viaName = evo.via ? (monById[evo.via] || {}).name : null;
      return `<div class="coremon" style="${have ? '' : 'opacity:.35;filter:grayscale(.8)'}" title="${esc(m.name)}${have ? (viaName ? ' ✓ you have it as ' + esc(viaName) + ' (evolved)' : ' ✓ on board') : ' — missing'}">
        <img class="sprite" src="${spr(m.sprite)}"><div>${have ? '✓ ' : ''}${esc(m.name)}${viaName ? ` <span style="color:var(--muted);font-size:9px">→${esc(viaName)}</span>` : ''}</div></div>`;
    };
    const tkPiece = (id) => {
      const t = D.trinkets.find(x => x.id === id);
      if (!t) return '';
      const have = live.trinkets.includes(id);
      return `<div class="coremon" style="${have ? '' : 'opacity:.35;filter:grayscale(.8)'}" title="${esc(t.description)}">
        <img class="sprite" src="${spr(t.sprite)}"><div>${have ? '✓ ' : ''}${esc(t.name)}</div></div>`;
    };
    const missing = [...b.core, ...b.lateCore].filter(id => monById[id] && !ownsPieceOrEvo(id, ownedSet).have);
    return `<div class="card" style="margin-top:12px;border-color:var(--accent)">
      <h3>🎯 Plan: ${esc(b.name)} <button class="ghost" id="lv-plan-clear" style="float:right;font-size:10px">✕ drop plan</button></h3>
      <div class="rowlabel" style="margin-top:8px">Core</div><div class="cores">${b.core.map(piece).join('')}</div>
      <div class="rowlabel">Late game</div><div class="cores">${b.lateCore.map(piece).join('')}</div>
      <div class="rowlabel">Trinkets to grab</div><div class="cores">${b.trinkets.map(tkPiece).join('')}</div>
      <div class="day-block" style="margin-top:8px"><b>Plan:</b> ${esc((frB || b).dayplan)}</div>
      ${missing.length ? `<div class="note" style="margin-top:6px">Missing ${missing.length} piece${missing.length > 1 ? 's' : ''} — the shopping list and buy advice boost them automatically.</div>` : '<div class="note" style="color:var(--green);margin-top:6px">✓ All comp pieces on board!</div>'}
    </div>`;
  }

  function trainerPanelHTML() {
    const t = live.trainerId;
    const td = live.trainerData || {};
    const day = live.day;
    const P = [];
    const ctl = [];
    const boardMons = live.board.filter(s => s).map(s => effMon(s)).filter(Boolean); // effMon = base + event-granted types
    switch (t) {
      case 'monster_ranger': {
        const m = td.rangerMonId ? monById[td.rangerMonId] : null;
        ctl.push(`<button class="ghost" id="tp-ranger">${m ? `<img class="sprite" src="${spr(m.sprite)}" width="22" style="vertical-align:middle"> ${esc(m.name)}` : 'Pick your Ranger monster'}</button>`);
        if (m) {
          const copies = rangerCopies(day);
          P.push(`Free copies so far: <b>${copies}</b> (next lands <b>day ${nextRangerCopyDay(day)}</b>). Copies auto-merge 3-to-1 (3 → Lv 2, 9 → Lv 3) — free copies + bought dups make this your easiest merge line.`);
          P.push(`Shop priority: every ${esc(m.name)} you buy compounds the free stream — the advisor boosts it.`);
        } else P.push('Pick the Uncommon the Ranger granted you — countdowns and advisor boosts activate.');
        break;
      }
      case 'bug_catcher': {
        ctl.push(`<label class="ctl" style="flex-direction:row;align-items:center;gap:6px">Bug bought this round? <input type="checkbox" id="tp-bug" ${td.bugBought ? 'checked' : ''}></label>`);
        P.push(td.bugBought
          ? 'First-bug discount used this round — Bug offers show normal prices. Resets on next day.'
          : '<b>First Bug you buy this round is FREE</b> — Bug offers in the shop show $0 and rank accordingly.');
        break;
      }
      case 'pyromaniac': {
        const singles = boardMons.filter(m => (m.types || []).length === 1);
        P.push(`Chef converts <b>single-typed</b> units to Fire (+2 Burn on all Fire). On your board now: ${singles.length ? singles.map(m => esc(m.name) + ' 🔥').join(', ') : 'none yet'}.`);
        P.push('Hover any unit — converted typing and the +2 Burn are shown in its stat card. Dual-typed units do NOT convert.');
        break;
      }
      case 'chemist': {
        const chemBonus = td.toxicPoison != null ? td.toxicPoison : (1 + (td.levelUps || 0));
        ctl.push(`<label class="ctl">Level-ups this run<input type="number" id="tp-chemist" min="0" value="${td.levelUps || 0}" style="width:70px"></label>`);
        P.push(`Current Chemist bonus: <b>+${chemBonus} Poison</b> on every Toxic unit${td.toxicPoison != null ? ' <span style="color:var(--green)">✓ auto-synced from your save</span>' : ' (grows +1 per ANY level-up — keep the counter honest, or battle-sync to auto-fill)'}. <b>Now applied in the sim</b> — your Toxic units\' poison and win% reflect it.`);
        break;
      }
      case 'egg_breeder': {
        const hatch = 5; // egg granted day 1; empirically hatches DAY 5 — video:
        // day-4 countdown badge reads "1", day-5 board already has the hatched
        // unit (bench egg gone). Matches the run-planner anchor ("hatch day 5").
        P.push(day < hatch ? `🥚 Purple Egg hatches <b>day ${hatch}</b> (${hatch - day} day${hatch - day > 1 ? 's' : ''} left) → level-2 Super Rare, often a <b>dual-type</b> body (e.g. Shelldra Water/Dragon) — premium for diversity carries. Keep a slot free!`
          : '🐣 Egg has hatched — the L2 Super Rare should be on your board.');
        break;
      }
      case 'gamer': {
        P.push(day < 9 ? `🎁 Mythical monster + $30 lands <b>day 9</b> (${9 - day} day${9 - day > 1 ? 's' : ''} away). Don't fill your last slot on day 8.`
          : '🎁 Day-9 drop is live — the Mythical + $30 should have arrived.');
        break;
      }
      case 'lucky_girl':
        P.push('✨ Shiny odds boosted — check every shop for shinies (mark them on chips: Alt+click). Shiny Berry / Rainbow Pearl double down.');
        break;
      case 'mad_scientist': {
        const empty = live.board.filter(s => !s).length;
        if (day < 7) {
          P.push(`⚗️ Day-7 transform: your ACTIVE team becomes random L1 Legendaries in <b>${7 - day} day${7 - day > 1 ? 's' : ''}</b>. ${empty ? `<b style="color:var(--red)">${empty} empty slot${empty > 1 ? 's' : ''} = wasted Legendaries — fill them by day 6!</b>` : 'All 6 slots filled ✓'}`);
          // The transform outputs L1 regardless of input, so unit COUNT is all that
          // matters pre-day-7. Merging (3 bodies → 1 leveled unit) throws away
          // Legendaries; leveling/expensive buys are pure waste. Only lives, gold,
          // badges & trinkets survive. (Observed: strong Humbolt run left dupes
          // UNMERGED, filled 6 cheap commons, hoarded ~$65 into the transform.)
          const leveled = live.board.filter(s => s && (s.level || 1) >= 2).length;
          if (leveled) P.push(`<b style="color:var(--red)">Don't merge before day 7</b> — a merged unit becomes just <b>ONE</b> Legendary, not the bodies you fed it. You have ${leveled} leveled unit${leveled > 1 ? 's' : ''} on board = wasted value. Fill with the <b>cheapest commons</b>, leave duplicates un-merged.`);
          else P.push(`Fill 6 slots with the <b>cheapest commons</b> and <b>never merge</b> — only unit COUNT matters (each becomes an L1 Legendary). Leave duplicates un-merged as separate bodies.`);
          if (live.gold >= 25) P.push(`💰 <b>Hoard gold ($${live.gold})</b> — only lives/gold/badges/trinkets survive the wipe. Bank it for the post-day-7 reroll blitz to find & duplicate your carry (don't over-buy filler now).`);
          P.push(`Expect to <b>lose some lives</b> on the cheap board — that's fine, just don't spiral: keep enough to not hemorrhage ❤.`);
        } else {
          P.push('Transform fired on day 7 — you are playing Legendaries now. Concentrate levels into your best multicast/scaling carry, stack its type, and cut off-type bodies.');
        }
        break;
      }
      case 'masked_man': {
        const opts = D.trainers.filter(x => x.id !== 'masked_man').map(x => `<option value="${x.id}" ${td.maskTrainerId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
        ctl.push(`<label class="ctl">Mask currently copies<select id="tp-mask"><option value="">— none yet —</option>${opts}</select></label>`);
        const nextMask = day % 4 === 0 ? day + 4 : day + (4 - (day % 4));
        P.push(`🎭 New mask choice every 4 days (next: <b>day ${nextMask}</b>). Pick the copied trainer above — its full logic (pricing, boosts, panels) applies here.`);
        if (td.maskTrainerId) P.push(`Copied: <b>${esc((D.trainers.find(x => x.id === td.maskTrainerId) || {}).name || '')}</b> — advisor scores with it.`);
        break;
      }
      case 'musician': {
        const elec = boardMons.filter(m => (m.types || []).some(ty => ty.id === 'electric'));
        P.push(elec.length === 1
          ? `🎸 Bonus <b style="color:var(--green)">ON</b>: ${esc(elec[0].name)} has +150% Shock. Do NOT add a second Electric.`
          : elec.length === 0
            ? '🎸 Bonus <b style="color:var(--gold)">idle</b> — add exactly ONE Electric carry to turn on +150% Shock.'
            : `🎸 Bonus <b style="color:var(--red)">OFF</b> — ${elec.length} Electrics on board. Sell down to exactly one.`);
        break;
      }
      case 'redhead': {
        ctl.push(`<label class="ctl">Victories so far<input type="number" id="tp-redhead" min="0" value="${td.victories || 0}" style="width:70px"></label>`);
        P.push(`🔥 Accumulated: <b>+${2 * (td.victories || 0)} Burn</b> on your Fire units (+2 per victory, permanent).`);
        break;
      }
      case 'lady':
        P.push('💰 Started at shop rank +2 — higher rarities arrive ~1 tier early. The shopping list below already accounts for it.');
        break;
      case 'shopkeeper':
        P.push('🛒 Items stock 1 rarity higher at 15% off — spend through the item shop aggressively; Berroon/Craghorn item engines love this.');
        break;
      case 'swim_coach':
        P.push('🌊 Free random Water Batomon every day (odds follow your shop rank). Keep bench space; Torrantler turns the stream into a win condition.');
        break;
      case 'treasure_hunter':
        P.push('🗺️ Trinket gifts offer +1 rarity tier — the Trinket intel below is your priority list; expect Legendary options early.');
        break;
      case 'youngster_m':
        P.push('🔄 3 free rerolls every day — always burn all three before paying gold for rerolls.');
        break;
      case 'youngster_f':
        P.push('✨ (Lucky Girl) Shiny odds boosted — mark shinies with Alt+click.');
        break;
      default:
        if (t) P.push('Passive applied at run level — no live tracking needed.');
    }
    if (!t) return '';
    return `<div class="card" style="margin-top:12px" id="lv-trainer-panel"><h3>🧠 ${esc((D.trainers.find(x => x.id === t) || {}).name || 'Trainer')} logic — live</h3>
      ${ctl.length ? `<div class="tier-controls" style="margin:8px 0">${ctl.join('')}</div>` : ''}
      <ul style="margin:6px 0 0 18px;font-size:12.5px">${P.map(p => `<li>${p}</li>`).join('')}</ul></div>`;
  }
  function effectiveTrainerId() {
    const td = live.trainerData || {};
    return live.trainerId === 'masked_man' && td.maskTrainerId ? td.maskTrainerId : live.trainerId;
  }
  // Effective item price. SHOPKEEPER: "your shop stocks Item 1 rarity tier higher
  // and cost 15% LESS" → every item is ×0.85 (Apex Bait $20 → $17). Pass a trainer
  // id to price for a sandbox context; defaults to the live trainer.
  function itemCost(it, tid) {
    const base = it && +it.cost || 0;
    if (!base) return base;
    return (tid || effectiveTrainerId()) === 'shopkeeper' ? Math.round(base * 0.85) : base;
  }

  // ---------------- LIVE RUN TAB (cockpit) ----------------
  // EXACT income (batodex.com/wiki/income): income = 25 + min(80, day × 5).
  // Day 1 = 30g … capped 105g from day 16. Arrives at the START of each day,
  // so day-1 starting gold is exactly 30.
  const incomeFor = (day) => 25 + Math.min(80, day * 5);
  // Shop rarity odds by shop level (batodex.com/wiki/shop). Mythical never rolls in shop.
  const SHOP_ODDS = {
    1: [100, 0, 0, 0, 0], 2: [90, 10, 0, 0, 0], 3: [75, 25, 0, 0, 0], 4: [67, 30, 3, 0, 0],
    5: [55, 30, 15, 0, 0], 6: [45, 32, 20, 3, 0], 7: [30, 40, 25, 5, 0], 8: [25, 30, 35, 10, 0],
    9: [20, 25, 38, 15, 2], 10: [15, 20, 40, 20, 5], 11: [10, 20, 35, 25, 10], 12: [5, 15, 30, 35, 15],
    13: [1, 10, 30, 39, 20], 14: [1, 2, 20, 47, 30],
  };
  const RAR_NAMES = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'];
  function effectiveOdds(rank, trinketIds) {
    let odds = (SHOP_ODDS[Math.min(Math.max(rank, 1), 14)] || SHOP_ODDS[14]).slice();
    const tk = trinketIds || live.trinkets; // sandbox (Shop Advisor) passes [] — no live-run leakage
    const has = (name) => tk.some(id => (D.trinkets.find(t => t.id === id) || {}).name === name);
    if (has('Research Notes')) odds[4] += 20;               // +20 Legendary weight
    if (has('VIP Pass')) { odds[0] = 0; odds[1] = 0; }      // bans Common/Uncommon
    const sum = odds.reduce((a, b) => a + b, 0) || 1;
    return odds.map(o => +(100 * o / sum).toFixed(1));
  }
  const liveDefault = () => ({
    day: 1,
    gold: incomeFor(1), // exactly 30
    lives: 10, badges: 0, shopRank: 1,
    trainerId: null, trainerData: {}, board: [null, null, null, null, null, null], bench: [null, null, null, null], trinkets: [], shop: [], history: [],
    hp: 300, hpBaseByDay: {}, shopLocked: false,
  });
  let live = JSON.parse(localStorage.getItem('bc_live') || 'null') || liveDefault();
  // decision-time snapshots (chess.com-style grading needs the ranks AS THEY
  // WERE when the player acted, not a post-hoc recompute)
  let lastShopRanks = null, lastRerollVerdict = null, lastSellSnapshot = null, lastItemAdvice = {}, lastPrediction = null, lastLiveWin = null;
  if (!live.trainerData) live.trainerData = {};
  if (!Array.isArray(live.history)) live.history = [];
  if (!Array.isArray(live.runLog)) live.runLog = []; // per-run decision log (strategies adopted, event choices) for Game History drill-down
  if (!Array.isArray(live.shopItems)) live.shopItems = [];
  if (!Array.isArray(live.bench)) live.bench = [];
  while (live.bench.length < 4) live.bench.push(null); // in-game bench = 4 slots
  if (live.shopRank == null) live.shopRank = Math.min(live.day, 14);
  if (!live.hpBaseByDay) live.hpBaseByDay = {};
  if (!(live.hp > 0)) live.hp = 300;

  // trinket-driven gold income applied automatically on day end
  function trinketIncome(won) {
    let g = 0;
    const has = (id) => live.trinkets.includes(id);
    const count = (id) => live.trinkets.filter(x => x === id).length;
    g += 3 * count('gold_nugget') + 10 * count('gold_bar') + 30 * count('gold_o_matic');
    if (won) g += 8 * count('gold_trophy') + 100 * count('holy_grail');
    if (has('piggy_bank')) g += Math.floor(live.gold / 10) * count('piggy_bank');
    return g;
  }
  // Single source of truth for "+$N tomorrow" — base income + passive trinket
  // gold (loss case). EVERY panel that prints next income must use this so the
  // coordination card, plan box, sell box and reroll LOCK verdict never disagree.
  const nextIncomeL = () => incomeFor(Math.min(live.day + 1, 40)) + trinketIncome(false);
  function endDay(won) {
    // with game sync ON the save is the source of truth — day/gold/lives/badges
    // arrive from the game and battle results are recorded AUTOMATICALLY on day
    // transitions. Clicking here too would double-apply everything (the bug).
    if (syncEnabled()) {
      buyNote('⚡ Game sync records battles automatically — day, gold, lives, badges and history follow the game. Turn sync OFF to drive manually.');
      return;
    }
    const snapshot = {
      day: live.day, won,
      board: live.board.filter(s => s).map(s => ({ id: s.monsterId, lvl: s.level, shiny: s.shiny })),
      badges: live.badges, lives: live.lives, gold: live.gold,
    };
    if (won) {
      live.badges = Math.min(live.badges + 1, 10);
      if (live.trainerId === 'redhead') live.trainerData.victories = (live.trainerData.victories || 0) + 1; // auto-track Redhead
    } else {
      live.lives = Math.max(live.lives - 1, 0);
    }
    live.day = Math.min(live.day + 1, 40);
    // exact income arrives at the START of the new day: 25 + min(80, day×5) + trinkets
    const inc = incomeFor(live.day) + trinketIncome(won);
    live.gold += inc;
    snapshot.income = inc;
    snapshot.after = { badges: live.badges, lives: live.lives, gold: live.gold };
    live.history.unshift(snapshot);
    live.history = live.history.slice(0, 40);
    if (live.shopLocked) live.shopLocked = false; // locked offers carry to the new day (empty slots refill in-game)
    else { live.shop = []; live.shopItems = []; }
    live.trainerData.bugBought = false;
    live.hp = suggestedHP(live.day); // HP bar follows the day (+ trinket boosts)
    saveLive(); renderLive();
  }
  function saveLive() { localStorage.setItem('bc_live', JSON.stringify(live)); }
  // 📐 MULTI-PLAN — adopt up to 3 strategies at once. `live.plans` is the ordered source
  // of truth (plans[0] = PRIMARY); `live.plan` is kept === plans[0] so every existing
  // single-plan consumer (buildById(live.plan), plan card, shop compIds…) keeps working
  // unchanged. The Run Brain reasons over the whole set and says when to chase which.
  if (live.plan && !Array.isArray(live.plans)) live.plans = [live.plan]; // migrate old single-plan saves
  if (!Array.isArray(live.plans)) live.plans = [];
  if (live.plans.length && live.plan !== live.plans[0]) live.plan = live.plans[0];
  const PLAN_CAP = 3;
  const planIds = () => (live.plans && live.plans.length ? live.plans.slice() : (live.plan ? [live.plan] : []));
  function togglePlan(id) {
    if (!id) return;
    if (!Array.isArray(live.plans)) live.plans = live.plan ? [live.plan] : [];
    const i = live.plans.indexOf(id);
    if (i >= 0) live.plans.splice(i, 1);                                    // un-adopt
    else { live.plans.push(id); if (live.plans.length > PLAN_CAP) live.plans.shift(); } // adopt (drop oldest past the cap)
    live.plan = live.plans[0] || null; saveLive();
  }
  function setPrimaryPlan(id) { // promote an adopted plan to primary
    if (!Array.isArray(live.plans)) live.plans = [];
    const i = live.plans.indexOf(id);
    if (i > 0) { live.plans.splice(i, 1); live.plans.unshift(id); } else if (i < 0) { live.plans.unshift(id); if (live.plans.length > PLAN_CAP) live.plans.pop(); }
    live.plan = live.plans[0] || null; saveLive();
  }

  // ♟️ MULTI-STRATEGY — adopt up to 3 strategy PLAYS (engines: poison ramp, burn,
  // bug feeder…) at once. Same shape as multi-plan: `live.strategies` is the ordered
  // truth (strategies[0] = PRIMARY), and `live.strategy` is kept === strategies[0] so
  // every existing activeStrategy() consumer (buy focus, board arrangement, protection,
  // engine-status) keeps working unchanged. The strategy brain reasons over the whole
  // set: whether the plays STACK (amplify each other) or COMPETE for slots, and — vs the
  // enemy you're about to face — which one to CHASE now and when to flip.
  // Re-establish the multi-strategy invariants on `live`: migrate old single-strategy
  // saves, drop malformed entries, and make live.strategy the SAME object as
  // strategies[0]. MUST run after every place `live` is (re)assigned wholesale — the
  // initial load AND the cross-tab `storage` handler (a fresh JSON.parse breaks the
  // reference identity that board-arrangement's activeStrategy() relies on).
  function normalizeLiveStrategies() {
    if (live.strategy && !Array.isArray(live.strategies)) live.strategies = [live.strategy]; // migrate old single-strategy saves
    if (!Array.isArray(live.strategies)) live.strategies = [];
    live.strategies = live.strategies.filter(s => s && s.id);   // drop malformed entries (bad share codes etc.)
    live.strategy = live.strategies[0] || null;                 // primary invariant: live.strategy === strategies[0] (or null)
  }
  normalizeLiveStrategies();
  const STRAT_CAP = 3;
  function toggleStrategy(id, focusId) {
    if (!id) return;
    if (!Array.isArray(live.strategies)) live.strategies = live.strategy ? [live.strategy] : [];
    const i = live.strategies.findIndex(s => s && s.id === id);
    if (i >= 0) live.strategies.splice(i, 1);                                              // un-adopt (toggle off)
    else { live.strategies.push({ id, focusId: focusId || null, day: live.day }); if (live.strategies.length > STRAT_CAP) live.strategies.splice(1, 1); } // adopt (over cap → drop oldest SECONDARY, keep the steering primary at [0])
    live.strategy = live.strategies[0] || null; saveLive();
  }
  function setPrimaryStrategy(id) { // promote an adopted play to primary (the one the board optimizer aims at)
    if (!Array.isArray(live.strategies)) live.strategies = [];
    const i = live.strategies.findIndex(s => s && s.id === id);
    if (i > 0) { const [s] = live.strategies.splice(i, 1); live.strategies.unshift(s); }
    live.strategy = live.strategies[0] || null; saveLive();
  }

  // ---------------- GAME HISTORY (completed runs archive) ----------------
  // Every finished run is snapshotted to localStorage so the cockpit can show a
  // list of past games and, on click, the full day-by-day breakdown: results,
  // strategies adopted, event choices, final board.
  const loadRuns = () => { try { return JSON.parse(localStorage.getItem('bc_runs') || '[]'); } catch (e) { return []; } };
  const saveRuns = (arr) => localStorage.setItem('bc_runs', JSON.stringify(arr.slice(0, 40)));
  function runResult() {
    if (live.badges >= 10) return 'won';
    if (live.lives <= 0) return 'lost';
    return 'ended';
  }
  // Archive the CURRENT run. Idempotent per run id: updates the existing entry
  // (a run first archived on death is refreshed if more happens before reset).
  function archiveRun(reason) {
    if (!live.history.length && !live.badges && !(live.board || []).some(Boolean)) return; // nothing meaningful
    const id = live.syncRunId || ('local-' + (live.day) + '-' + (live.trainerId || '?'));
    const runs = loadRuns();
    const entry = {
      id, endedReason: reason || runResult(), result: runResult(),
      trainer: live.trainerId, trainerName: (D.trainers.find(t => t.id === live.trainerId) || {}).name || live.trainerId,
      badges: live.badges, lives: live.lives, day: live.day,
      // synced runs: badges = wins (a badge IS a battle win); losses = lives lost
      // (maxLives − current, matches the hearts). Manual runs use the ✓/✗ history.
      wins: live.syncRunId ? (live.badges || 0) : live.history.filter(h => h.won).length,
      losses: live.syncRunId ? Math.max((live.maxLives || 3) - live.lives, 0) : live.history.filter(h => !h.won).length,
      finalBoard: (live.board || []).filter(Boolean).map(s => ({ id: s.monsterId, lvl: s.level, shiny: s.shiny })),
      trinkets: (live.trinkets || []).slice(),
      plan: live.plan || null,
      strategy: live.strategy ? live.strategy.id : null, // primary (back-compat)
      strategies: activeStrategies().map(s => s.id),      // full adopted set
      history: live.history.slice(), runLog: live.runLog.slice(),
      savedAtDay: live.day,
      endedAt: Date.now(), // wall-clock stamp → powers the activity heatmap + true chronology
      isRanked: !!live.isRanked, // per-run ranked flag → lets the rank chart use only ranked runs later
    };
    const i = runs.findIndex(r => r.id === id);
    if (i >= 0) {
      // NO-REGRESS guard: at the new-run transition, archiveRun runs with live.*
      // ALREADY flipped to the fresh run (day 1, 0 badges) but syncRunId still on
      // the OLD id — an unconditional overwrite there DESTROYED finished runs
      // (a 10-badge champion became "ended · 0🏅 · day 1"). Never let a re-archive
      // regress a record to fewer badges / an earlier day.
      const ex = runs[i];
      if ((entry.badges || 0) < (ex.badges || 0) || ((entry.badges || 0) === (ex.badges || 0) && (entry.day || 0) < (ex.day || 0))) return;
      if (ex.endedAt) entry.endedAt = ex.endedAt; // keep the first-finished stamp across re-archives
      if (ex.isRanked) entry.isRanked = true;     // a run that finished ranked stays ranked (don't let a re-archive un-rank it)
      runs[i] = entry;
    } else runs.unshift(entry);
    saveRuns(runs);
  }
  // 🔔 browser notification (opt-in via the bell; silently no-ops otherwise)
  function bcNotify(title, body) {
    try {
      if (localStorage.getItem('bc_notify') !== '1' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      new Notification(title, { body, icon: 'sprites/monster/magmite.png', silent: true });
    } catch (e) {}
  }
  // log a notable decision into the current run's timeline
  function logRun(type, detail) {
    if (!Array.isArray(live.runLog)) live.runLog = [];
    live.runLog.unshift({ day: live.day, type, detail });
    live.runLog = live.runLog.slice(0, 80);
  }
  const RESULT_META = {
    won: { label: '🏆 CHAMPION', color: 'var(--gold)', border: 'rgba(240,196,64,.5)' },
    lost: { label: '💀 DIED', color: 'var(--red)', border: 'rgba(255,77,94,.4)' },
    abandoned: { label: '↩ ABANDONED', color: 'var(--muted)', border: 'var(--border)' },
    ended: { label: '⏹ ENDED', color: 'var(--muted)', border: 'var(--border)' },
  };
  const runSprites = (arr, sz) => (arr || []).map(b => { const m = monById[b.id]; return m ? `<img class="sprite" src="${spr(b.shiny && m.shinySprite ? m.shinySprite : m.sprite)}" width="${sz || 24}" height="${sz || 24}" title="${esc(m.name)} L${b.lvl}${b.shiny ? ' ✨' : ''}">` : ''; }).join('');
  // 📊 GPI-style radar for ONE run (Mobalytics pattern, anchored to fixed
  // reference points since there's no population data yet — anchors documented
  // in each dim's title). 0–100 per dimension.
  function runRadarDims(run) {
    const hist = run.history || [];
    const pace = run.day > 1 ? (run.badges || 0) / (run.day - 1) : 0;
    const wr = (run.wins + run.losses) ? run.wins / (run.wins + run.losses) : 0;
    const lossGold = hist.filter(h => !h.won && h.after).map(h => h.after.gold || 0);
    const avgHoard = lossGold.length ? lossGold.reduce((a, b) => a + b, 0) / lossGold.length : 0;
    const stratDay = Math.min(...(run.runLog || []).filter(l => l.type === 'strategy').map(l => l.day), Infinity);
    const buys = (run.runLog || []).filter(l => l.type === 'decision' && /🛒/.test(l.detail));
    const follow = buys.length ? buys.filter(l => /✓ top pick|✓ meilleur choix/.test(l.detail)).length / buys.length : null;
    return [
      { k: 'Tempo', v: Math.round(Math.min(pace / 0.55, 1) * 100), why: `badge pace ${pace.toFixed(2)}/day vs champion ~0.55` },
      { k: 'Battles', v: Math.round(wr * 100), why: `battle win-rate ${Math.round(wr * 100)}%` },
      { k: 'Econ', v: Math.round(Math.max(100 - avgHoard / 2, 10)), why: lossGold.length ? `avg $${Math.round(avgHoard)} banked on loss days (lower hoard = higher score)` : 'no loss days recorded' },
      { k: 'Commit', v: stratDay !== Infinity ? Math.round(Math.max(100 - (stratDay - 1) * 12, 25)) : (run.strategy ? 60 : 15), why: stratDay !== Infinity ? `strategy adopted day ${stratDay}` : run.strategy ? 'strategy adopted (day unknown — legacy run)' : 'no strategy adopted' },
      { k: 'Align', v: follow != null ? Math.round(follow * 100) : null, why: follow != null ? `followed the brain's #1 in ${Math.round(follow * 100)}% of tracked buys` : 'no tracked buys yet — plays sync-recorded runs' },
    ];
  }
  // 🎖 rank → MMR estimation. Bands anchored to the 712 crawled ladder players
  // (real data: the one Diamond sits ≈1.2k, Master spans 1905–3516) — low-tier
  // widths are assumptions and SAY SO in the tooltip. 8 divisions/tier, 5 stars
  // each. Any real MMR (save, manual, opponents-avg) outranks this estimate.
  const RANK_TIERS = [
    { id: 'Bronze', base: 100, c: '#cd7f32', icon: '🥉' },
    { id: 'Silver', base: 400, c: '#c9ced6', icon: '🥈' },
    { id: 'Gold', base: 700, c: '#f0c440', icon: '🥇' },
    { id: 'Platinum', base: 1000, c: '#7fd4d4', icon: '💠' },
    { id: 'Diamond', base: 1200, c: '#b9e2ff', icon: '💎' },
    { id: 'Master', base: 1900, c: '#c77bff', icon: '👑' },
  ];
  // ---- Ranked ladder math (exact in-game rule, confirmed 2026-07-15) ----
  // A ranked run changes your STARS by (badges − 5), clamped to ±5:
  //   0🏅 → −5★ · 5🏅 → No Change · 10🏅 → +5★.  A division = exactly 5 stars
  //   (filling the 5th PROMOTES immediately). Division NUMBERS COUNT DOWN as you
  //   climb: Gold 6 → Gold 5 → … → Gold 1 → Platinum. Model = 8 divs/tier.
  const DIVS_PER_TIER = 8;
  const rankStarDelta = (badges) => Math.max(-5, Math.min(5, (+badges || 0) - 5));
  // Flatten {tier,div,stars} to a single monotonic ladder index so promotion /
  // demotion is plain integer math (higher index = higher rank). Stars rest 0–4.
  function rankToIndex(r) {
    const ti = Math.max(0, RANK_TIERS.findIndex(t => t.id.toLowerCase() === String(r.tier || '').toLowerCase()));
    const div = Math.min(Math.max(+r.div || 1, 1), DIVS_PER_TIER);
    const stars = Math.min(Math.max(+r.stars || 0, 0), 4);
    return ti * DIVS_PER_TIER * 5 + (DIVS_PER_TIER - div) * 5 + stars; // div counts DOWN
  }
  function indexToRank(idx) {
    const MAXI = RANK_TIERS.length * DIVS_PER_TIER * 5 - 1;
    const clamped = Math.max(0, Math.min(MAXI, Math.round(idx)));
    const ti = Math.floor(clamped / (DIVS_PER_TIER * 5));
    const within = clamped - ti * DIVS_PER_TIER * 5;
    const T = RANK_TIERS[ti];
    return { tier: T.id, div: DIVS_PER_TIER - Math.floor(within / 5), stars: within % 5, icon: T.icon, c: T.c, atFloor: clamped <= 0, atCeil: clamped >= MAXI };
  }
  const projectRank = (rank, delta) => (rank && rank.tier) ? indexToRank(rankToIndex(rank) + delta) : null;
  // A division holds 0–4★; the 5th PROMOTES (div counts DOWN, div 1 → next tier). The
  // manual star picker can land on 5★, but rankToIndex clamps stars to 4 — so normalize
  // a saved 5★ into the promotion it represents, keeping the ranked card and rank chart
  // in agreement (they both derive from the stored {tier,div,stars}).
  function normalizeRankStars(r) {
    let tier = r.tier, div = Math.min(Math.max(+r.div || 1, 1), DIVS_PER_TIER), stars = Math.min(Math.max(+r.stars || 0, 0), 5);
    if (stars >= 5) {
      stars = 0;
      if (div > 1) div -= 1;
      else { const ti = RANK_TIERS.findIndex(t => t.id.toLowerCase() === String(tier).toLowerCase()); if (ti >= 0 && ti < RANK_TIERS.length - 1) { tier = RANK_TIERS[ti + 1].id; div = DIVS_PER_TIER; } }
    }
    return Object.assign({}, r, { tier, div, stars });
  }
  const rankStr = (r) => r ? `${String(r.tier).toUpperCase()} ${r.div}${r.stars ? ` ${r.stars}★` : ''}` : '—';
  // Live ranked projection — what THIS run's badge count does to your ladder.
  // Blends the exact star-delta rule with your saved rank baseline (bc_rankmanual).
  // opts.final = run is over (wording + optional ✓ Apply button); opts.runSig
  // guards against double-applying the same run's delta.
  function rankedProjectionHTML(badges, opts) {
    opts = opts || {};
    const delta = rankStarDelta(badges);
    const deltaTxt = delta === 0 ? 'No Change' : `${delta > 0 ? '+' : ''}${delta}★`;
    const dColor = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--muted)';
    let manual = null; try { manual = JSON.parse(localStorage.getItem('bc_rankmanual') || 'null'); } catch (e) {}
    let last = null; try { last = JSON.parse(localStorage.getItem('bc_rankLastApplied') || 'null'); } catch (e) {}
    // Once THIS run's delta is applied, bc_rankmanual IS the post-run rank — show
    // the STORED transition (pre→post), NEVER re-project off the updated baseline
    // (that double-counted a champion's +5★, turning a correct Gold 5 into Gold 4).
    const applied = !!(opts.final && opts.runSig && last && last.runSig === opts.runSig && last.to);
    let from, to;
    if (applied) { from = last.from; to = last.to; }
    else {
      from = manual && manual.tier ? { tier: manual.tier, div: manual.div, stars: manual.stars } : null;
      to = from ? projectRank(from, delta) : null;
    }
    const crossed = from && to && to.tier !== from.tier;
    const promoted = from && to && rankToIndex(to) > rankToIndex(from);
    const arrow = to
      ? `<b>${rankStr(from)}</b> → <b style="color:${indexToRank(rankToIndex(to)).c}">${rankStr(to)}</b>${crossed ? (promoted ? ' <span class="chip good" style="font-size:9px">PROMOTION</span>' : ' <span class="chip" style="font-size:9px;color:#fff;background:var(--red)">DEMOTION</span>') : ''}`
      : `<span class="note" style="margin:0">set your rank in <b>Profile → 🎖</b> to project where it lands</span>`;
    let applyBtn = '';
    if (opts.final && from && to && delta !== 0) {
      applyBtn = applied
        ? `<span class="chip good" style="margin-left:auto;font-size:10px" title="Applied at run end — your saved rank is now ${esc(rankStr(to))}">🎖 Rank updated → ${rankStr(to)}</span> <button class="ghost rank-undo" style="font-size:9px;padding:2px 7px" title="Restore your rank to what it was before this run">↶ undo</button>`
        : `<button class="primary rank-apply" data-to='${esc(JSON.stringify({ tier: to.tier, div: to.div, stars: to.stars, mmr: manual.mmr || null }))}' data-from='${esc(JSON.stringify(from))}' data-sig="${esc(opts.runSig || '')}" style="margin-left:auto;font-size:11px;padding:3px 12px" title="Writes ${rankStr(to)} to your saved rank">✓ Apply ${deltaTxt}</button>`;
    }
    return `<div class="reroll-note" style="border-color:${dColor};margin-top:${opts.final ? 4 : 10}px;display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px">
      <b style="color:var(--gold)">🎖 Ranked${opts.final ? ' result' : ''}</b>
      <span>${opts.final ? 'final' : 'if you stop now'} at <b>${badges}</b>🏅 = <b style="color:${dColor}">${deltaTxt}</b></span>
      <span style="color:var(--muted)">${arrow}</span>${applyBtn}
    </div>`;
  }
  // Auto-apply a finished RANKED run's star delta to the saved rank (design goal: the
  // companion must "remember rank and update when loss or win in ranked" — no
  // manual click). Applied at most once per run (bc_rankLastApplied guard); backs
  // up the prior rank to bc_rankUndo. No-op if no rank baseline is set yet.
  function autoApplyRankedResult(badges, runSig) {
    if (!runSig) return null;
    let last = null; try { last = JSON.parse(localStorage.getItem('bc_rankLastApplied') || 'null'); } catch (e) {}
    if (last && last.runSig === runSig) return null; // this run's delta already applied
    let manual = null; try { manual = JSON.parse(localStorage.getItem('bc_rankmanual') || 'null'); } catch (e) {}
    if (!manual || !manual.tier) return null;
    const from = { tier: manual.tier, div: manual.div, stars: manual.stars };
    const delta = rankStarDelta(badges);
    const to = projectRank(from, delta);
    localStorage.setItem('bc_rankUndo', localStorage.getItem('bc_rankmanual') || '');
    localStorage.setItem('bc_rankmanual', JSON.stringify({ tier: to.tier, div: to.div, stars: to.stars, mmr: manual.mmr || null, at: Date.now() }));
    // record the EXACT transition so the banner displays pre→post without re-projecting
    localStorage.setItem('bc_rankLastApplied', JSON.stringify({ runSig, from, to: { tier: to.tier, div: to.div, stars: to.stars }, delta }));
    return { delta, to };
  }
  function estMMRFromRank(m) {
    const ti = RANK_TIERS.findIndex(t => t.id.toLowerCase() === String(m.tier || '').toLowerCase());
    if (ti < 0) return null;
    const t = RANK_TIERS[ti];
    const width = RANK_TIERS[ti + 1] ? RANK_TIERS[ti + 1].base - t.base : 600;
    const divStep = width / DIVS_PER_TIER, starStep = divStep / 5;
    // div counts DOWN → div 1 (top of tier) sits highest, div 8 (bottom) at base
    return Math.round(t.base + (DIVS_PER_TIER - Math.min(Math.max(+m.div || 1, 1), DIVS_PER_TIER)) * divStep + Math.min(Math.max(+m.stars || 0, 0), 5) * starStep);
  }
  // ---- learned low-tier MMR curve (calibrated from YOUR ranked runs) ----
  // RANK_TIERS' low bands are assumptions (video- + save-confirmed WRONG: Gold reads
  // ~95 in your faced_opponent_mmrs, not 700). Each ranked run pins the opponents you
  // faced (≈ your MMR — matchmaking pairs similar ratings) to the rank you were at →
  // bc_rankAnchors. Aggregate those by rank, then for a target rank INTERPOLATE
  // between your observed anchors, or EXTRAPOLATE an unobserved tier by shifting the
  // fictional band by your nearest anchor's offset. Falls back to the raw band when
  // you have no anchors yet. Fixes the low-tier scale WITHOUT any berrymint/save help.
  function rankAnchorPoints() {
    let raw = {}; try { raw = JSON.parse(localStorage.getItem('bc_rankAnchors') || '{}'); } catch (e) {}
    const byIdx = {};
    for (const k in raw) { const a = raw[k]; if (!a || !a.n) continue; const b = (byIdx[a.idx] = byIdx[a.idx] || { n: 0, sum: 0 }); b.n += a.n; b.sum += a.sum; }
    return Object.entries(byIdx).map(([idx, v]) => ({ idx: +idx, mmr: v.sum / v.n, n: v.n })).sort((a, b) => a.idx - b.idx);
  }
  function learnedMMRForRank(m) {
    const band = estMMRFromRank(m);
    const pts = rankAnchorPoints();
    if (!pts.length) return band != null ? { mmr: band, learned: false, anchors: 0, samples: 0 } : null;
    const xi = rankToIndex(m), samples = pts.reduce((a, p) => a + p.n, 0), TIER = DIVS_PER_TIER * 5;
    let lo = null, hi = null;
    for (const p of pts) { if (p.idx <= xi) lo = p; if (p.idx >= xi && !hi) hi = p; }
    if (lo && hi) { // between two anchors (or exact) → linear interpolate, always trusted
      const mmr = lo.idx === hi.idx ? lo.mmr : lo.mmr + (hi.mmr - lo.mmr) * (xi - lo.idx) / (hi.idx - lo.idx);
      return { mmr: Math.max(0, Math.round(mmr)), learned: true, anchors: pts.length, samples };
    }
    // extrapolation: trust only within ~1.5 tiers of your nearest anchor (the scale is
    // regime-dependent — a Gold anchor must NOT compress the ~right Master band). Use a
    // PROPORTIONAL correction (bands are ratio-off, not offset-off) so it never goes ≤0.
    const anc = lo || hi;
    // too far from any anchor → fall back to the band; but band can be null (unknown
    // tier), so never return a null mmr (the caller does mmr.toLocaleString()).
    if (Math.abs(xi - anc.idx) > TIER * 1.5) return { mmr: band != null ? band : Math.max(0, Math.round(anc.mmr)), learned: false, anchors: pts.length, samples };
    const bAnc = estMMRFromRank(indexToRank(anc.idx));
    const mmr = (band != null && bAnc) ? band * (anc.mmr / bAnc) : anc.mmr;
    return { mmr: Math.max(0, Math.round(mmr)), learned: true, anchors: pts.length, samples };
  }
  function runRadarSVG(run) { return radarSVGFromDims(runRadarDims(run)); }
  let _radarSeq = 0; // unique gradient id per SVG (avoids url(#id) collisions across radars)
  function radarSVGFromDims(dims, px) {
    // wide viewBox + side-aware text anchors so labels never clip
    const R = 44, cx = 92, cy = 72, W = 184, H = 148;
    const size = px || 150;
    const gid = 'rg' + (_radarSeq++);
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI / dims.length);
    const pt = (i, r) => `${(cx + r * Math.cos(ang(i))).toFixed(1)},${(cy + r * Math.sin(ang(i))).toFixed(1)}`;
    const ring = (f) => dims.map((_, i) => pt(i, R * f)).join(' ');
    const poly = dims.map((d, i) => pt(i, R * ((d.v == null ? 50 : d.v) / 100))).join(' ');
    const labels = dims.map((d, i) => {
      const a = ang(i), c = Math.cos(a);
      const anchor = c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle';
      const lx = cx + (R + 10) * c, ly = cy + (R + 12) * Math.sin(a) + (Math.abs(Math.sin(a)) > 0.9 ? (Math.sin(a) < 0 ? -1 : 4) : 3);
      return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-size="10" font-weight="600" fill="${d.v == null ? '#70707a' : '#b9c2d8'}"><title>${esc(d.why)}</title>${d.k} <tspan fill="${d.v == null ? '#70707a' : '#f0c440'}">${d.v == null ? '–' : d.v}</tspan></text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:${Math.round(size * W / H)}px;height:${size}px;flex:none">
      <defs><radialGradient id="${gid}" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#9db4ec" stop-opacity="0.5"/><stop offset="1" stop-color="#5a6fae" stop-opacity="0.12"/></radialGradient></defs>
      <polygon points="${ring(1)}" fill="none" stroke="#2a2a33" stroke-width="1"/>
      <polygon points="${ring(0.75)}" fill="none" stroke="#26262f" stroke-width="0.6"/>
      <polygon points="${ring(0.5)}" fill="none" stroke="#2a2a33" stroke-width="0.7"/>
      <polygon points="${ring(0.25)}" fill="none" stroke="#22222a" stroke-width="0.5"/>
      ${dims.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, R).split(',')[0]}" y2="${pt(i, R).split(',')[1]}" stroke="#22222a" stroke-width="0.5"/>`).join('')}
      <polygon points="${poly}" fill="url(#${gid})" stroke="#8fa8e0" stroke-width="1.7"/>
      ${dims.map((d, i) => `<circle cx="${pt(i, R * ((d.v == null ? 50 : d.v) / 100)).split(',')[0]}" cy="${pt(i, R * ((d.v == null ? 50 : d.v) / 100)).split(',')[1]}" r="2" fill="#7b93c3"/>`).join('')}
      ${labels}</svg>`;
  }
  // Expanded detail for one archived run (shared by the history tab + modal):
  // full day-by-day timeline (battles + strategies + event choices) and stats.
  function runDetailHTML(run) {
    const days = {};
    (run.history || []).forEach(h => { (days[h.day] = days[h.day] || { battles: [], logs: [] }).battles.push(h); });
    (run.runLog || []).forEach(l => { (days[l.day] = days[l.day] || { battles: [], logs: [] }).logs.push(l); });
    const dayNums = Object.keys(days).map(Number).sort((a, b) => b - a);
    const icon = (t) => t === 'strategy' ? '♟️' : t === 'event' ? '🎪' : t === 'decision' ? '🧠' : '•';
    const peakGold = Math.max(0, ...(run.history || []).map(h => (h.after && h.after.gold) || 0));
    const totalIncome = (run.history || []).reduce((a, h) => a + (h.income || 0), 0);
    // 📊 RUN GRAPH (MetaTFT-style): gold / lives / badges curves across the run.
    const asc = (run.history || []).slice().filter(h => h.after).sort((a, b) => a.day - b.day);
    let graph = '';
    if (asc.length >= 2) {
      const W = 300, H = 64, PX = 8, PY = 7;
      const dMin = asc[0].day, dMax = asc[asc.length - 1].day;
      const x = (d) => PX + ((d - dMin) / Math.max(dMax - dMin, 1)) * (W - 2 * PX);
      const line = (get, color, maxPad) => {
        const vals = asc.map(get); const mx = Math.max(...vals, maxPad || 1);
        const pts = asc.map((h, i) => `${x(h.day).toFixed(1)},${(H - PY - (vals[i] / mx) * (H - 2 * PY)).toFixed(1)}`).join(' ');
        return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" opacity=".9"/>` +
          asc.map((h, i) => `<circle cx="${x(h.day).toFixed(1)}" cy="${(H - PY - (vals[i] / mx) * (H - 2 * PY)).toFixed(1)}" r="1.8" fill="${color}"><title>day ${h.day}: ${get(h)}</title></circle>`).join('');
      };
      graph = `<div style="margin:2px 0 8px"><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:460px;height:auto;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
          ${line(h => h.after.gold || 0, '#f0c440')}${line(h => h.after.lives || 0, '#ff4d5e', 5)}${line(h => h.after.badges || 0, '#3ddc84', 10)}
        </svg>
        <div style="font-size:9.5px;color:var(--muted);margin-top:2px"><span style="color:#f0c440">— gold</span> · <span style="color:#ff4d5e">— lives</span> · <span style="color:#3ddc84">— badges</span> · day ${dMin}→${dMax} (each line scaled to its own max)</div></div>`;
    }
    // ♟️ day notes (chess.com-lite): conservative observations on LOSS days
    // only — and each note fires at most once/twice per run, not every day.
    const stratDay = Math.min(...(run.runLog || []).filter(l => l.type === 'strategy').map(l => l.day), Infinity);
    const cumLossByDay = {}; let cl = 0;
    asc.forEach(h => { if (!h.won) cl++; cumLossByDay[h.day] = cl; });
    const lossDays = asc.filter(h => !h.won && h.day >= 2);
    const overSaveDays = new Set(lossDays.filter(h => (h.after.gold || 0) >= 80)
      .sort((a, b) => (b.after.gold || 0) - (a.after.gold || 0)).slice(0, 2).map(h => h.day)); // 2 worst hoards only
    // "no strategy" is only claimable when the run genuinely never adopted one
    // (legacy archives have strategy set but no dated log — stay silent there)
    const noStratDay = (!run.strategy && stratDay === Infinity) ? Math.max(...lossDays.filter(h => h.day >= 6).map(h => h.day), -1) : -1;
    const bleedDay = (asc.find(h => !h.won && h.day <= 4 && cumLossByDay[h.day] === 3) || {}).day;
    const dayNotes = (dn, battle) => {
      if (!battle || battle.won || dn < 2) return '';
      const notes = [];
      if (overSaveDays.has(dn)) notes.push(`💰 lost with $${battle.after.gold} banked — over-saving? Gold you don't spend can't fight`);
      if (dn === bleedDay) notes.push('⚠️ lives bleeding early — stabilize the board before greeding');
      if (dn === noStratDay) notes.push('♟️ no strategy adopted this run — commit to an engine earlier');
      return notes.map(n => `<div style="font-size:10.5px;color:var(--gold);margin-top:2px">${n}</div>`).join('');
    };
    const timeline = dayNums.map(dn => {
      const d = days[dn]; const battle = d.battles[0];
      return `<div style="border-left:2px solid var(--border);padding:6px 0 6px 12px;margin-left:6px">
        <div style="font-weight:700;font-size:12px">Day ${dn}${battle ? ` — <span style="color:${battle.won ? 'var(--green)' : 'var(--red)'}">${battle.won ? '✓ WIN' : '✗ LOSS'}</span>` : ''}${battle ? `<span style="color:var(--muted);font-weight:400;font-size:10.5px"> · 🏅${battle.after.badges} ❤${battle.after.lives} +$${battle.income}</span>` : ''}</div>
        ${battle ? `<div style="display:flex;gap:2px;margin:3px 0">${runSprites(battle.board, 22)}</div>` : ''}
        ${dayNotes(dn, battle)}
        ${d.logs.map(l => `<div style="font-size:11px;color:var(--muted);margin-top:2px">${icon(l.type)} ${esc(l.detail)}</div>`).join('')}
      </div>`;
    }).join('') || '<div class="note">No per-day detail was recorded for this run.</div>';
    const stat = (label, val) => `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;text-align:center;min-width:74px"><div style="font-size:16px;font-weight:800;color:var(--gold)">${val}</div><div style="font-size:9.5px;color:var(--muted)">${label}</div></div>`;
    return `<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;flex:1;min-width:220px">
        ${stat('BADGES', run.badges)}${stat('DAY REACHED', run.day)}${stat('WINS', run.wins)}${stat('LOSSES', run.losses)}${stat('PEAK GOLD', '$' + peakGold)}${stat('INCOME', '$' + totalIncome)}
        </div>
        ${runRadarSVG(run)}
      </div>
      <div style="margin:-4px 0 8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="ghost sum-card-btn" style="font-size:11px">📤 Summary card</button>
        <button class="ghost run-edit-btn" style="font-size:11px" title="Fix a mis-recorded result (e.g. an old sync bug that logged the wrong badges)">✎ Correct run</button>
        <span class="run-edit-form" style="display:none;gap:6px;flex-wrap:wrap;align-items:center;font-size:11px">
          <label style="display:flex;gap:3px;align-items:center">🏅<input type="number" class="re-badges" value="${run.badges}" min="0" max="40" style="width:52px"></label>
          <label style="display:flex;gap:3px;align-items:center">W<input type="number" class="re-wins" value="${run.wins}" min="0" style="width:46px"></label>
          <label style="display:flex;gap:3px;align-items:center">L<input type="number" class="re-losses" value="${run.losses}" min="0" style="width:46px"></label>
          <select class="re-result">
            <option value="won"${run.result === 'won' ? ' selected' : ''}>🏆 Champion</option>
            <option value="lost"${run.result === 'lost' ? ' selected' : ''}>💀 Died</option>
            <option value="ended"${run.result === 'ended' ? ' selected' : ''}>⏹ Ended</option>
          </select>
          <button class="primary re-save" style="font-size:11px;padding:3px 10px">Save</button>
          <button class="ghost re-cancel" style="font-size:11px;padding:3px 8px">Cancel</button>
        </span>
      </div>
      ${graph}
      ${(() => { const c = calibrationReport(run); return c ? `<div class="note" style="margin:0 0 8px">🎯 <b>Brain calibration</b>: the event sim would have called <b>${c.hits}/${c.total}</b> of this run's battles (Brier ${c.brier}, lower is better) — replayed vs day-average enemies, final trinkets, positions approximated.${c.hits / c.total < 0.5 && c.total >= 6 ? ' <b class="wr-low">Takeaway: your real opponents ran stronger than the day-average</b> — matchmaking pairs records, so on a losing streak treat FAVORED verdicts with caution.' : ''}</div>` : ''; })()}
      ${(() => {
        const preds = (run.history || []).filter(h => h.pred != null && h.won != null);
        if (preds.length < 3) return '';
        const hits = preds.filter(h => (h.pred > 50) === !!h.won).length;
        const brier = +(preds.reduce((a, h) => a + Math.pow(h.pred / 100 - (h.won ? 1 : 0), 2), 0) / preds.length).toFixed(2);
        return `<div class="note" style="margin:0 0 8px">📼 <b>Live-model calibration</b> (predictions made in real time, full state): <b>${hits}/${preds.length}</b> called · Brier ${brier} — this is the number that matters as it accumulates.</div>`;
      })()}
      ${(() => {
        const buys = (run.runLog || []).filter(l => l.type === 'decision' && /🛒/.test(l.detail));
        if (!buys.length) return '';
        const top = buys.filter(l => /✓ top pick/.test(l.detail)).length;
        const div = buys.filter(l => /below the top pick/.test(l.detail)).length;
        return `<div class="note" style="margin:0 0 8px">🧠 <b>Decisions</b>: followed the brain's #1 pick in <b>${top}/${buys.length}</b> tracked buys${div ? ` · <b>${div}</b> big divergence${div > 1 ? 's' : ''} (≥30% below the top pick)` : ''} — per-day detail in the timeline below.</div>`;
      })()}
      <div style="margin-bottom:6px;font-size:12px"><b>Final board:</b> <span style="display:inline-flex;gap:3px;vertical-align:middle">${runSprites(run.finalBoard) || '—'}</span></div>
      ${(run.trinkets || []).length ? `<div style="margin-bottom:4px;font-size:12px"><b>💎 Trinkets:</b> ${run.trinkets.map(id => esc((D.trinkets.find(t => t.id === id) || { name: id }).name)).join(', ')}</div>` : ''}
      ${run.strategy ? `<div style="font-size:12px"><b>♟️ Strategy:</b> ${esc((STRATEGY_LIB.find(s => s.id === run.strategy) || { name: run.strategy }).name)}</div>` : ''}
      ${run.plan ? `<div style="font-size:12px"><b>🎯 Plan:</b> ${esc((G.BUILDS.find(x => x.id === run.plan) || { name: run.plan }).name || run.plan)}</div>` : ''}
      <h4 style="margin:12px 0 4px;font-size:12.5px">📅 Day-by-day — battles, strategies &amp; choices</h4>
      <div>${timeline}</div>`;
  }
  // 📤 SHAREABLE SUMMARY CARD — hand-drawn canvas (no external libs; CSP-safe).
  function openSummaryCard(run) {
    const rm = RESULT_META[run.result] || RESULT_META.ended;
    const W = 720, H = 405;
    const cv = el('canvas'); cv.width = W; cv.height = H; cv.style.cssText = 'width:100%;border-radius:12px;border:1px solid var(--border)';
    const x = cv.getContext('2d');
    // bg
    x.fillStyle = '#14141b'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#2a2a33'; x.strokeRect(0.5, 0.5, W - 1, H - 1);
    // header
    const resColor = run.result === 'won' ? '#f0c440' : run.result === 'lost' ? '#ff4d5e' : '#8a8a95';
    x.fillStyle = resColor; x.font = 'bold 26px system-ui'; x.fillText(rm.label.replace(/[^\x20-\x7E]/g, '').trim() || run.result.toUpperCase(), 28, 44);
    x.fillStyle = '#e8e8ee'; x.font = '600 18px system-ui'; x.fillText(`${run.trainerName || '?'} — Batomon Showdown`, 28, 72);
    // stat tiles
    const tiles = [['BADGES', run.badges], ['DAY', run.day], ['W-L', `${run.wins}-${run.losses}`], ['STRATEGY', run.strategy ? ((STRATEGY_LIB.find(s => s.id === run.strategy) || {}).name || '—').split(' ')[0] : '—']];
    tiles.forEach(([lab, val], i) => {
      const tx = 28 + i * 168;
      x.fillStyle = '#1b1b24'; x.fillRect(tx, 92, 152, 58);
      x.strokeStyle = '#2a2a33'; x.strokeRect(tx + 0.5, 92.5, 152, 58);
      x.fillStyle = '#f0c440'; x.font = 'bold 22px system-ui'; x.fillText(String(val), tx + 12, 122);
      x.fillStyle = '#8a8a95'; x.font = '10px system-ui'; x.fillText(lab, tx + 12, 140);
    });
    // sparkline (gold, lives, badges) from history
    const asc2 = (run.history || []).filter(h => h.after).sort((a, b) => a.day - b.day);
    if (asc2.length >= 2) {
      const gx = 28, gy = 170, gw = 664, gh = 110;
      x.fillStyle = '#101017'; x.fillRect(gx, gy, gw, gh);
      x.strokeStyle = '#2a2a33'; x.strokeRect(gx + 0.5, gy + 0.5, gw, gh);
      const dMin = asc2[0].day, dMax = asc2[asc2.length - 1].day;
      const px = (d) => gx + 10 + ((d - dMin) / Math.max(dMax - dMin, 1)) * (gw - 20);
      const drawLine = (get, color) => {
        const vals = asc2.map(get); const mx = Math.max(...vals, 1);
        x.strokeStyle = color; x.lineWidth = 2; x.beginPath();
        asc2.forEach((h, i) => { const X = px(h.day), Y = gy + gh - 10 - (vals[i] / mx) * (gh - 20); i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
        x.stroke();
      };
      drawLine(h => h.after.gold || 0, '#f0c440'); drawLine(h => h.after.lives || 0, '#ff4d5e'); drawLine(h => h.after.badges || 0, '#3ddc84');
      x.font = '10px system-ui';
      x.fillStyle = '#f0c440'; x.fillText('gold', gx + 8, gy + 14);
      x.fillStyle = '#ff4d5e'; x.fillText('lives', gx + 42, gy + 14);
      x.fillStyle = '#3ddc84'; x.fillText('badges', gx + 78, gy + 14);
    }
    // radar dims as bars
    const dims = runRadarDims(run);
    dims.forEach((d, i) => {
      const bx = 28, by = 300 + i * 17;
      x.fillStyle = '#8a8a95'; x.font = '10px system-ui'; x.fillText(d.k, bx, by + 9);
      x.fillStyle = '#1b1b24'; x.fillRect(bx + 52, by, 200, 11);
      x.fillStyle = d.v == null ? '#3a3a44' : '#7b93c3'; x.fillRect(bx + 52, by, 200 * ((d.v == null ? 50 : d.v) / 100), 11);
      x.fillStyle = '#aab'; x.fillText(d.v == null ? 'n/a' : d.v, bx + 258, by + 9);
    });
    // right column: calibration + coach line
    const c = calibrationReport(run);
    const preds = (run.history || []).filter(h => h.pred != null && h.won != null);
    x.fillStyle = '#e8e8ee'; x.font = '600 12px system-ui'; x.fillText('Brain vs reality', 330, 310);
    x.fillStyle = '#8a8a95'; x.font = '11px system-ui';
    if (preds.length >= 3) x.fillText(`live predictions: ${preds.filter(h => (h.pred > 50) === !!h.won).length}/${preds.length} called`, 330, 328);
    else if (c) x.fillText(`replay calibration: ${c.hits}/${c.total} (Brier ${c.brier})`, 330, 328);
    else x.fillText('no calibration data yet', 330, 328);
    const ins = historyInsights([run])[0];
    if (ins) { x.fillText(String(ins).replace(/<[^>]+>/g, '').slice(0, 78), 330, 346); }
    // watermark
    x.fillStyle = '#55555f'; x.font = '11px system-ui'; x.fillText('Batomon Companion — free fan tool', 330, 388);
    // modal
    const box = el('div');
    box.appendChild(el('h3', null, '📤 Run summary card'));
    box.appendChild(cv);
    const row = el('div', null, '');
    row.style.cssText = 'display:flex;gap:8px;margin-top:10px';
    const dl = el('button', 'primary', '⬇ Download PNG');
    dl.onclick = () => { const a = document.createElement('a'); a.download = `batomon-run-${run.badges}badges-day${run.day}.png`; a.href = cv.toDataURL('image/png'); a.click(); };
    const cp = el('button', 'ghost', '📋 Copy image');
    cp.onclick = () => cv.toBlob(b => { try { navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(() => { cp.textContent = '✓ Copied'; }); } catch (e) { cp.textContent = 'Copy unsupported — use Download'; } });
    row.appendChild(dl); row.appendChild(cp);
    box.appendChild(row);
    openModal(box);
  }
  // ---------------- PROFILE v2 — aggregate + chart helpers ----------------
  const TIER_ABBR = { bronze: 'B', silver: 'S', gold: 'G', platinum: 'P', diamond: 'D', master: 'M' };
  const rankShort = (r) => r ? (TIER_ABBR[String(r.tier).toLowerCase()] || '?') + (r.div || '') : '—';
  const MAX_RANK_IDX = RANK_TIERS.length * DIVS_PER_TIER * 5 - 1;
  const clampIdx = (i) => Math.max(0, Math.min(MAX_RANK_IDX, i));

  // 📈 RANK TRAJECTORY — reconstruct your ★/rank climb from the run archive using the
  // app's OWN ladder rule (★Δ = badges−5, clamped ±5), anchored to your CURRENT saved
  // rank so the newest point == where you actually sit. Walks BACKWARD from the anchor
  // applying reverse deltas, so the endpoint is exact. Oldest→newest. Only RANKED runs
  // move the ladder (per-run isRanked flag; legacy runs with no flag are treated as
  // ranked to preserve old archives). All indices are floor/ceil-CLAMPED to the real
  // ladder, and each shown ★Δ is the ACTUAL clamped move (0 at the Bronze floor), so
  // the plotted point, its rank label and its delta always agree.
  function rankTrajectory() {
    let manual = null; try { manual = JSON.parse(localStorage.getItem('bc_rankmanual') || 'null'); } catch (e) {}
    if (!manual || !manual.tier) return { pts: [], noAnchor: true };
    const chron = loadRuns().slice().filter(r => r && r.badges != null && r.isRanked !== false).reverse(); // ranked-only, oldest→newest
    if (!chron.length) return { pts: [], noAnchor: false };
    const deltas = chron.map(r => rankStarDelta(r.badges));
    const endIdx = rankToIndex(manual);          // current rank = AFTER the most recent ranked run
    const idxAfter = new Array(chron.length);
    let cur = endIdx;
    for (let i = chron.length - 1; i >= 0; i--) { idxAfter[i] = cur; cur -= deltas[i]; }
    const startIdx = clampIdx(cur);              // ladder index before the very first archived run (clamped)
    let prev = startIdx;
    const pts = [{ g: 0, idx: startIdx, delta: 0, start: true, rank: indexToRank(startIdx) }];
    chron.forEach((r, i) => {
      const ci = clampIdx(idxAfter[i]);
      pts.push({ g: i + 1, idx: ci, delta: ci - prev, badges: r.badges, trainer: r.trainerName || r.trainer || '?', result: r.result, rank: indexToRank(ci) });
      prev = ci;
    });
    return { pts, startIdx, endIdx: clampIdx(endIdx), current: indexToRank(clampIdx(endIdx)) };
  }

  // the LP-progression chart (Mobalytics style): area+line over games, colored points,
  // division gridlines, and JS-driven hover tooltips (wired by wireRankChart).
  function rankChartHTML(traj) {
    if (!traj || traj.noAnchor) return `<div class="card" style="flex:1;min-width:300px"><h3 style="margin:0 0 6px">📈 Rank progression</h3><div class="note" style="margin:0">Set your rank in the <b>🎖 Ranked</b> card, then play ranked runs — your ★/rank climb charts here, and hovering any game shows the rank, stars and the change.</div></div>`;
    const pts = traj.pts;
    if (pts.length < 2) return `<div class="card" style="flex:1;min-width:300px"><h3 style="margin:0 0 6px">📈 Rank progression</h3><div class="note" style="margin:0">Not enough ranked runs yet — the climb charts here once you have a couple.</div></div>`;
    const W = 480, H = 168, PL = 34, PR = 14, PT = 16, PB = 26;
    const idxs = pts.map(p => p.idx);
    let lo = Math.min(...idxs), hi = Math.max(...idxs);
    if (hi === lo) { hi += 5; lo -= 5; }
    const pad = Math.max(3, Math.round((hi - lo) * 0.18)); lo -= pad; hi += pad;
    const X = (i) => PL + (i / (pts.length - 1)) * (W - PL - PR);
    const Y = (idx) => PT + (1 - (idx - lo) / (hi - lo)) * (H - PT - PB);
    // division gridlines (every 5 idx = one division), labelled with the short rank
    let grid = '';
    const firstDiv = Math.ceil(lo / 5) * 5;
    const divCount = Math.floor((hi - firstDiv) / 5) + 1;
    const step = Math.max(1, Math.ceil(divCount / 5)); // ≤5 labels
    // Axis labels are rendered as HTML (not SVG <text>): the SVG stretches to fill
    // its card, so anything inside it scales by renderedWidth/viewBoxWidth — that's
    // what made these labels balloon on wide screens while the fixed-size radar's
    // stayed tiny. As HTML they use the shared type scale, so every chart agrees.
    const axis = [];
    for (let d = firstDiv, k = 0; d <= hi; d += 5, k++) {
      const yy = Y(d).toFixed(1);
      grid += `<line x1="${PL}" y1="${yy}" x2="${W - PR}" y2="${yy}" stroke="#20232c" stroke-width="1"/>`;
      if (k % step === 0) axis.push({ pct: (Y(d) / H) * 100, label: rankShort(indexToRank(clampIdx(d))) });
    }
    const axisHTML = axis.map(a => `<span class="rk-ylab" style="top:${a.pct.toFixed(2)}%">${a.label}</span>`).join('');
    const linePts = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.idx).toFixed(1)}`).join(' ');
    const area = `${X(0).toFixed(1)},${H - PB} ${linePts} ${X(pts.length - 1).toFixed(1)},${H - PB}`;
    const dots = pts.map((p, i) => {
      const col = p.start ? '#8a8a95' : p.delta > 0 ? '#3ddc84' : p.delta < 0 ? '#ff5d73' : '#8a8a95';
      return `<circle class="rankpt" data-i="${i}" cx="${X(i).toFixed(1)}" cy="${Y(p.idx).toFixed(1)}" r="3.4" fill="${col}" stroke="#0d0f14" stroke-width="1.2" style="cursor:pointer"/>`;
    }).join('');
    const cur = traj.current;
    return `<div class="card rank-chart" style="flex:1;min-width:320px;position:relative">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px"><h3 style="margin:0">📈 Rank progression</h3>
        <span style="font-size:10px;color:var(--muted)">last ${pts.length - 1} run${pts.length - 1 === 1 ? '' : 's'} · hover a point</span>
        <span style="margin-left:auto;font-size:12px;color:${cur.c};font-weight:700">${String(cur.tier).toUpperCase()} ${cur.div} ${cur.stars}★</span></div>
      <div class="rk-plot">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
          <defs><linearGradient id="rankgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa2ff" stop-opacity="0.34"/><stop offset="1" stop-color="#5aa2ff" stop-opacity="0"/></linearGradient></defs>
          ${grid}
          <polygon points="${area}" fill="url(#rankgrad)"/>
          <polyline points="${linePts}" fill="none" stroke="#5aa2ff" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          ${dots}
        </svg>
        ${axisHTML}
      </div>
      <div class="rk-foot"><span>${pts.length - 1} games ago</span><span>last game</span></div>
      <div class="rank-tip"></div>
      <div class="note rk-fine">Reconstructed from your run badges (★ = badges−5) and anchored to your saved rank — an estimate of the climb, exact at the last point.</div>
    </div>`;
  }
  function wireRankChart(root, traj) {
    if (!traj || !traj.pts || traj.pts.length < 2) return;
    const wrap = root.querySelector('.rank-chart'); if (!wrap) return;
    const tip = wrap.querySelector('.rank-tip'); const svg = wrap.querySelector('svg');
    wrap.querySelectorAll('.rankpt').forEach(c => {
      c.onmouseenter = () => {
        const p = traj.pts[+c.dataset.i]; if (!p) return;
        const dTxt = p.start ? 'start' : p.delta === 0 ? 'No change' : `${p.delta > 0 ? '+' : ''}${p.delta}★`;
        const dCol = p.delta > 0 ? 'var(--green)' : p.delta < 0 ? 'var(--red)' : 'var(--muted)';
        tip.innerHTML = `<div style="font-weight:700;color:${p.rank.c}">${String(p.rank.tier).toUpperCase()} ${p.rank.div} · ${p.rank.stars}★</div>
          <div style="color:var(--muted);margin-top:1px">${p.start ? 'before your first archived run' : `game ${p.g} · ${esc(String(p.trainer))} · ${p.badges}🏅`}</div>
          <div style="color:${dCol};font-weight:600;margin-top:1px">${dTxt}</div>`;
        // position tooltip near the point (SVG px → client px)
        const box = svg.getBoundingClientRect(), wbox = wrap.getBoundingClientRect();
        const cx = c.getBoundingClientRect().left - wbox.left, cy = c.getBoundingClientRect().top - wbox.top;
        tip.style.display = 'block';
        tip.style.left = Math.min(Math.max(cx - tip.offsetWidth / 2, 4), wrap.clientWidth - tip.offsetWidth - 4) + 'px';
        tip.style.top = Math.max(cy - tip.offsetHeight - 10, 2) + 'px';
      };
      c.onmouseleave = () => { tip.style.display = 'none'; };
    });
  }

  // 🏷 AUTO-TAGS for a run (Mobalytics match-tag pattern) — result, engines used,
  // streaks, clean/rough signals. Cheap read of the archived run.
  function runTags(run) {
    const tags = [];
    if (run.result === 'won') tags.push({ t: '🏆 Champion', c: 'gold' });
    else if (run.result === 'lost') tags.push({ t: `💀 Died day ${run.day}`, c: 'red' });
    else tags.push({ t: `⏹ Ended day ${run.day}`, c: 'plain' });
    const b = run.badges || 0;
    if (run.result !== 'won' && b >= 8) tags.push({ t: `So close · ${b}🏅`, c: 'accent' });
    const strat = (run.strategies && run.strategies.length) ? run.strategies : (run.strategy ? [run.strategy] : []);
    strat.slice(0, 2).forEach(id => { const s = STRATEGY_LIB.find(x => x.id === id); if (s) tags.push({ t: `${s.icon} ${s.name.replace(/\s+(engine|ramp|feeder engine|CDS chain)$/i, '')}`, c: 'plain' }); });
    const hist = run.history || [];
    let best = 0, run2 = 0; hist.forEach(h => { if (h.won) { run2++; best = Math.max(best, run2); } else run2 = 0; });
    if (best >= 4) tags.push({ t: `🔥 ${best}-win streak`, c: 'green' });
    if (run.result === 'won' && (run.losses || 0) <= 2) tags.push({ t: '✨ Clean run', c: 'green' });
    if (hist.filter(h => !h.won && h.day <= 4).length >= 3) tags.push({ t: '🩸 Rough start', c: 'red' });
    return tags;
  }
  const TAG_STYLE = { gold: 'color:var(--gold);border-color:rgba(240,196,64,.5)', red: 'color:var(--red);border-color:rgba(255,93,115,.45)', green: 'color:var(--green);border-color:rgba(61,220,132,.45)', accent: 'color:var(--accent);border-color:rgba(90,162,255,.45)', plain: 'color:var(--muted);border-color:var(--border)' };
  const tagChips = (tags) => tags.map(tg => `<span style="font-size:9.5px;padding:1px 7px;border:1px solid;border-radius:999px;white-space:nowrap;${TAG_STYLE[tg.c] || TAG_STYLE.plain}">${esc(tg.t)}</span>`).join('');

  // 📊 RECENT SUMMARY (last N games) — battle W-L bar, championship count, avg 🏅,
  // and the top trainers fielded in the window with their record.
  function recentSummaryHTML(runs) {
    const last = runs.slice(0, 10);
    if (last.length < 2) return '';
    const champs = last.filter(r => r.result === 'won').length;
    const wl = last.reduce((a, r) => ({ w: a.w + (r.wins || 0), l: a.l + (r.losses || 0) }), { w: 0, l: 0 });
    const wr = wl.w + wl.l ? Math.round(wl.w / (wl.w + wl.l) * 100) : 0;
    const avgB = (last.reduce((a, r) => a + (r.badges || 0), 0) / last.length).toFixed(1);
    const byT = {};
    last.forEach(r => { if (!r.trainer) return; const t = (byT[r.trainer] = byT[r.trainer] || { n: 0, w: 0, l: 0, c: 0, name: r.trainerName || r.trainer, id: r.trainer }); t.n++; t.w += r.wins || 0; t.l += r.losses || 0; t.c += r.result === 'won' ? 1 : 0; });
    const tops = Object.values(byT).sort((a, b) => b.n - a.n).slice(0, 4);
    const trChip = (t) => { const tr = D.trainers.find(x => x.id === t.id); const twr = t.w + t.l ? Math.round(t.w / (t.w + t.l) * 100) : 0; return `<div style="display:flex;align-items:center;gap:7px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:5px 9px">${tr && tr.sprite ? `<img class="sprite" src="${spr(tr.sprite)}" style="width:24px;height:24px">` : ''}<div><div style="font-size:11px;font-weight:600">${esc(t.name)}</div><div style="font-size:9.5px;color:var(--muted)">${t.n} run${t.n > 1 ? 's' : ''} · <b style="color:${twr >= 50 ? 'var(--green)' : 'var(--red)'}">${t.w + t.l ? twr + '%' : '—'}</b>${t.c ? ` · 🏆${t.c}` : ''}</div></div></div>`; };
    const barW = 150;
    return `<div class="card"><h3 style="margin:0 0 8px">📊 Recent form <span style="font-size:10px;color:var(--muted);font-weight:400">· last ${last.length} runs</span></h3>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
        <div>
          <div style="display:flex;align-items:baseline;gap:8px"><b style="font-size:22px;color:${wr >= 50 ? 'var(--green)' : 'var(--red)'}">${wr}%</b><span style="font-size:10px;color:var(--muted)">battle WR (${wl.w}W-${wl.l}L)</span></div>
          <div style="width:${barW}px;height:7px;background:var(--red);border-radius:4px;overflow:hidden;margin-top:4px"><div style="width:${wr}%;height:100%;background:var(--green)"></div></div>
        </div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:800;color:var(--gold)">${avgB}</div><div style="font-size:9.5px;color:var(--muted)">avg 🏅</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:800;color:${champs ? 'var(--gold)' : 'var(--muted)'}">${champs}</div><div style="font-size:9.5px;color:var(--muted)">🏆 in window</div></div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;flex:1;justify-content:flex-end">${tops.map(trChip).join('')}</div>
      </div></div>`;
  }

  // 🧑 PER-TRAINER TABLE (Primary-role-overview pattern): games · 🏆-rate · battle WR ·
  // avg 🏅 · avg day · best. Sorted by games played (your "main" floats to the top).
  function trainerTableHTML(runs) {
    const byT = {};
    runs.forEach(r => { if (!r.trainer) return; const t = (byT[r.trainer] = byT[r.trainer] || { n: 0, b: 0, day: 0, c: 0, w: 0, l: 0, best: 0, name: r.trainerName || r.trainer, id: r.trainer }); t.n++; t.b += r.badges || 0; t.day += r.day || 0; t.c += r.result === 'won' ? 1 : 0; t.w += r.wins || 0; t.l += r.losses || 0; t.best = Math.max(t.best, r.badges || 0); });
    const rows = Object.values(byT).sort((a, b) => b.n - a.n);
    if (!rows.length) return '';
    const head = `<tr style="color:var(--muted);font-size:9.5px;text-transform:uppercase;letter-spacing:.4px"><th style="text-align:left;padding:4px 8px">Trainer</th><th style="padding:4px 8px">Games</th><th style="padding:4px 8px">🏆 rate</th><th style="padding:4px 8px">Battle WR</th><th style="padding:4px 8px">Avg 🏅</th><th style="padding:4px 8px">Avg day</th><th style="padding:4px 8px">Best</th></tr>`;
    const body = rows.map(t => {
      const tr = D.trainers.find(x => x.id === t.id);
      const cr = Math.round(t.c / t.n * 100), wr = t.w + t.l ? Math.round(t.w / (t.w + t.l) * 100) : null;
      return `<tr style="font-size:12px;border-top:1px solid var(--border)">
        <td style="padding:6px 8px"><span style="display:flex;align-items:center;gap:8px">${tr && tr.sprite ? `<img class="sprite" src="${spr(tr.sprite)}" style="width:26px;height:26px">` : ''}<b>${esc(t.name)}</b></span></td>
        <td style="padding:6px 8px;text-align:center">${t.n}</td>
        <td style="padding:6px 8px;text-align:center;color:${t.c ? 'var(--gold)' : 'var(--muted)'}">${cr}%${t.c ? ` <span style="font-size:9px">(${t.c})</span>` : ''}</td>
        <td style="padding:6px 8px;text-align:center;color:${wr == null ? 'var(--muted)' : wr >= 50 ? 'var(--green)' : 'var(--red)'}">${wr == null ? '—' : wr + '%'}</td>
        <td style="padding:6px 8px;text-align:center;color:var(--gold)">${(t.b / t.n).toFixed(1)}</td>
        <td style="padding:6px 8px;text-align:center">${(t.day / t.n).toFixed(0)}</td>
        <td style="padding:6px 8px;text-align:center">${t.best}🏅</td></tr>`;
    }).join('');
    return `<div class="card"><h3 style="margin:0 0 6px">🧑 Per-trainer overview <span style="font-size:10px;color:var(--muted);font-weight:400">· every trainer you've played</span></h3>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">${head}${body}</table></div></div>`;
  }

  // 🐾 MOST-FIELDED BATOMONS (Most-played-with pattern) — how often each monster made
  // your final board, with the avg badges of the runs it appeared in.
  function mostFieldedHTML(runs) {
    const seen = {};
    runs.forEach(r => {
      const ids = new Set((r.finalBoard || []).map(s => s && (s.id || s.monsterId)).filter(Boolean));
      ids.forEach(id => { const m = (seen[id] = seen[id] || { id, n: 0, b: 0 }); m.n++; m.b += r.badges || 0; });
    });
    const top = Object.values(seen).filter(m => monById[m.id]).sort((a, b) => b.n - a.n).slice(0, 10);
    if (top.length < 3) return '';
    return `<div class="card"><h3 style="margin:0 0 8px">🐾 Most-fielded batomons <span style="font-size:10px;color:var(--muted);font-weight:400">· on your final boards</span></h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${top.map(m => { const mon = monById[m.id]; return `<div style="display:flex;align-items:center;gap:8px;background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:6px 10px" title="${esc(mon.name)} — fielded in ${m.n} run${m.n > 1 ? 's' : ''}"><img class="sprite" src="${spr(mon.sprite)}" style="width:30px;height:30px"><div><div style="font-size:11.5px;font-weight:600">${esc(mon.name)}</div><div style="font-size:9.5px;color:var(--muted)">${m.n}× · avg ${(m.b / m.n).toFixed(1)}🏅</div></div></div>`; }).join('')}</div></div>`;
  }

  // 📈 PROFILE TAB — the player's page (Mobalytics-LoL pattern): identity +
  // tier, aggregate GPI radar with a prescription, career stats, recent form,
  // per-trainer records. Everything derives from the local archive — honest
  // fixed anchors until community data enables population-relative scoring.
  let rankEditing = false; // ✎ update shows the pre-filled form WITHOUT wiping the saved rank
  function renderProfile() {
    const root = $('#tab-profile'); if (!root) return;
    const runs = loadRuns();
    if (!runs.length) {
      root.innerHTML = `<h2 style="margin:0 0 6px">📈 Profile</h2>
        <div class="note" style="margin-top:10px">Your player page builds itself from finished runs — play one with 🔌 Sync on and come back. You'll get a skill radar, career stats, form and per-trainer records.</div>
        <div id="ph-history"></div>`;
      renderHistory($('#ph-history')); // empty-state history still offers 📥 Import (restore on a new machine)
      return;
    }
    // aggregate radar: mean of each dimension across your LAST 20 runs (rolling —
    // fewer if you haven't played 20 yet), so it reflects current form, not ancient
    // history. Career totals below still count everything.
    const recentRuns = runs.slice(0, 20);
    const traj = rankTrajectory();
    const per = recentRuns.map(r => runRadarDims(r));
    const dims = per[0].map((d0, i) => {
      const vals = per.map(p => p[i].v).filter(v => v != null);
      return { k: d0.k, v: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, why: `average over ${vals.length || 0} run${vals.length === 1 ? '' : 's'} — ${d0.why.split(' — ')[0]}` };
    });
    const worst = dims.filter(d => d.v != null).sort((a, b) => a.v - b.v)[0];
    const RX = {
      Tempo: 'win earlier: prioritize tempo buys days 1–3 (the 🎰 verdict + ⚔️ chips) instead of saving',
      Battles: 'your boards lose fights — lean on 🧲 sim-verified positioning and the 🧭 buy plan before greeding',
      Econ: 'gold sitting idle on loss days — spend into the board when the Brain says BEHIND; income comes back, lives don\'t',
      Commit: 'adopt a ♟️ strategy earlier (day 4–6) — committed runs average more badges',
      Align: 'try following the brain\'s #1 pick more often — the 🧠 decision grades will show if it pays',
    };
    // career stats
    const champs = runs.filter(r => r.result === 'won').length;
    const bestBadges = Math.max(...runs.map(r => r.badges || 0));
    const totW = runs.reduce((a, r) => a + (r.wins || 0), 0), totL = runs.reduce((a, r) => a + (r.losses || 0), 0);
    const battleWR = totW + totL ? Math.round(totW / (totW + totL) * 100) : 0;
    const avgB = (runs.reduce((a, r) => a + (r.badges || 0), 0) / runs.length).toFixed(1);
    const preds = runs.flatMap(r => (r.history || []).filter(h => h.pred != null && h.won != null));
    const predHits = preds.filter(h => (h.pred > 50) === !!h.won).length;
    const buys = runs.flatMap(r => (r.runLog || []).filter(l => l.type === 'decision' && /🛒/.test(l.detail)));
    const followed = buys.filter(l => /✓ top pick|✓ meilleur choix/.test(l.detail)).length;
    // tier (our own honest ladder — anchors shown in the tooltip)
    const tier = champs >= 3 ? { t: 'GRANDMASTER', c: 'var(--gold)', why: '3+ championship runs' }
      : champs >= 1 ? { t: 'CHAMPION', c: 'var(--gold)', why: 'won a championship run (10 badges)' }
      : bestBadges >= 7 ? { t: 'CONTENDER', c: 'var(--accent)', why: 'best run reached 7+ badges' }
      : bestBadges >= 4 ? { t: 'CHALLENGER', c: 'var(--green)', why: 'best run reached 4+ badges' }
      : { t: 'ROOKIE', c: 'var(--muted)', why: 'first badges incoming — the coach is watching' };
    // most-played trainer as the profile "avatar"
    const byT = {};
    runs.forEach(r => { if (!r.trainer) return; (byT[r.trainer] = byT[r.trainer] || { n: 0, b: 0, c: 0, w: 0, l: 0, name: r.trainerName || r.trainer }); const t = byT[r.trainer]; t.n++; t.b += r.badges || 0; t.c += r.result === 'won' ? 1 : 0; t.w += r.wins || 0; t.l += r.losses || 0; });
    const mainT = Object.entries(byT).sort((a, b) => b[1].n - a[1].n)[0];
    const mainTr = mainT && D.trainers.find(t => t.id === mainT[0]);
    const stat = (val, label, color) => `<div class="card" style="text-align:center;padding:12px 10px;flex:1;min-width:104px"><div style="font-size:24px;font-weight:800;color:${color || 'var(--gold)'}">${val}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">${label}</div></div>`;
    // recent form: last 5 runs, newest first
    const form = runs.slice(0, 5).map(r => `<span class="pill" title="${esc(r.trainerName || '?')} — day ${r.day}, ${r.wins}W-${r.losses}L" style="border-color:${r.result === 'won' ? 'rgba(240,196,64,.6)' : r.result === 'lost' ? 'rgba(255,77,94,.5)' : 'var(--border)'}">${r.result === 'won' ? '🏆' : r.result === 'lost' ? '💀' : '⏹'} ${r.badges}🏅</span>`).join(' ');
    root.innerHTML = `<h2 style="margin:0 0 10px">📈 Profile <span style="font-size:12px;color:var(--muted)">— built from your ${runs.length} archived run${runs.length > 1 ? 's' : ''}, all local</span></h2>
      <div style="display:flex;gap:14px;align-items:stretch;flex-wrap:wrap;margin-bottom:12px">
        <div class="card" style="display:flex;gap:14px;align-items:center;padding:16px 20px;min-width:300px;flex:1">
          ${mainTr && mainTr.sprite ? `<img class="sprite" src="${spr(mainTr.sprite)}" style="width:64px;height:64px">` : '<div style="font-size:44px">🎮</div>'}
          <div>
            <div style="font-size:16px;font-weight:800">${esc(mainT ? mainT[1].name : 'Player')} <span style="font-size:10.5px;color:var(--muted);font-weight:400">main</span></div>
            <div style="margin-top:4px"><b title="${esc(tier.why)}" style="color:${tier.c};font-size:13px;letter-spacing:1px">${tier.t}</b></div>
            <div style="margin-top:6px;font-size:11px;color:var(--muted)">Form: ${form}</div>
          </div>
        </div>
        ${(() => {
          // 🎖 RANKED — MMR precedence: save-synced > manual real > opponents-avg > band estimate
          const auto = live.ranked && live.ranked.src === 'save' ? live.ranked : null;
          let oppo = { n: 0, sum: 0 }; try { oppo = JSON.parse(localStorage.getItem('bc_mmrEst') || '{"n":0,"sum":0}') || oppo; } catch (e) {}
          let manual = null; try { manual = JSON.parse(localStorage.getItem('bc_rankmanual') || 'null'); } catch (e) {}
          if (manual && manual.rank && !manual.tier) { // migrate old free-text ("Gold 6")
            const mm = String(manual.rank).match(/([A-Za-z]+)\s*(\d+)?/);
            manual = { tier: mm ? mm[1] : manual.rank, div: mm && mm[2] ? +mm[2] : 1, stars: manual.stars || 0, mmr: manual.mmr || null };
            localStorage.setItem('bc_rankmanual', JSON.stringify(manual));
          }
          const starRow = (n, interactive) => [1, 2, 3, 4, 5].map(i => `<span ${interactive ? `class="pr-star" data-s="${i}"` : ''} style="cursor:${interactive ? 'pointer' : 'default'};font-size:${interactive ? 20 : 16}px;color:${i <= n ? 'var(--gold)' : '#3a3a44'}">★</span>`).join('');
          // 🆚 OPPONENT SPREAD — the mean alone can't tell you whether the ladder
          // pairs you with your own rank (a Silver facing two Golds and two Bronzes
          // averages to "Silver"). Show the actual range + how far the middle 50%
          // sits from your own rating, which is the number that answers it.
          const oppoLine = (() => {
            if (oppo.n < 2) return '';
            const avg = Math.round(oppo.sum / oppo.n);
            let sm = []; try { sm = JSON.parse(localStorage.getItem('bc_mmrSamples') || '[]'); } catch (e) {}
            const v = (Array.isArray(sm) ? sm : []).map(s => s && +s.m).filter(m => m > 0).sort((a, b) => a - b);
            if (v.length < 5) return `<div style="font-size:10.5px;color:var(--muted);margin-top:5px" title="sampled from the opponents your ranked runs actually faced">🆚 opponents avg <b>~${avg} MMR</b> (${oppo.n} sampled)</div>`;
            const q = (p) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))];
            const lo = v[0], hi = v[v.length - 1], q1 = q(0.25), q3 = q(0.75);
            const width = hi - lo, iqr = q3 - q1;
            const verdict = iqr <= 120 ? { t: 'tightly matched', c: 'var(--green)' }
              : iqr <= 300 ? { t: 'loosely matched', c: 'var(--gold)' }
                : { t: 'barely rank-matched', c: 'var(--red)' };
            return `<div style="font-size:10.5px;color:var(--muted);margin-top:5px" title="Measured from the opponents your ranked runs actually faced — not an assumption. A narrow middle 50% means the ladder pairs you with your own rating; a wide one means it doesn't.">
              🆚 <b>${v.length}</b> real opponents · median <b>~${q(0.5)}</b> MMR · range <b>${lo}–${hi}</b> (spread ${width})
              <div style="margin-top:2px">middle 50%: <b>${q1}–${q3}</b> → <b style="color:${verdict.c}">${verdict.t}</b></div></div>`;
          })();
          let body;
          if (auto) {
            const rows = Object.entries(auto).filter(([k]) => k !== 'at' && k !== 'src').map(([k, v]) => `<div style="font-size:13px"><span style="color:var(--muted)">${esc(k)}</span> <b>${esc(String(v))}</b></div>`).join('');
            body = `${rows}${oppoLine}<div class="note" style="margin-top:6px;font-size:9.5px">✓ synced from the game's run save</div>`;
          } else if (manual && manual.tier && !rankEditing) {
            const T = RANK_TIERS.find(t => t.id.toLowerCase() === String(manual.tier).toLowerCase());
            const lm = learnedMMRForRank(manual);
            const mmrLine = manual.mmr
              ? `<div style="font-size:13px;margin-top:4px"><b style="color:var(--text)">${(+manual.mmr).toLocaleString()}</b> <span style="color:var(--muted)">MMR</span></div>`
              : oppo.n >= 2 ? '' // the 🆚 opponents line below is THIS run's live number
              : lm && lm.learned ? `<div style="font-size:12px;margin-top:4px" title="🎯 Calibrated from the ${lm.samples} opponents you faced across your ranked runs (matchmaking pairs similar MMR) — replaces the fictional low-tier band with YOUR real ladder."><b style="color:var(--text)">~${lm.mmr.toLocaleString()}</b> <span style="color:var(--muted)">MMR (🎯 calibrated ⓘ)</span></div>`
              : lm ? `<div style="font-size:12px;margin-top:4px" title="Rough band estimate — low-tier widths are assumptions. Play a ranked run battle-synced and this recalibrates to your real ladder from the opponents you face."><b style="color:var(--text)">~${lm.mmr.toLocaleString()}</b> <span style="color:var(--muted)">MMR (band estimate ⓘ)</span></div>` : '';
            body = `<div style="display:flex;gap:12px;align-items:center">
                <div style="font-size:34px;filter:drop-shadow(0 0 8px ${T ? T.c : 'var(--gold)'}44)">${T ? T.icon : '🎖'}</div>
                <div>
                  <div style="font-size:21px;font-weight:800;letter-spacing:1px;color:${T ? T.c : 'var(--gold)'}">${esc(String(manual.tier).toUpperCase())} ${manual.div || ''}</div>
                  <div style="letter-spacing:3px;margin-top:1px">${starRow(manual.stars || 0, false)}</div>
                  ${mmrLine}
                </div>
              </div>
              ${oppoLine}
              <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
                <button class="ghost" id="pr-rank-edit" style="font-size:10px;padding:3px 10px">✎ update</button>
                <span class="note" style="margin:0;font-size:9.5px">manual — auto-syncs when the save exposes rank</span>
              </div>`;
          } else {
            const cur = (manual && manual.tier) ? manual : null; // pre-fill when editing an existing rank
            body = `<div class="note" style="margin:0 0 8px;font-size:10.5px">${cur ? 'Update your rank — pre-filled from what you saved:' : "The run save doesn't expose rank/MMR yet (encrypted meta save — berrymint asked). Set what the ranked screen shows:"}</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
                <label style="display:flex;flex-direction:column;gap:3px;font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Tier
                  <select id="pr-tier" style="min-width:104px">${RANK_TIERS.map(t => `<option value="${t.id}"${cur && String(cur.tier).toLowerCase() === t.id.toLowerCase() ? ' selected' : ''}>${t.icon} ${t.id}</option>`).join('')}</select></label>
                <label style="display:flex;flex-direction:column;gap:3px;font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Division
                  <select id="pr-div" style="width:60px">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option${cur && +cur.div === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
                <label style="display:flex;flex-direction:column;gap:3px;font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Stars
                  <span id="pr-starpick" data-v="${cur ? (cur.stars || 0) : 0}" style="letter-spacing:2px">${starRow(cur ? (cur.stars || 0) : 0, true)}</span></label>
                <label style="display:flex;flex-direction:column;gap:3px;font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">MMR (if shown)
                  <input id="pr-mmr" type="number" placeholder="auto-estimated" value="${cur && cur.mmr ? cur.mmr : ''}" style="width:110px"></label>
                <button class="primary" id="pr-rank-save" style="font-size:12px;padding:7px 16px">Save</button>${cur ? '<button class="ghost" id="pr-rank-cancel" style="font-size:12px;padding:7px 14px">Cancel</button>' : ''}
              </div>
              ${oppoLine}`;
          }
          const rankedTag = live.isRanked ? ' <span class="chip good" style="font-size:9px;vertical-align:middle" title="Detected live from the run save (is_ranked). Your tier/stars stay in the game\'s encrypted save, so keep them set below.">🏅 RANKED — detected</span>' : '';
          const rankedNudge = (live.isRanked && !(manual && manual.tier) && !auto) ? `<div class="note" style="color:var(--gold);margin:0 0 8px;font-size:10.5px">🏅 You're in a <b>ranked run</b> — set your current rank so the app tracks it (the game keeps tier/stars encrypted, so it's manual).</div>` : '';
          const starRule = `<div class="note" style="margin-top:9px;font-size:9.5px;line-height:1.5">★ <b>Ladder rule</b>: a ranked run moves you <b>badges − 5</b> stars — 0🏅 −5★ · 5🏅 No Change · 10🏅 +5★. Five stars = one division; divisions count <b>down</b> (Gold 6 → Gold 5 → … → Gold 1 → Platinum). The 🎖 banner on a finished ranked run applies it in one click.</div>`;
          return `<div class="card" style="padding:14px 18px;min-width:230px"><h3 style="margin:0 0 8px">🎖 Ranked${rankedTag}</h3>${rankedNudge}${body}${(manual && manual.tier) || auto ? starRule : ''}</div>`;
        })()}
        <div class="card" style="display:flex;gap:10px;align-items:center;padding:10px 16px">
          ${radarSVGFromDims(dims, 170)}
          <div style="max-width:250px">
            <b style="font-size:12.5px">Skill radar</b>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">${dims.map(d => `<div style="display:flex;gap:6px;align-items:center;margin-top:3px"><span style="min-width:52px">${d.k}</span><div style="flex:1;height:7px;background:var(--bg2);border-radius:4px;overflow:hidden"><div style="width:${d.v == null ? 0 : d.v}%;height:100%;background:${d === worst ? 'var(--red)' : 'var(--accent)'}"></div></div><b style="min-width:26px;text-align:right">${d.v == null ? '–' : d.v}</b></div>`).join('')}</div>
            ${worst ? `<div class="note" style="margin-top:8px;font-size:10.5px">🎯 <b>Work on ${worst.k}</b>: ${RX[worst.k] || ''}</div>` : ''}
          </div>
        </div>
        ${rankChartHTML(traj)}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${stat(runs.length, 'Runs')}${stat(champs, 'Championships', champs ? 'var(--gold)' : 'var(--muted)')}${stat(bestBadges, 'Best badges')}${stat(avgB, 'Avg badges')}${stat(battleWR + '%', 'Battle WR', battleWR >= 50 ? 'var(--green)' : 'var(--red)')}${preds.length >= 3 ? stat(`${predHits}/${preds.length}`, 'Brain calls', 'var(--accent)') : ''}${buys.length ? stat(`${followed}/${buys.length}`, 'Followed #1', 'var(--accent)') : ''}
      </div>
      ${recentSummaryHTML(runs)}
      ${trainerTableHTML(runs)}
      ${mostFieldedHTML(runs)}
      <div class="note" style="margin:-2px 0 12px;font-size:10px">Tier anchors: CHAMPION = a 10-badge run · CONTENDER = 7+ · CHALLENGER = 4+ · GRANDMASTER = 3 championships. Population-relative ranking arrives with community data at v1.</div>
      <div id="ph-history"></div>`;
    renderHistory($('#ph-history')); // 🏆 match history lives inside the profile (Mobalytics pattern)
    wireRankChart(root, traj); // 📈 hover tooltips on the rank-progression points
    // 🎖 ranked manual entry wiring (tier/div selects + interactive star picker)
    const starPick = $('#pr-starpick');
    if (starPick) starPick.querySelectorAll('.pr-star').forEach(s => s.onclick = () => {
      const v = +s.dataset.s === +starPick.dataset.v ? 0 : +s.dataset.s; // click same star again = clear
      starPick.dataset.v = v;
      starPick.querySelectorAll('.pr-star').forEach(x => x.style.color = +x.dataset.s <= v ? 'var(--gold)' : '#3a3a44');
    });
    const rkSave = $('#pr-rank-save');
    if (rkSave) rkSave.onclick = () => {
      const norm = normalizeRankStars({ tier: $('#pr-tier').value, div: +$('#pr-div').value || 1, stars: +($('#pr-starpick').dataset.v) || 0 }); // 5★ → promotion
      localStorage.setItem('bc_rankmanual', JSON.stringify({ tier: norm.tier, div: norm.div, stars: norm.stars, mmr: +$('#pr-mmr').value || null, at: Date.now() }));
      rankEditing = false; renderProfile();
    };
    // ✎ update → open the pre-filled form WITHOUT wiping the saved rank (the old
    // removeItem here is what made it feel like the rank "didn't save" / reset).
    const rkEdit = $('#pr-rank-edit');
    if (rkEdit) rkEdit.onclick = () => { rankEditing = true; renderProfile(); };
    const rkCancel = $('#pr-rank-cancel');
    if (rkCancel) rkCancel.onclick = () => { rankEditing = false; renderProfile(); };
  }
  // 🧠 CROSS-RUN COACHING — turn the archive into a coach. Finds the patterns a
  // good companion surfaces: which phase you're weakest in, your best trainer,
  // when your runs tend to die, whether committing to a strategy helps you.
  function historyInsights(runs) {
    const out = [];
    // battle win-rate by game phase (works even from ONE run's battle log).
    // Skip runs with CORRUPT history — wins earned (badges) but every battle logged
    // as a loss = the old sync-granularity bug; counting them tanks the WR to 0%.
    const ph = { early: [0, 0], mid: [0, 0], late: [0, 0] };
    const reliable = runs.filter(r => !((r.wins || 0) > 0 && (r.history || []).length > 0 && (r.history || []).every(h => !h.won)));
    reliable.forEach(r => (r.history || []).forEach(h => { const p = h.day <= 3 ? 'early' : h.day <= 6 ? 'mid' : 'late'; ph[p][1]++; if (h.won) ph[p][0]++; }));
    const phases = [['early', 'Early (d1-3)'], ['mid', 'Mid (d4-6)'], ['late', 'Late (d7+)']]
      .map(([k, l]) => ({ l, wr: ph[k][1] ? Math.round(ph[k][0] / ph[k][1] * 100) : null, n: ph[k][1] })).filter(x => x.n >= 2);
    if (phases.length >= 2) {
      const weak = phases.slice().sort((a, b) => a.wr - b.wr)[0];
      out.push(`⚔️ <b>Battle win-rate by phase</b>: ${phases.map(p => `${p.l} <b style="color:${p.wr >= 50 ? 'var(--green)' : 'var(--red)'}">${p.wr}%</b>`).join(' · ')}. Weakest is <b>${weak.l}</b> — that's where to tighten your board.`);
    }
    // trainer performance
    const byT = {};
    runs.forEach(r => { const t = r.trainerName || r.trainer || '?'; (byT[t] = byT[t] || { n: 0, b: 0, c: 0 }); byT[t].n++; byT[t].b += r.badges || 0; byT[t].c += r.result === 'won' ? 1 : 0; });
    const trs = Object.entries(byT).map(([t, v]) => ({ t, avg: v.b / v.n, c: v.c, n: v.n })).sort((a, b) => b.avg - a.avg);
    if (trs.length >= 2) out.push(`🧑 <b>Best trainer</b>: <b>${esc(trs[0].t)}</b> (avg ${trs[0].avg.toFixed(1)} 🏅${trs[0].c ? `, ${trs[0].c}× champion` : ''} over ${trs[0].n} run${trs[0].n > 1 ? 's' : ''}) — your weakest is <b>${esc(trs[trs.length - 1].t)}</b> (avg ${trs[trs.length - 1].avg.toFixed(1)}).`);
    // where runs die
    const deaths = runs.filter(r => r.result === 'lost' || r.result === 'ended').map(r => r.day).filter(d => d > 0);
    if (deaths.length >= 2) { const avg = deaths.reduce((a, b) => a + b, 0) / deaths.length; out.push(`💀 Your runs most often end around <b>day ${Math.round(avg)}</b> — aim to have your engine online and your board leveled before then.`); }
    // strategy commitment impact
    const wS = runs.filter(r => r.strategy), noS = runs.filter(r => !r.strategy);
    if (wS.length >= 2 && noS.length >= 1) { const a = wS.reduce((x, r) => x + (r.badges || 0), 0) / wS.length, b = noS.reduce((x, r) => x + (r.badges || 0), 0) / noS.length; if (a - b >= 1) out.push(`♟️ Runs where you <b>adopt a strategy</b> reach <b>+${(a - b).toFixed(1)}</b> more badges on average — commit to a plan earlier.`); }
    return out;
  }
  // 🔗 SHARE CODES (pobb.in pattern): board+trinkets+context → compact
  // base64url code, shareable as text or ?b= link, rendered read-only.
  function encodeBoardCode() {
    const payload = {
      v: 1, d: live.day, t: live.trainerId || null,
      b: live.board.map(s => s ? [s.monsterId, s.level, s.shiny ? 1 : 0] : 0),
      n: (live.bench || []).map(s => s ? [s.monsterId, s.level, s.shiny ? 1 : 0] : 0),
      k: live.trinkets || [], p: live.plan || null, s: live.strategy ? live.strategy.id : null, ss: (live.strategies || []).map(x => x && x.id).filter(Boolean),
    };
    return 'bc1.' + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeBoardCode(str) {
    try {
      const raw = String(str).trim().replace(/^.*[?&]b=/, '').replace(/^bc1\./, '');
      const j = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/')))));
      if (!j || j.v !== 1 || !Array.isArray(j.b)) return null;
      const slot = (x) => Array.isArray(x) && monById[x[0]] ? { monsterId: x[0], level: Math.min(Math.max(+x[1] || 1, 1), 4), shiny: !!x[2] } : null;
      return { day: Math.min(Math.max(+j.d || 1, 1), 40), trainerId: j.t && D.trainers.some(t => t.id === j.t) ? j.t : null, board: j.b.slice(0, 6).map(slot), bench: (j.n || []).slice(0, 4).map(slot), trinkets: (j.k || []).filter(id => D.trinkets.some(t => t.id === id)).slice(0, 12), plan: j.p || null, strategy: j.s || null, strategies: Array.isArray(j.ss) && j.ss.length ? j.ss.filter(Boolean) : (j.s ? [j.s] : []) };
    } catch (e) { return null; }
  }
  function openShareModal() {
    const code = encodeBoardCode();
    const link = location.origin + location.pathname + '?b=' + code.slice(4);
    const box = el('div');
    box.innerHTML = `<h3>🔗 Share this board</h3>
      <div class="note" style="margin:6px 0 10px">Anyone with the code/link sees your exact board, bench, trinkets and plan — read-only.</div>
      <textarea id="share-code" readonly style="width:100%;height:64px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:11px;padding:8px">${esc(code)}</textarea>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="primary" id="share-copy">📋 Copy code</button>
        <button class="ghost" id="share-copy-link">🔗 Copy link</button>
      </div>
      <div class="note" style="margin-top:10px;font-size:10.5px">Paste a friend's code below to view their board:</div>
      <div style="display:flex;gap:6px;margin-top:4px"><input id="share-in" placeholder="bc1.…" style="flex:1"><button class="ghost" id="share-view">View</button></div>`;
    box.querySelector('#share-copy').onclick = (e) => { navigator.clipboard.writeText(code); e.target.textContent = '✓ Copied'; };
    box.querySelector('#share-copy-link').onclick = (e) => { navigator.clipboard.writeText(link); e.target.textContent = '✓ Copied'; };
    box.querySelector('#share-view').onclick = () => { const dec = decodeBoardCode(box.querySelector('#share-in').value); if (dec) openSharedBoard(dec); else box.querySelector('#share-in').style.borderColor = 'var(--red)'; };
    openModal(box);
  }
  function openSharedBoard(dec) {
    const cell = (s) => { if (!s) return '<div class="slot empty"><div class="nm">·</div></div>'; const m = monById[s.monsterId]; return `<div class="slot"><span class="lvl">L${s.level}</span>${mcBadge(s)}${s.shiny ? '<span class="shinymark">✨</span>' : ''}<img class="sprite" src="${spr(s.shiny && m.shinySprite ? m.shinySprite : m.sprite)}"><div class="nm">${esc(m.name)}</div></div>`; };
    const tr = dec.trainerId && D.trainers.find(t => t.id === dec.trainerId);
    const box = el('div');
    box.innerHTML = `<h3>🔗 Shared board <span style="font-size:11px;color:var(--muted);font-weight:400">· day ${dec.day}${tr ? ' · ' + esc(tr.name) : ''}</span></h3>
      <div class="slotgrid" style="margin-top:8px">${dec.board.slice(0, 3).map(cell).join('')}</div>
      <div class="slotgrid">${dec.board.slice(3, 6).map(cell).join('')}</div>
      ${dec.bench.some(Boolean) ? `<div class="rowlabel">Bench</div><div class="slotgrid bench">${dec.bench.map(cell).join('')}</div>` : ''}
      ${dec.trinkets.length ? `<div style="font-size:12px;margin-top:8px"><b>💎</b> ${dec.trinkets.map(id => esc((D.trinkets.find(t => t.id === id) || { name: id }).name)).join(', ')}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px"><button class="ghost" id="share-load" title="Replaces your current Live Run (your run is archived first)">⤵ Load into Live Run</button></div>`;
    box.querySelector('#share-load').onclick = () => {
      if (!confirm('Replace your current Live Run with this shared board? Your current run is archived to Game History first.')) return;
      archiveRun('abandoned');
      if (syncEnabled()) { localStorage.setItem('bc_sync', '0'); stopSyncStream(); lastSyncKey = null; syncStatus = 'off'; }
      // rebuild strategy objects from the shared ids; strategy MUST be the SAME object as strategies[0] (invariant)
      const stObjs = (dec.strategies || (dec.strategy ? [dec.strategy] : [])).map(id => ({ id, focusId: null, day: dec.day }));
      Object.assign(live, { day: dec.day, trainerId: dec.trainerId, board: dec.board.concat([null, null, null, null, null, null]).slice(0, 6), bench: dec.bench.concat([null, null, null, null]).slice(0, 4), trinkets: dec.trinkets, plan: dec.plan, strategy: stObjs[0] || null, strategies: stObjs, shop: [], shopItems: [], history: [], runLog: [], runEnded: null, posTarget: null });
      saveLive(); closeModal(); renderLive();
    };
    openModal(box);
  }
  // 📦 EXPORT / IMPORT — the archive is the user's asset; never trap it.
  const BC_KEYS = ['bc_live', 'bc_runs', 'bc_simnoise', 'bc_notify', 'bc_ingest', 'bc_sync', 'bc_tour'];
  function exportData() {
    const out = { app: 'batomon-companion', v: 1, exportedAt: new Date().toISOString() };
    BC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) out[k] = v; });
    const a = document.createElement('a');
    a.download = `batomon-companion-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function importData(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        if (j.app !== 'batomon-companion' || !(j.bc_live || j.bc_runs)) { alert('Not a Batomon Companion backup file.'); return; }
        if (!confirm('Import this backup? It REPLACES your current run state and Game History on this browser.')) return;
        BC_KEYS.forEach(k => { if (j[k] != null) localStorage.setItem(k, j[k]); });
        location.reload();
      } catch (e) { alert('Could not read that file: ' + e.message); }
    };
    rd.readAsText(file);
  }
  // 🏆 RUN HISTORY SECTION — lives INSIDE the Profile tab (Mobalytics pattern:
  // one player page, match history underneath). Renders into the given node.
  function renderHistory(rootEl) {
    const root = rootEl; if (!root) return;
    const runs = loadRuns();
    const fitted = fitSimNoise(); // auto-fits MC noise once the archive is big enough (no-op below thresholds)
    if (!runs.length) {
      root.innerHTML = `<div class="note" style="margin-top:10px">No runs recorded yet. Play with 🔌 Sync on (or drive the cockpit manually) — every finished run is archived here automatically with its full day-by-day breakdown.</div>
        <div style="margin-top:10px;display:flex;gap:6px"><button class="ghost" id="gh-export" style="font-size:11px">📦 Export data</button><button class="ghost" id="gh-import" style="font-size:11px">📥 Import a backup</button><input type="file" id="gh-import-file" accept="application/json" style="display:none"></div>`;
      $('#gh-export').onclick = exportData;
      $('#gh-import').onclick = () => $('#gh-import-file').click();
      $('#gh-import-file').onchange = (e) => { if (e.target.files[0]) importData(e.target.files[0]); };
      return;
    }
    // (career tiles / top-trainer live in the Profile header above — this
    // section is the match-history list + insights, Mobalytics-style)
    root.innerHTML = `<h3 style="margin:14px 0 6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">🏆 Game History <span style="font-size:12px;color:var(--muted);font-weight:400">— ${runs.length} run${runs.length > 1 ? 's' : ''} recorded · click a run to expand</span>
        <span style="margin-left:auto;display:flex;gap:6px"><button class="ghost" id="gh-export" style="font-size:11px" title="Download everything (run state, archive, settings) as one JSON backup">📦 Export data</button>
        <button class="ghost" id="gh-import" style="font-size:11px" title="Restore a backup — replaces current data">📥 Import</button>
        <input type="file" id="gh-import-file" accept="application/json" style="display:none"></span></h3>
      <div class="note" style="margin:0 0 10px">${fitted && fitted.fittedOn ? `📐 sim noise fitted on ${fitted.fittedOn} battles (σ ${fitted.foe}/${fitted.own}, Brier ${fitted.brier})` : '📐 sim noise: defaults (fits itself at 3+ runs / 25+ battles)'}</div>
      ${(() => { const ins = historyInsights(runs.slice(0, 20)); return ins.length ? `<div class="card" style="border-color:rgba(123,147,195,.5);background:linear-gradient(180deg,rgba(123,147,195,.08),transparent);margin-bottom:12px"><h3>🧠 Coaching insights <span style="font-size:10px;color:var(--muted);font-weight:400">· patterns across your last ${Math.min(runs.length, 20)} run${Math.min(runs.length, 20) === 1 ? '' : 's'} — sharpen as you play more</span></h3><ul style="margin:8px 0 0;padding-left:20px;line-height:1.7;font-size:12.5px">${ins.map(i => `<li style="margin-bottom:3px">${i}</li>`).join('')}</ul></div>` : ''; })()}
      <div style="display:flex;flex-direction:column;gap:8px">
        ${runs.map((r, i) => { const rm = RESULT_META[r.result] || RESULT_META.ended; const tags = runTags(r); return `<div class="card gh-card" data-i="${i}" style="padding:0;overflow:hidden;border-color:${rm.border}">
          <div class="gh-head" style="cursor:pointer;padding:9px 14px">
            <div style="display:flex;align-items:center;gap:10px">
              <b style="color:${rm.color};min-width:100px;font-size:13px">${rm.label}</b>
              <span style="color:var(--muted);min-width:90px">${esc(r.trainerName || '?')}</span>
              <span style="display:flex;gap:2px">${runSprites(r.finalBoard, 24)}</span>
              <span style="margin-left:auto;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px">🏅${r.badges} · day ${r.day} · <span style="color:var(--green)">${r.wins}W</span>-<span style="color:var(--red)">${r.losses}L</span> <button class="ghost gh-del" data-i="${i}" title="Delete this run from history (e.g. a mis-recorded result)" style="font-size:10px;padding:1px 7px;border-color:rgba(255,77,94,.5);color:var(--red)">🗑</button><span class="gh-caret">▸</span></span>
            </div>
            ${tags.length ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;padding-left:2px">${tagChips(tags)}</div>` : ''}
          </div>
          <div class="gh-body" style="display:none;padding:4px 14px 14px;border-top:1px solid var(--border)"></div>
        </div>`; }).join('')}
      </div>`;
    $('#gh-export').onclick = exportData;
    $('#gh-import').onclick = () => $('#gh-import-file').click();
    $('#gh-import-file').onchange = (e) => { if (e.target.files[0]) importData(e.target.files[0]); };
    // 🗑 remove a mis-recorded run (e.g. the false-champion an old sync bug wrote).
    // Career tiles + insights derive from bc_runs, so re-rendering refreshes them.
    root.querySelectorAll('.gh-del').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const r = runs[+b.dataset.i]; if (!r) return;
      if (!confirm(`Delete this run from history?\n\n${(RESULT_META[r.result] || {}).label || r.result} · ${r.badges}🏅 · day ${r.day} · ${r.trainerName || ''}\n\nThis only removes the record. It cannot be undone.`)) return;
      const all = loadRuns();
      const idx = r.id ? all.findIndex(x => x.id === r.id) : +b.dataset.i;
      if (idx >= 0) { all.splice(idx, 1); saveRuns(all); }
      renderProfile(); // rebuilds career tiles (championships etc.) + this list
    });
    root.querySelectorAll('.gh-card').forEach(card => {
      const head = card.querySelector('.gh-head'), body = card.querySelector('.gh-body'), caret = card.querySelector('.gh-caret');
      head.onclick = () => {
        const open = body.style.display !== 'none';
        if (open) { body.style.display = 'none'; caret.textContent = '▸'; }
        else {
          if (!body.dataset.filled) {
            body.innerHTML = runDetailHTML(runs[+card.dataset.i]);
            body.dataset.filled = '1';
            const sb = body.querySelector('.sum-card-btn'); if (sb) sb.onclick = (e) => { e.stopPropagation(); openSummaryCard(runs[+card.dataset.i]); };
            // ✎ correct a mis-recorded run (badges/W-L/result) — patches bc_runs by id,
            // then renderProfile() rebuilds the career tiles (championships) + this list.
            const eb = body.querySelector('.run-edit-btn'), ef = body.querySelector('.run-edit-form');
            if (eb) eb.onclick = (e) => { e.stopPropagation(); ef.style.display = ef.style.display === 'none' ? 'inline-flex' : 'none'; };
            const rcn = body.querySelector('.re-cancel'); if (rcn) rcn.onclick = (e) => { e.stopPropagation(); ef.style.display = 'none'; };
            const rsv = body.querySelector('.re-save');
            if (rsv) rsv.onclick = (e) => {
              e.stopPropagation();
              const r = runs[+card.dataset.i];
              const patch = {
                badges: Math.max(0, +body.querySelector('.re-badges').value || 0),
                wins: Math.max(0, +body.querySelector('.re-wins').value || 0),
                losses: Math.max(0, +body.querySelector('.re-losses').value || 0),
                result: body.querySelector('.re-result').value,
              };
              const all = loadRuns();
              const idx = r.id ? all.findIndex(x => x.id === r.id) : +card.dataset.i;
              if (idx >= 0) { Object.assign(all[idx], patch); saveRuns(all); }
              renderProfile();
            };
          }
          body.style.display = 'block'; caret.textContent = '▾';
        }
      };
    });
  }
  // multi-tab coherence: another tab's write replaces our in-memory state —
  // otherwise a stale tab's next sync push would resurrect old data (observed:
  // a dropped strategy coming back from a background tab's saveLive).
  window.addEventListener('storage', (e) => {
    if (e.key !== 'bc_live' || !e.newValue) return;
    try {
      live = JSON.parse(e.newValue);
      normalizeLiveStrategies(); // fresh parse breaks the strategy===strategies[0] reference identity — restore it
      // re-derive transient flags that only the sync applier normally maintains,
      // so a cross-tab blob can't leave a stale "RUN ENDED" banner over a live
      // run (or a dead posTarget from another day).
      if (live.lives > 0 && live.badges < 10) live.runEnded = null;
      if (live.posTarget && live.posTarget.day !== live.day) live.posTarget = null;
      if ($('#tab-live') && $('#tab-live').classList.contains('active')) renderLive();
    } catch (err) {}
  });

  // ---------------- buying from the shop (gold + auto-merge, like in-game) ----------------
  // ON-BUY feeders (mirror of the engine map): buying a matching type PERMANENTLY
  // grows these units — tracked per-slot in slot.feed {dmg, cds} so hover cards
  // and the Battle Brain show the accrued value.
  const FEEDERS_APP = {
    guardiant: { type: 'bug', dmg: 7 },
    cinderfly: { type: 'bug', cds: 10 },
    shogapede: { type: 'bug', cds: 10 },
  };
  function applyBuyFeeds(boughtMon) {
    const types = (boughtMon.types || []).map(t => t.id);
    const fedNames = [];
    for (const arr of [live.board, live.bench || []]) {
      // feed accrues wherever the feeder sits (board OR bench) — the passive
      // is on the unit itself, and permanent state must never be silently lost.
      arr.forEach(s => {
        if (!s) return;
        const f = FEEDERS_APP[s.monsterId];
        if (!f || !types.includes(f.type)) return;
        s.feed = s.feed || { dmg: 0, cds: 0 };
        if (f.dmg) s.feed.dmg += f.dmg;
        if (f.cds) s.feed.cds += f.cds;
        fedNames.push(`${(monById[s.monsterId] || {}).name}${f.dmg ? ' +' + f.dmg + ' Dmg' : ''}${f.cds ? ' +' + f.cds + '% CDS' : ''}`);
      });
    }
    return fedNames;
  }
  // MERGE RULE (verified in-game 2026-07-23 — 3x L1 makes an L2, up to L3):
  // THREE copies of the same level combine into ONE of the next level (3×L1→L2,
  // 3×L2→L3). TWO copies do NOT merge — they sit as separate bodies (matches the
  // save that showed 2 separate L1 Pebblers). Merging TOPS OUT at L3; Level 4 is
  // reachable only via level-up items (Upgrade Disc, "reach L3 → level up again"),
  // never by merging. So an incoming copy at level N climbs one level for every
  // TWO existing same-level copies it absorbs (it is the 3rd of the trio),
  // cascading upward. `arrs` = slot arrays to pull fuel from (board, bench).
  // Returns { level, consume:[[arr,idx],…] } — the final level + slots to null.
  function mergeChain(monId, startLevel, arrs) {
    let lvl = startLevel || 1;
    const consume = [], claimed = new Set();
    while (lvl < 3) { // cap: merges never reach L4
      const pair = [];
      for (const a of arrs) {
        for (let j = 0; j < a.length; j++) {
          const s = a[j];
          if (s && !claimed.has(s) && s.monsterId === monId && s.level === lvl) { pair.push([a, j, s]); if (pair.length === 2) break; }
        }
        if (pair.length === 2) break;
      }
      if (pair.length < 2) break; // need TWO more at this level to complete the trio
      pair.forEach(([a, j, s]) => { consume.push([a, j]); claimed.add(s); });
      lvl++;
    }
    return { level: lvl, consume };
  }
  function placeWithMerge(pick, targetIdx, dest) {
    // collecting copies auto-merges under the 3-copy rule (see mergeChain).
    let lvl = pick.level || 1, shiny = !!pick.shiny, merged = false;
    const feed = Object.assign({ dmg: 0, cds: 0 }, pick.feed); // merges keep accrued feeds
    const arrs = [live.board, live.bench || []];
    const chain = mergeChain(pick.monsterId, lvl, arrs);
    chain.consume.forEach(([a, j]) => {
      const eaten = a[j];
      shiny = shiny || !!eaten.shiny;
      if (eaten.feed) { feed.dmg += eaten.feed.dmg || 0; feed.cds += eaten.feed.cds || 0; }
      a[j] = null;
    });
    lvl = chain.level; merged = chain.consume.length > 0;
    const destArr = dest === 'bench' ? (live.bench || live.board) : live.board;
    let spot = (targetIdx != null && !destArr[targetIdx]) ? targetIdx : destArr.findIndex(s => !s);
    let placedIn = destArr;
    if (spot === -1) { // destination full → overflow to the other zone
      const alt = destArr === live.board ? (live.bench || []) : live.board;
      spot = alt.findIndex(s => !s);
      if (spot === -1) return { ok: false };
      placedIn = alt;
    }
    placedIn[spot] = { monsterId: pick.monsterId, level: lvl, shiny, feed: (feed.dmg || feed.cds) ? feed : undefined };
    return { ok: true, merged, level: lvl, spot, zone: placedIn === live.board ? 'board' : 'bench' };
  }
  function buyNote(msg) { setTimeout(() => { const n = $('#lv-opt-note'); if (n) n.innerHTML = msg; }, 60); }
  function buyFromShop(i, targetIdx, dest) {
    const o = live.shop[i]; if (!o) return;
    const m = monById[o.monsterId]; if (!m) return;
    const isBug = (m.types || []).some(t => t.id === 'bug');
    const freeBug = effectiveTrainerId() === 'bug_catcher' && !(live.trainerData || {}).bugBought && isBug;
    const cost = freeBug ? 0 : m.cost;
    if (cost > live.gold) { buyNote(`❌ Not enough gold for ${esc(m.name)} ($${cost} &gt; $${live.gold}).`); return; }
    const res = placeWithMerge({ monsterId: o.monsterId, level: o.level || 1, shiny: o.shiny }, targetIdx, dest);
    if (!res.ok) { buyNote('❌ Board & bench full — remove or merge a unit first.'); return; }
    live.gold -= cost;
    if (freeBug) live.trainerData.bugBought = true;
    live.shop.splice(i, 1);
    const fed = applyBuyFeeds(m); // feeders on board grow from this purchase
    saveLive(); renderLive();
    buyNote(`🛒 Bought <b>${esc(m.name)}</b>${res.merged ? ` — auto-merged to <b style="color:var(--gold)">L${res.level}</b>!` : ''}${res.zone === 'bench' ? ' → <b>bench</b>' : ''} · ${freeBug ? '<b style="color:var(--green)">FREE (first Bug)</b>' : '−$' + cost}${fed.length ? ` · 🌱 fed: ${fed.map(esc).join(', ')}` : ''} · $${live.gold} left`);
  }

  // ---------------- shop items: picker + buy with effects ----------------
  function itemPicker(onPick) {
    const box = el('div');
    box.appendChild(el('h3', null, 'Which items is the shop offering?'));
    const inp = el('input'); inp.type = 'text'; inp.placeholder = 'Search items…'; inp.style.cssText = 'width:100%;margin:10px 0';
    box.appendChild(inp);
    const tray = el('div', 'offers'); box.appendChild(tray);
    const confirm = el('button', 'primary'); confirm.style.cssText = 'margin:8px 0;display:none';
    box.appendChild(confirm);
    const grid = el('div', 'band-items'); box.appendChild(grid);
    const sel = [];
    const renderTray = () => {
      tray.innerHTML = '';
      sel.forEach((id, i) => {
        const it = D.items.find(x => x.id === id);
        const ch = el('div', 'offer-chip');
        ch.innerHTML = `<img class="sprite" src="${spr(it.sprite)}" style="width:22px;height:22px"><div style="font-size:11px">${esc(it.name)}</div><span class="x">×</span>`;
        ch.querySelector('.x').onclick = () => { sel.splice(i, 1); renderTray(); };
        tray.appendChild(ch);
      });
      confirm.style.display = sel.length ? '' : 'none';
      confirm.textContent = `✓ Add ${sel.length} item${sel.length > 1 ? 's' : ''}`;
    };
    confirm.onclick = () => { if (sel.length) { onPick(sel.slice()); closeModal(); } };
    const render = (q) => {
      grid.innerHTML = '';
      D.items
        .filter(it => !q || it.name.toLowerCase().includes(q))
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
        .forEach(it => {
          const cell = el('div', 'tier-item');
          cell.innerHTML = `<img class="sprite" src="${spr(it.sprite)}"><div>
            <div style="font-size:12px;font-weight:600">${esc(it.name)} <span style="color:var(--gold)">$${itemCost(it)}</span></div>
            <div class="pr" style="max-width:240px">${esc(it.description.slice(0, 70))}</div></div>`;
          cell.onclick = () => { sel.push(it.id); renderTray(); };
          wireBxHover(cell, 'item', it.id); // batodex card on hover
          grid.appendChild(cell);
        });
    };
    inp.oninput = () => render(inp.value.toLowerCase().trim());
    render('');
    openModal(box);
    inp.focus();
  }
  function buyShopItem(i) {
    const id = (live.shopItems || [])[i];
    const it = D.items.find(x => x.id === id);
    if (!it) return;
    const c = itemCost(it); // Shopkeeper-adjusted price (15% off)
    if (c > live.gold) { buyNote(`❌ Not enough gold for ${esc(it.name)} ($${c} &gt; $${live.gold}).`); return; }
    const finish = (msg) => { live.shopItems.splice(i, 1); live.gold -= c; saveLive(); renderLive(); buyNote(`🧪 ${esc(it.name)} ${c ? '−$' + c : '(free)'} — ${msg} · $${live.gold} left`); };
    switch (id) {
      case 'apex_bait': live.shopRank = Math.min(live.shopRank + 1, 14); finish('shop level +1 → ' + live.shopRank); break;
      case 'basic_bait': live.shopRank = Math.max(live.shopRank - 1, 1); finish('shop level −1 → ' + live.shopRank); break;
      case 'lucky_coin': live.gold += 3; finish('+$3 (and it refunds the item use in-game)'); break;
      case 'red_coin': live.gold += 20; live.lives = Math.max(live.lives - 1, 0); finish('+$20, −1 life 💔'); break;
      case 'basic_candy': case 'rare_candy': case 'ultra_candy': {
        const wantL = id === 'ultra_candy' ? 3 : 1;
        live.shopItems.splice(i, 1); live.gold -= c; saveLive();
        boardUnitPicker(`🍬 ${it.name} — which unit to level? (recommendation below)`, (s) => s.level === wantL && (id !== 'basic_candy' || (monById[s.monsterId] || {}).tier <= 2),
          (idx) => { live.board[idx].level = Math.min(live.board[idx].level + 1, 4); saveLive(); renderLive(); },
          { rank: levelUpValue });
        return;
      }
      case 'shiny_berry': {
        live.shopItems.splice(i, 1); live.gold -= c; saveLive();
        boardUnitPicker('Shiny Berry: which unit turned SHINY?', (s) => !s.shiny,
          (idx) => { live.board[idx].shiny = true; saveLive(); renderLive(); });
        return;
      }
      case 'gray_ticket': case 'green_ticket': case 'blue_ticket': case 'purple_ticket': case 'golden_ticket': case 'crimson_ticket':
        live.shop = []; finish('shop rerolled to a single rarity — re-add what it offers'); break;
      default:
        finish('effect applied in-game — mirror anything board-related manually');
    }
  }

  function trinketPicker(onPick, opts) {
    const o = opts || {};
    const box = el('div');
    box.appendChild(el('h3', null, esc(o.title || 'Add a trinket you hold')));
    const ctl = el('div', 'dex-controls');
    ctl.innerHTML = `
      <input type="text" id="tkp-search" placeholder="Search trinkets…" style="flex:1;min-width:160px">
      <select id="tkp-sort">
        <option value="wr">Sort: Real WR ↓</option>
        <option value="board">Sort: Board synergy ↓</option>
        <option value="rarity">Sort: Rarity ↑</option>
        <option value="name">Sort: Name A-Z</option>
      </select>`;
    box.appendChild(ctl);
    const grid = el('div', 'band-items');
    box.appendChild(grid);
    const boardIds = new Set(live.board.filter(s => s).map(s => s.monsterId));
    const render = () => {
      const q = $('#tkp-search', box).value.toLowerCase().trim();
      const sort = $('#tkp-sort', box).value;
      grid.innerHTML = '';
      const rows = D.trinkets
        .filter(t => !o.rarity || (t.rarity && t.rarity.label === o.rarity))
        .filter(t => !q || t.name.toLowerCase().includes(q))
        .map(t => ({ t, combo: bestBoardTrinketCombo(t.id, boardIds) }));
      const sorters = {
        wr: (a, b) => ((b.t.stats && b.t.stats.winRate) || 0) - ((a.t.stats && a.t.stats.winRate) || 0),
        board: (a, b) => ((b.combo || {}).winRate || -1) - ((a.combo || {}).winRate || -1) || ((b.t.stats && b.t.stats.winRate) || 0) - ((a.t.stats && a.t.stats.winRate) || 0),
        rarity: (a, b) => a.t.tier - b.t.tier || ((b.t.stats && b.t.stats.winRate) || 0) - ((a.t.stats && a.t.stats.winRate) || 0),
        name: (a, b) => a.t.name.localeCompare(b.t.name),
      };
      rows.sort(sorters[sort] || sorters.wr);
      rows.forEach(({ t, combo }) => {
        const c = el('div', 'tier-item' + (combo && combo.winRate >= 78 ? ' combo-glow' : ''));
        c.innerHTML = `<img class="sprite" src="${spr(t.sprite)}"><div>
          <div style="font-size:12px;font-weight:600">${esc(t.name)}</div>
          <div class="pr">${t.stats ? wrSpan(t.stats.winRate) + ' WR' : ''} · <span style="color:${rarColor(t)}">${esc(rarLabel(t))}</span></div>
          ${combo ? `<div class="combo-hit" title="With ${combo.ids.map(id => (monById[id] || { name: id }).name).join(' + ')} on your board (${combo.rounds} rounds)">⚡ ${combo.winRate}% w/ your board</div>` : ''}</div>`;
        c.onclick = () => { onPick(t.id); closeModal(); };
        wireBxHover(c, 'trinket', t.id); // batodex card on hover (replaces the plain tooltip)
        grid.appendChild(c);
      });
    };
    ctl.addEventListener('input', render);
    render();
    openModal(box);
    $('#tkp-search', box).focus();
  }

  // 🏆 HERO win% — the one number that matters (do I win this fight), pinned at the top
  // of the cockpit. Reads the memoized lastLiveWin (computed by battleBrainHTML) — no
  // re-sim. Empty while there's no board to fight with.
  function heroWinHTML() {
    if (!lastLiveWin || !live.board.some(Boolean)) return '';
    // The verdict MUST come from the same number it sits next to. It used to read
    // the closed-form margin while the % came from the Monte-Carlo sim, which could
    // render a red "~40%" beside a green "FAVORED" on the same line.
    const w = lastLiveWin.win;
    const tone = w >= 60 ? { t: 'FAVORED', c: 'var(--green)' } : w >= 40 ? { t: 'CLOSE', c: 'var(--gold)' } : { t: 'BEHIND', c: 'var(--red)' };
    const col = tone.c;
    return `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 10px;padding:9px 16px;border:1px solid ${tone.c};border-radius:12px;background:linear-gradient(90deg,${col}1e,transparent)">
      <div style="font-size:30px;font-weight:800;color:${col};line-height:1;min-width:74px">~${w}%</div>
      <div><div style="font-size:14px;font-weight:800;color:${tone.c};letter-spacing:.5px">${tone.t}</div>
        <div style="font-size:10px;color:var(--muted)">today's battle · ${lastLiveWin.synced ? 'vs your REAL synced opponent' : 'vs the day-average enemy'}</div></div>
      <div style="margin-left:auto;text-align:right;font-size:11px;color:var(--muted)"><b style="color:${live.lives <= 1 ? 'var(--red)' : 'var(--text)'}">${live.lives} ❤</b> · day ${live.day} · ${live.badges}🏅</div>
    </div>`;
  }
  function renderLive() {
    hcHide(); // hovered elements may be replaced — never leave a stale stat card
    const root = $('#tab-live');
    root.innerHTML = `
      <h2 style="margin:0 0 6px">Live Run <span style="font-size:12px;color:var(--muted)">— mirror your game here; advice updates on every change</span></h2>
      <div id="lv-hero">${heroWinHTML()}</div>
      <div class="card" style="margin-bottom:12px;padding:10px 16px">
        <div class="tier-controls" style="align-items:flex-end">
          <label class="ctl" title="Exact formula (batodex wiki/income): income = 25 + min(80, day × 5), paid at the START of each day. Trinket gold (Nugget/Bar/o-matic, Piggy Bank, Trophy/Grail on wins) is added automatically on Victory/Defeat.">Next income<span class="pill" style="align-self:center;color:var(--gold);font-weight:700">${(() => {
            const base = incomeFor(Math.min(live.day + 1, 40));
            const w = base + trinketIncome(true), l = base + trinketIncome(false);
            return w === l ? '+$' + w : `+$${w} W / +$${l} L`;
          })()}</span></label>
          <button class="primary" id="lv-win" style="background:var(--green)${syncEnabled() ? ';opacity:.35' : ''}" title="${syncEnabled() ? 'Game sync records battles automatically — turn sync off to drive manually' : 'Won the battle: +1 badge, next day, income applied'}">✓ Victory</button>
          <button class="primary" id="lv-loss" style="background:var(--red)${syncEnabled() ? ';opacity:.35' : ''}" title="${syncEnabled() ? 'Game sync records battles automatically — turn sync off to drive manually' : 'Lost the battle: −1 life, next day, income applied'}">✗ Defeat</button>
          ${live.isRanked ? '<span class="chip good" style="margin-left:auto;align-self:center;font-size:10px" title="Detected from the run save (is_ranked) — you\'re in a RANKED run. Your tier/stars live in the game\'s encrypted save, so set them in Profile → 🎖 Ranked and they persist.">🏅 Ranked run</span>' : ''}
          <button class="ghost lockbtn" id="lv-sync" style="margin-left:auto" title="Mirror the game automatically: reads the game's own run save (run_save.json) every 2s — board, bench, shop, gold, lives, trinkets, lock. Manual edits are overwritten while ON."></button>
          <button class="ghost" id="lv-ai" title="Second opinion from Claude: live run + the app's advice + patch notes + Steam community discussions → one sharp coaching answer. Needs a one-time API key setup (kept on your machine).">🧠 AI analysis</button>
          <button class="ghost" id="lv-overlay" title="Floating mini-window with the 🧭 This-turn plan + win% — keep it over the game (picture-in-picture where supported).">🗖 Overlay</button>
          <button class="ghost" id="lv-notify" title="Browser notifications: run archived, power-spike warning.">${localStorage.getItem('bc_notify') === '1' ? '🔔' : '🔕'}</button>
          <button class="ghost" id="lv-reset">🔄 New run</button>
        </div>
        ${live.isRanked && !(live.lives <= 0 || live.runEnded) ? rankedProjectionHTML(live.badges, { final: false }) : ''}
        ${live.badges >= 10 ? `<div class="reroll-note" style="border-color:var(--gold);margin-top:10px">🏆 <b>CHAMPION — ${live.badges} badge${live.badges === 1 ? '' : 's'}!</b> ${live.badges > 10 ? 'Endless mode — keep stacking.' : 'Extended Mode continues to day 40.'}</div>` : ''}
        ${(() => {
          // A CHAMPION who keeps playing in endless (10+ badges, lives left, save
          // still syncing) is NOT done — don't slap a "RUN COMPLETE / run over"
          // banner over an active run. The 🏆 champion note above already says
          // "endless — keep stacking". Show the final banner only once it's truly
          // over: you died (lives 0) or the save vanished (syncStatus 'norun').
          const stillPlayingEndless = live.badges >= 10 && live.lives > 0 && syncStatus === 'live';
          const ended = !stillPlayingEndless && (live.lives <= 0 || live.runEnded);
          if (!ended) return '';
          // the frozen runEnded.result wins (a CHAMPION who dies pushing endless
          // still WON — badges≥10 → 'won'); only fall back to lives when unset.
          const res = (live.runEnded && live.runEnded.result) || (live.lives <= 0 ? 'lost' : 'ended');
          const rm = { lost: { icon: '💀', label: 'RUN ENDED — 0 lives', color: 'var(--red)' }, won: { icon: '🏆', label: 'RUN COMPLETE — Champion!', color: 'var(--gold)' }, ended: { icon: '⏹', label: 'RUN ENDED', color: 'var(--red)' } }[res] || { icon: '⏹', label: 'RUN ENDED', color: 'var(--red)' };
          // read the FROZEN snapshot from live.runEnded so the numbers don't drift
          // if a champion keeps playing in Extended Mode (lives restore → day/losses
          // would otherwise recompute live). Fall back to live values for old runs.
          const rd = live.runEnded || {};
          const bDay = rd.day != null ? rd.day : live.day;
          const bBadges = rd.badges != null ? rd.badges : live.badges;
          const bLosses = rd.losses != null ? rd.losses : Math.max((live.maxLives || 3) - live.lives, 0);
          const runSig = live.syncRunId || `local-${bDay}-${bBadges}`;
          // A RANKED run that ended at exactly 9🏅 is inherently ambiguous — you were
          // on your last life playing the 10th-badge battle, and winning it (champion)
          // vs losing it (death) leave the game sync in the same state. Ask, don't
          // guess — this also RETROACTIVELY offers the fix for a run an older sync
          // mislabelled (a run logged "died at 9" that was really a champion). Suppressed
          // once resolved. (A 2+-life 9🏅 vanish was already promoted to 10 = champion.)
          const amb = bBadges === 9 && live.isRanked && live.runEndedResolved !== runSig;
          return `<div class="reroll-note" style="border-color:${amb ? 'var(--gold)' : rm.color};margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <b style="font-size:14px;color:${amb ? 'var(--gold)' : rm.color}">${amb ? '❓ RUN ENDED — 9🏅 on your last life' : rm.icon + ' ' + rm.label}</b>
            <span style="color:var(--muted)">Reached <b>day ${bDay}</b> · <b>${bBadges}</b> 🏅 · ${bBadges}W-${bLosses}L. Saved to 🏆 Game History.</span>
            <button class="ghost" id="lv-gotohistory" style="font-size:11px">🏆 View history</button>
            <button class="primary" id="lv-reset2" style="margin-left:auto;background:var(--green)">🔄 Start new run</button>
          </div>${amb
            ? `<div class="reroll-note" style="border-color:var(--gold);margin-top:8px">
                ⚠️ <b>Champion or death?</b> Winning the 10th badge from your last life and losing it look <b>identical</b> to the game sync — so I won't guess your rank. Which was it?
                <div style="display:flex;gap:8px;margin-top:7px;flex-wrap:wrap">
                  <button class="primary rez-end" data-won="1" data-sig="${esc(runSig)}" style="background:var(--gold)">🏆 I won the 10th — Champion (+5★)</button>
                  <button class="ghost rez-end" data-won="0" data-sig="${esc(runSig)}">💀 I died at 9 (${rankStarDelta(9) >= 0 ? '+' : ''}${rankStarDelta(9)}★)</button>
                </div></div>`
            : (live.isRanked ? rankedProjectionHTML(bBadges, { final: true, runSig }) : '')}`;
        })()}
      </div>
      <div class="live-grid">
        <div class="lv-col">
          ${trainerCardHTML()}
          <div class="card">
            <div class="rowlabel" style="margin-top:0">🪑 Bench <span style="font-weight:400">(reserves — drag ⇄ board · merges & optimizer include it)</span></div>
            <div class="slotgrid bench" id="lv-bench"></div>
            <div class="rowlabel">Your board — top row &nbsp;<span style="font-weight:400">(→ RIGHT = front / enemy side)</span></div>
            <div class="slotgrid" id="lv-top"></div>
            <div class="rowlabel">Bottom row</div>
            <div class="slotgrid" id="lv-bottom"></div>
          </div>
          <div class="card">
            <h3>Trinkets you hold</h3>
            <div class="offers" id="lv-trinkets"></div>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
              <button class="ghost" id="lv-tk-add">+ Add trinket</button>
              <button class="ghost" id="lv-gift" title="The game offers 2-4 trinkets? Pick them here — every option gets scored against YOUR board, trainer and held trinkets, with the winner flagged.">🎁 Gift choice</button>
            </div>
          </div>
          <div class="card">
            <h3>🎪 Event advisor</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
              <button class="ghost" id="lv-event">+ Add event</button>
              <button class="ghost" id="lv-secondchance" title="The Second Chance event: a mysterious trainer revives you — sets Lives to 1 and offers a trinket gift / L2 Super Rare / Mysterious Charm.">🕊 Second Chance (lives → 1)</button>
            </div>
          </div>
          <div class="card" id="lv-dayplan"></div>
        </div>
        <div class="lv-col">
          <div class="card">
            <h3>Current shop <span style="font-size:10px;color:var(--muted);font-weight:400">· click = BUY · drag onto board/bench = buy into that slot</span>
              <button class="ghost lockbtn ${live.shopLocked ? 'locked' : ''}" id="lv-shop-lock" title="Lock: in-game, locked offers carry over to tomorrow (empty slots refill). Mirror it here — the 🎰 verdict tells you when locking beats buying or rerolling.">${live.shopLocked ? '🔒 LOCKED' : '🔓 Lock'}</button></h3>
            <div class="offers" id="lv-shop"></div>
            <div class="rowlabel">Items on offer${live.itemUses ? ` <span style="font-weight:700;color:${live.itemUses.used >= live.itemUses.max ? 'var(--red)' : 'var(--green)'}">· uses today: ${live.itemUses.used}/${live.itemUses.max}</span>` : ''}</div>
            <div class="offers" id="lv-shopitems"></div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="ghost" id="lv-shop-add">+ Add what shop offers</button>
              <button class="ghost" id="lv-item-add">+ Add items</button>
              <button class="ghost" id="lv-shop-clear">Clear (reroll/new day)</button>
            </div>
          </div>
          <div id="lv-advice-buy" class="lv-col"></div>
          ${live.plan ? compPlanHTML() : `<div class="card"><h3>🎯 Composition plan</h3>
            <div class="note" style="margin:4px 0 8px">Pick a build in the <b>Builds</b> tab ("Set as run plan") — the cockpit will track every piece you're missing and the advisor will hunt them.</div></div>`}
        </div>
        <div class="lv-col">
          <div id="lv-advice-brain" class="lv-col"></div>
          ${live.history.length ? `<div class="card"><h3>📜 This run — battle log</h3>
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:200px;overflow-y:auto">
            ${live.history.map(h => `<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;background:var(--bg2);border:1px solid ${h.won ? 'rgba(61,220,132,.35)' : 'rgba(255,77,94,.35)'};border-radius:9px;padding:5px 9px">
              <b style="color:${h.won ? 'var(--green)' : 'var(--red)'};min-width:56px">${h.won ? '✓ WIN' : '✗ LOSS'}</b>
              <span style="color:var(--muted)">Day ${h.day}</span>
              <span style="display:flex;gap:2px">${h.board.slice(0, 6).map(b => { const m = monById[b.id]; return m ? `<img class="sprite" src="${spr(b.shiny && m.shinySprite ? m.shinySprite : m.sprite)}" width="22" height="22" title="${esc(m.name)} L${b.lvl}">` : ''; }).join('')}</span>
              <span style="margin-left:auto;color:var(--muted)">🏅${h.after.badges} ❤${h.after.lives} <span style="color:var(--gold)">+$${h.income}</span></span>
            </div>`).join('')}</div></div>` : ''}
          ${loadRuns().length ? `<div class="card" style="text-align:center"><button class="ghost" id="lv-history-link" style="width:100%">🏆 Game History — ${loadRuns().length} past run${loadRuns().length > 1 ? 's' : ''} ›</button></div>` : ''}
        </div>
      </div>`;

    // header controls
    root.querySelectorAll('.stepper button').forEach(b => b.onclick = () => {
      const k = b.dataset.st, d = +b.dataset.d;
      live[k] = Math.max(k === 'day' ? 1 : 0, Math.min(k === 'day' ? 40 : k === 'badges' ? 10 : 20, live[k] + d));
      if (k === 'day' && d > 0) {
        // new day: locked offers carry over (empty slots refill in-game), else fresh shop
        if (live.shopLocked) live.shopLocked = false; else { live.shop = []; live.shopItems = []; }
        live.trainerData.bugBought = false; // Bug Catcher discount resets (works on locked bugs too)
      }
      if (k === 'day') live.hp = suggestedHP(live.day); // HP bar follows the day
      if (k === 'shopRank') live.shopRank = Math.max(1, Math.min(live.shopRank, 14));
      if (k === 'lives' && live.lives > 1) live.trainerData.secondChance = false; // healed past the brink
      saveLive(); renderLive();
    });
    let goldT = null;
    $('#lv-gold').oninput = (e) => { // live while typing, lightly debounced
      live.gold = Math.max(0, +e.target.value || 0); saveLive();
      clearTimeout(goldT); goldT = setTimeout(liveAdvice, 160);
    };
    let hpT = null;
    $('#lv-hp').oninput = (e) => { // learn the day's base HP from the real bar
      setHPFromGame(+e.target.value || 0); saveLive();
      clearTimeout(hpT); hpT = setTimeout(() => { const h = $('#tc-hp'); if (h) h.innerHTML = trainerCardHpHTML(); liveAdvice(); }, 250);
    };
    $('#lv-shop-lock').onclick = () => { live.shopLocked = !live.shopLocked; saveLive(); renderLive(); };
    $('#lv-trainer').onchange = (e) => { live.trainerId = e.target.value || null; live.trainerData = {}; saveLive(); renderLive(); };
    $('#lv-win').onclick = () => endDay(true);
    $('#lv-loss').onclick = () => endDay(false);
    $('#lv-reset').onclick = () => {
      archiveRun('abandoned'); // 🏆 keep the run you're leaving in Game History
      // with sync ON the game would repaint the cockpit within ~100ms — turn it
      // off first so "New run" actually sticks (predictable, reversible)
      if (syncEnabled()) { localStorage.setItem('bc_sync', '0'); stopSyncStream(); lastSyncKey = null; syncStatus = 'off'; }
      live = liveDefault(); saveLive(); renderLive();
    };
    const reset2 = $('#lv-reset2'); if (reset2) reset2.onclick = () => $('#lv-reset').onclick();
    // ❓ resolve the ambiguous "9🏅 on your last life" run end. The game sync can't
    // tell a WON 10th-badge (champion, from 1 life) from a LOST one (death) — both
    // leave the same {9, 1} snapshot — so instead of guessing (and applying a wrong
    // rank), the player confirms 🏆/💀 here. We patch the archived run + apply the
    // correct star delta on their answer. (False-non-champion fix, 2026-07-24.)
    document.querySelectorAll('.rez-end').forEach(b => b.onclick = () => {
      const won = b.dataset.won === '1';
      const sig = b.dataset.sig;
      if (!sig) return;
      const finalBadges = won ? 10 : 9;
      // patch the archived run (id === runSig) so Game History + career tiles are right
      const all = loadRuns();
      const idx = all.findIndex(x => x.id === sig);
      if (idx >= 0) { Object.assign(all[idx], { badges: finalBadges, wins: finalBadges, result: won ? 'won' : 'lost' }); saveRuns(all); }
      if (live.runEnded) { live.runEnded.badges = finalBadges; live.runEnded.result = won ? 'won' : 'lost'; }
      live.badges = finalBadges;
      live.lives = won ? Math.max(live.lives || 1, 1) : 0;
      live.runEndedAmbiguous = null;
      live.runEndedResolved = sig; // don't re-prompt this run
      // RANK: undo any rank an older/auto path already applied for THIS run, then
      // apply the correct delta for the confirmed result (champion +5★ vs death +4★).
      if (live.isRanked) {
        try { const la = JSON.parse(localStorage.getItem('bc_rankLastApplied') || 'null'); if (la && la.runSig === sig) { const prev = localStorage.getItem('bc_rankUndo'); if (prev) localStorage.setItem('bc_rankmanual', prev); localStorage.removeItem('bc_rankLastApplied'); } } catch (e) {}
        const ap = autoApplyRankedResult(finalBadges, sig); if (ap) bcNotify('🎖 Rank updated', (ap.delta >= 0 ? '+' : '') + ap.delta + '★ → ' + rankStr(ap.to));
      }
      saveLive(); renderLive(); try { renderProfile(); } catch (e) {}
    });
    // 🎖 one-click apply of a ranked run's star delta. Records bc_rankLastApplied
    // (runSig + pre/post) so the banner shows the transition and can never re-apply.
    document.querySelectorAll('.rank-apply').forEach(b => b.onclick = () => {
      let to = null, from = null;
      try { to = JSON.parse(b.dataset.to || 'null'); } catch (e) {}
      try { from = JSON.parse(b.dataset.from || 'null'); } catch (e) {}
      if (!to) return;
      localStorage.setItem('bc_rankUndo', localStorage.getItem('bc_rankmanual') || ''); // ✎ update or undo can restore
      localStorage.setItem('bc_rankmanual', JSON.stringify({ tier: to.tier, div: to.div, stars: to.stars, mmr: to.mmr || null, at: Date.now() }));
      if (b.dataset.sig) localStorage.setItem('bc_rankLastApplied', JSON.stringify({ runSig: b.dataset.sig, from, to: { tier: to.tier, div: to.div, stars: to.stars } }));
      renderLive();
    });
    // ↶ undo an (auto-)applied rank change — restores the pre-run rank baseline and
    // forgets the applied record so the run projects fresh again.
    document.querySelectorAll('.rank-undo').forEach(b => b.onclick = () => {
      const prev = localStorage.getItem('bc_rankUndo');
      if (prev) localStorage.setItem('bc_rankmanual', prev);
      localStorage.removeItem('bc_rankLastApplied');
      renderLive();
    });
    // 🧑✨ trainer-pick advisor: meta WR × YOUR per-trainer record, SCOPED to the
    // 3 the game is offering (detected from the save's pending_trainer_options, or
    // marked by hand with 🎯 when sync can't see them).
    $('#lv-trainer-adv').onclick = () => {
      const runs = loadRuns();
      const mine = {};
      runs.forEach(r => { if (!r.trainer) return; (mine[r.trainer] = mine[r.trainer] || { n: 0, b: 0, c: 0 }); mine[r.trainer].n++; mine[r.trainer].b += r.badges || 0; mine[r.trainer].c += r.result === 'won' ? 1 : 0; });
      const scoreOf = (t) => (t.stats.winRate || 50) + (mine[t.id] ? (mine[t.id].b / mine[t.id].n) * 2 + (mine[t.id].c ? 6 : 0) : 0);
      const all = D.trainers.filter(t => t.stats).map(t => ({ t, m: mine[t.id], score: scoreOf(t) })).sort((a, b) => b.score - a.score);
      const box = el('div');
      const rowHTML = (r, rankInGroup) => {
        const offered = (live.trainerOffers || []).includes(r.t.id);
        return `<div class="ta-row" data-id="${r.t.id}" style="cursor:pointer;display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid ${rankInGroup === 0 ? 'rgba(61,220,132,.5)' : 'var(--border)'};border-radius:9px;padding:7px 11px">
          ${rankInGroup === 0 ? '<b class="wr-good" style="font-size:10px">PICK</b>' : `<span style="font-size:10px;color:var(--muted)">#${rankInGroup + 1}</span>`}
          <b style="font-size:12.5px;min-width:120px">${esc(r.t.name)}</b>
          <span style="font-size:11px;color:var(--muted)">meta ${r.t.stats.winRate}% WR</span>
          ${r.m ? `<span style="font-size:11px;color:var(--gold)">you: ${r.m.n} run${r.m.n > 1 ? 's' : ''} · avg ${(r.m.b / r.m.n).toFixed(1)} 🏅${r.m.c ? ` · ${r.m.c}× 🏆` : ''}</span>` : '<span style="font-size:10.5px;color:var(--muted)">no runs yet</span>'}
          <button class="ta-mark ghost" data-id="${r.t.id}" title="Mark as one of the 3 the game is offering you" style="margin-left:auto;padding:1px 7px;font-size:11px;${offered ? 'border-color:var(--accent);color:var(--accent)' : 'opacity:.5'}">🎯</button>
        </div>`;
      };
      const render = () => {
        const offers = (live.trainerOffers || []).filter(id => D.trainers.some(t => t.id === id));
        const offeredRows = offers.length ? all.filter(r => offers.includes(r.t.id)) : [];
        box.innerHTML = `<h3>🧑✨ Who should I pick? <span style="font-size:10.5px;color:var(--muted);font-weight:400">· meta WR blended with YOUR runs — click a row to set it</span></h3>
          ${offeredRows.length ? `<div class="rowlabel" style="margin-top:10px;color:var(--accent)">🎯 Offered this run — pick the flagged one</div>
            <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${offeredRows.map((r, i) => rowHTML(r, i)).join('')}</div>` : ''}
          <div class="rowlabel" style="margin-top:12px">${offeredRows.length ? 'All trainers (reference · 🎯 to change what you were offered)' : 'All trainers — 🎯 mark the 2–4 the game is offering you, or click one to set it'}</div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;max-height:46vh;overflow-y:auto">
          ${all.map((r, i) => rowHTML(r, offeredRows.length ? -1 : i)).join('')}</div>
          <div class="note" style="margin-top:8px;font-size:10px">Your own record weighs in once you've played a trainer — the more runs, the more it counts.${offeredRows.length ? '' : ' No 🎯 marks = ranking is across the whole roster.'}</div>`;
        box.querySelectorAll('.ta-mark').forEach(mk => mk.onclick = (e) => { e.stopPropagation(); const id = mk.dataset.id; const cur = new Set(live.trainerOffers || []); cur.has(id) ? cur.delete(id) : cur.add(id); live.trainerOffers = [...cur]; saveLive(); render(); });
        box.querySelectorAll('.ta-row').forEach(rw => rw.onclick = (e) => { if (e.target.closest('.ta-mark')) return; live.trainerId = rw.dataset.id; live.trainerData = {}; live.trainerOffers = null; saveLive(); closeModal(); renderLive(); });
      };
      render();
      openModal(box);
    };
    // 🗖 overlay window (Document Picture-in-Picture → real always-on-top; popup fallback)
    $('#lv-overlay').onclick = async () => {
      if (window.__ovlWin && !window.__ovlWin.closed) { try { window.__ovlWin.focus(); } catch (e) {} return; }
      const prep = (doc) => {
        const lk = doc.createElement('link'); lk.rel = 'stylesheet'; lk.href = new URL('styles.css', location.href).href;
        doc.head.appendChild(lk);
        doc.body.style.cssText = 'background:#101017;color:#e8e8ee;font-family:system-ui;margin:0;padding:10px;font-size:13px';
        const root = doc.createElement('div');
        doc.body.appendChild(root);
        return root;
      };
      try {
        if (window.documentPictureInPicture) {
          const w = await documentPictureInPicture.requestWindow({ width: 460, height: 380 });
          window.__ovlWin = w; window.__ovl = prep(w.document);
          w.addEventListener('pagehide', () => { window.__ovl = null; window.__ovlWin = null; });
        } else {
          const w = window.open('', 'bc_overlay', 'width=470,height=400,popup=yes');
          if (!w) return;
          w.document.title = 'Batomon Companion — overlay';
          window.__ovlWin = w; window.__ovl = prep(w.document);
          const iv = setInterval(() => { if (w.closed) { clearInterval(iv); window.__ovl = null; window.__ovlWin = null; } }, 1500);
        }
        liveAdvice(); // paint immediately
      } catch (e) {}
    };
    // 🔔 notifications toggle
    $('#lv-notify').onclick = async () => {
      const on = localStorage.getItem('bc_notify') === '1';
      if (on) { localStorage.setItem('bc_notify', '0'); }
      else {
        try { const p = await Notification.requestPermission(); if (p !== 'granted') return; } catch (e) { return; }
        localStorage.setItem('bc_notify', '1');
      }
      renderLive();
    };
    const goHist = () => document.querySelector('#nav button[data-tab="profile"]').click();
    const histLink = $('#lv-history-link'); if (histLink) histLink.onclick = goHist;
    const histBtn2 = $('#lv-gotohistory'); if (histBtn2) histBtn2.onclick = goHist;
    renderSyncPill();
    $('#lv-sync').onclick = () => {
      localStorage.setItem('bc_sync', syncEnabled() ? '0' : '1');
      lastSyncKey = null; syncStatus = 'off';
      renderSyncPill();
      if (syncEnabled()) { startSyncStream(); syncTick(true); } else stopSyncStream();
    };
    $('#lv-ai').onclick = openAIAnalysis;

    // per-trainer live panel + its controls
    $('#lv-dayplan').insertAdjacentHTML('beforebegin', trainerPanelHTML());
    const tpRanger = $('#tp-ranger');
    if (tpRanger) tpRanger.onclick = () => monsterPicker({
      title: 'Which Uncommon did the Ranger grant?',
      pool: monsters.filter(m => m.tier === 2),
    }, (pick) => { if (pick) { live.trainerData.rangerMonId = pick.monsterId; saveLive(); renderLive(); } });
    const tpBug = $('#tp-bug');
    if (tpBug) tpBug.onchange = (e) => { live.trainerData.bugBought = e.target.checked; saveLive(); renderLive(); };
    const tpChem = $('#tp-chemist');
    if (tpChem) tpChem.onchange = (e) => { live.trainerData.levelUps = Math.max(0, +e.target.value || 0); saveLive(); renderLive(); };
    const tpMask = $('#tp-mask');
    if (tpMask) tpMask.onchange = (e) => { live.trainerData.maskTrainerId = e.target.value || null; saveLive(); renderLive(); };
    const tpRed = $('#tp-redhead');
    if (tpRed) tpRed.onchange = (e) => { live.trainerData.victories = Math.max(0, +e.target.value || 0); saveLive(); renderLive(); };

    // board slots (with 🎯 target guidance rings when a target layout is set)
    let tgt = live.posTarget && live.posTarget.day === live.day ? live.posTarget : null;
    if (tgt) {
      // staleness guard: if the roster changed (bought/sold/merged) so the
      // target can't be assembled anymore, drop it — no contradictions
      const ownedCount = {};
      [...live.board, ...(live.bench || [])].forEach(s => { if (s) ownedCount[s.monsterId] = (ownedCount[s.monsterId] || 0) + 1; });
      const tgtCount = {};
      tgt.board.forEach(t => { if (t) tgtCount[t.monsterId] = (tgtCount[t.monsterId] || 0) + 1; });
      if (!Object.entries(tgtCount).every(([id, n]) => (ownedCount[id] || 0) >= n)) {
        live.posTarget = null; tgt = null; saveLive();
      }
    }
    const tgtMatches = tgt ? tgt.board.map((t, i) => (t ? !!(live.board[i] && live.board[i].monsterId === t.monsterId) : !live.board[i])) : null;
    // 🥚 hatch badge: an egg carrying hatch data shows what it becomes + when,
    // so the board itself tells you a body is arriving (in sync with 🧭/plan).
    const eggBadge = (s) => {
      if (!s || !s.hatch) return '';
      const into = s.hatch.into && monById[s.hatch.into];
      const nm = into ? into.name : '?';
      const t = s.hatch.turns;
      const when = t <= 0 ? 'now' : t === 1 ? '1 day' : t + ' days';
      return `<span class="egg-hatch" title="Hatches into ${esc(nm)}${into && into.tier ? ` — tier ${into.tier}` : ''} in ${when}">🥚→${esc(nm)} · ${when}</span>`;
    };
    [$('#lv-top'), $('#lv-bottom')].forEach((g, gi) => {
      g.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const idx = gi * 3 + i;
        const s = live.board[idx];
        const cell = el('div', 'slot' + (s ? '' : ' empty'));
        if (tgtMatches) {
          cell.classList.add(tgtMatches[idx] ? 'pos-ok' : 'pos-move');
          if (!tgtMatches[idx]) {
            const want = tgt.board[idx] && (monById[tgt.board[idx].monsterId] || {}).name;
            cell.title = want ? `🎯 target: ${want} belongs here` : '🎯 target: this slot should be empty';
          }
        }
        if (s) {
          const m = monById[s.monsterId];
          cell.innerHTML = `<span class="lvl">L${s.level}</span>${mcBadge(s)}${s.shiny ? '<span class="shinymark">✨</span>' : ''}
            <img class="sprite" src="${spr(s.shiny && m.shinySprite ? m.shinySprite : m.sprite)}"><div class="nm">${esc(m.name)}</div>${eggBadge(s)}${slotArrows(live.board, idx)}`;
        } else cell.innerHTML = `<div class="nm">${gi === 0 && i === 1 ? '👑 carry' : '+ add'}</div>`;
        wireSlot(cell,
          () => live.board[idx],
          (next) => { live.board[idx] = next; saveLive(); renderLive(); },
          () => monsterPicker({
            title: (gi === 0 ? 'Top ' : 'Bottom ') + (i + 1) + (gi === 0 && i === 1 ? ' (crown slot)' : ''),
            allowClear: true, defaultLevel: s ? s.level : 1, defaultShiny: s ? s.shiny : false,
            pool: monsters.filter(m => m.cost > 0 || m.isEvolvedForm),
            boardIds: new Set([...live.board.filter((x, xi) => x && xi !== idx), ...(live.bench || []).filter(Boolean)].map(x => x.monsterId)),
          }, (pick) => { live.board[idx] = pick; saveLive(); renderLive(); }));
        wireDrag(cell, live.board, idx, saveLive, renderLive);
        wireDropTarget(cell, live.board, idx, saveLive, renderLive);
        g.appendChild(cell);
      }
    });
    // bench slots — same mechanics as board (drag/hover/quick-buttons); no
    // positional arrows (bench units don't fight, but they DO merge and feed).
    const benchG = $('#lv-bench');
    benchG.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const s = live.bench[i];
      const cell = el('div', 'slot bench-slot' + (s ? '' : ' empty'));
      if (s) {
        const m = monById[s.monsterId];
        cell.innerHTML = `<span class="lvl">L${s.level}</span>${mcBadge(s)}${s.shiny ? '<span class="shinymark">✨</span>' : ''}
          <img class="sprite" src="${spr(s.shiny && m.shinySprite ? m.shinySprite : m.sprite)}"><div class="nm">${esc(m.name)}</div>${eggBadge(s)}`;
      } else cell.innerHTML = '<div class="nm">🪑 bench</div>';
      wireSlot(cell,
        () => live.bench[i],
        (next) => { live.bench[i] = next; saveLive(); renderLive(); },
        () => monsterPicker({
          title: 'Bench ' + (i + 1),
          allowClear: true, defaultLevel: s ? s.level : 1, defaultShiny: s ? s.shiny : false,
          pool: monsters.filter(m => m.cost > 0 || m.isEvolvedForm),
          boardIds: new Set([...live.board, ...live.bench].filter((x, xi) => x && !(xi >= 6 && xi - 6 === i)).filter(Boolean).map(x => x.monsterId)),
        }, (pick) => { live.bench[i] = pick; saveLive(); renderLive(); }));
      wireDrag(cell, live.bench, i, saveLive, renderLive);
      wireDropTarget(cell, live.bench, i, saveLive, renderLive);
      benchG.appendChild(cell);
    }
    // 🎯 positioning target: mini-grid + live match check (green tick when the
    // synced game board equals the optimizer's arrangement)
    let targetHTML = '';
    if (tgt) {
      const matches = tgtMatches;
      const nMatch = matches.filter(Boolean).length;
      const allMatch = nMatch === 6;
      const cellHTML = (t, i) => {
        const m = t && monById[t.monsterId];
        return `<div class="pt-cell ${matches[i] ? 'ok' : 'move'}" title="${m ? esc(m.name) + (matches[i] ? ' — in place ✓' : ' — move it here') : matches[i] ? 'stays empty' : 'should be empty'}">${m ? `<img class="sprite" src="${spr(t.shiny && m.shinySprite ? m.shinySprite : m.sprite)}">` : '<span style="opacity:.3">·</span>'}${matches[i] ? '<span class="pt-ok">✓</span>' : ''}</div>`;
      };
      const confirmed = allMatch && !tgt.preview;
      targetHTML = `<div class="pos-target ${confirmed ? 'done' : ''}">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b style="font-size:11px">${confirmed ? '✅ Positioned optimally' : allMatch ? '🎯 Preview applied' : '🎯 Target layout'}</b>
          <span style="font-size:10.5px;color:${confirmed ? 'var(--green)' : 'var(--muted)'}">${confirmed ? `${tgt.gainPct > 1 ? `+${tgt.gainPct}% locked in` : 'layout locked'} — go win` : allMatch ? `${tgt.gainPct > 1 ? `+${tgt.gainPct}% — ` : ''}now make these moves IN GAME; the game's next update confirms the ✅` : `${tgt.gainPct > 1 ? `+${tgt.gainPct}% when matched · ` : ''}${nMatch}/6 in place — move the rest IN GAME, sync follows`}</span>
          <span class="x" id="lv-target-x" style="margin-left:auto;cursor:pointer" title="Clear target">×</span>
        </div>
        <div class="pt-grid">${tgt.board.slice(0, 3).map(cellHTML).join('')}</div>
        <div class="pt-grid">${tgt.board.slice(3, 6).map((t, i) => cellHTML(t, i + 3)).join('')}</div>
        ${tgt.promoted && tgt.promoted.length && !allMatch ? `<div style="font-size:10px;color:var(--muted);margin-top:3px">from bench: ${tgt.promoted.map(esc).join(', ')}</div>` : ''}
      </div>`;
    }
    $('#lv-bottom').insertAdjacentHTML('afterend',
      `<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
        <button class="ghost" id="lv-optimize">🧲 Optimize positioning</button>
        <button class="ghost" id="lv-share" title="Share this exact board as a code or link (read-only)">🔗 Share</button>
        <span id="lv-opt-note" style="font-size:11px;color:var(--muted)"></span>
      </div>` + targetHTML + BOARD_HINT);
    const tx = $('#lv-target-x');
    if (tx) tx.onclick = () => { live.posTarget = null; saveLive(); renderLive(); };
    { const sb = $('#lv-share'); if (sb) sb.onclick = openShareModal; } // (button is injected with the optimize row — wire here, after insertion)
    $('#lv-optimize').onclick = () => {
      const r = optimizePositions();
      if (!r) { $('#lv-opt-note').textContent = 'Need at least 2 units (board or bench).'; return; }
      if (r.gainPct <= 1 && !r.promoted.length) {
        // already optimal → the CURRENT board becomes the target (all green ✓),
        // replacing any stale target from an older roster
        live.posTarget = {
          board: live.board.map(s => (s ? { monsterId: s.monsterId, level: s.level, shiny: s.shiny } : null)),
          gainPct: 0, day: live.day, promoted: [],
        };
        saveLive(); renderLive();
        setTimeout(() => { const n = $('#lv-opt-note'); if (n) n.textContent = '✓ Already optimal for the expected battle.'; }, 50);
        return;
      }
      // BEST OF BOTH: apply the arrangement visually RIGHT NOW (units move,
      // bench promotions included) AND set it as the 🎯 target — with sync on,
      // the game's next update snaps the board back to reality, but the target
      // strip + rings keep tracking until you've made the moves in game.
      live.posTarget = {
        board: r.best.map(s => (s ? { monsterId: s.monsterId, level: s.level, shiny: s.shiny } : null)),
        gainPct: r.gainPct, day: live.day, promoted: r.promoted,
        preview: syncEnabled(), // green ✅ only once the GAME confirms, not the preview
      };
      live.board = r.best;
      live.bench = [r.benched[0] || null, r.benched[1] || null, r.benched[2] || null, r.benched[3] || null];
      saveLive(); renderLive();
      if (syncEnabled()) {
        setTimeout(() => { const n = $('#lv-opt-note'); if (n) n.innerHTML = `<b style="color:var(--green)">+${r.gainPct}%</b>${r.focusId ? ` for <b>${esc((monById[r.focusId] || {}).name)}</b> (♟️ strategy focus — donations concentrated, not raw damage)` : ''} preview applied — make these moves IN GAME; sync will confirm each ✓ on the 🎯 tracker below.`; }, 50);
      } else if (r.focusId) {
        setTimeout(() => { const n = $('#lv-opt-note'); if (n) n.innerHTML = `✓ <b style="color:var(--green)">+${r.gainPct}%</b> optimized FOR <b>${esc((monById[r.focusId] || {}).name)}</b> — ♟️ strategy focus: donations concentrated on it, not raw team damage.`; }, 50);
      }
    };

    // trinkets
    const tkBox = $('#lv-trinkets');
    tkBox.innerHTML = live.trinkets.length ? '' : '<span class="note" style="margin:0">None yet — add as you pick gifts.</span>';
    live.trinkets.forEach((id, i) => {
      const t = D.trinkets.find(x => x.id === id);
      const c = el('div', 'offer-chip');
      c.innerHTML = `<img class="sprite" src="${spr(t ? t.sprite : '')}"><div style="font-size:12px;font-weight:600">${esc(t ? t.name : humanize(id))}</div><span class="x">×</span>`;
      c.title = t ? t.description : '';
      c.querySelector('.x').onclick = () => { live.trinkets.splice(i, 1); live.hp = suggestedHP(live.day); saveLive(); renderLive(); };
      tkBox.appendChild(c);
    });
    $('#lv-tk-add').onclick = () => trinketPicker((id) => { if (!live.trinkets.includes(id)) { live.trinkets.push(id); live.hp = suggestedHP(live.day); saveLive(); renderLive(); } });
    $('#lv-gift').onclick = giftChooser;
    $('#lv-event').onclick = eventPicker;
    $('#lv-secondchance').onclick = () => {
      live.lives = 1; live.trainerData.secondChance = true; saveLive(); renderLive();
      const ev = (D.events || []).find(e => e.id === 'second_chance');
      if (ev) { eventPicker(); setTimeout(() => { const c = [...document.querySelectorAll('#modal .mon-cell')].find(x => x.textContent.includes('Second Chance')); if (c) c.click(); }, 60);
      }
    };
    const planClear = $('#lv-plan-clear');
    if (planClear) planClear.onclick = () => { live.plans = []; live.plan = null; saveLive(); renderLive(); };

    // shop
    const shopBox = $('#lv-shop');
    shopBox.innerHTML = live.shop.length ? '' : '<span class="note" style="margin:0">Empty — add the Batomon your shop is offering (mark shinies!).</span>';
    live.shop.forEach((o, i) => {
      const m = monById[o.monsterId]; if (!m) return;
      const c = el('div', 'offer-chip' + (o.shiny ? ' shiny' : ''));
      const rsC = window.SYNERGY && window.SYNERGY.monsters && window.SYNERGY.monsters[o.monsterId];
      const comboC = bestBoardCombo(o.monsterId, new Set(live.board.filter(s => s).map(s => s.monsterId)));
      if (comboC && comboC.winRate >= 78) c.classList.add('combo-glow');
      const chefC = chefInfo(m);
      const isBugC = (m.types || []).some(t => t.id === 'bug');
      const bugFree = effectiveTrainerId() === 'bug_catcher' && !(live.trainerData || {}).bugBought && isBugC;
      const priceHTML = bugFree
        ? `<s style="color:var(--muted)">$${m.cost}</s> <b style="color:var(--green)">$0 first bug</b>`
        : `$${m.cost}`;
      c.innerHTML = `<img class="sprite" src="${spr(o.shiny && m.shinySprite ? m.shinySprite : m.sprite)}">
        <div><div style="font-weight:700;font-size:12.5px">${o.shiny ? '✨ ' : ''}${esc(m.name)}${chefC && chefC.converted ? ' <span title="Chef converts single-typed to Fire (+2 Burn)">🔥</span>' : ''} <span style="font-size:10px;color:var(--muted)">${priceHTML}</span></div>
        <div style="font-size:10px">${rsC && rsC.rounds >= 60 ? wrSpan(rsC.winRate) + ' WR' : '<span style="color:var(--muted)">no data</span>'}${comboC ? ` <span class="combo-hit" title="${esc(comboC.ids.map(id => (monById[id] || { name: id }).name).join(' + '))} · ${comboC.rounds} rounds">⚡${comboC.winRate}% w/ board</span>` : ''}</div></div><span class="x">×</span>`;
      c.querySelector('.x').onclick = (e) => { e.stopPropagation(); hcHide(); live.shop.splice(i, 1); saveLive(); renderLive(); };
      c.title = 'Click = BUY · drag onto a board slot = buy into that slot';
      wireSlot(c, () => live.shop[i], (next) => { if (next) live.shop[i] = next; else live.shop.splice(i, 1); saveLive(); renderLive(); }, () => buyFromShop(i), { noButtons: true, buyMode: true });
      wireShopDrag(c, i);
      shopBox.appendChild(c);
    });

    // shop ITEMS row
    const itemBox = $('#lv-shopitems');
    if (itemBox) {
      itemBox.innerHTML = (live.shopItems || []).length ? '' : '<span class="note" style="margin:0;font-size:11px">Add the items your shop offers — click one to BUY (gold + effects applied).</span>';
      (live.shopItems || []).forEach((id, i) => {
        const it = D.items.find(x => x.id === id);
        if (!it) return;
        const chip = el('div', 'offer-chip');
        chip.innerHTML = `<img class="sprite" src="${spr(it.sprite)}" style="width:26px;height:26px">
          <div style="font-size:11.5px;font-weight:700">${esc(it.name)} <span style="color:var(--gold)">$${itemCost(it)}</span></div><span class="x">×</span>`;
        chip.title = it.description + ' — click to BUY';
        chip.querySelector('.x').onclick = (e) => { e.stopPropagation(); live.shopItems.splice(i, 1); saveLive(); renderLive(); };
        chip.onclick = () => buyShopItem(i);
        itemBox.appendChild(chip);
      });
      $('#lv-item-add').onclick = () => itemPicker((ids) => { live.shopItems = (live.shopItems || []).concat(ids); saveLive(); renderLive(); });
    }
    $('#lv-shop-add').onclick = () => monsterPicker({
      title: 'Shop is offering…',
      multi: true,
      boardIds: new Set(live.board.filter(s => s).map(s => s.monsterId)),
    }, (picks) => { if (picks && picks.length) { live.shop.push(...picks); saveLive(); renderLive(); } });
    $('#lv-shop-clear').onclick = () => { live.shop = []; saveLive(); renderLive(); };

    // day plan strip
    const d = GDAYS()[Math.min(live.day, 10) - 1];
    $('#lv-dayplan').innerHTML = `<h3>📅 Day ${live.day} plan — ${esc(d.title)}</h3>
      <ul style="margin:8px 0 0 18px;font-size:12.5px"><li>${esc(d.plan[0])}</li><li>${esc(d.plan[1] || '')}</li></ul>
      <div class="day-block warn" style="margin-top:10px"><b>Don't:</b> ${esc(d.warning)}</div>`;

    liveAdvice();
    const hero = $('#lv-hero'); if (hero) hero.innerHTML = heroWinHTML(); // paint the hero band now that win% is computed
  }

  // ================= BATTLE BRAIN =================
  // Positional donors: units whose ability buffs a specific slot/relation.
  const DONORS = {
    // in-game: arrow points LEFT — buffs the ally BEHIND it (verified, definitive).
    // The earlier "points right" note was an artifact of a mirrored board mapping
    // (now fixed); with the correct 180° board, behind = LEFT is the true dir.
    boomagon:  { dir: 'behind', kind: 'cds', rate: 0.04, desc: '+4% Cooldown Speed per cast (permanent)' },
    dracana:   { dir: 'behind', kind: 'charge', amt: 1, desc: 'Charge ally behind 1s per cast' },
    ironcore:  { dir: 'adjacent', filter: 'electric', kind: 'charge', amt: 1, desc: 'Charges adjacent Electrics 1s' },
    zephyrex:  { dir: 'front', filter: 'flying', kind: 'multicast', amt: 1, desc: '+1 Multicast to Flying in front (permanent)' },
    saberhorn: { dir: 'front', kind: 'multicast', amt: 1, desc: '+1 Multicast to ally in front (battle)' },
    magmalith: { dir: 'above', shinyDir: 'adjacent', shinyFilter: 'fire', kind: 'feed', stat: 'burn', amt: 2, desc: '+2 Burn to ally above (permanent)', shinyDesc: '+2 Burn to ADJACENT Fire allies (permanent)' },
    noxalith:  { dir: 'above', shinyDir: 'adjacent', shinyFilter: 'toxic', kind: 'feed', stat: 'poison', amt: 3, desc: '+3 Poison to ally above (permanent)', shinyDesc: '+3 Poison to ADJACENT Toxic allies (permanent)' },
    pylong:    { dir: 'behind', shinyDir: 'adjacent', kind: 'amp', stat: 'shock', desc: 'Ally behind has +100% Shock', shinyDesc: 'ADJACENT allies have +100% Shock' },
    onsetra:   { dir: 'behind', shinyDir: 'adjacent', kind: 'echo', desc: 'Ally behind applies Ongoing 1 extra time', shinyDesc: 'ADJACENT allies apply Ongoing 1 extra time' },
    cicadence: { dir: 'above', filter: 'bug', kind: 'trigger', desc: 'Triggers the Bug ally above each cast' },
    dryadell:  { dir: 'above', filter: 'grass', kind: 'trigger', desc: 'Triggers the Grass ally above each cast' },
    torrantler:{ dir: 'adjacent', filter: 'water', kind: 'trigger', desc: 'Triggers adjacent Water allies each cast' },
    gaiadrasil:{ dir: 'adjacent', kind: 'mirror', desc: 'Gains 100% of adjacent allies’ total Damage' },
    aster:     { dir: 'adjacent', filter: 'water', kind: 'feed', stat: 'heal', amt: 20, desc: '+20 Heal to adjacent Water (permanent)' },
    formiqueen:{ dir: 'adjacent', filterTier: 1, kind: 'cdsAura', pct: 33, desc: 'Adjacent Commons +33% CDS' },
    stellagon: { dir: 'adjacent', filterNoAbility: true, kind: 'multicast', amt: 2, desc: 'Adjacent no-ability allies +2 Multicast' },
    noxnimbus: { dir: 'adjacent', filter: 'toxic', kind: 'feed', stat: 'poison', amt: 2, desc: '+2 Poison to adjacent Toxic per cast' },
    blixie:    { dir: 'behind', filter: 'fire', kind: 'amp', stat: 'burn', desc: 'Fire ally behind gets a Burn multiplier' },
    aegistruct:{ dir: 'adjacent', kind: 'shieldCopy', desc: 'Copies adjacent allies’ Shield at battle start' },
    geminiss:  { dir: 'adjacent', kind: 'shieldAmp', desc: 'Adjacent allies +50% Shield per cast' },
  };
  // Effective donor for a unit — shinies can upgrade the ability's SCOPE (shiny
  // Onsetra echoes ADJACENT allies, not just the one behind). Applying shinyDir here
  // means every consumer (battle math, arrows, optimizer, tips) gets it for free.
  function donorFor(monsterId, shiny) {
    const d = DONORS[monsterId];
    if (!d) return null;
    if (!(shiny && (d.shinyDir || d.shinyFilter))) return d;
    const o = Object.assign({}, d);
    if (d.shinyDir) o.dir = d.shinyDir;        // e.g. Onsetra behind → adjacent
    if (d.shinyFilter) o.filter = d.shinyFilter; // e.g. Magmalith any-above → adjacent FIRE only
    if (d.shinyDesc) o.desc = d.shinyDesc;
    return o;
  }
  const slotName = (idx) => (idx < 3 ? 'top' : 'bottom') + ' row, ' + ['BACK', 'middle', 'FRONT'][idx % 3] + ' column';
  const SLOT_SHORT = ['top·back', 'top·mid', 'top·FRONT', 'bot·back', 'bot·mid', 'bot·FRONT'];

  // ---- positional arrows (in-game style) ----
  // Grid semantics (side-view, enemies to the RIGHT): columns are depth —
  // "behind" = LEFT neighbour (same row), "in front" = RIGHT neighbour;
  // "above" = top-row slot in the same column; adjacency = 4-neighborhood.
  function posInfo(m, shiny) {
    if (!m) return null;
    const donor = donorFor(m.id, shiny);
    if (donor) {
      const dirMap = { behind: ['behind'], above: ['up'], front: ['front'], adjacent: ['adj'] };
      return {
        dirs: dirMap[donor.dir] || [],
        filter: donor.filter || (donor.filterTier ? 'tier' + donor.filterTier : null) || (donor.filterNoAbility ? 'no-ability' : null),
        desc: donor.desc,
      };
    }
    const ab = ((m.ability && ((m.ability.byLevel && m.ability.byLevel['1']) || m.ability.description)) || '').toLowerCase();
    if (!ab) return null;
    if (/in this row/.test(ab)) return { dirs: ['row'], desc: m.ability.trigger + ': ' + ab };
    if (/all(y|ies) behind/.test(ab)) return { dirs: ['behind'], desc: ab };
    if (/all(y|ies) (above)/.test(ab)) return { dirs: ['up'], desc: ab };
    if (/all(y|ies) in front/.test(ab)) return { dirs: ['front'], desc: ab };
    if (/adjacent/.test(ab)) return { dirs: ['adj'], desc: ab };
    return null;
  }
  function slotArrows(board, idx, allowCable = true) {
    // allowCable=false: Shop Advisor sandbox — live-run Link Cable must not leak
    const s = board[idx];
    if (!s) return '';
    const m = monById[s.monsterId];
    const pi = posInfo(m, s.shiny);
    if (!pi || !pi.dirs.length) return '';
    const col = idx % 3, row = Math.floor(idx / 3);
    const nb = { up: row === 0 ? -1 : idx - 3, down: row === 1 ? -1 : idx + 3, left: col === 0 ? -1 : idx - 1, right: col === 2 ? -1 : idx + 1 };
    const matches = (t) => {
      if (t < 0) return false;
      const o = board[t]; if (!o) return false;
      const om = monById[o.monsterId]; if (!om) return false;
      if (pi.filter === 'no-ability') return !(om.ability && (om.ability.byLevel || om.ability.description));
      if (pi.filter && pi.filter.startsWith('tier')) return om.tier === +pi.filter.slice(4);
      if (pi.filter) return (om.types || []).some(ty => ty.id === pi.filter);
      return true;
    };
    const CH = { up: '▲', down: '▼', left: '◀', right: '▶' };
    const arrow = (k, t) => {
      const on = matches(t);
      const why = t < 0 ? ' — no slot that way' : !board[t] ? ' — pointing at an empty slot' : on ? '' : ` — target doesn't match (needs ${pi.filter})`;
      return `<span class="pos-arrow pa-${k} ${on ? 'pa-on' : 'pa-off'}" title="${esc((pi.desc || 'positional passive') + why)}">${CH[k]}</span>`;
    };
    let out = '';
    for (const d of pi.dirs) {
      if (d === 'behind') out += arrow('left', nb.left);          // behind = LEFT (away from the enemy)
      else if (d === 'front') out += arrow('right', nb.right);    // in front = RIGHT
      else if (d === 'up') out += arrow('up', nb.up);             // above = top row, same column
      else if (d === 'row') out += arrow('left', nb.left) + arrow('right', nb.right);
      else if (d === 'adj' && allowCable && hasLinkCable()) {
        // Link Cable: every ally is adjacent — arrows light if ANY ally matches the filter
        const anyMatch = board.some((o, t) => t !== idx && o && matches(t));
        const CH2 = { up: '▲', down: '▼', left: '◀', right: '▶' };
        out += ['up', 'down', 'left', 'right'].map(k =>
          `<span class="pos-arrow pa-${k} ${anyMatch ? 'pa-on' : 'pa-off'}" title="${esc((pi.desc || '') + ' — 🔗 Link Cable: ALL allies count as adjacent' + (anyMatch ? '' : ' (no ally matches ' + (pi.filter || 'the filter') + ')'))}">${CH2[k]}</span>`).join('');
      }
      else if (d === 'adj') out += ['up', 'down', 'left', 'right'].map(k => arrow(k, nb[k])).join('');
    }
    return out;
  }

  function unitOutput(s, day, idx) { // per-second outputs incl. held-trinket + Chef modifiers
    const m = effMon(s); // merges event-granted extra types (no-op for normal units)
    const ld = m && E.levelData(m, s.level, s.shiny);
    if (!ld) return null;
    const mods = unitMods(m, idx != null ? idx : null, { level: s.level });
    const chef = chefInfo(m);
    // permanent buffs: on-buy feeders (Guardiant & co.) AND everything the game
    // save reports in perm_buffs (cake +dmg, donor feeds, event boosts — any stat)
    const feed = Object.assign({ dmg: 0, cds: 0, heal: 0, shield: 0, burn: 0, poison: 0, shock: 0, mc: 0 }, s.feed);
    const statsMul = 1 + mods.statsPct / 100;
    const cd = Math.max((ld.cooldown || 5) / (1 + (mods.cdsPct + feed.cds) / 100), 0.5);
    const mc = (ld.multicast || 1) + mods.mc + feed.mc;
    const g = (k) => E.stat(ld, k);
    const dmg = ((g('damage') + mods.dmgFlat + feed.dmg) * (1 + mods.dmgPct / 100)) * statsMul;
    const burn = (g('burn') + mods.burnFlat + feed.burn + (chef && chef.isFire ? 2 : 0)) * statsMul;
    const poison = (g('poison') + mods.poisonFlat + feed.poison) * statsMul;
    return {
      m, s, cd, mc, mods, idx: idx != null ? idx : -1,
      dps: (dmg * mc) / cd, perCast: dmg * mc,
      heal: ((g('heal') + feed.heal) * statsMul * mc) / cd, shield: ((g('shield') + feed.shield) * statsMul * mc) / cd,
      burnApp: (burn * mc) / cd, poisonApp: (poison * mc) / cd, shockApp: ((g('shock') + feed.shock) * statsMul * mc) / cd,
      // direct HITS per second — shock's trigger rate (wiki: every direct hit
      // against a shocked target deals +stacks bonus damage)
      hitRate: dmg > 0 ? mc / cd : 0,
    };
  }
  // Link Cable trinket: ALL your monsters count as adjacent to each other —
  // adjacency passives (Torrantler, Gaiadrasil, Stellagon, Formiqueen, Aster,
  // Ironcore, Noxnimbus, Geminiss, Aegistruct…) hit the whole board regardless
  // of placement. Directional passives (behind/front/above) are NOT adjacency
  // and stay slot-bound.
  const hasLinkCable = () => live.trinkets.includes('link_cable');

  // FLAT CDS a board slot RECEIVES from adjacent aura donors (Formiqueen +33% to
  // adjacent Commons, etc.). This is a passive/always-on aura, so the GAME shows
  // it baked into the unit's cooldown on its card — the hover must too, or it
  // reads a ~2× too-slow cooldown (the "not seeing its real cooldown" bug: a
  // Guardiant next to 3 Formiqueens is 3.5s→~1.7s in-game, not 3.18s). Per-cast
  // ramping donors (Boomagon `cds`) are NOT included — those build DURING battle
  // and aren't on the resting card; they still show in the ⚡ Battle-Brain column.
  function receivedAuraCds(board, idx) {
    const target = board[idx]; if (!target) return { pct: 0, sources: [] };
    const tm = monById[target.monsterId]; if (!tm) return { pct: 0, sources: [] };
    const linked = hasLinkCable();
    let pct = 0; const sources = [];
    board.forEach((s, dIdx) => {
      if (!s || dIdx === idx) return;
      const donor = donorFor(s.monsterId, s.shiny);
      if (!donor || donor.kind !== 'cdsAura') return;
      let hits = false;
      if (donor.dir === 'adjacent') {
        if (linked) hits = true;
        else { const adj = []; if (dIdx % 3 > 0) adj.push(dIdx - 1); if (dIdx % 3 < 2) adj.push(dIdx + 1); adj.push(dIdx < 3 ? dIdx + 3 : dIdx - 3); hits = adj.includes(idx); }
      } else if (donor.dir === 'behind') hits = dIdx % 3 > 0 && dIdx - 1 === idx;
      else if (donor.dir === 'front') hits = dIdx % 3 < 2 && dIdx + 1 === idx;
      else if (donor.dir === 'above') hits = dIdx >= 3 && dIdx - 3 === idx;
      if (!hits) return;
      if (donor.filter && !(tm.types || []).some(ty => ty.id === donor.filter)) return;
      if (donor.filterTier && tm.tier !== donor.filterTier) return;
      if (donor.filterNoAbility && tm.ability && (tm.ability.byLevel || tm.ability.description)) return;
      pct += (donor.pct || 33); sources.push((monById[s.monsterId] || {}).name || s.monsterId);
    });
    return { pct, sources };
  }

  // Positional passive contributions for a given arrangement — the SAME math the
  // optimizer scores with, so the Brain always reflects your current layout.
  const DYNAMIC_DONOR_KINDS = new Set(['cds', 'charge', 'feed', 'trigger']); // simulated as discrete EVENTS by simEvents — excluded from the static pass when the event sim runs
  function positionalBonuses(board, T, opts) {
    const skipDynamic = opts && opts.skipDynamic;
    const outsByIdx = board.map((s, i) => (s ? unitOutput(s, 0, i) : null));
    const add = { dps: 0, heal: 0, shield: 0, burnApp: 0, poisonApp: 0, shockApp: 0, hitRate: 0 };
    const recv = new Array(6).fill(0); // per-slot RECEIVED value — strategy mode concentrates this on the focus unit
    const cdsGiven = new Array(6).fill(null); // per DONOR slot: cooldown-speed % handed to allies this fight
    const notes = [];
    const linked = hasLinkCable();
    // CASCADE pass: CDS donors can accelerate OTHER donors (Boomagon behind
    // Boomagon → the front one casts faster → donates faster → compounding).
    // Pass 1 collects avg CDS% received per slot from cds-donors; the main
    // loop then uses cascade-adjusted cast rates for every donor.
    const cdsBoost = new Array(6).fill(0);
    board.forEach((s, dIdx) => {
      if (!s) return;
      const donor = donorFor(s.monsterId, s.shiny);
      if (!donor || donor.kind !== 'cds') return;
      const u = outsByIdx[dIdx];
      if (!u) return;
      const t = donor.dir === 'front' ? (dIdx % 3 < 2 ? dIdx + 1 : -1) : donor.dir === 'behind' ? (dIdx % 3 > 0 ? dIdx - 1 : -1) : -1;
      if (t >= 0 && outsByIdx[t]) cdsBoost[t] += (donor.rate * Math.max(Math.floor(T / u.cd), 1) * 100) / 2; // avg % over the fight
    });
    const effCdOf = (idx) => { // donor cast speed including cascade CDS received
      const u = outsByIdx[idx];
      return u ? Math.max(u.cd / (1 + cdsBoost[idx] / 100), 0.5) : 5;
    };
    board.forEach((s, dIdx) => {
      if (!s) return;
      const donor = donorFor(s.monsterId, s.shiny);
      if (!donor) return;
      if (skipDynamic && DYNAMIC_DONOR_KINDS.has(donor.kind)) return; // event sim owns these
      const u = outsByIdx[dIdx];
      const targets = [];
      if (donor.dir === 'front') { if (dIdx % 3 < 2) targets.push(dIdx + 1); }
      else if (donor.dir === 'behind') { if (dIdx % 3 > 0) targets.push(dIdx - 1); }
      else if (donor.dir === 'above') { if (dIdx >= 3) targets.push(dIdx - 3); }
      else if (donor.dir === 'adjacent') {
        if (linked) {
          for (let t = 0; t < 6; t++) if (t !== dIdx && outsByIdx[t]) targets.push(t); // Link Cable: everyone is adjacent
        } else {
          if (dIdx % 3 > 0) targets.push(dIdx - 1);
          if (dIdx % 3 < 2) targets.push(dIdx + 1);
          targets.push(dIdx < 3 ? dIdx + 3 : dIdx - 3);
        }
      }
      for (const t of targets.filter(t => t >= 0 && t < 6)) {
        const r = outsByIdx[t];
        if (!r) continue;
        const rm = r.m;
        if (donor.filter && !(rm.types || []).some(ty => ty.id === donor.filter)) continue;
        if (donor.filterTier && rm.tier !== donor.filterTier) continue;
        if (donor.filterNoAbility && rm.ability && (rm.ability.byLevel || rm.ability.description)) continue;
        const casts = Math.max(Math.floor(T / effCdOf(dIdx)), 1); // cascade-aware cast count
        let gainedDps = 0;
        if (donor.kind === 'cds') {
          gainedDps = r.dps * (donor.rate * casts) / 2; add.dps += gainedDps; add.hitRate += r.hitRate * (donor.rate * casts) / 2; recv[t] += gainedDps + r.dps * 0.1;
          // cooldown-speed handed over: +rate/cast, cumulative & PERMANENT, so by
          // fight end the recipient has gained rate×casts. Record for the table.
          const g = cdsGiven[dIdx] || (cdsGiven[dIdx] = { perCastPct: donor.rate * 100, casts, totalPct: 0, permanent: true, targets: [] });
          g.totalPct += donor.rate * casts * 100; g.targets.push({ idx: t, name: rm.name });
        }
        else if (donor.kind === 'charge') { gainedDps = ((casts * (donor.amt || 1)) / r.cd) * r.perCast / T; add.dps += gainedDps; if (r.hitRate) add.hitRate += (casts * (donor.amt || 1)) / r.cd * r.mc / T; recv[t] += gainedDps; }
        else if (donor.kind === 'multicast') { gainedDps = (r.perCast / r.mc) * (donor.amt || 1) / r.cd; add.dps += gainedDps; if (r.hitRate) add.hitRate += (donor.amt || 1) / r.cd; recv[t] += gainedDps; }
        else if (donor.kind === 'trigger') {
          // a trigger fires the receiver's FULL cast: damage + heals + statuses
          const per = casts / T;
          add.dps += r.perCast * per; add.heal += (r.heal * r.cd) * per; add.shield += (r.shield * r.cd) * per;
          add.burnApp += (r.burnApp * r.cd) * per; add.poisonApp += (r.poisonApp * r.cd) * per; add.shockApp += (r.shockApp * r.cd) * per;
          if (r.hitRate) add.hitRate += r.mc * per;
          gainedDps = r.perCast * per;
          recv[t] += gainedDps + (r.heal * r.cd) * per * 0.5;
        }
        else if (donor.kind === 'feed') {
          if (donor.stat === 'burn') { add.burnApp += ((donor.amt || 2) * casts) / T; recv[t] += ((donor.amt || 2) * casts) / T * 1.2; }
          else if (donor.stat === 'poison') { add.poisonApp += ((donor.amt || 2) * casts) / T; recv[t] += ((donor.amt || 2) * casts) / T * (T / 2); }
          else if (donor.stat === 'heal') { add.heal += ((donor.amt || 20) * casts) / T; recv[t] += ((donor.amt || 20) * casts) / T * 0.5; }
        }
        else if (donor.stat === 'shock') { add.shockApp += r.shockApp; recv[t] += r.shockApp * 2; }
        else if (donor.stat === 'burn') { add.burnApp += r.burnApp; recv[t] += r.burnApp * 1.2; } // blixie-style burn amp
        else if (donor.kind === 'mirror') { add.dps += r.dps; gainedDps = r.dps; recv[dIdx] += r.dps; }
        else if (donor.kind === 'echo') { add.dps += r.dps * 0.1; recv[t] += r.dps * 0.1; }
        else if (donor.kind === 'cdsAura') {
          gainedDps = r.dps * (donor.pct || 33) / 100; add.dps += gainedDps; recv[t] += gainedDps;
          const g = cdsGiven[dIdx] || (cdsGiven[dIdx] = { perCastPct: 0, casts: 0, totalPct: 0, permanent: false, aura: true, targets: [] });
          g.totalPct += (donor.pct || 33); g.targets.push({ idx: t, name: rm.name });
        }
        else if (donor.kind === 'shieldAmp') { add.shield += r.shield * 0.5; recv[t] += r.shield * 0.3; }
        else if (donor.kind === 'shieldCopy') { add.shield += r.shield; recv[dIdx] += r.shield * 0.6; }
        notes.push(`${u.m.name}→${rm.name}${donor.dir === 'adjacent' && linked ? '🔗' : ''}${cdsBoost[dIdx] > 0 ? '⛓️' : ''}`);
      }
    });
    return { add, notes, recv, cdsGiven, linkCable: linked };
  }
  // ---------------- IN-BATTLE SELF-SCALERS (“+X per cast”) ----------------
  // Units whose ability grows THEMSELVES during the fight (Bambudo +35 Dmg/cast,
  // Galvanine +50% CDS & +2 Shock/cast, Prismagon +dmg per unique type, Stalagrove
  // shield-fed damage, Thorntail poison-fed, Clawnetic shock-charged). Averaged
  // over the expected fight: a buff gained per cast is worth (N−1)/2 casts.
  // Ally-targeted “per cast” buffs are DONORS (positional) — excluded here.
  function applySelfRamps(units, T) {
    const notes = [];
    const uniqueTypes = new Set(units.flatMap(u => ((u.m || {}).types || []).map(t => t.id))).size;
    const shieldPerSec = units.reduce((a, u) => a + u.shield, 0);
    const poisonEvents = units.reduce((a, u) => a + (u.poisonApp > 0 ? u.mc / u.cd : 0), 0);
    const shockEvents = units.reduce((a, u) => a + (u.shockApp > 0 ? u.mc / u.cd : 0), 0);
    const reRate = (u) => { // recompute per-second rates after cd/perCast changes
      u.dps = u.perCast / u.cd;
      u.hitRate = u.perCast > 0 ? u.mc / u.cd : 0;
    };
    for (const u of units) {
      const ab = E.abilityText(u.m, u.s.level, u.s.shiny);
      const txt = ab.text || '', trig = ab.trigger || '';
      if (/all(y|ies)/i.test(txt)) continue; // donor territory (positional math)
      const onCast = /cast/i.test(trig);
      let N = Math.max(Math.floor(T / u.cd), 1);
      // CDS self-ramp (Galvanine): casts accelerate — average via two passes
      const cdsm = onCast && txt.match(/\+(\d+)% Cooldown Speed/i);
      if (cdsm) {
        const per = +cdsm[1];
        const cdEff = Math.max(u.cd / (1 + (per * N) / 200), 1);
        N = Math.max(Math.floor(T / cdEff), 1);
        const f = u.cd / Math.max(cdEff, 0.1);
        u.cd = cdEff;
        ['dps', 'heal', 'shield', 'burnApp', 'poisonApp', 'shockApp', 'hitRate'].forEach(k => { u[k] *= f; });
        u.ramp = true;
        notes.push(`<b>${esc(u.m.name)}</b>: +${per}% CDS/cast → avg CD ~${cdEff.toFixed(1)}s (${N} casts)`);
      }
      const gain = (re, apply, label) => {
        const mm = onCast && txt.match(re);
        if (!mm) return;
        let per = +mm[1];
        if (/for each unique type/i.test(txt)) per *= uniqueTypes;
        const avg = (per * (N - 1)) / 2; // average bonus per cast across the fight
        apply(per, avg);
        u.ramp = true;
        notes.push(`<b>${esc(u.m.name)}</b>: +${per} ${label}/cast → avg +${Math.round(avg)} by mid-fight (${N} casts${/permanently/i.test(txt) ? ', permanent — snowballs across the run' : ''})`);
      };
      gain(/\+(\d+) Damage(?! ?%)/i, (per, avg) => { u.perCast += u.mc * avg; reRate(u); }, 'Dmg');
      gain(/\+(\d+) Shock/i, (per, avg) => { u.shockApp += (u.mc * avg) / u.cd; }, 'Shock');
      gain(/\+(\d+) Burn/i, (per, avg) => { u.burnApp += (u.mc * avg) / u.cd; }, 'Burn');
      gain(/\+(\d+) Poison/i, (per, avg) => { u.poisonApp += (u.mc * avg) / u.cd; }, 'Poison');
      gain(/\+(\d+) Heal\b/i, (per, avg) => { u.heal += (u.mc * avg) / u.cd; }, 'Heal');
      gain(/\+(\d+) Shield\b/i, (per, avg) => { u.shield += (u.mc * avg) / u.cd; }, 'Shield');
      // conditional self-feeders (team-context rates, position-independent)
      if (u.m.id === 'stalagrove' && shieldPerSec > 0) {
        const pctm = txt.match(/(\d+)% of the amount shielded/i);
        const r = ((pctm ? +pctm[1] : 15) / 100) * shieldPerSec; // damage-stat gain per second
        const extra = u.mc * ((r * T) / 2) / u.cd;
        u.perCast += u.mc * ((r * T) / 2); reRate(u);
        u.ramp = true;
        notes.push(`<b>Stalagrove</b>: feeds on your ${shieldPerSec.toFixed(1)} Shield/s → ~+${extra.toFixed(1)} avg DPS`);
      }
      if (u.m.id === 'thorntail' && poisonEvents > 0) {
        const pm = txt.match(/\+(\d+) Damage/i);
        const r = (pm ? +pm[1] : 6) * poisonEvents; // damage-stat gain per second
        u.perCast += u.mc * ((r * T) / 2); reRate(u);
        u.ramp = true;
        notes.push(`<b>Thorntail</b>: +${pm ? pm[1] : 6} Dmg per ally poison proc (${poisonEvents.toFixed(1)}/s) → ramps hard`);
      }
      if (u.m.id === 'clawnetic' && shockEvents > 0) {
        const chm = txt.match(/Charge this by (\d+)/i);
        const f = Math.min(1 + (shockEvents * (chm ? +chm[1] : 1)) / u.cd, 3); // charge = free cast progress
        ['dps', 'heal', 'shield', 'burnApp', 'poisonApp', 'shockApp', 'hitRate'].forEach(k => { u[k] *= f; });
        u.ramp = true;
        notes.push(`<b>Clawnetic</b>: charged by ${shockEvents.toFixed(1)} shock procs/s → casts ×${f.toFixed(1)}`);
      }
    }
    return notes;
  }
  function boardOutputs(board, day, T) {
    const units = board.map((s, i) => (s ? unitOutput(s, day, i) : null)).filter(Boolean);
    let rampNotes = [];
    if (T) rampNotes = applySelfRamps(units, T); // before summing — ramps feed team totals
    // team totals scale each unit's rate by its cast schedule (self-KO once, Draconarch
    // self-slows). Units themselves stay RAW — the event sim models the schedule itself.
    const sum = (k) => units.reduce((a, u) => a + u[k] * (T && _RATE_KEYS.has(k) ? castScheduleFactor(board[u.idx], u.cd, T, board, u.idx) : 1), 0);
    const base = { units, rampNotes, dps: sum('dps'), heal: sum('heal'), shield: sum('shield'), burnApp: sum('burnApp'), poisonApp: sum('poisonApp'), shockApp: sum('shockApp'), hitRate: sum('hitRate') };
    if (T) {
      const pos = positionalBonuses(board, T);
      base.pos = pos;
      for (const k of ['dps', 'heal', 'shield', 'burnApp', 'poisonApp', 'shockApp', 'hitRate']) base[k] += pos.add[k] || 0;
    }
    return base;
  }

  // ---- positioning optimizer: brute-force all arrangements, score vs the expected battle ----
  function arrangementValue(board, T, outAt) {
    const outs = scaleOutsForSchedule(board.map((s, i) => (s ? (outAt ? outAt(s, i) : unitOutput(s, 0, i)) : null)), board, T);
    let v = 0, teamShock = 0, teamBurn = 0, teamHits = 0;
    outs.forEach((u, idx) => {
      if (!u) return;
      v += u.dps + u.poisonApp * T / 2 + u.heal * 0.5 + u.shield * 0.6;
      teamShock += u.shockApp; teamBurn += u.burnApp; teamHits += u.hitRate || 0;
      // NO front/back "exposure" term: the game uses a SHARED team HP pool with no
      // targeting or focus-fire (confirmed in-game) — units don't die individually, so
      // which column a tank/carry sits in never changes who gets hit. Column only
      // matters for DIRECTIONAL DONOR passives (behind/front/above, handled by
      // positionalBonuses below) and "opposite"-targeting abilities (e.g. Reapra).
    });
    // positional passives — EXACT same math the Battle Brain displays
    const pos = positionalBonuses(board, T);
    v += pos.add.dps + pos.add.poisonApp * T / 2 + pos.add.heal * 0.5 + pos.add.shield * 0.6;
    teamShock += pos.add.shockApp; teamBurn += pos.add.burnApp; teamHits += pos.add.hitRate || 0;
    // wiki-exact status value at mid-fight (t = T/2):
    // shock is a TEAM cross-product — stacks (shockApp×t) × hit rate;
    // burn ticks 2×/s and decays 1/tick → ramps only past 2 stacks/s applied.
    v += teamHits * teamShock * T / 4;
    v += 2 * (Math.max(teamBurn - 2, 0) * T / 2 + Math.min(teamBurn, 2) / 2);
    return v;
  }
  // strategy-focused arrangement: instead of maximizing raw team output, pile
  // donations (CDS chains, charges, triggers, feeds) onto the FOCUS unit and
  // keep it protected — everything else weighs light.
  function arrangementValueFocused(board, T, outAt, focusId) {
    const outs = scaleOutsForSchedule(board.map((s, i) => (s ? (outAt ? outAt(s, i) : unitOutput(s, 0, i)) : null)), board, T);
    const pos = positionalBonuses(board, T);
    let v = 0, focusIdx = -1;
    outs.forEach((u, idx) => {
      if (!u) return;
      const W = u.dps + u.heal * 0.5 + u.shield * 0.6 + u.burnApp * 1.2 + u.poisonApp * T / 2 + u.shockApp * 2;
      if (focusIdx < 0 && board[idx].monsterId === focusId) {
        focusIdx = idx;
        v += W * 2.2; // no "back column is safer" bonus — shared HP pool, no focus-fire (see arrangementValue)
      } else v += W * 0.55;
    });
    if (focusIdx >= 0) v += (pos.recv[focusIdx] || 0) * 3; // donations INTO the focus dominate
    v += (pos.add.dps + pos.add.heal * 0.5 + pos.add.shield * 0.6) * 0.4; // team leftovers, light
    return v;
  }
  function optimizePositions() {
    // pool = board + bench: the optimizer may promote a benched unit and bench
    // a weaker fielded one. C(9,6)×720 ≤ 60,480 arrangements — per-(unit,slot)
    // outputs are memoized so the search stays instant.
    const pool = [...live.board, ...(live.bench || [])].filter(s => s);
    if (pool.length < 2) return null;
    const day = Math.min(live.day, 15);
    const T = 12 + 3 * day;
    const slots = [0, 1, 2, 3, 4, 5];
    const outCache = new Map();
    const outAt = (s, idx) => {
      const k = pool.indexOf(s) + ':' + idx;
      let v = outCache.get(k);
      if (!v) {
        v = unitOutput(s, 0, idx);
        // Fold in this unit's IN-BATTLE self-ramp (Galvanine +50% CDS/cast & +2
        // Shock/cast, Bambudo +Dmg/cast, …) so the optimizer VALUES a scaling carry
        // as the carry it BECOMES. It used to skip self-ramps as "position-independent"
        // — true for the arrangement comparison, but the depth/carry heuristics read
        // per-unit dps, so a ramp-blind Galvanine got mis-slotted behind Velocect's
        // flashier BASE multicast. Ramps are slot-independent, so per-unit is exact
        // for the reported case (team-context scalers are lightly approximated).
        try { applySelfRamps([v], T); } catch (e) {}
        outCache.set(k, v);
      }
      return v;
    };
    // adopted strategy with its focus unit in the pool → focused objective
    const act = activeStrategy();
    const focusId = act && act.focusId && pool.some(s => s.monsterId === act.focusId) ? act.focusId : null;
    const scorer = focusId ? (b) => arrangementValueFocused(b, T, outAt, focusId) : (b) => arrangementValue(b, T, outAt);
    let best = null, bestV = -1;
    const topK = []; // sim-verification shortlist (closed-form pre-rank → event-sim final)
    const pushK = (v, board) => {
      if (topK.length < 10) topK.push({ v, board: board.slice() });
      else { let mi = 0; for (let i = 1; i < 10; i++) if (topK[i].v < topK[mi].v) mi = i; if (topK[mi].v < v) topK[mi] = { v, board: board.slice() }; }
    };
    const tryTeam = (units) => {
      const permute = (k, used, acc) => {
        if (k === units.length) {
          const board = [null, null, null, null, null, null];
          acc.forEach((slot, ui) => (board[slot] = units[ui]));
          const v = scorer(board);
          if (v > bestV) { bestV = v; best = board; }
          pushK(v, board);
          return;
        }
        for (const sIdx of slots) {
          if (used.has(sIdx)) continue;
          used.add(sIdx); acc.push(sIdx);
          permute(k + 1, used, acc);
          used.delete(sIdx); acc.pop();
        }
      };
      permute(0, new Set(), []);
    };
    if (pool.length <= 6) tryTeam(pool);
    else { // choose every 6-unit subset of the 7–9 unit pool
      const choose = (start, acc) => {
        if (acc.length === 6) { tryTeam(acc.slice()); return; }
        if (pool.length - start < 6 - acc.length) return;
        for (let i = start; i < pool.length; i++) { acc.push(pool[i]); choose(i + 1, acc); acc.pop(); }
      };
      choose(0, []);
    }
    // 🔬 SIM VERIFICATION (deep-dive v2): the closed-form value pre-ranks; the
    // EVENT SIM has the final word on the shortlist. Catches orderings the
    // integral can't see (CDS chains compounding stepwise, shock hit timing).
    let simPicked = false;
    if (topK.length > 1) {
      let bw = -1, bb = null;
      for (const c of topK) {
        const q = quickWinPct(c.board, 0, 'opt');
        if (q && (q.margin > bw)) { bw = q.margin; bb = c; }
      }
      if (bb && bb.board !== best) {
        const closedSaysBest = topK.find(c => c.board === best) || { v: bestV };
        if (bb.v >= closedSaysBest.v * 0.8) { best = bb.board; bestV = bb.v; simPicked = true; } // sim overrides within sanity band
      }
    }
    const currentV = scorer(live.board);
    const fielded = new Set((best || []).filter(Boolean));
    const benched = pool.filter(u => !fielded.has(u)); // leftovers → bench (≤3 by construction)
    const promoted = (best || []).filter(u => u && (live.bench || []).includes(u)).map(u => (monById[u.monsterId] || {}).name).filter(Boolean);
    return {
      best, bestV, currentV, benched, promoted, focusId, simPicked,
      gainPct: currentV > 0 ? Math.round(((bestV - currentV) / currentV) * 100) : (bestV > 0 ? 100 : 0),
    };
  }
  // offense(t) — EXACT batodex wiki/stats mechanics:
  //   Shock: stacks never decay; every DIRECT hit vs a shocked target deals
  //          +stacks bonus damage → shockDps(t) = hitRate × (shockApp × t).
  //   Burn:  ticks every 0.5s for stack count, then −1 stack → net ramp only
  //          past 2 stacks/s applied; below that it holds a small equilibrium.
  //   Poison: ticks every 1s for stack count, never decays → pure ramp.
  const offenseAt = (P, t) => {
    const shockDps = (P.hitRate || 0) * (P.shockApp || 0) * t;
    const burnDps = 2 * (Math.max((P.burnApp || 0) - 2, 0) * t + Math.min(P.burnApp || 0, 2) / 2);
    return P.dps + shockDps + burnDps + (P.poisonApp || 0) * t;
  };
  function simBattle(mine, enemy, day, myHP, enemyHP) {
    const baseT = 12 + 3 * day; // expected-fight-length reference for cast counts
    // real team HP pools (the in-game HP bar), sustain reduces incoming damage;
    // status damage is 25% weaker into shields (wiki) — approximated inside sustain
    const killTime = (att, def, defHP) => {
      let dmg = 0;
      for (let t = 0.25; t <= 95; t += 0.25) {
        dmg += Math.max(offenseAt(att, t) - (def.heal + def.shield * 0.9), 0.5) * 0.25;
        if (dmg >= defHP) return t;
      }
      return 95;
    };
    const tKill = killTime(mine, enemy, enemyHP);
    const tDie = killTime(enemy, mine, myHP);
    const duration = Math.min(tKill, tDie);
    const margin = Math.round(((tDie - tKill) / Math.max(duration, 1)) * 100);
    return { tKill, tDie, duration, margin, baseT, myHP, enemyHP };
  }

  // ---- event-sim spec builders (module scope: Battle Brain + calibration) ----
  // Per-cast amounts from unitOutput's per-second rates; static positional
  // passives folded in via a stat-wise team scale (dynamic donor kinds excluded
  // — they run as discrete EVENTS inside E.simEvents).
  // ⚔️ CAST-SCHEDULE mechanics the flat dmg×mc/cd model misses:
  // • SELF-KO — Stingarde / Electranade / Pyronade "Knockout self" cast ONCE then
  //   remove themselves; counting them over the whole fight wildly over-states dmg.
  //   Exceptions keep casting: SHINY Stingarde (self-KO dropped — hardcoded, the data
  //   has no shiny variant for it) and any self-KO unit ADJACENT to a Cherubble (its
  //   "Protect 1", re-applied each Cherubble cast, absorbs the self-KO).
  // • SELF-SLOWING CD — Draconarch raises its OWN cooldown by 6 (5 shiny) EVERY cast,
  //   so its rate decays through the fight → far fewer casts than dmg×mc/cd implies.
  function castsOnce(s, board, idx) {
    if (!s) return false;
    const m = monById[s.monsterId]; if (!m) return false;
    if (!(E.abilityText(m, s.level || 1, s.shiny).text || '').toLowerCase().includes('knockout self')) return false;
    if (s.monsterId === 'stingarde' && s.shiny) return false; // shiny Stingarde: self-KO gone
    if (board && idx != null) {
      const linked = hasLinkCable(), adj = [];
      if (idx % 3 > 0) adj.push(idx - 1); if (idx % 3 < 2) adj.push(idx + 1); adj.push(idx < 3 ? idx + 3 : idx - 3);
      if (board.some((b, j) => b && b.monsterId === 'cherubble' && (linked || adj.includes(j)))) return false; // protected → keeps casting
    }
    return true;
  }
  const cdGrowthPerCast = (s) => (s && s.monsterId === 'dragonarch') ? (s.shiny ? 5 : 6) : 0; // Draconarch (internal id 'dragonarch')
  // effective casts over a fight of length T under those schedules — for the
  // closed-form display + optimizer (simEvents models the schedule natively).
  function effectiveCasts(cd, T, once, cdGrow) {
    if (once) return 1;
    if (!cdGrow) return cd > 0 ? T / cd : 0;
    let t = 0, n = 0, c = Math.max(cd, 0.3);
    while (t + c <= T && n < 999) { t += c; n++; c += cdGrow; }
    return n; // Draconarch: cd, cd+grow, cd+2grow… so a handful of casts, not T/cd
  }
  // multiplier (≤1) on a unit's CONTINUOUS rate outputs (dps/poisonApp/…) for its
  // cast schedule — 1 for normal units. The event sim models the schedule directly
  // (once/cdGrow), so this is only for rate-based consumers: team sums + the optimizer.
  function castScheduleFactor(s, cd, T, board, idx) {
    if (!s) return 1;
    const once = castsOnce(s, board, idx), grow = cdGrowthPerCast(s);
    if (!once && !grow) return 1;
    const naive = cd > 0 ? T / cd : 1;
    return naive > 0 ? Math.min(1, effectiveCasts(cd, T, once, grow) / naive) : 1;
  }
  const _RATE_KEYS = new Set(['dps', 'heal', 'shield', 'burnApp', 'poisonApp', 'shockApp', 'hitRate']);
  // return cast-schedule-scaled COPIES of an outs[] array (self-KO/Draconarch only)
  function scaleOutsForSchedule(outs, board, T) {
    return outs.map((u, i) => {
      if (!u) return u;
      const f = castScheduleFactor(board[i], u.cd, T, board, i);
      if (f === 1) return u;
      const o = { ...u };
      for (const k of _RATE_KEYS) if (o[k]) o[k] *= f;
      return o;
    });
  }
  function buildEventSpecs(units, boardArr, baseT) {
    const sums = { dps: 0, heal: 0, shield: 0, burnApp: 0, poisonApp: 0, shockApp: 0 };
    units.forEach(u => { for (const k in sums) sums[k] += u[k] || 0; });
    const posStatic = boardArr ? positionalBonuses(boardArr, baseT, { skipDynamic: true }) : { add: {} };
    const f = (k) => sums[k] > 0.01 ? (sums[k] + (posStatic.add[k] || 0)) / sums[k] : 1;
    const fD = f('dps'), fH = f('heal'), fS = f('shield'), fB = f('burnApp'), fP = f('poisonApp'), fK = f('shockApp');
    return units.map(u => {
      const mc = Math.max(u.mc || 1, 1);
      let donor = null;
      const dn = donorFor(u.m.id, boardArr && boardArr[u.idx] && boardArr[u.idx].shiny);
      if (dn && DYNAMIC_DONOR_KINDS.has(dn.kind) && boardArr) {
        const dIdx = u.idx;
        let tIdx = -1;
        if (dn.dir === 'behind' && dIdx % 3 > 0) tIdx = dIdx - 1;
        else if (dn.dir === 'front' && dIdx % 3 < 2) tIdx = dIdx + 1;
        else if (dn.dir === 'above' && dIdx >= 3) tIdx = dIdx - 3;
        else if (dn.dir === 'adjacent') { // strongest eligible neighbour (single-target approximation)
          const nbs = [];
          if (dIdx % 3 > 0) nbs.push(dIdx - 1);
          if (dIdx % 3 < 2) nbs.push(dIdx + 1);
          nbs.push(dIdx < 3 ? dIdx + 3 : dIdx - 3);
          let bv = -1;
          nbs.forEach(x => { const r = units.find(w => w.idx === x); if (r && (!dn.filter || (r.m.types || []).some(ty => ty.id === dn.filter)) && r.dps > bv) { bv = r.dps; tIdx = x; } });
        }
        const arrIdx = units.findIndex(w => w.idx === tIdx);
        if (arrIdx >= 0 && (!dn.filter || ((units[arrIdx].m.types || []).some(ty => ty.id === dn.filter)))) {
          donor = { kind: dn.kind, rate: dn.rate, amt: dn.amt, stat: dn.stat, targetIdx: arrIdx };
        }
      }
      return {
        cd: u.cd, mc,
        dmg: (u.perCast * fD) / mc,
        heal: (u.heal * fH * u.cd) / mc, shield: (u.shield * fS * u.cd) / mc,
        burn: (u.burnApp * fB * u.cd) / mc, poison: (u.poisonApp * fP * u.cd) / mc, shock: (u.shockApp * fK * u.cd) / mc,
        donor, label: u.m.name,
        once: castsOnce(boardArr && boardArr[u.idx], boardArr, u.idx),
        cdGrow: cdGrowthPerCast(boardArr && boardArr[u.idx]),
      };
    });
  }
  // day-average enemy → 3 virtual units: preserves RATES and hit granularity
  const avgEnemySpecs = (enemy) => [
    { cd: Math.max(1 / Math.max(enemy.hitRate || 0.5, 0.2), 0.4), mc: 1, dmg: (enemy.dps || 0) / Math.max(enemy.hitRate || 0.5, 0.2), heal: 0, shield: 0, burn: 0, poison: 0, shock: 0, donor: null, label: 'avg hitter' },
    { cd: 1, mc: 1, dmg: 0, heal: 0, shield: 0, burn: enemy.burnApp || 0, poison: enemy.poisonApp || 0, shock: enemy.shockApp || 0, donor: null, label: 'avg statuses' },
    { cd: 1, mc: 1, dmg: 0, heal: enemy.heal || 0, shield: enemy.shield || 0, burn: 0, poison: 0, shock: 0, donor: null, label: 'avg sustain' },
  ];
  // 🎯 CALIBRATION (Bob's Buddy's trust move): replay a run's recorded battles
  // through the event sim vs that day's average enemy — report how often the
  // brain would have called the winner, with honest caveats (positions lost in
  // snapshots, final trinkets assumed, enemy = day average not the real foe).
  const _calibCache = {};
  function calibrationReport(run) {
    const key = run.id + '|' + (run.history || []).length;
    if (_calibCache[key]) return _calibCache[key];
    const SY = window.SYNERGY;
    if (!SY || !SY.dayProfiles || !(run.history || []).length) return null;
    const savedTrainer = live.trainerId, savedTrinkets = live.trinkets, savedData = live.trainerData;
    let hits = 0, total = 0, brier = 0;
    try {
      live.trainerId = run.trainer || null; live.trinkets = run.trinkets || []; live.trainerData = {};
      for (const h of run.history || []) {
        if (!h.board || !h.board.length || h.won == null) continue;
        const prof = SY.dayProfiles[String(Math.min(h.day, 15))] || SY.dayProfiles['15'];
        if (!prof) continue;
        const slots = new Array(6).fill(null);
        h.board.slice(0, 6).forEach((b, i) => { const at = b.slot != null && b.slot < 6 && !slots[b.slot] ? b.slot : slots.indexOf(null); if (at >= 0) slots[at] = { monsterId: b.id, level: b.lvl || 1, shiny: !!b.shiny, feed: b.feed }; });
        const baseT = 12 + 3 * h.day;
        const mine = boardOutputs(slots, h.day, baseT);
        if (!mine.units.length) continue;
        const specs = buildEventSpecs(mine.units, slots, baseT);
        const enemy = { dps: prof.dps, heal: prof.heal, shield: prof.shield, burnApp: prof.burnApp, poisonApp: prof.poisonApp, shockApp: prof.shockApp, hitRate: prof.hitRate != null ? prof.hitRate : prof.dps / 40 };
        const hp = baseHPFor(h.day);
        const ev = E.simEvents(specs, avgEnemySpecs(enemy), hp, hp, { tmax: Math.max(baseT * 2.5, 60) });
        const p = Math.min(Math.max(0.5 + (ev.margin / 240), 0.02), 0.98); // margin → probability (logistic-lite)
        total++;
        if ((ev.margin > 0) === !!h.won) hits++;
        brier += Math.pow(p - (h.won ? 1 : 0), 2);
      }
    } catch (e) { /* calibration must never break the UI */ }
    finally { live.trainerId = savedTrainer; live.trinkets = savedTrinkets; live.trainerData = savedData; }
    const out = total ? { hits, total, brier: +(brier / total).toFixed(2) } : null;
    _calibCache[key] = out;
    return out;
  }

  // 📐 FIT THE MONTE CARLO NOISE to reality (deferred until data suffices):
  // grid-search (σfoe, σown) minimizing Brier over ALL archived battles. Needs
  // ≥3 runs and ≥25 battles or it stays on defaults — fitting 11 battles from
  // one run would be astrology. Result stored in bc_simnoise; quickWinPct and
  // the Battle Brain's winProb both read it.
  function fitSimNoise() {
    const runs = loadRuns();
    const battles = runs.reduce((a, r) => a + (r.history || []).length, 0);
    const stored = JSON.parse(localStorage.getItem('bc_simnoise') || 'null');
    if (runs.length < 3 || battles < 25) return stored; // not enough ground truth yet
    if (stored && stored.fittedOn === battles) return stored; // already fitted on this data
    const GRID = [[0.08, 0.06], [0.12, 0.08], [0.16, 0.10], [0.22, 0.12]];
    let bestB = Infinity, bestPair = null;
    const savedT = live.trainerId, savedK = live.trinkets, savedD = live.trainerData;
    try {
      for (const [sf, so] of GRID) {
        let brier = 0, n = 0;
        for (const run of runs) {
          live.trainerId = run.trainer || null; live.trinkets = run.trinkets || []; live.trainerData = {};
          for (const h of (run.history || [])) {
            if (!h.board || h.won == null) continue;
            const prof = window.SYNERGY && window.SYNERGY.dayProfiles && (window.SYNERGY.dayProfiles[String(Math.min(h.day, 15))] || window.SYNERGY.dayProfiles['15']);
            if (!prof) continue;
            const slots = new Array(6).fill(null);
            h.board.slice(0, 6).forEach((b) => { const at = b.slot != null && b.slot < 6 && !slots[b.slot] ? b.slot : slots.indexOf(null); if (at >= 0) slots[at] = { monsterId: b.id, level: b.lvl || 1, shiny: !!b.shiny, feed: b.feed }; });
            const baseT = 12 + 3 * h.day;
            const mine = boardOutputs(slots, h.day, baseT);
            if (!mine.units.length) continue;
            const specs = buildEventSpecs(mine.units, slots, baseT);
            const enemy = { dps: prof.dps, heal: prof.heal, shield: prof.shield, burnApp: prof.burnApp, poisonApp: prof.poisonApp, shockApp: prof.shockApp, hitRate: prof.hitRate != null ? prof.hitRate : prof.dps / 40 };
            const hp = baseHPFor(h.day);
            // 24-draw MC at this sigma (plain Math.random is fine here — fitting, not display)
            let w = 0;
            const scale = (sp, k) => sp.map(s => ({ ...s, dmg: s.dmg * k, heal: s.heal * k, shield: s.shield * k, burn: s.burn * k, poison: s.poison * k, shock: s.shock * k }));
            for (let i = 0; i < 24; i++) {
              const gn = () => { const u = Math.max(Math.random(), 1e-9); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
              const r = E.simEvents(scale(specs, Math.max(1 + so * gn(), 0.6)), scale(avgEnemySpecs(enemy), Math.max(1 + sf * gn(), 0.5)), hp, hp, { tmax: Math.max(baseT * 2.5, 60) });
              if (r.tKill < r.tDie) w++;
            }
            const p = Math.min(Math.max(w / 24, 0.02), 0.98);
            brier += Math.pow(p - (h.won ? 1 : 0), 2); n++;
          }
        }
        if (n && brier / n < bestB) { bestB = brier / n; bestPair = { foe: sf, own: so, fittedOn: battles, brier: +(brier / n).toFixed(3) }; }
      }
    } catch (e) {} finally { live.trainerId = savedT; live.trinkets = savedK; live.trainerData = savedD; }
    if (bestPair) { localStorage.setItem('bc_simnoise', JSON.stringify(bestPair)); return bestPair; }
    return stored;
  }

  // ↕ STREAK-AWARE ENEMY SCALING — calibration on real runs proved that
  // opponents during a losing streak run STRONGER than the day-average
  // (matchmaking pairs records). Scale the day-average profile up +8% per
  // consecutive recent loss, capped +24%. Real synced foes are never scaled
  // (they're already the actual opponent).
  function streakFactor() {
    let streak = 0;
    for (const h of live.history || []) { if (h.won === false) streak++; else break; }
    return { streak, f: 1 + Math.min(streak, 3) * 0.08 };
  }
  const scaleEnemyProfile = (enemy, f) => f === 1 ? enemy : {
    dps: (enemy.dps || 0) * f, heal: (enemy.heal || 0) * f, shield: (enemy.shield || 0) * f,
    burnApp: (enemy.burnApp || 0) * f, poisonApp: (enemy.poisonApp || 0) * f, shockApp: (enemy.shockApp || 0) * f,
    hitRate: enemy.hitRate, units: enemy.units,
  };

  // 🎯 ENEMY SHAPE — classify the fight you're about to walk into so the strategy
  // brain can say which play counters it. Uses the SYNCED foe when available (a hard
  // read no other tool has), else the day's DOMINANT archetype (#2), else the mean.
  // Ratios are vs the day-average, so "wall"/"glass"/"dot" mean *relatively* skewed.
  // When not synced it also returns the archetype SPREAD (P(wall)/P(glass)/…) so the
  // brain can name the flex play for the tail draws. Returns null pre-corpus.
  function classifyShape(e, prof) {
    const rel = (k) => (e[k] || 0) / Math.max(prof[k] || 0.01, 0.01);
    const sustain = (rel('heal') + rel('shield')) / 2, dot = (rel('burnApp') + rel('poisonApp')) / 2, burst = rel('dps');
    let kind;
    if (sustain >= 1.4 && sustain >= dot && sustain >= burst) kind = 'wall';
    else if (dot >= 1.4 && dot >= burst) kind = 'dot';
    else if (burst >= 1.5 && burst > sustain) kind = 'glass';
    else kind = 'balanced';
    return { kind, sustain, dot, burst };
  }
  function enemyShape() {
    const SY = window.SYNERGY;
    const day = Math.min(live.day, 15);
    const prof = SY && SY.dayProfiles && (SY.dayProfiles[String(day)] || SY.dayProfiles['15']);
    if (!prof) return null;
    const foe = live.enemyBoard && live.enemyBoard.units && live.enemyBoard.units.some(Boolean) && live.enemyBoard.round === live.day ? live.enemyBoard : null;
    if (foe) {
      const fo = enemyScope(() => boardOutputs(foe.units, live.day, 12 + 3 * day));
      const c = classifyShape(fo, prof);
      return { synced: true, kind: c.kind, sustain: c.sustain, dot: c.dot, burst: c.burst, spread: null, label: 'your synced opponent' };
    }
    // not synced → dominant archetype (if #2 data present), plus the spread for tail draws
    const archs = (SY.dayArchetypes && SY.dayArchetypes[String(day)]) || null;
    if (archs && archs.length) {
      const sorted = archs.slice().sort((a, b) => b.weight - a.weight);
      const dom = classifyShape(sorted[0], prof);
      const spread = { wall: 0, dot: 0, glass: 0, balanced: 0 };
      for (const a of archs) spread[classifyShape(a, prof).kind] += a.weight;
      return { synced: false, kind: dom.kind, sustain: dom.sustain, dot: dom.dot, burst: dom.burst, spread, label: `the most-likely day-${day} enemy (${Math.round(sorted[0].weight * 100)}% of boards)` };
    }
    const c = classifyShape(prof, prof); // all ratios = 1 → 'balanced'
    return { synced: false, kind: c.kind, sustain: 1, dot: 1, burst: 1, spread: null, label: `the day-${day} average enemy` };
  }

  // ⚔️ Quick win% for an arbitrary board vs the current day-average enemy.
  // Shared by the Δwin% buy chips and the sim-verified optimizer — SAME specs
  // builders and HP model as the Battle Brain, so numbers can't drift apart.
  // nMC=0 → single deterministic run (returns margin-derived pct fast).
  function quickWinPct(boardArr, nMC, seedExtra) {
    const SY = window.SYNERGY;
    const day = Math.min(live.day, 15);
    const prof = SY && SY.dayProfiles && (SY.dayProfiles[String(day)] || SY.dayProfiles['15']);
    if (!prof) return null;
    const baseT = 12 + 3 * day;
    const mine = boardOutputs(boardArr, live.day, baseT);
    if (!mine.units.length) return null;
    const specs = buildEventSpecs(mine.units, boardArr, baseT);
    const enemy = scaleEnemyProfile({ dps: prof.dps, heal: prof.heal, shield: prof.shield, burnApp: prof.burnApp, poisonApp: prof.poisonApp, shockApp: prof.shockApp, hitRate: prof.hitRate != null ? prof.hitRate : prof.dps / 40 }, streakFactor().f);
    const foeSpecs = avgEnemySpecs(enemy);
    const myHP = live.hp || suggestedHP(live.day), enemyHP = baseHPFor(live.day);
    const tmax = Math.max(baseT * 2.5, 60);
    if (!nMC) {
      const ev = E.simEvents(specs, foeSpecs, myHP, enemyHP, { tmax });
      return { win: Math.min(Math.max(50 + ev.margin / 2.4, 2), 98), margin: ev.margin };
    }
    const noise = JSON.parse(localStorage.getItem('bc_simnoise') || 'null') || { foe: 0.12, own: 0.08 };
    let h = 2166136261 >>> 0;
    const seedStr = `${day}|${boardArr.filter(Boolean).length}|${seedExtra || ''}`;
    for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
    const g = () => { const u = Math.max(rnd(), 1e-9), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const scale = (sp, k) => sp.map(s => ({ ...s, dmg: s.dmg * k, heal: s.heal * k, shield: s.shield * k, burn: s.burn * k, poison: s.poison * k, shock: s.shock * k }));
    let w = 0;
    for (let i = 0; i < nMC; i++) {
      const r = E.simEvents(scale(specs, Math.max(1 + noise.own * g(), 0.6)), scale(foeSpecs, Math.max(1 + noise.foe * g(), 0.5)), myHP, enemyHP, { tmax });
      if (r.tKill < r.tDie) w++;
    }
    return { win: Math.round((w / nMC) * 100), margin: null };
  }

  // 🔬 SIMULATE — a NON-COMMITTAL what-if for buying an offer: where it lands,
  // the team's damage before→after, and the fight's win-chance shift. Same buy
  // logic as the ⚔️ Δwin chip (merge / fill / replace-weakest), just surfaced as
  // a full preview so you can see the trade before spending. Changes NO state.
  // Simulate acquiring ONE level-1 copy of m under the 3-merge rule (NO state
  // change) — shared core for the ⚔️ Δwin chip (applyOfferToBoard) and the 🔬
  // Simulate preview (simBuyResult). Merges 3→1 up to L3 via mergeChain; a lone
  // 2nd copy just adds a spare body (no level-up). Returns {board, idx, level,
  // merged, evo, replaced, spare} or null (board+bench full, nothing to cut).
  function simAcquireBoard(m) {
    const board = live.board.map(s => s ? { ...s } : null);
    const bench = (live.bench || []).map(s => s ? { ...s } : null);
    const before = [...board, ...bench].filter(s => s && s.monsterId === m.id && s.level === 1).length;
    const chain = mergeChain(m.id, 1, [board, bench]);
    if (chain.level > 1) { // a 3-merge fires (had ≥2 same-level copies to absorb)
      let resultIdx = -1;
      chain.consume.forEach(([a, j]) => { if (a === board) { if (resultIdx < 0) resultIdx = j; board[j] = null; } else bench[j] = null; });
      if (resultIdx < 0) resultIdx = board.findIndex(s => !s); // all fuel was benched → land on an empty board slot
      if (resultIdx < 0) resultIdx = 0;
      const nl = chain.level;
      const evo = m.evolution && m.evolution.trigger === 'level' && m.evolution.targetId && nl >= (m.evolution.level || 3) ? m.evolution.targetId : null;
      board[resultIdx] = evo && monById[evo] ? { monsterId: evo, level: nl, shiny: false } : { monsterId: m.id, level: nl, shiny: false };
      return { board, idx: resultIdx, level: nl, merged: true, evo: evo && monById[evo] ? monById[evo] : null };
    }
    const empty = board.findIndex(s => !s);
    if (empty >= 0) { board[empty] = { monsterId: m.id, level: 1, shiny: false }; return { board, idx: empty, level: 1, merged: false, spare: before }; }
    const prot = protectedUnitIds();
    let wi = -1, wv = Infinity;
    board.forEach((s, i) => { if (!s || prot.has(s.monsterId) || /egg/i.test(s.monsterId)) return; let v = Infinity; try { v = E.power(monById[s.monsterId], s.level, { day: live.day, team: board, trainerId: effectiveTrainerId() }).total; } catch (e) {} if (v < wv) { wv = v; wi = i; } });
    if (wi < 0) return null;
    const replaced = (monById[board[wi].monsterId] || {}).name;
    board[wi] = { monsterId: m.id, level: 1, shiny: false };
    return { board, idx: wi, level: 1, merged: false, replaced, spare: before };
  }
  function simBuyResult(m) {
    const r = simAcquireBoard(m);
    if (!r) return null;
    let action;
    if (r.merged && r.evo) action = `merges 3× ${esc(m.name)} → Lv ${r.level} and <b style="color:var(--gold)">EVOLVES → ${esc(r.evo.name)}</b>`;
    else if (r.merged) action = `<b style="color:var(--gold)">3-merges → Lv ${r.level}</b> — no new slot used`;
    else if (r.replaced) action = `board full → <b style="color:var(--red)">replaces ${esc(r.replaced)}</b> (your weakest unprotected unit)`;
    else if (r.spare >= 1) action = `adds a <b>2nd</b> copy at Lv 1 — <b>1 more</b> to 3-merge to Lv 2`;
    else action = `fills an empty slot at <b>Lv 1</b>`;
    return { board: r.board, idx: r.idx, action };
  }
  function openSimulate(mOrId) {
    const m = typeof mOrId === 'string' ? monById[mOrId] : mOrId;
    if (!m) return;
    const sim = simBuyResult(m);
    const box = el('div');
    if (!sim) { box.innerHTML = `<h3>🔬 Simulate buying ${esc(m.name)}</h3><div class="note" style="margin-top:8px">Your board is full and every unit is protected (plan / strategy / egg), so there's no honest slot to swap. Free one up first, then simulate.</div>`; openModal(box); return; }
    const day = live.day, T = 12 + 3 * day;
    const before = boardOutputs(live.board, day, T);
    const after = boardOutputs(sim.board, day, T);
    const wB = quickWinPct(live.board, 24, 'sim-b'), wA = quickWinPct(sim.board, 24, 'sim-a');
    const dWin = (wB && wA) ? Math.round(wA.win - wB.win) : null;
    const dDps = after.dps - before.dps;
    const sign = (n) => (n >= 0 ? '+' : '') + Math.round(n).toLocaleString();
    const col = (n) => n > 0.5 ? 'var(--green)' : n < -0.5 ? 'var(--red)' : 'var(--muted)';
    const miniGrid = (board, hl) => {
      const cell = (s, i) => {
        if (!s) return `<div class="sim-cell${i === hl ? ' hl' : ''}" style="opacity:.35">·</div>`;
        const mm = monById[s.monsterId]; if (!mm) return '<div class="sim-cell">?</div>';
        return `<div class="sim-cell${i === hl ? ' hl' : ''}" title="${esc(mm.name)} Lv${s.level}"><img src="${spr(s.shiny && mm.shinySprite ? mm.shinySprite : mm.sprite)}" width="30" height="30"><span class="sim-lv">L${s.level}</span></div>`;
      };
      return `<div class="sim-mini"><div class="sim-row">${board.slice(0, 3).map((s, i) => cell(s, i)).join('')}</div><div class="sim-row">${board.slice(3, 6).map((s, i) => cell(s, i + 3)).join('')}</div></div>`;
    };
    // per-unit damage deltas (position-aware — adding a donor lifts neighbours too)
    const bi = {}, ai = {}; before.units.forEach(u => bi[u.idx] = u); after.units.forEach(u => ai[u.idx] = u);
    const uRows = [];
    for (let i = 0; i < 6; i++) {
      const b = bi[i], a = ai[i]; if (!b && !a) continue;
      const bd = b ? b.dps : 0, ad = a ? a.dps : 0, d = ad - bd;
      if (Math.abs(d) < 0.5 && i !== sim.idx) continue;
      uRows.push(`<tr><td style="text-align:left">${i === sim.idx ? '👉 ' : ''}${esc(((a || b).m || {}).name || '?')}</td><td>${Math.round(bd).toLocaleString()}</td><td>${Math.round(ad).toLocaleString()}</td><td style="color:${col(d)};font-weight:700">${sign(d)}</td></tr>`);
    }
    const winClr = dWin == null ? 'var(--muted)' : dWin > 0 ? 'var(--green)' : dWin < 0 ? 'var(--red)' : 'var(--gold)';
    box.innerHTML = `<h3>🔬 Simulate buying ${esc(m.name)} <span style="font-size:11px;color:var(--muted);font-weight:400">· preview only — nothing is bought</span></h3>
      <div class="note" style="margin:8px 0 12px">Buying it ${sim.action}.</div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:center;margin-bottom:12px">
        <div style="text-align:center"><div style="font-size:10px;color:var(--muted);margin-bottom:4px">NOW</div>${miniGrid(live.board, -1)}</div>
        <div style="font-size:22px;color:var(--muted)">→</div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--accent);margin-bottom:4px">AFTER BUY</div>${miniGrid(sim.board, sim.idx)}</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:12px">
        <div class="sim-stat"><div class="sim-stat-n" style="color:${winClr}">${wB && wA ? `${Math.round(wB.win)}% → ${Math.round(wA.win)}%` : '—'}</div><div class="sim-stat-l">win chance ${dWin != null ? `<b style="color:${winClr}">(${dWin >= 0 ? '+' : ''}${dWin})</b>` : ''}</div></div>
        <div class="sim-stat"><div class="sim-stat-n" style="color:${col(dDps)}">${sign(dDps)}</div><div class="sim-stat-l">team damage / sec</div></div>
      </div>
      ${uRows.length ? `<table class="lvl-table" style="font-size:12px"><tr><th style="text-align:left">Unit</th><th>DPS now</th><th>after</th><th>Δ</th></tr>${uRows.join('')}</table>
        <div class="note" style="font-size:10px;margin-top:6px">Damage per second per unit (donor/aura effects included — a support can lift neighbours without hitting itself). Win chance is the event-sim vs today's average enemy.</div>` : '<div class="note">No measurable board-damage change — this pick is about econ / a future spike, not this fight.</div>'}`;
    openModal(box);
  }

  // 🎯 SELF-CALIBRATION — the ground-truth loop already MEASURES predicted-vs-actual
  // (Brier, in the Profile); this makes it CORRECT. From every logged {pred, won}
  // across your runs it detects systematic bias — the sim running over/under-confident
  // on YOUR real fights — and returns the point-shift to apply to future predictions.
  // Gated at ≥15 battles (never overfits a handful); strength ramps to full by ~40.
  // Separate layer from streak-scaling (which nudges the ENEMY model) — this
  // recalibrates the OUTPUT against reality, so the sim gets more honest as you play.
  function calibrationCorrection() {
    let all = [];
    try { all = loadRuns().flatMap(r => (r.history || []).filter(h => h.pred != null && h.won != null)); } catch (e) {}
    const preds = all.concat((live.history || []).filter(h => h.pred != null && h.won != null));
    if (preds.length < 15) return null;
    const n = preds.length;
    const meanPred = preds.reduce((a, h) => a + h.pred / 100, 0) / n;
    const meanWon = preds.reduce((a, h) => a + (h.won ? 1 : 0), 0) / n;
    const bias = meanPred - meanWon; // >0 = the sim ran OVER-confident on your fights
    const strength = Math.min((n - 15) / 25, 1);
    const adjust = Math.abs(bias) < 0.04 ? 0 : -bias * 100 * strength; // pp to shift
    return { n, bias, meanPred, meanWon, adjust };
  }

  // Score an ENEMY board without leaking the PLAYER's trinkets / Chemist bonus /
  // Chef conversion / Link Cable onto it. unitMods + castsOnce + chefInfo all read
  // live.* (they assume the unit is yours), so scoring a synced opponent through
  // them inflated its output and pushed the LIVE-SYNC win% ~20pp too low. Neutralize
  // the owner-specific state for the duration of the enemy computation.
  function enemyScope(fn) {
    const kt = live.trinkets, ki = live.trainerId, kd = live.trainerData;
    live.trinkets = []; live.trainerId = null; live.trainerData = {};
    try { return fn(); } finally { live.trinkets = kt; live.trainerId = ki; live.trainerData = kd; }
  }
  function battleBrainHTML(shopVerdict) {
    const SY = window.SYNERGY;
    const day = Math.min(live.day, 15);
    const prof = SY && SY.dayProfiles && (SY.dayProfiles[String(day)] || SY.dayProfiles['15']);
    const baseT = 12 + 3 * day;
    let mine = boardOutputs(live.board, live.day, baseT); // position-aware: donors feed team totals
    if (!mine.units.length) return '';
    let html = `<div class="card" style="margin-top:12px"><h3>🧮 Battle Brain <span style="font-size:10px;color:var(--muted);font-weight:400">model + real day-${day} enemy averages${prof ? ` (${prof.boards} top-rank boards)` : ''}</span></h3>`;

    // --- expected battle: REAL opponent when battle-synced, else day average ---
    const foe = live.enemyBoard && live.enemyBoard.units && live.enemyBoard.units.some(Boolean) && live.enemyBoard.round === live.day ? live.enemyBoard : null;
    if (prof || foe) {
      let enemy, enemyHP, foOut = null;
      const myHP = live.hp || suggestedHP(live.day);
      if (foe) {
        // their ACTUAL board → full output model incl. their positional donors & ramps.
        // enemyScope() strips YOUR trinkets/Chemist/Chef so they don't buff the opponent.
        const fo = foOut = enemyScope(() => boardOutputs(foe.units, live.day, baseT));
        enemy = { dps: fo.dps, heal: fo.heal, shield: fo.shield, burnApp: fo.burnApp, poisonApp: fo.poisonApp, shockApp: fo.shockApp, hitRate: fo.hitRate, units: fo.units };
        const foeHPm = (() => { // their HP trinkets count too
          let flat = 0, pct = 0;
          for (const id of foe.trinkets || []) {
            const t = D.trinkets.find(x => x.id === id);
            const h = t && HP_TRINKETS[t.name];
            if (h) { flat += h.flat || 0; pct += h.pct || 0; }
          }
          return { flat, pct };
        })();
        enemyHP = Math.round(baseHPFor(live.day) * (1 + foeHPm.pct / 100) + foeHPm.flat);
      } else {
        // ↕ streak-aware: day-average scaled up while on a losing streak
        // (calibration-proven — matchmaking pairs records)
        const sk = streakFactor();
        enemy = scaleEnemyProfile({ dps: prof.dps, heal: prof.heal, shield: prof.shield, burnApp: prof.burnApp, poisonApp: prof.poisonApp, shockApp: prof.shockApp, hitRate: prof.hitRate != null ? prof.hitRate : prof.dps / 40 }, sk.f);
        enemyHP = baseHPFor(live.day); // enemy trinket HP unknown → base
        if (sk.streak >= 1 && sk.f > 1) html += `<div class="note" style="margin:6px 0 0">↕ Opponent model scaled <b>+${Math.round((sk.f - 1) * 100)}%</b> — you're on a ${sk.streak}-loss streak and matchmaking pairs records (calibration-proven on your own runs).</div>`;
      }
      // ---------- EVENT SIM (primary since the deep-dive): discrete cast
      // timeline in E.simEvents — CDS donations land stepwise, shock cashes per
      // hit, burn ticks & decays, first casts wait a full cooldown. Spec
      // builders live at module scope (calibration replays reuse them).
      const TMAXEV = Math.max(baseT * 2.5, 60);
      let mySpecs = buildEventSpecs(mine.units, live.board, baseT);
      let foeSpecs = foe
        ? enemyScope(() => buildEventSpecs(foOut.units, foe.units, baseT))
        : avgEnemySpecs(enemy);
      let ev = E.simEvents(mySpecs, foeSpecs, myHP, enemyHP, { tmax: TMAXEV });
      // ramps were fight-length-averaged at baseT — if reality differs a lot,
      // re-average once at the observed duration and re-run (same as before)
      if (Math.abs(ev.duration - baseT) > 4) {
        mine = boardOutputs(live.board, live.day, ev.duration);
        mySpecs = buildEventSpecs(mine.units, live.board, baseT);
        ev = E.simEvents(mySpecs, foeSpecs, myHP, enemyHP, { tmax: TMAXEV });
      }
      let sim = { tKill: ev.tKill, tDie: ev.tDie, duration: ev.duration, margin: ev.margin, baseT, myHP, enemyHP };
      // closed-form cross-check — when the integral and the event timeline
      // disagree hard, SAY so instead of silently picking one (Bob's Buddy rule)
      const closedSim = simBattle(mine, enemy, day, myHP, enemyHP);
      const modelsDiverge = Math.abs((closedSim.margin || 0) - (sim.margin || 0)) > 60 && (closedSim.margin > 0) !== (sim.margin > 0);
      const fightT = Math.round(sim.duration);
      // ⚔️ WIN PROBABILITY (Bob's-Buddy-style): a band, not a point. Jitters the
      // SAME tKill/tDie the verdict uses (±12% multiplicative noise, N=400), so
      // verdict and % can never disagree. Seeded from the state so re-renders
      // don't wiggle; rounded to 5% — honest precision.
      // ⚔️ WIN PROBABILITY — TRUE Monte Carlo now: N event-sim runs with the
      // model's uncertainty applied to the SPECS (foe ±12% — day-average enemies
      // vary; own side ±8% — execution/model error), not to the answer. Seeded
      // per state so re-renders don't wiggle; rounded to 5% — honest precision.
      // 🎯 ENEMY ARCHETYPES — when NOT battle-synced, sim vs the real day-N enemy
      // DISTRIBUTION (sustain wall / burst / poison variants, weighted by how often they
      // occur) instead of one average blob → the win% becomes P(beat a real DRAW). Synced
      // runs already face the actual foe; days without archetype data fall back to the mean.
      const _archs = (!foe && SY && SY.dayArchetypes && SY.dayArchetypes[String(Math.min(live.day, 15))]) || null;
      const foeSet = (_archs && _archs.length > 1) ? _archs.map(a => ({
        weight: a.weight,
        specs: avgEnemySpecs(scaleEnemyProfile({ dps: a.dps, heal: a.heal, shield: a.shield, burnApp: a.burnApp, poisonApp: a.poisonApp, shockApp: a.shockApp, hitRate: a.hitRate != null ? a.hitRate : a.dps / 40 }, streakFactor().f)),
      })) : null;
      const winProb = (() => {
        const seedStr = `${live.day}|${Math.round(myHP)}|${Math.round(enemyHP)}|${mySpecs.length}|${foeSpecs.length}|${Math.round(sim.margin)}${foeSet ? '|a' + foeSet.length : ''}`;
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
        const g = () => { const u = Math.max(rnd(), 1e-9), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
        const scale = (specs, k) => specs.map(s => ({ ...s, dmg: s.dmg * k, heal: s.heal * k, shield: s.shield * k, burn: s.burn * k, poison: s.poison * k, shock: s.shock * k }));
        const noise = JSON.parse(localStorage.getItem('bc_simnoise') || 'null') || { foe: 0.12, own: 0.08 };
        const N = 100;
        let w = 0, close = 0;
        for (let i = 0; i < N; i++) {
          const kMe = Math.max(1 + noise.own * g(), 0.6), kFoe = Math.max(1 + noise.foe * g(), 0.5);
          let fs = foeSpecs;
          if (foeSet) { let rr = rnd(), acc = 0; fs = foeSet[foeSet.length - 1].specs; for (const f of foeSet) { acc += f.weight; if (rr <= acc) { fs = f.specs; break; } } } // draw an archetype ~ its frequency
          const r = E.simEvents(scale(mySpecs, kMe), scale(fs, kFoe), myHP, enemyHP, { tmax: TMAXEV });
          if (r.tKill < r.tDie) w++;
          if (Math.abs(r.margin) < 12) close++;
        }
        return { win: Math.round((w / N) * 20) * 5, close: Math.round((close / N) * 20) * 5 };
      })();
      // 🎯 SELF-CALIBRATION: shift the raw sim win% by the systematic bias measured on
      // YOUR OWN logged battles (sim over-confident → nudge down, under-confident → up).
      const rawWin = winProb.win; // pre-calibration — the RAW model's prediction
      const calib = calibrationCorrection();
      if (calib && calib.adjust) winProb.win = Math.max(2, Math.min(98, Math.round((winProb.win + calib.adjust) / 5) * 5));
      // 📼 ground-truth loop: record the RAW (pre-calibration) prediction — calibration
      // must measure the raw model against reality, not its own already-corrected output
      // (that self-reference converges to under-correcting a persistent bias).
      lastPrediction = { day: live.day, win: rawWin, forRun: live.syncRunId || null };
      lastLiveWin = { win: winProb.win, margin: sim.margin, synced: !!foe }; // 🏆 feeds the hero band atop the cockpit
      // The FAVORED/CLOSE/BEHIND label must be derived from the win% it is printed
      // beside — and from the CALIBRATED one, so the words match the number exactly.
      // (It used to come from the closed-form margin, which compares against the mean
      // enemy while the win% now sims against the day's archetype spread; that could
      // render a red "~40%" next to a green "FAVORED".)
      const verdict = winProb.win >= 60 ? `<b class="wr-elite">FAVORED</b>` : winProb.win >= 40 ? `<b class="wr-good">CLOSE</b>` : `<b class="wr-low">BEHIND</b>`;
      // 🧭 RUN HEALTH (Mobalytics-style): one glance — lives buffer, today's sim
      // margin, badge pace vs champion tempo. Same sim object, no second model.
      {
        const pace = live.day > 1 ? live.badges / (live.day - 1) : null; // champion ≈ 0.55 🏅/day
        const dims = [
          { label: `${live.lives} ❤`, score: live.lives >= 5 ? 2 : live.lives >= 2 ? 1 : 0, why: live.lives >= 5 ? 'healthy life buffer' : live.lives >= 2 ? 'thin life buffer' : 'LAST LIFE — must win' },
          { label: `~${winProb.win}% today`, score: sim.margin > 20 ? 2 : sim.margin > -10 ? 1 : 0, why: sim.margin > 20 ? 'favored today' : sim.margin > -10 ? 'close fight today' : 'behind today — fix the board' },
        ];
        if (pace != null) dims.push({ label: `${live.badges}🏅 d${live.day}`, score: pace >= 0.55 ? 2 : pace >= 0.35 ? 1 : 0, why: pace >= 0.55 ? 'champion pace' : pace >= 0.35 ? 'slightly off champion pace' : 'well off champion pace — need win streaks' });
        const worst = dims.slice().sort((a, b) => a.score - b.score)[0];
        const total = dims.reduce((a, d) => a + d.score, 0), max = dims.length * 2;
        const st = total >= max - 1 ? { t: 'ON TRACK', c: 'var(--green)' } : total >= max / 2 ? { t: 'AT RISK', c: 'var(--gold)' } : { t: 'CRITICAL', c: 'var(--red)' };
        html += `<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:8px 0 2px;padding:7px 10px;border:1px solid ${st.c};border-radius:10px">
          <b style="color:${st.c};font-size:12.5px">🧭 ${st.t}</b>
          ${dims.map(d => `<span class="pill" title="${esc(d.why)}" style="border-color:${d.score === 2 ? 'rgba(61,220,132,.5)' : d.score === 1 ? 'rgba(240,196,64,.5)' : 'rgba(255,77,94,.6)'}">${d.label}</span>`).join('')}
          <span style="font-size:10.5px;color:var(--muted)">focus: <b>${esc(worst.why)}</b></span></div>`;
      }
      // 🏁 PATH TO CHAMPION — turn the gauge into a plan: wins needed, days it
      // takes at YOUR battle win-rate, and whether the lives budget closes.
      if (live.badges < 10 && (live.history || []).length >= 2) {
        const hist = live.history;
        const wr = Math.min(Math.max(hist.filter(h => h.won).length / hist.length, 0.25), 0.85);
        const needed = 10 - live.badges;
        const expDays = Math.ceil(needed / wr);
        const expLosses = Math.round(expDays - needed);
        const closes = expLosses < live.lives;
        html += `<div class="note" style="margin:4px 0 0">🏁 <b>Champion path</b>: ${needed} more win${needed > 1 ? 's' : ''} — at your <b>${Math.round(wr * 100)}%</b> battle WR that's ~<b>${expDays} days</b> with ~${expLosses} loss${expLosses === 1 ? '' : 'es'} along the way (you have ${live.lives} ❤) → ${closes ? '<b class="wr-good">the math closes — hold this pace</b>' : '<b class="wr-low">the math does NOT close — you need a stronger board (raise WR) before the lives run out</b>'}.</div>`;
      }
      // 📅 DANGER-DAY FORECAST (LoL power-spike calendar, on the MEASURED enemy
      // HP curve): warn BEFORE the next big jump so levels/evolutions come
      // online in time — greeding into a spike is how runs die.
      if (live.day < 39) {
        const jumps = [];
        for (let k = 1; k <= 3; k++) {
          const a = baseHPFor(live.day + k - 1), b = baseHPFor(live.day + k);
          jumps.push({ day: live.day + k, pct: Math.round((b / Math.max(a, 1) - 1) * 100), hp: b });
        }
        const tomorrow = jumps[0];
        const biggest = jumps.slice().sort((x, y) => y.pct - x.pct)[0];
        if (biggest.pct >= 18) {
          const isTomorrow = biggest.day === tomorrow.day;
          html += `<div class="note" style="margin:4px 0 0">📅 <b>Power spike ${isTomorrow ? 'TOMORROW' : `day ${biggest.day}`}</b>: enemy HP jumps <b class="wr-low">+${biggest.pct}%</b> (→ ~${biggest.hp.toLocaleString()})${isTomorrow ? '' : ` — tomorrow is +${tomorrow.pct}%`}. Get your merges/evolutions online <b>before</b> it${sim.margin <= 10 ? ', and don’t greed into it with a close board' : ''}.</div>`;
        }
      }
      if (modelsDiverge) html +=`<div class="note" style="margin:4px 0 0;border-color:rgba(240,196,64,.5)">⚖️ <b>Models disagree</b>: event timeline says ${sim.margin >= 0 ? '+' : ''}${sim.margin}% but the integral model says ${closedSim.margin >= 0 ? '+' : ''}${closedSim.margin}% — trusting the event sim (discrete casts, real burn decay); treat the verdict with extra care this round.</div>`;
      // EHP = raw HP + everything your sustain absorbs while THEY kill you:
      // heal/s + shield/s (status damage into shields is 25% weaker → ×0.9 avg).
      // Sustain window is clamped to a realistic fight horizon so a near-unkillable
      // healer reads a big-but-sane EHP (~10^5) instead of the old runaway ~10^8.
      const ehpWin = (t) => Math.min(t, TMAXEV);
      const myEHP = Math.round(myHP + (mine.heal + mine.shield * 0.9) * ehpWin(sim.tDie));
      const enemyEHP = Math.round(enemyHP + (enemy.heal + enemy.shield * 0.9) * ehpWin(sim.tKill));
      // Σ damage a side OUTPUTS over a window — closed-form of offenseAt():
      // direct·T + shock hitRate·app·T²/2 + burn ∫(2·(max(B−2,0)t + min(B,2)/2)) + poison·T²/2
      const totalDmg = (P, T) => Math.round(
        P.dps * T
        + (P.hitRate || 0) * (P.shockApp || 0) * T * T / 2
        + Math.max((P.burnApp || 0) - 2, 0) * T * T + Math.min(P.burnApp || 0, 2) * T
        + (P.poisonApp || 0) * T * T / 2);
      const myOut = totalDmg(mine, sim.duration), enemyOut = totalDmg(enemy, sim.duration);
      // ⚔️ battle-synced: show the REAL enemy board being simulated
      if (foe) {
        const foeName = foe.name ? esc(foe.name) : 'matched opponent';
        html += `<div class="verdict lock" style="margin:8px 0 6px"><b>⚔️ LIVE BATTLE SYNC</b> — simulating vs <b>${foeName}</b>${foe.mmr ? ` <span style="color:var(--muted)">(${foe.mmr} MMR)</span>` : ''}, their actual board:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 6px">
          ${foe.units.map(u => {
            if (!u) return '<span class="pill" style="opacity:.4">—</span>';
            const m = monById[u.monsterId] || {};
            return `<span class="pill" style="gap:4px" title="${esc(m.name)} L${u.level}${u.shiny ? ' ✨' : ''}"><img class="sprite" src="${spr(u.shiny && m.shinySprite ? m.shinySprite : m.sprite)}" width="22" height="22" style="image-rendering:pixelated">${esc(m.name)} <b style="color:var(--gold)">L${u.level}</b>${u.shiny ? '✨' : ''}</span>`;
          }).join('')}
          ${(foe.trinkets || []).length ? `<span class="pill">💎 ${foe.trinkets.map(id => esc((D.trinkets.find(t => t.id === id) || { name: id }).name)).join(', ')}</span>` : ''}
        </div>`;
        // biggest threats on their side (fight-total damage)
        const threats = (enemy.units || []).map(u => ({ u, out: totalDmg(u, sim.duration) })).sort((a, b) => b.out - a.out).slice(0, 2);
        if (threats.length && threats[0].out > 0) html += `<div class="note" style="margin:0 0 4px">☠️ Their biggest threats: ${threats.map(t => `<b>${esc(t.u.m.name)}</b> (~${t.out.toLocaleString()} dmg)`).join(' · ')} — burst or outlast accordingly.</div>`;
      }
      html += `<div style="font-size:12.5px;margin:8px 0">Expected battle: <b>~${Math.round(sim.duration)}s</b> · you break their ${enemyHP.toLocaleString()} HP (EHP ~${enemyEHP.toLocaleString()}) in ~${Math.round(sim.tKill)}s, they break your ${myHP.toLocaleString()} (EHP ~${myEHP.toLocaleString()}) in ~${Math.round(sim.tDie)}s → ${verdict} <b style="color:${winProb.win >= 60 ? 'var(--green)' : winProb.win >= 40 ? 'var(--gold)' : 'var(--red)'}">~${winProb.win}% win chance</b> <span style="color:var(--muted)">(${sim.margin >= 0 ? '+' : ''}${sim.margin}% margin · ${winProb.close}% coin-flip close)</span></div>
      ${(foe && prof) ? (() => {
        // 🎯 COUNTER-READ — classify the REAL synced opponent vs the day-average and give
        // the concrete counter (no other tool can see your next foe). Only when synced.
        // Shares classifyShape() with the strategy brain so the two never disagree.
        const { kind } = classifyShape(enemy, prof);
        const cls = { wall: 'sustain wall', dot: 'burn/poison rush', glass: 'glass cannon', balanced: 'balanced' }[kind];
        const tip = {
          wall: 'chip damage stalls out — win with <b>burst or poison</b> (poison ramps forever, out-races heal past ~15s). Don\'t add more small hits.',
          dot: 'their DoT ramps — <b>race it</b>: burst them down early, or add heal/shield to survive the ramp then out-last.',
          glass: 'they hit <b>hard, fast</b> — stack shields/sustain to survive the opening, then out-last them. Outlast, don\'t trade.',
          balanced: 'even shape — small edges decide it: one merge, a positioning donor, or a scaling trinket.',
        }[kind];
        return `<div class="note" style="margin:4px 0 6px;border-left:2px solid var(--accent);padding-left:8px;font-size:11px">🎯 <b>Counter-read:</b> this opponent is a <b>${cls}</b> — ${tip}</div>`;
      })() : ''}
      ${(() => {
        // 🕰 FIGHT-LENGTH LEVER — a player insight the raw numbers never state out loud:
        // when your board SCALES (poison/shock/burn stacks that never decay, self-ramps
        // like Bambudo/Galvanine/Prismagon), deliberately LOWERING burst to make the
        // fight last longer can raise total damage, because the ramp compounds. So
        // "add a shield/heal body" can beat "add a damage body" — the opposite of the
        // usual instinct.
        //
        // Measured, not assumed: re-run the board's own output model at a 40% longer
        // fight and compare against what a purely linear board would deal. The excess
        // IS the scaling. Then gate it on whether you actually survive that longer
        // fight — extending a fight you lose is just losing slower.
        const T = Math.max(sim.duration, 4), TL = T * 1.4;
        let gain = 0;
        try {
          const now = totalDmg(mine, T);
          const longer = totalDmg(boardOutputs(live.board, live.day, TL), TL);
          if (now > 0) gain = Math.round(((longer / (now * 1.4)) - 1) * 100);
        } catch (e) { return ''; }
        if (!isFinite(gain)) return '';
        const survives = sim.tDie > sim.tKill;           // do we outlive the kill window?
        const slack = Math.round(sim.tDie - sim.tKill);
        // A board that can't break their EHP at all pushes tKill to absurd values —
        // reporting "you die 385s early" would be noise dressed as precision.
        const cantKill = !isFinite(sim.tKill) || sim.tKill > T * 3;
        if (gain >= 10) {
          const verdict = cantKill
            ? `But at this rate <b>the kill never lands</b> — stretching the fight can't pay a ramp that isn't big enough. You need <b>more output as well as survivability</b>: add a damage piece, then lengthen.`
            : survives
              ? `You outlast the kill ${slack > T * 2 ? '<b>comfortably</b>' : `by <b>${slack}s</b>`}, so <b>stretching the fight is a damage upgrade</b>: a shield/heal body can be worth more than another attacker, even though it lowers your burst.`
              : `But you die <b>${Math.abs(slack)}s before</b> the kill lands — the ramp never gets paid. <b>Survivability IS your damage right now</b>: shield/heal first, then the ramp wins it.`;
          return `<div class="note" style="margin:4px 0 6px;border-left:2px solid var(--gold);padding-left:8px;font-size:11px">🕰 <b>Your board SCALES</b> — at a 40% longer fight it deals <b style="color:var(--gold)">+${gain}%</b> above what a flat board would. ${verdict}</div>`;
        }
        if (gain <= 3) {
          return `<div class="note" style="margin:4px 0 6px;border-left:2px solid var(--accent);padding-left:8px;font-size:11px">⚡ <b>Your board is front-loaded</b> — a 40% longer fight adds only <b>+${gain}%</b> over linear, so stalling buys you almost nothing. <b>Win early</b>: raw damage and tempo beat sustain here.</div>`;
        }
        return '';
      })()}
      ${calib && calib.adjust ? `<div class="note" style="font-size:10px;margin:0 0 6px;color:var(--accent)">🎯 <b>self-calibrated ${calib.adjust > 0 ? '+' : ''}${Math.round(calib.adjust)}pp</b> — across your <b>${calib.n}</b> logged battles the raw sim ran <b>${Math.abs(Math.round(calib.bias * 100))}% ${calib.bias > 0 ? 'over' : 'under'}-confident</b>, so this win% is nudged toward what actually happens on YOUR fights.</div>` : ''}
      <table class="stats" style="font-size:11.5px"><tr><th></th><th>💗 HP</th><th>🛡 EHP</th><th>Direct DPS</th><th>Heal/s</th><th>Shield/s</th><th>Burn/s</th><th>Poison/s</th><th>Shock/s</th><th>Hits/s</th><th>Σ dmg ~${Math.round(sim.duration)}s</th></tr>
        <tr><td><b>You</b></td><td><b style="color:var(--green)">${myHP.toLocaleString()}</b></td><td title="HP + (heal/s + shield/s×0.9) × time-to-die — what the enemy must actually chew through">~${myEHP.toLocaleString()}</td><td>${mine.dps.toFixed(1)}</td><td>${mine.heal.toFixed(1)}</td><td>${mine.shield.toFixed(1)}</td><td>${mine.burnApp.toFixed(2)}</td><td>${mine.poisonApp.toFixed(2)}</td><td>${mine.shockApp.toFixed(2)}</td><td>${mine.hitRate.toFixed(2)}</td><td><b style="color:var(--gold)">${myOut.toLocaleString()}</b></td></tr>
        <tr><td>${foe ? '⚔️ THEIR board' : `Avg day-${day} enemy`}</td><td><b style="color:var(--red)">${enemyHP.toLocaleString()}</b>${foe || hpLearned() || live.day === 1 ? '' : '<span style="color:var(--muted)">≈</span>'}</td><td>~${enemyEHP.toLocaleString()}</td><td>${enemy.dps.toFixed(1)}</td><td>${enemy.heal.toFixed(1)}</td><td>${enemy.shield.toFixed(1)}</td><td>${enemy.burnApp.toFixed(2)}</td><td>${enemy.poisonApp.toFixed(2)}</td><td>${enemy.shockApp.toFixed(2)}</td><td>${enemy.hitRate.toFixed(2)}</td><td><b style="color:var(--gold)">${enemyOut.toLocaleString()}</b></td></tr>
        <tr style="border-top:1px solid var(--border)"><td colspan="11" style="font-size:11.5px;padding-top:6px">Σ over ~${Math.round(sim.duration)}s: you deal <b style="color:var(--gold)">${myOut.toLocaleString()}</b> into their EHP ~${enemyEHP.toLocaleString()} ${myOut >= enemyEHP ? '<b class="wr-good">✓ kill</b>' : `<b class="wr-low">✗ ${Math.round((myOut / Math.max(enemyEHP, 1)) * 100)}% there</b>`} · they deal <b style="color:var(--gold)">${enemyOut.toLocaleString()}</b> into your EHP ~${myEHP.toLocaleString()} ${enemyOut >= myEHP ? '<b class="wr-low">✗ you die</b>' : '<b class="wr-good">✓ you survive</b>'}</td></tr></table>
      ${mine.shockApp > 0.15 && mine.hitRate > 0 ? `<div class="note" style="margin:5px 0 0">⚡ Shock (wiki-exact): every direct hit deals <b>+stacks</b> flat damage — by fight end you'll have ~<b>${Math.round(mine.shockApp * sim.duration)}</b> stacks on them, so your ~${mine.hitRate.toFixed(1)} hits/s gain up to <b>+${Math.round(mine.shockApp * sim.duration * mine.hitRate)} DPS</b> late. More hits/s (multicast, CDS) multiplies shock.</div>` : ''}
      ${mine.pos && mine.pos.notes.length ? `<div class="note" style="margin:5px 0 0">📐 Your layout is feeding these numbers: <b style="color:var(--accent)">${mine.pos.notes.join(' · ')}</b>${mine.pos.add.dps > 0.5 ? ` (+${mine.pos.add.dps.toFixed(1)} DPS from positioning)` : ''} — move units and this updates.</div>` : ''}
      ${(() => {
        // ⚡ CDS DONATION SUMMARY — how much cooldown speed this round hands to
        // one or two batomon (requested feature). Reads mine.pos.cdsGiven (same source
        // as the per-unit table), grouped by recipient.
        const cg = (mine.pos && mine.pos.cdsGiven) || [];
        const byTarget = {};
        cg.forEach((g, dIdx) => {
          if (!g || g.totalPct < 0.5) return;
          const donor = (mine.units.find(u => u.idx === dIdx) || {}).m;
          g.targets.forEach(t => {
            const k = t.name; byTarget[k] = byTarget[k] || { pct: 0, donors: new Set(), aura: g.aura };
            byTarget[k].pct += g.totalPct / g.targets.length; byTarget[k].donors.add(donor ? donor.name : '?');
          });
        });
        const parts = Object.entries(byTarget).sort((a, b) => b[1].pct - a[1].pct)
          .map(([name, v]) => `<b style="color:var(--accent)">+${Math.round(v.pct)}% CDS</b> → <b>${esc(name)}</b> <span style="color:var(--muted)">(${[...v.donors].join(', ')}${v.aura ? ', aura' : ', permanent'})</span>`);
        if (!parts.length) return '';
        return `<div class="note" style="margin:5px 0 0">⚡ <b>Cooldown speed this round</b>: ${parts.join(' · ')} — ${parts.length > 1 ? 'split across units; ' : ''}stack donors behind ONE carry to floor its cooldown faster.</div>`;
      })()}
      ${mine.rampNotes && mine.rampNotes.length ? `<div class="note" style="margin:5px 0 0">📈 <b>In-battle scalers</b> (averaged over the expected fight, already in the totals): ${mine.rampNotes.join(' · ')}</div>` : ''}
      <details style="margin-top:8px" open><summary style="cursor:pointer;font-size:12px;font-weight:700">🔬 Per-unit breakdown — casts, per-cast, totals over ~${fightT}s</summary>
        ${(() => {
          // per-unit TOTAL DAMAGE over the fight: direct + its share of the team's
          // burn/poison/shock damage (statuses are team pools — attribute by
          // application share; poison is linear so per-unit is exact)
          const Tb = sim.duration;
          // real cast count over the fight — self-KO fire ONCE, Draconarch self-slows,
          // everyone else fights/cd. Drives the direct + per-cast columns.
          const effCastsFor = (u) => Math.max(Math.floor(effectiveCasts(u.cd, Tb, castsOnce(u.s, live.board, u.idx), cdGrowthPerCast(u.s)) + 1e-9), 1);
          const teamBurn = mine.units.reduce((a, x) => a + x.burnApp, 0);
          const teamShockApp = mine.units.reduce((a, x) => a + x.shockApp, 0);
          const burnPool = Math.max(teamBurn - 2, 0) * Tb * Tb + Math.min(teamBurn, 2) * Tb;
          const shockPool = mine.hitRate * teamShockApp * Tb * Tb / 2;
          const uTotal = (u) => {
            const A = effCastsFor(u);
            const direct = u.perCast * A;
            const burnShare = teamBurn > 0 ? (u.burnApp / teamBurn) * burnPool : 0;
            const poisonDmg = u.poisonApp * Tb * Tb / 2;
            const shockShare = teamShockApp > 0 ? (u.shockApp / teamShockApp) * shockPool : 0;
            return { direct, burnShare, poisonDmg, shockShare, sum: direct + burnShare + poisonDmg + shockShare };
          };
          const totals = mine.units.map(uTotal);
          const grand = totals.reduce((a, t) => a + t.sum, 0);
          const cdsGiven = (mine.pos && mine.pos.cdsGiven) || [];
          // per-column running totals for the Σ team row
          const col = { casts: 0, dmg: 0, heal: 0, shield: 0, burn: 0, poison: 0, shock: 0, cds: 0 };
          const num = (n) => Math.round(n).toLocaleString();
          const rows = mine.units.map((u, ui) => {
            const A = effCastsFor(u);
            col.casts += A;
            const cell = (perAct, isPoison, accum) => {
              const total = perAct * A;
              if (accum) col[accum] += total;
              if (!perAct || perAct < 0.05) return '<td style="color:var(--muted)">—</td>';
              const extra = isPoison ? `<br><span style="color:var(--muted);font-size:9.5px">≈${num(totals[ui].poisonDmg)} dmg</span>` : '';
              return `<td><b>${num(perAct)}</b>/cast → <b style="color:var(--gold)">${num(total)}</b>${extra}</td>`;
            };
            // ⚡ CDS cell — cooldown speed this unit HANDS to allies (Boomagon-style)
            const cg = cdsGiven[u.idx];
            let cdsCell = '<td style="color:var(--muted)">—</td>';
            if (cg && cg.totalPct >= 0.5) {
              col.cds += cg.totalPct;
              const to = [...new Set(cg.targets.map(t => t.name))].join(', ');
              cdsCell = cg.aura
                ? `<td title="Aura → ${esc(to)}"><b style="color:var(--accent)">+${Math.round(cg.totalPct)}%</b><br><span style="color:var(--muted);font-size:9.5px">aura → ${esc(to)}</span></td>`
                : `<td title="+${cg.perCastPct.toFixed(0)}% per cast × ${cg.casts} casts (cascade-adjusted), permanent → ${esc(to)}"><b>${cg.perCastPct.toFixed(0)}%</b>×${cg.casts} → <b style="color:var(--accent)">+${Math.round(cg.totalPct)}%</b><br><span style="color:var(--muted);font-size:9.5px">→ ${esc(to)}</span></td>`;
            }
            return `<tr><td style="white-space:nowrap"><img class="sprite" src="${spr(u.m.sprite)}" width="22" style="vertical-align:middle"> ${esc(u.m.name)}${u.ramp ? ' <span title="In-battle scaler — row shows fight-averaged values">📈</span>' : ''}</td>
              <td><b>${A}</b>${u.mc > 1 ? `<span style="color:var(--accent)">×${u.mc}</span>` : ''}</td>
              ${cell(u.perCast, false, 'dmg')}${cell(u.heal * u.cd, false, 'heal')}${cell(u.shield * u.cd, false, 'shield')}${cell(u.burnApp * u.cd, false, 'burn')}${cell(u.poisonApp * u.cd, true, 'poison')}${cell(u.shockApp * u.cd, false, 'shock')}${cdsCell}
              <td><b style="color:var(--gold)" title="direct ${Math.round(totals[ui].direct)}${totals[ui].burnShare ? ' + burn ' + Math.round(totals[ui].burnShare) : ''}${totals[ui].poisonDmg ? ' + poison ' + Math.round(totals[ui].poisonDmg) : ''}${totals[ui].shockShare ? ' + shock ' + Math.round(totals[ui].shockShare) : ''}">${num(totals[ui].sum)}</b></td></tr>`;
          }).join('');
          const totCell = (v, suffix = '') => v >= 0.5 ? `<td><b style="color:var(--gold)">${num(v)}${suffix}</b></td>` : '<td style="color:var(--muted)">—</td>';
          return `<table class="stats" style="font-size:11px;margin-top:6px"><tr><th>Unit</th><th>Casts</th><th>Damage</th><th>Heal</th><th>Shield</th><th>Burn</th><th>Poison</th><th>Shock</th><th title="Cooldown speed handed to allies (Boomagon-style donors)">⚡ CDS</th><th>Σ dmg</th></tr>
          ${rows}
          <tr style="border-top:1px solid var(--border)"><td><b>Σ team</b></td><td><b>${col.casts}</b></td>${totCell(col.dmg)}${totCell(col.heal)}${totCell(col.shield)}${totCell(col.burn)}${totCell(col.poison)}${totCell(col.shock)}${col.cds >= 0.5 ? `<td><b style="color:var(--accent)">+${Math.round(col.cds)}%</b></td>` : '<td style="color:var(--muted)">—</td>'}<td><b style="color:var(--gold)">${num(grand)}</b></td></tr></table>
          <div class="note" style="font-size:9.5px;margin-top:2px;color:var(--muted)">Column totals sum each unit's fight-total. Damage column = direct only; Σ dmg adds each unit's burn/poison/shock share (status is attributed to the unit APPLYING it). ⚡ CDS = permanent cooldown-speed donated this fight.</div>`;
        })()}
        <div class="note" style="font-size:10px;margin-top:4px">Casts = activations in the expected battle (${fightT}s ÷ cooldown); ×N = multicast hits per activation (already in per-cast values). Σ dmg = direct + the unit's burn/poison/shock damage over ~${fightT}s (hover it for the split). Trinket & Chef modifiers included.</div>
      </details>`;
      // timing insight: when does your poison overtake their sustain?
      if (mine.poisonApp > 0.2) {
        const tCross = (enemy.heal + enemy.shield * 0.9) / Math.max(mine.poisonApp, 0.01);
        html += `<div class="note" style="margin:6px 0 0">☠️ Your poison alone out-damages their sustain from <b>~${Math.round(tCross)}s</b> — ${tCross < sim.duration ? 'the ramp pays off in this fight length ✓' : `but the fight ends ~${Math.round(sim.duration)}s: too short, add tempo or triggers`}.</div>`;
      }
      // greed logic: hearts + margin
      const greed = sim.margin > 20 && live.lives >= 3
        ? `🟢 <b>Greed window OPEN</b> (${live.lives} ❤, +${sim.margin}%): bank permanent ramps — CDS stacks, Bambudo-style permanents, sell-value. They pay across the ~${Math.max(10 - live.badges, 1)} battles left.`
        : sim.margin < -20 || live.lives <= 1
          ? `🔴 <b>STOP GREEDING</b> (${live.lives} ❤, ${sim.margin}%): you can afford ~${Math.max(live.lives, 1)} more losses. Tempo now — shields front, carry crowned top-middle, spend to zero. Ramp buys nothing if the run ends.`
          : `🟡 <b>Even matchup</b> (${live.lives} ❤): take positioning moves below; only greed ramps that ALSO add tempo this fight.`;
      html += `<div class="day-block" style="margin-top:8px">${greed}</div>`;

      // --- shop economy verdict (mulligan intelligence, same math as 🎰 card) ---
      if (shopVerdict) {
        html += `<div class="note" style="margin:6px 0 0">🎰 Shop: <b class="${shopVerdict.cls === 'reroll' ? 'wr-low' : shopVerdict.cls === 'mid' ? 'wr-ok' : 'wr-good'}">${shopVerdict.verdict}</b> — expected fresh-roll best ≈${shopVerdict.evPct}% vs current best ${esc(shopVerdict.bestNow)} ≈${shopVerdict.nowPct}%.</div>`;
      }

      // --- adopted strategy status: is each engine assembled, fed — or DONE? ---
      const actList = activeStrategies();
      const primaryStratId = actList[0] && actList[0].id;
      for (const actS of actList) {
        const sDef = STRATEGY_LIB.find(s => s.id === actS.id) || {};
        const fIdx = actS.focusId ? live.board.findIndex(s => s && s.monsterId === actS.focusId) : -1;
        const recvV = fIdx >= 0 && mine.pos && mine.pos.recv ? mine.pos.recv[fIdx] : 0;
        // ROTATION: focus near the ~1s CDS floor → its chain is DONE, move it on
        let rotate = '';
        if (fIdx >= 0 && actS.id === 'boom_chain') {
          const fu = mine.units.find(u => u.m.id === actS.focusId);
          if (fu && fu.cd <= 2.2) {
            const next = mine.units.filter(u => u.m.id !== actS.focusId && u.m.id !== 'boomagon' && u.perCast > 0)
              .sort((a, b) => b.perCast - a.perCast)[0];
            rotate = next
              ? ` <b class="wr-great">${esc((monById[actS.focusId] || {}).name)} is at ${fu.cd.toFixed(1)}s — near the floor: ROTATE the chain to <span class="strat-rotate" data-sid="${actS.id}" data-id="${next.m.id}" style="cursor:pointer;text-decoration:underline">${esc(next.m.name)}</span> ↻</b>`
              : ` <b class="wr-great">${esc((monById[actS.focusId] || {}).name)} is at ${fu.cd.toFixed(1)}s — near the floor: chain done, consider selling the Boomagons.</b>`;
          }
        }
        // Does a DONOR that can actually feed the focus exist on the board? If
        // not, "re-optimize" is a dead-end (the optimizer already reports
        // "optimal") — the honest advice is to ACQUIRE a donor, not shuffle.
        const focusTypes = new Set(((monById[actS.focusId] || {}).types || []).map(t => t.id));
        const hasFeeder = live.board.some(s => {
          if (!s || s.monsterId === actS.focusId) return false;
          const dn = donorFor(s.monsterId, s.shiny);
          return dn && (!dn.filter || focusTypes.has(dn.filter));
        });
        const focusState = fIdx < 0 ? '<b class="wr-low">is NOT on the board — field it</b>'
          : recvV > 0.5 ? `receiving <b style="color:var(--green)">+${recvV.toFixed(1)} donated output</b> where it stands ✓`
          : hasFeeder ? '<b class="wr-low">receiving almost nothing — 🧲 re-optimize to feed it</b>'
          : '<b class="wr-low">no donor on your board can feed it — buy a donor (Boomagon/feeder) and place it next to the focus</b>';
        const star = actList.length >= 2 && actS.id === primaryStratId ? '★ ' : '';
        html += `<div class="note" style="margin:6px 0 0">♟️ ${star}<b>${esc(sDef.name || actS.id)}</b> active${actList.length >= 2 && actS.id !== primaryStratId ? ' <span style="color:var(--muted);font-size:10px">(2nd play — board aims at primary)</span>' : ''}${actS.focusId ? ` — focus <b>${esc((monById[actS.focusId] || {}).name)}</b> ${focusState}` : ''}.${rotate}</div>`;
      }

      // --- build path: where the run plan stands + what the next piece buys you ---
      const planB = live.plan && buildById(live.plan);
      if (planB) {
        const ownedIds = new Set([...live.board, ...(live.bench || [])].filter(s => s).map(s => s.monsterId));
        const pieces = [...new Set([...(planB.core || []), ...(planB.lateCore || [])])].filter(id => monById[id] && !REMOVED_IDS.has(id));
        const have = pieces.filter(id => ownsPieceOrEvo(id, ownedIds).have); // evolved forms count (Dribblet→Emperooze)
        const missing = pieces.filter(id => !ownsPieceOrEvo(id, ownedIds).have).map(id => monById[id]);
        let nextLine = '';
        const next = missing[0];
        if (next) {
          const empty = live.board.findIndex(s => !s);
          if (empty >= 0) { // simulate the next plan piece dropped into your empty slot
            const hypo = live.board.slice();
            hypo[empty] = { monsterId: next.id, level: 1, shiny: false };
            const mine2 = boardOutputs(hypo, live.day, sim.duration);
            const sim2 = simBattle(mine2, enemy, day, myHP, enemyHP);
            nextLine = ` Next piece <b>${esc(next.name)}</b> ($${next.cost}): margin ${sim.margin >= 0 ? '+' : ''}${sim.margin}% → <b class="${sim2.margin > sim.margin ? 'wr-good' : 'wr-low'}">${sim2.margin >= 0 ? '+' : ''}${sim2.margin}%</b> <span style="color:var(--muted)">(simulated at L1 in your empty slot)</span>.`;
          } else nextLine = ` Next piece: <b>${esc(next.name)}</b> ($${next.cost}) — board full, decide who it replaces.`;
          if (live.shop.some(o => o.monsterId === next.id)) nextLine += ' <b class="wr-great">🛒 IN SHOP NOW.</b>';
          else nextLine += hitOddsChip(next.id); // 🎲 what finding it should cost
        }
        html += `<div class="note" style="margin:6px 0 0">🎯 <b>Build path — ${esc(planB.name)}</b>: ${have.length}/${pieces.length} pieces owned.${nextLine}${!missing.length ? ' <b class="wr-good">Complete ✓ — pivot gold to levels, shinies and trinkets.</b>' : ''}</div>`;
      }

      // --- positional moves ---
      const moves = [];
      const idxOf = (pred) => live.board.findIndex(s => s && pred(s));
      mine.units.forEach(u => {
        const donor = donorFor(u.m.id, u.s && u.s.shiny);
        if (!donor) return;
        // u.idx is the unit's REAL slot — findIndex-by-species resolves the WRONG
        // copy when the board runs duplicates (e.g. two Venopuffs).
        const dIdx = (u.idx != null && u.idx >= 0) ? u.idx : live.board.findIndex(s => s && s.monsterId === u.m.id);
        // candidate receivers on board
        const cand = mine.units.filter(r => {
          if (r.m.id === u.m.id) return false;
          if (donor.filter && !(r.m.types || []).some(t => t.id === donor.filter)) return false;
          if (donor.filterTier && r.m.tier !== donor.filterTier) return false;
          if (donor.filterNoAbility && r.m.ability && (r.m.ability.byLevel || r.m.ability.description)) return false;
          return true;
        });
        if (!cand.length) {
          if (donor.filter) moves.push({ pri: 1, txt: `${u.m.name} (${donor.desc}) has <b>no ${donor.filter} target</b> on board — its buff is wasted until you add one.` });
          return;
        }
        // best receiver: for shock amp prefer shock stat; else highest DPS; for triggers highest per-cast
        cand.sort((a, b) => donor.stat === 'shock' ? b.shockApp - a.shockApp : donor.kind === 'trigger' ? b.perCast - a.perCast : b.dps - a.dps);
        const r = cand[0];
        const rIdx = live.board.findIndex(s => s && s.monsterId === r.m.id);
        const T = sim.duration;
        const donorCasts = Math.max(Math.floor(T / u.cd), 1);
        let gain = '', warn = '';
        if (donor.kind === 'cds') {
          const totalCDS = donor.rate * donorCasts;
          gain = `≈ +${Math.round(totalCDS * 100)}% CDS by fight end (avg +${Math.round(totalCDS * 50)}%) → ~+${(r.dps * totalCDS / 2).toFixed(1)} DPS`;
          if (r.cd <= 1.2) warn = ` ⚠️ ${r.m.name} is near the 1s cooldown floor — CDS is nearly wasted, stop greeding it here.`;
        } else if (donor.kind === 'charge') {
          const extra = (donorCasts * donor.amt) / r.cd;
          gain = `≈ ${extra.toFixed(1)} extra casts → ~+${(extra * r.perCast).toFixed(0)} damage this fight`;
        } else if (donor.kind === 'multicast') {
          gain = `+${donor.amt} Multicast → ~+${(r.perCast / r.mc * donor.amt / r.cd).toFixed(1)} DPS`;
        } else if (donor.kind === 'trigger') {
          gain = `≈ ${donorCasts} bonus casts of ${r.m.name} → ~+${(donorCasts * r.perCast).toFixed(0)} damage`;
        } else if (donor.kind === 'feed') {
          const stacks = (donor.amt || 2) * donorCasts;
          gain = donor.stat === 'poison' ? `≈ +${stacks} Poison stacks → ~+${Math.round(stacks * T / 4)} damage over the fight (ramps)` : donor.stat === 'burn' ? `≈ +${stacks} Burn by fight end` : `≈ +${stacks} ${donor.stat}`;
        } else if (donor.stat === 'shock') {
          gain = `doubles ${r.m.name}'s Shock output`;
        } else gain = donor.desc;
        // ADJACENT donors feed EVERY matching neighbour, so a single-receiver check
        // is wrong: the old code called it "✓ already positioned" the moment ONE
        // neighbour matched — hiding a WASTED adjacent slot while eligible targets
        // sat out of range (Noxnimbus feeding 2/3 with Mosslug parked beside it and
        // two Toxic bodies in the far column). Score the whole adjacency ring.
        if (donor.dir === 'adjacent' && !hasLinkCable() && dIdx >= 0) {
          const adj = [];
          if (dIdx % 3 > 0) adj.push(dIdx - 1);
          if (dIdx % 3 < 2) adj.push(dIdx + 1);
          adj.push(dIdx < 3 ? dIdx + 3 : dIdx - 3);
          const eligible = (i) => {
            const s = live.board[i]; if (!s) return false;
            const m = monById[s.monsterId]; if (!m) return false;
            if (donor.filter && !slotTypes(s).some(t => t.id === donor.filter)) return false; // slotTypes → event-granted types count
            if (donor.filterTier && m.tier !== donor.filterTier) return false;
            if (donor.filterNoAbility && m.ability && (m.ability.byLevel || m.ability.description)) return false;
            return true;
          };
          const nameAt = (i) => (live.board[i] ? ((monById[live.board[i].monsterId] || {}).name || live.board[i].monsterId) : null);
          const fed = adj.filter(eligible);
          const wasted = adj.filter(i => !eligible(i));
          const outside = live.board.map((s, i) => i).filter(i => live.board[i] && i !== dIdx && adj.indexOf(i) < 0 && eligible(i));
          const label = donor.filter ? donor.filter.charAt(0).toUpperCase() + donor.filter.slice(1) : 'eligible';
          if (wasted.length && outside.length) {
            const occ = wasted.filter(i => live.board[i]);
            const inNames = outside.map(nameAt).filter(Boolean);
            const action = occ.length
              ? `swap <b>${esc(occ.map(nameAt).join(' / '))}</b> out of the slot${occ.length > 1 ? 's' : ''} touching it and put <b>${esc(inNames.join(' / '))}</b> there`
              : `move <b>${esc(inNames.join(' / '))}</b> into the empty slot${wasted.length > 1 ? 's' : ''} touching it`;
            moves.push({ pri: 1.5, txt: `↔ <b>${esc(u.m.name)}</b> feeds <b>EVERY adjacent ${esc(label)}</b> — you're only feeding <b>${fed.length}/${adj.length}</b>. ${action} (${esc(label)}, currently out of range): ${gain} <b>per extra target</b>.` });
          } else if (wasted.length) {
            moves.push({ pri: 2.2, txt: `↔ <b>${esc(u.m.name)}</b> feeds every adjacent ${esc(label)}, but only <b>${fed.length}/${adj.length}</b> touching slots qualify and you have no spare ${esc(label)} to move in — another ${esc(label)} body is worth ${gain}.` });
          } else if (fed.length) {
            moves.push({ pri: 3, txt: `✓ <b>${esc(u.m.name)}</b>: all <b>${fed.length}</b> slot${fed.length > 1 ? 's' : ''} touching it ${fed.length > 1 ? 'are' : 'is'} ${esc(label)} — feed maxed (${gain} each).` });
          }
          return; // adjacency handled — skip the single-receiver placement check
        }
        // placement check — behind = LEFT of the donor (same row), in front = RIGHT,
        // above = top row same column
        const sameRow = (a, b) => Math.floor(a / 3) === Math.floor(b / 3);
        let placed = false, place = '';
        if (donor.dir === 'behind') { placed = sameRow(dIdx, rIdx) && rIdx === dIdx - 1; place = `put ${r.m.name} directly to the LEFT of ${u.m.name} (behind it, same row)`; }
        else if (donor.dir === 'front') { placed = sameRow(dIdx, rIdx) && rIdx === dIdx + 1; place = `put ${r.m.name} directly to the RIGHT of ${u.m.name} (in front of it, same row)`; }
        else if (donor.dir === 'above') { placed = dIdx >= 3 && rIdx === dIdx - 3; place = `${u.m.name} in the BOTTOM row, ${r.m.name} directly ABOVE it (same column)`; }
        else if (hasLinkCable()) { placed = true; place = `🔗 Link Cable makes everyone adjacent — ${u.m.name}'s aura hits the whole board, position it freely`; }
        else { placed = (sameRow(dIdx, rIdx) && Math.abs(dIdx - rIdx) === 1) || Math.abs(dIdx - rIdx) === 3; place = `keep ${u.m.name} touching ${r.m.name} (middle slots maximize neighbours)`; }
        moves.push({ pri: placed ? 3 : 2, txt: `${placed ? '✓ ' : '↔ '} <b>${esc(u.m.name)}</b> → <b>${esc(r.m.name)}</b>: ${placed ? 'already positioned. ' : esc(place) + '. '}${esc(u.m.name)} casts ~${donorCasts}× in ~${Math.round(T)}s: ${gain}${warn}` });
      });
      // real-placement hints from top-rank full boards
      if (SY && SY.monsters) {
        live.board.forEach((s, idx) => {
          if (!s) return;
          const rs = SY.monsters[s.monsterId];
          if (!rs || !rs.slots || (rs.slotRounds || 0) < 100 || rs.bestSlot == null) return;
          const cur = rs.slots[idx];
          const best = rs.slots[rs.bestSlot];
          if (idx !== rs.bestSlot && best.winRate - (cur ? cur.winRate : rs.winRate) >= 3) {
            const nm = (monById[s.monsterId] || { name: s.monsterId }).name;
            moves.push({ pri: 2.5, txt: `📊 Top players win most with <b>${esc(nm)}</b> at <b>${SLOT_SHORT[rs.bestSlot]}</b> (${best.winRate}% over ${best.rounds} rounds) — yours sits ${SLOT_SHORT[idx]}${cur ? ` (${cur.winRate}%)` : ''}. Data hint; donor arrows above outrank it.` });
          }
        });
      }
      if (moves.length) {
        moves.sort((a, b) => a.pri - b.pri);
        html += `<h3 style="margin-top:12px">📐 Positioning moves</h3><ul style="margin:6px 0 0 18px;font-size:12px">${moves.slice(0, 6).map(m => `<li>${m.txt}</li>`).join('')}</ul>`;
      }
    } else {
      html += '<div class="note">Run the synergy crawl (⟳ in Patches) to unlock real per-day enemy profiles.</div>';
    }
    html += `<div class="note" style="margin-top:8px;font-size:10.5px">Model: enemy = ${live.enemyBoard && live.enemyBoard.units && live.enemyBoard.units.some(Boolean) ? 'the REAL matched opponent (battle sync — their board, donors and ramps fully modeled)' : `average of real top-rank day-${day} boards`}; both sides use the REAL team HP. Wiki-exact statuses: burn ticks 2×/s and decays 1/tick, poison ramps forever, shock adds +stacks flat damage on every direct hit. Estimates, not gospel — the arrows are what matters.</div></div>`;
    return html;
  }

  function liveOwnedCounts() {
    const c = {};
    [...live.board, ...(live.bench || [])].forEach(s => { if (s) c[s.monsterId] = (c[s.monsterId] || 0) + 1; });
    return c;
  }

  // ---------------- TEAM HP (the in-game HP bar) ----------------
  // Both teams share a BASE HP that grows per day (patch notes confirm the
  // scaling; the exact curve isn't published anywhere). Day 1 = 300, observed
  // in-game. The cockpit HP field is EDITABLE: type what the game shows and
  // the model learns that day's base — future days extrapolate from what it
  // has learned. Trinket HP boosts apply on top (yours only; enemy = base).
  const HP_TRINKETS = {
    'Training Weights': { flat: 100 },
    'Barbell': { flat: 5000 },
    'Mysterious Charm': { pct: 25 },
    "Dryad's Charm": { pct: 30 },
  };
  function hpMods(trinketIds) {
    let flat = 0, pct = 0;
    const src = [];
    for (const id of trinketIds || []) {
      const t = D.trinkets.find(x => x.id === id);
      const h = t && HP_TRINKETS[t.name];
      if (h) { flat += h.flat || 0; pct += h.pct || 0; src.push(t.name); }
    }
    return { flat, pct, src };
  }
  // Default base-HP curve MEASURED from real Master-ranked play (from
  // day-by-day corrections, patch 0.8.4). The old default was a flat +100/day
  // from 300 — catastrophically low (day 12 predicted 1,400 vs real 25,700, an
  // 18× error that made every HP bar / EHP / battle verdict wrong). These
  // anchors are the real thing; a run's own typed values still override them.
  // Every day 1–19 is now a REAL measured value, read frame-by-frame off a full
  // Master run (AleBoardGamer, "The Most INSANE Run", 2026-07 — day counter + HP
  // bar). No interpolation left in this range; days 20+ still extrapolate.
  const DEFAULT_HP_BY_DAY = { 1: 300, 2: 500, 3: 800, 4: 1400, 5: 2400, 6: 3800, 7: 5700, 8: 8300, 9: 11600, 10: 15700, 11: 20700, 12: 26700, 13: 33800, 14: 42000, 15: 51500, 16: 62300, 17: 74600, 18: 88400, 19: 103900 };
  function baseHPFor(day) {
    // Days 1–19 are REAL video-measured PURE BASE HP (authoritative on the current
    // patch) → the validated default WINS outright. This is deliberate: the "learned"
    // curve accumulates the HP the player TYPES, which INCLUDES their HP trinkets (a
    // Barbell run → they type ~base+5000). Letting that override the base corrupted it
    // — then suggestedHP DOUBLE-added the Barbell AND the enemy's HP (= baseHPFor)
    // inflated. (Observed 2026-07-24, "day 8 is 8300" — a stale learned day-8 was showing
    // higher.) Trinkets are added on top in suggestedHP, so the base stays pure.
    // Learned/typed overrides now apply ONLY to unmeasured days (20+, endless/extended).
    if (DEFAULT_HP_BY_DAY[day] != null) return DEFAULT_HP_BY_DAY[day];
    const map = Object.assign({}, DEFAULT_HP_BY_DAY);
    try { const gc = JSON.parse(localStorage.getItem('bc_hpCurve') || '{}'); Object.entries(gc).forEach(([d, o]) => { if (o && o.n && DEFAULT_HP_BY_DAY[+d] == null) map[+d] = Math.round(o.sum / o.n); }); } catch (e) {}
    Object.entries(live.hpBaseByDay || {}).forEach(([d, v]) => { if (+v > 0 && DEFAULT_HP_BY_DAY[+d] == null) map[+d] = +v; });
    const pts = Object.entries(map).map(([d, v]) => [+d, +v]).sort((a, b) => a[0] - b[0]);
    const exact = pts.find(p => p[0] === day);
    if (exact) return exact[1];
    if (day <= pts[0][0]) return Math.max(Math.round(pts[0][1] * day / pts[0][0]), 100);
    // between two known days → linear interpolation
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] >= day) {
        const [a, b] = [pts[i - 1], pts[i]];
        const slope = (b[1] - a[1]) / Math.max(b[0] - a[0], 1);
        return Math.max(Math.round(a[1] + slope * (day - a[0])), 100);
      }
    }
    // beyond the last known day (20+) → accelerating extrapolation. Measured daily
    // increments fit ~44·day² (days 13–19 sit at ~43, the day-19→28 span at ~45; 44
    // splits it to within ~2% at day 28 = 340,400 real). The old 38 undershot ~6%.
    const last = pts[pts.length - 1];
    let hp = last[1];
    for (let k = last[0] + 1; k <= day; k++) hp += 44 * k * k;
    return Math.round(hp);
  }
  // "learned" = this run typed a value, OR the global curve already knows TODAY's
  // HP from a past run (so the ≈ estimate badge drops once you've taught that day).
  const hpLearned = () => {
    if (Object.keys(live.hpBaseByDay || {}).length > 0) return true;
    try { const gc = JSON.parse(localStorage.getItem('bc_hpCurve') || '{}'); return !!(gc[live.day] && gc[live.day].n); } catch (e) { return false; }
  };
  function suggestedHP(day) {
    const m = hpMods(live.trinkets);
    return Math.round(baseHPFor(day) * (1 + m.pct / 100) + m.flat);
  }
  function setHPFromGame(hp) { // user typed the real bar → learn this day's base
    const m = hpMods(live.trinkets);
    live.hp = Math.max(0, Math.round(hp));
    live.hpBaseByDay = live.hpBaseByDay || {};
    const base = Math.max(Math.round((live.hp - m.flat) / (1 + m.pct / 100)), 50);
    live.hpBaseByDay[live.day] = base;
    // accumulate into the GLOBAL curve (averaged) so this day's HP is right in
    // every future run without re-teaching it. Bounded to a sane range as a
    // typo guard (both teams share this base, so it's day-scaled).
    if (base >= 50 && base <= 500000) try {
      const gc = JSON.parse(localStorage.getItem('bc_hpCurve') || '{}');
      const cur = gc[live.day] || { sum: 0, n: 0 };
      gc[live.day] = { sum: cur.sum + base, n: cur.n + 1 };
      localStorage.setItem('bc_hpCurve', JSON.stringify(gc));
    } catch (e) {}
  }
  // just the HP bar + note — its own block so the HP-input re-render (`#tc-hp`)
  // never destroys the trainer <select> above it (which would drop its handlers).
  function trainerCardHpHTML() {
    const m = hpMods(live.trinkets);
    const hp = live.hp || suggestedHP(live.day);
    const base = baseHPFor(live.day);
    const hpLine = `${m.flat || m.pct ? `base ${base}${m.pct ? ` +${m.pct}%` : ''}${m.flat ? ` +${m.flat}` : ''} (${esc(m.src.join(', '))})` : hpLearned() || live.day === 1 ? 'both teams share this base' : '≈ estimate — type the real bar to teach it'}`;
    return `<div class="hpbar-wrap" title="Team HP for today's battle — set the exact number in the Team HP field up in the cockpit header. ${esc(hpLine)}">
        <span class="hpbar-label">HP</span>
        <div class="hpbar"><div class="hpbar-fill" style="width:100%"></div><span class="hpbar-num">${hp.toLocaleString()}</span></div>
      </div>
      <div class="note" style="margin:4px 0 0;font-size:10px">${hpLine}</div>`;
  }
  function trainerCardHTML() {
    const t = D.trainers.find(x => x.id === live.trainerId);
    // trainer picker now lives IN this box (moved out of the crowded top bar) so the
    // portrait, WR, passive, HP and the selector are all together on the left.
    const trainerOpts = ['<option value="">— pick your trainer —</option>', ...D.trainers
      .slice().sort((a, b) => ((b.stats && b.stats.winRate) || 0) - ((a.stats && a.stats.winRate) || 0))
      .map(tt => `<option value="${tt.id}" ${tt.id === live.trainerId ? 'selected' : ''}>${esc(tt.name)}${tt.stats ? ' — ' + tt.stats.winRate + '% WR' : ''}</option>`)].join('');
    const offers = live.trainerOffers && live.trainerOffers.length;
    return `<div class="card trainer-card">
      <label class="ctl" style="width:100%;margin-bottom:9px">Trainer<div style="display:flex;gap:4px"><select id="lv-trainer" style="flex:1">${trainerOpts}</select><button class="ghost" id="lv-trainer-adv" title="Who should I pick? Meta win-rates blended with YOUR own history per trainer — scoped to the trainers the game is offering you." style="padding:4px 8px${offers ? ';border-color:var(--accent);color:var(--accent);font-weight:800' : ''}">🧑✨${offers ? ' 🎯' : ''}</button></div>${offers && !live.trainerId ? `<span style="font-size:10px;color:var(--accent);margin-top:2px">🎯 ${live.trainerOffers.length} offered — click 🧑✨ to pick the best</span>` : ''}</label>
      ${t ? `<div style="display:flex;gap:10px;align-items:center">
        <img src="${spr(t.sprite)}" alt="" style="width:64px;height:64px;image-rendering:pixelated;border-radius:10px;background:var(--bg2);border:1px solid var(--border)">
        <div style="min-width:0">
          <div style="font-weight:800;font-size:14px">${esc(t.name)}${t.stats ? ` <span style="font-size:10px;font-weight:400">${wrSpan(t.stats.winRate)} WR</span>` : ''}</div>
          <div style="font-size:11px;color:var(--muted);line-height:1.35">${esc(t.description || '')}</div>
        </div></div>` : '<div class="note" style="margin:0">Pick your trainer above — portrait & passive show here.</div>'}
      <div class="tier-controls" style="margin:10px 0 8px;gap:8px;align-items:flex-end">
        <label class="ctl">Day<div class="stepper"><button data-st="day" data-d="-1">−</button><b id="lv-day">${live.day}</b><button data-st="day" data-d="1">+</button></div></label>
        <label class="ctl">Gold $<input type="number" id="lv-gold" value="${live.gold}" min="0" style="width:66px"></label>
        <label class="ctl">Lives<div class="stepper ${live.lives <= 1 ? 'lives-critical' : ''}"><button data-st="lives" data-d="-1">−</button><b id="lv-lives">${live.lives <= 1 ? '❤' : ''}${live.lives}</b><button data-st="lives" data-d="1">+</button></div>${live.lives <= 1 ? `<span class="lives-badge">${live.trainerData && live.trainerData.secondChance ? '🕊 SECOND CHANCE' : '⚠️ LAST LIFE'}</span>` : ''}</label>
        <label class="ctl" title="Team HP for today's battle (the in-game HP bar). Auto-estimated per day + trinket boosts — TYPE the real value and the model learns the day's base HP.">Team HP<span style="display:flex;align-items:center;gap:5px"><input type="number" id="lv-hp" value="${live.hp}" min="0" step="10" style="width:78px">${hpLearned() || live.day === 1 ? '' : '<span class="pill" title="Estimate — type the real bar to teach the curve">≈</span>'}</span></label>
        <label class="ctl">Badges<div class="stepper"><button data-st="badges" data-d="-1">−</button><b id="lv-badges">${live.badges}</b><button data-st="badges" data-d="1">+</button></div></label>
        <label class="ctl" title="Shop level (rank) — drives rarity odds. Raise it as you upgrade in-game (Apex Bait, Market License, Rich Lady…).">Shop Lv<div class="stepper"><button data-st="shopRank" data-d="-1">−</button><b>${live.shopRank}</b><button data-st="shopRank" data-d="1">+</button></div></label>
      </div>
      <div id="tc-hp">${trainerCardHpHTML()}</div>
    </div>`;
  }

  // ---------------- ITEM BUY ADVICE ----------------
  // Every item on offer gets an explicit BUY / MAYBE / SKIP with a reason —
  // curated tier as the base, then board/trainer/economy context on top.
  const ITEM_TIER_OF = (() => {
    const map = {};
    for (const [tier, arr] of Object.entries(G.ITEM_TIERS || {})) (arr || []).forEach(([id]) => { map[id] = tier; });
    return map;
  })();
  function itemAdvice(id, opts) {
    const it = D.items.find(x => x.id === id);
    if (!it) return null;
    // opts: {team, shop, gold, day, lives, shopRank, trainerId, planId} —
    // defaults mirror the LIVE run; the Shop Advisor passes its sandbox instead
    const o = Object.assign(
      { team: null, shop: live.shop, gold: live.gold, day: live.day, lives: live.lives, shopRank: live.shopRank, trainerId: effectiveTrainerId(), planId: live.plan, itemUses: live.itemUses || null },
      Array.isArray(opts) ? { team: opts } : opts || {});
    const owned = (o.team || [...live.board, ...(live.bench || [])]).filter(Boolean);
    const isChefCtx = o.trainerId === 'pyromaniac';
    const typeCount = (tid) => owned.filter(s => {
      const m = monById[s.monsterId] || {};
      const single = (m.types || []).length === 1; // Chef fire-conversion counts for Fire items
      return ((m.types || []).some(t => t.id === tid)) || (tid === 'fire' && isChefCtx && single);
    }).length;
    // item-use FEEDERS (Alpinine line: "+20/40/60 Damage and Shield per item use")
    // — every item advice gets the rationale; the uses-left gate comes first
    let feederNote = '';
    for (const s of owned) {
      const m = monById[s.monsterId] || {};
      const abT = (m.ability && ((m.ability.byLevel || {})[String(s.level)] || m.ability.description)) || '';
      const mm = abT.match(/when you use an item, this gains \+(\d+) (.+?)\./i);
      if (mm) feederNote += ` · feeds ${m.name} (+${mm[1]} ${mm[2]} per use)`;
    }
    const uses = o.itemUses;
    const B = (v, why) => ({
      v: uses && uses.used >= uses.max && v !== 'SKIP' ? 'SKIP' : v,
      why: (uses && uses.used >= uses.max ? `NO USES LEFT today (${uses.used}/${uses.max}) — the limit refills tomorrow (Berroon raises it). ` : '') + why + (v !== 'SKIP' ? feederNote : ''),
      it,
    });
    switch (id) {
      case 'lucky_coin': return B('BUY', '+$3 and refunds the item use — free money, always click');
      case 'nana_berry': return B('BUY', '+5% CDS to the BOTTOM-RIGHT monster and refunds the use — position the right unit there first (target advice below)');
      case 'pom berry': return B('BUY', '+8 Damage to the BOTTOM-RIGHT monster and refunds the use — position the right unit there first (target advice below)');
      case 'shiny_berry': return B('BUY', 'turns a RANDOM non-shiny monster shiny (+~20% stats, often an upgraded ability) — roll odds below');
      case 'green_stone': {
        // expected-value call, not a reflex: you GIVE UP the rolled Common and
        // GET an average random Uncommon — only worth it if that trade is up
        const planGS = o.planId && G.BUILDS.find(x => x.id === o.planId);
        const inPlanGS = new Set(planGS ? [...(planGS.core || []), ...(planGS.lateCore || [])] : []);
        const pwGS = (m, lvl, shiny) => { try { return E.power(m, lvl, { shiny, day: o.day, team: owned, trainerId: o.trainerId }).total; } catch (e) { return 0; } };
        const commons = owned.filter(s => (monById[s.monsterId] || {}).tier === 1);
        if (!commons.length) return B('SKIP', 'no Common on your board/bench — nothing to transform');
        const uncommons = shopPool.filter(m => m.tier === 2 && !m.isEvolvedForm);
        const avgU = uncommons.reduce((a, m) => a + pwGS(m, 1, false), 0) / Math.max(uncommons.length, 1);
        const valOf = (s) => pwGS(monById[s.monsterId], s.level, s.shiny)
          * (inPlanGS.has(s.monsterId) ? 1.6 : 1) * (s.feed && (s.feed.dmg || s.feed.cds) ? 1.25 : 1) * (s.level > 1 ? 1.3 : 1);
        const vals = commons.map(valOf);
        const meanVal = vals.reduce((a, b) => a + b, 0) / vals.length;
        const single = commons.length === 1;
        const keepName = (monById[commons[0].monsterId] || {}).name;
        if (single && vals[0] >= avgU * 0.9) return B('SKIP', `it would eat ${keepName} — your only Common is worth more than an average random Uncommon`);
        if (avgU > meanVal * 1.15) return B('BUY', `average random Uncommon beats your ${single ? '' : 'average '}Common${single ? ` (${keepName})` : 's'} by ~${Math.round(((avgU - meanVal) / Math.max(meanVal, 1)) * 100)}% — good trade${single ? '' : ', roll odds below'}`);
        if (avgU > meanVal * 0.95) return B('MAYBE', 'roughly a coin-flip trade vs an average Uncommon — use it on a throwaway Common, not a keeper');
        return B('SKIP', `your Common${single ? ` (${keepName})` : 's'} outvalue an average random Uncommon — don't feed the stone`);
      }
      case 'feast': return B('BUY', 'team +5 damage for free');
      case 'cake': return B('BUY', 'free +5 damage on two units');
      case 'fake_coin': return B('BUY', 'free reroll — pair it with the 🎰 verdict');
      case 'apex_bait': {
        const behind = o.shopRank < Math.min(o.day + 1, 14);
        return o.day >= 4 && behind ? B('BUY', `shop rank ${o.shopRank} → ${o.shopRank + 1} opens better rarities (day-${o.day} window)`) : B('MAYBE', 'rank-up tool — best from day 4+ when you want higher rarities');
      }
      case 'basic_bait': return B('MAYBE', 'rank DOWN — only for digging merge copies at low rarities');
      case 'red_coin': return o.lives >= 5 && o.gold < 15
        ? B('MAYBE', `+$20 for 1 life — you have ${o.lives} ❤ and need tempo; the Brain's greed meter decides`)
        : B('SKIP', `a life is worth more than $20 at ${o.lives} ❤`);
      case 'gray_chip': return B('MAYBE', 'bet $5 on winning the next battle — click only when the Brain says FAVORED');
      case 'basic_candy': case 'rare_candy': case 'ultra_candy': {
        const lvlTarget = owned.find(s => s.level >= (id === 'ultra_candy' ? 3 : 2));
        return lvlTarget ? B('BUY', `level-up fuel — push ${(monById[lvlTarget.monsterId] || {}).name} toward ${id === 'ultra_candy' ? 'L4' : 'L3/evolution'}`) : B('MAYBE', 'no merge-ready unit yet — better once something sits at L2+');
      }
      case 'hot_pepper': { const n = typeCount('fire'); return n >= 2 ? B('BUY', `${n} Fire units (Chef conversions count) get +1 Burn each`) : n === 1 ? B('MAYBE', 'only 1 Fire unit — thin value') : B('SKIP', 'no Fire units'); }
      case 'black_sludge': { const n = typeCount('toxic'); return n >= 2 ? B('BUY', `${n} Toxic units get +1 Poison`) : n === 1 ? B('MAYBE', 'only 1 Toxic unit') : B('SKIP', 'no Toxic units'); }
      case 'battery_pack': { const n = typeCount('electric'); return n >= 1 ? B('BUY', `+1 Shock — shock scales with your hit rate`) : B('SKIP', 'no Electric units'); }
      case 'mystic_pearl': { const n = typeCount('water'); return n >= 2 ? B('BUY', `${n} Water units get +10 Heal`) : n ? B('MAYBE', 'only 1 Water unit') : B('SKIP', 'no Water units'); }
      case 'shiny_pebble': { const n = typeCount('rock'); return n >= 2 ? B('BUY', `${n} Rock units get +20 Shield`) : n ? B('MAYBE', 'only 1 Rock unit') : B('SKIP', 'no Rock units'); }
      case 'coupon': return (o.shop || []).length >= 2 ? B('BUY', `−$5 per monster with ${o.shop.length} offers in shop — pays for itself fast`) : B('MAYBE', 'value scales with how much you buy this round');
      case 'coffee': return owned.length >= 3 ? B('BUY', 'doubles every On-Battle-Start next fight — $5 to steal a badge fight') : B('MAYBE', 'cheap burst — best with battle-start units');
      case 'golden_ticket': case 'crimson_ticket': case 'blue_ticket': case 'purple_ticket': case 'green_ticket': case 'gray_ticket':
        return o.day >= 6 ? B('BUY', 'rarity-locked reroll — high-value fishing at your day') : B('MAYBE', 'rarity reroll — stronger from day 6+');
      default: {
        const tier = ITEM_TIER_OF[id];
        if (tier === 'S' || tier === 'A') return B('BUY', `top-tier item (${tier} tier)` + (itemCost(it) ? ` — worth the $${itemCost(it)}` : ''));
        if (tier === 'B') return B('MAYBE', 'solid situational value (B tier)');
        return B(itemCost(it) === 0 ? 'BUY' : 'MAYBE', itemCost(it) === 0 ? 'free — take it' : 'niche (C tier) — only with a plan');
      }
    }
  }

  // ---------------- 🎁 TRINKET GIFT CHOOSER ----------------
  // The game offers 2-4 trinkets after a battle — pick them here and every
  // option is scored for THIS run: official WR + crawled held-WR + proven
  // pairs with what you already hold + measured fit with your board.
  function giftChooser() {
    const box = el('div');
    const sel = [];
    const boardIds = new Set([...live.board, ...(live.bench || [])].filter(s => s).map(s => s.monsterId));
    const held = (window.SYNERGY || {}).trinketsHeld || {};
    const render = () => {
      box.innerHTML = `<h3>🎁 Gift choice — which trinket to take?</h3>
        <div class="note" style="margin:6px 0 8px">Click the trinkets the game is offering (2–4), then compare — ranked by <b>🎯 run-fit</b> (how well each matches the board you're building) blended with real win rates, not WR alone.</div>
        <div class="offers" id="gc-tray" style="min-height:34px"></div>
        <div id="gc-result"></div>
        <input type="text" id="gc-q" placeholder="Search trinkets…" style="width:100%;margin:10px 0">
        <div class="band-items" id="gc-grid" style="max-height:320px;overflow-y:auto"></div>`;
      const tray = box.querySelector('#gc-tray');
      sel.forEach((id, i) => {
        const t = D.trinkets.find(x => x.id === id);
        const ch = el('div', 'offer-chip');
        ch.innerHTML = `<img class="sprite" src="${spr(t.sprite)}" style="width:22px;height:22px"><div style="font-size:11px">${esc(t.name)}</div><span class="x">×</span>`;
        ch.querySelector('.x').onclick = () => { sel.splice(i, 1); render(); };
        tray.appendChild(ch);
      });
      if (sel.length >= 2) score(); else box.querySelector('#gc-result').innerHTML = '<div class="note" style="margin:4px 0">Add at least 2 options to compare.</div>';
      const drawGrid = (q) => {
        const grid = box.querySelector('#gc-grid');
        grid.innerHTML = '';
        D.trinkets.filter(t => !sel.includes(t.id) && (!q || t.name.toLowerCase().includes(q)))
          .sort((a, b) => ((b.stats || {}).winRate || 0) - ((a.stats || {}).winRate || 0))
          .forEach(t => {
            const c = el('div', 'tier-item');
            c.innerHTML = `<img class="sprite" src="${spr(t.sprite)}"><div>
              <div style="font-size:12px;font-weight:600">${esc(t.name)}</div>
              <div class="pr">${t.stats ? t.stats.winRate + '% WR' : ''} · <span style="color:${(t.rarity || {}).color || 'var(--muted)'}">${esc((t.rarity || {}).label || '')}</span></div></div>`;
            c.onclick = () => { if (sel.length < 4) { sel.push(t.id); render(); } };
            grid.appendChild(c);
          });
      };
      box.querySelector('#gc-q').oninput = (e) => drawGrid(e.target.value.toLowerCase().trim());
      drawGrid('');
    };
    const score = () => {
      const ctx = { board: live.board, day: live.day, lives: live.lives, ownedTrinkets: (live.trinkets || []).length };
      const rows = sel.map(id => {
        const t = D.trinkets.find(x => x.id === id);
        const chips = [];
        // 1) RUN-FIT — the dominant signal: how well it matches the board you're building
        const fit = trinketRunFit(t, ctx);
        chips.push(`🎯 fit ${Math.round(fit.score * 100)}% — ${fit.why}`);
        // 2) WR as a PRIOR (winners'-sample bias clusters most trinkets ~55–70, so it's weak)
        const wr = (t.stats || {}).winRate || 55;
        const h = held[id];
        const wrPrior = (h && h.rounds >= 60) ? (wr + h.winRate) / 2 : wr;
        let v = 0.55 * wrPrior + 45 * fit.score; // fit carries the ranking, WR anchors it
        if (t.stats) chips.push(`${t.stats.winRate}% global WR${h && h.rounds >= 60 ? ` · ${h.winRate}% held@Master` : ''}`);
        // 3) crawl board-combo lift — real co-occurrence WR with YOUR exact units, when sampled
        const bc = bestBoardTrinketCombo(id, boardIds);
        if (bc) { v += Math.min(Math.max(bc.lift, -5), 12); chips.push(`+${bc.lift}pp with ${bc.ids.map(x => (monById[x] || { name: x }).name).join('+')} (crawl)`); }
        // 4) pairs with a trinket you already hold
        for (const owned of live.trinkets) {
          const p = (((window.SYNERGY || {}).trinketSets || {})['2'] || []).find(s => s.ids.includes(owned) && s.ids.includes(id));
          if (p) { v += Math.min(Math.max(p.lift, -4), 10) * 0.6; chips.push(`pairs w/ your ${esc((D.trinkets.find(x => x.id === owned) || {}).name)}: ${p.winRate}%`); break; }
        }
        if (t.isUnique && live.trinkets.includes(id)) { v -= 60; chips.push('⚠️ UNIQUE — you already hold one'); }
        return { t, v, fit, chips };
      }).sort((a, b) => b.v - a.v);
      const max = Math.max(...rows.map(r => r.v), 1);
      box.querySelector('#gc-result').innerHTML = rows.map((r, i) => `
        <div class="result-card ${i === 0 ? 'top' : ''}" style="grid-template-columns:46px 1fr 84px;padding:9px 12px;margin:8px 0 0">
          <img class="sprite" src="${spr(r.t.sprite)}" style="width:40px;height:40px">
          <div><div class="name" style="font-size:13px">${i === 0 ? '👉 ' : ''}${esc(r.t.name)}${i === 0 ? ' <span class="chip good" style="font-size:9px">TAKE THIS</span>' : ''}</div>
          <div class="chips">${r.chips.slice(0, 3).map(c => `<span class="chip" style="font-size:10px">${c}</span>`).join('')}</div></div>
          <div style="text-align:right"><div class="pct ${i === 0 ? 'p90' : 'p0'}"><div class="big" style="font-size:19px">${Math.round((r.v / max) * 100)}%</div></div>
          <button class="ghost gc-take" data-id="${r.t.id}" style="font-size:10px;padding:2px 8px;margin-top:3px">✓ took it</button></div>
        </div>`).join('');
      box.querySelectorAll('.gc-take').forEach(b => b.onclick = () => {
        live.trinkets.push(b.dataset.id); // duplicates are legal for non-unique trinkets
        live.hp = suggestedHP(live.day);
        saveLive(); closeModal(); renderLive();
      });
    };
    render();
    openModal(box);
  }

  // ---------------- LIVE GAME SYNC (run_save.json) ----------------
  // The game writes its run state as PLAIN JSON on every action — the server
  // exposes it at /api/live-run and the cockpit mirrors it automatically.
  // save_seq changes on every in-game action → cheap change detection.
  let lastSyncKey = null, syncStatus = 'off'; // off | live | norun | err
  let norunStreak = 0; // consecutive save-absent observations (debounces transient mid-write vanishes → no false run-end)
  const syncEnabled = () => localStorage.getItem('bc_sync') === '1';
  function mapPermBuffs(pb) {
    if (!pb || typeof pb !== 'object' || !Object.keys(pb).length) return undefined;
    // the save keys buffs by STAT ENUM. VERIFIED live: 1=damage (Cake {"1":5};
    // Alpinine {"1":40,"3":40}), 3=shield, 4=burn (Magmite {"1":8,"4":10,"10":0.48}),
    // and **10=cooldown-speed as a FRACTION** (Boomagon that ate +CDS shows
    // {"10":0.56} → base 6.0s ÷ 1.56 = 3.8s in-game, matching the tooltip).
    // Cooldown-speed is NOT key 0 (that earlier guess was never seen live).
    // 2/5/6/7 stay on wiki order (heal/poison/shock/multicast) pending live proof.
    const ENUM = { 1: 'dmg', 2: 'heal', 3: 'shield', 4: 'burn', 5: 'poison', 6: 'shock', 7: 'mc', 10: 'cds' };
    const f = { dmg: 0, cds: 0, heal: 0, shield: 0, burn: 0, poison: 0, shock: 0, mc: 0 };
    const unknown = [];
    for (const [k, vRaw] of Object.entries(pb)) {
      const v = +vRaw || 0;
      if (ENUM[k] != null) {
        if (ENUM[k] === 'cds') f.cds += Math.round(v * 1000) / 10; // key-10 CDS is ALWAYS a fraction → ×100 (the old v<=1 guard misread >100% CDS as ~1%)
        else f[ENUM[k]] += v;
      } else if (/^(damage|dmg)$/.test(k)) f.dmg += v;
      else if (/^(cooldown_speed|cds)$/.test(k)) f.cds += v;
      else unknown.push(k);
    }
    if (unknown.length) console.log('[game-sync] unmapped perm_buffs keys — please report these so they can be modelled:', unknown, pb);
    return Object.values(f).some(v => v) ? f : undefined;
  }
  function applyGameSave(d) {
    const mapUnit = (u) => {
      if (!u || !u.species_id || !monById[u.species_id]) return null;
      const m = { monsterId: u.species_id, level: Math.min(u.level || 1, 4), shiny: !!u.is_shiny, feed: mapPermBuffs(u.perm_buffs) };
      // event-granted extra types (e.g. genius event → +Electric). Save stores them
      // as bare ids under `extra_types`; effMon/slotTypes merge them into displays,
      // trinket scoping, donor filters, type-count synergies and the battle sim.
      if (Array.isArray(u.extra_types) && u.extra_types.length) m.extraTypes = u.extra_types.filter(t => typeof t === 'string');
      // 🥚 eggs carry their hatch clock in the blackboard (hatch_turns counts
      // down each round; target_species_id names what emerges). Capture it so
      // every panel knows a body is arriving and WHAT it is.
      const bb = u.blackboard || {};
      if (bb.hatch_turns != null || bb.target_species_id) {
        m.hatch = { turns: Math.max(0, +bb.hatch_turns || 0), into: bb.target_species_id || null };
      }
      return m;
    };
    // snapshot BEFORE overwrite — day transitions auto-record the battle result
    const prev = {
      day: live.day, wins: live.badges, lives: live.lives, gold: live.gold, runId: live.syncRunId,
      // slot + feed preserved → calibration replays keep REAL positions/perm-buffs
      board: live.board.map((s, i) => s && ({ id: s.monsterId, lvl: s.level, shiny: s.shiny, slot: i, feed: s.feed || undefined })).filter(Boolean),
      shopIds: live.shop.map(o => o.monsterId), // for decision grading diffs
      itemIds: (live.shopItems || []).slice(),
      ownedCounts: [...live.board, ...(live.bench || [])].filter(Boolean).reduce((a, s) => (a[s.monsterId] = (a[s.monsterId] || 0) + 1, a), {}),
    };
    // ⚔️ BATTLE SYNC: when the game has matched an opponent, their real board
    // rides along in the save — the Brain sims the ACTUAL matchup, not the
    // day-average. Shape is defensive: units may sit under team/board/monsters.
    const pbo = d.pending_battle_opponent;
    if (pbo && typeof pbo === 'object' && Object.keys(pbo).length) {
      const rawUnits = Array.isArray(pbo.team) ? pbo.team : Array.isArray(pbo.board) ? pbo.board : Array.isArray(pbo.monsters) ? pbo.monsters : Array.isArray(pbo.units) ? pbo.units : null;
      if (rawUnits) {
        live.enemyBoard = {
          units: Array.from({ length: 6 }, (_, i) => mapUnit(rawUnits[i])),
          trinkets: (pbo.trinket_ids || pbo.trinkets || []).filter(id => typeof id === 'string'),
          name: String(pbo.display_name || pbo.name || '').slice(0, 40),
          mmr: +pbo.mmr || null,
          round: +d.round || live.day,
        };
      } else {
        // unknown layout — log once so the mapping can be fixed fast
        console.log('[battle-sync] unmapped pending_battle_opponent shape — please report this so the mapping can be fixed:', JSON.stringify(pbo).slice(0, 600));
      }
    }
    // drop any cached opponent that isn't for the CURRENT round — a captured
    // opponent is valid ONLY on its own battle day. The old `< round-1` slack let
    // yesterday's opponent (round N) linger through day N+1 (N ≥ (N+1)−1), and a
    // round-counter DROP on a new run (12 → 1) slipped through entirely. Exact
    // match handles day-advance, a fresh matchup, and cross-run reset in one line.
    if (live.enemyBoard && live.enemyBoard.round !== (+d.round || live.day)) live.enemyBoard = null;
    live.day = Math.max(+d.round || 1, 1);
    live.gold = +d.gold || 0;
    live.lives = +d.lives >= 0 ? +d.lives : live.lives;
    // losses shown = lives LOST = maxLives − current (matches the hearts you can
    // see). Track the run's peak lives; current is d.lives. Deriving from cumulative
    // life-DROPS over-counted badly when lives oscillate (Second Chance / +life
    // events replay drops), e.g. a 2-loss champion showing 9L. Reset per run below.
    live.maxLives = Math.max(live.maxLives || 0, +d.lives >= 0 ? +d.lives : 0);
    live.badges = +d.wins || 0; // 10 = champion, but endless/extended mode keeps stacking (x11, x12…) — show the real count
    live.shopRank = Math.min(Math.max(+d.shop_rank || 1, 1), 14);
    if (d.trainer_id && D.trainers.some(t => t.id === d.trainer_id)) live.trainerId = d.trainer_id;
    // trainer-select screen: the save exposes the offered trainers (ids match
    // D.trainers exactly). Capture them so the advisor recommends AMONG the 3
    // you're actually shown, not the whole roster. Cleared once you've picked.
    live.trainerOffers = Array.isArray(d.pending_trainer_options) && d.pending_trainer_options.length
      ? d.pending_trainer_options.filter(id => D.trainers.some(t => t.id === id)) : (live.trainerId ? null : live.trainerOffers || null);
    // ORIENTATION — the save's team[] is a 180° rotation of our grid: app slot i
    // shows team[5−i]. Pinned from an EXPLICIT in-game layout with level-distinct
    // Magmites (L1 vs L2) as the tiebreaker — his TL=team[5] … BR=team[0], a
    // clean reverse. (An earlier same-session "re-derivation" to an irregular
    // permutation came from a time-mismatched pair while he played — reverted.)
    live.board = Array.from({ length: 6 }, (_, i) => mapUnit((d.team || [])[5 - i]));
    live.bench = Array.from({ length: 4 }, (_, i) => mapUnit((d.bench || [])[i]));
    live.shop = (d.shop_content || []).filter(o => o && typeof o === 'object' && o.species_id && monById[o.species_id])
      .map(o => ({ monsterId: o.species_id, level: Math.min(o.level || 1, 4), shiny: !!o.is_shiny }));
    live.shopItems = (d.shop_content || []).filter(o => typeof o === 'string' && D.items.some(it => it.id === o));
    // 🎲 POOL TRACKING: count species appearances across this run's DISTINCT
    // shops (rerolls + new days). A shop whose id-multiset is a SUBSET of the
    // previous one is just a purchase, not a fresh roll — don't recount it.
    {
      const ids = live.shop.map(o => o.monsterId).sort();
      const prevIds = live._lastShopIds || [];
      const cnt = (arr) => arr.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {});
      const nc = cnt(ids), pc = cnt(prevIds);
      const isSubset = ids.length > 0 && Object.keys(nc).every(k => nc[k] <= (pc[k] || 0));
      if (ids.length && !isSubset) {
        live.shopSeen = live.shopSeen || { shops: 0, counts: {} };
        live.shopSeen.shops++;
        Object.keys(nc).forEach(k => { live.shopSeen.counts[k] = (live.shopSeen.counts[k] || 0) + nc[k]; });
      }
      live._lastShopIds = ids;
    }
    // 🧠 DECISION GRADING (chess.com-style, on decision-TIME snapshots): a
    // same-day sync diff tells us what the player just did; lastShopRanks
    // holds what the brain said the moment before. Conservative: only clear
    // BUY (gold drop ≈ a vanished offer's cost) and REROLL (−$3, shop swap).
    if (live.day === prev.day && prev.runId === live.syncRunId && prev.shopIds && prev.shopIds.length && lastShopRanks) {
      const goldDrop = (prev.gold || 0) - live.gold;
      const cAll = (arr) => arr.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {});
      const pcD = cAll(prev.shopIds), ncD = cAll(live.shop.map(o => o.monsterId));
      const removed = Object.keys(pcD).filter(k => (ncD[k] || 0) < pcD[k]);
      if (goldDrop > 0 && removed.length) {
        let logged = false;
        for (const id of removed) {
          const m = monById[id];
          const rk = lastShopRanks.byId[id];
          if (m && rk && Math.abs(goldDrop - m.cost) <= 5) {
            logRun('decision', `🛒 bought ${m.name} — brain rank #${rk.rank} (${rk.pct}%)${rk.rank === 1 ? ' ✓ top pick' : rk.gap >= 30 ? ` · ${rk.gap}% below the top pick` : ''}`);
            logged = true;
            break; // one clear buy per sync tick
          }
        }
        if (!logged && goldDrop === REROLL_COST && removed.length >= 2 && lastRerollVerdict) {
          logRun('decision', `🎲 rerolled — brain said ${lastRerollVerdict}${/REROLL/.test(lastRerollVerdict) ? ' ✓ aligned' : ''}`);
        }
        // 🧪 ITEM BUY: an item left the shop with a matching gold drop
        if (!logged) {
          const goneItems = (prev.itemIds || []).filter(id => !(live.shopItems || []).includes(id));
          for (const iid of goneItems) {
            const it = D.items.find(x => x.id === iid);
            if (it && Math.abs(goldDrop - itemCost(it)) <= 5 && lastItemAdvice[iid]) {
              const adv = lastItemAdvice[iid];
              logRun('decision', `🧪 bought item ${it.name} — advice said ${adv}${adv === 'BUY' ? ' ✓ aligned' : adv === 'SKIP' ? ' · against advice' : ''}`);
              break;
            }
          }
        }
      } else if (goldDrop < 0 && lastSellSnapshot) {
        // 💰 SELL: gold rose same-day and an owned species count dropped
        const nowCounts = [...live.board, ...(live.bench || [])].filter(Boolean).reduce((a, s) => (a[s.monsterId] = (a[s.monsterId] || 0) + 1, a), {});
        const soldId = Object.keys(prev.ownedCounts || {}).find(k => (nowCounts[k] || 0) < prev.ownedCounts[k]);
        if (soldId && monById[soldId]) {
          const wasCut = soldId === lastSellSnapshot.cutId;
          const wasProt = (lastSellSnapshot.protected || []).includes(soldId);
          logRun('decision', `💰 sold ${monById[soldId].name}${wasCut ? ' ✓ the recommended cut' : wasProt ? ' ⚠️ was PROTECTED (plan/engine piece)' : ''}`);
        }
      }
    }
    live.trinkets = (d.trinket_ids || []).filter(id => D.trinkets.some(t => t.id === id));
    live.shopLocked = !!d.is_shop_frozen_next_round;
    if (d.has_used_second_chance && live.lives <= 1) live.trainerData.secondChance = true;
    if (typeof d.free_rerolls === 'number') live.trainerData.freeRerolls = d.free_rerolls;
    // 🎪 the NEXT event the game has queued — advise on it a turn EARLY (no other
    // tool knows your upcoming event). pending = imminent (this/next round); queued
    // = further out. Blank string when none.
    live.pendingEvent = d.pending_event_id || null;
    live.queuedEvent = d.queued_event_id || null;
    if (d.blackboard) { // trainer flags live in the run blackboard (best-effort)
      const bugKey = Object.keys(d.blackboard).find(k => /bug/i.test(k));
      if (bugKey != null) live.trainerData.bugBought = !!d.blackboard[bugKey];
      // item economy: uses left today (Berroon raises the limit) — advice depends on it
      live.itemUses = {
        used: +d.blackboard.items_bought_this_round || 0,
        max: +d.blackboard.max_items_per_round || 1,
      };
      // 🧪 Chemist scaling poison — the save tracks the CURRENT bonus magnitude
      // directly ("Toxic monsters +1 Poison, +1 per ANY level-up"). Auto-syncs the
      // manual "Level-ups" counter so his Toxic units' poison is modeled without him
      // hand-counting. Only present on Chemist runs. Was previously unmodeled.
      if (typeof d.blackboard.toxic_passive_bonus_count === 'number') {
        live.trainerData.toxicPoison = d.blackboard.toxic_passive_bonus_count;
        live.trainerData.levelUps = Math.max(0, d.blackboard.toxic_passive_bonus_count - 1);
      }
    }
    live.hp = suggestedHP(live.day); // HP isn't in the save — model + your corrections
    // 🎖 RANKED EXTRACTION — hunt for rank/MMR fields in the run save. The
    // meta save (session.save) is ENCRYPTED and off-limits, so this scans the
    // plaintext run save defensively: any key that smells like ranked data is
    // captured verbatim, and unknown top-level keys are logged ONCE so new
    // fields get discovered the day berrymint adds them.
    {
      const RANKISH = /^(mmr|elo|rank|rank_points|ranked|rating|rp|tier|division|stars|league|ladder)/i;
      const found = {};
      for (const [k, v] of Object.entries(d)) {
        if (RANKISH.test(k) && (typeof v === 'number' || typeof v === 'string')) found[k] = v;
      }
      if (d.blackboard) for (const [k, v] of Object.entries(d.blackboard)) {
        if (RANKISH.test(k) && (typeof v === 'number' || typeof v === 'string')) found['bb.' + k] = v;
      }
      if (Object.keys(found).length) live.ranked = Object.assign({}, found, { at: Date.now(), src: 'save' });
      // is_ranked / faced_opponent_mmrs don't start with a RANKISH word but ARE the
      // real ranked signals. is_ranked = detect the ranked run (tier/stars stay in
      // the encrypted meta save — can't read those). faced_opponent_mmrs: matchmaking
      // pairs similar ratings, so the opponents' average ≈ YOUR MMR — capture it when
      // the game populates it (empty on early rounds / may stay server-side).
      live.isRanked = !!d.is_ranked;
      const oppMmrs = (d.faced_opponent_mmrs || []).map(Number).filter(m => m > 0);
      if (oppMmrs.length) localStorage.setItem('bc_mmrEst', JSON.stringify({ n: oppMmrs.length, sum: oppMmrs.reduce((a, b) => a + b, 0) }));
      // Keep the individual samples, not just the mean. A mean CANNOT show whether
      // the ladder actually pairs you with your own rank — a Silver who faces two
      // Golds and two Bronzes averages to "Silver" and looks perfectly matched.
      // The SPREAD is the evidence, so retain it (capped, local, per run_id so a
      // re-sync overwrites rather than double-counts).
      if (oppMmrs.length) {
        try {
          const key = 'bc_mmrSamples';
          let all = JSON.parse(localStorage.getItem(key) || '[]');
          if (!Array.isArray(all)) all = [];
          const rid = d.run_id || live.syncRunId || 'local';
          all = all.filter(s => s && s.run !== rid);              // re-sync → replace this run's samples
          oppMmrs.forEach(m => all.push({ m, run: rid, day: +d.round || live.day }));
          localStorage.setItem(key, JSON.stringify(all.slice(-400))); // cap: plenty for a distribution
        } catch (e) {}
      }
      // 🎖 per-rank MMR ANCHOR: pin this run's opponent MMRs to the rank you're at so
      // the (wrong) low-tier bands self-calibrate over a few ranked runs. Keyed by
      // run_id → re-syncs OVERWRITE (never double-count); needs your manual rank set
      // (the save can't expose rank — encrypted). Aggregated by learnedMMRForRank.
      if (d.is_ranked && oppMmrs.length && d.run_id) {
        try {
          const mr = JSON.parse(localStorage.getItem('bc_rankmanual') || 'null');
          if (mr && mr.tier) {
            const anchors = JSON.parse(localStorage.getItem('bc_rankAnchors') || '{}');
            anchors[d.run_id] = { idx: rankToIndex(mr), n: oppMmrs.length, sum: oppMmrs.reduce((a, b) => a + b, 0), at: Date.now() };
            const ks = Object.keys(anchors);
            if (ks.length > 60) { ks.sort((a, b) => (anchors[a].at || 0) - (anchors[b].at || 0)); delete anchors[ks[0]]; }
            localStorage.setItem('bc_rankAnchors', JSON.stringify(anchors));
          }
        } catch (e) {}
      }
      const KNOWN_SAVE_KEYS = new Set(['save_seq', 'save_version', 'set_id', 'run_id', 'gold', 'round', 'lives', 'wins', 'shop_rank', 'trainer_id', 'team', 'bench', 'shop_content', 'trinket_ids', 'is_shop_frozen_next_round', 'blackboard', 'pending_battle_opponent', 'overflow', 'item_state']);
      const unknown = Object.keys(d).filter(k => !KNOWN_SAVE_KEYS.has(k));
      if (unknown.length && localStorage.getItem('bc_keylog') !== unknown.join(',')) {
        localStorage.setItem('bc_keylog', unknown.join(','));
        console.log('[game-sync] NEW top-level save keys — please report (possible rank/MMR fields):', unknown.map(k => `${k}=${JSON.stringify(d[k]).slice(0, 60)}`));
      }
      // 🎖 MMR inference from synced opponents (matchmaking pairs similar MMR):
      // rolling sample once battle-sync populates pending_battle_opponent.
      if (live.enemyBoard && live.enemyBoard.mmr) {
        let est = { n: 0, sum: 0 }; try { est = JSON.parse(localStorage.getItem('bc_mmrEst') || '{"n":0,"sum":0}') || est; } catch (e) {}
        est.n++; est.sum += live.enemyBoard.mmr;
        localStorage.setItem('bc_mmrEst', JSON.stringify(est));
      }
    }
    // run identity + automatic battle history (sync replaces ✓/✗ clicks entirely)
    if (d.run_id && d.run_id !== live.syncRunId) {
      const hadRun = !!live.syncRunId;
      if (hadRun) archiveRun(); // 🏆 snapshot the finished run into Game History before wiping
      live.syncRunId = d.run_id;
      if (hadRun) { live.history = []; live.runLog = []; live.trainerData = {}; live.strategy = null; live.strategies = []; live.posTarget = null; live.shopSeen = null; live._lastShopIds = []; live.maxLives = 0; live.enemyBoard = null; } // NEW run — plan + learned HP curve survive on purpose
    } else if (live.day > prev.day && prev.board.length) {
      // WON = a badge was earned since the last RECORDED day — NOT since the last
      // sync. The game writes the badge bump and the day-advance in separate saves,
      // so comparing to prev-sync (prev.wins) saw "no change" and logged every day
      // as a loss (the "day-by-day shows only losses" bug). Anchor on the last
      // history entry's post-badges instead, which is robust to sync granularity.
      const lastBadges = (live.history[0] && live.history[0].after) ? live.history[0].after.badges : 0;
      const won = live.badges > lastBadges;
      live.history.unshift({
        day: prev.day, won, board: prev.board,
        badges: prev.wins, lives: prev.lives, gold: prev.gold,
        income: Math.max(live.gold - prev.gold, 0),
        after: { badges: live.badges, lives: live.lives, gold: live.gold },
        // the LIVE model's prediction for this battle (full feeds/positions/
        // trinkets — unlike replays), for true calibration over time
        pred: lastPrediction && lastPrediction.day === prev.day && lastPrediction.forRun === (live.syncRunId || null) ? lastPrediction.win : null,
      });
      live.history = live.history.slice(0, 40);
      // 🌐 community ingestion (OPT-IN, dormant until v1): contribute this
      // battle's anonymized snapshot so everyone's stats sharpen over time
      if (localStorage.getItem('bc_ingest') === '1') {
        fetch('/api/ingest', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            run: (live.syncRunId || '').replace(/[^a-z0-9]/gi, '').slice(-24),
            day: prev.day, won, trainer: live.trainerId || '',
            badges: prev.wins, lives: prev.lives,
            board: prev.board.map(b => ({ id: b.id, lvl: b.lvl, shiny: b.shiny })),
            trinkets: live.trinkets,
            // observed-shop counts → community pool-size estimation at v1
            shops: live.shopSeen ? { n: live.shopSeen.shops, c: Object.fromEntries(Object.entries(live.shopSeen.counts).slice(0, 60)) } : undefined,
          }),
        }).catch(() => {});
      }
    }
    if (live.posTarget && live.posTarget.day !== live.day) live.posTarget = null; // new day = new positioning problem
    if (live.posTarget && live.posTarget.preview) live.posTarget.preview = false; // a real game push arrived — compare against reality now
    // 🏆 run just ENDED this sync (died or hit 10 badges) → archive it now so
    // Game History has it even before a fresh run overwrites the state.
    const endedNow = (prev.lives > 0 && live.lives <= 0) || (prev.wins < 10 && live.badges >= 10);
    if (endedNow) {
      archiveRun(); live.runEnded = { result: runResult(), day: live.day, badges: live.badges, losses: Math.max((live.maxLives || 3) - live.lives, 0), forRun: live.syncRunId };
      if (live.isRanked) { const _ap = autoApplyRankedResult(live.badges, live.syncRunId || ('local-' + live.day + '-' + live.badges)); if (_ap) bcNotify('🎖 Rank updated', (_ap.delta >= 0 ? '+' : '') + _ap.delta + '★ → ' + rankStr(_ap.to)); }
      bcNotify(live.badges >= 10 ? '🏆 Champion run archived!' : '💀 Run ended — archived', `Day ${live.day} · ${live.badges} badges. Full breakdown in Game History.`);
    }
    else if (live.lives > 0 && live.badges < 10) live.runEnded = null;
    // 🔔 power-spike heads-up, once per day, only when it's big and imminent
    if (live.day > prev.day) {
      const a = baseHPFor(live.day), b = baseHPFor(live.day + 1);
      const jump = Math.round((b / Math.max(a, 1) - 1) * 100);
      if (jump >= 18 && localStorage.getItem('bc_lastSpikeNotif') !== String(live.day)) {
        localStorage.setItem('bc_lastSpikeNotif', String(live.day));
        bcNotify('📅 Power spike tomorrow', `Enemy HP jumps +${jump}% on day ${live.day + 1} (→ ~${b.toLocaleString()}). Get merges/evolutions online today.`);
      }
    }
  }
  function handleRunPayload(j, force) {
    if (!j || !j.exists) {
      norunStreak++;
      // DEBOUNCE: the game rewrites run_save.json on every action, so it briefly
      // vanishes mid-write — a SINGLE absence is almost always transient. Only
      // treat it as a real run-end once it persists (2nd consecutive absence; the
      // 5s backstop poll guarantees a genuine deletion reaches here). This kills
      // the false "RUN ENDED · 9🏅 · day 13" that flashed mid-run before the real
      // 10-badge win. Startup (never-live) still resolves to 'norun' immediately.
      if (norunStreak < 2 && syncStatus === 'live') return;
      if (syncStatus !== 'norun') {
        syncStatus = 'norun';
        // The save file only vanishes when a run actually ENDS (it persists
        // while a run is in progress, even with the game closed). So if we were
        // tracking a run, it's over — archive it and flag the live panel. This
        // catches deaths whose final life-loss never synced (save deleted first).
        if (live.syncRunId && !(live.runEnded && live.runEnded.forRun === live.syncRunId)) {
          // A vanished save means the run is OVER — but we only KNOW it was a
          // champion if 10 badges actually synced. The old rule inflated ANY 8–9
          // badge state that still had lives into a 10-badge champion, reasoning
          // "lives left → you didn't die → you won." That's BACKWARDS: being on your
          // LAST life when the save vanished means you LOST the final battle before
          // lives=0 could sync. It turned an 8-badge death into a FALSE champion +
          // a bogus +5★ rank (observed 2026-07-16 — died day 12 at 8🏅 on Second
          // Chance, shown as a 10-badge champion). Only infer the champion from the
          // one safe signal: exactly 9 badges with 2+ lives to spare (you won the
          // 10th and its write deleted the save first). Otherwise trust the real
          // count, and treat "last life + save gone" as the death it almost surely was.
          // Disambiguate the vanished-save run-end at 9 badges:
          //  • 9🏅 + 2+ lives → CHAMPION: a loss from 2+ lives leaves you ALIVE (the run
          //    continues, save persists), so a vanish means the 10th WIN cleared it.
          //  • 9🏅 + exactly 1 life → GENUINELY AMBIGUOUS: winning the 10th (champion)
          //    and losing it (death) BOTH leave the last-synced state {9, 1}. DON'T
          //    guess — flag it and let the banner ASK 🏆/💀 (observed 2026-07-24: won the
          //    10th FROM 1 life, was shown "died at 9" + a wrong −rank; the old blanket
          //    "<10 & ≤1 life → death" produced that false NON-champion).
          //  • anything else <10 on the last life → death (lost before the 10th battle).
          let ambiguousEnd = false;
          if (live.badges === 9 && live.lives >= 2) live.badges = 10;
          else if (live.badges === 9 && live.lives === 1) ambiguousEnd = true;
          else if (live.badges < 10 && live.lives <= 1) live.lives = 0;
          archiveRun();
          live.runEnded = { result: runResult(), day: live.day, badges: live.badges, losses: Math.max((live.maxLives || 3) - live.lives, 0), forRun: live.syncRunId };
          live.runEndedAmbiguous = ambiguousEnd ? live.syncRunId : null;
          // Only auto-apply the ranked result when the outcome is CERTAIN. Ambiguous
          // ends wait for the player's 🏆/💀 answer — never guess a rank change.
          if (live.isRanked && !ambiguousEnd) { const _ap = autoApplyRankedResult(live.badges, live.syncRunId || ('local-' + live.day + '-' + live.badges)); if (_ap) bcNotify('🎖 Rank updated', (_ap.delta >= 0 ? '+' : '') + _ap.delta + '★ → ' + rankStr(_ap.to)); }
          saveLive();
          bcNotify(ambiguousEnd ? '❓ Ended at 9🏅 on your last life' : '⏹ Run ended — archived', ambiguousEnd ? 'Champion or death? Confirm it on the Live Run card so your rank is right.' : `Day ${live.day} · ${live.badges} badges. Summary card ready in Game History.`);
        }
        renderSyncPill();
        if ($('#tab-live') && $('#tab-live').classList.contains('active')) renderLive();
      }
      return;
    }
    norunStreak = 0; // save present → clear the vanish debounce
    const key = (j.data.run_id || '') + '|' + j.data.save_seq;
    if (!force && key === lastSyncKey) { if (syncStatus !== 'live') { syncStatus = 'live'; renderSyncPill(); } return; }
    lastSyncKey = key;
    syncStatus = 'live';
    applyGameSave(j.data);
    saveLive();
    if ($('#tab-live') && $('#tab-live').classList.contains('active')) renderLive(); else renderSyncPill();
  }
  async function syncTick(force) {
    if (!syncEnabled()) return;
    try {
      const r = await fetch('/api/live-run', { cache: 'no-store' });
      handleRunPayload(await r.json(), force);
    } catch (e) { syncStatus = 'err'; renderSyncPill(); }
  }
  // primary channel: SSE push — the server watches the save file and streams
  // every change instantly (~100ms). The slow poll below is only a backstop.
  let syncES = null;
  function startSyncStream() {
    if (syncES || !syncEnabled() || typeof EventSource === 'undefined') return;
    try {
      syncES = new EventSource('/api/live-run/stream');
      syncES.onmessage = (e) => { if (!syncEnabled()) return; try { handleRunPayload(JSON.parse(e.data), false); } catch (err) {} };
      syncES.onerror = () => { /* EventSource auto-reconnects; poll covers the gap */ };
    } catch (e) {}
  }
  function stopSyncStream() { if (syncES) { try { syncES.close(); } catch (e) {} syncES = null; } }
  if (syncEnabled()) startSyncStream();
  setInterval(() => syncTick(false), 5000); // backstop poll (SSE is the fast path)
  function renderSyncPill() {
    const b = $('#lv-sync');
    if (!b) return;
    const on = syncEnabled();
    b.classList.toggle('locked', on);
    b.innerHTML = on
      ? (syncStatus === 'live' ? '🔌 Sync <b style="color:var(--green)">● LIVE</b>'
        : syncStatus === 'norun' ? '🔌 Sync <span style="color:var(--muted)">— no active run</span>'
          : syncStatus === 'err' ? '🔌 Sync <span style="color:var(--red)">⚠ server?</span>' : '🔌 Sync …')
      : '🔌 Game sync: OFF';
  }

  // ---------------- AI BATTLE BRAIN+ (Claude API via local server) ----------------
  // One click → the LIVE run state + the app's own computed advice + fresh patch
  // notes + Steam community discussions go to Claude; the answer renders in a
  // modal. The API key stays SERVER-side (env ANTHROPIC_API_KEY or tools/ai-key.txt).
  function aiContext() {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const grab = (sel, n) => [...document.querySelectorAll(sel)].slice(0, n).map(e => clean(e.textContent));
    const unitStr = (s) => s ? `${s.monsterId} L${s.level}${s.shiny ? '✨' : ''}${s.feed && (s.feed.dmg || s.feed.cds) ? ` fed(+${s.feed.dmg}dmg,+${s.feed.cds}%cds)` : ''}` : null;
    return {
      state: {
        day: live.day, gold: live.gold, lives: live.lives, badges: live.badges, teamHP: live.hp,
        shopRank: live.shopRank, trainer: live.trainerId, plan: live.plan || null, shopLocked: live.shopLocked,
        board: live.board.map(unitStr), bench: (live.bench || []).map(unitStr),
        shop: live.shop.map(o => `${o.monsterId}${o.shiny ? '✨' : ''} $${(monById[o.monsterId] || {}).cost || '?'}`),
        shopItems: live.shopItems || [], trinkets: live.trinkets,
        secondChance: !!(live.trainerData || {}).secondChance,
      },
      advice: { // what the app already computed — scraped from the live DOM
        verdict: clean((document.querySelector('#lv-advice-buy .verdict') || {}).textContent),
        buyAdviceTop: grab('#lv-advice-buy .result-card .name', 3),
        buyOrder: grab('#lv-advice-buy ol li', 8),
        packages: grab('#lv-advice-buy .pk-row', 3),
        battle: clean(([...document.querySelectorAll('#lv-advice-brain div')].map(d => d.textContent).find(t => /Expected battle/.test(t)) || '').slice(0, 400)),
        greed: clean(([...document.querySelectorAll('#lv-advice-brain .day-block')].map(d => d.textContent)[0] || '')),
        buildPath: clean(([...document.querySelectorAll('#lv-advice-brain .note')].map(n => n.textContent).find(t => t.includes('Build path')) || '')),
        positioning: grab('#lv-advice-brain ul li', 4),
      },
      // deep-dive layer: event-sim numbers + self-knowledge the model should weigh
      sim: (() => {
        const sk = streakFactor();
        const runs = loadRuns();
        const preds = runs.flatMap(r => (r.history || []).filter(h => h.pred != null && h.won != null));
        return {
          winChance: lastPrediction && lastPrediction.day === live.day ? lastPrediction.win + '%' : null,
          engine: 'event-based sim (discrete casts, burn decay ticks, shock per-hit, CDS donation events)',
          lossStreak: sk.streak, enemyScaledPct: Math.round((sk.f - 1) * 100),
          liveCalibration: preds.length >= 3 ? `${preds.filter(h => (h.pred > 50) === !!h.won).length}/${preds.length} battles called` : 'accumulating',
          shopSeen: live.shopSeen ? `${live.shopSeen.shops} shops observed this run` : null,
          lastRunRadar: runs[0] ? runRadarDims(runs[0]).map(d => `${d.k}:${d.v == null ? 'n/a' : d.v}`).join(' ') : null,
        };
      })(),
    };
  }
  function mdLite(t) { // minimal markdown → HTML for the AI answer
    return esc(t)
      .replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h4>$1</h4>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/^\s*[-•] (.*)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul style="margin:4px 0 8px 18px">$1</ul>')
      .replace(/^(\d+)\) (.*)$/gm, '<div style="margin:6px 0"><b style="color:var(--accent)">$1)</b> $2</div>')
      .replace(/^(\d+)\. (.*)$/gm, '<div style="margin:6px 0"><b style="color:var(--accent)">$1.</b> $2</div>')
      .replace(/\n\n/g, '<br>');
  }
  async function openAIAnalysis() {
    const box = el('div');
    box.style.cssText = 'max-width:720px';
    const render = (inner) => {
      box.innerHTML = `<h3>🧠 AI Battle Brain+ <span style="font-size:10px;color:var(--muted);font-weight:400">· live run + app advice + patch notes + Steam community → Claude</span></h3>${inner}
        <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
          <input type="text" id="ai-q" placeholder="Ask a follow-up about this run… (optional)" style="flex:1">
          <button class="primary" id="ai-go">🧠 Analyze</button>
        </div>
        <div class="note" style="margin:8px 0 0;font-size:10px">Costs ~$0.01–0.05 per analysis (Claude API, key stays on your machine). Community + patch context refreshes every 10 min.</div>`;
      box.querySelector('#ai-go').onclick = () => run(box.querySelector('#ai-q').value.trim());
      box.querySelector('#ai-q').onkeydown = (e) => { if (e.key === 'Enter') run(e.target.value.trim()); };
    };
    const run = async (question) => {
      render('<div class="reroll-note" style="margin:10px 0">⏳ Analyzing your run — Claude is reading the board, the app\'s advice, patch notes and community threads…</div>');
      try {
        const r = await fetch('/api/ai-analyze', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign(aiContext(), question ? { question } : {})),
        });
        const j = await r.json();
        if (j.error === 'no_key') {
          render(`<div class="reroll-note" style="border-color:var(--gold);margin:10px 0"><b>🔑 One-time setup needed</b> — the AI brain calls the Claude API and the key lives ONLY on your machine:
            <ol style="margin:8px 0 0 18px;font-size:12px">
              <li>Get an API key at <b>console.anthropic.com</b></li>
              <li>Save it as the only line of <b>batomon-companion/tools/ai-key.txt</b> (or set the <b>ANTHROPIC_API_KEY</b> env var)</li>
              <li>Restart the server (<b>node server.js</b>) and click 🧠 again</li>
            </ol></div>`);
          return;
        }
        if (j.error) { render(`<div class="reroll-note" style="border-color:var(--red);margin:10px 0">⚠️ ${esc(String(j.error))}</div>`); return; }
        render(`<div class="card" style="margin-top:10px;font-size:13px;line-height:1.55">${mdLite(j.text)}</div>
          <div class="note" style="margin:6px 0 0;font-size:10px">${esc(j.model || '')}${j.usage ? ` · ${j.usage.input_tokens} in / ${j.usage.output_tokens} out tokens` : ''}</div>`);
      } catch (e) {
        render(`<div class="reroll-note" style="border-color:var(--red);margin:10px 0">⚠️ Server unreachable — is <b>node server.js</b> running?</div>`);
      }
    };
    render('<div class="note" style="margin:10px 0">Sends your live cockpit (board, bench, shop, gold, trinkets, plan) + the app\'s computed advice + the latest patch notes + Steam community discussion titles to Claude for a second opinion on the best decision RIGHT NOW.</div>');
    openModal(box);
    run('');
  }

  // ---------------- ITEM ROLL ANALYSIS ----------------
  // Random-target items: WHO can the roll hit, at what odds, and which outcome
  // is the best / worst roll for THIS board (engine-scored). mode 'gain' = the
  // roll BUFFS the target (best = your carry); 'consume' = the roll EATS the
  // target (best = your weakest, worst = a fed/merged keeper).
  function itemRollAnalysis(id, opts) {
    // opts: {team, shop, day, trainerId, planId} — defaults = the LIVE run;
    // the Shop Advisor passes its own sandbox so nothing leaks between the two
    const o = Object.assign({ team: null, shop: live.shop, day: live.day, trainerId: effectiveTrainerId(), planId: live.plan }, Array.isArray(opts) ? { team: opts } : opts || {});
    const owned = (o.team || [...live.board, ...(live.bench || [])]).filter(Boolean);
    // build-path weight: plan pieces are worth MORE — protected from consume
    // rolls (worst outcome) and preferred by gain rolls (level the plan)
    const planB2 = o.planId && G.BUILDS.find(x => x.id === o.planId);
    const inPlan = new Set(planB2 ? [...(planB2.core || []), ...(planB2.lateCore || [])] : []);
    const pw = (m, lvl, shiny) => { try { return E.power(m, lvl, { shiny, day: o.day, team: owned, trainerId: o.trainerId }).total * (inPlan.has(m.id) ? 1.6 : 1); } catch (e) { return 0; } };
    const unitScore = (s) => pw(monById[s.monsterId], s.level, s.shiny);
    const label = (s) => (monById[s.monsterId] || {}).name + (inPlan.has(s.monsterId) ? ' 🎯' : '') + (s.feed && (s.feed.dmg || s.feed.cds) ? ' 🌱' : '') + (s.level > 1 ? ` L${s.level}` : '') + (s.shiny ? ' ✨' : '');
    const wrap = (targets, mode, why) => {
      if (!targets.length) return null;
      const chance = Math.round(1000 / targets.length) / 10;
      // consume rolls: a plan piece is ALWAYS the worst thing to lose, whatever
      // its raw power — the build path outranks the stat model here
      const sorted = targets.slice().sort((a, b) =>
        mode === 'consume' ? (((b.plan ? 1 : 0) - (a.plan ? 1 : 0)) || (b.score - a.score)) : (b.score - a.score));
      const best = mode === 'consume' ? sorted[sorted.length - 1] : sorted[0];
      const worst = mode === 'consume' ? sorted[0] : sorted[sorted.length - 1];
      const mid = sorted.filter(t => t !== best && t !== worst);
      return { targets: sorted, chance, best, worst, mid, why, mode };
    };
    switch (id) {
      case 'green_stone':
        return wrap(owned.filter(s => (monById[s.monsterId] || {}).tier === 1).map(s => ({ s, name: label(s), score: unitScore(s), plan: inPlan.has(s.monsterId) })),
          'consume', 'transforms a random Common into an Uncommon — a fed/leveled/plan one is the worst loss');
      case 'basic_candy':
        return wrap(owned.filter(s => s.level === 1 && (monById[s.monsterId] || {}).tier <= 2).map(s => ({ s, name: label(s), score: pw(monById[s.monsterId], 2, s.shiny) - unitScore(s) })),
          'gain', 'levels a random L1 Common/Uncommon — best roll = biggest L2 jump (merge/evo progress)');
      case 'rare_candy':
        return wrap(owned.filter(s => s.level === 1).map(s => ({ s, name: label(s), score: pw(monById[s.monsterId], 2, s.shiny) - unitScore(s) })),
          'gain', 'levels a random L1 (any rarity) — best roll = biggest L2 jump');
      case 'ultra_candy':
        return wrap(owned.filter(s => s.level === 3).map(s => ({ s, name: label(s), score: pw(monById[s.monsterId], 4, s.shiny) - unitScore(s) })),
          'gain', 'pushes a random L3 to L4 — best roll = biggest L4 spike');
      case 'cake':
        return wrap(owned.map(s => {
          const ld = E.levelData(monById[s.monsterId], s.level, s.shiny);
          return { s, name: label(s), score: ld ? (5 * (ld.multicast || 1)) / Math.max(ld.cooldown || 5, 0.5) : 0 };
        }), 'gain', '+5 damage to two random units — best on fast multicasters, dead on pure supports');
      case 'voucher':
        return wrap((o.shop || []).map(of => {
          const m = monById[of.monsterId];
          return m ? { s: of, name: m.name + (of.shiny ? ' ✨' : ''), score: pw(m, of.level || 1, of.shiny) } : null;
        }).filter(Boolean), 'gain', 'a random monster FROM THIS SHOP — best/worst follow the buy advice ranking');
      case 'lootbox': {
        const pool = shopPool.filter(m => m.tier === 5 && !m.isEvolvedForm).map(m => ({ m, name: m.name, score: pw(m, 1, false) }));
        return wrap(pool, 'gain', 'a random Legendary from the full pool');
      }
      case 'magic_mirror': {
        const pool = shopPool.filter(m => !m.isEvolvedForm).map(m => ({ m, name: m.name, score: pw(m, 3, false) }));
        return wrap(pool, 'gain', 'plain copy of a random L3 from the full pool');
      }
      case 'recruiting_flyer': {
        const pool = shopPool.filter(m => m.tier === 2 && !m.isEvolvedForm).map(m => ({ m, name: m.name, score: pw(m, 3, false) }));
        return wrap(pool, 'gain', 'an instant L3 of a random Uncommon');
      }
      case 'shiny_berry':
        return wrap(owned.filter(s => !s.shiny).map(s => ({ s, name: label(s), score: pw(monById[s.monsterId], s.level, true) - pw(monById[s.monsterId], s.level, false), plan: inPlan.has(s.monsterId) })),
          'gain', 'turns a RANDOM non-shiny monster shiny — best roll = biggest shiny upgrade (upgraded abilities count)');
      case 'gold_powder':
        return wrap(owned.map(s => {
          const m = monById[s.monsterId] || {};
          const abT = ((m.ability && (m.ability.description || (m.ability.byLevel || {})['1'])) || '').toLowerCase();
          return { s, name: label(s), score: /sell value/.test(abT) ? 100 : 1 };
        }), 'gain', '+20 Sell Value on a random monster — jackpot on sell-value scalers, shrug elsewhere');
      case 'black_feather':
        return wrap(owned.map(s => {
          const ld = E.levelData(monById[s.monsterId], s.level, s.shiny);
          const dmg = ld ? E.stat(ld, 'damage') : 0;
          return dmg > 0 ? { s, name: label(s), score: dmg / Math.max(ld.cooldown || 5, 0.5), plan: inPlan.has(s.monsterId) } : null;
        }).filter(Boolean), 'gain', '+1 Multicast to a random damage-dealer — best roll = your hardest hitter');
    }
    return null;
  }
  // ---------------- TARGETED / SLOT ITEMS ("on who should I put it?") ----------------
  // Berries hit whoever stands BOTTOM-RIGHT — the advice is who to put there.
  // Gains use the FULL unit pipeline (feeds merge into unitOutput → same math
  // as the Brain), weighted like the optimizer values output.
  const SLOT_ITEMS = {
    nana_berry: { feed: { cds: 5 }, label: '+5% CDS' },
    'pom berry': { feed: { dmg: 8 }, label: '+8 Dmg' },
  };
  function itemTargetAdvice(id, teamArr) {
    const spec = SLOT_ITEMS[id];
    if (!spec) return null;
    const boardArr = teamArr ? teamArr.slice(0, 6) : live.board;
    const benchArr = teamArr ? teamArr.slice(6) : (live.bench || []);
    const T = 12 + 3 * Math.min(live.day, 15);
    const W = (u) => u ? u.dps + u.heal * 0.5 + u.shield * 0.6 + u.burnApp * 1.2 + u.poisonApp * T / 2 + u.shockApp * 2 : 0;
    const gain = (s) => {
      const mergedFeed = Object.assign({ dmg: 0, cds: 0, heal: 0, shield: 0, burn: 0, poison: 0, shock: 0, mc: 0 }, s.feed);
      for (const [k, v] of Object.entries(spec.feed)) mergedFeed[k] = (mergedFeed[k] || 0) + v;
      return W(unitOutput({ ...s, feed: mergedFeed }, 0, null)) - W(unitOutput(s, 0, null));
    };
    const cands = [
      ...boardArr.map((s, i) => s && { s, zone: 'board', name: (monById[s.monsterId] || {}).name }),
      ...benchArr.map((s, i) => s && { s, zone: 'bench', name: (monById[s.monsterId] || {}).name }),
    ].filter(Boolean).map(c => ({ ...c, gain: gain(c.s) })).sort((a, b) => b.gain - a.gain);
    if (!cands.length) return null;
    const current = boardArr[5] || null; // bottom-right = our slot 5 (grid mirrors the game)
    return { spec, cands, current, isCurrentBest: !!(current && cands[0].s === current) };
  }
  function targetLineHTML(t) {
    if (!t) return '';
    const curName = t.current ? esc((monById[t.current.monsterId] || {}).name) : null;
    const best = t.cands[0];
    const runner = t.cands[1];
    return `<div style="font-size:10.5px;color:var(--muted);margin-top:2px">🎯 hits the <b>bottom-right</b> slot (${t.spec.label}) — ${
      t.isCurrentBest
        ? `<b style="color:var(--green)">use NOW</b>: ${curName} standing there is already the best target (+${Math.round(best.gain)} output)`
        : `best target: <b>${esc(best.name)}</b> (+${Math.round(best.gain)} output${best.zone === 'bench' ? ', on bench' : ''}) — ${curName ? `currently there: ${curName} → swap ${esc(best.name)} in first` : `slot is EMPTY → move ${esc(best.name)} there first`}`
    }${runner && runner.gain > 0 ? ` · runner-up: ${esc(runner.name)} (+${Math.round(runner.gain)})` : ''}</div>`;
  }
  function rollLineHTML(r) {
    if (!r) return '';
    // one eligible target = no roll at all — say exactly what will happen
    if (r.targets.length === 1) {
      return `<div style="font-size:10.5px;color:var(--muted);margin-top:2px">🎲 no roll — it WILL hit <b>${esc(r.best.name)}</b> (only eligible target) <span style="opacity:.8">(${esc(r.why)})</span></div>`;
    }
    const midTxt = !r.mid.length ? '' : r.mid.length <= 3 ? r.mid.map(t => esc(t.name)).join(', ') : `${r.mid.length} others in the middle`;
    return `<div style="font-size:10.5px;color:var(--muted);margin-top:2px">🎲 ${r.targets.length} eligible · ${r.chance}% each — <b style="color:var(--green)">best roll:</b> ${esc(r.best.name)} · <b style="color:var(--red)">worst roll:</b> ${esc(r.worst.name)}${midTxt ? ` · middle: ${midTxt}` : ''} <span style="opacity:.8">(${esc(r.why)})</span></div>`;
  }

  // ---------------- ♟️ STRATEGY BRAIN ----------------
  // Detects multi-round ENGINE plays from the live state (owned + shop + trainer
  // + run health), presents each with a worth-it verdict and an ▶ Adopt button.
  // The adopted strategy re-aims the whole stack: engine boosts its pieces &
  // food, sell advice funds it, the optimizer concentrates donations on its
  // FOCUS unit instead of maximizing raw team damage.
  const STRATEGY_LIB = [
    {
      id: 'boom_chain', icon: '⛓️', name: 'Boomagon CDS chain',
      detect: (c) => {
        const shopN = c.shopIds.filter(id => id === 'boomagon').length;
        const ownN = c.ownedIds.filter(id => id === 'boomagon').length;
        if (shopN + ownN < 1 || (!shopN && ownN < 2)) return null;
        // the chain serves whatever ENGINE you're running: under Chef, aim it
        // at the top BURN applier (CDS multiplies burn application too) — the
        // strategies COMBINE instead of competing
        const burnCarry = c.trainerId === 'pyromaniac'
          ? c.units.filter(u => u.out.burnApp > 0.8).sort((a, b) => b.out.burnApp - a.out.burnApp)[0] : null;
        const carry = burnCarry || c.carry;
        if (!carry) return null;
        return {
          score: 50 + (shopN + ownN) * 12 + (c.greedOk ? 15 : -20) + (burnCarry ? 8 : 0),
          focusId: carry.id,
          stratIds: ['boomagon'], stratTypes: [],
          detail: `${shopN ? `${shopN} in shop` : ''}${shopN && ownN ? ', ' : ''}${ownN ? `${ownN} owned` : ''} — chain them <b>behind each other, behind ${esc(carry.name)}</b>${burnCarry ? ' (your Chef BURN carry — CDS multiplies its burn application: the two engines stack)' : ''}: the back one accelerates the front one's donations, compounding permanent CDS. Once ${esc(carry.name)} sits near the ~1s floor, ROTATE the chain to the next carry, then sell the Boomagons.`,
          worth: c.greedOk,
          whyWorth: c.greedOk ? `${c.lives} ❤ + ~${c.daysLeft} battles to amortize the permanent CDS` : `${c.lives} ❤ / ~${c.daysLeft} battles left — permanent ramps don't pay if the run ends first`,
        };
      },
    },
    {
      id: 'bug_feeder', icon: '🐛', name: 'Bug feeder engine',
      detect: (c) => {
        const feeders = ['guardiant', 'cinderfly', 'shogapede'];
        const ownF = c.ownedIds.filter(id => feeders.includes(id));
        const shopF = c.shopIds.filter(id => feeders.includes(id));
        if (!ownF.length && !shopF.length) return null;
        const bugsAround = c.shopMons.filter(m => (m.types || []).some(t => t.id === 'bug')).length;
        if (!ownF.length && !bugsAround) return null;
        const fid = ownF[0] || shopF[0];
        const fName = (monById[fid] || {}).name;
        const isBugCatcher = c.trainerId === 'bug_catcher';
        return {
          score: 45 + ownF.length * 15 + bugsAround * 5 + (isBugCatcher ? 20 : 0),
          focusId: fid,
          stratIds: [...new Set([...feeders.filter(id => c.shopIds.includes(id))])], stratTypes: ['bug'],
          detail: `${ownF.length ? `you hold ${ownF.map(id => esc((monById[id] || {}).name)).join('+')}` : `${esc(fName)} in shop`} — every Bug you buy feeds it PERMANENTLY (${fid === 'guardiant' ? '+7 Dmg' : '+10% CDS'} each)${bugsAround ? `; ${bugsAround} bug${bugsAround > 1 ? 's' : ''} in this shop to feed with` : ''}${isBugCatcher ? '; Bug Catcher makes the first bug FREE every day' : ''}. Cheap bugs are FOOD — buy them even if you sell them right back.`,
          worth: c.daysLeft >= 3,
          whyWorth: c.daysLeft >= 3 ? `~${c.daysLeft} battles of compounding ahead` : 'too few battles left to compound',
        };
      },
    },
    {
      id: 'item_engine', icon: '🍰', name: 'Item-use engine (Alpinine)',
      detect: (c) => {
        const alp = c.ownedIds.find(id => {
          const m = monById[id] || {};
          return /when you use an item/i.test(JSON.stringify(m.ability || {}));
        });
        if (!alp) return null;
        const berroon = c.ownedIds.includes('berroon');
        const aName = (monById[alp] || {}).name;
        return {
          score: 55 + (berroon ? 20 : 0) + (c.itemUses ? c.itemUses.max * 5 : 0),
          focusId: alp,
          stratIds: ['berroon'], stratTypes: [],
          detail: `<b>${esc(aName)}</b> grows +Dmg &amp; Shield on EVERY item use${berroon ? ` and <b>Berroon</b> raises your daily item limit${c.itemUses ? ` (${c.itemUses.max}/day now)` : ''}` : ' — add Berroon to raise the daily item limit'}. Buy every cheap/free item, every day — even mediocre ones are ${esc(aName)} food. Level Berroon for more uses.`,
          worth: true,
          whyWorth: 'compounds every single day at almost no cost',
        };
      },
    },
    {
      id: 'shock_hits', icon: '⚡', name: 'Shock × hit-rate engine',
      detect: (c) => {
        const shockApp = c.units.reduce((a, u) => a + u.out.shockApp, 0);
        const hits = c.units.reduce((a, u) => a + u.out.hitRate, 0);
        const shockInShop = c.shopMons.filter(m => (m.levels || []).some(l => (l.stats || []).some(st => st.key === 'shock'))).length;
        if (shockApp < 0.5 && !shockInShop) return null;
        if (shockApp < 0.2) return null;
        const hitter = c.units.slice().sort((a, b) => b.out.hitRate - a.out.hitRate)[0];
        return {
          score: 40 + shockApp * 10 + hits * 6 + shockInShop * 4,
          focusId: hitter && hitter.id,
          stratIds: [], stratTypes: ['electric'],
          detail: `shock stacks never decay and EVERY direct hit cashes them (+stacks flat) — your ${shockApp.toFixed(1)} stacks/s want more <b>hits/s</b>: multicast, fast casters, CDS on ${hitter ? esc(hitter.name) : 'your hitter'}${shockInShop ? `; ${shockInShop} shock unit${shockInShop > 1 ? 's' : ''} in shop` : ''}.`,
          worth: hits >= 0.5 || shockInShop > 0,
          whyWorth: hits >= 0.5 ? `${hits.toFixed(1)} hits/s already cashing the stacks` : 'needs hitters — grab fast/multicast units first',
        };
      },
    },
    {
      id: 'poison_ramp', icon: '☠️', name: 'Poison ramp',
      detect: (c) => {
        const poisonApp = c.units.reduce((a, u) => a + u.out.poisonApp, 0);
        if (poisonApp < 0.8) return null;
        const applier = c.units.slice().sort((a, b) => b.out.poisonApp - a.out.poisonApp)[0];
        return {
          score: 35 + poisonApp * 8,
          focusId: applier && applier.id,
          stratIds: [], stratTypes: ['toxic'],
          detail: `${poisonApp.toFixed(1)} poison stacks/s that NEVER decay — the longer the fight, the harder it hits. Keep ${applier ? esc(applier.name) : 'your applier'} casting by adding sustain (heal/shield) so fights last, and Chemist-style poison boosts multiply it.`,
          worth: true,
          whyWorth: 'ramps beat tempo once fights pass ~20s',
        };
      },
    },
    {
      id: 'burn_chef', icon: '🔥', name: 'Burn engine',
      detect: (c) => {
        const isChef = c.trainerId === 'pyromaniac', isRedhead = c.trainerId === 'redhead';
        if (!isChef && !isRedhead) return null;
        const burnApp = c.units.reduce((a, u) => a + u.out.burnApp, 0);
        const magmalith = c.ownedIds.includes('magmalith') || c.shopIds.includes('magmalith');
        const fireUnits = c.units.filter(u => ((monById[u.id] || {}).types || []).some(t => t.id === 'fire')).length;
        const fireInShop = c.shopMons.filter(m => (m.types || []).some(t => t.id === 'fire')).length;
        // Chef CONVERTS single-types → any board can burn; Redhead only buffs REAL
        // Fire units, so it needs Fire bodies present/available to be a live plan.
        if (burnApp < 0.8 && !magmalith && !(isRedhead ? (fireUnits || fireInShop) : true)) return null;
        const burner = c.units.slice().sort((a, b) => b.out.burnApp - a.out.burnApp)[0];
        return {
          score: (isChef ? 38 : 34) + burnApp * 7 + (magmalith ? 12 : 0) + (isRedhead ? fireUnits * 4 : 0),
          focusId: burner && burner.id,
          stratIds: ['magmalith', 'lignite', 'blazewing', 'blixie'], stratTypes: ['fire'],
          detail: isChef
            ? `Chef gives every single-typed unit Fire +2 Burn — stack burn appliers${magmalith ? ' and <b>Magmalith</b> feeds +2 Burn to the ally ABOVE it (permanent)' : ''}. Past 2 stacks/s applied, burn RAMPS instead of holding steady.`
            : `Redhead gives your Fire monsters <b>+2 Burn every Victory, permanently</b> — a burn ENGINE that snowballs (by day ${c.day || '?'}, that's roughly +${2 * (c.wins || 0)} Burn already baked into each Fire unit). Field <b>actually-Fire</b> bodies EARLY (Redhead doesn't convert types like Chef) so each win compounds${magmalith ? '; <b>Magmalith</b> feeds +2 Burn up its column too' : ''}. Past ~2 stacks/s, burn ramps.`,
          worth: burnApp >= 1.5 || magmalith || (isRedhead && fireUnits >= 2),
          whyWorth: isRedhead
            ? (fireUnits >= 2 ? `${fireUnits} Fire units stacking +2 Burn every win` : 'field Fire units — each victory compounds their burn permanently')
            : (burnApp >= 1.5 ? `${burnApp.toFixed(1)} burn/s applied — past the 2/s ramp threshold soon` : 'Magmalith unlocks the permanent feed'),
        };
      },
    },
  ];
  function detectStrategies() {
    const owned = [...live.board, ...(live.bench || [])].filter(Boolean);
    const units = live.board.map((s, i) => s && { id: s.monsterId, name: (monById[s.monsterId] || {}).name, out: unitOutput(s, live.day, i) }).filter(x => x && x.out);
    const carryU = units.slice().sort((a, b) => b.out.perCast - a.out.perCast)[0];
    const ctx = {
      ownedIds: owned.map(s => s.monsterId),
      shopIds: live.shop.map(o => o.monsterId),
      shopMons: live.shop.map(o => monById[o.monsterId]).filter(Boolean),
      units,
      carry: carryU ? { id: carryU.id, name: carryU.name } : null,
      trainerId: effectiveTrainerId(),
      lives: live.lives, daysLeft: Math.max(10 - live.badges, 2),
      day: live.day, wins: live.badges,
      greedOk: live.lives >= 4 && Math.max(10 - live.badges, 2) >= 3,
      itemUses: live.itemUses || null,
    };
    return STRATEGY_LIB.map(st => {
      const d = st.detect(ctx);
      return d && { st, ...d };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  }
  const activeStrategy = () => live.strategy && STRATEGY_LIB.find(s => s.id === live.strategy.id) ? live.strategy : null;
  // ALL adopted & still-valid plays, primary first. activeStrategy() stays = primary,
  // so single-focus code paths (board arrangement, engine-status) keep aiming at one.
  const activeStrategies = () => (live.strategies || []).filter(s => s && STRATEGY_LIB.find(x => x.id === s.id));
  const stratFocusIds = () => new Set(activeStrategies().map(s => s.focusId).filter(Boolean));
  // static shopping profile per strategy — what the engine hunts when adopted
  const STRATEGY_WANTS = {
    boom_chain: { ids: ['boomagon'], types: [] },
    bug_feeder: { ids: ['guardiant', 'cinderfly', 'shogapede'], types: ['bug'] },
    item_engine: { ids: ['berroon'], types: [] },
    shock_hits: { ids: [], types: ['electric'] },
    poison_ramp: { ids: [], types: ['toxic'] },
    burn_chef: { ids: ['magmalith', 'lignite', 'blazewing', 'blixie'], types: ['fire'] },
  };
  function strategyCtxFields() {
    const acts = activeStrategies();
    if (!acts.length) return {};
    const ids = new Set(), types = new Set();
    for (const a of acts) { const w = STRATEGY_WANTS[a.id]; if (w) { w.ids.forEach(x => ids.add(x)); w.types.forEach(x => types.add(x)); } }
    return { stratIds: ids, stratTypes: types };
  }
  // Shared sale valuation: what a unit is really worth GIVING UP.
  //  · duplicates ×0.55 (the merge line survives losing one)
  //  · BENCHED ×0.6 — you're not fielding it: revealed preference
  //  · leveled ×1.3 (invested)
  // Protected outright: plan pieces, the adopted strategy's pieces+focus, AND
  // key units of any DETECTED worth-it engine (a Berroon powering your item
  // engine is not a cut even if that strategy isn't formally adopted), eggs.
  function protectedUnitIds() {
    const ids = new Set();
    const planB = live.plan && buildById(live.plan);
    if (planB) [...(planB.core || []), ...(planB.lateCore || [])].forEach(id => ids.add(id));
    for (const act of activeStrategies()) {
      if (act.focusId) ids.add(act.focusId);
      ((STRATEGY_WANTS[act.id] || {}).ids || []).forEach(id => ids.add(id));
    }
    for (const p of detectStrategies()) {
      if (!p.worth) continue;
      if (p.focusId) ids.add(p.focusId);
      const owned = new Set([...live.board, ...(live.bench || [])].filter(Boolean).map(s => s.monsterId));
      ((STRATEGY_WANTS[p.st.id] || {}).ids || []).forEach(id => { if (owned.has(id)) ids.add(id); });
    }
    return ids;
  }
  function saleValueOf(o, counts) { // o = {s, zone}
    let v = 0;
    try { v = E.power(monById[o.s.monsterId], o.s.level, { day: live.day, team: live.board, trainerId: effectiveTrainerId() }).total; } catch (e) {}
    return v * (counts[o.s.monsterId] >= 2 ? 0.55 : 1) * (o.s.level > 1 ? 1.3 : 1) * (o.zone === 'bench' ? 0.6 : 1);
  }

  // 🥚 every hatching egg on board or bench, with what it becomes and WHEN.
  // The game stores the countdown in hatch.turns (rounds remaining); the target
  // resolves to a real monster so the whole advisor can plan around the body.
  function incomingEggs() {
    const out = [];
    const scan = (arr, zone) => (arr || []).forEach((s, i) => {
      if (s && s.hatch) {
        const into = s.hatch.into && monById[s.hatch.into];
        out.push({ zone, idx: i, slot: s, turns: s.hatch.turns, into, intoId: s.hatch.into });
      }
    });
    scan(live.board, 'board'); scan(live.bench, 'bench');
    return out;
  }
  // Free board/bench room RIGHT NOW — every space-aware panel reads this so buy
  // order, sell advice and the egg planner never disagree about capacity.
  function boardSpace() {
    const boardUsed = live.board.filter(Boolean).length;
    const benchUsed = (live.bench || []).filter(Boolean).length;
    return { boardFree: 6 - boardUsed, benchFree: 4 - benchUsed, boardUsed, benchUsed };
  }

  // 📋 concrete ACTION PLAN for the adopted strategy: which pieces to buy from
  // THIS shop, what to sell to fund them, who to cut for room — with real
  // names and numbers, budgeted step by step.
  function strategyPlanHTML(act) {
    const w = STRATEGY_WANTS[act.id] || { ids: [], types: [] };
    const pieces = live.shop.map((o, i) => ({ o, i, m: monById[o.monsterId] }))
      .filter(x => x.m && (w.ids.includes(x.m.id) || (w.types.length && (x.m.types || []).some(t => w.types.includes(t.id)))))
      .sort((a, b) => (w.ids.includes(b.m.id) ? 1 : 0) - (w.ids.includes(a.m.id) ? 1 : 0) || a.m.cost - b.m.cost)
      .slice(0, 3);
    if (!pieces.length) return `<div class="note" style="margin:6px 0 0">📋 No strategy pieces in THIS shop — 🎲 reroll targets: ${(w.ids.length ? w.ids.map(id => esc((monById[id] || { name: id }).name) + hitOddsChip(id)) : w.types.map(t => esc(t) + ' types')).join(', ')}.</div>`;
    // sale queue: weakest sellable — shared valuation (bench/dup penalties) +
    // full protections (plan, adopted AND detected engines, eggs)
    const protectedIds = protectedUnitIds();
    const owned = [
      ...live.board.map((s, i) => s && { s, zone: 'board', label: SLOT_SHORT[i] }),
      ...(live.bench || []).map((s, i) => s && { s, zone: 'bench', label: 'bench ' + (i + 1) }),
    ].filter(Boolean);
    const counts = {};
    owned.forEach(o => { counts[o.s.monsterId] = (counts[o.s.monsterId] || 0) + 1; });
    const saleQueue = owned
      .filter(o => !protectedIds.has(o.s.monsterId) && !/egg/i.test(o.s.monsterId))
      .map(o => ({ ...o, v: saleValueOf(o, counts) }))
      .sort((a, b) => a.v - b.v);
    let gold = live.gold;
    let freeSlots = 6 + (live.bench || []).length - owned.length;
    let saleIdx = 0;
    const steps = [];
    for (const p of pieces) {
      const needRoom = !owned.some(o => o.s.monsterId === p.m.id) && freeSlots <= 0; // copies merge
      if (needRoom && saleIdx < saleQueue.length) {
        const cut = saleQueue[saleIdx++];
        steps.push(`sell <b>${esc((monById[cut.s.monsterId] || {}).name)}</b> (${cut.label}) — makes room${gold < p.m.cost ? ' and adds gold toward the next buy' : ''}`);
        freeSlots++;
      }
      if (gold >= p.m.cost) {
        gold -= p.m.cost;
        if (!owned.some(o => o.s.monsterId === p.m.id)) freeSlots--;
        steps.push(`buy <b>${esc(p.m.name)}</b> (−$${p.m.cost} → $${gold} left)`);
      } else {
        const short = p.m.cost - gold;
        if (saleIdx < saleQueue.length) {
          const cut = saleQueue[saleIdx++];
          steps.push(`⚠️ $${short} short for <b>${esc(p.m.name)}</b> — sell <b>${esc((monById[cut.s.monsterId] || {}).name)}</b> (${cut.label}) first; if the sale doesn't cover it, 🔒 lock and buy tomorrow (+$${nextIncomeL()})`);
          freeSlots++;
        } else {
          steps.push(`⚠️ $${short} short for <b>${esc(p.m.name)}</b> and nothing safe to sell — 🔒 lock the shop, tomorrow's +$${nextIncomeL()} covers it`);
        }
      }
    }
    steps.push(`🧲 <b>Optimize positioning</b> — the optimizer now concentrates the chain/donations on <b>${esc((monById[act.focusId] || { name: 'your focus' }).name)}</b>`);
    // 🥚 incoming body: fold it into the SAME plan so the strategy box agrees
    // with the 🧭 header — a hatch that soon changes the buy/cut calculus.
    incomingEggs().forEach(e => {
      const nm = e.into ? e.into.name : 'a monster';
      const when = e.turns <= 0 ? 'this round' : e.turns === 1 ? 'next round' : `in ${e.turns} rounds`;
      steps.unshift(`🥚 <b>${esc(nm)}</b> hatches ${when} (${e.zone}) — it keeps its own slot; don't sell it or buy a redundant body to replace it`);
    });
    return `<div style="margin-top:8px;padding:8px 10px;background:var(--bg2);border:1px solid rgba(61,220,132,.35);border-radius:10px">
      <b style="font-size:11px">📋 Strategy plan — do it in this order:</b>
      <ol style="margin:6px 0 0 18px;font-size:12px;display:flex;flex-direction:column;gap:4px">${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>`;
  }

  // ⚖️ WHICH PLAY TO CHASE — the reasoning layer for running 2+ strategy plays at once.
  // Classifies each pair as STACK (they amplify one another / add up as separate DoT
  // channels → run BOTH) or COMPETE (they want different bodies → pick one), then uses
  // enemyShape() to name which play the upcoming fight rewards and the concrete flip
  // condition. This is the "improve the reasoning brain" ask: two adopted engines →
  // one ordered directive.
  const AMPLIFIER_STRATS = new Set(['boom_chain', 'item_engine']); // serve whatever carry you aim them at
  const DOT_STRATS = new Set(['burn_chef', 'poison_ramp', 'shock_hits']); // additive stacks that never decay
  function stratRelation(a, b) {
    if (AMPLIFIER_STRATS.has(a) || AMPLIFIER_STRATS.has(b)) return 'amplify';
    if (DOT_STRATS.has(a) && DOT_STRATS.has(b)) return 'stack';
    return 'compete';
  }
  // which adopted play id best answers a given enemy shape (first owned match wins)
  function favoredPlayVs(kind, ids) {
    const pref = kind === 'wall' ? ['poison_ramp', 'burn_chef', 'shock_hits', 'boom_chain']
      : kind === 'glass' ? ['shock_hits', 'boom_chain', 'burn_chef']
        : kind === 'dot' ? ['item_engine', 'boom_chain', 'bug_feeder']
          : [];
    for (const p of pref) if (ids.includes(p)) return p;
    return null;
  }
  // how built-out a play is on the CURRENT board (owned key pieces + typed bodies)
  function playAssembly(id) {
    const owned = [...live.board, ...(live.bench || [])].filter(Boolean).map(s => s.monsterId);
    const w = STRATEGY_WANTS[id] || { ids: [], types: [] };
    let n = 0;
    const seen = new Set(owned);
    w.ids.forEach(x => { if (seen.has(x)) n += 1; });
    owned.forEach(mid => { const m = monById[mid] || {}; if ((m.types || []).some(t => w.types.includes(t.id))) n += 0.5; });
    return n;
  }
  function multiStrategyBrainHTML() {
    const acts = activeStrategies();
    if (acts.length < 2) return '';
    const nm = id => (STRATEGY_LIB.find(s => s.id === id) || {}).name || id;
    const ic = id => (STRATEGY_LIB.find(s => s.id === id) || {}).icon || '♟️';
    const shape = enemyShape();
    const ids = acts.map(a => a.id);
    const prim = acts[0].id;
    const kindLabel = { wall: 'sustain wall', dot: 'DoT rush', glass: 'glass cannon', balanced: 'balanced' };

    // enemy-context line — which adopted play the fight you're walking into rewards
    let enemyLine = '';
    if (shape) {
      const fav = favoredPlayVs(shape.kind, ids);
      if (shape.synced) {
        enemyLine = `🎯 <b>${esc(shape.label)}</b> is a <b>${kindLabel[shape.kind]}</b>${fav ? ` → this fight rewards <b>${ic(fav)} ${esc(nm(fav))}</b>${fav !== prim ? ' — <b>★ make it primary</b> for this battle' : ' (already primary ✓)'}` : ' — neither play hard-counters it; steer your most-assembled one'}.`;
      } else if (shape.spread) {
        const parts = [];
        const wallP = Math.round((shape.spread.wall || 0) * 100), glassP = Math.round((shape.spread.glass || 0) * 100);
        if (wallP >= 15) { const f = favoredPlayVs('wall', ids); if (f) parts.push(`${wallP}% are <b>sustain walls</b> → keep <b>${esc(nm(f))}</b> as the flex (out-races heal)`); }
        if (glassP >= 15) { const f = favoredPlayVs('glass', ids); if (f) parts.push(`${glassP}% are <b>glass cannons</b> → <b>${esc(nm(f))}</b> punishes them`); }
        enemyLine = parts.length ? `🎲 Today's field: ${parts.join('; ')}.` : '';
      }
    }

    // primary vs each secondary: run-both (amplify/stack) or a chase/flip decision
    const relRows = acts.slice(1).map(a => {
      const rel = stratRelation(prim, a.id);
      if (rel === 'amplify') {
        const amp = AMPLIFIER_STRATS.has(prim) ? prim : a.id;
        const carry = amp === prim ? a.id : prim;
        return `<div style="margin-top:6px">🔗 <b>${esc(nm(amp))}</b> <b style="color:var(--green)">amplifies</b> <b>${esc(nm(carry))}</b> — <b>run both</b>: point ${esc(nm(amp))}'s ${amp === 'boom_chain' ? 'CDS chain' : 'item feed'} at ${esc(nm(carry))}'s carry. They compound, not compete.</div>`;
      }
      if (rel === 'stack') {
        return `<div style="margin-top:6px">➕ <b>${esc(nm(prim))}</b> + <b>${esc(nm(a.id))}</b> are <b style="color:var(--green)">separate DoT channels</b> — <b>run both</b>: stacks add and never decay, so the combined ramp beats either alone. Field appliers for each.</div>`;
      }
      const aP = playAssembly(prim), aS = playAssembly(a.id);
      const lead = aP >= aS ? prim : a.id, trail = lead === prim ? a.id : prim;
      // flip is advised when the enemy shape is countered by the TRAIL (the one we'd flip to), not the lead
      const favFlip = shape && favoredPlayVs(shape.kind, [trail]) === trail && favoredPlayVs(shape.kind, [lead]) !== lead;
      return `<div style="margin-top:6px">⚔️ <b>${esc(nm(prim))}</b> vs <b>${esc(nm(a.id))}</b> <b style="color:var(--gold)">compete</b> for slots — <b>chase ${esc(nm(lead))}</b> now (${lead === prim ? 'your primary; ' : 'more assembled: '}${Math.max(aP, aS).toFixed(1)} vs ${Math.min(aP, aS).toFixed(1)} pieces). <b>Flip to ${esc(nm(trail))}</b> if ${favFlip ? `you're facing a <b>${kindLabel[shape.kind]}</b> (it counters better), ` : ''}you draw its key body, or ${esc(nm(lead))} tops out.</div>`;
    });

    return `<div style="margin-top:10px;padding:9px 11px;background:var(--bg2);border:1px solid rgba(90,162,255,.45);border-radius:10px">
      <b style="font-size:11.5px;color:#9ecbff">⚖️ Which play to chase</b>
      <span style="font-size:10px;color:var(--muted)"> · running ${acts.length} plays — primary ${ic(prim)} <b>${esc(nm(prim))}</b> steers the optimizer</span>
      ${enemyLine ? `<div class="note" style="margin:6px 0 0">${enemyLine}</div>` : ''}
      ${relRows.join('')}
      <div class="note" style="font-size:10px;margin-top:8px;color:var(--muted)">Board arrangement + buy focus aim at your <b>primary</b>. Hit <b>★ primary</b> on any adopted play to re-aim everything.</div>
    </div>`;
  }

  // ---------------- MULLIGAN / REROLL INTELLIGENCE ----------------
  // "Is this shop worth keeping, and what SHOULD today's gold be assembling?"
  // Fresh-shop value is computed ANALYTICALLY: each offer draws a rarity by the
  // exact wiki odds at this shop level, then a uniform species within it — every
  // species scored by the live engine against YOUR board/trainer/trinkets, and
  // E[best of N offers] follows from the discrete max-order statistic.
  const REROLL_COST = 3; // in-game reroll button: $3
  // 🎲 Gold-to-hit odds (MetaTFT-style rolldown math): chance to SEE a species
  // in one shop roll at this shop level, and the reroll gold for 50/80/95%.
  // Pool-blind (copy depletion unknown — labeled ≈). Uses the SAME effectiveOdds
  // table + species counting as shopEV, so the 🎰 verdict and these numbers can
  // never disagree about what's rollable.
  function hitOdds(targetId, rank) {
    const m = monById[targetId];
    if (!m) return null;
    const odds = effectiveOdds(rank != null ? rank : live.shopRank);
    const tierP = (odds[m.tier - 1] || 0) / 100;
    if (tierP <= 0) return { targetId, inPool: false, tier: m.tier };
    const nTier = shopPool.filter(x => !x.isEvolvedForm && x.tier === m.tier).length || 1;
    const slots = Math.min(Math.max(live.shop.length || 5, 3), 6);
    const pSlot = tierP / nTier;
    let pRoll = Math.min(1 - Math.pow(1 - pSlot, slots), 0.999);
    // 🌐 community blend (v1 data flywheel): once enough opt-in shops exist,
    // average the theoretical rate with the OBSERVED appearance rate — this is
    // what ends pool-blindness without knowing true pool sizes.
    let communityBlended = false;
    const CM = window.COMMUNITY;
    if (CM && CM.sample && CM.sample.shops >= 200 && CM.pools && CM.pools[targetId]) {
      const emp = Math.min(CM.pools[targetId].seen / Math.max(CM.pools[targetId].shops, 1), 0.999);
      pRoll = Math.min((pRoll + emp) / 2, 0.999);
      communityBlended = true;
    }
    const rollsFor = (q) => Math.max(Math.ceil(Math.log(1 - q) / Math.log(1 - pRoll)), 1);
    const free = (live.trainerData && live.trainerData.freeRerolls) || 0;
    const goldFor = (q) => Math.max(rollsFor(q) - free, 0) * REROLL_COST;
    return { targetId, inPool: true, pRoll, gold50: goldFor(0.5), gold80: goldFor(0.8), gold95: goldFor(0.95), free, communityBlended };
  }
  // compact chip: "~$9 for 80%" or "not in Shop Lv N pool"
  function hitOddsChip(id) {
    const o = hitOdds(id);
    if (!o) return '';
    if (!o.inPool) return ` <span class="pill" style="border-color:rgba(255,77,94,.5)" title="This rarity can't roll at Shop Lv ${live.shopRank} — raise shop level first">not in Shop Lv ${live.shopRank} pool</span>`;
    // 🎲 empirical layer: what THIS run's shops have actually offered
    const seen = live.shopSeen && live.shopSeen.shops >= 3 ? live.shopSeen : null;
    const n = seen ? (seen.counts[id] || 0) : null;
    const expected = seen ? o.pRoll * seen.shops : 0;
    const cold = seen && n === 0 && expected >= 2.5;
    const seenTxt = seen ? ` · seen ${n}×/${seen.shops} shops this run${cold ? ' — running COLD vs expectation' : ''}` : '';
    return ` <span class="pill" ${cold ? 'style="border-color:rgba(240,196,64,.55)"' : ''} title="≈${Math.round(o.pRoll * 100)}% per roll · ~$${o.gold50} for 50% · ~$${o.gold80} for 80% · ~$${o.gold95} for 95%${o.free ? ` · ${o.free} free reroll${o.free > 1 ? 's' : ''} counted` : ''}${seenTxt} ${o.communityBlended ? '(community-blended rate)' : '(pool-blind estimate)'}">🎲 ~$${o.gold80} for 80%${cold ? ' · cold' : ''}</span>`;
  }
  function shopEV(ctx, rank, actualOffers, trinketIds) {
    const odds = effectiveOdds(rank, trinketIds);
    const pool = shopPool.filter(m => !m.isEvolvedForm && odds[m.tier - 1] > 0);
    if (!pool.length) return null;
    // ONE engine call for pool + actual offers → shared normalization, comparable raws
    const hypo = pool.map(m => ({ monsterId: m.id, level: 1, shiny: false, _hypo: true }));
    const res = E.scoreShop(hypo.concat(actualOffers || []), Object.assign({}, ctx, { gold: null }));
    const nTier = {};
    pool.forEach(m => { nTier[m.tier] = (nTier[m.tier] || 0) + 1; });
    const dist = res.rows.filter(r => r.offer._hypo)
      .map(r => ({ raw: r.raw, p: (odds[r.m.tier - 1] / 100) / nTier[r.m.tier] }))
      .sort((a, b) => a.raw - b.raw);
    const totalP = dist.reduce((a, d) => a + d.p, 0) || 1;
    const n = Math.max((actualOffers || []).length, 1);
    let F = 0, Fprev = 0, ev = 0;
    for (const d of dist) {
      F += d.p / totalP;
      ev += d.raw * (Math.pow(F, n) - Math.pow(Fprev, n));
      Fprev = F;
    }
    const actualRows = res.rows.filter(r => !r.offer._hypo);
    const maxRaw = Math.max(...res.rows.map(r => r.raw), 0.001);
    return { ev, actualRows, maxRaw, odds };
  }
  function rerollVerdict(ctx, offers, rank, gold, trinketIds) {
    if (!offers || !offers.length) return null;
    const sv = shopEV(ctx, rank, offers, trinketIds);
    if (!sv) return null;
    const pctOf = (raw) => Math.round((raw / sv.maxRaw) * 100);
    const afford = sv.actualRows.filter(r => r.m.cost <= gold);
    const bestNow = afford[0] || sv.actualRows[0];
    const bestAny = sv.actualRows[0]; // best offer ignoring gold
    const canAfford = afford.length > 0;
    const gainPct = Math.round(((sv.ev - bestNow.raw) / Math.max(bestNow.raw, 0.001)) * 100);
    // hard KEEP: an affordable offer completes a proven combo with your board.
    // A combo piece's value is the COMBO, not its solo score — so don't gate on a
    // high pool-relative raw (a support like Stellagon that completes a 77%-WR
    // Velocect+Formiqueen combo scores modestly solo but is a real keep). Trust
    // the proven-combo chip when its measured WR clears a genuine edge (≥58%), or
    // when the solo raw is already elite. This is what stopped the reroll box from
    // contradicting the buy box ("reroll" vs "comp piece") on the SAME unit.
    const comboKeep = afford.find(r => {
      const ch = (r.chips || []).find(c => /Completes a proven|Proven pair/.test(c));
      if (!ch) return false;
      const wrM = ch.match(/(\d+(?:\.\d+)?)\s*%\s*WR/i);
      const comboWR = wrM ? parseFloat(wrM[1]) : 0;
      return pctOf(r.raw) >= 82 || comboWR >= 58;
    });
    // LOCK: the best offer is strong but out of budget TODAY, and tomorrow's
    // income covers it — in-game, locked offers carry over (empties refill).
    const nextIncome = incomeFor(Math.min((ctx.day || 1) + 1, 40));
    const lockWorthy = bestAny && bestAny.m.cost > gold && bestAny.m.cost <= gold + nextIncome
      && pctOf(bestAny.raw) >= 55 && bestAny.raw > sv.ev * 1.1
      && (!canAfford || bestAny.raw > bestNow.raw * 1.18);
    let verdict, cls, why;
    if (comboKeep) { verdict = 'KEEP'; cls = 'keep'; why = `<b>${esc(comboKeep.m.name)}</b> completes a proven combo — buy it before touching reroll`; }
    else if (lockWorthy) { verdict = 'LOCK'; cls = 'lock'; why = `<b>${esc(bestAny.m.name)}</b> ($${bestAny.m.cost}) is the strongest thing here (~${pctOf(bestAny.raw)}%) but out of budget — lock the shop, tomorrow's +$${nextIncome} income buys it`; }
    else if (gold < REROLL_COST) { verdict = 'KEEP'; cls = 'keep'; why = `no gold to reroll ($${REROLL_COST})`; }
    else if (!canAfford) { verdict = 'REROLL'; cls = 'reroll'; why = `nothing here is affordable at $${gold} — a fresh roll can offer cheaper value`; }
    else if (gainPct >= 12) {
      const gainTxt = gainPct > 100 ? `${((gainPct + 100) / 100).toFixed(1)}× stronger on average` : `~${gainPct}% better`;
      verdict = 'REROLL'; cls = 'reroll'; why = `a fresh shop's expected best (~${pctOf(sv.ev)}%) beats your current best <b>${esc(bestNow.m.name)}</b> (~${pctOf(bestNow.raw)}%) — ${gainTxt}`;
    }
    else if (gainPct >= 5 && gold >= 8) { verdict = 'BUY THEN REROLL'; cls = 'mid'; why = `current best <b>${esc(bestNow.m.name)}</b> is fine, but the shop tail is weak — expected fresh roll ~${gainPct}% better; take the pick, reroll the rest if gold allows`; }
    else { verdict = 'KEEP'; cls = 'keep'; why = `current best <b>${esc(bestNow.m.name)}</b> (~${pctOf(bestNow.raw)}%) already matches or beats a fresh roll's expectation (~${pctOf(sv.ev)}%)`; }
    return { verdict, cls, why, gainPct, evPct: pctOf(sv.ev), nowPct: pctOf(bestNow.raw), bestNow: bestNow.m.name };
  }
  // Day-appropriate PACKAGES: proven 2/3-piece comps (phase-split WR) you could
  // realistically assemble TODAY — members rollable at this shop level, missing
  // pieces affordable, each piece flagged ✓board / 🛒in shop / 🎲roll for it.
  function mulliganPackages(ctx, offers, rank, gold, ownedIds, trinketIds) {
    const SY = window.SYNERGY;
    if (!SY || !SY.combos) return [];
    const odds = effectiveOdds(rank, trinketIds);
    const phase = ctx.day <= 4 ? 'early' : ctx.day <= 8 ? 'mid' : 'late';
    const shopIds = new Set((offers || []).map(o => o.monsterId));
    const cands = [];
    for (const k of ['2', '3']) {
      for (const c of SY.combos[k] || []) {
        if ((c.rounds || 0) < 50) continue;
        const ph = c.phases && c.phases[phase];
        if (!ph || ph.rounds < 12) continue; // must be proven IN this phase of the run
        const members = c.ids.map(id => monById[id]);
        if (members.some(m => !m || m.isEvolvedForm)) continue;
        const missing = members.filter(m => !ownedIds.has(m.id));
        if (!missing.length) continue; // already assembled
        if (missing.some(m => !(odds[m.tier - 1] > 0))) continue; // not rollable at this shop level
        const cost = missing.reduce((a, m) => a + m.cost, 0);
        if (cost > gold + 5) continue; // must be buyable ~today
        const inShop = missing.filter(m => shopIds.has(m.id)).length;
        // build path: packages that overlap your run plan's pieces rank first
        const planHits = ctx.compIds ? c.ids.filter(id => ctx.compIds.has(id)).length : 0;
        let score = ph.winRate + inShop * 5 + (members.length - missing.length) * 3 + planHits * 7 - cost * 0.08;
        // trainer-aware: if YOUR trainer + this exact combo is measured, use it —
        // "best starters for Chef" ≠ best starters overall
        let withTrainer = null;
        if (ctx.trainerId && SY.trainerCombos) {
          const idsKey = c.ids.slice().sort().join('|');
          for (const tc of SY.trainerCombos[k] || []) {
            if (tc.trainer !== ctx.trainerId) continue;
            if (tc.ids.slice().sort().join('|') === idsKey && tc.rounds >= 15) { withTrainer = tc; break; }
          }
          if (withTrainer) score += (withTrainer.lift || 0) * 1.5 + 4;
        }
        cands.push({ c, members, missing, inShop, cost, phWr: ph.winRate, phRounds: ph.rounds, phase, score, withTrainer, planHits });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    const out = [], seen = new Set();
    for (const cand of cands) {
      if (cand.c.ids.some(id => seen.has(id)) && out.length) continue; // diversity between suggestions
      out.push(cand);
      cand.c.ids.forEach(id => seen.add(id));
      if (out.length >= 3) break;
    }
    return out;
  }
  function mulliganCardHTML(ctx, offers, rank, gold, ownedIds, opts) {
    const o = opts || {};
    const v = rerollVerdict(ctx, offers, rank, gold, o.trinketIds);
    const pks = mulliganPackages(ctx, offers, rank, gold, ownedIds, o.trinketIds);
    if (!v && !pks.length) return '';
    const phaseName = ctx.day <= 4 ? 'early' : ctx.day <= 8 ? 'mid' : 'late';
    let html = `<div class="card"><h3>🎰 Mulligan &amp; reroll <span style="font-size:10px;color:var(--muted);font-weight:400">· exact rarity odds (Shop Lv ${rank}) × engine scores vs your board</span></h3>`;
    if (v) html += `<div class="verdict ${v.cls}"><b>${v.verdict === 'KEEP' ? '🛡 KEEP SHOP' : v.verdict === 'REROLL' ? `🎲 REROLL ($${REROLL_COST})` : v.verdict === 'LOCK' ? '🔒 LOCK THE SHOP' : '🛒 ' + v.verdict}</b> — ${v.why}.</div>`;
    else if (offers && !offers.length) html += `<div class="note" style="margin:6px 0">Add what the shop offers to get a keep/reroll verdict.</div>`;
    if (pks.length) {
      html += `<div class="rowlabel" style="margin-top:10px">Best ${phaseName}-game packages to assemble today (day ${ctx.day}, $${gold})</div>`;
      pks.forEach(p => {
        const marks = p.members.map(m => {
          const owned = ownedIds.has(m.id), inShop = new Set((offers || []).map(x => x.monsterId)).has(m.id);
          const mark = owned ? '<b style="color:var(--green)">✓</b>' : inShop ? '<b style="color:var(--gold)">🛒</b>' : '<span style="color:var(--muted)">🎲</span>';
          return `<span class="pk-mon" title="${esc(m.name)}: ${owned ? 'on your board/bench' : inShop ? 'IN SHOP NOW' : 'roll for it ($' + m.cost + ')'}"><img class="sprite" src="${spr(m.sprite)}" width="26" height="26">${mark}</span>`;
        }).join('');
        html += `<div class="pk-row">${marks}<span style="font-size:11.5px">${p.members.map(m => esc(m.name)).join(' + ')}</span>
          <span style="margin-left:auto;font-size:11px">${p.planHits ? `<span class="chip good" style="font-size:9.5px" title="Overlaps your run plan — pieces count toward the build">🎯 plan ×${p.planHits}</span> · ` : ''}${wrSpan(p.phWr)} ${phaseName} WR <span style="color:var(--muted)">(${p.phRounds} rds)</span>${p.withTrainer ? ` · <span class="chip good" style="font-size:9.5px" title="Measured with YOUR trainer at top ranks">${esc((D.trainers.find(t => t.id === ctx.trainerId) || { name: 'trainer' }).name)}: ${p.withTrainer.winRate}%</span>` : ''} · <span style="color:var(--gold)">$${p.cost} to finish</span></span></div>`;
      });
      html += `<div class="note" style="margin:6px 0 0">✓ owned · 🛒 in this shop · 🎲 reroll target — packages are proven at top ranks IN this phase, rollable at your shop level, and affordable now.</div>`;
    }
    return html + '</div>';
  }

  // 🧠 RUN BRAIN — the STRATEGIC layer above the turn-by-turn scorer. Given your
  // trainer, board, day, shop rank and lives it ranks EVERY viable archetype
  // (curated G.BUILDS + data-mined discovered) by four axes: how far ALONG you
  // already are (evolution-aware owned core), how REACHABLE the rest is (real tier
  // odds at your shop rank × shops left), trainer synergy, and meta strength. It
  // then names a PRIMARY direction and the cheap PIVOT branches that share your
  // current core (the "forks" — commit to whichever key piece shows first). This
  // is the long-term "where is this run going and what are my options" vision the
  // greedy per-turn advice can't give. Works from an empty day-1 board too (then
  // it's pure trainer-fit + reachability = your opening plan).
  function runBrain() {
    if (!G || !G.BUILDS) return null;
    const day = live.day, gold = live.gold, lives = live.lives, badges = live.badges || 0;
    const rank = live.shopRank || Math.min(day, 14);
    const tid = effectiveTrainerId();
    const ownedSet = new Set([...live.board, ...(live.bench || [])].filter(Boolean).map(s => s.monsterId));
    const horizon = Math.max(10 - badges, 2); // shops left before champion (~1 badge/day)
    // Reachability uses a PROJECTED shop rank — it rises ~1/day, so a high-tier piece
    // that isn't offered at rank 1 today WILL be by the time you'd field it. Without
    // this, every deep build reads "unreachable" on day 1 (which is wrong — you have
    // the whole run to climb the shop).
    const projRank = Math.min(rank + Math.floor(horizon * 0.6), 14);
    const odds = effectiveOdds(projRank, live.trinkets);
    const mons = (window.BATODEX && window.BATODEX.monsters) || [];
    const tierN = {}; mons.forEach(m => { if (!m.isEvolvedForm && !REMOVED_IDS.has(m.id)) tierN[m.tier] = (tierN[m.tier] || 0) + 1; });
    const pAcquire = (m) => { // P(find this piece before champion), from real tier odds
      if (!m) return 0.5;
      const o = (odds[m.tier - 1] || 0) / 100;
      if (o <= 0) return 0.02; // that tier isn't offered at this shop rank yet
      const pSlot = o / (tierN[m.tier] || 20), pShop = 1 - Math.pow(1 - pSlot, 5);
      return Math.min(1 - Math.pow(1 - pShop, horizon * 2.5), 0.98); // ~2.5 rolls/day
    };
    const powerScore = (bb) => {
      if (bb.winRate) return Math.max(0.1, Math.min(1, (bb.winRate - 52) / 22 + 0.5));
      const p = String(bb.power || '');
      if (/^S/.test(p)) return 1; if (/A/.test(p)) return 0.78; if (/B\+/.test(p)) return 0.6; if (/B/.test(p)) return 0.45; return 0.5;
    };
    const cand = [...G.BUILDS, ...discoveredBuilds().slice(0, 8).map(discAsGuide)];
    // score ONE archetype (reused for the candidate sweep AND for adopted-plan comparison)
    const scoreArchetype = (bb) => {
      if (!bb) return null;
      // ESSENTIAL core = what makes the build functional; lateCore = optional payoff.
      const core = (bb.core || []).filter((id, i, a) => a.indexOf(id) === i && monById[id]);
      if (core.length < 2) return null;
      const lateCore = (bb.lateCore || []).filter(id => monById[id] && !core.includes(id));
      const ownedCore = core.filter(id => ownsPieceOrEvo(id, ownedSet).have);
      const missing = core.filter(id => !ownsPieceOrEvo(id, ownedSet).have).map(id => monById[id]);
      const lateMissing = lateCore.filter(id => !ownsPieceOrEvo(id, ownedSet).have).map(id => monById[id]);
      const ownedFrac = ownedCore.length / core.length;
      const reach = missing.length ? Math.pow(missing.reduce((a, m) => a * pAcquire(m), 1), 1 / missing.length) : 1;
      // trainer fit matters a LOT on an empty board — a trainer's ability usually
      // ENABLES its build (Chef→burn, Musician→shock), so running an off-trainer comp
      // wastes it. Owned core (weight 3.4) still overrides this once you've committed.
      const trFit = bb.trainer === tid ? 1 : (bb.altTrainers || []).includes(tid) ? 0.6 : (bb.trainer ? 0.25 : 0.5);
      const highTier = core.filter(id => (monById[id] || {}).tier >= 5).length;
      const phaseFit = day <= 4 ? (highTier <= 1 ? 1 : 0.6) : day >= 8 ? (highTier >= 1 ? 1 : 0.72) : 0.85;
      const score = ownedFrac * 3.4 + reach * 1.9 + trFit * 2.2 + powerScore(bb) * 1.5 + phaseFit * 0.7 + (ownedCore.length >= 2 ? 0.5 : 0);
      return { bb, core, ownedCore, missing, lateMissing, ownedFrac, reach, trFit, score };
    };
    const scored = cand.map(scoreArchetype).filter(Boolean).sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    const primary = scored[0], pOwned = new Set(primary.ownedCore);
    // PIVOT branches: other strong archetypes that SHARE your current core (cheap to
    // switch to) — ranked by HOW MUCH they share (more shared board = cheaper pivot).
    const shareCount = (s) => s.ownedCore.filter(id => pOwned.has(id)).length;
    const branches = scored.slice(1)
      .filter(s => s.bb.id !== primary.bb.id && shareCount(s) >= 1 && s.score >= primary.score * 0.55)
      .sort((a, b) => (shareCount(b) - shareCount(a)) || (b.score - a.score))
      .slice(0, 2);
    // 📐 MULTI-PLAN reasoning — when you've ADOPTED 2+ strategies, compare THEM (not the
    // inferred direction) and say which to chase now + when to pivot (design goal: "say when
    // it's better to chase one instead of the other, in the reasoning layer").
    const adoptedIds = planIds();
    let adopted = null;
    if (adoptedIds.length >= 2) {
      const byId = {}; scored.forEach(s => { byId[s.bb.id] = s; });
      const plans = adoptedIds.map(id => byId[id] || scoreArchetype(buildById(id))).filter(Boolean);
      if (plans.length >= 2) {
        // "chase-now" priority = progress × reachability × value + trainer fit — favours the
        // plan you can COMPLETE soonest without throwing away pieces you already own.
        plans.forEach(p => { p.chase = p.ownedFrac * 2.4 + p.reach * 1.5 + powerScore(p.bb) * 1.0 + (p.bb.trainer === tid ? 0.5 : 0); });
        plans.sort((a, b) => b.chase - a.chase);
        const lead = plans[0], rival = plans[1], rivalCore = new Set(rival.core);
        const shared = lead.ownedCore.filter(id => rivalCore.has(id)).map(id => (monById[id] || {}).name || id);
        // rival's DECIDER = its cheapest-to-find piece that's UNIQUE to it (not in the lead) —
        // seeing that in the shop is the signal to commit toward the rival instead.
        const decider = (rival.missing || []).filter(m => !lead.core.includes(m.id)).sort((a, b) => pAcquire(b) - pAcquire(a))[0] || (rival.missing || [])[0] || null;
        adopted = { plans, lead, rival, shared, decider, close: (lead.chase - rival.chase) < 0.6 };
      }
    }
    return { primary, branches, adopted, phase: day <= 4 ? 'OPENING' : badges >= 9 ? 'CHAMPION PUSH' : day <= 8 ? 'BUILD' : 'SCALE', day, badges, lives, gold };
  }
  function runBrainHTML(rb) {
    if (rb === undefined) { try { rb = runBrain(); } catch (e) { return ''; } } // reuse the precomputed brain if passed
    if (!rb) return '';
    const p = rb.primary, b = p.bb;
    const betterBranch = rb.branches.find(s => s.reach > p.reach + 0.15);
    const reachTag = p.reach >= 0.55 ? '<span style="color:#39d353">🟢 reachable</span>' : p.reach >= 0.3 ? '<span style="color:#e8c341">🟡 a stretch</span>' : `<span style="color:#ff6b6b">🔴 ${betterBranch ? 'hard — a branch is easier' : 'a grind, but your best fit'}</span>`;
    const missTop = p.missing.length
      ? p.missing.slice(0, 4).map(m => `<span title="tier ${m.tier}">${esc(m.name)}</span>`).join(', ') + ((p.lateMissing || []).length ? ` <span style="opacity:.65">(+ late: ${p.lateMissing.slice(0, 2).map(m => esc(m.name)).join(', ')})</span>` : '')
      : '<b style="color:#39d353">core complete ✓ — level &amp; position it</b>';
    const pace = rb.day > 1 ? (rb.badges / (rb.day - 1)) : 0;
    const paceTag = pace >= 0.55 ? '<span style="color:#39d353">champion pace</span>' : pace >= 0.35 ? '<span style="color:#e8c341">slightly behind pace</span>' : '<span style="color:#ff6b6b">behind pace</span>';
    const phaseMsg = { OPENING: 'commit to a direction by day 4–5 — buy cheap synergy pieces + merge, don\'t force off-plan power.', BUILD: 'complete your core, start positioning donors, bank only what you don\'t need for pieces.', SCALE: 'level your carry, lock good boards, take scaling trinkets; spend to stay on-curve.', 'CHAMPION PUSH': 'one win from champion — tempo over greed: shields front, carry crowned top-middle, spend down if lives are low.' }[rb.phase];
    let econ; try { const bvm = boardVsMaster(); econ = bvm ? (bvm.pctile >= 70 ? 'ahead of the Master curve → you can bank / greed ramps.' : bvm.pctile >= 45 ? 'on the Master curve → spend on real upgrades, keep pace.' : 'BEHIND the Master curve → spend up / reroll now, don\'t over-bank.') : (rb.lives <= 2 ? 'low lives → spend to win the next fight.' : 'build toward your core.'); } catch (e) { econ = 'build toward your core.'; }
    const pset = new Set(p.ownedCore);
    const branchHTML = rb.branches.length ? rb.branches.map(s => {
      const shared = s.ownedCore.filter(id => pset.has(id)).map(id => esc((monById[id] || {}).name)).filter(Boolean);
      const decider = s.missing[0] ? esc(s.missing[0].name) : esc(s.bb.name);
      return `<div style="margin-top:3px">🌿 <b>${esc(s.bb.name)}</b> <span style="color:var(--muted)">— shares ${shared.slice(0, 3).join(', ') || 'a piece'}; pivot here if <b>${decider}</b> shows (you keep ${shared.length} piece${shared.length === 1 ? '' : 's'})</span></div>`;
    }).join('') : `<div style="margin-top:3px;color:var(--muted)">🌿 No cheap pivot — you're committed to this line; drive it home.</div>`;
    // 📐 MULTI-PLAN block — when you've adopted 2+ strategies, this REPLACES the inferred
    // "Primary" as the headline: the plans brain-ranked by what to complete first, plus
    // the rule for when to chase one vs the other.
    const adoptedHTML = rb.adopted ? (() => {
      const a = rb.adopted, nm = (x) => esc(x.bb.name);
      const reachWord = (x) => x.reach >= 0.55 ? '🟢 reachable' : x.reach >= 0.3 ? '🟡 a stretch' : '🔴 a grind';
      const rows = a.plans.map((x, i) => `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap">
          <span style="min-width:11px;color:var(--muted)">${i === 0 ? '▶' : '·'}</span><b>${nm(x)}</b>
          <span class="pill" style="font-size:9px">${x.ownedCore.length}/${x.core.length} core</span>
          <span class="pill" style="font-size:9px">${reachWord(x)}</span>
          ${i === 0 ? '<span class="pill" style="font-size:9px;color:var(--green);border-color:rgba(61,220,132,.5)">CHASE NOW</span>' : ''}</div>`).join('');
      const dec = a.decider ? esc(a.decider.name) : null;
      const rule = a.close
        ? `Neck and neck — let the SHOP decide: ${dec ? `commit to <b>${nm(a.rival)}</b> the moment <b>${dec}</b> appears, otherwise drive <b>${nm(a.lead)}</b>` : 'take whichever key piece shows first'}.`
        : `Chase <b>${nm(a.lead)}</b> now (${Math.round(a.lead.ownedFrac * 100)}% there). Pivot to <b>${nm(a.rival)}</b> only if <b>${dec || 'its key piece'}</b> shows early, or if ${nm(a.lead)}'s core hasn't come together by ~day ${Math.min(rb.day + 3, 12)}.`;
      const sharedTxt = a.shared.length ? `Shared: <b>${a.shared.slice(0, 3).join(', ')}</b> — the pivot is cheap (you keep those).` : `Little overlap — pick a lane soon; splitting buys bleeds tempo.`;
      return `<div style="margin:2px 0 8px;padding:8px 10px;border:1px solid rgba(199,123,255,.5);border-radius:9px;background:linear-gradient(180deg,rgba(199,123,255,.08),transparent)">
        <div style="font-weight:800;font-size:12px">📐 Your ${a.plans.length} adopted plans <span style="font-weight:400;color:var(--muted);font-size:9.5px">— brain-ranked by what to finish first</span></div>
        ${rows}
        <div style="margin-top:6px;font-size:11.5px;line-height:1.5">🧭 ${rule}</div>
        <div style="margin-top:3px;font-size:10px;color:var(--muted)">${sharedTxt} The shop hunts pieces for <b>all</b> of them.</div></div>`;
    })() : '';
    const inferredHTML = rb.adopted ? '' : `<div>🎯 <b>Primary: ${esc(b.name)}</b> <span style="color:var(--muted)">${b.power ? '· ' + esc(String(b.power)) : ''} · <b>${p.ownedCore.length}/${p.core.length}</b> core · ${reachTag}</span></div>
        <div style="margin-left:15px;color:var(--muted)">→ still need: ${missTop}</div>
        ${branchHTML}`;
    return `<div class="card" style="margin-top:12px;border-color:rgba(199,123,255,.45)">
      <h3>🧠 Run Brain <span style="font-size:10.5px;color:var(--muted);font-weight:400">· ${rb.phase} · day ${rb.day} · ${rb.badges}🏅 (${paceTag})</span></h3>
      <div style="margin-top:8px;font-size:12.5px;line-height:1.6">
        ${adoptedHTML}${inferredHTML}
        <div style="margin-top:6px;padding-top:5px;border-top:1px dashed var(--border)">📈 <b>${rb.phase}</b> — ${phaseMsg}</div>
        <div style="margin-top:2px">💰 <b>Econ:</b> ${econ}</div>
      </div></div>`;
  }

  // 📊 BOARD vs MASTER — how does your board stack up against what WINNING Master
  // players field at this day? window.MASTER_BENCH (tools/master_bench.js, mined
  // from the 712-run Master corpus) holds per-day strength percentiles; we score
  // your board with the SAME metric (Σ Engine.power over the board) and locate it
  // in the distribution. "on-curve / ahead / behind" tells you whether to spend up
  // NOW or coast. Both sides use identical Engine.power scoring → apples-to-apples.
  function boardVsMaster() {
    const bench = window.MASTER_BENCH && window.MASTER_BENCH.byDay;
    if (!bench) return null;
    const key = Math.min(live.day, 15);
    let bd = bench[key];
    for (let d = key; d >= 1 && !bd; d--) bd = bench[d]; // nearest day at/under with data
    if (!bd) return null;
    const team = live.board.filter(Boolean).map(s => ({ monsterId: s.monsterId, level: s.level || 1, shiny: !!s.shiny }));
    if (!team.length) return null;
    let s = 0;
    for (const u of live.board) {
      if (!u) continue; const m = monById[u.monsterId]; if (!m) continue;
      try { s += (E.power(m, u.level || 1, { team, day: live.day, shiny: !!u.shiny, trainerId: effectiveTrainerId() }).total) || 0; } catch (e) {}
    }
    s = Math.round(s);
    // piecewise-linear percentile over the stored p25/p50/p75/p90 anchors
    const pts = [[0, bd.p25 * 0.5], [25, bd.p25], [50, bd.p50], [75, bd.p75], [90, bd.p90], [100, bd.p90 * 1.35]];
    let pctile = 99;
    if (s <= pts[0][1]) pctile = 1;
    else for (let i = 1; i < pts.length; i++) { if (s <= pts[i][1]) { pctile = Math.round(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * (s - pts[i - 1][1]) / Math.max(pts[i][1] - pts[i - 1][1], 1)); break; } }
    return { s, p50: bd.p50, pctile: Math.max(1, Math.min(99, pctile)), n: bd.n };
  }

  // 🌳 ARBORESCENCE — think two–three moves ahead instead of one. Greedy advice
  // scores the best pick THIS shop; this projects the win% PATH of your run:
  // starting from the current board, it acquires each missing GOAL piece (your
  // adopted plan, else the strongest assemblable package) in priority order and
  // reports the real quickWinPct on each cumulative board, tagging every step by
  // how findable it is at your shop rank. It also branches: "commit to the plan
  // ceiling" vs "grab the best immediate upgrade in THIS shop", with real win% on
  // both, so you can see whether digging for the payoff beats taking value now.
  // All win% are evaluated at TODAY's enemy difficulty (a fixed yardstick), so
  // the numbers compare boards, not days — read them as "how much each piece adds".
  function lookaheadTree(shopRes) {
    const base = quickWinPct(live.board, 24, 'la-base'); // 24-MC (matches the Δwin chips) so this card's win% agrees with the rest — was deterministic (50+margin/2.4), which put a 3rd, different number on screen
    if (!base) return null;
    const ownedSet = new Set([...live.board, ...(live.bench || [])].filter(Boolean).map(s => s.monsterId));
    // GOAL = adopted plan's missing core (evolution-aware), in plan priority order.
    let goalName = null, missing = [];
    const planB = live.plan && buildById(live.plan);
    if (planB) {
      goalName = planB.name;
      const seen = new Set();
      missing = [...(planB.core || []), ...(planB.lateCore || [])]
        .filter(id => (seen.has(id) ? false : (seen.add(id), true)))
        .filter(id => !ownsPieceOrEvo(id, ownedSet).have) // .have — the fn returns {have, via}
        .map(id => monById[id]).filter(Boolean);
    }
    if (!missing.length) return null; // no adopted plan / already complete → nothing to look ahead to
    const rank = live.shopRank || Math.min(live.day, 14);
    const odds = effectiveOdds(rank, live.trinkets);
    const diffTag = (tier) => {
      const o = odds[tier - 1] || 0;
      if (o >= 25) return { t: '🟢', l: 'easy find' };
      if (o >= 10) return { t: '🟡', l: 'a few rolls' };
      if (o > 0) return { t: '🔴', l: 'rare — dig for it' };
      return { t: '⚫', l: `not offered at shop rank ${rank} — raise rank first` };
    };
    const prot = protectedUnitIds();
    const projectAdd = (b, m) => {
      const nb = b.map(s => s ? { ...s } : null);
      let idx = nb.findIndex(s => !s);
      if (idx < 0) { // board full → replace weakest unprotected non-egg
        let wi = -1, wv = Infinity;
        nb.forEach((s, i) => { if (!s || prot.has(s.monsterId) || /egg/i.test(s.monsterId)) return; let v = Infinity; try { v = E.power(monById[s.monsterId], s.level, { day: live.day, team: nb, trainerId: effectiveTrainerId() }).total; } catch (e) {} if (v < wv) { wv = v; wi = i; } });
        idx = wi;
      }
      if (idx < 0) return null;
      nb[idx] = { monsterId: m.id, level: 1, shiny: false };
      return nb;
    };
    let board = live.board.map(s => s ? { ...s } : null), prevWin = base.win;
    const nodes = [];
    for (const m of missing.slice(0, 3)) {
      const nb = projectAdd(board, m);
      if (!nb) break;
      const w = quickWinPct(nb, 24, 'la-' + m.id);
      if (!w) break;
      board = nb;
      nodes.push({ name: m.name, tier: m.tier, diff: diffTag(m.tier), win: Math.round(w.win), d: Math.round(w.win - prevWin) });
      prevWin = w.win;
    }
    if (!nodes.length) return null;
    // BRANCH B — the best immediate upgrade available in THIS shop (max Δwin).
    let alt = null;
    if (shopRes && shopRes.rows) {
      const affordable = shopRes.rows.filter(r => r.affordable && (r.dwin || 0) > 0 && !missing.some(m => m.id === r.m.id));
      const topAlt = affordable.sort((a, b) => (b.dwin || 0) - (a.dwin || 0))[0];
      if (topAlt) alt = { name: topAlt.m.name, win: Math.round(base.win + (topAlt.dwin || 0)), d: Math.round(topAlt.dwin || 0), cost: topAlt.m.cost };
    }
    return { base: Math.round(base.win), goalName, nodes, ceiling: nodes[nodes.length - 1].win, alt };
  }

  // 🧭 THIS TURN — the one card that makes every other box agree. It reads the
  // SAME helpers the individual panels use (strategy, buy scoring, sale
  // valuation, eggs, space) and collapses them into a single ordered directive,
  // so the strategy box, buy box, sell box, the egg and positioning can never
  // tell you three different things. This is the "boxes work together" layer.
  function coordinationHTML(shopRes, verdictLive) {
    const steps = [];
    const act = activeStrategy();
    const plays = detectStrategies();
    const eggs = incomingEggs();
    const space = boardSpace();
    const protectedIds = protectedUnitIds();
    const stratIds = (strategyCtxFields().stratIds) || new Set();
    const counts = liveOwnedCounts();

    // 1) STRATEGY — which play(s) is the whole board running?
    const acts = activeStrategies();
    if (acts.length === 1) {
      const a = acts[0];
      const nm = (STRATEGY_LIB.find(s => s.id === a.id) || {}).name || a.id;
      const focus = a.focusId && monById[a.focusId];
      steps.push(`♟️ <b>${esc(nm)}</b> is your active plan${focus ? ` — every box below aims at <b>${esc(focus.name)}</b>` : ''}.`);
    } else if (acts.length >= 2) {
      const nm = (id) => (STRATEGY_LIB.find(s => s.id === id) || {}).name || id;
      const primFocus = acts[0].focusId && monById[acts[0].focusId];
      steps.push(`♟️ Running <b>${acts.length} plays</b> — ${acts.map((a, i) => `${i === 0 ? '★ ' : ''}<b>${esc(nm(a.id))}</b>`).join(' + ')}. Boxes aim at your primary${primFocus ? ` (<b>${esc(primFocus.name)}</b>)` : ''}; see the <b>⚖️ which-to-chase</b> read for when to flip.`);
    } else {
      const worth = plays.find(p => p.worth);
      if (worth) steps.push(`♟️ <b>${esc(worth.st.name)}</b> is on the table (${esc(worth.whyWorth)}) — <b>▶ Adopt</b> it below and every box re-aims behind it.`);
    }

    // 1a) BOARD vs MASTER — your board's synergy-power against winning Master boards
    // at this day (real 712-run corpus). Behind-curve = spend/reroll up now; ahead =
    // you can bank/greed. A single honest "am I strong enough for this stage" read.
    const bvm = boardVsMaster();
    if (bvm) {
      const band = bvm.pctile >= 70 ? { c: '#39d353', t: `<b>ahead of curve</b> (top ${100 - bvm.pctile}%) — you can bank gold / greed ramps` }
        : bvm.pctile >= 45 ? { c: '#e8c341', t: `<b>on curve</b> (~median) — keep pace, don't fall behind` }
          : { c: '#ff6b6b', t: `<b>behind</b> (bottom ${bvm.pctile}%) — spend up / reroll for upgrades <b>now</b>, don't over-bank` };
      steps.push(`📊 <b>Board vs Master</b> — day ${live.day}: your strength <b>${bvm.s}</b> vs winning-Master median <b>${bvm.p50}</b> → <b style="color:${band.c}">${bvm.pctile}ᵗʰ&nbsp;pct</b>, ${band.t}. <span style="color:var(--muted);font-size:10px">(same Engine.power metric, ${bvm.n} real Master boards at this day)</span>`);
    }

    // 1b) DIVERSITY CARRY — per-unique-type scalers (Prismagon: "+10 Damage
    // permanently for each unique type on your team" per cast) INVERT the usual
    // "stack one type / cut off-type bodies" logic: their damage grows with the
    // count of DISTINCT types on the board, so breadth beats stacking. Observed
    // (Egg-Breeder Prismagon run): ramped +10→+50/cast by deliberately widening
    // types and keeping a 15-HP dragon alive purely as a type-holder. Surface
    // "diversity mode" so nothing below reads as "go mono-type." Rainbow Berry
    // (+dmg per unique type, team-wide) creates the same incentive.
    const divCarry = live.board.find(s => {
      if (!s) return false; const mm = monById[s.monsterId]; if (!mm) return false;
      try { return /for each unique type/i.test((E.abilityText(mm, s.level, s.shiny).text) || ''); } catch (e) { return false; }
    });
    const rainbowTrinket = (live.trinkets || []).map(id => (D.trinkets.find(t => t.id === id) || {}).name)
      .some(nm => nm && TRINKET_EFFECTS[nm] && TRINKET_EFFECTS[nm].dmgFlatPerUniqueType);
    if (divCarry || rainbowTrinket) {
      const nTypes = new Set(live.board.filter(s => s).flatMap(s => slotTypes(s).map(t => t.id))).size;
      const cm = divCarry && monById[divCarry.monsterId];
      steps.push(`🌈 <b>Diversity ${cm ? esc(cm.name) : 'scaling'}</b> — scales with UNIQUE types, not copies (<b>${nTypes} type${nTypes === 1 ? '' : 's'}</b> on board now). MAXIMIZE breadth: <b>don't sell off-type units</b>, keep even a cheap body if it's your only carrier of a type, prefer <b>dual-type</b> units (2 types/slot), and grab <b>type-adding</b> events (Shockify Ray) &amp; Rainbow-Berry trinkets. Off-type buys ADD damage here — the opposite of stacking.`);
    }

    // 1b-2) RIGALORD CLONE ENGINE (Haelian 07-14 "steal your opponents" build) —
    // Riglet "devours the ally IN FRONT (right neighbour) next day, then evolves to
    // Rigalord"; Rigalord "spawns exact copies of the devoured Batomon into empty
    // BOTTOM-ROW slots (clones fire only when it casts)". So the whole build is a
    // positioning play: seat your HIGHEST-output unit directly in front of Riglet
    // (that's what gets cloned), and keep bottom-row slots OPEN for the copies.
    const rig = live.board.find(s => s && (s.monsterId === 'riglet' || s.monsterId === 'rigalord'));
    if (rig) {
      const isRiglet = rig.monsterId === 'riglet';
      const ri = live.board.indexOf(rig);
      const frontIdx = (ri % 3 !== 2) ? ri + 1 : -1; // "in front" = right neighbour same row (enemies face right)
      const frontMon = (frontIdx >= 0 && live.board[frontIdx]) ? monById[live.board[frontIdx].monsterId] : null;
      const bottomEmpty = [3, 4, 5].filter(i => !live.board[i]).length;
      steps.push(`🩸 <b>Rigalord clone engine</b> — ${isRiglet ? 'Riglet <b>devours the ally in front</b> (its right neighbour) next day → Rigalord' : 'Rigalord'} spawns exact <b>copies of the devoured unit</b> into empty bottom-row slots (they fire when it casts). ${isRiglet ? (frontMon ? `Front unit = <b>${esc(frontMon.name)}</b> — make sure that's your <b>strongest output</b> carry (it's what gets cloned).` : `<b style="color:var(--red)">The slot in front of Riglet is EMPTY</b> — seat your highest-output carry there or it devours nothing.`) : ''} Keep <b>bottom-row slots open</b> for the clones — <b>${bottomEmpty}</b> free now.`);
    }

    // 1c) LOOK-AHEAD TREE — the strategic frame: where this run is HEADED, not just
    // the next click. Shows the win% payoff path of completing your plan vs grabbing
    // the best immediate upgrade, so the tactical boxes below are read in context.
    const la = lookaheadTree(shopRes);
    if (la) {
      const pathRows = la.nodes.map((n, i) =>
        `<div style="margin-left:${(i + 1) * 12}px;white-space:nowrap">↳ ${n.diff.t} <b>${esc(n.name)}</b> → <b style="color:${n.win >= 75 ? '#39d353' : n.win >= 55 ? '#e8c341' : '#ff9f6b'}">${n.win}%</b> <span style="color:${n.d >= 0 ? '#39d353' : '#ff6b6b'}">${n.d >= 0 ? '+' : ''}${n.d}pp</span> <span style="color:#888;font-size:10px">${n.diff.l}</span></div>`).join('');
      const altLine = la.alt
        ? `<div style="margin-top:5px;padding-top:4px;border-top:1px dashed var(--border)">⑂ <b>or grab now:</b> ${esc(la.alt.name)} ($${la.alt.cost}) → <b>${la.alt.win}%</b> <span style="color:#39d353">(+${la.alt.d}pp)</span> — ${la.alt.win >= la.ceiling ? '<b style="color:#39d353">beats</b> digging for the plan ceiling; take it' : `below the plan ceiling <b>${la.ceiling}%</b> — worth it only for tempo/at low lives`}</div>`
        : '';
      steps.push(`🌳 <b>Look-ahead — ${esc(la.goalName)}</b> (board <b>${la.base}%</b> → ceiling <b>${la.ceiling}%</b>):<div style="margin-top:4px;font-size:11.5px;line-height:1.65">Now: <b>${la.base}%</b>${pathRows}</div>${altLine}<div class="note" style="font-size:10px;margin-top:3px">win% = each cumulative board vs today's enemy; 🟢🟡🔴 = findability at shop rank ${live.shopRank || Math.min(live.day, 14)}.</div>`);
    }

    // 2) BUY — the top pick, but it MUST obey the 🎰 reroll verdict so this box
    // never contradicts it (the old bug: "Buy X first" while reroll said REROLL
    // — e.g. a just-found tier-5 like Stellagon whose L4 ceiling inflates its buy
    // score but doesn't fit THIS board). Strategy/plan pieces are still worth
    // buying through a weak shop; anything else defers to the reroll.
    let topBuy = null;
    const rv = verdictLive;
    const top = shopRes && shopRes.rows.length ? shopRes.rows[0] : null;
    const isStrat = top && (stratIds.has(top.m.id) || (top.chips || []).some(ch => /comp piece|strategy piece|Completes a proven|Proven pair/i.test(ch)));
    // name the DIRECTION the shop is hunting: an adopted plan (🎯) or, if none, the
    // Run-Brain-inferred comp you're building (🧠). Buy/reroll advice speaks in terms
    // of it so it never feels like the shop is scoring units blind to your build.
    const dirName = shopRes && shopRes._dir;
    const dirL = dirName ? `${shopRes._dirInferred ? '🧠' : '🎯'} <b>${esc(dirName)}</b>` : '♟️ comp';
    if (top && rv && rv.verdict === 'REROLL' && !isStrat) {
      // the shop's best doesn't beat a fresh roll AND isn't a direction piece → reroll
      steps.push(`🎲 <b>Reroll ($${REROLL_COST})</b> — the best here, <b>${esc(rv.bestNow || top.m.name)}</b>${rv.nowPct != null ? ` (~${rv.nowPct}% for your board)` : ''}, doesn't beat a fresh roll (~${rv.evPct}%)${dirName ? ` and isn't a ${dirL} piece` : ' and isn\'t part of your comp'} — roll for a piece that <b>advances your build</b>, don't sink gold into an off-comp body.`);
    } else if (rv && rv.verdict === 'LOCK') {
      // the reroll box decided the STRONGEST offer is worth saving for (unaffordable
      // now, affordable next income). Don't contradict it by pushing the affordable
      // runner-up — that just drains the gold you're saving. (Old bug: "Buy Pyronade
      // first" while the lock note said save for Shelldra.) Exception: an affordable
      // top that is ALSO your comp piece is worth grabbing en route to the lock.
      if (top && top.affordable && isStrat) {
        topBuy = top;
        steps.push(`🛒 Grab <b>${esc(top.m.name)}</b> ($${top.m.cost}) — your ${dirL} piece — then <b>🔒 lock</b>: ${rv.why}.`);
      } else {
        steps.push(`🔒 <b>Lock the shop</b> — ${rv.why}.`);
      }
    } else if (top) {
      topBuy = top;
      if (top.affordable) {
        steps.push(`🛒 Buy <b>${esc(top.m.name)}</b> ($${top.m.cost})${isStrat ? ` — your ${dirL} piece` : (dirName ? ` <span style="color:var(--muted)">— not a ${dirL} piece (a tempo/body pick; it doesn't advance your comp)</span>` : '')} first${rv && rv.verdict === 'BUY THEN REROLL' ? ', then reroll the rest' : ''}.`);
      } else {
        const gap = top.m.cost - live.gold;
        steps.push(`🛒 Your target is <b>${esc(top.m.name)}</b> ($${top.m.cost})${isStrat ? ` — the ${dirL} piece` : ''}, but you're <b>$${gap} short</b> at $${live.gold}.`);
      }
    }

    // 3) SELL / LOCK — fund or free room using the SAME sale valuation the sell
    // box uses, so the two never contradict. Only relevant when the top pick is
    // unaffordable or the board has no room for a new body.
    if (topBuy && !topBuy.affordable) {
      const owned = [...live.board.map((s, i) => ({ s, zone: 'board', i })), ...(live.bench || []).map((s, i) => ({ s, zone: 'bench', i }))]
        .filter(x => x.s && !protectedIds.has(x.s.monsterId) && !/egg/i.test(x.s.monsterId));
      const best = owned.map(x => ({ x, v: saleValueOf(x, counts) })).sort((a, b) => a.v - b.v)[0];
      // SAME income helper the plan/sell boxes use — keeps every "+$N tomorrow" identical
      const incomeL = nextIncomeL();
      if (best) {
        const nm = (monById[best.x.s.monsterId] || {}).name || best.x.s.monsterId;
        const why = counts[best.x.s.monsterId] >= 2 ? 'a duplicate' : best.x.zone === 'bench' ? 'benched — you never field it' : 'your weakest kept unit';
        steps.push(`💰 Fund it by selling <b>${esc(nm)}</b> (${why})${best.x.zone === 'bench' ? ', benched' : ''} — the 💰 sell box has the numbers.`);
      } else {
        steps.push(`🔒 Nothing safe to sell — everything you own is plan/engine/egg material. <b>Lock the shop</b>; next income (+$${incomeL}) covers it.`);
      }
    }

    // 4) 🥚 EGG — the incoming body every other box should plan around
    eggs.forEach(e => {
      const nm = e.into ? e.into.name : 'a monster';
      const tier = e.into ? e.into.tier : 0;
      const when = e.turns <= 0 ? '<b>this round</b>' : e.turns === 1 ? '<b>next round</b>' : `in <b>${e.turns} rounds</b>`;
      const carry = tier >= 4 ? ` — a tier-${tier} ${(e.into.types || [])[0] ? esc(e.into.types[0].name) : ''} carry, your power spike` : '';
      steps.push(`🥚 <b>${esc(nm)}</b> hatches ${when} on your ${e.zone}${carry}. It keeps its own slot, so don't overpay for a redundant body now — bank toward what pairs with it.`);
    });

    // 5) POSITION — concentrate the focus once the pieces are down
    if (act && act.focusId && monById[act.focusId]) {
      steps.push(`🧲 <b>Optimize positioning</b> — it concentrates CDS/donations on <b>${esc(monById[act.focusId].name)}</b>, not raw damage.`);
    }

    if (!steps.length) return '';
    return `<div class="card" id="coord-card" style="border-color:rgba(123,147,195,.5);background:linear-gradient(180deg,rgba(123,147,195,.08),transparent)">
      <h3>🧭 This turn <span style="font-size:10.5px;color:var(--muted);font-weight:400">· one plan — the strategy, buy, sell, egg &amp; positioning boxes below all obey this</span></h3>
      <ol style="margin:8px 0 0;padding-left:20px;line-height:1.6;font-size:12.5px">${steps.map(s => `<li style="margin-bottom:4px">${s}</li>`).join('')}</ol></div>`;
  }

  // 🎪 NEXT-EVENT advisor — the game queues your upcoming event in the run save
  // (live.pendingEvent / queuedEvent). Score its options for YOUR board with the
  // SAME engine the event picker uses, and recommend the pick a turn EARLY — no
  // other tool can see your next event. All helpers here are module-scope
  // (resolveReward/scoreEventOption/D/spr/esc) so this renders headless-safe.
  function pendingEventHTML() {
    const id = live.pendingEvent || live.queuedEvent;
    if (!id) return '';
    const soon = !!live.pendingEvent; // pending = imminent (this/next round); queued = further out
    const ev = (D.events || []).find(e => e.id === id);
    if (!ev || !(ev.options || []).length) return '';
    const scored = ev.options
      .map(o => ({ o, reward: resolveReward(ev, o) }))
      .filter(x => x.reward)
      .map(({ o, reward }) => ({ o, reward, s: scoreEventOption(Object.assign({}, o, { reward })) })) // keep resolved reward (some come from EVENT_REWARD_OVERRIDES, not o.reward)
      .filter(x => x.s && x.s.value != null);
    scored.sort((a, b) => (b.s.value || -1) - (a.s.value || -1));
    const best = scored[0];
    const others = scored.slice(1);
    const applyMon = best && best.s.apply && best.s.apply.kind === 'mon' ? monById[best.s.apply.id] : null;
    return `<div class="card" style="border:1px solid var(--accent);background:linear-gradient(180deg,rgba(123,147,195,.10),transparent);padding:10px 13px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
        <img class="sprite" src="${spr(ev.sprite)}" style="width:54px;height:31px;object-fit:cover;border-radius:5px" onerror="this.style.display='none'">
        <div><b style="font-size:13px">🎪 ${soon ? 'Next event' : 'Upcoming event'}: ${esc(ev.name)}</b>
          <div style="font-size:10px;color:var(--muted)">${soon ? 'the game already queued it — decide before you get there' : 'a few rounds out'}</div></div>
      </div>
      ${best ? `<div style="display:flex;gap:9px;align-items:flex-start;margin-top:8px;padding:7px 10px;border:1px solid rgba(123,147,195,.45);border-radius:8px">
        ${applyMon ? `<img class="sprite" src="${spr(best.s.apply.shiny && applyMon.shinySprite ? applyMon.shinySprite : applyMon.sprite)}" style="width:40px;height:40px">` : '<div style="font-size:22px">🎁</div>'}
        <div><span class="rank-badge">TAKE</span> <b style="font-size:12.5px">${esc(best.o.flavor)}</b>
          <span style="color:var(--gold);font-size:11.5px"> → ${esc(best.reward)}</span>
          <div class="chips" style="margin-top:4px">${best.s.chips.map(c => `<span class="chip good" style="font-size:9.5px">${esc(c)}</span>`).join('')}</div></div>
      </div>` : `<div class="note" style="margin:7px 0 0">Options aren't board-scorable — open 🎪 in the picker when it fires.</div>`}
      ${others.length ? `<div style="margin-top:5px;font-size:10.5px;color:var(--muted)">vs ${others.map(x => `<b>${esc(x.o.flavor)}</b> <span style="opacity:.7">(${esc((x.reward || '').slice(0, 30))})</span>`).join(' · ')}</div>` : ''}
    </div>`;
  }
  function liveAdvice() {
    const outBuy = $('#lv-advice-buy'), outBrain = $('#lv-advice-brain');
    if (!outBuy || !outBrain) return;
    // visual pulse so it's obvious the numbers just recomputed
    [outBuy, outBrain].forEach(o => { o.classList.remove('advice-flash'); void o.offsetWidth; o.classList.add('advice-flash'); });
    const SY = window.SYNERGY;
    // 🧠 DIRECTION-AWARE SHOP — the buy/reroll brain must understand the comp(s) you're
    // BUILDING, not score units in isolation. ADOPTED plans define it (the UNION of every
    // adopted plan's core → the shop hunts pieces for ALL of them, so you can keep 2+ lines
    // open); otherwise the Run Brain's INFERRED primary direction does. That feeds
    // ctx.compIds → the engine FLOORS those pieces above the field so they lead the buy
    // order. (Design goal: the shop must understand the direction you're taking + multi-plan.)
    const rbrain = (() => { try { return runBrain(); } catch (e) { return null; } })();
    const adoptedPlans = planIds().map(id => buildById(id)).filter(Boolean);
    const planBuild = adoptedPlans[0] || null;
    let directionName = null, directionInferred = false, compIds = null;
    if (adoptedPlans.length) {
      compIds = new Set(adoptedPlans.flatMap(pb => [...(pb.core || []), ...(pb.lateCore || [])]));
      // name it after the plan the brain says to CHASE NOW (finish that one first)
      directionName = (rbrain && rbrain.adopted && rbrain.adopted.lead) ? rbrain.adopted.lead.bb.name : (planBuild ? planBuild.name : null);
    } else if (rbrain && rbrain.primary) {
      compIds = new Set(rbrain.primary.core);
      rbrain.branches.forEach(s => { if (s.missing[0]) compIds.add(s.missing[0].id); }); // branch deciders = keep forks live
      directionName = rbrain.primary.bb.name; directionInferred = true;
    }
    const ctx = Object.assign({
      day: live.day, gold: live.gold, badges: live.badges, lives: live.lives, trainerId: effectiveTrainerId(), baseTrainerId: live.trainerId,
      trainerData: live.trainerData || {}, team: live.board, ownedCounts: liveOwnedCounts(), trinkets: live.trinkets,
      compIds, directionName, directionInferred,
    }, strategyCtxFields());
    let html = '';

    // 0) mulligan & reroll FIRST — "keep or reroll?" gates everything below
    const ownedIdsLive = new Set([...live.board, ...(live.bench || [])].filter(s => s).map(s => s.monsterId));
    const verdictLive = rerollVerdict(ctx, live.shop, live.shopRank, live.gold);

    // score the shop ONCE, up front — both the 🧭 synthesis and the 🛒 buy box
    // read the same rows so their #1 pick can never disagree
    const shopRes = live.shop.length ? E.scoreShop(live.shop, ctx) : null;
    if (shopRes) { shopRes._dir = directionName; shopRes._dirInferred = directionInferred; } // name the direction for the buy box
    // Simulate dropping each offer onto the board — a MERGE levels the fielded copy
    // (evolving at its L3 threshold), else it fills an empty slot, else it replaces
    // the weakest unprotected unit. Powers the ⚔️ Δwin% chips AND the blend below.
    const applyOfferToBoard = (m) => {
      // 3-merge-aware (see simAcquireBoard/mergeChain): a lone 2nd copy adds a
      // spare body (no level-up); the 3rd merges. Shared with the 🔬 preview so
      // the Δwin chip and the Simulate modal can never disagree.
      const r = simAcquireBoard(m);
      if (!r) return null;
      const b = r.board;
      if (r.replaced) b._replaced = r.replaced;
      return b;
    };
    const baseWin = shopRes && shopRes.rows.length ? quickWinPct(live.board, 24, 'base') : null;
    // ⚔️ Blend the immediate-battle Δwin% INTO the ranking so the #1 pick can never
    // contradict the Δwin% the app itself shows: a merge/evolution that swings THIS
    // battle +42% must outrank a fresh +13% scaler (observed — the ranker valued a
    // wall's low RAW power over a merge's real board impact). scoreShop stays the
    // long-term prior; sim-measured, merge-aware Δwin is added on the same 0–100 pct
    // scale, weighted UP when lives are scarce (win-now) and gently down when safe.
    if (baseWin) {
      // Weight scales UP as lives run out (win-now), but stays ≥1.5 even when safe —
      // a large Δwin gap (like +42 vs +13) must flip the pick even past a big scoreShop
      // lead, else the app contradicts the very number it shows. Small Δwin diffs (the
      // common early game where nothing swings the fight) barely move the blend, so
      // scoreShop's long-term value still rules there. Scalar key → transitive sort.
      const wLives = live.lives <= 2 ? 2.2 : live.lives <= 4 ? 1.8 : 1.5;
      shopRes.rows.forEach(r => { try { const b2 = applyOfferToBoard(r.m); if (b2) { const w2 = quickWinPct(b2, 24, r.m.id); if (w2) { r.dwin = Math.round(w2.win - baseWin.win); r._replaced = b2._replaced; } } } catch (e) {} });
      shopRes.rows.forEach(r => { r.blend = r.pct + (r.dwin || 0) * wLives; });
      shopRes.rows.sort((a, b) => (b.blend - a.blend) || (b.raw - a.raw));
    }
    // snapshot ranks for decision grading (what the brain said AT this moment)
    if (shopRes) {
      const topPct = shopRes.rows[0] ? shopRes.rows[0].pct : 100;
      lastShopRanks = { byId: {} };
      shopRes.rows.forEach((r, i) => { if (!lastShopRanks.byId[r.m.id]) lastShopRanks.byId[r.m.id] = { rank: i + 1, pct: r.pct, gap: Math.max(topPct - r.pct, 0) }; });
    } else lastShopRanks = null;
    lastRerollVerdict = verdictLive ? verdictLive.verdict : null;
    // sell/item decision snapshots (what the brain recommended at this moment)
    try {
      const prot = protectedUnitIds();
      const counts = liveOwnedCounts();
      const owned = [...live.board.map((s) => s && { s, zone: 'board' }), ...(live.bench || []).map((s) => s && { s, zone: 'bench' })].filter(Boolean)
        .filter(o => !prot.has(o.s.monsterId) && !/egg/i.test(o.s.monsterId));
      const cut = owned.map(o => ({ id: o.s.monsterId, v: saleValueOf(o, counts) })).sort((a, b) => a.v - b.v)[0];
      lastSellSnapshot = { protected: [...prot], cutId: cut ? cut.id : null };
      lastItemAdvice = {};
      (live.shopItems || []).forEach(id => { try { const a = itemAdvice(id, { shop: live.shop, itemUses: live.itemUses }); if (a) lastItemAdvice[id] = a.v || a.verdict || ''; } catch (e) {} });
    } catch (e) { lastSellSnapshot = null; lastItemAdvice = {}; }

    // 🧭 THIS TURN — coordinating header: makes every box below agree
    html += coordinationHTML(shopRes, verdictLive);

    html += mulliganCardHTML(ctx, live.shop, live.shopRank, live.gold, ownedIdsLive);

    // 1) shop ranking
    if (live.shop.length) {
      const res = shopRes;
      // the 🎰 verdict above is the single source of truth on keep/reroll —
      // only fall back to the engine's coarse note when it couldn't compute
      html += `<div class="card"><h3>🛒 Buy advice <span style="font-size:10.5px;color:var(--muted);font-weight:400">· recalculates live on every board/shop/gold/trainer change</span></h3>${res.reroll && !verdictLive ? `<div class="reroll-note" style="margin:8px 0">🎲 ${esc(res.reroll)}</div>` : ''}`;
      // ⚔️ Δwin% chips reuse r.dwin computed up front (merge/evolution-aware) — the
      // SAME number the ranking above is blended from, so chip and order can't disagree.
      res.rows.forEach((r, i) => {
        const pctCls = r.pct >= 90 ? 'p90' : r.pct >= 65 ? 'p70' : 'p0';
        let dwChip = '';
        if (r.dwin != null) {
          const d = r.dwin;
          dwChip = `<span class="chip ${d > 3 ? 'good' : d < -3 ? 'warn' : ''}" style="font-size:10px" title="Event-sim: buying this shifts today's win chance ${d >= 0 ? '+' : ''}${d}% (vs day-average enemy)${r._replaced ? ` — replacing ${esc(r._replaced)} (board full)` : ''}">⚔️ ${d >= 0 ? '+' : ''}${d}% win${r._replaced ? ' ⇄' : ''}</span>`;
        }
        html += `<div class="result-card ${i === 0 ? 'top' : ''}" style="grid-template-columns:56px 1fr 90px;padding:10px 12px;margin-bottom:8px" onclick="window.__dex('${r.m.id}')">
          <img class="sprite" src="${spr(r.offer.shiny && r.m.shinySprite ? r.m.shinySprite : r.m.sprite)}" style="width:48px;height:48px">
          <div><div class="name" style="font-size:13.5px">${i === 0 ? '👉 ' : ''}${r.offer.shiny ? '✨ ' : ''}${esc(r.m.name)} <span style="color:var(--muted);font-size:11px">$${r.m.cost}</span></div>
          <div class="chips">${dwChip}${r.chips.slice(0, 3).map(ch => `<span class="chip ${/Real|Proven|combo|LEVELS|EVOLUTION|Your /.test(ch) ? 'good' : ''}" style="font-size:10px">${esc(ch)}</span>`).join('')}<button class="sim-btn" onclick="event.stopPropagation();window.__sim('${r.m.id}')" title="Preview this buy — board, damage & win% change, without committing">🔬 Simulate</button></div></div>
          <div class="pct ${pctCls}" style="text-align:right"><div class="big" style="font-size:22px">${r.pct}%</div></div></div>`;
      });
      html += '</div>';
    }

    // 1.1) 💰 SELL advice — ALWAYS shown, right next to buy advice: swaps,
    // gold-crunch sales, sell-value banks, and the standing cut order.
    {
      const ownedSlots = [
        ...live.board.map((s, i) => s && { s, zone: 'board', label: SLOT_SHORT[i] }),
        ...(live.bench || []).map((s, i) => s && { s, zone: 'bench', label: 'bench ' + (i + 1) }),
      ].filter(Boolean);
      const freeSlots = 6 + (live.bench || []).length - ownedSlots.length;
      const tips = [];
      let cutOrder = [];
      if (ownedSlots.length >= 2) {
        const protectedIds = protectedUnitIds();
        const inPlanS = protectedIds; // protection = plan + adopted/detected engines
        const speciesCount = {};
        ownedSlots.forEach(o => { speciesCount[o.s.monsterId] = (speciesCount[o.s.monsterId] || 0) + 1; });
        // eggs are hatching value bombs (Dragon Egg → Dragonarch) — never sell them
        const sellable = ownedSlots.filter(o => !/egg/i.test(o.s.monsterId));
        const ranked = sellable.map(o => ({ ...o, v: saleValueOf(o, speciesCount) })).sort((a, b) => a.v - b.v);
        const weakest = ranked.find(o => !protectedIds.has(o.s.monsterId)) || ranked[0];
        const avgV = ranked.reduce((a, x) => a + x.v, 0) / Math.max(ranked.length, 1);
        const wkName = weakest && (monById[weakest.s.monsterId] || {}).name;
        const wkPct = weakest ? Math.round((weakest.v / Math.max(avgV, 1)) * 100) : 0;
        const saleRanked = ranked.map(o => ({ ...o, dup: speciesCount[o.s.monsterId] >= 2, saleScore: o.v }))
          .filter(o => !protectedIds.has(o.s.monsterId));
        const sale = saleRanked[0];
        const saleName = sale && (monById[sale.s.monsterId] || {}).name;
        cutOrder = saleRanked.slice(0, 3).map(o => `<b>${esc((monById[o.s.monsterId] || {}).name)}</b> (${o.label}${o.dup ? ', dup' : ''}${o.zone === 'bench' ? ', benched' : ''}, ~${Math.round((o.v / Math.max(avgV, 1)) * 100)}%)`);
        // (a) full roster + strong offers you can't place → SWAP analysis per offer
        if (freeSlots === 0 && live.shop.length && sale) {
          const resSell = E.scoreShop(live.shop, ctx);
          const top = resSell.rows[0];
          const seenSpecies = new Set();
          for (const row of resSell.rows.slice(0, 4)) {
            if (seenSpecies.has(row.m.id)) continue;
            // affordability anchors pct low when nothing is buyable — judge by
            // strength WITHIN the shop + engine rationale instead
            const strength = top ? row.raw / Math.max(top.raw, 0.001) : 0;
            const feederChip = (row.chips || []).find(ch => /Buy FIRST — every later|Feeds .*passive/.test(ch));
            const comboChip = (row.chips || []).find(ch => /Completes a proven|Proven pair/.test(ch));
            const stratChip = (row.chips || []).find(ch => /^♟️/.test(ch));
            if (strength < 0.85 && !feederChip && !comboChip && !stratChip) continue;
            seenSpecies.add(row.m.id);
            // ⚔️ swap Δwin%: sim the actual exchange (only when the cut is FIELDED)
            let swapDW = '';
            const saleSlot = live.board.findIndex(s => s === sale.s);
            if (saleSlot >= 0) {
              const b2 = live.board.map(s => s ? { ...s } : null);
              b2[saleSlot] = { monsterId: row.m.id, level: 1, shiny: false };
              const w0 = quickWinPct(live.board, 24, 'sbase'), w1 = quickWinPct(b2, 24, 'swap' + row.m.id);
              if (w0 && w1) { const dd = Math.round(w1.win - w0.win); swapDW = ` <span class="chip ${dd > 2 ? 'good' : dd < -2 ? 'warn' : ''}" style="font-size:10px" title="Event-sim: today's win chance if you make this exact swap">⚔️ ${dd >= 0 ? '+' : ''}${dd}% win</span>`; }
            }
            const why = (stratChip ? ` — ${esc(stratChip)}` : feederChip ? ` — it's an ENGINE: ${esc(feederChip.replace(/^Buy FIRST — /, ''))}` : comboChip ? ` — ${esc(comboChip)}` : ` — top of this shop`) + swapDW;
            const short = row.m.cost - live.gold;
            if (short > 0) {
              tips.push(`<b>SWAP?</b> sell <b>${esc(saleName)}</b>${sale.dup ? ` (you own ${speciesCount[sale.s.monsterId]} copies — losing one keeps the merge line)` : ` (weakest, ~${Math.round((sale.v / Math.max(avgV, 1)) * 100)}%)`} → <b>${esc(row.m.name)}</b>${why}. ⚠️ You're <b>$${short} short</b> at $${live.gold} — only commit if the sale covers it, otherwise 🔒 lock the shop and buy tomorrow (+$${nextIncomeL()} income).`);
            } else {
              tips.push(`<b>SWAP worth it:</b> sell <b>${esc(saleName)}</b>${sale.dup ? ` (one of ${speciesCount[sale.s.monsterId]} copies)` : ` (weakest, ~${Math.round((sale.v / Math.max(avgV, 1)) * 100)}%)`} → buy <b>${esc(row.m.name)}</b> ($${row.m.cost} ≤ $${live.gold})${why}.`);
            }
            if (tips.length >= 3) break;
          }
          if (!tips.length && weakest && !inPlanS.has(weakest.s.monsterId)) {
            tips.push(`Board & bench <b>FULL</b> — nothing in shop clearly beats your roster; if you need a slot, <b>${esc(wkName)}</b> (${weakest.label}, ~${wkPct}%) is the cut.`);
          }
        }
        // (b) gold crunch: the verdict wants something you can't afford — selling covers it faster than waiting
        if (weakest && verdictLive && (verdictLive.verdict === 'LOCK' || verdictLive.verdict === 'REROLL') && live.gold < 15 && wkPct <= 70 && !inPlanS.has(weakest.s.monsterId)) {
          tips.push(`Gold crunch at $${live.gold}: <b>${esc(wkName)}</b> is ~${wkPct}% of your average unit — selling it buys tempo NOW instead of waiting a day.`);
        }
        // (c) sell-value banks: units whose job is generating value, cashed late
        for (const o of ownedSlots) {
          const m = monById[o.s.monsterId] || {};
          const abT = ((m.ability && (m.ability.description || (m.ability.byLevel || {})['1'])) || '').toLowerCase();
          if (/sell value/.test(abT) && live.day >= 7) {
            tips.push(`<b>${esc(m.name)}</b> banks sell value — from day ${live.day} it's a piggy bank: cash it when you need the slot or the gold spike.`);
          }
          if (m.id === 'wishwash' && live.day >= 8) tips.push(`<b>Wishwash</b> has farmed its trinkets — it sells for $20; late game the slot is worth more than the heals.`);
        }
      }
      const sellBody = tips.length
        ? `<ul style="margin:8px 0 0 18px;font-size:12.5px;display:flex;flex-direction:column;gap:5px">${[...new Set(tips)].map(t => `<li>${t}</li>`).join('')}</ul>`
        : ownedSlots.length >= 2
          ? `<div style="font-size:12.5px;margin-top:8px"><b class="wr-good">✅ No urgent sale</b> — everyone's earning their slot${freeSlots > 0 ? ` (${freeSlots} free slot${freeSlots > 1 ? 's' : ''} left)` : ''}.${cutOrder.length ? `<div style="margin-top:6px;color:var(--muted)">Cut order if you ever need room: ${cutOrder.map((c, i) => `${i + 1}. ${c}`).join(' · ')}</div>` : ''}</div>`
          : '<div class="note" style="margin:8px 0 0">Build up a roster first — sell logic kicks in from 2 units.</div>';
      html += `<div class="card" style="margin-top:12px"><h3>💰 Sell advice</h3>${sellBody}
        <div class="note" style="margin:6px 0 0;font-size:10px">Protected — never offered as "weakest": plan pieces (🎯), your adopted strategy's pieces &amp; focus (♟️), the key units of any <b>detected engine</b> that's worth-it even if you haven't adopted it (e.g. a Berroon powering an item engine), fed (🌱) &amp; leveled units, and hatching eggs (🥚).</div></div>`;
    }

    // 1.2) BUY ORDER — greedy simulation: what to buy in which sequence, with gold.
    // Order matters: Bug Catcher's free-first-bug wants the PRICIEST bug first,
    // feeders (Guardiant/Cinderfly/Shogapede) want to land BEFORE their food.
    if (live.shop.length >= 2 || (live.shopItems || []).length) {
      const simTeam = live.board.map(s => (s ? { ...s } : null));
      const simBench = (live.bench || []).map(s => (s ? { ...s } : null));
      let gold = live.gold;
      let bugUsed = !!(live.trainerData || {}).bugBought;
      let pool = live.shop.slice();
      const seq = [];
      const simHeld = [];
      // economy items go FIRST: a Coupon cuts every monster below by $5, so it
      // must be bought before any of them — the whole sim runs discounted
      let couponStep = null;
      if ((live.shopItems || []).includes('coupon') && live.shop.length >= 2) {
        const cAdv = itemAdvice('coupon');
        const cIt = D.items.find(x => x.id === 'coupon');
        if (cAdv && cAdv.v === 'BUY' && cIt && cIt.cost <= gold) {
          gold -= cIt.cost;
          simHeld.push('coupon');
          couponStep = { it: cIt, why: cAdv.why, roll: null };
        }
      }
      const effCostOf = (m, isFree) => {
        let c = isFree ? 0 : m.cost;
        if (c > 0 && simHeld.includes('coupon')) c = Math.max(c - 5, 0);
        return c;
      };
      const hasRoom = (m) => {
        // merges don't need a slot; new species need a free board OR bench slot
        const ownsCopy = [...simTeam, ...simBench].some(s => s && s.monsterId === m.id);
        if (ownsCopy) return true;
        return simTeam.some(s => !s) || simBench.some(s => !s);
      };
      for (let step = 0; step < Math.min(5, live.shop.length); step++) {
        if (!pool.length) break;
        const counts = {};
        [...simTeam, ...simBench].forEach(s => { if (s) counts[s.monsterId] = (counts[s.monsterId] || 0) + 1; });
        const res = E.scoreShop(pool, Object.assign({
          day: live.day, gold, trainerId: effectiveTrainerId(),
          trainerData: Object.assign({}, live.trainerData, { bugBought: bugUsed }),
          team: simTeam, ownedCounts: counts, trinkets: live.trinkets, compIds: ctx.compIds, heldItems: simHeld,
        }, strategyCtxFields()));
        let pick = res.rows.find(r => {
          const bug = (r.m.types || []).some(t => t.id === 'bug');
          const free = effectiveTrainerId() === 'bug_catcher' && !bugUsed && bug;
          return effCostOf(r.m, free) <= gold && hasRoom(r.m); // budget AND space aware
        });
        if (!pick) break;
        // discount maximization: if the free-first-bug is about to be spent,
        // give it to the PRICIEST bug among near-equal picks (within 12% score)
        if (effectiveTrainerId() === 'bug_catcher' && !bugUsed && (pick.m.types || []).some(t => t.id === 'bug')) {
          const richerBug = res.rows.find(r => r !== pick && r.raw >= pick.raw * 0.88 && (r.m.types || []).some(t => t.id === 'bug') && r.m.cost > pick.m.cost && hasRoom(r.m));
          if (richerBug) pick = richerBug;
        }
        const bug = (pick.m.types || []).some(t => t.id === 'bug');
        const free = effectiveTrainerId() === 'bug_catcher' && !bugUsed && bug;
        const cost = effCostOf(pick.m, free);
        gold -= cost;
        if (free) bugUsed = true;
        const emptyT = simTeam.findIndex(x => !x);
        const unit = { monsterId: pick.m.id, level: pick.offer.level || 1, shiny: !!pick.offer.shiny };
        if (emptyT >= 0) simTeam[emptyT] = unit;
        else { const emptyB = simBench.findIndex(x => !x); if (emptyB >= 0) simBench[emptyB] = unit; }
        const why = pick.chips.find(ch => /Buy FIRST|FREE|Feeds|LEVEL|EVOLUTION|Comp piece|Proven|Real Master|Coupon/.test(ch)) || pick.chips[0] || '';
        seq.push({ m: pick.m, cost, free, why, shiny: !!pick.offer.shiny, discounted: cost > 0 && simHeld.includes('coupon') });
        pool = pool.filter(o2 => o2 !== pick.offer);
      }
      // FEEDER BEFORE FOOD — an on-buy feeder (Guardiant: "+Dmg after you buy a
      // Bug") must land BEFORE its food, so every later food purchase feeds the
      // HIGHER-level feeder (+14 not +7). The greedy VALUE order can put a big
      // food-merge first (a 3rd Stingarde → L3, raw 148) and bury the feeder
      // (L2 merge, raw 16); reorder so the feeder precedes any of its food type.
      const foodTypeOf = (mid) => {
        const ab = (monById[mid] || {}).ability;
        const d = ab && (ab.description || (ab.byLevel && ab.byLevel['1']) || '');
        const mm = typeof d === 'string' ? d.match(/buy an?\s+([A-Za-z]+)\s+monster/i) : null;
        return mm ? mm[1].toLowerCase() : null;
      };
      for (let pass = 0; pass < seq.length; pass++) {
        let swapped = false;
        for (let i = 1; i < seq.length; i++) {
          const food = foodTypeOf(seq[i].m.id); // seq[i] is a feeder that eats `food`
          const prevIsFeeder = !!foodTypeOf(seq[i - 1].m.id); // don't bubble past another feeder (would oscillate)
          if (food && !prevIsFeeder && (seq[i - 1].m.types || []).some(t => t.id === food)) {
            const tmp = seq[i - 1]; seq[i - 1] = seq[i]; seq[i] = tmp;
            if (!/Buy FIRST|feeds it/i.test(seq[i - 1].why || '')) seq[i - 1].why = `Buy FIRST — level it now so every later ${food} you buy feeds the higher tier`;
            swapped = true;
          }
        }
        if (!swapped) break;
      }
      const skippedForSpace = pool.filter(o => { const m = monById[o.monsterId]; return m && !hasRoom(m); }).length;
      // remaining BUY-verdict items (cheapest first) with their roll odds —
      // evaluated against the POST-PURCHASE roster (board + bench after buys)
      const teamAfterBuys = [...simTeam, ...simBench];
      const itemSteps = [];
      (live.shopItems || []).filter(iid => !(couponStep && iid === 'coupon'))
        .map(iid => ({ iid, adv: itemAdvice(iid, teamAfterBuys) }))
        .filter(x => x.adv && x.adv.v === 'BUY')
        .sort((a, b) => itemCost(a.adv.it) - itemCost(b.adv.it))
        .forEach(x => {
          if (itemCost(x.adv.it) > gold) return; // budget-aware after the monster buys
          gold -= itemCost(x.adv.it);
          itemSteps.push({ it: x.adv.it, why: x.adv.why, roll: itemRollAnalysis(x.iid, teamAfterBuys) });
        });
      const itemLi = (x, first) => `<li>${first ? '🥇' : '🧪'} <img class="sprite" src="${spr(x.it.sprite)}" width="22" style="vertical-align:middle"> <b>${esc(x.it.name)}</b> ${itemCost(x.it) ? '−$' + itemCost(x.it) : '<b style="color:var(--green)">FREE</b>'} <span class="chip good" style="font-size:10px">${esc(x.why.slice(0, 70))}</span>${rollLineHTML(x.roll)}${targetLineHTML(itemTargetAdvice(x.it.id, teamAfterBuys))}</li>`;
      if (seq.length >= 1 || itemSteps.length || couponStep || skippedForSpace) {
        html += `<div class="card" style="margin-top:12px"><h3>🧾 Buy order <span style="font-size:10px;color:var(--muted);font-weight:400">· sequence-aware: economy items first, free-first-bug, feeders before food, merges, space, budget</span></h3>
          <ol style="margin:8px 0 0 20px;font-size:12.5px;display:flex;flex-direction:column;gap:6px">
          ${couponStep ? itemLi(couponStep, true) : ''}
          ${seq.map(x => `<li><img class="sprite" src="${spr(x.shiny && x.m.shinySprite ? x.m.shinySprite : x.m.sprite)}" width="24" style="vertical-align:middle"> <b>${x.shiny ? '✨ ' : ''}${esc(x.m.name)}</b> ${x.free ? '<b style="color:var(--green)">FREE</b>' : `−$${x.cost}${x.discounted ? ` <s style="color:var(--muted);font-size:10px">$${x.m.cost}</s>` : ''}`}${x.why ? ` <span class="chip good" style="font-size:10px">${esc(x.why.slice(0, 62))}</span>` : ''}</li>`).join('')}
          ${itemSteps.map(x => itemLi(x, false)).join('')}
          </ol>
          <div class="note" style="margin:8px 0 0">Gold after this plan: <b style="color:var(--gold)">$${gold}</b>${pool.length ? ` · skips ${pool.length} offer${pool.length > 1 ? 's' : ''} (${skippedForSpace ? `${skippedForSpace} for SPACE — see 💰 sell advice` : 'budget/value'})` : ' · buys the whole shop'}</div></div>`;
      }
    }

    // 1.4) items on offer — explicit BUY / MAYBE / SKIP with reasons
    if ((live.shopItems || []).length) {
      const advs = live.shopItems.map(id => itemAdvice(id)).filter(Boolean);
      if (advs.length) {
        const chipCls = { BUY: 'wr-good', MAYBE: 'wr-ok', SKIP: 'wr-low' };
        // ⚔️ Δwin% for STAT-FEED items (same currency as the buy rows): parse
        // "+N Stat" from the description, feed it to the strongest fielded
        // target, re-sim. Non-stat items (gold, candy, rerolls) show no chip —
        // their value isn't a battle delta and we don't fake one.
        const itemDW = (it) => {
          const m = (it.description || '').match(/\+(\d+)%? (Damage|Burn|Poison|Shock|Heal(?:ing)?|Shield|Cooldown Speed|Multicast)/i);
          if (!m) return '';
          const amt = +m[1];
          const key = { damage: 'dmg', burn: 'burn', poison: 'poison', shock: 'shock', heal: 'heal', healing: 'heal', shield: 'shield', 'cooldown speed': 'cds', multicast: 'mc' }[m[2].toLowerCase()];
          if (!key) return '';
          let ti = -1, best = -1;
          live.board.forEach((s, i) => { if (!s) return; let v = 0; try { v = unitOutput(s, live.day, i).dps; } catch (e) {} if (v > best) { best = v; ti = i; } });
          if (ti < 0) return '';
          const b2 = live.board.map(s => s ? { ...s, feed: Object.assign({ dmg: 0, cds: 0, heal: 0, shield: 0, burn: 0, poison: 0, shock: 0, mc: 0 }, s.feed) } : null);
          b2[ti].feed[key] += amt;
          const w0 = quickWinPct(live.board, 24, 'ibase'), w1 = quickWinPct(b2, 24, 'item' + it.id);
          if (!w0 || !w1) return '';
          const d = Math.round(w1.win - w0.win);
          return ` <span class="chip ${d > 2 ? 'good' : ''}" style="font-size:10px" title="Event-sim: fed to ${esc((monById[b2[ti].monsterId] || {}).name || '')}">⚔️ ${d >= 0 ? '+' : ''}${d}% win</span>`;
        };
        html += `<div class="card" style="margin-top:12px"><h3>🧪 Item advice</h3>
          ${advs.map(a => `<div class="pk-row" style="margin-top:6px;display:block">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            <img class="sprite" src="${spr(a.it.sprite)}" width="26" height="26">
            <b style="font-size:12px">${esc(a.it.name)}</b> <span style="color:var(--gold);font-size:11px">${itemCost(a.it) ? '$' + itemCost(a.it) : 'free'}</span>
            <b class="${chipCls[a.v]}" style="font-size:11px">${a.v === 'BUY' ? '✓ BUY' : a.v === 'MAYBE' ? '~ MAYBE' : '✗ SKIP'}</b>${itemDW(a.it)}
            <span style="font-size:11px;color:var(--muted);min-width:0">${esc(a.why)}</span></div>
            ${rollLineHTML(itemRollAnalysis(a.it.id))}${targetLineHTML(itemTargetAdvice(a.it.id))}</div>`).join('')}</div>`;
      }
    }



    // 1.55) ♟️ STRATEGY BRAIN — detected engine plays, adoptable UP TO 3 at once. The
    // ★ PRIMARY re-aims buys/sells/positioning around its focus; running 2+ adds the
    // ⚖️ which-to-chase read (stack vs compete + which the enemy rewards).
    {
      const plays = detectStrategies();
      const acts = activeStrategies();
      const activeIds = new Set(acts.map(a => a.id));
      const primId = acts.length ? acts[0].id : null;
      if (plays.length || acts.length) {
        const rows = plays.map(p => {
          const isActive = activeIds.has(p.st.id);
          const isPrimary = isActive && p.st.id === primId;
          const focusName = p.focusId ? (monById[p.focusId] || {}).name : null;
          const atCap = !isActive && acts.length >= STRAT_CAP;
          let btns;
          if (isActive) {
            btns = `${acts.length >= 2 ? (isPrimary
              ? '<b class="wr-good" style="font-size:9.5px;padding:2px 6px">★ PRIMARY</b>'
              : `<button class="ghost strat-primary" data-id="${p.st.id}" style="font-size:9.5px;padding:3px 8px">★ make primary</button>`) : ''}
              <button class="ghost strat-toggle" data-id="${p.st.id}" data-focus="${p.focusId || ''}" style="font-size:10.5px;padding:3px 10px;border-color:var(--green);color:var(--green)">✓ adopted — drop</button>`;
          } else {
            btns = atCap
              ? `<span style="font-size:9.5px;color:var(--muted)">cap ${STRAT_CAP} — drop one to add</span>`
              : `<button class="ghost strat-toggle" data-id="${p.st.id}" data-focus="${p.focusId || ''}" style="font-size:10.5px;padding:3px 10px">▶ Adopt</button>`;
          }
          return `<div class="pk-row" style="display:block;margin-top:6px${isActive ? ';border-color:rgba(61,220,132,.55)' : ''}">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <b style="font-size:12.5px">${p.st.icon} ${esc(p.st.name)}</b>
              ${p.worth ? '<b class="wr-good" style="font-size:10.5px">WORTH A SHOT</b>' : '<b class="wr-low" style="font-size:10.5px">NOT NOW</b>'}
              <span style="font-size:10px;color:var(--muted)">${esc(p.whyWorth)}</span>
              <span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${btns}</span>
            </div>
            <div style="font-size:11.5px;color:var(--text);opacity:.9;margin-top:4px">${p.detail}</div>
            ${focusName ? `<div style="font-size:10px;color:var(--muted);margin-top:2px">🎯 focus: <b>${esc(focusName)}</b> — adopted plays concentrate CDS/donations on their focus instead of raw damage</div>` : ''}
            ${(isPrimary || (isActive && acts.length === 1)) ? strategyPlanHTML(acts.find(a => a.id === p.st.id)) : ''}
          </div>`;
        }).join('');
        // adopted plays whose trigger has left the shop — still steering, still droppable
        const offShop = acts.filter(a => !plays.some(p => p.st.id === a.id));
        const offHTML = offShop.map(a => `<div class="verdict keep" style="margin-top:8px">♟️ <b>${esc((STRATEGY_LIB.find(s => s.id === a.id) || {}).name || a.id)}</b> is ADOPTED${a.id === primId && acts.length >= 2 ? ' ★' : ''} (trigger left the shop — still steering). <button class="ghost strat-toggle" data-id="${a.id}" style="font-size:10px;padding:2px 8px">drop</button>${a.id === primId ? strategyPlanHTML(a) : ''}</div>`).join('');
        html += `<div class="card" style="margin-top:12px"><h3>♟️ Strategy plays <span style="font-size:10px;color:var(--muted);font-weight:400">· engines in YOUR state — adopt up to ${STRAT_CAP}; the ★ primary re-aims the whole advisor${acts.length >= 2 ? ', and the ⚖️ read below says which to chase' : ''}</span></h3>
          ${multiStrategyBrainHTML()}
          ${offHTML}
          ${rows || '<div class="note" style="margin:6px 0 0">No engine plays detected in the current shop/board.</div>'}</div>`;
      }
    }

    // → everything above is SHOP/BUY intelligence (middle column)
    outBuy.innerHTML = pendingEventHTML() + (html || '<div class="reroll-note">Add what the shop offers — buy advice appears here instantly.</div>');
    // wire the strategy adopt/drop/primary buttons (innerHTML just recreated the nodes)
    outBuy.querySelectorAll('.strat-toggle').forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      const was = (live.strategies || []).some(s => s && s.id === id);
      toggleStrategy(id, b.dataset.focus || null); // handles cap + keeps live.strategy = primary + saves
      if (!was) { const sd = STRATEGY_LIB.find(s => s.id === id); logRun('strategy', `Adopted ${sd ? sd.name : id}${b.dataset.focus ? ' → focus ' + ((monById[b.dataset.focus] || {}).name || b.dataset.focus) : ''}`); }
      renderLive();
    });
    outBuy.querySelectorAll('.strat-primary').forEach(b => b.onclick = () => { setPrimaryStrategy(b.dataset.id); renderLive(); });
    // 🗖 OVERLAY: mirror the 🧭 card + a status strip into the floating window
    if (window.__ovl) {
      try {
        const coord = outBuy.querySelector('#coord-card');
        const wp = lastPrediction && lastPrediction.day === live.day ? ` · ⚔️ ~${lastPrediction.win}% win` : '';
        window.__ovl.innerHTML = `<div style="font-size:12px;color:#8a8a95;margin-bottom:6px">Day <b style="color:#e8e8ee">${live.day}</b> · $${live.gold} · ${live.lives} ❤ · ${live.badges} 🏅${wp}</div>` +
          (coord ? coord.outerHTML : '<div class="note">Waiting for a shop… the 🧭 plan appears here.</div>');
      } catch (e) {}
    }
    html = '';

    // 1.0) 🧠 RUN BRAIN — strategic direction + pivot branches + phase/econ vision,
    // ABOVE the tactical battle brain. Answers "where is this run going" before the
    // per-turn boxes answer "what do I click now".
    html += runBrainHTML(rbrain);

    // 1.5) battle brain: expected fight vs the day's real average enemy + positioning
    html += battleBrainHTML(verdictLive);

    // 2) board estimate: largest measured combo contained in the board
    const boardIds = [...new Set(live.board.filter(s => s).map(s => s.monsterId))];
    if (SY && SY.combos && boardIds.length >= 2) {
      let best = null;
      for (const k of ['6', '5', '4', '3', '2']) {
        for (const c of SY.combos[k] || []) {
          if (c.ids.every(id => boardIds.includes(id))) { best = c; break; }
        }
        if (best) break;
      }
      if (best) {
        html += `<div class="card" style="margin-top:12px"><h3>📈 Closest measured comp on your board</h3>
          <div style="margin-top:8px;font-size:13px">${best.ids.map(id => { const m = monById[id]; return `<img class="sprite" src="${spr(m ? m.sprite : '')}" width="30" style="vertical-align:middle" title="${esc(m ? m.name : id)}">`; }).join(' ')}
          → ${wrSpan(best.winRate, best.rounds)} WR ${confDot(best.rounds)} <span style="cursor:help" title="${LIFT_TITLES.combos}">(${best.lift >= 0 ? '+' : ''}${best.lift}pp lift, ${best.rounds} rounds at top ranks)</span></div></div>`;
      }
    }

    // 3) shopping list: what to LOOK for (not currently offered)
    {
      const offered = new Set(live.shop.map(o => o.monsterId));
      const odds = effectiveOdds(live.shopRank);
      const maxTier = Math.max(...odds.map((o, i) => (o > 0 ? i + 1 : 0)));
      const pool = shopPool.filter(m => m.tier <= maxTier && odds[m.tier - 1] > 0 && !offered.has(m.id) && !m.isEvolvedForm);
      const hypo = pool.map(m => ({ monsterId: m.id, level: 1, shiny: false }));
      const res = E.scoreShop(hypo, Object.assign({}, ctx, { gold: null })); // ignore affordability for the wishlist
      const top = res.rows.slice(0, 6);
      const oddsLine = odds.map((o, i) => (o > 0 ? `${RAR_NAMES[i].slice(0, 1)} ${o}%` : null)).filter(Boolean).join(' · ');
      html += `<div class="card" style="margin-top:12px"><h3>🔎 Shopping list — reroll targets (Shop Lv ${live.shopRank})</h3>
        <div class="note" style="margin:4px 0 8px">Rarity odds at your shop level${live.trinkets.some(id => ['Research Notes', 'VIP Pass'].includes((D.trinkets.find(t => t.id === id) || {}).name)) ? ' (trinket-adjusted)' : ''}: <b>${oddsLine}</b> — ranked for YOUR board/trainer/trinkets.</div>
        <div class="band-items">${top.map(r => `<div class="tier-item" onclick="window.__dex('${r.m.id}')">
          <img class="sprite" src="${spr(r.m.sprite)}"><div>
          <div style="font-size:12px;font-weight:600">${esc(r.m.name)} <span class="pr">$${r.m.cost}</span></div>
          <div class="pr" style="max-width:230px">${esc((r.chips.find(c => /Real|Proven|combo|Your |synerg|stack/i.test(c)) || r.chips[0] || '').slice(0, 60))}</div></div></div>`).join('')}</div></div>`;
    }

    // 4) trinket advice
    if (SY && (SY.trinketSets || SY.trinketCombos)) {
      const tips = [];
      // partners for trinkets you own
      for (const owned of live.trinkets) {
        const p = ((SY.trinketSets && SY.trinketSets['2']) || []).find(s => s.ids.includes(owned) && !s.ids.every(id => live.trinkets.includes(id)));
        if (p) {
          const other = p.ids.find(id => id !== owned);
          const to = D.trinkets.find(t => t.id === other);
          tips.push(`Your <b>${esc((D.trinkets.find(t => t.id === owned) || { name: humanize(owned) }).name)}</b> pairs with <b>${esc(to ? to.name : humanize(other))}</b>: ${p.winRate}% WR together (${p.lift >= 0 ? '+' : ''}${p.lift}pp)`);
        }
      }
      // best trinket for the current board
      if (boardIds.length >= 1) {
        let bestB = null;
        for (const k of ['2', '1']) {
          for (const c of (SY.trinketCombos && SY.trinketCombos[k]) || []) {
            if (live.trinkets.includes(c.trinket)) continue;
            if (c.ids.every(id => boardIds.includes(id))) { if (!bestB || c.winRate > bestB.winRate) bestB = c; }
          }
          if (bestB) break;
        }
        if (bestB) {
          const t = D.trinkets.find(x => x.id === bestB.trinket);
          tips.push(`Gift priority for this board: <b>${esc(t ? t.name : humanize(bestB.trinket))}</b> — with ${bestB.ids.map(id => (monById[id] || { name: id }).name).join('+')} it wins ${bestB.winRate}% (${bestB.lift >= 0 ? '+' : ''}${bestB.lift}pp)`);
        }
      }
      if (tips.length) html += `<div class="card" style="margin-top:12px"><h3>💎 Trinket intel</h3><ul style="margin:8px 0 0 18px;font-size:12.5px">${tips.map(t => `<li>${t}</li>`).join('')}</ul></div>`;
    }

    if (!html) html = '<div class="reroll-note">Pick a trainer and add board/shop entries — the Battle Brain appears here instantly.</div>';
    outBrain.innerHTML = html;
    // rotate the strategy focus to the next carry (chain reached the CDS floor)
    outBrain.querySelectorAll('.strat-rotate').forEach(elx => elx.onclick = () => {
      const s = (live.strategies || []).find(x => x && x.id === elx.dataset.sid) || live.strategy;
      if (s) { s.focusId = elx.dataset.id; saveLive(); renderLive(); }
    });
  }

  // ---------------- ADVISOR TAB ----------------
  function renderAdvisor() {
    const root = $('#tab-advisor');
    root.innerHTML = `
      <h2>Shop Pick Advisor</h2>
      <div class="note">Set your run context, add what the shop is offering, and get Mobalytics-style pick percentages.
        Trainer/trinket numbers are <b>real Master Ranked data</b>; monster scores are a transparent power model (day-weighted DPS + scaling + synergy + patch adjustments). ${esc(GNOTE() ? '' : '')}</div>
      <div class="advisor-grid">
        <div class="card" id="adv-left"></div>
        <div id="adv-right">
          <div class="card" id="adv-shop"></div>
          <div id="adv-results" style="margin-top:16px"></div>
        </div>
      </div>`;
    renderAdvisorLeft();
    renderAdvisorShop();
  }

  function autoAdvice() { // advisor tab: recompute automatically once offers exist
    if (state.offers.length && $('#adv-results')) runAdvice();
  }
  function renderAdvisorLeft() {
    hcHide();
    const left = $('#adv-left');
    const trainerOpts = D.trainers
      .slice().sort((a, b) => (b.stats ? b.stats.winRate : 0) - (a.stats ? a.stats.winRate : 0))
      .map(t => `<option value="${t.id}" ${t.id === state.trainerId ? 'selected' : ''}>${esc(t.name)}${t.stats ? ' — ' + t.stats.winRate + '% WR' : ''}</option>`)
      .join('');
    left.innerHTML = `
      <h3>Run context</h3>
      <div class="row" style="gap:10px">
        <label class="ctl">Day<input type="number" id="adv-day" min="1" max="40" value="${state.day}" style="width:64px"></label>
        <label class="ctl">Gold $<input type="number" id="adv-gold" min="0" max="9999" value="${state.gold}" style="width:72px"></label>
        <label class="ctl" title="Rarity odds driver — leave empty to track the day (1:1 up to 14)">Shop Lv<input type="number" id="adv-rank" min="1" max="14" value="${state.shopRank || ''}" placeholder="${Math.min(state.day, 14)}" style="width:60px"></label>
        <label class="ctl" title="Only items care (Red Coin trades a life for gold)">Lives<input type="number" id="adv-lives" min="0" max="20" value="${state.lives}" style="width:56px"></label>
      </div>
      <label class="ctl" style="margin-top:10px">Trainer (real win rates)
        <select id="adv-trainer">${trainerOpts}</select>
      </label>
      <div class="rowlabel">Your board — top row &nbsp;<span style="font-weight:400">(→ RIGHT column = front / enemy side, LEFT = back)</span></div>
      <div class="slotgrid" id="slots-top"></div>
      <div class="rowlabel">Bottom row</div>
      <div class="slotgrid" id="slots-bottom"></div>
      <div class="rowlabel">🪑 Bench <span style="font-weight:400">(counts for merges & item rolls)</span></div>
      <div class="slotgrid bench" id="slots-bench"></div>
      <div class="rowlabel">💎 Trinkets held <span style="font-weight:400">(rarity odds + real-data pairing)</span></div>
      <div class="offers" id="adv-trinkets" style="margin-top:6px"></div>
      <button class="ghost" id="adv-tk-add" style="margin-top:8px">+ Add trinket</button>
      <div class="rowlabel">🎒 Items held <span style="font-weight:400">(unused — Coupon discounts every pick)</span></div>
      <div class="offers" id="adv-held" style="margin-top:6px"></div>
      <button class="ghost" id="adv-held-add" style="margin-top:8px">+ Add held item</button>
      <div class="note" style="margin-top:10px">Top-middle = crown slot. Click a slot to set/change/clear. Duplicates you own boost merge scores automatically.</div>`;
    $('#adv-day').onchange = (e) => { state.day = Math.max(1, +e.target.value || 1); save(); renderAdvisorLeft(); autoAdvice(); };
    let advGoldT = null;
    $('#adv-gold').oninput = (e) => { state.gold = Math.max(0, +e.target.value || 0); save(); clearTimeout(advGoldT); advGoldT = setTimeout(autoAdvice, 160); };
    $('#adv-rank').onchange = (e) => { state.shopRank = e.target.value ? Math.min(Math.max(+e.target.value, 1), 14) : null; save(); autoAdvice(); };
    $('#adv-lives').onchange = (e) => { state.lives = Math.max(0, +e.target.value || 0); save(); autoAdvice(); };
    $('#adv-trainer').onchange = (e) => { state.trainerId = e.target.value; save(); autoAdvice(); };
    // trinkets held (sandbox) — feed rarity odds (Research Notes/VIP Pass) + engine real-data
    const tkBox = $('#adv-trinkets');
    tkBox.innerHTML = state.trinkets.length ? '' : '<span class="note" style="margin:0;font-size:11px">None — odds use the base table.</span>';
    state.trinkets.forEach((id, i) => {
      const t = D.trinkets.find(x => x.id === id);
      const c = el('div', 'offer-chip');
      c.innerHTML = `<img class="sprite" src="${spr(t ? t.sprite : '')}" style="width:24px;height:24px"><div style="font-size:11.5px;font-weight:600">${esc(t ? t.name : humanize(id))}</div><span class="x">×</span>`;
      c.title = t ? t.description : '';
      c.querySelector('.x').onclick = () => { state.trinkets.splice(i, 1); save(); renderAdvisorLeft(); autoAdvice(); };
      tkBox.appendChild(c);
    });
    $('#adv-tk-add').onclick = () => trinketPicker((id) => { if (!state.trinkets.includes(id)) { state.trinkets.push(id); save(); renderAdvisorLeft(); autoAdvice(); } });
    // items HELD (bought/granted but not used yet) — Coupon changes every pick's
    // effective price; the rest get use-now/use-later advice in the results
    const heldBox = $('#adv-held');
    heldBox.innerHTML = state.heldItems.length ? '' : '<span class="note" style="margin:0;font-size:11px">None — add items you\'re sitting on.</span>';
    state.heldItems.forEach((id, i) => {
      const it = D.items.find(x => x.id === id);
      const c = el('div', 'offer-chip');
      c.innerHTML = `<img class="sprite" src="${spr(it ? it.sprite : '')}" style="width:24px;height:24px"><div style="font-size:11.5px;font-weight:600">${esc(it ? it.name : humanize(id))}</div><span class="x">×</span>`;
      c.title = it ? it.description : '';
      c.querySelector('.x').onclick = () => { state.heldItems.splice(i, 1); save(); renderAdvisorLeft(); autoAdvice(); };
      heldBox.appendChild(c);
    });
    $('#adv-held-add').onclick = () => itemPicker((ids) => { state.heldItems = state.heldItems.concat(ids); save(); renderAdvisorLeft(); autoAdvice(); });
    const grids = [$('#slots-top'), $('#slots-bottom')];
    grids.forEach((g, gi) => {
      g.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const idx = gi * 3 + i;
        const s = state.team[idx];
        const cell = el('div', 'slot' + (s ? '' : ' empty'));
        if (s) {
          const m = monById[s.monsterId];
          cell.innerHTML = `<span class="lvl">L${s.level}</span>${mcBadge(s)}${s.shiny ? '<span class="shinymark">✨</span>' : ''}
            <img class="sprite" src="${spr(s.shiny && m.shinySprite ? m.shinySprite : m.sprite)}"><div class="nm">${esc(m.name)}</div>${slotArrows(state.team, idx, false)}`;
        } else {
          cell.innerHTML = `<div class="nm">${gi === 0 && i === 1 ? '👑 carry slot' : '+ add'}</div>`;
        }
        wireSlot(cell,
          () => state.team[idx],
          (next) => { state.team[idx] = next; save(); renderAdvisorLeft(); autoAdvice(); },
          () => monsterPicker({
            title: 'Slot ' + (gi === 0 ? 'Top ' : 'Bottom ') + (i + 1) + (gi === 0 && i === 1 ? ' (crown slot)' : ''),
            allowClear: true, defaultLevel: s ? s.level : 1, defaultShiny: s ? s.shiny : false,
            pool: monsters.filter(m => m.cost > 0 || m.isEvolvedForm),
            boardIds: new Set(state.team.filter((x, xi) => x && xi !== idx).map(x => x.monsterId)),
          }, (pick) => { state.team[idx] = pick; save(); renderAdvisorLeft(); autoAdvice(); }),
          { sandbox: true });
        wireDrag(cell, state.team, idx, save, () => { renderAdvisorLeft(); autoAdvice(); });
        wireDropTarget(cell, state.team, idx, save, () => { renderAdvisorLeft(); autoAdvice(); });
        g.appendChild(cell);
      }
    });
    // sandbox bench — merges/ownedCounts/item rolls see it; battle math doesn't
    const benchG = $('#slots-bench');
    benchG.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const s = state.bench[i];
      const cell = el('div', 'slot bench-slot' + (s ? '' : ' empty'));
      if (s) {
        const m = monById[s.monsterId];
        cell.innerHTML = `<span class="lvl">L${s.level}</span>${mcBadge(s)}${s.shiny ? '<span class="shinymark">✨</span>' : ''}
          <img class="sprite" src="${spr(s.shiny && m.shinySprite ? m.shinySprite : m.sprite)}"><div class="nm">${esc(m.name)}</div>`;
      } else cell.innerHTML = '<div class="nm">🪑 bench</div>';
      wireSlot(cell,
        () => state.bench[i],
        (next) => { state.bench[i] = next; save(); renderAdvisorLeft(); autoAdvice(); },
        () => monsterPicker({
          title: 'Bench ' + (i + 1),
          allowClear: true, defaultLevel: s ? s.level : 1, defaultShiny: s ? s.shiny : false,
          pool: monsters.filter(m => m.cost > 0 || m.isEvolvedForm),
          boardIds: new Set([...state.team, ...state.bench].filter((x, xi) => x && !(xi >= 6 && xi - 6 === i)).filter(Boolean).map(x => x.monsterId)),
        }, (pick) => { state.bench[i] = pick; save(); renderAdvisorLeft(); autoAdvice(); }),
        { sandbox: true });
      wireDrag(cell, state.bench, i, save, () => { renderAdvisorLeft(); autoAdvice(); });
      wireDropTarget(cell, state.bench, i, save, () => { renderAdvisorLeft(); autoAdvice(); });
      benchG.appendChild(cell);
    }
    $('#slots-bench').insertAdjacentHTML('afterend', BOARD_HINT);
  }

  function renderAdvisorShop() {
    hcHide();
    const box = $('#adv-shop');
    box.innerHTML = `<h3>Shop offers this round
      <button class="ghost" id="adv-mirror" style="float:right;font-size:10.5px;padding:3px 9px" title="Copy your LIVE run into this sandbox (day, gold, trainer, board, shop, items) — then tweak freely without touching the real run.">🔌 Mirror live run</button></h3>
      <div class="offers" id="offer-list"></div>
      <div class="rowlabel">Items on offer</div>
      <div class="offers" id="adv-items"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="ghost" id="offer-add">+ Add offer</button>
        <button class="ghost" id="adv-item-add">+ Add items</button>
        <button class="ghost" id="offer-clear">Clear</button>
        <button class="ghost" id="adv-new" title="Reset the whole sandbox — fresh day/gold/board/shop for a new what-if.">🆕 New sandbox</button>
        <button class="primary" id="advise" style="margin-left:auto">Advise me ➜</button>
      </div>`;
    const list = $('#offer-list');
    list.innerHTML = state.offers.length ? '' : '<span class="note" style="margin:0">Add the Batomon your shop is offering (mark shinies!).</span>';
    state.offers.forEach((o, i) => {
      const m = monById[o.monsterId]; if (!m) return;
      const c = el('div', 'offer-chip' + (o.shiny ? ' shiny' : ''));
      const rsC = window.SYNERGY && window.SYNERGY.monsters && window.SYNERGY.monsters[o.monsterId];
      const comboC = bestBoardCombo(o.monsterId, new Set(state.team.filter(s => s).map(s => s.monsterId)));
      if (comboC && comboC.winRate >= 78) c.classList.add('combo-glow');
      c.innerHTML = `<img class="sprite" src="${spr(o.shiny && m.shinySprite ? m.shinySprite : m.sprite)}">
        <div><div style="font-weight:700;font-size:12.5px">${o.shiny ? '✨ ' : ''}${esc(m.name)} <span style="font-size:10px;color:var(--muted)">$${m.cost}</span></div>
        <div style="font-size:10px">${rsC && rsC.rounds >= 60 ? wrSpan(rsC.winRate) + ' WR' : `<span style="color:var(--muted)">${esc(rarLabel(m))}</span>`}${comboC ? ` <span class="combo-hit" title="${esc(comboC.ids.map(id => (monById[id] || { name: id }).name).join(' + '))} · ${comboC.rounds} rounds">⚡${comboC.winRate}% w/ board</span>` : ''}</div></div>
        <span class="x" title="remove">×</span>`;
      c.querySelector('.x').onclick = (e) => { e.stopPropagation(); hcHide(); state.offers.splice(i, 1); save(); renderAdvisorShop(); autoAdvice(); };
      wireSlot(c, () => state.offers[i], (next) => { if (next) state.offers[i] = next; else state.offers.splice(i, 1); save(); renderAdvisorShop(); autoAdvice(); }, () => {}, { noButtons: true, sandbox: true });
      list.appendChild(c);
    });
    $('#offer-add').onclick = () => monsterPicker({
      title: 'Add shop offer',
      multi: true,
      boardIds: new Set(state.team.filter(s => s).map(s => s.monsterId)),
    }, (picks) => {
      if (picks && picks.length) { state.offers.push(...picks); save(); renderAdvisorShop(); autoAdvice(); }
    });
    // items row (sandbox — no gold deduction here, it's a what-if)
    const itemBox = $('#adv-items');
    itemBox.innerHTML = (state.items || []).length ? '' : '<span class="note" style="margin:0;font-size:11px">Add the items on offer — each gets a BUY/SKIP verdict + roll odds in the results.</span>';
    (state.items || []).forEach((id, i) => {
      const it = D.items.find(x => x.id === id);
      if (!it) return;
      const chip = el('div', 'offer-chip');
      chip.innerHTML = `<img class="sprite" src="${spr(it.sprite)}" style="width:26px;height:26px">
        <div style="font-size:11.5px;font-weight:700">${esc(it.name)} <span style="color:var(--gold)">$${it.cost}</span></div><span class="x">×</span>`;
      chip.title = it.description;
      chip.querySelector('.x').onclick = (e) => { e.stopPropagation(); state.items.splice(i, 1); save(); renderAdvisorShop(); autoAdvice(); };
      itemBox.appendChild(chip);
    });
    $('#adv-item-add').onclick = () => itemPicker((ids) => { state.items = (state.items || []).concat(ids); save(); renderAdvisorShop(); autoAdvice(); });
    $('#offer-clear').onclick = () => { state.offers = []; state.items = []; save(); renderAdvisorShop(); $('#adv-results').innerHTML = ''; };
    $('#adv-mirror').onclick = () => {
      const cp = (s) => (s ? { ...s, feed: s.feed ? { ...s.feed } : undefined } : null);
      state.day = live.day; state.gold = live.gold; state.trainerId = live.trainerId || state.trainerId;
      state.team = live.board.map(cp);
      state.bench = (live.bench || [null, null, null, null]).map(cp);
      state.offers = live.shop.map(o => ({ ...o }));
      state.items = (live.shopItems || []).slice();
      state.heldItems = []; // the game save doesn't expose held items — declare them manually
      state.trinkets = live.trinkets.slice();
      state.shopRank = live.shopRank;
      state.lives = live.lives;
      save(); renderAdvisor(); runAdvice();
    };
    $('#adv-new').onclick = () => {
      state.day = 3; state.gold = 35; state.trainerId = state.trainerId || null;
      state.team = [null, null, null, null, null, null];
      state.bench = [null, null, null, null];
      state.offers = []; state.items = []; state.heldItems = []; state.trinkets = [];
      state.shopRank = null; state.lives = 10;
      save(); renderAdvisor(); $('#adv-results') && ($('#adv-results').innerHTML = '');
    };
    $('#advise').onclick = runAdvice;
  }

  function ownedCounts() {
    const c = {};
    [...state.team, ...(state.bench || [])].forEach(s => { if (s) c[s.monsterId] = (c[s.monsterId] || 0) + 1; });
    return c;
  }

  function runAdvice() {
    const out = $('#adv-results');
    if (!state.offers.length && !(state.items || []).length) { out.innerHTML = '<div class="reroll-note">Add at least one shop offer or item first.</div>'; return; }
    out.classList.remove('advice-flash'); void out.offsetWidth; out.classList.add('advice-flash');
    const ctx = { day: state.day, gold: state.gold, trainerId: state.trainerId, team: state.team, ownedCounts: ownedCounts(), trinkets: state.trinkets, heldItems: state.heldItems };
    const res = E.scoreShop(state.offers, ctx);
    out.innerHTML = '';
    // mulligan & reroll intelligence — the SANDBOX's own trinkets drive the
    // rarity odds (Research Notes / VIP Pass); rank explicit or day-derived
    let advisorHasVerdict = false;
    {
      const ownedIds = new Set([...state.team, ...(state.bench || [])].filter(s => s).map(s => s.monsterId));
      const mHtml = mulliganCardHTML(ctx, state.offers, advRankOf(), state.gold, ownedIds, { trinketIds: state.trinkets });
      if (mHtml) { const w = el('div'); w.innerHTML = mHtml; w.firstElementChild.style.marginBottom = '12px'; out.appendChild(w.firstElementChild); advisorHasVerdict = /verdict/.test(mHtml); }
    }
    if (res.reroll && !advisorHasVerdict) out.appendChild(el('div', 'reroll-note', '🎲 ' + esc(res.reroll)));
    res.rows.forEach((r, i) => {
      const card = el('div', 'result-card' + (i === 0 ? ' top' : ''));
      const pctCls = r.pct >= 90 ? 'p90' : r.pct >= 65 ? 'p70' : 'p0';
      const chips = r.chips.map(ch => {
        const cls = /cannot afford|breaks|kamikaze|not in normal/i.test(ch) ? 'warn' : /shiny/i.test(ch) ? 'shiny' : /levels up|synerg|stack|engine|evolution|copy|carry/i.test(ch) ? 'good' : '';
        return `<span class="chip ${cls}">${esc(ch)}</span>`;
      }).join('');
      const notes = r.notes.slice(0, 3).map(n => `<span class="chip">${esc(n)}</span>`).join('');
      card.innerHTML = `
        <img class="sprite" src="${spr(r.offer.shiny && r.m.shinySprite ? r.m.shinySprite : r.m.sprite)}">
        <div>
          ${i === 0 ? '<span class="rank-badge">BEST PICK</span>' : ''}
          <div class="name">${r.offer.shiny ? '✨ ' : ''}${esc(r.m.name)} <span style="color:${rarColor(r.m)};font-size:12px">${esc(rarLabel(r.m))}</span> <span style="color:var(--muted);font-size:12px">· $${r.m.cost} · ${typePills(r.m)}</span></div>
          <div class="chips">${chips}${notes}</div>
        </div>
        <div class="pct ${pctCls}"><div class="big">${r.pct}%</div><div class="vs">${r.vsAvg >= 0 ? '+' : ''}${r.vsAvg}% vs shop avg</div></div>`;
      card.style.cursor = 'pointer';
      card.onclick = () => openDexDetail(r.m.id);
      out.appendChild(card);
    });
    // items on offer + items HELD — sandbox-context verdicts + roll odds
    if ((state.items || []).length || (state.heldItems || []).length) {
      const sandboxCtx = {
        team: [...state.team, ...(state.bench || [])], shop: state.offers, gold: state.gold, day: state.day,
        lives: state.lives, shopRank: advRankOf(), trainerId: state.trainerId, planId: null, itemUses: null,
      };
      const advs = [
        ...(state.items || []).map(id => ({ id, held: false, adv: itemAdvice(id, sandboxCtx) })),
        ...(state.heldItems || []).map(id => ({ id, held: true, adv: itemAdvice(id, sandboxCtx) })),
      ].filter(x => x.adv);
      if (advs.length) {
        const chipCls = { BUY: 'wr-good', MAYBE: 'wr-ok', SKIP: 'wr-low' };
        const heldLabel = (v) => v === 'BUY' ? '✓ USE NOW' : v === 'MAYBE' ? '~ HOLD OR USE' : '✗ HOLD';
        const card = el('div', 'card');
        card.style.marginTop = '12px';
        card.innerHTML = `<h3>🧪 Item advice <span style="font-size:10px;color:var(--muted);font-weight:400">· scored for THIS sandbox board · held items get use-now/hold timing</span></h3>
          ${advs.map(x => `<div class="pk-row" style="margin-top:6px;display:block">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            <img class="sprite" src="${spr(x.adv.it.sprite)}" width="26" height="26">
            <b style="font-size:12px">${esc(x.adv.it.name)}</b>${x.held ? ' <span class="chip" style="font-size:9px">🎒 HELD</span>' : ` <span style="color:var(--gold);font-size:11px">${itemCost(x.adv.it) ? '$' + itemCost(x.adv.it) : 'free'}</span>`}
            <b class="${chipCls[x.adv.v]}" style="font-size:11px">${x.held ? heldLabel(x.adv.v) : x.adv.v === 'BUY' ? '✓ BUY' : x.adv.v === 'MAYBE' ? '~ MAYBE' : '✗ SKIP'}</b>
            <span style="font-size:11px;color:var(--muted);min-width:0">${esc(x.adv.why)}</span></div>
            ${rollLineHTML(itemRollAnalysis(x.id, sandboxCtx))}${targetLineHTML(itemTargetAdvice(x.id, sandboxCtx.team))}</div>`).join('')}`;
        out.appendChild(card);
      }
    }
    out.appendChild(el('div', 'note', esc(GNOTE())));
  }

  // ---------------- TRINKET PICKER TAB ----------------
  let trinketChoice = [];
  function renderTrinkets() {
    const root = $('#tab-trinkets');
    root.innerHTML = `
      <h2>Trinket Gift Picker</h2>
      <div class="note">Gift choices ranked by <b>real Master Ranked win rates</b> from batodex.com. Click trinkets below to add them as your current gift options, then compare.</div>
      <div class="card"><h3>Your gift options</h3><div class="offers" id="tr-choice"></div>
        <div style="margin-top:10px"><button class="ghost" id="tr-clear">Clear</button></div>
        <div id="tr-result" style="margin-top:14px"></div></div>
      <h3 style="margin-top:20px">All trinkets
        <select id="tr-sort" style="margin-left:10px;font-size:12px">
          <option value="wr">Sort: Win rate ↓</option>
          <option value="pick">Sort: Pick rate ↓</option>
          <option value="tier">Sort: Rarity ↑</option>
          <option value="name">Sort: Name A-Z</option>
        </select>
      </h3>
      <div class="band-items" id="tr-all" style="margin-top:8px"></div>`;
    $('#tr-sort').onchange = drawTrinketAll;
    drawTrinketAll();
    function drawTrinketAll() {
      const all = $('#tr-all'); all.innerHTML = '';
      const sort = $('#tr-sort').value;
      const arr = E.trinketTiers().slice();
      if (sort === 'pick') arr.sort((a, b) => b.stats.pickRate - a.stats.pickRate);
      if (sort === 'tier') arr.sort((a, b) => a.tier - b.tier || b.stats.winRate - a.stats.winRate);
      if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
      arr.forEach(t => {
      const c = el('div', 'tier-item');
      c.innerHTML = `<img class="sprite" src="${spr(t.sprite)}"><div>
        <div style="font-size:12px;font-weight:600">${esc(t.name)} ${t.isUnique ? '<span class="pill">Unique</span>' : ''}</div>
        <div>${wrSpan(t.stats.winRate)} <span class="pr">WR · picked ${t.stats.pickRate}%</span> <span class="pr" style="color:${rarColor(t)}">· ${esc(rarLabel(t))}</span></div></div>`;
      c.title = t.description;
      c.onclick = () => { if (!trinketChoice.includes(t.id) && trinketChoice.length < 4) { trinketChoice.push(t.id); renderTrinketChoice(); } };
      all.appendChild(c);
      });
    }
    $('#tr-clear').onclick = () => { trinketChoice = []; renderTrinketChoice(); };
    renderTrinketChoice();
  }
  function renderTrinketChoice() {
    const box = $('#tr-choice'); box.innerHTML = trinketChoice.length ? '' : '<span class="note" style="margin:0">Click trinkets below to add (max 4).</span>';
    trinketChoice.forEach((id, i) => {
      const t = D.trinkets.find(x => x.id === id);
      const c = el('div', 'offer-chip');
      c.innerHTML = `<img class="sprite" src="${spr(t.sprite)}"><div style="font-size:12px;font-weight:600">${esc(t.name)}</div><span class="x">×</span>`;
      c.querySelector('.x').onclick = () => { trinketChoice.splice(i, 1); renderTrinketChoice(); };
      box.appendChild(c);
    });
    const out = $('#tr-result'); out.innerHTML = '';
    if (trinketChoice.length >= 2) {
      E.scoreTrinkets(trinketChoice, { day: state.day }).forEach((r, i) => {
        const card = el('div', 'result-card' + (i === 0 ? ' top' : ''));
        card.innerHTML = `<img class="sprite" src="${spr(r.t.sprite)}">
          <div>${i === 0 ? '<span class="rank-badge">TAKE THIS</span>' : ''}
            <div class="name">${esc(r.t.name)} <span style="color:${rarColor(r.t)};font-size:12px">${esc(rarLabel(r.t))}</span></div>
            <div style="font-size:12.5px;color:var(--muted);margin-top:3px">${esc(r.t.description)}</div>
            <div class="chips">${r.chips.map(ch => `<span class="chip good">${esc(ch)}</span>`).join('')}</div></div>
          <div class="pct ${r.pct >= 95 ? 'p90' : 'p70'}"><div class="big">${r.pct}%</div><div class="vs">${r.t.stats ? r.t.stats.winRate + '% real WR' : 'no data'}</div></div>`;
        out.appendChild(card);
      });
    }
  }

  // ---------------- DAYS TAB ----------------
  function renderDays() {
    const root = $('#tab-days');
    root.innerHTML = `<h2>Day-by-Day Coach</h2>
      <div class="note">A championship run is 10 badges. Anchors: Egg Breeder hatch day 5 · Mad Scientist day 7 · Gamer day 9 · Extended Mode to day 40. Pick your day:</div>
      <div class="day-nav" id="day-nav"></div><div id="day-body"></div>`;
    const nav = $('#day-nav');
    GDAYS().forEach(d => {
      const b = el('button', null, d.day);
      b.onclick = () => { nav.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); showDay(d); };
      nav.appendChild(b);
    });
    nav.children[Math.min(state.day, 10) - 1].click();
  }
  function showDay(d) {
    const body = $('#day-body');
    body.innerHTML = '';
    const card = el('div', 'card day-card');
    card.innerHTML = `<h3><span class="daynum">DAY ${d.day}</span> — ${esc(d.title)}</h3>
      <ul>${d.plan.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="day-block"><b>Lineup:</b> ${esc(d.lineup)}</div>
      <div class="day-block"><b>Items:</b> ${esc(d.items)}</div>
      <div class="day-block warn"><b>Don't:</b> ${esc(d.warning)}</div>`;
    body.appendChild(card);
    // 🏆 WINNER-BOARD GALLERY (poe.ninja pattern): real winning Master boards
    // for this day, from the crawled ladder (exemplars.js, rebuilt on refresh).
    const EX = window.SYNERGY_EX;
    const dayKey = String(Math.min(+d.day || 1, 15));
    const boards = EX && EX.days && EX.days[dayKey];
    if (boards && boards.length) {
      const g = el('div', 'card');
      g.innerHTML = `<h3>🏆 Real winning boards — day ${esc(String(d.day))} <span style="font-size:10px;color:var(--muted);font-weight:400">· top-MMR Master rounds that WON this day (${esc(String(EX.generatedAt || ''))})</span></h3>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">
        ${boards.map(b => `<div style="display:flex;align-items:center;gap:10px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:8px 12px">
          <span style="font-size:10.5px;color:var(--gold);min-width:76px">${b.mmr} MMR</span>
          <span style="font-size:10.5px;color:var(--muted);min-width:86px">${esc(((D.trainers.find(t => t.id === b.trainerId) || {}).name) || b.trainerId || '?')}</span>
          <span style="display:flex;gap:3px">${runSprites(b.board, 28)}</span>
          ${(b.trinkets || []).length ? `<span style="font-size:10px;color:var(--muted);margin-left:auto" title="${esc(b.trinkets.map(id => ((D.trinkets.find(t => t.id === id) || { name: id }).name)).join(', '))}">💎 ${b.trinkets.length}</span>` : ''}
        </div>`).join('')}</div>
        <div class="note" style="font-size:10px;margin-top:6px">Hover a sprite for name+level. These are boards that actually WON a day-${esc(String(d.day))} battle at the top of the ladder — steal shapes, not just units.</div>`;
      body.appendChild(g);
    }
  }

  // ---------------- TIER LISTS TAB ----------------
  function renderTiers() {
    const root = $('#builds-tiers-host'); // lives inside the Builds & Tiers tab
    if (!root) return;
    root.innerHTML = `<h2>Tier Lists</h2>
      <div class="tier-controls">
        <button class="ghost tsel active" data-t="trainers">Trainers (real WR)</button>
        <button class="ghost tsel" data-t="trinkets">Trinkets (real WR)</button>
        <button class="ghost tsel" data-t="monsters">Batomon (model)</button>
        <button class="ghost tsel" data-t="items">Items (curated)</button>
      </div>
      <div id="tier-body"></div>`;
    root.querySelectorAll('.tsel').forEach(b => b.onclick = () => {
      root.querySelectorAll('.tsel').forEach(x => x.classList.toggle('active', x === b));
      drawTier(b.dataset.t);
    });
    drawTier('trainers');
  }

  function bandRows(rows, renderItem) {
    const frag = el('div');
    ['S', 'A', 'B', 'C', 'D'].forEach(band => {
      const items = rows.filter(r => r.band === band);
      if (!items.length) return;
      const row = el('div', 'band-row');
      row.appendChild(el('div', 'band-tag band-' + band, band));
      const wrap = el('div', 'band-items');
      items.forEach(r => wrap.appendChild(renderItem(r)));
      row.appendChild(wrap);
      frag.appendChild(row);
    });
    return frag;
  }

  function drawTier(kind) {
    const body = $('#tier-body');
    body.innerHTML = '';
    if (kind === 'trainers') {
      body.appendChild(el('div', 'note', 'Real per-round win rate & per-run pick rate, Master Ranked (batodex.com/stats). "???" has no published data.'));
      body.appendChild(bandRows(E.trainerTiers(), t => {
        const c = el('div', 'tier-item');
        c.innerHTML = `<img class="sprite" src="${spr(t.sprite)}"><div>
          <div style="font-size:12px;font-weight:700">${esc(t.name)}</div>
          <div>${wrSpan(t.stats.winRate)} <span class="pr">WR · ${t.stats.pickRate}% picked${t.stats.picks ? ' (' + t.stats.picks.toLocaleString() + ')' : ''}</span></div></div>`;
        c.title = t.description;
        return c;
      }));
      const tbl = el('div', 'card', '<h3>Full table</h3>');
      const t = el('table', 'stats');
      t.innerHTML = '<tr><th>Trainer</th><th>Ability</th><th>Win rate</th><th></th><th>Pick rate</th></tr>' +
        E.trainerTiers().map(tr => `<tr><td style="white-space:nowrap"><img class="sprite" src="${spr(tr.sprite)}" width="26" style="vertical-align:middle"> <b>${esc(tr.name)}</b></td>
          <td style="font-size:12px;color:var(--muted)">${esc(tr.description)}</td>
          <td>${wrSpan(tr.stats.winRate)}</td>
          <td>${wrBarT(tr.stats.winRate)}</td>
          <td>${tr.stats.pickRate}%${tr.stats.picks ? ' <span style="color:var(--muted)">(' + tr.stats.picks.toLocaleString() + ')</span>' : ''}</td></tr>`).join('');
      tbl.appendChild(t); body.appendChild(tbl);
    }
    if (kind === 'trinkets') {
      body.appendChild(el('div', 'note', 'Real Master Ranked win/pick rates. High WR on high pick count = trustworthy. Mythical trinkets dominate: take them when offered.'));
      body.appendChild(bandRows(E.trinketTiers(), t => {
        const c = el('div', 'tier-item');
        c.innerHTML = `<img class="sprite" src="${spr(t.sprite)}"><div>
          <div style="font-size:12px;font-weight:600">${esc(t.name)}</div>
          <div>${wrSpan(t.stats.winRate)} <span class="pr">· ${t.stats.pickRate}% picked</span></div></div>`;
        c.title = t.description + ' — ' + rarLabel(t);
        return c;
      }));
    }
    if (kind === 'monsters') {
      body.innerHTML = `<div class="tier-controls">
        <button class="ghost psel active" data-p="early">Early (day 1-3)</button>
        <button class="ghost psel" data-p="mid">Mid (day 4-6)</button>
        <button class="ghost psel" data-p="late">Late (day 7+)</button>
      </div><div class="note">Model-based (no public monster win rates): day-weighted power + L4 potential + patch-note adjustments. Cost-efficiency counts in Early. Click any Batomon for details.</div><div id="mon-tier"></div>`;
      body.querySelectorAll('.psel').forEach(b => b.onclick = () => {
        body.querySelectorAll('.psel').forEach(x => x.classList.toggle('active', x === b));
        drawMonTier(b.dataset.p);
      });
      drawMonTier('early');
    }
    if (kind === 'items') {
      body.appendChild(el('div', 'note', 'Curated — the game publishes no per-item stats. Prices are post-0.8.3.'));
      const frag = el('div');
      Object.entries(G.ITEM_TIERS).forEach(([band, items]) => {
        const row = el('div', 'band-row');
        row.appendChild(el('div', 'band-tag band-' + band, band));
        const wrap = el('div', 'band-items');
        items.forEach(([id, why]) => {
          if (FR() && G.FR.ITEM_TIERS && G.FR.ITEM_TIERS[id]) why = G.FR.ITEM_TIERS[id];
          const it = D.items.find(x => x.id === id);
          if (!it) return;
          const c = el('div', 'tier-item');
          c.innerHTML = `<img class="sprite" src="${spr(it.sprite)}"><div>
            <div style="font-size:12px;font-weight:600">${esc(it.name)} <span class="pr">$${itemCost(it)}</span></div>
            <div class="pr" style="max-width:280px">${esc(why)}</div></div>`;
          c.title = it.description;
          wrap.appendChild(c);
        });
        row.appendChild(wrap);
        frag.appendChild(row);
      });
      body.appendChild(frag);
    }
  }

  function drawMonTier(phaseName) {
    const box = $('#mon-tier');
    box.innerHTML = '';
    const { rows } = E.tierList(phaseName);
    box.appendChild(bandRows(rows, r => {
      const c = el('div', 'tier-item');
      c.innerHTML = `<img class="sprite" src="${spr(r.m.sprite)}"><div>
        <div style="font-size:12px;font-weight:600">${esc(r.m.name)}</div>
        <div class="pr" style="color:${rarColor(r.m)}">${esc(rarLabel(r.m))} · $${r.m.cost}</div></div>`;
      c.onclick = () => openDexDetail(r.m.id);
      return c;
    }));
  }

  // ---------------- BUILDS TAB ----------------
  // Builds tab filters — trainer + ladder outcome + text. Held at module scope so
  // re-draws (and tab switches) keep your selection.
  let buildsFilter = { trainer: 'all', tier: 'all', q: '' };
  function renderBuilds() {
    const root = $('#tab-builds');
    const DS = window.DISCOVERED || {};
    const th = DS.thresholds || { champion: 10, rankup: 8 };
    // every trainer that owns at least one build (curated or learned)
    const tIds = new Set();
    G.BUILDS.forEach(b => { if (b.trainer) tIds.add(b.trainer); (b.altTrainers || []).forEach(a => tIds.add(a)); });
    (DS.builds || []).forEach(b => { if (b.trainer) tIds.add(b.trainer); });
    const tOpts = [...tIds].map(id => ({ id, name: ((D.trainers || []).find(t => t.id === id) || {}).name || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const lbl = 'display:flex;flex-direction:column;gap:3px;font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px';
    // 📐 Builds & 🏆 Tier Lists share this tab (subnav switches the two views)
    root.innerHTML = `<div class="subnav">
        <button class="ghost bsel active" data-b="builds">📐 Builds</button>
        <button class="ghost bsel" data-b="tiers">🏆 Tier Lists</button>
      </div>
      <div id="builds-main">
      <h2>Build Archetypes & Synergies</h2>
      <div class="note">Curated engine shapes + <b>🧬 archetypes learned from ${((DS.corpus || {}).runs || 0).toLocaleString()} real runs</b>, each scored on what it actually did on the ladder: <b style="color:var(--gold)">👑 Champion</b> = reached <b>${th.champion}🏅</b> (+5★, a full division) · <b style="color:var(--green)">📈 Rank-up</b> = reached <b>${th.rankup}🏅</b> (+3★). Builds are mined ONLY from those high-badge runs — a 5-badge run is "No Change" and teaches nothing about climbing. Filter to your trainer to see what wins with them.</div>
      <div class="tier-controls" style="align-items:flex-end">
        <label style="${lbl}">Trainer
          <select id="bf-trainer" style="min-width:172px"><option value="all">All trainers</option>${tOpts.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>
        <label style="${lbl}">Ladder result
          <select id="bf-tier" style="min-width:200px">
            <option value="all">All builds</option>
            <option value="champion">👑 Champion only — ${th.champion}🏅+ (+5★)</option>
            <option value="rankup">📈 Rank-up or better — ${th.rankup}🏅+ (+3★)</option>
          </select></label>
        <label style="${lbl}">Search
          <input id="bf-q" type="text" placeholder="build or monster…" style="min-width:168px"></label>
        <button class="ghost" id="bf-reset" style="font-size:10px;padding:6px 11px">✕ reset</button>
        <span id="bf-count" style="font-size:11px;color:var(--muted);align-self:center"></span>
      </div>
      <div id="build-grid-host"></div>
      </div>
      <div id="builds-tiers-host" style="display:none"></div>`;
    root.querySelectorAll('.bsel').forEach(b => b.onclick = () => {
      root.querySelectorAll('.bsel').forEach(x => x.classList.toggle('active', x === b));
      $('#builds-main').style.display = b.dataset.b === 'builds' ? '' : 'none';
      $('#builds-tiers-host').style.display = b.dataset.b === 'tiers' ? '' : 'none';
    });
    const tSel = $('#bf-trainer'), tierSel = $('#bf-tier'), qIn = $('#bf-q');
    tSel.value = buildsFilter.trainer; tierSel.value = buildsFilter.tier; qIn.value = buildsFilter.q;
    tSel.onchange = () => { buildsFilter.trainer = tSel.value; drawBuildGrids(); };
    tierSel.onchange = () => { buildsFilter.tier = tierSel.value; drawBuildGrids(); };
    qIn.oninput = () => { buildsFilter.q = qIn.value.toLowerCase().trim(); drawBuildGrids(); };
    $('#bf-reset').onclick = () => { buildsFilter = { trainer: 'all', tier: 'all', q: '' }; tSel.value = 'all'; tierSel.value = 'all'; qIn.value = ''; drawBuildGrids(); };
    drawBuildGrids();
  }
  // Fills ONLY the grid host, so filter changes never wipe #builds-tiers-host.
  function drawBuildGrids() {
    const host = $('#build-grid-host'); if (!host) return;
    const DS = window.DISCOVERED || {};
    const th = DS.thresholds || { champion: 10, rankup: 8 };
    const cStats = DS.curatedStats || {};
    const f = buildsFilter;
    const nameOfId = (id) => (monById[id] || { name: id }).name;
    const matchQ = (name, ids) => !f.q || name.toLowerCase().includes(f.q) || (ids || []).some(id => String(nameOfId(id)).toLowerCase().includes(f.q));
    const tierOk = (t) => f.tier === 'all' || (f.tier === 'champion' ? t === 'champion' : (t === 'champion' || t === 'rankup'));
    // ladder-outcome pill, shared by curated + learned cards
    const ladder = (st) => {
      if (!st || st.fieldedRuns == null) return '<span class="pill" style="color:var(--muted)" title="No run in the corpus fielded this comp — no ladder evidence yet">no ladder data</span>';
      const c = st.badgeTier === 'champion' ? 'var(--gold)' : st.badgeTier === 'rankup' ? 'var(--green)' : 'var(--muted)';
      const ic = st.badgeTier === 'champion' ? '👑' : st.badgeTier === 'rankup' ? '📈' : '~';
      return `<span class="pill" style="color:${c};font-weight:700" title="Across ${st.fieldedRuns} real runs that fielded this comp — avg ${st.avgBadges} badges · ${st.champRate}% reached 10🏅 (+5★) · ${st.rankUpRate}% reached 8🏅 (+3★)">${ic} ${st.avgBadges}🏅 avg · ${st.champRate}% champ · ${st.fieldedRuns}r</span>`;
    };
    const curated = G.BUILDS.filter(b => {
      if (f.trainer !== 'all' && b.trainer !== f.trainer && (b.altTrainers || []).indexOf(f.trainer) < 0) return false;
      if (f.tier !== 'all' && !tierOk((cStats[b.id] || {}).badgeTier)) return false;
      return matchQ(b.name, (b.core || []).concat(b.lateCore || []));
    }).sort((a, b) => ((cStats[b.id] || {}).champRate || -1) - ((cStats[a.id] || {}).champRate || -1));
    const disc = discoveredBuilds().filter(b => {
      if (f.trainer !== 'all' && b.trainer !== f.trainer) return false;
      if (f.tier !== 'all' && !tierOk(b.badgeTier)) return false;
      return matchQ(b.name, b.coreIds);
    });
    const NOV = { novel: { icon: '🧬', label: 'NOVEL', color: 'var(--accent)' }, variant: { icon: '🔀', label: 'VARIANT', color: 'var(--gold)' }, known: { icon: '✓', label: 'KNOWN', color: 'var(--green)' } };
    const sprites = (ids) => (ids || []).slice(0, 6).map(id => { const m = monById[id]; return m ? `<img class="sprite" title="${esc(m.name)}" src="${spr(m.sprite)}" width="38" height="38">` : ''; }).join('');
    host.innerHTML = `<div class="build-grid" id="build-grid"></div><div id="disc-section"></div>`;
    const grid = $('#build-grid', host);
    curated.forEach(b => {
      const icon = monById[b.icon];
      const tr = (D.trainers || []).find(t => t.id === b.trainer);
      const st = cStats[b.id];
      const card = el('div', 'card build-card');
      card.innerHTML = `<div class="build-head">
          <img class="sprite" src="${spr(icon ? icon.sprite : '')}">
          <div><div style="font-weight:800;font-size:15px">${esc(b.name)} <span class="chip" style="font-size:8px;background:var(--border);color:var(--text)">CURATED</span></div>
          <div style="font-size:11.5px;color:var(--muted)">🧑 ${esc(tr ? tr.name : b.trainer)}${tr && tr.stats ? ` (${tr.stats.winRate}% WR)` : ''} · ${esc(b.difficulty)} · Power ${esc(b.power)}</div>
          <div style="margin-top:4px">${ladder(st)}</div></div>
        </div>
        <div class="cores" style="margin-top:10px">${sprites(b.core)}</div>`;
      card.onclick = () => openBuild(b);
      grid.appendChild(card);
    });
    if (!curated.length) grid.innerHTML = '<div class="note" style="margin:0">No curated build matches this filter.</div>';
    const dsec = $('#disc-section', host);
    if (disc.length) {
      const novelN = disc.filter(b => b.novelty === 'novel').length;
      dsec.innerHTML = `<h2 style="margin-top:24px">🧬 Discovered builds <span style="font-size:12px;color:var(--muted);font-weight:400">— mined from high-badge runs · ${novelN} novel</span></h2>
        <div class="note">Clustered from the finished boards of real <b>${th.rankup}🏅+</b> runs, grouped by the trainer who actually pilots them. <b style="color:var(--accent)">🧬 NOVEL</b> = the data wins with it but it isn't in the curated list. Click any for the full breakdown + <b>🎯 Set as run plan</b>.</div>
        <div class="build-grid" id="disc-build-grid"></div>`;
      const dgrid = $('#disc-build-grid', host);
      disc.forEach(b => {
        const nv = NOV[b.novelty] || NOV.novel;
        const icon = monById[b.coreIds[0]];
        const card = el('div', 'card build-card');
        card.style.borderLeft = '3px solid ' + nv.color;
        card.innerHTML = `<div class="build-head">
            <img class="sprite" src="${spr(icon ? icon.sprite : '')}">
            <div><div style="font-weight:800;font-size:14.5px">${esc(b.name)} <span class="chip" style="background:${nv.color};color:#0b0b10;font-weight:800;font-size:8px;vertical-align:middle">${nv.icon} ${nv.label}</span></div>
            <div style="font-size:11.5px;color:var(--muted)">${b.trainerName ? `🧑 <b>${esc(b.trainerName)}</b> · ` : ''}${b.winRate}% round WR${b.lift != null ? ` · +${b.lift} lift` : ''}${b.mapsTo ? ` · ≈${esc(b.mapsTo)}` : ''}</div>
            <div style="margin-top:4px">${ladder(b)}</div></div>
          </div>
          <div class="cores" style="margin-top:10px">${sprites(b.coreIds)}</div>`;
        card.onclick = () => openBuild(discAsGuide(b));
        dgrid.appendChild(card);
      });
    } else dsec.innerHTML = '<div class="note" style="margin-top:18px">No learned build matches this filter — widen the trainer or ladder filter.</div>';
    const cnt = $('#bf-count');
    if (cnt) cnt.textContent = `${curated.length} curated · ${disc.length} learned`;
  }

  function openBuild(b) {
    const frB = FR() && G.FR.BUILDS && G.FR.BUILDS[b.id];
    if (frB) b = Object.assign({}, b, frB); // swap prose, keep structure/names
    const tr = D.trainers.find(t => t.id === b.trainer);
    const box = el('div', 'build-detail');
    const monCell = (id) => { const m = monById[id]; return m ? `<div class="coremon"><img class="sprite" src="${spr(m.sprite)}" title="${esc((m.ability && m.ability.trigger ? m.ability.trigger + ': ' : '') + (m.ability && m.ability.byLevel ? m.ability.byLevel['1'] : ''))}"><div>${esc(m.name)}</div></div>` : ''; };
    const trinketCell = (id) => { const t = D.trinkets.find(x => x.id === id); return t ? `<div class="coremon"><img class="sprite" src="${spr(t.sprite)}" title="${esc(t.description)}"><div>${esc(t.name)}${t.stats ? '<br>' + wrSpan(t.stats.winRate) : ''}</div></div>` : ''; };
    const itemCell = (id) => { const t = D.items.find(x => x.id === id); return t ? `<div class="coremon"><img class="sprite" src="${spr(t.sprite)}" title="${esc(t.description)}"><div>${esc(t.name)}</div></div>` : ''; };
    box.innerHTML = `<h3>${esc(b.name)}</h3>
      <div class="note" style="margin-bottom:8px">Trainer: <b>${esc(tr ? tr.name : '')}</b>${tr && tr.stats ? ` — ${tr.stats.winRate}% real WR` : ''} · Alt: ${b.altTrainers.map(a => { const t = D.trainers.find(x => x.id === a); return t ? t.name : a; }).join(', ')}</div>
      <p style="font-size:13.5px">${esc(b.how)}</p>
      <h3 style="margin-top:14px">Core engine</h3><div class="cores">${b.core.map(monCell).join('')}</div>
      <h3 style="margin-top:8px">Late-game upgrades</h3><div class="cores">${b.lateCore.map(monCell).join('')}</div>
      <h3 style="margin-top:8px">Trinket priorities</h3><div class="cores">${b.trinkets.map(trinketCell).join('')}</div>
      <h3 style="margin-top:8px">Key items</h3><div class="cores">${b.items.map(itemCell).join('')}</div>
      <h3 style="margin-top:12px">Example final lineup</h3>
      <div class="lineup-grid">${b.lineup.top.map(id => { const m = monById[id]; return `<div class="lineup-cell"><img class="sprite" src="${spr(m ? m.sprite : '')}"><div>${esc(m ? m.name : id)}</div></div>`; }).join('')}</div>
      <div class="lineup-grid">${b.lineup.bottom.map(id => { const m = monById[id]; return `<div class="lineup-cell"><img class="sprite" src="${spr(m ? m.sprite : '')}"><div>${esc(m ? m.name : id)}</div></div>`; }).join('')}</div>
      <div class="day-block"><b>Day plan:</b> ${esc(b.dayplan)}</div>
      <div class="day-block warn"><b>Weaknesses:</b> ${esc(b.counters)}</div>
      <button class="primary" id="build-plan" style="margin-top:12px">${planIds().includes(b.id) ? '✓ Adopted — tap to drop' : '🎯 Adopt as run plan'}${planIds().length > 1 && planIds().includes(b.id) ? ` (${planIds().indexOf(b.id) === 0 ? 'primary' : 'plan ' + (planIds().indexOf(b.id) + 1)})` : ''}</button>`;
    openModal(box);
    $('#build-plan', box).onclick = () => { togglePlan(b.id); closeModal(); renderLive(); document.querySelector('#nav button[data-tab="live"]').click(); };
  }

  // ---------------- DEX TAB ----------------
  // 🃏 UNIFIED BATODEX-STYLE DETAIL CARD — one look for monsters, items & trinkets
  // (Design goal: "display like that on everything, hovering batomon or clicking items/
  // trinkets"). Rarity-coloured header, sprite panel, TYPE badge, keyword-coloured
  // effect, cost/source footer. Reused on hover (hovercard) + click (modal) + grids.
  const _STAT_COLOR = { Damage: '#ff5d73', Burn: '#ff8a3d', Poison: '#b06fff', Shock: '#ffd166', Heal: '#3ddc84', Shield: '#5aa2ff', Multicast: '#7b93c3', Cooldown: '#66d9d9' };
  const _TYPE_COLOR = (() => { const o = {}, skip = new Set(['All', 'NULL', 'Null']); D.monsters.forEach(m => (m.types || []).forEach(t => { if (!skip.has(t.name)) o[t.name] = t.color; })); return o; })(); // skip pseudo-types ("All"/"NULL") so prose isn't miscoloured
  function colorizeEffect(txt) {
    if (!txt) return '';
    let s = esc(txt);
    s = s.replace(/(\$\d+)/g, '<b style="color:var(--gold)">$1</b>'); // gold amounts
    s = s.replace(/([+\-]?\d+%?)\s+(Damage|Burn|Poison|Shock|Heal|Shield|Multicast|Cooldown Speed|Cooldown)\b/g,
      (m, n, st) => `<b style="color:${_STAT_COLOR[st.replace(' Speed', '')] || 'var(--text)'}">${n} ${st}</b>`);
    s = s.replace(/\b(On Battle Start|Battle Start|On Cast|Knockout|Protect|Trigger|Multicast)\b(?![^<]*<\/b>)/g, '<b style="color:#ff9d3d">$1</b>'); // lookahead: don't re-wrap "Multicast" already coloured as a +N stat
    for (const nm in _TYPE_COLOR) s = s.replace(new RegExp('\\b' + nm + '\\b(?![^<]*<\\/b>)', 'g'), `<b style="color:${_TYPE_COLOR[nm]}">${nm}</b>`);
    return s;
  }
  function trinketSourceLabel(t) {
    const s = t.sources || {}; const p = [];
    if (s.pool) p.push('Shop pool');
    if ((s.events || []).length) p.push('Event');
    if ((s.trainers || []).length) p.push('Trainer');
    return p.join(' · ') || 'Rewards';
  }
  function bxCardHTML(kind, id, opts) {
    const o = opts || {};
    const cls = 'bx-card' + (o.inGrid ? ' in-grid' : '');
    const head = (name, rar) => `<div class="bx-head"><b class="bx-name" style="color:${rar.color}">${esc(name)}</b><span class="bx-rarity" style="color:${rar.color}">${esc(rar.label || '')}</span></div>`;
    if (kind === 'item') {
      const it = D.items.find(x => x.id === id); if (!it) return '';
      const r = it.rarity || { label: '', color: 'var(--muted)' }, tier = (typeof ITEM_TIER_OF !== 'undefined' && ITEM_TIER_OF[it.id]) || null;
      return `<div class="${cls}" style="border-top-color:${r.color}">${head(it.name, r)}
        <div class="bx-body"><div class="bx-sprite"><img src="${spr(it.sprite)}"></div>
          <div class="bx-badges"><span class="bx-type item">ITEM</span>${tier ? `<span class="chip ${tier === 'S' || tier === 'A' ? 'good' : ''}" style="font-size:9px">${tier} tier</span>` : ''}${it.uniquePerRound ? '<span class="chip" style="font-size:9px">1 / round</span>' : ''}</div></div>
        <div class="bx-effect">${colorizeEffect(it.description)}</div>
        <div class="bx-foot"><span class="bx-foot-l">Cost</span><span class="bx-foot-r" style="color:var(--gold)">${it.cost ? '$' + it.cost : 'Free'}</span></div></div>`;
    }
    if (kind === 'trinket') {
      const t = D.trinkets.find(x => x.id === id); if (!t) return '';
      const r = t.rarity || { label: '', color: 'var(--muted)' }, wr = t.stats ? `${t.stats.winRate}% WR` : '';
      return `<div class="${cls}" style="border-top-color:${r.color}">${head(t.name, r)}
        <div class="bx-body"><div class="bx-sprite"><img src="${spr(t.sprite)}"></div>
          <div class="bx-badges"><span class="bx-type trinket">TRINKET</span>${t.isUnique ? '<span class="chip" style="font-size:9px" title="Not offered again once held">UNIQUE</span>' : ''}${wr ? `<span class="chip" style="font-size:9px">${wr}</span>` : ''}</div></div>
        <div class="bx-effect">${colorizeEffect(t.description)}</div>
        <div class="bx-foot"><span class="bx-foot-l">Source</span><span class="bx-foot-r" style="color:var(--text)">${esc(trinketSourceLabel(t))}</span></div></div>`;
    }
    if (kind === 'monster' || kind === 'mon') {
      const m = monById[id]; if (!m) return '';
      const r = m.rarity || { label: '', color: 'var(--muted)' };
      const pills = (m.types || []).map(t => `<span class="bx-type mon" style="background:${t.color}">${esc(t.name)}</span>`).join('');
      const ld = (E.levelData(m, 3, false)) || (E.levelData(m, 1, false));
      const stats = ld ? ld.stats.map(st => `<span class="chip" style="font-size:9px;border-color:${st.color}66">${esc(st.label)} ${st.value}</span>`).join('') : '';
      const ab = (m.ability && m.ability.description) || '';
      return `<div class="${cls}" style="border-top-color:${r.color}">${head(m.name, r)}
        <div class="bx-body"><div class="bx-sprite"><img src="${spr(o.shiny && m.shinySprite ? m.shinySprite : m.sprite)}"></div>
          <div class="bx-badges">${pills}<span class="chip" style="font-size:9px">Tier ${m.tier}</span></div></div>
        ${ab ? `<div class="bx-effect">${colorizeEffect(ab)}</div>` : ''}
        ${stats ? `<div style="padding:0 13px 11px;display:flex;flex-wrap:wrap;gap:5px">${stats}</div>` : ''}
        <div class="bx-foot"><span class="bx-foot-l">${ld ? 'Cooldown' : 'Cost'}</span><span class="bx-foot-r">${ld ? ld.cooldown + 's' + (ld.multicast > 1 ? ` · ×${ld.multicast}` : '') : '<span style="color:var(--gold)">$' + m.cost + '</span>'}</span></div></div>`;
    }
    return '';
  }
  // a bx-card as a clickable grid cell (hover-lifts via .in-grid, click → focused modal)
  function bxGridCard(kind, id) {
    const wrap = document.createElement('div');
    wrap.innerHTML = bxCardHTML(kind, id, { inGrid: true });
    const card = wrap.firstElementChild;
    card.onclick = () => openModal(bxCardHTML(kind, id));
    return card;
  }
  // attach hover→popup + optional click→modal of the bx-card to a grid element
  function wireBxHover(elm, kind, id, onClick) {
    let html = null; // build once, lazily
    elm.addEventListener('mouseenter', (e) => hcShow(html || (html = bxCardHTML(kind, id)), e.clientX, e.clientY));
    elm.addEventListener('mouseleave', hcHide);
    if (onClick) elm.addEventListener('click', onClick);
  }
  let dexView = 'mons';
  function renderDex() {
    const root = $('#tab-dex');
    const btn = (v, label) => `<button class="ghost ssel ${dexView === v ? 'active' : ''}" data-v="${v}">${label}</button>`;
    root.innerHTML = `<h2>Batodex</h2>
      <div class="tier-controls">
        ${btn('mons', '👤 Batomon')}${btn('items', '🧪 Items')}${btn('trinkets', '💎 Trinkets')}${btn('trainers', '🧑 Trainers')}${btn('events', '🎪 Events')}${btn('mech', '⚙️ Mechanics')}
      </div>
      <div id="dex-body"></div>`;
    root.querySelectorAll('.ssel').forEach(b => b.onclick = () => {
      dexView = b.dataset.v;
      root.querySelectorAll('.ssel').forEach(x => x.classList.toggle('active', x === b));
      drawDexBody();
    });
    drawDexBody();
  }
  function drawDexBody() {
    const body = $('#dex-body');
    if (dexView === 'mons') drawDexMonsters(body);
    else if (dexView === 'items') drawDexItems(body);
    else if (dexView === 'trinkets') drawDexTrinkets(body);
    else if (dexView === 'trainers') drawDexTrainers(body);
    else if (dexView === 'events') drawDexEvents(body);
    else if (dexView === 'mech') renderMech(body); // ⚙️ Mechanics lives inside the Batodex
  }
  function drawDexMonsters(root) {
    const types = [...new Set(monsters.flatMap(m => (m.types || []).map(t => t.id)))].sort();
    root.innerHTML = `<div class="note" style="margin:4px 0 10px">All ${monsters.length} Batomon — click a card for levels, abilities, real placement & win-rate data.</div>
      <div class="dex-controls">
        <input type="text" id="dex-q" placeholder="Search name or type…" style="min-width:200px">
        <select id="dex-type"><option value="">All types</option>${types.map(t => `<option>${t}</option>`).join('')}</select>
        <select id="dex-tier"><option value="">All rarities</option>${[1, 2, 3, 4, 5, 6].map(t => `<option value="${t}">Tier ${t}</option>`).join('')}</select>
        <select id="dex-sort">
          <option value="tier">Sort: Rarity ↑</option>
          <option value="cost">Sort: Cost ↓</option>
          <option value="name">Sort: Name A-Z</option>
          <option value="wr">Sort: Real WR ↓</option>
          <option value="pick">Sort: Pick rate ↓</option>
        </select>
        <label class="ctl" style="flex-direction:row;align-items:center;gap:6px">✨ Shiny sprites <input type="checkbox" id="dex-shiny"></label>
      </div>
      <div class="dex-grid" id="dex-grid"></div>`;
    const draw = () => {
      const q = $('#dex-q').value.toLowerCase().trim();
      const ty = $('#dex-type').value, tier = $('#dex-tier').value, shiny = $('#dex-shiny').checked;
      const sort = $('#dex-sort').value;
      const SYm = (window.SYNERGY && window.SYNERGY.monsters) || {};
      const sorters = {
        tier: (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
        cost: (a, b) => b.cost - a.cost || a.name.localeCompare(b.name),
        name: (a, b) => a.name.localeCompare(b.name),
        wr: (a, b) => ((SYm[b.id] || {}).winRate || -1) - ((SYm[a.id] || {}).winRate || -1),
        pick: (a, b) => ((SYm[b.id] || {}).pickRate || -1) - ((SYm[a.id] || {}).pickRate || -1),
      };
      const grid = $('#dex-grid'); grid.innerHTML = '';
      monsters
        .filter(m => (!q || m.name.toLowerCase().includes(q)) && (!ty || (m.types || []).some(t => t.id === ty)) && (!tier || m.tier === +tier))
        .sort(sorters[sort] || sorters.tier)
        .forEach(m => {
          const tags = Array.isArray(m.tags) ? m.tags : [];
          const c = el('div', 'dex-card');
          const rs = (window.SYNERGY && window.SYNERGY.monsters && window.SYNERGY.monsters[m.id]) || null;
          c.innerHTML = `<img class="sprite" src="${spr(shiny && m.shinySprite ? m.shinySprite : m.sprite)}">
            <div class="nm">${esc(m.name)}</div>
            <div class="meta" style="color:${rarColor(m)}">${esc(rarLabel(m))} · $${m.cost}</div>
            ${rs && rs.rounds >= 60 ? `<div class="meta">${wrSpan(rs.winRate)} WR · ${rs.pickRate}% picked</div>` : ''}
            <div style="margin-top:4px">${typePills(m)}</div>
            ${tags.length ? `<div class="meta" style="color:var(--red);margin-top:3px">${tags.join(' ')}</div>` : ''}
            ${m.isEvolvedForm ? '<div class="meta" style="color:var(--gold)">evolved form</div>' : ''}`;
          c.onclick = () => openDexDetail(m.id);
          wireBxHover(c, 'monster', m.id); // batodex-style card on hover
          grid.appendChild(c);
        });
    };
    root.querySelector('.dex-controls').addEventListener('input', draw);
    draw();
  }
  function drawDexItems(root) {
    root.innerHTML = `<div class="note" style="margin:4px 0 10px">All ${D.items.length} shop items — curated tier + live buy logic feeds the cockpit's 🧪 Item advice.</div>
      <div class="dex-controls">
        <input type="text" id="dxi-q" placeholder="Search items…" style="min-width:200px">
        <select id="dxi-sort"><option value="rarity">Sort: Rarity ↑</option><option value="cost">Sort: Cost ↓</option><option value="name">Sort: Name A-Z</option><option value="tier">Sort: Tier S→C</option></select>
      </div>
      <div class="bx-grid" id="dxi-grid"></div>`;
    const TIER_ORD = { S: 0, A: 1, B: 2, C: 3 };
    const draw = () => {
      const q = $('#dxi-q').value.toLowerCase().trim();
      const sort = $('#dxi-sort').value;
      const sorters = {
        rarity: (a, b) => a.tier - b.tier || a.cost - b.cost || a.name.localeCompare(b.name),
        cost: (a, b) => b.cost - a.cost || a.name.localeCompare(b.name),
        name: (a, b) => a.name.localeCompare(b.name),
        tier: (a, b) => (TIER_ORD[ITEM_TIER_OF[a.id]] ?? 9) - (TIER_ORD[ITEM_TIER_OF[b.id]] ?? 9) || a.name.localeCompare(b.name),
      };
      const grid = $('#dxi-grid'); grid.innerHTML = '';
      D.items.filter(it => !q || it.name.toLowerCase().includes(q) || (it.description || '').toLowerCase().includes(q))
        .sort(sorters[sort] || sorters.rarity)
        .forEach(it => grid.appendChild(bxGridCard('item', it.id)));
    };
    root.querySelector('.dex-controls').addEventListener('input', draw);
    draw();
  }
  function drawDexTrinkets(root) {
    const held = (window.SYNERGY || {}).trinketsHeld || {};
    root.innerHTML = `<div class="note" style="margin:4px 0 10px">All ${D.trinkets.length} trinkets — official win/pick rates + Master-run held-WR from the crawl. Compare gift options in the <b>Trinket Picker</b> tab.</div>
      <div class="dex-controls">
        <input type="text" id="dxt-q" placeholder="Search trinkets…" style="min-width:200px">
        <select id="dxt-sort"><option value="wr">Sort: Real WR ↓</option><option value="rarity">Sort: Rarity ↑</option><option value="pick">Sort: Pick rate ↓</option><option value="name">Sort: Name A-Z</option></select>
      </div>
      <div class="bx-grid" id="dxt-grid"></div>`;
    const draw = () => {
      const q = $('#dxt-q').value.toLowerCase().trim();
      const sort = $('#dxt-sort').value;
      const hw = (t) => (held[t.id] || {}).winRate ?? (t.stats || {}).winRate ?? -1;
      const sorters = {
        wr: (a, b) => hw(b) - hw(a),
        rarity: (a, b) => (a.tier || 0) - (b.tier || 0) || a.name.localeCompare(b.name),
        pick: (a, b) => ((b.stats || {}).pickRate || -1) - ((a.stats || {}).pickRate || -1),
        name: (a, b) => a.name.localeCompare(b.name),
      };
      const grid = $('#dxt-grid'); grid.innerHTML = '';
      D.trinkets.filter(t => !q || t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
        .sort(sorters[sort] || sorters.wr)
        .forEach(t => grid.appendChild(bxGridCard('trinket', t.id)));
    };
    root.querySelector('.dex-controls').addEventListener('input', draw);
    draw();
  }
  function drawDexTrainers(root) {
    root.innerHTML = `<div class="note" style="margin:4px 0 10px">All ${D.trainers.length} trainers — real Master Ranked win/pick rates. The cockpit's trainer panel activates each one's full logic.</div>
      <div class="dex-grid wide" id="dxr-grid"></div>`;
    const grid = $('#dxr-grid');
    D.trainers.slice().sort((a, b) => ((b.stats || {}).winRate || 0) - ((a.stats || {}).winRate || 0))
      .forEach(t => {
        const c = el('div', 'dex-card wide');
        c.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start">
          <img src="${spr(t.sprite)}" style="width:56px;height:56px;image-rendering:pixelated;border-radius:9px;background:var(--bg2);border:1px solid var(--border)">
          <div style="min-width:0;text-align:left">
            <div class="nm">${esc(t.name)}${(t.sets || []).includes('starter') ? ' <span class="chip" style="font-size:9px">starter pool</span>' : ''}</div>
            ${t.stats ? `<div class="meta">${wrSpan(t.stats.winRate)} WR · ${t.stats.pickRate}% picked</div>` : ''}
            <div class="meta" style="margin-top:3px;color:var(--text);opacity:.85">${esc(t.description || '')}</div>
          </div></div>`;
        grid.appendChild(c);
      });
  }
  function drawDexEvents(root) {
    const evs = (D.events || []).slice().sort((a, b) => {
      const dayOf = (e) => +(((e.rarity || {}).label || '').match(/\d+/) || [99])[0];
      return dayOf(a) - dayOf(b) || a.name.localeCompare(b.name);
    });
    root.innerHTML = `<div class="note" style="margin:4px 0 10px">All ${evs.length} events with their real options — hit one in-game? The cockpit's 🎪 Event advisor scores every choice for YOUR board.</div>
      <div class="dex-grid wide" id="dxe-grid"></div>`;
    const grid = $('#dxe-grid');
    evs.forEach(ev => {
      const c = el('div', 'dex-card wide');
      c.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start">
        <img class="sprite" src="${spr(ev.sprite)}" style="width:44px;height:44px">
        <div style="min-width:0;text-align:left">
          <div class="nm">${esc(ev.name)} <span class="chip" style="font-size:9px;color:${(ev.rarity || {}).color || 'var(--muted)'}">${esc((ev.rarity || {}).label || '')}</span></div>
          <div class="meta" style="margin-top:2px;color:var(--text);opacity:.85">${esc(ev.description || '')}</div>
          <ul style="margin:6px 0 0 16px;font-size:11.5px;color:var(--muted)">
            ${(ev.options || []).map(o => `<li><b style="color:var(--text)">${esc(o.flavor || '')}</b>${o.reward && o.reward !== 'null' ? ` → ${esc(o.reward)}` : ''}</li>`).join('')}
          </ul>
        </div></div>`;
      grid.appendChild(c);
    });
  }

  function statTable(m, shiny) {
    const arr = shiny && Array.isArray(m.shinyLevels) && m.shinyLevels.length ? m.shinyLevels : m.levels;
    if (!Array.isArray(arr) || !arr.length) return '<div class="note">No level data (event unit).</div>';
    const keys = [...new Set(arr.flatMap(l => (l.stats || []).map(s => s.key)))];
    const head = '<tr><th>Lv</th><th>CD</th><th>Multi</th>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr>';
    const rows = arr.map(l => `<tr><td><b>${l.level}</b></td><td>${l.cooldown}s</td><td>${l.multicast ? '×' + l.multicast : '—'}</td>` +
      keys.map(k => { const s = (l.stats || []).find(s => s.key === k); return `<td>${s ? s.value.toLocaleString() : '—'}</td>`; }).join('') + '</tr>').join('');
    return `<table class="lvl-table">${head}${rows}</table>`;
  }

  function abilityBox(m, shiny) {
    const ab = shiny ? (m.shinyAbility || m.ability) : m.ability;
    if (!ab || (!ab.description && !ab.byLevel)) return '';
    const lv = ab.byLevel ? [1, 2, 3, 4].map(l => ab.byLevel[String(l)] ? `<b>L${l}:</b> ${esc(ab.byLevel[String(l)])}` : '').filter(Boolean).join('\n') : esc(ab.description);
    return `<div class="ability-box"><b>${esc(ab.trigger || 'Passive')}</b>\n${lv}</div>`;
  }

  function realDataBox(m) {
    const SY = window.SYNERGY;
    const rs = SY && SY.monsters && SY.monsters[m.id];
    if (!rs || rs.rounds < 30) return '';
    const monName = (id) => (monById[id] || { name: id }).name;
    const days = Object.entries(rs.byDay || {}).sort((a, b) => +a[0] - +b[0]).filter(([, v]) => v.rounds >= 15);
    const lvls = Object.entries(rs.byLevel || {}).sort((a, b) => +a[0] - +b[0]).filter(([, v]) => v.rounds >= 15);
    const partners = ((SY.combos && SY.combos['2']) || []).filter(p => p.ids.includes(m.id)).slice(0, 3);
    return `<div class="ability-box" style="margin-top:12px"><b>📊 Real Master-tier data</b>
${wrSpan(rs.winRate, rs.rounds)} round WR ${confDot(rs.rounds)} · in ${rs.pickRate}% of top runs · avg ${rs.avgCopies || 1} cop${(rs.avgCopies || 1) >= 1.05 ? 'ies' : 'y'} · ${rs.rounds.toLocaleString()} rounds
${rs.shinyWR != null ? `Shiny boards: ${wrSpan(rs.shinyWR, rs.shinyRounds)} vs ${rs.normalWR != null ? rs.normalWR + '%' : '—'} normal (${rs.shinyRounds} shiny rounds)` : ''}
${lvls.length ? 'WR by level: ' + lvls.map(([l, v]) => `<b>L${l}</b> ${wrSpan(v.winRate, v.rounds)} (${v.rounds}r)`).join(' · ') : ''}
${days.length >= 3 ? 'WR by day: ' + days.map(([d, v]) => `<b>d${d}</b> ${wrSpan(v.winRate)}`).join(' · ') : ''}
${partners.length ? 'Proven partners: ' + partners.map(p => { const other = p.ids.find(x => x !== m.id); return `<b>${esc(monName(other))}</b> ${wrSpan(p.winRate)} (${p.lift >= 0 ? '+' : ''}${p.lift}pp)`; }).join(' · ') : ''}
${rs.slots ? `<div style="display:flex;align-items:center;gap:12px;margin-top:8px">
  <div class="pos-grid">${[0, 1, 2, 3, 4, 5].map(i => {
    const v = rs.slots[i];
    if (!v) return '<div class="pos-cell" style="opacity:.15">·</div>';
    const alpha = Math.min(0.12 + (v.share / 100) * 1.6, 0.95);
    return `<div class="pos-cell ${i === rs.bestSlot ? 'pos-best' : ''}" style="background:rgba(90,162,255,${alpha.toFixed(2)})" title="${SLOT_SHORT[i]} — placed ${v.share}% · ${v.winRate}% WR (${v.rounds}r)"><b>${Math.round(v.share)}%</b><span class="wr-${wrTier(v.winRate)}" style="font-size:8.5px">${Math.round(v.winRate)}</span></div>`;
  }).join('')}</div>
  <div style="font-size:11px;color:var(--muted)">Real placements (${rs.slotRounds.toLocaleString()})${rs.bestSlot != null ? `<br>⭐ best: <b class="wr-${wrTier(rs.slots[rs.bestSlot].winRate)}">${SLOT_SHORT[rs.bestSlot]}</b>` : ''}<br><span style="font-size:9.5px">enemies → RIGHT</span></div>
</div>` : ''}</div>`;
  }

  function openDexDetail(id) {
    const m = monById[id]; if (!m) return;
    let shiny = false;
    const box = el('div');
    const render = () => {
      const evoFrom = m.evolvesFrom ? monById[m.evolvesFrom] : null;
      const evoTo = m.evolution && m.evolution.targetId ? monById[m.evolution.targetId] : (typeof m.evolvedForm === 'string' ? monById[m.evolvedForm] : null);
      const adj = G.MONSTER_META_ADJ[m.id];
      box.innerHTML = `<div class="detail-grid">
        <div class="portrait">
          <img class="sprite" src="${spr(shiny && m.shinySprite ? m.shinySprite : m.sprite)}">
          <div style="margin-top:8px">${m.shinySprite && Array.isArray(m.shinyLevels) && m.shinyLevels.length ? `<button class="ghost" id="dx-shiny">${shiny ? 'Show normal' : 'Show shiny ✨'}</button>` : '<span class="pill">No shiny variant</span>'}</div>
        </div>
        <div>
          <h3 style="font-size:20px">${shiny ? '✨ ' : ''}${esc(m.name)} <span style="color:${rarColor(m)};font-size:13px">${esc(rarLabel(m))}</span></h3>
          <div style="margin:6px 0">${typePills(m)} <span class="pill">Cost $${m.cost}</span>
            ${(m.keywords || []).map(k => `<span class="pill">${esc(k.name || k.id || k)}</span>`).join('')}
            ${(Array.isArray(m.tags) ? m.tags : []).map(t => `<span class="pill" style="color:var(--red)">${esc(t)}</span>`).join('')}</div>
          ${evoFrom ? `<div class="note" style="margin:4px 0">Evolves from <a href="#" data-go="${evoFrom.id}" style="color:var(--accent)">${esc(evoFrom.name)}</a></div>` : ''}
          ${evoTo ? `<div class="note" style="margin:4px 0">Evolves into <a href="#" data-go="${evoTo.id}" style="color:var(--accent)">${esc(evoTo.name)}</a>${m.evolution ? ` (${m.evolution.trigger === 'level' ? 'at Level ' + m.evolution.level : 'on ' + m.evolution.trigger})` : ''}</div>` : ''}
          ${adj ? `<div class="note" style="color:var(--gold);margin:4px 0">Meta: ${esc(adj.note)}</div>` : ''}
          ${statTable(m, shiny)}
          ${abilityBox(m, shiny)}
          ${realDataBox(m)}
        </div></div>`;
      const sb = $('#dx-shiny', box); if (sb) sb.onclick = () => { shiny = !shiny; render(); };
      box.querySelectorAll('[data-go]').forEach(a => a.onclick = (e) => { e.preventDefault(); openDexDetail(a.dataset.go); });
    };
    render();
    openModal(box);
  }

  // ---------------- LIVE SYNERGIES TAB ----------------
  const syState = {
    view: 'combos', k: '2', phase: 'all', sort: 'winRate', dir: -1, minRounds: 20, search: '',
    day: 'all', rarity: 'all', level: 'all', metaType: 'all', metaSort: 'winRate', metaDir: -1,
    trK: '2', trSort: 'winRate', trDir: -1, trMin: 0, trSearch: '', trFilter: 'all',
    tkMode: '1', tkSort: 'winRate', tkDir: -1, tkMin: 0, tkSearch: '',
  };
  const humanize = (id) => String(id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  // WR rarity ladder: <50 red · 50-55 green · 55-60 blue · 60-65 purple · 65+ rainbow
  const wrTier = (wr) => (wr < 50 ? 'low' : wr < 55 ? 'ok' : wr < 60 ? 'good' : wr < 65 ? 'great' : 'elite');
  function wrSpan(wr, rounds) {
    if (wr == null) return '—';
    let title = '';
    if (rounds) {
      const p = wr / 100;
      const half = (1.96 * Math.sqrt(Math.max(p * (1 - p), 0) / rounds) * 100).toFixed(1);
      title = ` title="95% confidence: ${wr}% ± ${half}pp (n=${rounds.toLocaleString()} rounds)"`;
    }
    return `<b class="wr-${wrTier(wr)}"${title} style="cursor:${rounds ? 'help' : 'default'}">${wr}%</b>`;
  }
  const wrBarT = (wr) => `<div class="bar"><i class="bf-${wrTier(wr)}" style="width:${Math.min(Math.max((wr - 40) * 3.3, 4), 100)}%"></i></div>`;
  const WR_LEGEND = `<span class="wr-legend"><span class="wr-low">&lt;50%</span><span class="wr-ok">50–55%</span><span class="wr-good">55–60%</span><span class="wr-great">60–65%</span><span class="wr-elite">65%+</span></span>`;
  const LIFT_TITLES = {
    combos: 'Lift = combo WR − average of the members’ own solo WRs. Positive = real synergy beyond unit quality.',
    trainer: 'Trainer lift = WR with this trainer − the same Batomon combo’s WR under ANY trainer. What the trainer adds.',
    trinketMon: 'Lift = WR while holding the trinket − that board’s WR overall. What holding the trinket adds.',
    trinketSet: 'Lift = WR holding these together − average of each trinket’s solo held-WR.',
  };
  const confDot = (rounds) => rounds >= 300
    ? '<span title="High confidence: ≥300 rounds" style="color:var(--green);cursor:help">●</span>'
    : rounds >= 100
      ? '<span title="Medium confidence: 100–299 rounds" style="color:var(--gold);cursor:help">◐</span>'
      : `<span title="Thin sample: ${rounds} rounds — treat as a hint, not a truth" style="color:var(--red);cursor:help">○</span>`;
  const SY_EXPLAINER = `
    <details class="card" style="margin-bottom:14px;font-size:12.5px">
      <summary style="cursor:pointer;font-weight:700">📖 How to read these numbers (WR, pick rate, pp lift, confidence)</summary>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;color:#c6cbdc">
        <div><b style="color:var(--accent)">Round win rate (WR)</b> — of all battle-rounds where this unit/combo was on the board, the % that were won. Counted <b>once per round</b> (running 2 copies does not double-weight a round; copies show in the "Copies" column instead).</div>
        <div><b style="color:var(--accent)">Pick rate</b> — % of ranked runs (not rounds) that fielded it at least once.</div>
        <div><b style="color:var(--accent)">Lift (pp = percentage points)</b> — how much the WR exceeds its fair baseline:<br>
          · <b>Monster combos</b>: combo WR − average of the members' own individual WRs. Positive lift = the units win <i>more together</i> than their solo quality predicts → real synergy, not just "good units stacked".<br>
          · <b>Trainer combos</b>: WR with that trainer − the same monster combo's WR under <i>any</i> trainer → what the trainer adds.<br>
          · <b>Trinket + monsters</b>: WR while holding the trinket − that board's WR overall → what holding the trinket adds.<br>
          · <b>Trinket sets</b>: WR holding them together − average of each trinket's solo held-WR.<br>
          Example: 84.9% WR with +13.8pp lift means the combo wins 84.9% of rounds, ~14 points more than its parts alone would suggest.</div>
        <div><b style="color:var(--accent)">Confidence</b> — ● ≥300 rounds (trust it) · ◐ 100–299 (solid signal) · ○ &lt;100 (hint only). Hover any WR for its 95% confidence interval. Raise the "min rounds" filters when you want only iron-clad rows.</div>
        <div><b style="color:var(--accent)">WR colors (loot ladder)</b> — <span class="wr-low">&lt;50% red</span> · <span class="wr-ok">50–55% green</span> · <span class="wr-good">55–60% blue</span> · <span class="wr-great">60–65% purple</span> · <span class="wr-elite">65%+ rainbow</span>. Bands are absolute WR; remember in this winners' sample the baseline is ~66.5%, so blue/purple here is "below the top-player average" — rainbow is table stakes for a top comp.</div>
        <div><b style="color:var(--red)">Sample bias — read before comparing</b> — this data is the <b>top ~40 Master-ranked players only</b>. They win ~66.5% of all rounds, so numbers are inflated vs. the average player: compare rows <i>within</i> these tables, never against 50%. Victory-evolvers (Ignit → Flarilisk → Basilord) get an extra mechanical inflation: they evolve <i>because</i> their player is winning, so their WR is partly effect, not cause.</div>
      </div>
    </details>`;
  function sortArrow(key, cur, dir) { return key === cur ? (dir < 0 ? ' ▼' : ' ▲') : ''; }
  function renderSynergy() {
    const root = $('#tab-synergy');
    const SY = window.SYNERGY;
    if (!SY) {
      root.innerHTML = `<h2>Live Synergies</h2>
        <div class="reroll-note">No synergy dataset yet. Run <b>node tools/crawl_synergies.js</b> (or hit ⟳ Refresh in the Patches tab) to crawl top-leaderboard match histories from batodex.com.</div>`;
      return;
    }
    const ageDays = (Date.now() - new Date(SY.generatedAt).getTime()) / 864e5;
    root.innerHTML = `<h2>Live Synergies — real Master-tier data <span style="font-size:12px;color:var(--green)">✓ verified vs raw data</span></h2>
      <div class="note">Computed from <b>${SY.sample.runs.toLocaleString()} ranked runs / ${SY.sample.rounds.toLocaleString()} board-rounds</b> across the top ${SY.sample.players || '?'} leaderboard players (crawled ${new Date(SY.generatedAt).toLocaleString()}). Winners' sample: global round WR is ${SY.sample.globalRoundWR}%, so compare rows within tables — not against 50%. &nbsp; WR colors: ${WR_LEGEND}</div>
      ${ageDays > 7 ? `<div class="reroll-note" style="border-color:var(--gold)">⚠️ Synergy data is ${Math.floor(ageDays)} days old — the game patches fast. Hit ⟳ Refresh in the Patches tab.</div>` : ''}
      <div class="note" style="font-size:11px">🗑️ ${REMOVED_IDS.size} units removed from the current game version (${[...REMOVED_IDS].map(id => (monById[id] || { name: id }).name).join(', ')}) are filtered out of every table and advice surface.</div>
      ${FR() ? G.FR.EXPLAINER : SY_EXPLAINER}
      <div class="tier-controls">
        <button class="ghost ssel ${syState.view === 'discovered' ? 'active' : ''}" data-s="discovered" title="Emergent build archetypes the app learned from all runs — incl. NOVEL comps not in the curated list, and your own record with each">🧬 Discovered builds</button>
        <button class="ghost ssel ${syState.view === 'combos' ? 'active' : ''}" data-s="combos">Best combos (2–6)</button>
        <button class="ghost ssel ${syState.view === 'meta' ? 'active' : ''}" data-s="meta">Monster meta (real WR)</button>
        <button class="ghost ssel ${syState.view === 'trainermon' ? 'active' : ''}" data-s="trainermon">Trainer combos</button>
        <button class="ghost ssel ${syState.view === 'trinketmon' ? 'active' : ''}" data-s="trinketmon">Trinket combos</button>
        <button class="ghost ssel ${syState.view === 'positions' ? 'active' : ''}" data-s="positions">Positioning</button>
      </div>
      <div id="sy-body"></div>`;
    root.querySelectorAll('.ssel').forEach(b => b.onclick = () => {
      syState.view = b.dataset.s;
      root.querySelectorAll('.ssel').forEach(x => x.classList.toggle('active', x === b));
      drawSy();
    });
    drawSy();
  }

  function drawSy() {
    const SY = window.SYNERGY;
    const body = $('#sy-body');
    const monName = (id) => (monById[id] || { name: id }).name;
    const monImg = (id) => `<img class="sprite" src="${spr((monById[id] || {}).sprite || '')}" width="30" height="30" style="vertical-align:middle" title="${esc(monName(id))}">`;
    const wrBar = wrBarT;

    if (syState.view === 'discovered') {
      const builds = discoveredBuilds();
      const myRuns = loadRuns();
      const boardIds = new Set([...live.board, ...(live.bench || [])].filter(Boolean).map(s => s.monsterId));
      const wc = (w) => w >= 80 ? 'var(--green)' : w >= 72 ? 'var(--gold)' : 'var(--text)';
      const NOV = {
        novel: { icon: '🧬', label: 'NOVEL', color: 'var(--accent)', t: 'emergent — the data wins with it, but it is NOT in the curated build list' },
        variant: { icon: '🔀', label: 'VARIANT', color: 'var(--gold)', t: 'a stronger or alternate take on a known curated build' },
        known: { icon: '✓', label: 'KNOWN', color: 'var(--green)', t: 'matches a curated build — the data confirms it works' },
      };
      const mine = personalBuilds();
      // 🧑 YOUR builds are computed purely from loadRuns() — independent of window.DISCOVERED.
      // Render them even when the community set is empty/unloaded (was hidden by the early return).
      if (!builds.length) {
        body.innerHTML = personalBuildsSectionHTML(mine, boardIds, NOV) +
          '<div class="reroll-note" style="margin-top:10px">No community-discovered builds loaded — run <b>node tools/analyze_synergies.js</b> (or ⟳ Refresh in Patches) to mine archetypes from the run corpus.</div>';
        body.querySelectorAll('.mine-plan').forEach(btn => btn.onclick = () => { togglePlan(btn.dataset.id); drawSy(); renderLive(); });
        return;
      }
      const D2 = window.DISCOVERED || { globalWR: (SY.sample || {}).globalRoundWR, sample: SY.sample };
      const novelN = builds.filter(b => b.novelty === 'novel').length;
      body.innerHTML = `<div class="note" style="margin-bottom:10px">🧬 <b>Emergent build archetypes.</b> The app clusters every winning combo across <b>${((D2.sample || {}).runs || 0).toLocaleString()} runs</b> (community + your own history) into coherent comps, flags which are <b style="color:var(--accent)">NOVEL</b> (${novelN} here — the data wins with them but they're absent from the ${G.BUILDS.length} curated builds), and blends in <b>your personal record</b>. Global round WR ${D2.globalWR}% — treat that as the baseline. <b>📐 Plan this</b> adopts a comp so the buy order, plan card and Battle-Brain target it.</div>
        ${personalBuildsSectionHTML(mine, boardIds, NOV)}
        ${mine.builds.length ? '<h4 style="margin:16px 0 7px;color:var(--muted);font-size:12px;font-weight:700;letter-spacing:.5px">🌐 COMMUNITY-DISCOVERED — mined from every run</h4>' : ''}
        <div style="display:flex;flex-direction:column;gap:10px">${builds.map((b) => {
          const nv = NOV[b.novelty] || NOV.novel;
          const owned = b.coreIds.filter(id => boardIds.has(id));
          const fit = Math.round(owned.length / b.coreIds.length * 100);
          const rec = myRecordForCore(b.coreIds, myRuns);
          const sprites = b.coreIds.map(id => `<img class="sprite" src="${spr((monById[id] || {}).sprite || '')}" width="30" height="30" title="${esc((monById[id] || { name: id }).name)}${owned.includes(id) ? ' — on your board ✓' : ''}" style="${owned.includes(id) ? 'outline:2px solid var(--green);border-radius:5px' : 'opacity:.82'}">`).join('');
          return `<div class="card" style="border-left:3px solid ${nv.color};padding:11px 14px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="chip" style="background:${nv.color};color:#0b0b10;font-weight:800;font-size:9px" title="${esc(nv.t)}">${nv.icon} ${nv.label}</span>
              <b style="font-size:14px">${esc(b.name)}</b>
              <span class="pill" style="color:${wc(b.winRate)};font-weight:800">${b.winRate}% WR</span>
              <span class="pill" title="win-rate lift over the members' own average — what the COMBO itself adds">+${b.lift} lift</span>
              <span class="pill">${b.rounds}r · ${b.runs} runs</span>
              ${b.phase ? `<span class="pill">${esc(b.phase)}-game peak</span>` : ''}
              ${b.mapsTo ? `<span class="pill" style="color:var(--muted)" title="closest curated build (${b.overlap} overlap)">≈ ${esc(b.mapsTo)}</span>` : ''}
            </div>
            <div style="display:flex;gap:3px;margin:9px 0;flex-wrap:wrap">${sprites}</div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:11px">
              <span title="how much of this comp is already on your board/bench">🧩 <b style="color:${fit >= 50 ? 'var(--green)' : 'var(--muted)'}">${fit}% on board</b> <span style="color:var(--muted)">(${owned.length}/${b.coreIds.length})</span></span>
              ${rec ? `<span style="color:var(--gold)" title="your own archived runs that fielded ≥ half this core">🎖 you: ${rec.ran} run${rec.ran > 1 ? 's' : ''} · avg ${rec.avgBadges}🏅${rec.champ ? ` · ${rec.champ}× 🏆` : ''}${rec.battleWR != null ? ` · ${rec.battleWR}% battles` : ''}</span>` : '<span style="color:var(--muted)">🎖 you: no runs with this yet</span>'}
              <button class="ghost disc-detail" data-id="${esc(b.id)}" style="font-size:10px;padding:3px 9px">exemplars ▾</button>
              <button class="ghost disc-plan" data-id="${esc(b.id)}" style="margin-left:auto;font-size:10px;padding:3px 11px;${planIds().includes(b.id) ? 'border-color:var(--green);color:var(--green);font-weight:800' : ''}">${planIds().includes(b.id) ? '✓ planned' : '📐 Plan this'}</button>
            </div>
            <div id="disc-ex-${esc(b.id)}" style="display:none;margin-top:8px;font-size:10.5px;color:var(--muted);border-top:1px solid var(--border);padding-top:6px">
              <div style="margin-bottom:3px">Winning sub-combos this archetype was built from:</div>
              ${(b.exemplars || []).map(e => `<div>· <b style="color:${wc(e.winRate)}">${e.winRate}%</b> +${e.lift} (${e.runs} runs) — ${e.ids.map(monName).join(' + ')}</div>`).join('')}
            </div>
          </div>`;
        }).join('')}</div>`;
      body.querySelectorAll('.disc-plan, .mine-plan').forEach(btn => btn.onclick = () => {
        togglePlan(btn.dataset.id); // adopt/un-adopt — you can hold up to 3 plans at once
        drawSy(); renderLive();
      });
      body.querySelectorAll('.disc-detail').forEach(btn => btn.onclick = () => {
        const ex = $('#disc-ex-' + btn.dataset.id); if (ex) ex.style.display = ex.style.display === 'none' ? 'block' : 'none';
      });
      return;
    }

    if (syState.view === 'combos') {
      const hasCombos = SY.combos && Object.keys(SY.combos).length;
      if (!hasCombos) { body.innerHTML = '<div class="reroll-note">This dataset predates combo mining — hit ⟳ Refresh in the Patches tab to re-crawl with 2–6-unit combos.</div>'; return; }
      const K = syState.k;
      let rows = (SY.combos[K] || []).slice();
      // phase view: swap displayed WR to the selected phase (if sampled)
      rows = rows.map(r => {
        const ph = syState.phase !== 'all' && r.phases ? r.phases[syState.phase] : null;
        return { ...r, showWR: ph ? ph.winRate : (syState.phase === 'all' ? r.winRate : null), showRounds: ph ? ph.rounds : r.rounds };
      }).filter(r => r.showWR != null && r.showRounds >= syState.minRounds);
      if (syState.search) {
        const q = syState.search;
        rows = rows.filter(r => r.ids.some(id => monName(id).toLowerCase().includes(q) || id.includes(q)));
      }
      const key = syState.sort === 'winRate' ? 'showWR' : syState.sort;
      rows.sort((a, b) => (a[key] - b[key]) * syState.dir || b.rounds - a.rounds);
      const kLabel = { 2: 'Pairs', 3: 'Trios', 4: 'Quads', 5: 'Quints', 6: 'Full boards (6)' };
      body.innerHTML = `<div class="card">
        <div class="tier-controls" style="margin-bottom:10px">
          <label class="ctl">Combo size<select id="sy-k">${[2, 3, 4, 5, 6].map(k => `<option value="${k}" ${String(k) === K ? 'selected' : ''}>${kLabel[k]}</option>`).join('')}</select></label>
          <label class="ctl">Phase<select id="sy-phase">
            <option value="all" ${syState.phase === 'all' ? 'selected' : ''}>All rounds</option>
            <option value="early" ${syState.phase === 'early' ? 'selected' : ''}>Early (day 1-3)</option>
            <option value="mid" ${syState.phase === 'mid' ? 'selected' : ''}>Mid (day 4-6)</option>
            <option value="late" ${syState.phase === 'late' ? 'selected' : ''}>Late (day 7+)</option>
          </select></label>
          <label class="ctl">Min rounds<input type="number" id="sy-minr" value="${syState.minRounds}" min="0" step="10" style="width:80px"></label>
          <label class="ctl">Containing<input type="text" id="sy-search" value="${esc(syState.search)}" placeholder="monster name…" style="width:140px"></label>
          <span class="pill" style="align-self:flex-end">${rows.length} combos</span>
        </div>
        <table class="stats"><tr>
          <th>${kLabel[K].replace(/ .*/, '')}</th>
          <th class="sort" data-key="winRate" style="cursor:pointer">Win rate${sortArrow('winRate', syState.sort, syState.dir)}</th><th></th>
          <th class="sort" data-key="lift" style="cursor:pointer">Lift${sortArrow('lift', syState.sort, syState.dir)}</th>
          <th class="sort" data-key="rounds" style="cursor:pointer">Rounds${sortArrow('rounds', syState.sort, syState.dir)}</th>
          <th class="sort" data-key="runs" style="cursor:pointer">Runs${sortArrow('runs', syState.sort, syState.dir)}</th></tr>
        ${rows.slice(0, 80).map(p => `<tr>
          <td style="white-space:nowrap">${p.ids.map(id => `${monImg(id)} <b>${esc(monName(id))}</b>`).join(' <span style="color:var(--muted)">+</span> ')}</td>
          <td style="white-space:nowrap">${wrSpan(p.showWR, p.showRounds)} ${confDot(p.showRounds)}${syState.phase !== 'all' ? ` <span style="color:var(--muted);font-size:10px">(${p.winRate}% all)</span>` : ''}</td>
          <td>${wrBar(p.showWR)}</td>
          <td style="color:${p.lift >= 0 ? 'var(--green)' : 'var(--red)'};cursor:help" title="${LIFT_TITLES.combos}">${p.lift >= 0 ? '+' : ''}${p.lift}pp</td>
          <td style="color:var(--muted)">${p.showRounds.toLocaleString()}</td>
          <td style="color:var(--muted)">${p.runs}</td></tr>`).join('')}
        </table></div>`;
      $('#sy-k').onchange = (e) => { syState.k = e.target.value; drawSy(); };
      $('#sy-phase').onchange = (e) => { syState.phase = e.target.value; drawSy(); };
      $('#sy-minr').onchange = (e) => { syState.minRounds = Math.max(0, +e.target.value || 0); drawSy(); };
      const sIn = $('#sy-search');
      sIn.oninput = () => { syState.search = sIn.value.toLowerCase().trim(); drawSy(); const n = $('#sy-search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      body.querySelectorAll('th.sort').forEach(th => th.onclick = () => {
        const k = th.dataset.key;
        if (syState.sort === k) syState.dir *= -1; else { syState.sort = k; syState.dir = -1; }
        drawSy();
      });
    }

    if (syState.view === 'meta') {
      const rarNames = { 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Super Rare', 5: 'Legendary', 6: 'Mythical' };
      let rows = Object.entries(SY.monsters).map(([id, s]) => ({ id, tier: (monById[id] || {}).tier || s.tier, ...s })).filter(r => r.rounds >= 60);
      if (syState.rarity !== 'all') rows = rows.filter(r => r.tier === +syState.rarity);
      if (syState.metaType !== 'all') rows = rows.filter(r => ((monById[r.id] || {}).types || []).some(t => t.id === syState.metaType));
      rows = rows.map(r => {
        // slice priority: level filter > day filter > overall
        let slice = null;
        if (syState.level !== 'all' && r.byLevel) slice = r.byLevel[syState.level] || false;
        else if (syState.day !== 'all' && r.byDay) slice = r.byDay[syState.day] || false;
        if (slice === false) return { ...r, showWR: null };
        return { ...r, showWR: slice ? slice.winRate : r.winRate, showRounds: slice ? slice.rounds : r.rounds };
      }).filter(r => r.showWR != null && r.showRounds >= 20);
      const key = syState.metaSort === 'winRate' ? 'showWR' : syState.metaSort;
      rows.sort((a, b) => (a[key] - b[key]) * syState.metaDir || b.rounds - a.rounds);
      body.innerHTML = `<div class="card">
        <div class="tier-controls" style="margin-bottom:10px">
          <label class="ctl">Day<select id="sy-day">
            <option value="all" ${syState.day === 'all' ? 'selected' : ''}>All days</option>
            ${Array.from({ length: 15 }, (_, i) => i + 1).map(d => `<option value="${d}" ${syState.day === String(d) ? 'selected' : ''}>Day ${d}${d === 15 ? '+' : ''}</option>`).join('')}
          </select></label>
          <label class="ctl">Rarity<select id="sy-rar">
            <option value="all" ${syState.rarity === 'all' ? 'selected' : ''}>All rarities</option>
            ${[1, 2, 3, 4, 5, 6].map(t => `<option value="${t}" ${syState.rarity === String(t) ? 'selected' : ''}>${rarNames[t]}</option>`).join('')}
          </select></label>
          <label class="ctl">Type<select id="sy-type">
            <option value="all" ${syState.metaType === 'all' ? 'selected' : ''}>All types</option>
            ${[...new Set(monsters.flatMap(m => (m.types || []).map(t => t.id)))].sort().map(ty => `<option value="${ty}" ${syState.metaType === ty ? 'selected' : ''}>${ty}</option>`).join('')}
          </select></label>
          <label class="ctl">Level on board<select id="sy-lvl">
            <option value="all" ${syState.level === 'all' ? 'selected' : ''}>All levels</option>
            ${[1, 2, 3, 4, 5].map(l => `<option value="${l}" ${syState.level === String(l) ? 'selected' : ''}>Level ${l}${l === 5 ? ' (special)' : ''}</option>`).join('')}
          </select></label>
          <span class="pill" style="align-self:flex-end">${rows.length} monsters · min 20 rounds in slice${syState.level !== 'all' ? ' · level overrides day' : ''}</span>
        </div>
        <table class="stats"><tr>
          <th>Batomon</th>
          <th class="sort" data-key="winRate" style="cursor:pointer">WR${syState.level !== 'all' ? ' (Lv' + syState.level + ')' : syState.day !== 'all' ? ' (day ' + syState.day + ')' : ''}${sortArrow('winRate', syState.metaSort, syState.metaDir)}</th><th></th>
          <th class="sort" data-key="pickRate" style="cursor:pointer">In % runs${sortArrow('pickRate', syState.metaSort, syState.metaDir)}</th>
          <th class="sort" data-key="avgCopies" style="cursor:pointer" title="Average copies fielded when present — >1.5 means players run it as multiples">Copies${sortArrow('avgCopies', syState.metaSort, syState.metaDir)}</th>
          <th class="sort" data-key="avgLevel" style="cursor:pointer">Avg lvl${sortArrow('avgLevel', syState.metaSort, syState.metaDir)}</th>
          <th class="sort" data-key="shinyWR" style="cursor:pointer" title="WR of rounds with a shiny copy vs rounds without">Shiny WR${sortArrow('shinyWR', syState.metaSort, syState.metaDir)}</th>
          <th class="sort" data-key="rounds" style="cursor:pointer">Rounds${sortArrow('rounds', syState.metaSort, syState.metaDir)}</th></tr>
        ${rows.map(r => `<tr style="cursor:pointer" onclick="window.__dex('${r.id}')">
          <td style="white-space:nowrap">${monImg(r.id)} <b>${esc(monName(r.id))}</b> <span style="color:${rarColor(monById[r.id] || {})};font-size:10.5px">${esc(rarNames[r.tier] || '')}</span></td>
          <td style="white-space:nowrap">${wrSpan(r.showWR, r.showRounds)} ${confDot(r.showRounds)}${(syState.day !== 'all' || syState.level !== 'all') ? ` <span style="color:var(--muted);font-size:10px">(${r.winRate}% all)</span>` : ''}</td>
          <td>${wrBar(r.showWR)}</td>
          <td>${r.pickRate}%</td>
          <td${(r.avgCopies || 1) >= 1.5 ? ' style="color:var(--gold);font-weight:700" title="Players run this as multiples"' : ''}>${r.avgCopies || '—'}</td>
          <td>${r.avgLevel}</td>
          <td style="white-space:nowrap">${r.shinyWR != null ? `${wrSpan(r.shinyWR, r.shinyRounds)}${r.normalWR != null ? ` <span style="color:var(--muted);font-size:10px">vs ${r.normalWR}%</span>` : ''}` : '—'}</td>
          <td style="color:var(--muted)">${r.showRounds.toLocaleString()}</td></tr>`).join('')}
        </table></div>`;
      $('#sy-day').onchange = (e) => { syState.day = e.target.value; drawSy(); };
      $('#sy-rar').onchange = (e) => { syState.rarity = e.target.value; drawSy(); };
      $('#sy-lvl').onchange = (e) => { syState.level = e.target.value; drawSy(); };
      $('#sy-type').onchange = (e) => { syState.metaType = e.target.value; drawSy(); };
      body.querySelectorAll('th.sort').forEach(th => th.onclick = () => {
        const k = th.dataset.key;
        if (syState.metaSort === k) syState.metaDir *= -1; else { syState.metaSort = k; syState.metaDir = -1; }
        drawSy();
      });
    }

    if (syState.view === 'positions' && (syState.posMode || 'mon') === 'combo') {
      const K = syState.posK || '2';
      const posFloor = +K >= 5 ? 8 : (syState.posMin || 60) / 2; // thin data for quints/full boards
      let rows = (SY.combos[K] || []).filter(c => c.layouts && c.posRounds >= posFloor);
      if (syState.posSearch) rows = rows.filter(c => c.ids.some(id => monName(id).toLowerCase().includes(syState.posSearch)));
      rows = rows.slice().sort((a, b) => b.posRounds - a.posRounds);
      const layoutGrid = (c, L) => {
        const cells = [0, 1, 2, 3, 4, 5].map(slot => {
          const mi = L.slots.indexOf(slot);
          if (mi === -1) return '<div class="pos-cell" style="background:rgba(255,255,255,.03)"></div>';
          const m = monById[c.ids[mi]];
          return `<div class="pos-cell" style="background:rgba(90,162,255,.25)" title="${esc((m || {}).name || c.ids[mi])} — ${SLOT_SHORT[slot]}">
            <img class="sprite" src="${spr((m || {}).sprite || '')}" style="width:26px;height:26px">
          </div>`;
        });
        return `<div style="text-align:center">
          <div class="pos-grid">${cells.join('')}</div>
          <div style="font-size:10px;margin-top:3px"><b>${L.share}%</b> of boards · ${wrSpan(L.winRate, L.rounds)} <span style="color:var(--muted)">(${L.rounds}r)</span></div>
        </div>`;
      };
      body.innerHTML = `<div class="card">
        <div class="tier-controls" style="margin-bottom:10px">
          <button class="ghost" id="sy-posmode">👤 Monsters</button>
          <label class="ctl">Combo size<select id="sy-posk">${[2, 3, 4, 5, 6].map(k => `<option value="${k}" ${String(k) === K ? 'selected' : ''}>${{ 2: 'Duos', 3: 'Trios', 4: 'Quads', 5: 'Quints', 6: 'Full boards (6)' }[k]}</option>`).join('')}</select></label>
          <label class="ctl">Containing<input type="text" id="sy-possearch" value="${esc(syState.posSearch || '')}" placeholder="monster name…" style="width:150px"></label>
          <span class="pill" style="align-self:flex-end">${rows.length} combos · real layouts from full 6-unit boards · enemies to the RIGHT</span>
        </div>
        <div class="note" style="margin-bottom:10px">The actual grid arrangements top players use for each combo — <b>share = how often that exact layout appears</b>, with its own win rate. Copy the highest-WR layout, not just the most common one.</div>
        <div class="pos-list">
        ${rows.slice(0, 40).map(c => `<div class="pos-row">
          <div style="min-width:170px">
            <div style="display:flex;gap:3px;margin-bottom:3px">${c.ids.map(id => `<img class="sprite" src="${spr((monById[id] || {}).sprite || '')}" width="26" height="26" title="${esc(monName(id))}">`).join('')}</div>
            <div style="font-weight:700;font-size:11.5px">${c.ids.map(id => esc(monName(id))).join(' + ')}</div>
            <div style="font-size:10px;color:var(--muted)">${wrSpan(c.winRate, c.rounds)} overall · ${c.posRounds} full-board rounds</div>
          </div>
          <div style="display:flex;gap:14px;flex-wrap:wrap">${c.layouts.map(L => layoutGrid(c, L)).join('')}</div>
        </div>`).join('')}</div></div>`;
      $('#sy-posmode').onclick = () => { syState.posMode = 'mon'; drawSy(); };
      $('#sy-posk').onchange = (e) => { syState.posK = e.target.value; drawSy(); };
      const pcIn = $('#sy-possearch');
      pcIn.oninput = () => { syState.posSearch = pcIn.value.toLowerCase().trim(); drawSy(); const n = $('#sy-possearch'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      return;
    }
    if (syState.view === 'positions') {
      const SLOT_LABELS = SLOT_SHORT;
      let rows = Object.entries(SY.monsters)
        .map(([id, s]) => ({ id, ...s }))
        .filter(r => r.slots && r.slotRounds >= (syState.posMin || 60));
      if (syState.posSearch) rows = rows.filter(r => monName(r.id).toLowerCase().includes(syState.posSearch));
      rows.sort((a, b) => b.slotRounds - a.slotRounds);
      const miniGrid = (r) => {
        const cells = [0, 1, 2, 3, 4, 5].map(i => {
          const v = r.slots[i];
          if (!v) return `<div class="pos-cell" style="opacity:.15" title="${SLOT_LABELS[i]} — never seen here">·</div>`;
          const alpha = Math.min(0.12 + (v.share / 100) * 1.6, 0.95);
          const fav = i === r.favSlot, best = i === r.bestSlot;
          return `<div class="pos-cell ${best ? 'pos-best' : ''}" style="background:rgba(90,162,255,${alpha.toFixed(2)})"
            title="${SLOT_LABELS[i]} — placed ${v.share}% of the time · ${v.winRate}% WR (${v.rounds} rounds)${fav ? ' · crowd favorite' : ''}${best ? ' · BEST win rate' : ''}">
            <b>${Math.round(v.share)}%</b><span class="wr-${wrTier(v.winRate)}" style="font-size:8.5px">${Math.round(v.winRate)}</span></div>`;
        });
        return `<div class="pos-grid">${cells.join('')}</div>`;
      };
      body.innerHTML = `<div class="card">
        <div class="tier-controls" style="margin-bottom:10px">
          <button class="ghost" id="sy-posmode">🧩 Combos (duos/trios/quads)</button>
          <label class="ctl">Containing<input type="text" id="sy-possearch" value="${esc(syState.posSearch || '')}" placeholder="monster name…" style="width:150px"></label>
          <label class="ctl">Min placements<input type="number" id="sy-posmin" value="${syState.posMin || 60}" min="40" step="20" style="width:80px"></label>
          <span class="pill" style="align-self:flex-end">${rows.length} monsters · full 6-unit boards only (${(SY.sample && SY.sample.rounds) ? '5,050' : ''} rounds) · enemies to the RIGHT</span>
        </div>
        <div class="note" style="margin-bottom:10px">Each mini-board: <b>% = how often top players place it there</b> (blue intensity), small number = <b>win rate in that slot</b> (WR colors). ⭐ = highest-WR slot (min 25 rounds). Crowd habit ≠ best slot — check both.</div>
        <div class="pos-list">
        ${rows.map(r => `<div class="pos-row">
          <div style="display:flex;align-items:center;gap:8px;min-width:150px">${monImg(r.id)} <div>
            <div style="font-weight:700;font-size:12px">${esc(monName(r.id))}</div>
            <div style="font-size:10px;color:var(--muted)">${r.slotRounds.toLocaleString()} placements</div></div></div>
          ${miniGrid(r)}
          <div style="font-size:10.5px;min-width:170px">
            <div>Crowd: <b>${SLOT_LABELS[r.favSlot]}</b> (${r.slots[r.favSlot].share}%)</div>
            ${r.bestSlot != null ? `<div>Best WR: <b class="wr-${wrTier(r.slots[r.bestSlot].winRate)}">${SLOT_LABELS[r.bestSlot]}</b> (${r.slots[r.bestSlot].winRate}%)${r.bestSlot !== r.favSlot ? ' <span title="The crowd habit is not the winning slot">⚠️</span>' : ''}</div>` : ''}
          </div>
        </div>`).join('')}</div></div>`;
      const psIn = $('#sy-possearch');
      psIn.oninput = () => { syState.posSearch = psIn.value.toLowerCase().trim(); drawSy(); const n = $('#sy-possearch'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      $('#sy-posmin').onchange = (e) => { syState.posMin = Math.max(40, +e.target.value || 60); drawSy(); };
      $('#sy-posmode').onclick = () => { syState.posMode = 'combo'; drawSy(); };
    }

    if (syState.view === 'trainermon') {
      const trName = (id) => (D.trainers.find(t => t.id === id) || { name: humanize(id) }).name;
      const trImg = (id) => { const t = D.trainers.find(t => t.id === id); return t ? `<img class="sprite" src="${spr(t.sprite)}" width="28" style="vertical-align:middle">` : ''; };
      const hasDeep = SY.trainerCombos && Object.keys(SY.trainerCombos).length;
      if (!hasDeep) { body.innerHTML = '<div class="reroll-note">This dataset predates trainer-combo mining — hit ⟳ Refresh in the Patches tab.</div>'; return; }
      const K = syState.trK;
      let rows = (SY.trainerCombos[K] || []).filter(r => r.rounds >= syState.trMin);
      if (syState.trFilter !== 'all') rows = rows.filter(r => r.trainer === syState.trFilter);
      if (syState.trSearch) rows = rows.filter(r => r.ids.some(id => monName(id).toLowerCase().includes(syState.trSearch)));
      rows.sort((a, b) => (a[syState.trSort] - b[syState.trSort]) * syState.trDir || b.rounds - a.rounds);
      const trainersInData = [...new Set(((SY.trainerCombos['1'] || []).map(r => r.trainer)))].sort();
      body.innerHTML = `<div class="card">
        <div class="tier-controls" style="margin-bottom:10px">
          <label class="ctl">Combo<select id="sy-trk">${[1, 2, 3, 4, 5, 6].map(k => `<option value="${k}" ${String(k) === K ? 'selected' : ''}>Trainer + ${k} Batomon</option>`).join('')}</select></label>
          <label class="ctl">Trainer<select id="sy-trfilter"><option value="all">All trainers</option>${trainersInData.map(t => `<option value="${t}" ${syState.trFilter === t ? 'selected' : ''}>${esc(trName(t))}</option>`).join('')}</select></label>
          <label class="ctl">Min rounds<input type="number" id="sy-trmin" value="${syState.trMin}" min="0" step="5" style="width:80px"></label>
          <label class="ctl">Containing<input type="text" id="sy-trsearch" value="${esc(syState.trSearch)}" placeholder="monster name…" style="width:130px"></label>
          <span class="pill" style="align-self:flex-end">${rows.length} combos · lift = vs same Batomon combo under ANY trainer</span>
        </div>
        <table class="stats"><tr><th>Trainer</th><th>Batomon</th>
          <th class="sort" data-key="winRate" style="cursor:pointer">Win rate${sortArrow('winRate', syState.trSort, syState.trDir)}</th><th></th>
          <th class="sort" data-key="lift" style="cursor:pointer">Trainer lift${sortArrow('lift', syState.trSort, syState.trDir)}</th>
          <th class="sort" data-key="rounds" style="cursor:pointer">Rounds${sortArrow('rounds', syState.trSort, syState.trDir)}</th>
          <th class="sort" data-key="runs" style="cursor:pointer">Runs${sortArrow('runs', syState.trSort, syState.trDir)}</th></tr>
        ${rows.slice(0, 80).map(r => `<tr>
          <td style="white-space:nowrap">${trImg(r.trainer)} <b>${esc(trName(r.trainer))}</b></td>
          <td style="white-space:nowrap">${r.ids.map(id => `${monImg(id)} ${esc(monName(id))}`).join(' <span style="color:var(--muted)">+</span> ')}</td>
          <td style="white-space:nowrap">${wrSpan(r.winRate, r.rounds)} ${confDot(r.rounds)}</td><td>${wrBar(r.winRate)}</td>
          <td style="color:${r.lift >= 0 ? 'var(--green)' : 'var(--red)'};cursor:help" title="${LIFT_TITLES.trainer}">${r.lift >= 0 ? '+' : ''}${r.lift}pp</td>
          <td style="color:var(--muted)">${r.rounds.toLocaleString()}</td>
          <td style="color:var(--muted)">${r.runs}</td></tr>`).join('')}
        </table></div>`;
      $('#sy-trk').onchange = (e) => { syState.trK = e.target.value; drawSy(); };
      $('#sy-trfilter').onchange = (e) => { syState.trFilter = e.target.value; drawSy(); };
      $('#sy-trmin').onchange = (e) => { syState.trMin = Math.max(0, +e.target.value || 0); drawSy(); };
      const trIn = $('#sy-trsearch');
      trIn.oninput = () => { syState.trSearch = trIn.value.toLowerCase().trim(); drawSy(); const n = $('#sy-trsearch'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      body.querySelectorAll('th.sort').forEach(th => th.onclick = () => {
        const k = th.dataset.key;
        if (syState.trSort === k) syState.trDir *= -1; else { syState.trSort = k; syState.trDir = -1; }
        drawSy();
      });
    }

    if (syState.view === 'trinketmon') {
      const tkName = (id) => (D.trinkets.find(t => t.id === id) || { name: humanize(id) }).name;
      const tkImg = (id) => { const t = D.trinkets.find(t => t.id === id); return t ? `<img class="sprite" src="${spr(t.sprite)}" width="26" style="vertical-align:middle">` : ''; };
      const hasDeep = SY.trinketCombos && SY.trinketSets;
      if (!hasDeep) { body.innerHTML = '<div class="reroll-note">This dataset predates trinket-combo mining — hit ⟳ Refresh in the Patches tab.</div>'; return; }
      const mode = syState.tkMode;
      const isSet = mode.startsWith('set');
      let rows = (isSet ? SY.trinketSets[mode.slice(3)] : SY.trinketCombos[mode]) || [];
      rows = rows.filter(r => r.rounds >= syState.tkMin);
      if (syState.tkSearch) {
        const q = syState.tkSearch;
        rows = rows.filter(r => (r.ids || []).some(id => (isSet ? tkName(id) : monName(id)).toLowerCase().includes(q)) || (!isSet && tkName(r.trinket).toLowerCase().includes(q)));
      }
      rows = rows.slice().sort((a, b) => (a[syState.tkSort] - b[syState.tkSort]) * syState.tkDir || b.rounds - a.rounds);
      body.innerHTML = `<div class="card">
        <div class="tier-controls" style="margin-bottom:10px">
          <label class="ctl">Combo<select id="sy-tkmode">
            ${['1', '2', '3'].map(k => `<option value="${k}" ${mode === k ? 'selected' : ''}>Trinket + ${k} Batomon</option>`).join('')}
            <option value="set2" ${mode === 'set2' ? 'selected' : ''}>Trinket pair (held together)</option>
            <option value="set3" ${mode === 'set3' ? 'selected' : ''}>Trinket trio (held together)</option>
          </select></label>
          <label class="ctl">Min rounds<input type="number" id="sy-tkmin" value="${syState.tkMin}" min="0" step="5" style="width:80px"></label>
          <label class="ctl">Containing<input type="text" id="sy-tksearch" value="${esc(syState.tkSearch)}" placeholder="trinket or monster…" style="width:150px"></label>
          <span class="pill" style="align-self:flex-end">${rows.length} combos · lift = ${isSet ? 'vs each trinket held alone' : 'what holding the trinket adds to that board'}</span>
        </div>
        <table class="stats"><tr><th>${isSet ? 'Trinkets' : 'Trinket'}</th>${isSet ? '' : '<th>Batomon</th>'}
          <th class="sort" data-key="winRate" style="cursor:pointer">Win rate${sortArrow('winRate', syState.tkSort, syState.tkDir)}</th><th></th>
          <th class="sort" data-key="lift" style="cursor:pointer">Lift${sortArrow('lift', syState.tkSort, syState.tkDir)}</th>
          <th class="sort" data-key="rounds" style="cursor:pointer">Rounds${sortArrow('rounds', syState.tkSort, syState.tkDir)}</th>
          <th class="sort" data-key="runs" style="cursor:pointer">Runs${sortArrow('runs', syState.tkSort, syState.tkDir)}</th></tr>
        ${rows.slice(0, 80).map(r => `<tr>
          ${isSet
            ? `<td style="white-space:nowrap">${r.ids.map(id => `${tkImg(id)} <b>${esc(tkName(id))}</b>`).join(' <span style="color:var(--muted)">+</span> ')}</td>`
            : `<td style="white-space:nowrap">${tkImg(r.trinket)} <b>${esc(tkName(r.trinket))}</b></td>
               <td style="white-space:nowrap">${r.ids.map(id => `${monImg(id)} ${esc(monName(id))}`).join(' <span style="color:var(--muted)">+</span> ')}</td>`}
          <td style="white-space:nowrap">${wrSpan(r.winRate, r.rounds)} ${confDot(r.rounds)}</td><td>${wrBar(r.winRate)}</td>
          <td style="color:${r.lift >= 0 ? 'var(--green)' : 'var(--red)'};cursor:help" title="${isSet ? LIFT_TITLES.trinketSet : LIFT_TITLES.trinketMon}">${r.lift >= 0 ? '+' : ''}${r.lift}pp</td>
          <td style="color:var(--muted)">${r.rounds.toLocaleString()}</td>
          <td style="color:var(--muted)">${r.runs}</td></tr>`).join('')}
        </table></div>`;
      $('#sy-tkmode').onchange = (e) => { syState.tkMode = e.target.value; drawSy(); };
      $('#sy-tkmin').onchange = (e) => { syState.tkMin = Math.max(0, +e.target.value || 0); drawSy(); };
      const tkIn = $('#sy-tksearch');
      tkIn.oninput = () => { syState.tkSearch = tkIn.value.toLowerCase().trim(); drawSy(); const n = $('#sy-tksearch'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
      body.querySelectorAll('th.sort').forEach(th => th.onclick = () => {
        const k = th.dataset.key;
        if (syState.tkSort === k) syState.tkDir *= -1; else { syState.tkSort = k; syState.tkDir = -1; }
        drawSy();
      });
    }
  }

  // ---------------- PATCHES / NEWS TAB ----------------
  function cleanSteamBB(s) {
    return esc(String(s || ''))
      .replace(/\[h[123]\]/g, '<b style="color:var(--accent);display:block;margin-top:8px">').replace(/\[\/h[123]\]/g, '</b>')
      .replace(/\[b\]/g, '<b>').replace(/\[\/b\]/g, '</b>')
      .replace(/\[i\]/g, '<i>').replace(/\[\/i\]/g, '</i>')
      .replace(/\[list\]/g, '<ul style="margin-left:16px">').replace(/\[\/list\]/g, '</ul>')
      .replace(/\[\*\]/g, '<li>')
      .replace(/\[img\][^[]*\[\/img\]/g, '')
      .replace(/\[url=([^\]]*)\]/g, '<a href="$1" target="_blank" style="color:var(--accent)">').replace(/\[\/url\]/g, '</a>')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\n/g, '<br>');
  }
  function renderNews() {
    const root = $('#tab-news');
    root.innerHTML = `<h2>Patches & Updates — live</h2>
      <div class="note">Pulled from the Steam news feed for Batomon Showdown (main + demo apps) via the local server, cached 10 min. Optional: run <b>tools/discord-bridge.js</b> to also mirror the game's Discord announcements here (setup instructions in the file).</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="ghost" id="news-reload">↻ Reload feed</button>
        <button class="ghost" id="data-refresh" title="Re-scrape batodex dataset + synergies">⟳ Refresh ALL data (batodex + synergies)</button>
      </div>
      <pre id="refresh-log" style="display:none;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:11px;max-height:220px;overflow:auto"></pre>
      <div id="patch-diff-box"></div>
      <div id="news-list"><div class="note">Loading…</div></div>`;
    $('#news-reload').onclick = loadNews;
    // 📋 dataset diff from the last ⟳ refresh — "what actually changed"
    fetch('/api/patch-diff').then(r => r.json()).then(d => {
      const box = $('#patch-diff-box');
      if (!box || !d || d.none || !d.total) return;
      const sec = (name, s) => !s ? '' : `<div style="margin-top:6px"><b style="font-size:12px;text-transform:capitalize">${esc(name)}</b>: ${[
        ...s.added.map(x => `<span class="chip good" style="font-size:10px">+ ${esc(x.name || x.id)}</span>`),
        ...s.removed.map(x => `<span class="chip warn" style="font-size:10px">− ${esc(x.name || x.id)}</span>`),
        ...s.changed.map(x => `<span class="chip" style="font-size:10px" title="${esc(x.fields.join(', '))}">~ ${esc(x.name || x.id)} (${esc(x.fields.join(', '))})</span>`),
      ].join(' ')}</div>`;
      box.innerHTML = `<div class="card" style="margin-bottom:14px"><h3>📋 Dataset changes on last refresh <span style="font-size:10px;color:var(--muted);font-weight:400">· ${d.total} change${d.total > 1 ? 's' : ''} · ${esc((d.curStamp || '').slice(0, 10))}</span></h3>
        ${Object.entries(d.sections).map(([k, v]) => sec(k, v)).join('')}</div>`;
    }).catch(() => {});
    $('#data-refresh').onclick = async () => {
      const log = $('#refresh-log'); log.style.display = 'block'; log.textContent = 'starting…\n';
      try {
        const r = await fetch('/api/refresh');
        const reader = r.body.getReader(); const dec = new TextDecoder();
        while (true) { const { done, value } = await reader.read(); if (done) break; log.textContent += dec.decode(value); log.scrollTop = log.scrollHeight; }
        log.textContent += '\nReload the page to use the fresh data.';
      } catch (e) { log.textContent += 'refresh failed: ' + e.message + ' (are you running node server.js?)'; }
    };
    async function loadNews() {
      const list = $('#news-list');
      try {
        const [steam, discord] = await Promise.all([
          fetch('/api/news').then(r => r.json()),
          fetch('/api/discord').then(r => r.ok ? r.json() : []).catch(() => []),
        ]);
        const all = [...steam.map(n => ({ ...n, source: 'steam' })), ...discord].sort((a, b) => b.date - a.date);
        list.innerHTML = all.length ? '' : '<div class="note">No news returned.</div>';
        all.slice(0, 30).forEach(n => {
          const c = el('div', 'card');
          c.style.marginBottom = '10px';
          c.innerHTML = `<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
              <b style="font-size:15px">${esc(n.title)}</b>
              <span class="pill">${n.source === 'discord' ? '💬 Discord' : '🎮 Steam'}</span>
              <span style="color:var(--muted);font-size:12px">${new Date(n.date * 1000).toLocaleString()}</span>
              ${n.url ? `<a href="${esc(n.url)}" target="_blank" style="color:var(--accent);font-size:12px;margin-left:auto">open ↗</a>` : ''}</div>
            <div style="font-size:12.5px;margin-top:8px;color:#c6cbdc;max-height:260px;overflow:auto">${cleanSteamBB(n.contents)}</div>`;
          list.appendChild(c);
        });
      } catch (e) {
        list.innerHTML = `<div class="reroll-note">Could not load news: ${esc(e.message)}. Run the app through <b>node server.js</b> (not a plain static server) so /api/news works.</div>`;
      }
    }
    loadNews();
  }

  // ---------------- MECHANICS TAB ----------------
  function renderMech(rootEl) { // renders INTO the Batodex body (⚙️ sub-tab)
    const root = rootEl; if (!root) return;
    root.innerHTML = `<h3 style="margin:4px 0 6px">⚙️ Mechanics Cheat Sheet</h3><div class="note">${esc(GNOTE())}</div><div class="mech-grid" id="mech-grid"></div>`;
    const grid = $('#mech-grid');
    GMECH().forEach(([title, body]) => grid.appendChild(el('div', 'mech-card', `<b>${esc(title)}</b>${esc(body)}`)));
  }

  // ---------------- 📡 COMMUNITY TAB (Steam discussions — meta talk + bug reports) ----------------
  function renderCommunity() {
    const root = $('#tab-community');
    root.innerHTML = `<h2>📡 Community — live from the Steam forums</h2>
      <div class="note">Public discussions for Batomon Showdown (main + demo apps): meta talk, bug reports, dev replies. Refreshes every 10 min — the 🧠 AI analysis reads the same feed. Official Discord isn't scrapable without ToS risk; this is the compliant pulse.</div>
      <div class="tier-controls">
        <input type="text" id="cm-q" placeholder="Filter threads…" style="min-width:220px">
        <button class="ghost cm-f active" data-f="">All</button>
        <button class="ghost cm-f" data-f="bug">🐛 Bugs & issues</button>
        <button class="ghost cm-f" data-f="meta">📊 Meta & balance</button>
        <button class="ghost" id="cm-reload" style="margin-left:auto">↻ Reload</button>
      </div>
      <div id="cm-list" style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        <div class="reroll-note">Loading Steam discussions…</div>
      </div>`;
    const BUG_RE = /bug|crash|broken|fix|issue|error|stuck|connect|can't|cant|freeze|softlock|glitch/i;
    const META_RE = /meta|best|build|tier|nerf|buff|balance|op\b|overpower|strong|weak|water|fire|shock|poison|burn|strat/i;
    let topics = [];
    const draw = () => {
      const q = ($('#cm-q').value || '').toLowerCase().trim();
      const f = (root.querySelector('.cm-f.active') || {}).dataset?.f || '';
      const list = $('#cm-list');
      const rows = topics.filter(t => {
        if (q && !(t.title + ' ' + (t.preview || '') + ' ' + (t.op || '')).toLowerCase().includes(q)) return false;
        if (f === 'bug') return BUG_RE.test(t.title);
        if (f === 'meta') return META_RE.test(t.title) && !BUG_RE.test(t.title);
        return true;
      });
      list.innerHTML = rows.length ? '' : '<div class="reroll-note">Nothing matches — clear the filter or reload.</div>';
      rows.forEach(t => {
        const isBug = BUG_RE.test(t.title), isMeta = META_RE.test(t.title);
        const c = el('div', 'dex-card wide');
        c.style.cursor = 'pointer';
        c.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start">
          <div style="font-size:20px;line-height:1">${isBug ? '🐛' : isMeta ? '📊' : '💬'}</div>
          <div style="min-width:0;text-align:left;flex:1">
            <div class="nm">${esc(t.title)} ${isBug ? '<span class="chip warn" style="font-size:9px">bug/issue</span>' : ''}${!isBug && isMeta ? '<span class="chip good" style="font-size:9px">meta</span>' : ''}</div>
            <div class="meta">by ${esc(t.op || '?')} · ${t.replies} repl${t.replies === 1 ? 'y' : 'ies'} · ${t.appid === 4557380 ? 'main app' : 'demo'} forum</div>
            ${t.preview ? `<div class="meta" style="margin-top:3px;color:var(--text);opacity:.8">${esc(t.preview)}</div>` : ''}
          </div>
          <span style="color:var(--muted);font-size:11px;white-space:nowrap">open ↗</span></div>`;
        c.onclick = () => window.open(t.url, '_blank', 'noopener');
        c.title = 'Opens the Steam thread in a new tab';
        $('#cm-list').appendChild(c);
      });
    };
    const load = async (bust) => {
      try {
        const r = await fetch('/api/discussions' + (bust ? '?t=' + Date.now() : ''), { cache: 'no-store' });
        topics = await r.json();
        draw();
      } catch (e) {
        $('#cm-list').innerHTML = '<div class="reroll-note" style="border-color:var(--red)">⚠️ Server unreachable — run <b>node server.js</b> for the live feed.</div>';
      }
    };
    $('#cm-q').oninput = draw;
    root.querySelectorAll('.cm-f').forEach(b => b.onclick = () => {
      root.querySelectorAll('.cm-f').forEach(x => x.classList.toggle('active', x === b));
      draw();
    });
    $('#cm-reload').onclick = () => { $('#cm-list').innerHTML = '<div class="reroll-note">Reloading…</div>'; load(true); };
    load(false);
  }

  // ---------------- 🙋 WHO AM I TAB ----------------
  function renderWho() {
    const root = $('#tab-who');
    const coffee = COFFEE_URL
      ? `<button class="coffee-btn big" onclick="document.querySelector('#coffee-btn').click()">☕ Buy me a coffee</button>`
      : `<button class="coffee-btn big is-soon" disabled title="Support options are coming at launch — thank you for wanting to 💛">☕ Buy me a coffee <span class="soon-badge">coming soon</span></button>`;
    root.innerHTML = `
      <h2>🙋 Who am I</h2>
      <div class="who-grid">
        <div class="card">
          <h3>Hey — I'm Julian 👋</h3>
          <p style="font-size:13.5px;line-height:1.6;margin-top:8px">I'm a builder. I spend my days shipping products, data pipelines and AI tools — and my evenings losing lives to autobattlers. <b>Batomon Showdown</b> grabbed me instantly: simple to learn, deep to master, exactly the kind of game where a good decision beats a lucky roll.</p>
        </div>
        <div class="card">
          <h3>Why I built this</h3>
          <p style="font-size:13.5px;line-height:1.6;margin-top:8px">I love playing <b>Path of Exile 2</b> — and that's where I discovered that games get genuinely MORE fun when you learn them with a companion at your side (Path of Building, trade overlays… the game opens up instead of shrinking). I wanted that same <i>Mobalytics experience</i> for Batomon: real numbers instead of gut feelings. So this companion reads the official <a href="https://batodex.com" target="_blank" rel="noopener">Batodex</a> database, crawls hundreds of top-Master runs for real win rates, simulates your battles with wiki-exact mechanics, and syncs with your live game in real time. Every single feature came from a real <i>“I wish I knew this mid-run”</i> moment.</p>
          <p style="font-size:13.5px;line-height:1.6;margin-top:10px">Building it was <b>fun</b> — it genuinely made me happy and it challenged me. I hope the feeling is mutual when you play with it. 💙</p>
        </div>
        <div class="card" style="border-color:rgba(255,221,0,.35)">
          <h3>Support the project ☕</h3>
          <p style="font-size:13.5px;line-height:1.6;margin:8px 0 12px">This app is <b>free and fan-made</b>, built for the love of the game. If it helped you win a badge (or ten), you can buy me a coffee — totally optional, and it would mean the world to me.</p>
          ${coffee}
        </div>
        <div class="card" style="border-color:rgba(61,220,132,.3)">
          <h3>Special thanks 💛</h3>
          <p style="font-size:13.5px;line-height:1.6;margin-top:8px">To <b>berrymint</b> for making this lovely game — and for letting fans build around it. Batomon Showdown is entirely their work: go <a href="https://store.steampowered.com/app/4557380/Batomon_Showdown/" target="_blank" rel="noopener">wishlist &amp; play it on Steam</a> and leave a review, that helps them way more than anything here.</p>
          <p class="note" style="margin-top:10px">Unofficial fan project — not affiliated with or endorsed by berrymint. All game assets, names and data belong to their creators; live database courtesy of batodex.com.</p>
        </div>
      </div>`;
  }
  // ☕ Support button: LIVE once COFFEE_URL is filled; until then it wears a
  // "coming soon" badge, reads disabled, and clicking just explains (no dead
  // click, no funnel to a page that isn't set up yet).
  const coffeeBtn = $('#coffee-btn');
  if (coffeeBtn) {
    if (COFFEE_URL) {
      coffeeBtn.onclick = () => window.open(COFFEE_URL, '_blank', 'noopener');
    } else {
      const soon = $('#coffee-soon'); if (soon) soon.style.display = '';
      coffeeBtn.classList.add('is-soon');
      coffeeBtn.title = 'Support options are coming at launch — thank you for wanting to 💛';
      coffeeBtn.onclick = () => {
        const b = document.querySelector('#nav button[data-tab="who"]'); if (b) b.click();
      };
    }
  }

  // ---------------- 💬 FEEDBACK TAB ----------------
  // Form → local server → the maintainer's email (formsubmit relay) + private Discord
  // (webhook, kept server-side). Direct contacts displayed underneath.
  function renderFeedback() {
    const root = $('#tab-feedback');
    root.innerHTML = `
      <h2>💬 Feedback</h2>
      <div class="note">Found a bug? Wrong number? Feature idea? A build the advisor sleeps on? Tell me — every message lands straight in my inbox and my Discord. I read all of it.</div>
      <div class="who-grid">
        <div class="card">
          <h3>Send me a message</h3>
          <label class="ctl" style="margin-top:10px">Subject
            <input type="text" id="fb-subject" maxlength="150" placeholder="e.g. Battle Brain undervalues my burn comp"></label>
          <label class="ctl" style="margin-top:10px">Message
            <textarea id="fb-message" rows="7" maxlength="4000" placeholder="What happened, what you expected — screenshots go to my Discord/email directly if needed." style="background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:8px 10px;font-size:13px;font-family:inherit;resize:vertical"></textarea></label>
          <div class="row" style="gap:10px;margin-top:10px">
            <label class="ctl" style="flex:1">Your name <span style="font-weight:400">(optional)</span>
              <input type="text" id="fb-name" maxlength="80"></label>
            <label class="ctl" style="flex:1">How to reach you back <span style="font-weight:400">(optional — email/Discord)</span>
              <input type="text" id="fb-contact" maxlength="120"></label>
          </div>
          <input type="text" id="fb-website" style="display:none" tabindex="-1" autocomplete="off">
          <div style="display:flex;gap:10px;align-items:center;margin-top:14px">
            <button class="primary" id="fb-send">📨 Send feedback</button>
            <span id="fb-status" style="font-size:12px;color:var(--muted)"></span>
          </div>
        </div>
        <div class="card">
          <h3>Or reach me directly</h3>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;font-size:13.5px">
            <div>💬 <b>Discord</b> — ${DISCORD_USERNAME
              ? `<code id="fb-discord" style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:3px 9px;font-size:13px">${esc(DISCORD_USERNAME)}</code>
                 <button class="ghost" id="fb-copy" style="font-size:10.5px;padding:3px 9px;margin-left:6px">copy</button>
                 <div class="note" style="margin-top:6px">Add me or DM me — happy to talk builds, bugs or the app.</div>`
              : '<span class="note" style="margin:0">(username coming right up — meanwhile the form reaches my Discord too)</span>'}</div>
            <div class="note" style="margin:4px 0 0">I'm active on the game's community spaces too — but this form is the fastest way to make the app better.</div>
          </div>
        </div>
        <div class="card">
          <h3>🌐 Improve the stats for everyone</h3>
          <p style="font-size:13px;line-height:1.55;margin-top:8px">With game sync on, your battles can contribute <b>anonymized snapshots</b> (board, result, trainer, trinkets — nothing personal) to the community dataset. Every run you play makes the win rates and advice sharper for the next player — and theirs for you.</p>
          <label class="ctl" style="flex-direction:row;align-items:center;gap:8px;margin-top:10px;font-size:12.5px">
            <input type="checkbox" id="fb-ingest" ${localStorage.getItem('bc_ingest') === '1' ? 'checked' : ''}>
            Share my anonymized battle results
          </label>
          <div class="note" style="margin:8px 0 0;font-size:10px" id="fb-ingest-note"></div>
        </div>
      </div>`;
    const ing = $('#fb-ingest');
    const ingNote = $('#fb-ingest-note');
    const ingStatus = () => {
      fetch('/api/ingest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(j => { ingNote.textContent = j.disabled ? 'Collection opens at v1 — your choice is saved and takes effect the moment it goes live.' : 'Collection is LIVE — thank you for feeding the brain. 💙'; })
        .catch(() => { ingNote.textContent = 'Server offline — the choice is saved locally.'; });
    };
    ing.onchange = () => { localStorage.setItem('bc_ingest', ing.checked ? '1' : '0'); ingStatus(); };
    ingStatus();
    const copyBtn = $('#fb-copy');
    if (copyBtn) copyBtn.onclick = () => { navigator.clipboard.writeText(DISCORD_USERNAME).then(() => { copyBtn.textContent = '✓ copied'; setTimeout(() => { copyBtn.textContent = 'copy'; }, 1500); }); };
    $('#fb-send').onclick = async () => {
      const status = $('#fb-status');
      const subject = $('#fb-subject').value.trim(), message = $('#fb-message').value.trim();
      if (!subject || !message) { status.innerHTML = '<span style="color:var(--red)">Subject and message are both needed.</span>'; return; }
      status.textContent = '⏳ Sending…';
      $('#fb-send').disabled = true;
      try {
        const r = await fetch('/api/feedback', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject, message, name: $('#fb-name').value.trim(), contact: $('#fb-contact').value.trim(), website: $('#fb-website').value }),
        });
        const j = await r.json();
        if (j.ok) {
          status.innerHTML = '<span style="color:var(--green)">✓ Sent — thank you! I read everything.</span>';
          $('#fb-subject').value = ''; $('#fb-message').value = '';
        } else if (j.channels && /Activation/i.test(j.channels.email || '')) {
          status.innerHTML = '<span style="color:var(--gold)">⚠️ The mailbox is finishing its one-time setup — try again in a bit, or email me directly below.</span>';
        } else {
          status.innerHTML = `<span style="color:var(--red)">⚠️ ${esc(j.error || (j.channels ? 'email: ' + j.channels.email + ' · discord: ' + j.channels.discord : 'send failed'))}</span> — email me directly below.`;
        }
      } catch (e) {
        status.innerHTML = '<span style="color:var(--red)">⚠️ Server unreachable (node server.js running?)</span> — email me directly below.';
      }
      $('#fb-send').disabled = false;
    };
  }

  // ---------------- boot ----------------
  $('#foot').innerHTML = `Data: <a href="https://batodex.com" target="_blank">batodex.com</a> (live database + Master Ranked stats) · Batomon Showdown by berrymint · dataset ${new Date(D.generatedAt).toLocaleString()} · ${D.monsters.length} monsters / ${D.trainers.length} trainers / ${D.trinkets.length} trinkets / ${D.items.length} items · fan-made companion, not affiliated · v1.0.0-rc`;
  window.__dex = openDexDetail; // for inline onclick in synergy tables
  window.__sim = openSimulate;  // 🔬 Simulate button on buy rows
  renderLive();
  renderAdvisor();
  renderTrinkets();
  renderDays();
  renderBuilds();  // creates #builds-tiers-host …
  renderTiers();   // … which this fills (Tier Lists sub-view)
  renderDex();     // Mechanics renders inside via its ⚙️ sub-tab
  renderNews();
  renderCommunity();
  renderWho();
  renderFeedback();
  // language toggle (game names always stay English)
  const lt = $('#lang-toggle');
  if (lt && window.LANG) {
    lt.textContent = window.LANG.lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR';
    lt.onclick = () => window.LANG.set(window.LANG.lang === 'fr' ? 'en' : 'fr');
  }
  if (window.LANG) window.LANG.watch(); // translate chrome + keep dynamic re-renders translated

  // 📸 GLOBAL SCREENSHOT → PNG in Downloads (works on every tab). getDisplayMedia
  // grabs the REAL rendered tab, sprites and all — no external libs, no CSP
  // issues. First click prompts to share a tab (pick THIS one); the stream is
  // kept so later clicks are instant. Files name themselves by the active tab.
  {
    let shotStream = null;
    const shotBtn = $('#shot-btn');
    if (shotBtn) shotBtn.onclick = async () => {
      const old = shotBtn.textContent;
      try {
        if (!shotStream || !shotStream.active) {
          shotStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, preferCurrentTab: true, audio: false });
          shotStream.getVideoTracks()[0].addEventListener('ended', () => { shotStream = null; });
        }
        const track = shotStream.getVideoTracks()[0];
        await new Promise(r => setTimeout(r, 300)); // let the current tab paint into the stream
        let blob;
        if (window.ImageCapture) {
          const bmp = await new ImageCapture(track).grabFrame();
          const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
          c.getContext('2d').drawImage(bmp, 0, 0);
          blob = await new Promise(res => c.toBlob(res, 'image/png'));
        } else {
          const v = document.createElement('video'); v.srcObject = shotStream; await v.play();
          await new Promise(r => setTimeout(r, 200));
          const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
          c.getContext('2d').drawImage(v, 0, 0); v.pause();
          blob = await new Promise(res => c.toBlob(res, 'image/png'));
        }
        const tab = (document.querySelector('#nav button.active') && document.querySelector('#nav button.active').dataset.tab) || 'view';
        const a = document.createElement('a'); a.download = `batomon-${tab}.png`; a.href = URL.createObjectURL(blob); a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        shotBtn.textContent = '✓ saved'; setTimeout(() => { shotBtn.textContent = old; }, 1400);
      } catch (e) { shotBtn.textContent = '✗ ' + (e.name === 'NotAllowedError' ? 'cancelled' : 'failed'); setTimeout(() => { shotBtn.textContent = old; }, 1800); }
    };
  }
  // 🔗 shared-board link (?b=…): open the read-only viewer on arrival
  {
    const bParam = new URLSearchParams(location.search).get('b');
    if (bParam) { const dec = decodeBoardCode(bParam); if (dec) setTimeout(() => openSharedBoard(dec), 300); }
  }
  // 🎓 ONBOARDING TOUR — first visit only: five stops, skippable anytime.
  if (localStorage.getItem('bc_tour') !== '1' && !new URLSearchParams(location.search).get('b')) {
    const steps = [
      { sel: '#lv-sync', text: '🔌 <b>Game sync</b> — click this while Batomon Showdown runs and the app mirrors your board, shop, gold and lives automatically. Everything below updates live.' },
      { sel: '#lv-advice-buy', text: '🧭 <b>The plan column</b> — one coordinated directive (This Turn), then buy advice with ⚔️ win-chance deltas, reroll math and strategy plays you can adopt.' },
      { sel: '#lv-advice-brain', text: '🧮 <b>The Battle Brain</b> — an event-based combat simulation of today\'s fight: win chance, run health, power-spike warnings, per-unit breakdown.' },
      { sel: '#lv-optimize', text: '🧲 <b>Optimize positioning</b> — sim-verified best arrangement; make the moves in game and the tracker ticks them ✅. 🔗 Share posts your board as a code.' },
      { sel: '#nav button[data-tab="profile"]', text: '📈 <b>Profile</b> — your player page: rank, skill radar, career stats, and every finished run archived with day-by-day timelines, calibration and summary cards. The app coaches you from your own games.' },
    ];
    let ti = 0;
    const dim = el('div'); dim.id = 'bc-tour';
    dim.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55)';
    const tip = el('div');
    tip.style.cssText = 'position:fixed;z-index:9001;max-width:340px;background:var(--bg2,#1b1b24);border:1px solid var(--accent,#7b93c3);border-radius:12px;padding:14px 16px;font-size:12.5px;line-height:1.55;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    const show = () => {
      const st = steps[ti];
      const t = document.querySelector(st.sel);
      document.querySelectorAll('.tour-hi').forEach(x => x.classList.remove('tour-hi'));
      let top = innerHeight / 2 - 60, left = innerWidth / 2 - 170;
      if (t) {
        t.classList.add('tour-hi');
        const r = t.getBoundingClientRect();
        top = Math.min(Math.max(r.bottom + 10, 10), innerHeight - 190);
        left = Math.min(Math.max(r.left, 10), innerWidth - 360);
      }
      tip.style.top = top + 'px'; tip.style.left = left + 'px';
      tip.innerHTML = `${st.text}<div style="display:flex;gap:8px;margin-top:10px;align-items:center">
        <button class="primary" id="tour-next" style="font-size:11.5px;padding:5px 14px">${ti === steps.length - 1 ? 'Done ✓' : 'Next →'}</button>
        <button class="ghost" id="tour-skip" style="font-size:11px">Skip tour</button>
        <span style="margin-left:auto;font-size:10px;color:var(--muted)">${ti + 1}/${steps.length}</span></div>`;
      tip.querySelector('#tour-next').onclick = () => { ti++; if (ti >= steps.length) end(); else show(); };
      tip.querySelector('#tour-skip').onclick = end;
    };
    const end = () => { localStorage.setItem('bc_tour', '1'); dim.remove(); tip.remove(); document.querySelectorAll('.tour-hi').forEach(x => x.classList.remove('tour-hi')); };
    dim.onclick = end;
    setTimeout(() => { document.body.appendChild(dim); document.body.appendChild(tip); show(); }, 600);
  }
  // ---------------- 📦 UPDATE CHECK (release channel) ----------------
  // Every install polls the PUBLIC repo's version.json once per session. Two outcomes:
  //   · newer version available          → dismissible banner + Download button
  //   · this build < manifest.minSupported → FULL-SCREEN BLOCK (the retired build stops
  //     working, exactly as intended when a breaking release ships) + Download button
  // Fails silent + open: no network, offline play, or a malformed manifest never blocks
  // anyone — the app just runs. Only an explicit, well-formed minSupported can block.
  const verNum = (v) => String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
  function verCmp(a, b) { // -1 | 0 | 1
    const A = verNum(a), B = verNum(b);
    for (let i = 0; i < Math.max(A.length, B.length); i++) {
      const d = (A[i] || 0) - (B[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }
  function showUpdateBlock(man) {
    const dl = man.downloadUrl || man.releaseUrl || DOWNLOAD_PAGE;
    const box = document.createElement('div');
    box.id = 'bc-update-block';
    box.innerHTML = `<div class="upd-inner">
        <div class="upd-badge">UPDATE REQUIRED</div>
        <h2>A new version of Batomon Companion is out</h2>
        <p>You're running <b>v${esc(APP_VERSION)}</b>. This version has been retired and no longer runs — <b>v${esc(man.version)}</b> is required.</p>
        ${man.notes ? `<p class="upd-notes">What's new: ${esc(man.notes)}</p>` : ''}
        <a class="upd-cta" href="${esc(dl)}" target="_blank" rel="noopener">⬇ Download the latest version</a>
        <p class="upd-fine">Unzip over your current folder and run <code>node server.js</code> again. Your runs, rank and settings are stored in the browser and are kept.</p>
      </div>`;
    document.body.appendChild(box);
  }
  function showUpdateBanner(man) {
    if (localStorage.getItem('bc_updSkip') === String(man.version)) return; // dismissed this version
    const dl = man.downloadUrl || man.releaseUrl || DOWNLOAD_PAGE;
    const bar = document.createElement('div');
    bar.id = 'bc-update-bar';
    bar.innerHTML = `<span>✨ <b>v${esc(man.version)}</b> is available — you're on v${esc(APP_VERSION)}.${man.notes ? ` ${esc(man.notes)}` : ''}</span>
      <a class="upd-get" href="${esc(dl)}" target="_blank" rel="noopener">Get it</a>
      <button class="upd-x" title="Dismiss until the next version">✕</button>`;
    document.body.appendChild(bar);
    bar.querySelector('.upd-x').onclick = () => { localStorage.setItem('bc_updSkip', String(man.version)); bar.remove(); };
  }
  function checkForUpdate() {
    fetch(UPDATE_MANIFEST, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(man => {
        if (!man || !man.version) return;                              // no/garbage manifest → run normally
        if (man.minSupported && verCmp(APP_VERSION, man.minSupported) < 0) return showUpdateBlock(man);
        if (verCmp(man.version, APP_VERSION) > 0) showUpdateBanner(man);
      })
      .catch(() => {});                                                // offline → never block
  }
  setTimeout(checkForUpdate, 2500); // after first paint, so the app is usable instantly

  // synergy dataset + learned build archetypes are optional — load async, then render
  Promise.all([
    fetch('synergy-stats.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch('discovered-builds.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch('master-bench.json').then(r => (r.ok ? r.json() : null)).catch(() => null),
  ]).then(([sy, disc, mb]) => {
    if (sy) window.SYNERGY = pruneSynergy(sy);
    if (disc) window.DISCOVERED = disc;
    if (mb) window.MASTER_BENCH = mb; // per-day Master board-strength benchmark (📊 Board vs Master)
    renderSynergy(); renderLive();
    // 📐 Builds & Tiers was rendered at init, BEFORE this fetch resolved — so the
    // 🧬 Discovered section had no data and never appeared. Re-render it now that
    // window.DISCOVERED exists (renderBuilds recreates #builds-tiers-host, so
    // renderTiers must follow to refill the Tier Lists sub-view).
    if (disc) { renderBuilds(); renderTiers(); }
  }).catch(() => renderSynergy());

  // 🎯 Headless export hook for tools/calibrate_sim.js (offline sim-vs-corpus
  // calibration). Browser-INERT: `module` is undefined in the page, so this whole
  // statement is skipped when the app runs normally — it only fires when app.js is
  // loaded inside a Node vm that provides a `module` object. Exposes the EXACT
  // prediction core (same boardOutputs → buildEventSpecs → E.simEvents → baseHPFor
  // path the Battle Brain uses) so the harness can never drift from the live model.
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = {
      E, live, monById,
      boardOutputs, buildEventSpecs, avgEnemySpecs, baseHPFor, suggestedHP,
      quickWinPct, calibrationReport, pruneSynergy, streakFactor, scaleEnemyProfile,
      pendingEventHTML, scoreEventOption,
      castsOnce, cdGrowthPerCast, effectiveCasts, buildEventSpecs,
    };
  }
})();
