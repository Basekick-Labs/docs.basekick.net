---
sidebar_position: 5
---

# TLE (Satellite Orbital Data)

Ingest satellite orbital data in the standard Two-Line Element (TLE) format used by Space-Track.org, CelesTrak, and ground station pipelines.

:::info Available since v26.02.1
TLE ingestion and import are available starting Arc v26.02.1 (February 2026).
:::

## Overview

Arc provides native TLE parsing with two ingestion modes:

- **Streaming** (`POST /api/v1/write/tle`) -- for continuous TLE feeds, cron jobs, and real-time updates
- **Bulk import** (`POST /api/v1/import/tle`) -- for historical backfill from Space-Track.org exports or CelesTrak catalog dumps

TLE data is parsed into a configurable measurement (default: `satellite_tle`) with orbital elements as fields and satellite identifiers as tags. Derived orbital metrics (semi-major axis, period, apogee, perigee, orbit classification) are computed automatically.

## TLE Format

Arc supports both 3-line (with satellite name) and 2-line (no name) TLE formats, including mixed-format files.

**3-line format:**
```
ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9001
2 25544  51.6400 100.2000 0007420  35.5000 324.6000 15.49560000    09
```

**2-line format:**
```
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9001
2 25544  51.6400 100.2000 0007420  35.5000 324.6000 15.49560000    09
```

## Headers

| Header | Required | Default | Description |
|--------|----------|---------|-------------|
| `Authorization` | Yes | - | `Bearer YOUR_TOKEN` |
| `X-Arc-Database` | No | `default` | Target database |
| `X-Arc-Measurement` | No | `satellite_tle` | Target measurement name |

## Streaming Ingestion

For continuous TLE feeds, cron jobs, and real-time updates from ground stations.

### Endpoint

```
POST /api/v1/write/tle
```

### Example

```bash
curl -X POST "http://localhost:8000/api/v1/write/tle" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Arc-Database: satellites" \
  --data-binary @stations.tle
```

Returns `204 No Content` on success.

### Custom Measurement

```bash
curl -X POST "http://localhost:8000/api/v1/write/tle" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Arc-Database: satellites" \
  -H "X-Arc-Measurement: iss_orbital_elements" \
  --data-binary @iss.tle
```

### Statistics

```bash
curl "http://localhost:8000/api/v1/write/tle/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Bulk Import

For historical backfill from Space-Track.org exports or CelesTrak catalog dumps.

### Endpoint

```
POST /api/v1/import/tle
```

### Example

```bash
curl -X POST "http://localhost:8000/api/v1/import/tle" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Arc-Database: satellites" \
  -F "file=@catalog.tle"
```

### Response

```json
{
  "status": "ok",
  "result": {
    "database": "satellites",
    "measurement": "satellite_tle",
    "satellite_count": 28000,
    "rows_imported": 28000,
    "duration_ms": 1250
  }
}
```

## Schema

The default measurement `satellite_tle` has the following schema:

### Tags

| Column | Description |
|--------|-------------|
| `norad_id` | NORAD catalog number |
| `object_name` | Satellite name (from line 0 of 3-line format) |
| `classification` | U (unclassified), C (classified), S (secret) |
| `international_designator` | Launch year + piece identifier |
| `orbit_type` | Derived: LEO, MEO, GEO, HEO |

### Fields

| Column | Type | Description |
|--------|------|-------------|
| `inclination_deg` | float | Orbital inclination (degrees) |
| `raan_deg` | float | Right ascension of ascending node (degrees) |
| `eccentricity` | float | Orbital eccentricity |
| `arg_perigee_deg` | float | Argument of perigee (degrees) |
| `mean_anomaly_deg` | float | Mean anomaly (degrees) |
| `mean_motion_rev_day` | float | Revolutions per day |
| `bstar` | float | BSTAR drag coefficient |
| `semi_major_axis_km` | float | Derived: semi-major axis (km) |
| `period_min` | float | Derived: orbital period (minutes) |
| `apogee_km` | float | Derived: apogee altitude (km) |
| `perigee_km` | float | Derived: perigee altitude (km) |

## Example Queries

```sql
-- All LEO satellites sorted by orbital period
SELECT object_name, orbit_type, period_min, perigee_km, apogee_km
FROM satellite_tle
WHERE orbit_type = 'LEO'
ORDER BY period_min;

-- Track orbital decay for a specific satellite
SELECT object_name, time, mean_motion_rev_day, perigee_km
FROM satellite_tle
WHERE norad_id = '25544'
ORDER BY time DESC
LIMIT 100;

-- Count satellites by orbit type
SELECT orbit_type, COUNT(DISTINCT norad_id) as satellite_count
FROM satellite_tle
GROUP BY orbit_type
ORDER BY satellite_count DESC;
```

## Features

- **Pure Go parser** -- no external dependencies
- **Mixed format support** -- handles both 2-line and 3-line TLE in the same file
- **Gzip support** -- compressed payloads auto-detected via magic bytes
- **Checksum validation** -- graceful skip on bad entries (warnings collected, not fatal)
- **Derived metrics** -- semi-major axis, period, apogee, perigee, and orbit classification computed automatically
- **RBAC-aware** -- write permissions checked per measurement
- **Cluster routing** -- writes forwarded to writer nodes automatically
- **500 MB size limit** on bulk imports

## Performance

TLE ingestion uses a typed columnar fast path that bypasses the generic `[]interface{}` intermediary. The parser operates directly on `[]byte` input with contiguous record allocation and single-pass typed column construction, achieving ~3.5M records/sec on commodity hardware.
