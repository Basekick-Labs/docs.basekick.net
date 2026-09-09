---
title: "arcli sample"
description: "Load a real public dataset into your own Arc with arcli sample load: dataset listing, checksum-verified downloads, resumable fetches, and the two showcase queries it prints."
---

`arcli sample` puts a **real dataset** into a database you own, then hands you queries worth running against it. A synthetic data point proves the write path works; it does not show you what Arc is for.

## Quick reference

```bash
arcli sample list                    # what is published
arcli sample show citibike           # details, licence, time range
arcli sample load citibike           # download, verify, import
```

## Loading a dataset

```text
$ arcli sample load citibike
Created database "nyc"
Dataset:     NYC Citi Bike trips (citibike), 2025-12
Source:      https://samples.basekick.net
Download:    31 files, 39.4 MiB, 1003770 rows
Directory:   /tmp/arcli-sample/citibike/2025-12
Target:      nyc.citibike_trips
Licence:     NYCBS Data Use Policy - https://ride.citibikenyc.com/data-sharing-policy

Verified 31 files against the published checksums.
Imported 31 files, 1003770 rows into nyc.citibike_trips

Try these:

  # Busiest stations
  arcli query --database nyc 'SELECT start_station_name AS station, count(*) AS trips FROM citibike_trips GROUP BY 1 ORDER BY trips DESC LIMIT 5'

  # Departures per hour, with a 3-hour moving average
  arcli query --database nyc 'WITH hourly AS (...) SELECT hr, trips, round(avg(trips) OVER (ORDER BY hr ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS moving_avg_3h FROM hourly ORDER BY hr LIMIT 24'
```

The printed queries are ready to paste. The first returns `W 21 St & 6 Ave` at the top with 4,070 trips; the second shows the commute curve, peaking at 08:00 and 17:00.

Importing needs an **admin** token when the Arc server has authentication enabled. That is checked before anything is downloaded, so a permissions problem costs you nothing.

## Flags

| Flag | Default | Purpose |
| --- | --- | --- |
| `--month` | newest published | Which month to load |
| `--database` | the dataset's suggested database | Target database, created if absent |
| `--measurement` | the dataset's measurement | Target measurement |
| `--download-dir` | a temp directory | Keep the Parquet somewhere durable |
| `--download-only` | off | Fetch and verify without importing; needs no Arc connection |
| `--yes` | off | Skip the prompt when the measurement already holds rows |

## Behaviour worth knowing

**Every file is checksum-verified.** Each part's SHA-256 is compared against the published manifest before anything is imported. A file that does not match is re-downloaded once, and if it still does not match the command fails rather than importing data that does not match the manifest.

**Downloads resume.** A file already present with a matching checksum is not fetched again, so an interrupted run picks up where it left off. Files download four at a time, and one failure stops the rest.

**A second run asks first.** If the target measurement already holds rows, `load` reports the count and asks before adding more, so a re-run cannot silently double the numbers the showcase queries report. `--yes` skips the prompt; a non-interactive shell refuses rather than hanging.

## Inspecting without downloading

`arcli sample show <dataset> -o json` prints the full manifest entry, including every file URL and SHA-256:

```bash
arcli sample show citibike -o json
```

That is also the escape hatch if you would rather not fetch from Basekick at all: download the files however you like, verify them against those checksums, and load them with [`arcli import parquet`](/arcli/commands/import/).

## About the data

NYC Citi Bike trip records, published by NYC Bike Share under the [NYCBS Data Use Policy](https://ride.citibikenyc.com/data-sharing-policy), one month per dataset entry. The full archive lives at the [NYC source](https://citibikenyc.com/system-data).

The `time` column carries local New York wall-clock time, which is what makes the hourly curve peak where a reader expects. Note that Arc stores every timestamp column other than `time` as integer microseconds, so `started_at` and `ended_at` need `to_timestamp(x/1000000)` if you want to read them as timestamps.

## Privacy

These are the only arcli commands that contact a Basekick-controlled host. They send the same `User-Agent` and installation id as any other arcli request, honouring `DO_NOT_TRACK=1` and `send_installation_id = false`, and never your token, your Arc endpoint or anything about your data. See [Privacy](/arcli/reference/privacy/) for the detail, including what any file download necessarily reveals.
