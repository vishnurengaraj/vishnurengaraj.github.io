# Runs

`/runs` is a full-viewport map of runs, sibling to `/diners`. Far zoom is a density heatmap for the open city. Closer in, the heat fades and each run is a translucent hairline, so a path like the Strand builds a bright vein where runs repeat. Click a line (there is an invisible wider hit target) to open the run. Overlapping lines offer a short chooser. City chips fly the camera; only that city's lines are on the map.

The page does not talk to Strava. `npm run build:runs` writes static files, and the site ships those. The committed files under `public/media/runs/` are a real export with photos left out. A no-flag build replaces that export with the labeled sample.

## Sample

With no flags, the script writes a labeled sample: South Bay, San Francisco, and New York routes traced from public landmarks, plus inland spurs where a driveway would be. The map says "Sample routes". It is not a Strava export.

```bash
npm run build:runs
```

## Real data

Any real source replaces the sample. Add `--sample` only if you also want the sample mixed in.

Strava bulk export (unzipped). Distances in `activities.csv` are meters, times are seconds. Tracks are the `.gpx`, `.tcx`, or `.fit` files named in the `Filename` column, including `.gpx.gz`, `.tcx.gz`, and `.fit.gz`. Gzip is inflated with Node's zlib, then the inner file is parsed.

Kept sports are **Run, Trail Run, Walk, and Hike**. `RUN_TYPES` in `scripts/runs/parse.mjs` is `run`, `trail run`, `trailrun`, `walk`, `hike`, `walking`, and `hiking`. `fitIsRun()` also keeps FIT sport names that contain `run`, `walk`, or `hik`. Rides and virtual activities are skipped.

`activities.csv` Distance is meters and is stored as meters. A value under 200 that, with the moving time, is a plausible walk or run only after multiplying by 1000 (a marathon recorded as ~42.2, a long run as 11.82) is treated as kilometers and converted. Pace on the card uses that meter distance and the moving time.

```bash
npm run build:runs -- --export ~/Downloads/strava-export --photos /workspace/strava/photos
```

Stream JSON or a GeoJSON FeatureCollection, including a later dump of Strava `latlng` streams. A scraped `activities_raw.json` can fill names, dates, and totals. Encoded `map.summary_polyline` is used when that is the only geometry.

```bash
npm run build:runs -- --streams ./streams.json --meta /workspace/strava/activities_raw.json --photos /workspace/strava/photos
npm run build:runs -- --geojson ./runs.geojson --meta /workspace/strava/activities_raw.json
```

Each stream record can look like a Strava activity (`id`, `name`, `type`, `start_date`, `distance`, `moving_time`, `total_elevation_gain`, `latlng`).

Garmin FIT files fill runs that still have no line. Strava geometry wins when both exist. `exercise_master.json` is scanned for objects that carry a Strava id plus a Garmin id or a `.fit` path.

```bash
npm run build:runs -- --meta /workspace/strava/activities_raw.json --photos /workspace/strava/photos \
  --garmin /workspace/garmin/fit --master /workspace/ha-health-dashboard/exercise_master.json
```

Photos are read from `{photos}/{activityId}/`. EXIF is stripped. Put private exports outside the repo (`runs-export/` and `data/runs-private/` are gitignored).

## Privacy

Every published line has a 400m radius removed around its first and last points (clamped to 300–500m with `--trim`). A short activity that never leaves that radius is dropped. An optional polygon file hides extra blocks: pass `--zones privacy-zones.geojson`, or drop `privacy-zones.geojson` next to `activities.csv`.

Tracks outside the metro list are named (Tokyo, Madrid, Michigan, Waco, the eastern Sierra, and so on). Adjacent cells that are the same place share one chip and one heatmap. A Globe button opens a globe of those regions; choosing one flies into that city's pitched map.

## Output

| Path | What |
| --- | --- |
| `src/data/runs/manifest.json` | Cities, run index, default city. Bundled into the page. |
| `public/media/runs/cities/{id}.lines.geojson` | That city's lines only. |
| `public/media/runs/cities/{id}.heat.geojson` | Heat points for that city. |
| `public/media/runs/activities/{id}.json` | Card: distance, moving time, elevation, companions, photos. |
| `public/media/runs/photos/{id}/` | Resized WebP. |

Files live under `/media/runs/` so they do not collide with the flat `runs.html` page. Companions stay empty unless a source provides names. Strava's API does not, and the card hides the row when the list is empty.

Re-run the script before `npm run build` when the data changes. The committed sample is what the site serves until then.
