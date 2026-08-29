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
