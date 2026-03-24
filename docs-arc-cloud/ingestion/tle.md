---
sidebar_position: 3
---

# TLE Satellite Data

Arc Cloud supports native ingestion of Two-Line Element (TLE) satellite orbital data, making it straightforward to build satellite tracking and space situational awareness applications.

:::info
TLE ingestion is available on all paid tiers.
:::

## Overview

TLE (Two-Line Element) sets describe satellite orbits and are the standard format published by NORAD and CelesTrak. Arc parses TLE data, extracts orbital parameters, and computes derived metrics automatically.

## Ingestion

### Streaming Write

Send individual TLE sets in real-time:

```bash
curl -X POST https://<instance>.arc.<region>.basekick.net/api/v1/write/tle \
  -H "Authorization: Bearer <token>" \
  -H "X-Arc-Database: satellites" \
  -d 'ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9023
2 25544  51.6400 208.9163 0006703  30.1579 330.0004 15.49560532999999'
```

### Bulk Import

Import large TLE datasets (up to 500 MB):

```bash
curl -X POST https://<instance>.arc.<region>.basekick.net/api/v1/import/tle \
  -H "Authorization: Bearer <token>" \
  -H "X-Arc-Database: satellites" \
  --data-binary @celestrak-catalog.tle
```

Supports gzip compression:

```bash
curl -X POST https://<instance>.arc.<region>.basekick.net/api/v1/import/tle \
  -H "Authorization: Bearer <token>" \
  -H "X-Arc-Database: satellites" \
  -H "Content-Encoding: gzip" \
  --data-binary @catalog.tle.gz
```

## Schema

Arc automatically creates a `tle` measurement with:

**Tags:**
| Tag | Description |
|-----|-------------|
| `norad_id` | NORAD catalog number |
| `object_name` | Satellite name |
| `classification` | U (unclassified), C (classified), S (secret) |
| `international_designator` | Launch identifier |
| `orbit_type` | LEO, MEO, GEO, HEO, etc. |

**Fields (Orbital Elements):**
| Field | Description |
|-------|-------------|
| `inclination` | Orbital inclination (degrees) |
| `raan` | Right ascension of ascending node |
| `eccentricity` | Orbital eccentricity |
| `arg_perigee` | Argument of perigee |
| `mean_anomaly` | Mean anomaly |
| `mean_motion` | Revolutions per day |
| `bstar` | Drag coefficient |

**Derived Metrics (computed automatically):**
| Field | Description |
|-------|-------------|
| `semi_major_axis_km` | Semi-major axis in km |
| `orbital_period_min` | Orbital period in minutes |
| `apogee_km` | Apogee altitude in km |
| `perigee_km` | Perigee altitude in km |

## Querying

```sql
-- Find all LEO satellites
SELECT object_name, perigee_km, apogee_km, inclination
FROM satellites.tle
WHERE orbit_type = 'LEO'
ORDER BY time DESC
LIMIT 100;

-- Track ISS orbital changes over time
SELECT time, inclination, mean_motion, apogee_km, perigee_km
FROM satellites.tle
WHERE norad_id = '25544'
ORDER BY time DESC;
```

See the [Arc TLE documentation](/arc/integrations/tle) for the full specification and advanced options.
