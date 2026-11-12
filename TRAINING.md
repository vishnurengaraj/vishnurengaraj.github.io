# /training

Training for the Way Too Cool 50K (Sat Mar 6, 2027), a sibling of /runs. Three tabs, each deep-linkable:

- **This week** (`/training`, the default): week strip, four target rings (miles, vert, long run, key session), readiness for the week, the suggested days, and a short course profile.
- **Calendar** (`/training?tab=calendar`): a month grid with planned and logged chips, a readiness overlay, and a week or day panel (a bottom sheet on phones).
- **Road to Cool** (`/training?tab=road`): countdown and phase track, cumulative miles against the plan, the long-run ladder, vert by week, and the full scrubbable course profile with where each section gets rehearsed.

Progress is weekly target completion. Days are suggestions; the page never marks a day as missed. Moving a session on This week lasts until you leave the page and is not saved. The page sets `robots: noindex`.

## Data

The page reads only `src/data/training/training.json`, which `scripts/training/build-training.mjs` writes from:

| Input | What it supplies |
| --- | --- |
| `src/data/training/plan.json` | The plan, by week: miles, vert range, long run, key session, note, and seven suggested days. Edit this file to change the plan. Source: the Health And Fitness training Page (link in the file). |
| `src/data/training/course.json` | Course sections, aid stations, and where each section gets rehearsed. Also names the GPX. |
| `/workspace/wtc50k/wtc50k-course-plotaroute-2721862.gpx` | The elevation profile, sampled every 0.1 mi with the GPX distance (29.44 mi) scaled to the official 31.4. |
| `/workspace/strava/activities_raw.json` | Logged activities: date, type, title, distance, elevation gain, moving time, average HR, Strava link. |
| `/workspace/ha-health-dashboard/exercise_master.json` | The Garmin pairing list /runs already uses. Adds Garmin-recorded runs that Strava does not have. Rows that match a Strava id are skipped. |
| `/workspace/garmin/daily-log.csv` | Readiness score and level, 7-day HRV and status, sleep score and duration. No other column is read. |

Only activities from the plan start through the build date are included. Nothing is estimated: a day with no source row has no actual. There is no weight or body-composition data on the page.

### Counting rules (`src/training/progress.js`)

- Miles, the long run, and the key session count `Run` and `Trail Run`. Vert also counts `Hike`. Walks are not counted.
- **Key session:** the long run already has its own ring, so it never counts as the key session. Hills can’t be detected from Strava summaries, so the key session is done when a run **other than the week’s longest run** climbs at least the week’s low vert target ÷ 3 (week 1: 300 ÷ 3 = 100 ft). If two runs tie for longest, one is set aside. In race week the key session is the race, done when a run is logged on race day.

## Refresh

```sh
npm run build:training          # or: node scripts/training/build-training.mjs --as-of 2026-11-11
npx playwright test qa/training.spec.js qa/training-rules.spec.js --project=chromium
npm run build
```

The as-of date defaults to today in America/Los_Angeles. "Today", the countdown, and the current week all follow it, so rebuild daily. The nightly /runs ingest (about 12:45 AM PT, after Home Automation syncs `/workspace/strava/`) should run `npm run build:training` before the site build, then commit `src/data/training/training.json` with the /runs data.

To change the plan, edit `plan.json` (weeks run Mon–Sun from `start`; `mi` is the planned distance and `miText` is the chip label), rebuild, and run the tests. `qa/training-rules.spec.js` covers the key-session rule and checks every Strava actual against the source file.
