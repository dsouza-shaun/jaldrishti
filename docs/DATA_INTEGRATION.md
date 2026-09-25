# JalDrishti data integration

This document describes the bundled-dataset and live-provider integration. The deterministic analysis never treats a modelled or approximate value as an official observation: every result carries provenance and an evidence status.

## Request flow

```text
project latitude/longitude
  ├─ Nominatim reverse geocoding (direct, user-triggered analysis)
  │    └─ village/locality, district candidates, state, pincode
  ├─ groundwater and rainfall CSV indexes
  │    └─ exact normalized state + district match
  ├─ bundled GPPD power-plant index
  │    └─ nearest plants by haversine distance
  ├─ WorldCover GeoTIFF footprint index
  │    └─ sample only when the point is inside a raster
  └─ Open-Meteo weather / air quality / flood providers
       └─ modelled current conditions and forecasts
```

The original mock groundwater blocks and rainfall stations remain fallback-only. They are not returned when a matching bundled district record exists and are never presented as verified current data.

## Bundled datasets

| Dataset | Implementation | Correct interpretation |
| --- | --- | --- |
| `datasets/ground_water_2017.csv` | `src/lib/data/groundwater-data.ts` | District-level groundwater-resource proxy. It does not identify a CGWB block or assessment unit. The screening category is derived from extraction-stage bands because the CSV has no category field; `NA` remains unknown rather than becoming zero. |
| `datasets/district_wise_rainfall.csv` | `src/lib/data/rainfall-data.ts` | District monthly/seasonal rainfall aggregate. The file does not state its normal period. |
| `datasets/rainfall_in_india_1901-2015.csv` | `src/lib/data/rainfall-data.ts` | IMD meteorological-subdivision history, exposed only by exact subdivision name. No unsafe district-to-subdivision crosswalk is inferred. |
| `datasets/india_power_plant_dataset.csv` | `src/lib/data/power-plants-data.ts` | GPPD-derived plant inventory. Proximity does not prove grid availability or connection feasibility. |
| `datasets/India_Land_Cover/*/worldcover.tif` | `src/lib/data/land-cover-data.ts`, `src/lib/data/geo-tiff.ts` | EPSG:4326 class-code raster. A code is sampled only inside the footprint. The bundled files have no legend or acquisition date, so JalDrishti does not invent a class label. |

The land-cover, Landsat, and Sentinel files share directory names but are not assumed to have identical band semantics. The analysis currently reads only `worldcover.tif`; `landsat.tif` and `sentinel.tif` remain available in `datasets/` without being misrepresented as classified land-cover data.

## Live providers

| Provider | Data | Cache freshness | Important caveat |
| --- | --- | ---: | --- |
| Nominatim / OpenStreetMap | Reverse-geocoded district, state, locality, pincode | 24 hours | Public service; user-triggered, rate-limited, attributed, and configurable. |
| Open-Meteo Forecast | Weather, precipitation, ET0, evapotranspiration, soil moisture, solar radiation, wind, 7-day forecast | 30 minutes | Model output, not an IMD station observation. |
| Open-Meteo Air Quality | PM2.5, PM10, gases, dust, UV, model AQI | 1 hour | CAMS model output; US AQI is not presented as an Indian regulatory reading. |
| Open-Meteo Flood / GloFAS | Daily river discharge | 1 hour | Approximately 5 km grid-cell proxy; not a gauge reading or flood-depth result. |

All upstream results also have a stale-on-error window. If a refresh fails, JalDrishti can return the last value with `cacheStatus: "STALE"` instead of silently replacing it with mock data.

## Project ownership and local secrets

Project and analysis routes use an anonymous, HttpOnly `jaldrishti_owner` cookie and an `ownerId` column so one browser cannot read another browser's projects by guessing an ID. This is tenant isolation for the prototype, not a replacement for real user authentication. `.env`, `.env.local`, and the SQLite database are ignored and must never be committed; `.env.example` is the safe template.


- CSV files are parsed once per server process and converted to typed `Map` indexes.
- The 120 WorldCover source files are hashed and indexed once; byte-identical season copies are deduplicated to 40 seasonless rasters. Only a 3×3 source-band window is decoded for a covered point.
- A bounded process-local cache deduplicates concurrent API calls, expires entries, and retains stale values during upstream failures.
- Each external `fetch` also uses Next.js revalidation, which can use the Next data cache on a persistent server.
- `next.config.ts` traces the four CSVs and the 120 `worldcover.tif` files into standalone output. The `postbuild` hook removes local `.env*` files that Next.js otherwise copies, and copies `public/` plus `.next/static/` so the standalone server remains self-contained. Set `JALDRISHTI_DATASETS_DIR` when datasets are mounted externally instead.

A multi-instance/serverless deployment needs a shared cache and global request-rate limiter to enforce a provider-wide budget. A process-local limiter alone cannot coordinate separate instances.

## API endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/datasets` | Validate and summarize all bundled dataset indexes. |
| `GET /api/geocode?lat=&lng=` | Reverse-geocode at a locality-level zoom (configurable with `NOMINATIM_ZOOM`, default 14) and perform state-constrained district CSV lookups. `lon` is also accepted. |
| `GET /api/climate?lat=&lng=` | Current modelled weather, ET0, soil moisture, radiation, and forecast. |
| `GET /api/environment?lat=&lng=` | Aggregate climate, CAMS air quality, and GloFAS discharge with partial-failure reporting. |
| `GET /api/power-plants?lat=&lng=&topN=5` | Nearest coordinate-bearing plants from the bundled GPPD derivative. |
| `GET /api/land-cover?lat=&lng=` | Point-in-footprint WorldCover lookup and raw class-code sample. |
| `GET /api/rainfall-history?subdivision=&startYear=&endYear=` | Exact IMD-subdivision historical series; never fuzzy-matched to a district. |

## Nominatim public-service requirements

The public Nominatim service is suitable only for this direct, user-triggered reverse-geocoding use. Its policy requires an identifying User-Agent, no more than one request per second, result caching, clear OpenStreetMap attribution, and a configurable provider so the application can switch services.

Set `NOMINATIM_USER_AGENT` to an application identifier plus a maintainer email or URL in production. Keep `NOMINATIM_BASE_URL` configurable. The public route accepts only the supported India region, is rate-limited per process and per client, and uses a bounded queue. For sustained or multi-instance traffic, use a shared cache/rate limiter or deploy a self-hosted Nominatim instance. Do not use the public endpoint for autocomplete, bulk grid reverse-geocoding, or systematic queries.

Policy: <https://operations.osmfoundation.org/policies/nominatim/>

## Configuration

Copy `.env.example` values into the local, uncommitted `.env` as needed. No API key is required for eligible non-commercial Open-Meteo use. Commercial use requires the appropriate Open-Meteo customer plan/key.
