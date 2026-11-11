# /travel

January 2027 warm-weather trip options on the /runs globe. Each option is a pin and a row in the ranking. Selecting either one opens a card with the cost breakdown, weather, highlights, the sample itinerary (top 3 only), and source links. `?dest=<slug>` opens a card directly, and `&dates=jan2` switches prices to Jan 2–9. Jan 5–12 is the default.

## Data

The source of truth is the Google Sheet "January 2027 Warm-Weather Trip Options":
https://docs.google.com/spreadsheets/d/1ryfjLvoGTmf63buDqLxvHFbxLKBbhXAJswBkxhYBb_Q/edit

- `src/data/travel/sheet/*.csv` is a snapshot of its four tabs (Ranking, Cost breakdown, Itineraries (top 3), Sources & method), taken Nov 11, 2026.
- `src/data/travel/places.json` holds what the Sheet doesn't have: slug, pin label, map position, pin nudge for the zoomed-out view, and which Sources rows apply to each option.
- `node scripts/travel/build-travel.mjs` writes `src/data/travel/trips.json` from those two inputs. The page reads only that file.

To refresh after the Sheet changes, export each tab as CSV over the matching file in `sheet/`, run the build, then run `node --test scripts/travel/*.test.mjs`. The tests check that every total equals the sum of its parts, that the Ranking and Cost breakdown tabs agree, and that every dollar figure on the page appears in the Sheet.

The page books and buys nothing. Its only links are the Sheet and the Sources tab citations. It sets `robots: noindex`.
