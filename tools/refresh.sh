#!/bin/sh
# Refresh the companion dataset from live batodex.com (run from tools/).
# Re-downloads pages, re-extracts data, rebuilds ../data.js + ../dataset.json, fetches new sprites.
set -e
curl -s "https://batodex.com/monsters/bumblebolt" -o mon_bumblebolt.html
curl -s "https://batodex.com/trainers" -o cat_trainers.html
curl -s "https://batodex.com/trinkets" -o cat_trinkets.html
curl -s "https://batodex.com/items"    -o cat_items.html
curl -s "https://batodex.com/events"   -o page_events.html
curl -s "https://batodex.com/stats"    -o page_stats.html
curl -s "https://batodex.com/stats/trinkets" -o page_stats_trinkets.html
node extract_data.js mon_bumblebolt.html monsters
node extract_data.js cat_trainers.html trainers
node extract_data.js cat_trinkets.html trinkets
node extract_data.js cat_items.html items
node extract_data.js page_events.html events
node build_dataset.js ..
node download_sprites.js ..
node discover_builds.js   # re-cluster emergent build archetypes from current synergy data
node master_bench.js      # rebuild per-day Master board-strength benchmark (📊 Board vs Master)
echo "Done. Reload the app."
