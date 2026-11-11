# /travel

January 2027 trip options on the /runs basemap, ranked for mild weather (highs about 55°F or more, lows above freezing, not rain-soaked). Each option is a pin and a row in the ranking. Selecting either one opens a card with the cost breakdown, a weighted score, weather, a week sketch, flight times from LAX and DTW, a short safety note, and source links. `?dest=<slug>` opens a card directly, and `&dates=jan2` switches to Jan 2–9 when that window has been priced. Jan 5–12 is the default. The current Worldwide ranking is priced for Jan 5–12 only.

The default list follows the weighted score (Outdoors 25%, Food 20%, Museums & City 20%, Price 15%, Getting There 10%, Safety 10%). A sort dropdown can switch to any category or to name.

The overview uses the same Positron basemap as /runs, in mercator, so every pin is visible at once. A 3D globe can only show one hemisphere, and these 17 places span about 260°.

## Data

The source of truth is the Google Sheet "January 2027 Warm-Weather Trip Options":
https://docs.google.com/spreadsheets/d/1ryfjLvoGTmf63buDqLxvHFbxLKBbhXAJswBkxhYBb_Q/edit

- `src/data/travel/sheet/*.csv` is a snapshot of its tabs, taken Nov 11, 2026. The Worldwide tab is the prices, week sketches, and flight times. The Scores and Safety tabs feed the ranking and the card notes. Asia, Europe & beyond, South America, Ranking, and Sources & method are kept beside them.
- `src/data/travel/weights.json` holds the category shares. They must sum to 1. Change a share, run the build, and every total is recomputed. The page reads the computed totals from `trips.json`, not this file directly.
- `src/data/travel/places.json` holds what the Sheet doesn't have: slug, pin label, map position, pin nudge for the zoomed-out view, and which Sources rows apply to each option.
- `node scripts/travel/build-travel.mjs` writes `src/data/travel/trips.json` from those inputs. The page reads only that file.

To refresh after the Sheet changes, export the Worldwide, Scores, Safety, Asia, Europe & beyond, South America, and Sources & method tabs as CSV over the matching files in `sheet/`, run the build, then run `node --test scripts/travel/*.test.mjs`. The tests check that every total equals the sum of its parts, that one LAX fare plus one DTW fare equals the flights total, that every computed weighted score matches the Scores tab, and that every dollar figure on the page appears in the Sheet.

The page books and buys nothing. Its only links are the Sheet and the Sources tab citations. It sets `robots: noindex`.
