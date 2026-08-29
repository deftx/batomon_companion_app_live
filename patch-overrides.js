var window = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : this);
// ---------------------------------------------------------------------------
// PATCH OVERRIDES — balance the data source hasn't published yet.
//
// batodex is scraped, and it lags a live patch by days. The patch NOTES are
// authoritative, so anything listed here is applied on top of whatever the
// scrape returned. Every entry is compared before it is written: once batodex
// catches up and already serves the new value, the override becomes a silent
// no-op and can be deleted. That keeps the sim correct in the window between a
// patch landing and the database following it.
//
// Source: Steam — "Release Date Announcement Trailer! Also a Small Balance
// Patch (v0.8.5)". Handled elsewhere (they are code, not data):
//   · Shield status-damage reduction 25% -> 15%  → engine.js dealTo()
//   · Pyronade/Electranade/Stingarde finish multicasting before Knockout
//     → already the modelled behaviour (a cast resolves its full multicast,
//       then the unit stops), so no change was needed.
//   · Duplicators only copy non-unique trinkets → advisory text only.
// ---------------------------------------------------------------------------
window.PATCH_OVERRIDES = {
  patch: '0.8.5',
  supersedes: '0.8.4',
  monsters: {
    boomagon:   { cooldown: 7 },                       // 6 -> 7
    guardiant:  { cooldown: 4 },                       // 3.5 -> 4
    mosslug:    { cooldown: 6 },                       // 5 -> 6
    thorntail:  { cooldown: 6 },                       // 6.5 -> 6 (buff)
    stingarde:  { cooldown: 6 },                       // 5 -> 6
    alpinine:   { cost: 30 },                          // "Craghorn" $25 -> $30
    formiqueen: {                                      // CD buff 33/67/100 -> 25/50/75
      abilityByLevel: {
        1: 'Adjacent Common allies have +25% Cooldown Speed.',
        2: 'Adjacent Common allies have +50% Cooldown Speed.',
        3: 'Adjacent Common allies have +75% Cooldown Speed.',
      },
    },
    berroon: {                                         // REWORKED — no longer raises the item limit
      abilityTrigger: 'On Battle Start',
      abilityByLevel: {
        1: 'The next 1 item in your shop will be berries.',
        2: 'The next 2 items in your shop will be berries.',
        3: 'The next 3 items in your shop will be berries.',
      },
    },
  },
  trinkets: {
    // REWORKED — this is now the item-limit raiser (Berroon used to be)
    'Membership Card': { description: 'You can use 1 additional item today.' },
  },
};

// ---------------------------------------------------------------------------
// The applier lives HERE, not in app.js, because the browser is not the only
// consumer: tools/master_bench.js builds the "Board vs Master" baseline in Node
// from the same data. When only the browser applied the overrides, the app
// scored boards with 0.8.5 cooldowns against a baseline built on 0.8.4 ones and
// every percentile was quietly skewed. One implementation, both environments.
// Each field is compared before writing, so this no-ops once batodex catches up.
// ---------------------------------------------------------------------------
function applyPatchOverrides(D, P) {
  P = P || (typeof window !== 'undefined' ? window.PATCH_OVERRIDES : null);
  const applied = [];
  if (!P || !D || !Array.isArray(D.monsters)) return { patch: null, supersedes: null, applied };
  const byId = {};
  D.monsters.forEach((m) => { byId[m.id] = m; });
  for (const id of Object.keys(P.monsters || {})) {
    const o = P.monsters[id], m = byId[id];
    if (!m) continue;
    if (o.cooldown != null) {
      let hit = false;
      (m.levels || []).forEach((l) => { if (l && l.cooldown !== o.cooldown) { l.cooldown = o.cooldown; hit = true; } });
      (m.shinyLevels || []).forEach((l) => { if (l && l.cooldown !== o.cooldown) { l.cooldown = o.cooldown; hit = true; } });
      if (hit) applied.push(m.name + ': cooldown → ' + o.cooldown + 's');
    }
    if (o.cost != null && m.cost !== o.cost) { applied.push(m.name + ': cost → $' + o.cost); m.cost = o.cost; }
    if (o.abilityTrigger && m.ability && m.ability.trigger !== o.abilityTrigger) m.ability.trigger = o.abilityTrigger;
    if (o.abilityByLevel && m.ability) {
      m.ability.byLevel = Object.assign({}, m.ability.byLevel, o.abilityByLevel);
      if (o.abilityByLevel[1] && m.ability.description !== o.abilityByLevel[1]) {
        m.ability.description = o.abilityByLevel[1];
        applied.push(m.name + ': ability reworked');
      }
    }
  }
  for (const name of Object.keys(P.trinkets || {})) {
    const o = P.trinkets[name], t = (D.trinkets || []).find((x) => x && x.name === name);
    if (!t) continue;
    if (o.description && t.description !== o.description) { t.description = o.description; applied.push(name + ': reworked'); }
  }
  return { patch: P.patch, supersedes: P.supersedes, applied };
}
if (typeof window !== 'undefined') window.applyPatchOverrides = applyPatchOverrides;
if (typeof module !== 'undefined' && module.exports) module.exports = { PATCH_OVERRIDES: window.PATCH_OVERRIDES, applyPatchOverrides };
