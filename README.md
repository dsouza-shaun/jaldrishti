# JalDrishti

> **Water intelligence and risk-assessment decision-support system for sustainable data centres in India.**
>
> JalDrishti is a pre-development site-intelligence and feasibility screening tool. Given a proposed data-centre project and a site, it answers:
>
> *“Before investing heavily in this site, what water, ecological, regulatory, infrastructure and power-related constraints are already visible?”*

It is **not** a black-box score. It is **not** an AI that predicts whether a site is good. It is a deterministic rule engine that combines project inputs, water-demand calculations, groundwater information, surface-water information, rainfall/climate data, water-quality data, ecological GIS layers, regulatory rules, environmental-clearance applicability, CGWA groundwater/NOC logic, and evidence/provenance for every result and produces a transparent, explainable **four-way classification**.

See **[Data integration architecture](docs/DATA_INTEGRATION.md)** for the bundled CSV/GeoTIFF pipeline, live providers, cache behavior, API contracts, and source limitations.

---

## Screenshots

![Home page](docs/images/home_page_laptop_resolution.png)

---

## Table of Contents

1. [What JalDrishti does](#what-jaldrishti-does)
2. [Key principles](#key-principles)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Getting started (quick start)](#getting-started-quick-start)
7. [Available scripts](#available-scripts)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)
10. [The screening pipeline](#the-screening-pipeline)
11. [Datasets used](#datasets-used)
12. [Regulatory rules](#regulatory-rules)
13. [API reference](#api-reference)
14. [The four-way classification](#the-four-way-classification)
15. [How the AI layer fits in](#how-the-ai-layer-fits-in)
16. [Limitations \& honest gaps](#limitations--honest-gaps)
17. [Roadmap (full system)](#roadmap-full-system)
18. [Disclaimer](#disclaimer)

---

## What JalDrishti does

For a proposed data-centre site, JalDrishti:

1. **Ingests project inputs** — site coordinates, IT load, PUE, WUE, cooling technology, built-up area, land tenure, proposed water source, alternative water source.
2. **Runs spatial checks** — tests the site point against ESZ, forest, wetland and CRZ polygon layers for overlaps and proximity (Turf.js mirrors PostGIS `ST_Intersects` / `ST_Within` / `ST_Distance`).
3. **Computes water demand** — deterministic engine turns IT load × PUE × 24 × WUE into daily and annual water requirements.
4. **Looks up groundwater** — joins a reverse-geocoded state/district to the bundled district resource CSV; if no exact record exists, it uses a clearly labelled nearest-centroid mock fallback. District data is not presented as a verified CGWB block.
5. **Looks up rainfall** — joins to the bundled district rainfall aggregate, optionally exposes exact IMD-subdivision history, and adds a modelled Open-Meteo forecast. The original station seeds remain fallback-only.
6. **Applies regulatory rules** — CGWA NOC eligibility, Environmental Clearance applicability (EIA 2006 Schedule 8b), ecological constraints (ESZ / Forest / Wetland / CRZ), SPCB consent requirements.
7. **Produces a four-way classification** — Feasible / Feasible with Conditions / Data Insufficient / High Constraint.
8. **Attaches provenance** — every data point carries its source, source date, and evidence status (VERIFIED / PROXY / UNKNOWN) all the way to the final decision.
9. **Optionally generates a plain-language explanation** — an LLM summarises the structured result; it never decides feasibility and never invents values.

---

## Key principles

These are non-negotiable design rules:

1. **No black-box score.** The output is a four-way classification, not a number out of 100.
2. **AI does not decide feasibility.** The LLM only explains the structured JSON produced by the rule engine.
3. **No fabricated data.** Missing values are flagged `UNKNOWN` — never silently filled in; representative or proxy values are labeled as such.
4. **Static and modelled sources are labelled accurately.** Bundled CSVs/GeoTIFFs are cached datasets, not live feeds; Open-Meteo outputs are model snapshots. Provenance and evidence status travel with each result.
5. **No invented regulatory thresholds.** Every threshold (e.g. 150,000 m² for EC 8b) comes from the cited regulation.
6. **No invented GIS buffer distances.** If a regulation specifies a buffer, it is encoded in the rule; otherwise the system reports "regulatory buffer not configured."
7. **Provenance stays attached.** Source and evidence status travel with every value into the rule engine and into the final classification.
8. **Calculations are deterministic.** Given the same inputs, the engine always produces the same output.
9. **Regulatory rules are separate from app code.** They live in `src/lib/rules/regulatory-rules.ts` and can be audited without reading the application.
10. **Every classification is explainable.** You can trace: classification → rule → constraint → underlying data → source → date → GIS geometry.

---

## Tech stack

|       Layer        |                               Technology                                |                                     Notes                                      |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Framework          | **Next.js 16** (App Router) + **TypeScript 5**                          | Non-negotiable                                                                 |
| Runtime            | **Node.js ≥ 20.9** (22/24 LTS recommended); Bun is optional             | npm is the most portable default; Bun can be used instead                      |
| Styling            | **Tailwind CSS 4** + custom neo-brutalist design system                 | Solid borders, hard shadows, no rounded corners                                |
| UI components      | **shadcn/ui** (New York style) + **Lucide** icons                       | Pre-installed component set                                                    |
| Animations         | **Framer Motion**                                                       | Page transitions, scroll reveals, counters, hover effects                      |
| State              | **Zustand** (client) + **TanStack Query** (server, available)           | View router is Zustand-based                                                   |
| Database           | **Prisma ORM** + **SQLite**                                             | No Docker required — SQLite is a single file                                   |
| Spatial operations | **Turf.js**                                                             | Mirrors PostGIS `ST_Intersects` / `ST_Within` / `ST_Distance` in the app layer |
| Maps               | **MapLibre GL** + OpenStreetMap raster tiles                            | No API key required                                                            |
| Charts             | **Recharts**                                                            | Rainfall time series, scenario comparison bars                                 |
| AI explanation     | **z-ai-web-dev-sdk**                                                    | LLM receives structured JSON, returns plain-language summary                   |
| Fonts              | **Inter** (body) + **Plus Jakarta Sans** (display) + **JetBrains Mono** | Loaded via `next/font/google`                                                  |

---

## Project structure

```
.
├── prisma/
│   └── schema.prisma              # Project, Analysis, Scenario, GroundwaterBlock,
│                                  # RainfallStation, EcologicalZone, RegulatoryRule
├── db/
│   └── custom.db                  # Local SQLite database (created/updated by db:push)
├── public/
│   ├── maplibre-gl-worker.mjs     # MapLibre worker (served from /public)
│   ├── maplibre-gl-shared.mjs     # Worker runtime dependency
│   ├── logo.svg
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout, fonts, Toaster
│   │   ├── page.tsx               # View router (Home / Analyze / Dashboard / Scenarios / About)
│   │   ├── globals.css            # Neo-brutalist design system + animations
│   │   └── api/
│   │       ├── projects/                     # Project, analysis, and scenario persistence
│   │       ├── gis/                          # Curated ecological GeoJSON endpoints
│   │       ├── geocode/route.ts              # Nominatim + district CSV lookup
│   │       ├── climate/route.ts              # Open-Meteo forecast, ET0, soil, radiation
│   │       ├── environment/route.ts          # Weather + CAMS air quality + GloFAS
│   │       ├── power-plants/route.ts         # Nearest bundled GPPD-derived plants
│   │       ├── land-cover/route.ts           # WorldCover footprint/class-code lookup
│   │       ├── rainfall-history/route.ts     # Exact IMD-subdivision history
│   │       ├── datasets/route.ts             # Bundled dataset health/summary
│   │       └── explain/route.ts              # Optional AI explanation
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components (button, card, toast, etc.)
│   │   └── jaldrishti/
│   │       ├── Header.tsx         # Sticky nav with locked-state indicators
│   │       ├── Footer.tsx         # Clean, user-friendly footer
│   │       ├── SiteMap.tsx        # MapLibre map with toggleable ecological layers
│   │       ├── ClassificationCard.tsx
│   │       ├── WaterDemandPanel.tsx
│   │       ├── GroundwaterPanel.tsx
│   │       ├── RainfallPanel.tsx
│   │       ├── RegulatoryPanel.tsx
│   │       ├── EcologyPanel.tsx
│   │       ├── PowerPanel.tsx
│   │       ├── EvidencePanel.tsx
│   │       ├── AIExplanationPanel.tsx
│   │       ├── WhatIfPanel.tsx
│   │       └── views/
│   │           ├── HomeView.tsx       # Landing page (hero, features, outcomes, CTA)
│   │           ├── AnalyzeView.tsx    # Project input form
│   │           ├── DashboardView.tsx  # Classification + map + evidence panels
│   │           ├── ScenariosView.tsx  # What-if builder + comparison chart
│   │           └── AboutView.tsx      # Methodology, datasets, rules
│   ├── lib/
│   │   ├── db.ts                          # Prisma client singleton
│   │   ├── utils.ts                       # cn() helper
│   │   ├── engines/
│   │   │   ├── water-demand.ts            # IT × PUE × 24 × WUE → daily/annual water
│   │   │   ├── classification.ts          # Four-way classification logic
│   │   │   └── orchestrator.ts            # Master pipeline: inputs → structured JSON
│   │   ├── rules/
│   │   │   └── regulatory-rules.ts        # CGWA, EC, ESZ, Forest, Wetland, CRZ, SPCB rules
│   │   ├── gis/
│   │   │   └── spatial.ts                 # Turf.js wrapper (ST_Intersects, ST_Within, ST_Distance)
│   │   ├── data/
│   │   │   ├── groundwater.ts             # Mock block fallback only
│   │   │   ├── rainfall.ts               # Mock station fallback only
│   │   │   ├── groundwater-data.ts       # All-India groundwater district CSV index
│   │   │   ├── rainfall-data.ts          # District rainfall + IMD-subdivision history
│   │   │   ├── power-plants-data.ts      # GPPD-derived plant index and haversine lookup
│   │   │   ├── land-cover-data.ts        # GeoTIFF footprint and class-code lookup
│   │   │   ├── geo-tiff.ts               # GeoTIFF tag/bounds reader
│   │   │   └── ecological-zones.ts       # 14 curated ESZ/Forest/Wetland/CRZ polygons
│   │   └── stores/
│   │       └── jaldrishti-store.ts        # Zustand store (form, analysis, scenarios, view router)
│   └── hooks/
│       ├── use-toast.ts          # Toast hook (shadcn)
│       └── use-mobile.ts         # Mobile detection hook
├── .env                           # Local-only runtime configuration
├── .env.example                   # Safe configuration template
├── datasets/                      # Bundled CSV and GeoTIFF sources
├── docs/DATA_INTEGRATION.md       # Data semantics, cache, API, and policy notes
├── package.json
├── scripts/
│   └── clean-standalone.mjs       # Removes copied local .env files after build
├── next.config.ts                 # output: "standalone"
├── tailwind.config.ts
├── tsconfig.json
└── Caddyfile                      # Optional gateway config (sandbox preview)
```

---

## Prerequisites

The setup is cross-platform and does not depend on a particular home directory or operating-system path. Choose **one** package manager: npm is the default and most portable option; Bun is optional.

|    Tool     |               Requirement                |                         Why                         |
| ----------- | ---------------------------------------- | --------------------------------------------------- |
| **Node.js** | **20.9+**; Node 22 or 24 LTS recommended | Required by Next.js 16                              |
| **npm**     | 10+ (normally bundled with Node.js)      | Default package manager and cross-platform commands |
| **Bun**     | Optional, 1.3+                           | Faster alternative to npm                           |
| **Git**     | Optional                                 | Only needed when cloning the repository             |

No Docker, PostgreSQL, or external database service is required. The core screening application uses a local SQLite file and MapLibre uses OpenStreetMap tiles. Provider credentials are needed only for the optional AI explanation endpoint.

Check your runtime before continuing:

```text
node --version
npm --version
```

---

## Getting started (quick start)

### Option A — npm (recommended)

Run all commands from the repository root—the directory containing `package.json`, `prisma/`, and `src/`.

```bash
# Clone the repository (skip this line if you already have the project)
# Replace <repository-url> with the actual remote URL.
git clone <repository-url> jaldrishti
cd jaldrishti

# Install dependecies
npm install
```

Initialize the database and start the app:

```bash
# Creates/updates the SQLite schema and regenerates Prisma Client
npm run db:push

# Starts Next.js
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

As an API smoke test, open [http://localhost:3000/api/datasets](http://localhost:3000/api/datasets). A healthy server returns HTTP `200` and reports the bundled dataset counts: 689 groundwater rows, 641 district-rainfall rows, 4,116 historical-rainfall rows, 861 coordinate-bearing power plants, and 40 unique WorldCover rasters after the bundled season copies are deduplicated across 40 locations. `GET /api/projects` is owner-scoped and returns `401` until a project has been created to establish the anonymous `jaldrishti_owner` cookie. The `db:push` output should also identify the database as `file:../db/custom.db`; a different but writable SQLite path can otherwise return an empty array from the wrong database.

### Option B — Bun

Run the clone and `cd` steps first, then create the same `.env` file before running Prisma:

```bash
# Clone the repository (skip this line if you already have the project)
git clone <repository-url> jaldrishti
cd jaldrishti
```

```env
DATABASE_URL=file:../db/custom.db
```

Then install and run:

```bash
bun install
bun run db:push
bun run dev
```

If `db/` is missing, use the matching directory command from Option A first. Do not switch between npm and Bun during the same installation unless you intend to regenerate a lockfile.

### Accessing the app from another computer or phone

Connect both devices to the same trusted network, then bind the development server to the local network:

```bash
npm run dev -- --hostname 0.0.0.0
```

Use the `Network` URL printed by Next.js, such as `http://192.168.1.50:3000`. Do not expose a development server directly to the public internet.

---

## Available scripts

|          npm          |          Bun          |                                 What it does                                 |
| --------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`         | `bun run dev`         | Start the development server on port 3000                                    |
| `npm run build`       | `bun run build`       | Create a production build and remove environment files from standalone output |
| `npm run start`       | `bun run start`       | Start the regular Next.js production server                                  |
| `npm run start:standalone` | `bun run start:standalone` | Start the generated standalone server (`.next/standalone/server.js`) |
| `npm run lint`        | `bun run lint`        | Run ESLint                                                                   |
| `npm run typecheck`  | `bun run typecheck`  | Run the project-local TypeScript compiler without emitting files              |
| `npm run db:push`     | `bun run db:push`     | **Initial local setup:** create/update the SQLite schema and generate Prisma Client |
| `npm run db:generate` | `bun run db:generate` | Regenerate Prisma Client, especially after schema or dependency changes      |
| `npm run db:migrate`  | `bun run db:migrate`  | Alternate interactive migration workflow; no migrations are checked in yet |
| `npm run db:reset`    | `bun run db:reset`    | Destructive migration reset; current repository has no checked-in migrations |

> `db:push` uses `--accept-data-loss` to make local schema synchronization predictable. It normally retains compatible rows, but schema changes can drop or recreate data. Back up `db/custom.db` before running it against a database whose data matters.

The current repository uses `db:push` for its initial schema. There is no checked-in `prisma/migrations/` history, so do not mix `db:migrate` and `db:push` casually. `db:reset` cannot reconstruct the current schema from migration history in this repository; if it is used, take a backup and follow it with `db:push` to recreate the schema.

The quick start is for local development. For a production build, run `npm run build`; the `postbuild` hook removes local `.env*` files that Next.js copies into standalone output and copies the required `public/` and `.next/static/` assets into the standalone bundle. Use `npm run start` for the regular production server or `npm run start:standalone` for the generated standalone server.

---

## Configuration

### Environment variables (`.env`)

Create `.env` in the repository root with at least the local database value:

```env
DATABASE_URL=file:../db/custom.db
```

The live-data integration runs without credentials on eligible non-commercial Open-Meteo and public Nominatim services, but production deployments should copy `.env.example` and configure:

- `NOMINATIM_USER_AGENT` with an application identifier and maintainer contact, as required by the public Nominatim policy.
- `NOMINATIM_BASE_URL` so the geocoder can be switched to a self-hosted or alternative compliant instance.
- `OPEN_METEO_API_KEY` when required by the deployment's Open-Meteo plan; never expose it as a `NEXT_PUBLIC_` variable.
- `JALDRISHTI_DATASETS_DIR` only when the bundled datasets are mounted outside the repository/standalone output.

The Nominatim public endpoint must remain direct, user-triggered, cached, attributed, and rate-limited. See [`docs/DATA_INTEGRATION.md`](docs/DATA_INTEGRATION.md) before changing these settings.

Prisma resolves SQLite paths relative to `prisma/schema.prisma`:

```text
<repository>/prisma/schema.prisma
                          + ../db/custom.db
<repository>/db/custom.db
```

This relative URL is portable across Windows, macOS, and Linux. It does not require a home-directory-specific absolute path.

Do **not** use:

```env
# Wrong: resolves to <repository>/prisma/db/custom.db
DATABASE_URL=file:db/custom.db

# Device-specific examples that should not be copied between machines
DATABASE_URL=file:/home/username/jaldrishti/db/custom.db
DATABASE_URL=file:C:/Users/username/Projects/jaldrishti/db/custom.db
```

Because `.env` is intentionally ignored by Git (and the local SQLite file is ignored as well), every new clone or device needs its own local configuration. `.env.example` is safe to commit. The value is identical everywhere.

### SQLite database and backups

- The database is `<repository>/db/custom.db`.
- `npm run db:push` normally retains compatible rows while synchronizing the Prisma schema, but schema changes can drop or recreate data; back up the database first.
- In the current MVP, the reference groundwater, rainfall, power, and land-cover datasets are bundled under `datasets/` and loaded by the typed data adapters in `src/lib/data/`; `db:push` creates the schema but is not a dataset seed command.
- Stop the dev server before copying or backing up the database.
- To move existing projects to another device, copy `db/custom.db` while the server is stopped; copying `.env` alone does not copy the data.
- Never delete `db/custom.db` unless a fresh empty database is intended.
- If an older setup created `prisma/db/custom.db`, correct `.env` to `file:../db/custom.db`; that other file will no longer be used. Back it up before removing anything.

### MapLibre worker

The files at `public/maplibre-gl-worker.mjs` and `public/maplibre-gl-shared.mjs` are copies of the installed MapLibre worker and its runtime dependency. If `maplibre-gl` is upgraded, refresh both files with the command for your shell:

```powershell
# Windows PowerShell
Copy-Item node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/maplibre-gl-worker.mjs
Copy-Item node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs public/maplibre-gl-shared.mjs
```

```text
# Windows Command Prompt
copy /Y node_modules\maplibre-gl\dist\maplibre-gl-worker.mjs public\maplibre-gl-worker.mjs
copy /Y node_modules\maplibre-gl\dist\maplibre-gl-shared.mjs public\maplibre-gl-shared.mjs
```

```bash
# macOS or Linux
cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/maplibre-gl-worker.mjs
cp node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs public/maplibre-gl-shared.mjs
```

### AI explanation layer

The deterministic screening pipeline does not require an LLM. `/api/explain` additionally uses `z-ai-web-dev-sdk`; that provider must be configured with valid local credentials outside an environment that pre-configures the SDK.

For local AI explanations, create `.z-ai-config` in the repository root (or use one of the other locations supported by the SDK):

```json
{
  "baseUrl": "https://your-provider.example/v1",
  "apiKey": "your-api-key"
}
```

`baseUrl` should include the provider's `/v1` path. `chatId` and `userId` are optional. The file is ignored by Git; never commit real API keys. If the AI endpoint fails, the project, analysis, and classification APIs remain usable.

---

## Troubleshooting

Run these commands from the repository root unless a section says otherwise.

### `@prisma/client did not initialize yet`

Typical message:

```text
@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.
```

Stop the dev server with `Ctrl+C`, then run the smallest repair first:

```bash
npm install
npm run db:generate
npm run dev
```

With Bun, use:

```bash
bun install
bun run db:generate
bun run dev
```

This usually happens when dependencies were installed with lifecycle scripts disabled, `node_modules` was copied from another operating system, or `prisma/schema.prisma` changed. If `node_modules` may have been copied from another device, do a full reinstall rather than deleting only `.prisma`:

```powershell
# Windows PowerShell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm ci
npm run db:generate
npm run db:push
npm run dev
```

```text
# Windows Command Prompt
if exist node_modules rmdir /S /Q node_modules
if exist .next rmdir /S /Q .next
npm ci
npm run db:generate
npm run db:push
npm run dev
```

```bash
# macOS or Linux
rm -rf node_modules .next
npm ci
npm run db:generate
npm run db:push
npm run dev
```

For Bun, do the same full cleanup when `node_modules` was copied:

```powershell
# Windows PowerShell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
bun install
bun run db:generate
bun run db:push
bun run dev
```

```text
# Windows Command Prompt
if exist node_modules rmdir /S /Q node_modules
if exist .next rmdir /S /Q .next
bun install
bun run db:generate
bun run db:push
bun run dev
```

```bash
# macOS or Linux
rm -rf node_modules .next
bun install
bun run db:generate
bun run db:push
bun run dev
```

### SQLite `Error code 14: Unable to open the database file`

Typical API error:

```text
Error querying the database: Error code 14: Unable to open the database file
```

This usually means the SQLite URL points to a missing directory, uses a path copied from another device, or the target directory is not writable. Check that `.env` contains exactly:

```env
DATABASE_URL=file:../db/custom.db
```

A process-level environment variable can override `.env`. Check the effective value before retrying:

```powershell
# Windows PowerShell
$env:DATABASE_URL
```

```text
# Windows Command Prompt
echo %DATABASE_URL%
```

```bash
# macOS or Linux
printf '%s\n' "${DATABASE_URL:-<not set>}"
```

If it is set to a path from another device, clear it and let Prisma load `.env`:

```powershell
# Windows PowerShell
$env:DATABASE_URL = $null
```

```text
# Windows Command Prompt
set DATABASE_URL=
```

```bash
# macOS or Linux
unset DATABASE_URL
```

If `db/` is missing, create it with the idempotent command for your shell:

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force db | Out-Null
```

```text
# Windows Command Prompt
if not exist db mkdir db
```

```bash
# macOS or Linux
mkdir -p db
```

Back up `db/custom.db` before synchronizing a schema, then run:

```bash
npm run db:push
npm run dev
```

Important details:

- `file:../db/custom.db` is the portable project-root value.
- `file:db/custom.db` points under `prisma/` and causes the same problem when `prisma/db/` does not exist.
- Never copy a `C:\Users\...` or `/home/...` database URL to another device.
- Keep the project in a normal user-writable directory rather than a read-only system folder.
- Code 14 is generally an open/create/path-permission problem. Lock contention is covered separately under “Database is locked.”

### `P2021`, “table does not exist,” or schema errors

The database exists but does not match `prisma/schema.prisma`. Back up the database, then synchronize it:

```bash
npm run db:push
npm run dev
```

If a schema was recently edited, also regenerate the client explicitly:

```bash
npm run db:generate
```

### `Environment variable not found: DATABASE_URL`

Create `.env` in the directory containing `package.json`, using the exact portable value:

```env
DATABASE_URL=file:../db/custom.db
```

Stop and restart the dev server after changing `.env`. Running Prisma commands from a parent/home directory can also load the wrong or no environment file.

### Database is locked

Close duplicate `next dev` processes and any other tool currently writing to `db/custom.db`, then restart one server. Do not delete the database merely to clear a lock.

### Port 3000 is already in use

Start the same project on another port:

```bash
npm run dev -- --port 3001
```

Then open [http://localhost:3001](http://localhost:3001). With Bun:

```bash
bun run dev -- --port 3001
```

### Changes are not appearing

Stop the dev server and remove the generated `.next` cache:

```powershell
# Windows PowerShell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

```text
# Windows Command Prompt
if exist .next rmdir /S /Q .next
npm run dev
```

```bash
# macOS or Linux
rm -rf .next
npm run dev
```

If Prisma also reports a client-generation problem, run `npm run db:generate` before restarting.

### Next.js warns that a parent `package-lock.json` was ignored

Example:

```text
Next.js ignored package-lock.json ... because it would include your home directory.
```

This warning is usually non-blocking. First make sure the command is running in the JalDrishti repository root, not the user home directory. The application can be run without changing anything in the home directory.

To pin Turbopack to this project without touching a parent lockfile, add an absolute, cross-platform root to `next.config.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": [
      "./datasets/*.csv",
      "./datasets/India_Land_Cover/**/worldcover.tif",
    ],
  },
  serverExternalPackages: ["sharp"],
  reactStrictMode: false,
};

export default nextConfig;
```

Do not delete a parent lockfile unless you own it and know it is unused.

### Only the AI explanation fails

A `500` from `/api/explain` usually means the local `z-ai-web-dev-sdk` provider is not configured. Create `.z-ai-config` as shown in the [AI explanation layer](#ai-explanation-layer) section. This does not affect deterministic screening or database-backed endpoints. Configure the provider for that environment or omit the optional explanation request.

---

## The screening pipeline

```
USER INPUT
    ↓
LOCATION / COORDINATES  →  normalized site point
    ↓
DATA INPUTS  →  cached district CSV + mock fallback + georeferenced rasters + live provider snapshots
    ↓
SPATIAL PROCESSING  →  Turf.js checks against the bundled GIS fixtures
    ↓
WATER DEMAND ENGINE  →  IT × PUE × 24 × WUE → daily / annual water
    ↓
REGULATORY / SITE CONSTRAINT ENGINE
    ├─ CGWA groundwater NOC rule
    ├─ EC applicability rule (EIA 2006 8b)
    ├─ Ecological constraint rules (ESZ / Forest / Wetland / CRZ)
    └─ SPCB consent rule
    ↓
WHAT-IF SCENARIO ENGINE  →  deterministic recalculation
    ↓
EVIDENCE + PROVENANCE ENGINE  →  source / date / evidence status attached
    ↓
FEASIBILITY CLASSIFICATION  →  Feasible | Feasible with Conditions | Data Insufficient | High Constraint
    ↓
STRUCTURED JSON
    ↓
OPTIONAL AI EXPLANATION  →  plain-language summary (never decides)
    ↓
DASHBOARD / REPORT
```

**AI, if used, comes only AFTER the deterministic calculations.** It can explain the result in simple language. It must NOT independently decide whether the site is feasible.

---

## Datasets used

JalDrishti now loads the bundled files under `datasets/` into typed, process-cached indexes. The original mock groundwater blocks and rainfall stations remain fallback-only. A fallback or approximate value is never described as current official data.

### Groundwater district resources

**File:** `datasets/ground_water_2017.csv` (689 rows)
**Loader:** `src/lib/data/groundwater-data.ts`

The file is joined to the reverse-geocoded state and district. It provides recharge, extraction, availability, and extraction-stage fields, but **does not provide a CGWB assessment-unit/block boundary or a source category field**; the displayed screening category is derived from conventional extraction-stage bands. Results therefore remain `PROXY`; `NA` is preserved as unknown rather than converted to zero. The file has mixed temporal metadata (a 2017 dataset name and an allocation field labelled as on 2025), which is surfaced in provenance.

The existing block fixtures in `src/lib/data/groundwater.ts` are used only when no district CSV record is available.

### Rainfall

**District file:** `datasets/district_wise_rainfall.csv` (641 rows)
**Historical file:** `datasets/rainfall_in_india_1901-2015.csv` (4,116 rows)
**Loader:** `src/lib/data/rainfall-data.ts`

The district file supplies monthly and seasonal aggregates. Its normal period is not encoded, so it is not called a current verified normal. The historical file is keyed to IMD meteorological subdivisions, not districts; `/api/rainfall-history` therefore requires an exact subdivision and does not invent a crosswalk. The eight station fixtures in `src/lib/data/rainfall.ts` remain fallback-only.

### Power plants

**File:** `datasets/india_power_plant_dataset.csv` (907 rows; 861 coordinate-bearing)
**Loader:** `src/lib/data/power-plants-data.ts`

Coordinate-bearing GPPD-derived plants are ranked with haversine distance. The latest populated generation year is derived per plant rather than assuming 2019 is populated. Nearby plant inventory is contextual only: it does not prove transmission availability, deliverable capacity, or a viable grid connection.

### India land cover

**Files:** `datasets/India_Land_Cover/<location>_<season>/worldcover.tif` (40 locations × 3 seasons)
**Loaders:** `src/lib/data/land-cover-data.ts`, `src/lib/data/geo-tiff.ts`

The loader hashes the 120 `worldcover.tif` source files, deduplicates the byte-identical season copies to 40 rasters, reads GeoTIFF dimensions/EPSG:4326 affine bounds, and decodes only a small source-band point window. A class code is returned only if the coordinate is inside a raster footprint. No class legend or acquisition date is bundled, so JalDrishti does not translate the raw code into an invented land-cover label or infer a season. The `landsat.tif` and `sentinel.tif` assets are not assumed to share WorldCover band semantics.

### Ecological GIS fixtures

**File:** `src/lib/data/ecological-zones.ts`

The existing 14 Maharashtra-region ESZ/forest/wetland/CRZ polygons remain hand-drawn screening fixtures with source metadata and are explicitly `PROXY`. They have not been replaced by a live Bhuvan feed.

### Live providers

- **Nominatim / OpenStreetMap:** direct reverse geocoding for district/state/locality/pincode; cached, rate-limited, attributed, and configurable.
- **Open-Meteo Forecast:** modelled current weather, precipitation, ET0, evapotranspiration, soil moisture, solar radiation, wind, and seven-day forecast.
- **Open-Meteo Air Quality:** CAMS PM2.5/PM10, gases, dust, UV, and model AQI.
- **Open-Meteo Flood / GloFAS:** daily river-discharge proxy.

These are not regulatory station measurements. See [`docs/DATA_INTEGRATION.md`](docs/DATA_INTEGRATION.md) for cache windows, attribution, policy limits, and source caveats.

---

## Regulatory rules

Rules are encoded as auditable TypeScript modules in `src/lib/rules/regulatory-rules.ts`. Each rule references the actual Indian regulation it implements.

|     Rule code     | Domain  |                             Title                             |                            Source                             |
| ----------------- | ------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `CGWA-2020`       | cgwa    | CGWA Groundwater NOC Eligibility                              | CGWA NOC Guidelines for Groundwater Extraction (revised 2020) |
| `EC-8B-2006`      | ec      | Environmental Clearance — Item 8(b) Township/Area Development | EIA Notification 2006, Schedule Item 8(b)                     |
| `ESZ-EPA-1986`    | esz     | Eco-Sensitive Zone Restrictions                               | ESZ Notification under Environment (Protection) Act 1986      |
| `FOREST-CA-1980`  | forest  | Forest (Conservation) Act 1980                                | Forest (Conservation) Act 1980 (amended 2023)                 |
| `WETLAND-2017`    | wetland | Wetlands (Conservation and Management) Rules 2017             | Wetlands Rules 2017                                           |
| `CRZ-2018`        | crz     | Coastal Regulation Zone Notification 2018                     | CRZ Notification 2018                                         |
| `SPCB-WATER-1974` | spcb    | Water Act — CTE / CTO requirement                             | Water (Prevention and Control of Pollution) Act 1974          |

### Key thresholds

- **EC applicability:** Built-up area ≥ **150,000 m²** triggers Category B EC under EIA 2006 Schedule 8(b).
- **CGWA Over-Exploited + groundwater source + no alternative:** Hard constraint.
- **CGWA Critical + groundwater source:** Feasible with conditions (rainwater harvesting + artificial recharge required).
- **Ecological overlap (ESZ / Forest / Wetland / CRZ):** Hard constraint — project must re-site or pursue clearance.

Where a buffer distance is not specified in the source regulation, the system reports *"regulatory buffer not configured"* rather than inventing one.

---

## API reference

All endpoints are relative to the app root (e.g. `http://localhost:3000`).

### Projects

| Method |         Path         |                                                                                                Description                                                                                                |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/projects`      | Create a new project. Body: `{ projectName, latitude, longitude, itLoad, pue, wue, coolingType, builtUpArea?, landTenure, proposedWaterSource, alternativeWaterSource?, notes? }`. Returns `{ project }`. |
| `GET`  | `/api/projects`      | List the 100 most recent projects. Returns `{ projects }`.                                                                                                                                                |
| `GET`  | `/api/projects/[id]` | Get a single project. Returns `{ project }`.                                                                                                                                                              |

### Analysis

| Method |             Path             |                                                                  Description                                                                   |
| ------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/projects/[id]/analyze` | Run the full screening pipeline. Persists the result. Returns `{ analysisId, result }` where `result` is the full structured JSON (see below). |
| `GET`  | `/api/projects/[id]/analyze` | Get the most recent analysis for a project. Returns `{ analysisId, result, generatedAt, hasAnalysis }`.                                        |

### What-if scenarios

| Method |              Path              |                                                              Description                                                              |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/projects/[id]/scenarios` | Run a what-if scenario. Body: `{ label, itLoad?, pue?, wue?, coolingType?, proposedWaterSource? }`. Returns `{ scenarioId, result }`. |
| `GET`  | `/api/projects/[id]/scenarios` | List the 50 most recent scenarios for a project. Returns `{ scenarios }`.                                                             |

### GIS layers

| Method |        Path        |                                               Description                                                |         |          |                 |
| ------ | ------------------ | -------------------------------------------------------------------------------------------------------- | ------- | -------- | --------------- |
| `GET`  | `/api/gis`         | Get all ecological layers as a single GeoJSON FeatureCollection. Optional `?layer=esz\                   | forest\ | wetland\ | crz` to filter. |
| `GET`  | `/api/gis/[layer]` | Get a single layer as a GeoJSON FeatureCollection. `layer` must be `esz`, `forest`, `wetland`, or `crz`. |         |          |                 |

### Location, live environment, and bundled datasets

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/datasets` | Parse and summarize all bundled CSV/GeoTIFF indexes; useful as a deployment health check. |
| `GET` | `/api/geocode?lat=&lng=` | Reverse-geocode with Nominatim and perform state-constrained groundwater/rainfall district lookups. `lon` is accepted as an alias for `lng`. |
| `GET` | `/api/climate?lat=&lng=` | Return current modelled weather, ET0/evapotranspiration, soil moisture, radiation, wind, and seven-day forecast from Open-Meteo. |
| `GET` | `/api/environment?lat=&lng=` | Aggregate Open-Meteo weather, CAMS air quality, and GloFAS river discharge; provider failures are reported as partial results. |
| `GET` | `/api/power-plants?lat=&lng=&topN=5` | Return the nearest coordinate-bearing plants from the bundled GPPD derivative (`topN` 1–20). |
| `GET` | `/api/land-cover?lat=&lng=` | Return a WorldCover class-code sample only when the point is inside a bundled raster footprint. |
| `GET` | `/api/rainfall-history?subdivision=&startYear=&endYear=` | Return an exact IMD meteorological-subdivision historical series. No fuzzy district-to-subdivision match is attempted. |

Project, analysis, scenario, and explanation routes require the anonymous HttpOnly `jaldrishti_owner` browser cookie created when the first project is saved. This isolates projects in the prototype; it is not a substitute for production user authentication.

> Public Nominatim use is deliberately restricted to direct, user-triggered reverse geocoding. The implementation enforces a process-level 1.1-second request spacing, a bounded queue, India-region validation, per-client limits, caching, an identifying User-Agent, OpenStreetMap attribution, and a configurable base URL. Multi-instance deployments still need shared rate limiting/cache infrastructure or a self-hosted instance. Read the [Nominatim policy notes](docs/DATA_INTEGRATION.md#nominatim-public-service-requirements) before enabling public traffic.

### AI explanation

| Method |      Path      |                                                                                                                                                                    Description                                                                                                                                                                     |
| ------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/explain` | Generate a plain-language explanation of an analysis. Body: `{ analysis: <AnalysisResult JSON> }`. Returns `{ explanation }`; the prompt is not echoed to the client. The LLM receives the structured JSON and returns Markdown with a plain-language explanation, evidence summary, and suggested follow-up questions. **It never decides feasibility and never invents values.** |

### Analysis result JSON structure

```jsonc
{
  "projectId": "cmuf...",
  "projectName": "Taloja DC Park - Building 1",
  "site": {
    "latitude": 19.0418,
    "longitude": 73.0856,
    "pointWkt": "POINT(73.0856 19.0418)",
    "crs": "EPSG:4326 (WGS84)"
  },
  "siteData": {
    "location": {
      "data": {
        "displayName": "Panvel, Panvel Subdistrict, Raigad, Maharashtra, India",
        "district": "Raigad",
        "state": "Maharashtra",
        "pincode": "401206",
        "attribution": { "label": "© OpenStreetMap contributors" }
      },
      "provider": "Nominatim / OpenStreetMap",
      "retrievedAt": "2026-09-25T14:14:49.626Z",
      "cacheStatus": "HIT"
    },
    "climate": {
      "data": {
        "current": { "temperatureC": 27.9, "precipitationMm": 0 },
        "sevenDayWaterBalanceMm": { "precipitation": 16.9, "referenceEt0": 28.08 }
      },
      "provider": "Open-Meteo Weather Forecast API",
      "cacheStatus": "MISS"
    },
    "nearbyPowerPlants": [/* GPPD-derived inventory; not grid capacity */],
    "landCover": { "available": false, "reason": "OUTSIDE_ALL_RASTER_FOOTPRINTS" },
    "failures": []
  },
  "waterDemand": {
    "facilityEnergyMwhPerDay": 3360,
    "waterKlPerDay": 5040,
    "waterMcmPerYear": 1.84,
    "wueUsed": 1.5,
    "provenance": { "source": "...", "sourceDate": "...", "evidenceStatus": "VERIFIED" }
  },
  "groundwater": {
    "datasetType": "DISTRICT_CSV",
    "matchQuality": "EXACT_STATE_AND_DISTRICT",
    "block": null,
    "district": "Raigad",
    "state": "Maharashtra",
    "category": "Safe",
    "stage": 17,
    "assessmentUnitVerified": false,
    "resources": { "totalAnnualRecharge": 39435.22, "totalCurrentExtraction": 6362.23 },
    "provenance": { "source": "Bundled India groundwater district resource CSV", "evidenceStatus": "PROXY" }
  },
  "rainfall": {
    "datasetType": "DISTRICT_CSV",
    "station": "Raigad district aggregate",
    "annualRainfallMm": 3278.9,
    "monsoonRainfallMm": 3117.7,
    "period": "Not supplied by source file",
    "timeseries": [],
    "provenance": { "source": "Bundled IMD-style district rainfall CSV", "evidenceStatus": "PROXY" }
  },
  "ecology": { "esz": { "overlap": false, "evidenceStatus": "PROXY", "rule": { /* ... */ } } },
  "regulatory": { "cgwa": { "outcome": "VERIFICATION REQUIRED", "hardConstraint": false } },
  "power": {
    "timeline": "UNKNOWN",
    "nearbyPowerPlants": [/* ... */],
    "provenance": { "evidenceStatus": "PROXY" }
  },
  "constraints": [/* hard | soft | info */],
  "evidenceGaps": [/* critical missing fields */],
  "classification": { "classification": "Data Insufficient", "reasons": [/* ... */] },
  "generatedAt": "2026-09-25T14:15:00.000Z"
}
```

---

## The four-way classification

The classification is a deterministic function of hard constraints, evidence gaps, and soft conditions.

### Precedence

```
1. HIGH CONSTRAINT          ← any hard constraint present
2. DATA INSUFFICIENT        ← a critical evidence field is UNKNOWN
3. FEASIBLE WITH CONDITIONS ← soft constraint present (no hard, no gaps)
4. FEASIBLE                 ← no constraints, no gaps
```

### Categories

|                     Category                      |                                         When                                         |  Color   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| **Feasible**                                      | No hard constraints, no critical evidence gaps, no soft constraints                  | 🟢 Green  |
| **Feasible with Conditions**                      | Soft constraints present (e.g. proxy ecology geometry, CGWA verification required)   | 🟡 Yellow |
| **Data Insufficient**                             | A critical evidence field is missing or unverified (e.g. no groundwater assessment unit) | 🟠 Orange |
| **High Constraint / Further Assessment Required** | A verified hard constraint is present (e.g. authoritative wetland overlap) | 🔴 Red    |

### Hard constraints vs risk indicators

- **Hard constraints** block the project outright only when supported by verified/authoritative evidence — e.g. a verified ecological overlap or a verified groundwater constraint with no alternative.
- **Risk indicators (soft constraints)** require mitigation or verification but do not block — e.g. proxy ecology geometry, district groundwater records, Critical/Semi-Critical groundwater, EC applicability, and SPCB consent.

The exact rule precedence is implemented in `src/lib/engines/classification.ts` and is fully auditable.

---

## How the AI layer fits in

```
DATA
  ↓
RULE ENGINE
  ↓
STRUCTURED JSON
  ↓
AI EXPLANATION   ← the LLM only sees the structured JSON
  ↓
HUMAN-READABLE REPORT
```

The AI can:

- Explain the results in plain language
- Summarise the evidence (Verified / Proxy / Unknown)
- Suggest questions the developer should investigate next

The AI must NOT:

- Invent groundwater values
- Invent regulatory thresholds
- Invent buffer distances
- Decide feasibility independently
- Override the rule engine
- Claim that an approval is guaranteed
- Convert missing data into a positive/negative assumption

The AI receives the validated structured JSON — never raw database access.

---

## Limitations & honest gaps

JalDrishti is a **screening prototype**, not a regulatory approval. The following are known limitations:

|        Area         |                              Current state                               |                        Full-system goal                        |
| ------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Groundwater         | All-India district resource CSV (`PROXY`); mock blocks remain fallback | Authoritative CGWB assessment-unit/block polygons and telemetry |
| Rainfall            | District monthly aggregate + exact IMD-subdivision history + forecast | Authoritative IMD station/grid crosswalk and calibrated normals |
| Ecological layers   | 14 curated Maharashtra-region polygons; no live Bhuvan layer           | Full national MoEFCC / Bhuvan layers                           |
| Power               | Nearby GPPD-derived plant inventory; connection timeline remains unknown | State DISCOM / CEA capacity and connection APIs               |
| Surface water       | Open-Meteo/GloFAS 5 km discharge proxy; no India-WRIS gauge integration | India-WRIS / CWC gauge and basin integration                  |
| Air quality         | CAMS model snapshot; not a regulatory Indian station                   | CPCB/State-board validated station feed                        |
| Land cover          | 40 locations × 3 WorldCover rasters; raw code only, no bundled legend | Authoritative class legend, dates, and national coverage         |
| SPCB                | Generic CTE/CTO requirement (no state-specific rules)                  | Multi-state SPCB rule sets                                     |
| Climate projections | Not included; current forecast is not a projection                     | Seasonal variability and scenario-based climate projections    |
| Block lookup        | District resource match, not true `ST_Within`                           | True point-in-block/assessment-unit lookup                     |

Where data is unavailable, JalDrishti says **UNKNOWN** — it never silently fills in a value.

---

## Roadmap (full system)

The MVP is a working vertical slice. The full system would add:

- Live India-WRIS surface-water integration
- Live CGWB groundwater-level telemetry
- Full national ecological layers (all states)
- Power connection timeline modelling (DISCOM / CEA APIs)
- Climate projections (seasonal rainfall, flood-zone)
- Multi-state SPCB rules
- Direct PARIVESH project-status integration
- Competing local water demand modelling
- More detailed flood/hydrological modelling
- PostGIS / PostgreSQL backend (for production-grade spatial queries at scale)

---

## Disclaimer

JalDrishti is a **pre-development screening aid**, not a regulatory approval. All classifications should be reviewed by qualified environmental and legal consultants before any investment decision.

Missing data is flagged as **Unknown** — it is never silently filled in. The four-way classification is a screening signal, not a guarantee of regulatory outcome.

---

**Built for sustainable data-centre development in India.**
