# JalDrishti

JalDrishti screens proposed data-centre sites in India for water demand, groundwater, rainfall, environmental constraints, regulations, and nearby infrastructure. Results are an early screening aid, not an approval.

## Run locally

Requirements: Node.js 20.9+ and npm.

```powershell
npm install
New-Item -ItemType Directory -Force db
Copy-Item .env.example .env
npm run db:push
npm run dev
```

Open <http://localhost:3000>. The default database setting is `DATABASE_URL=file:../db/custom.db`.
To enable AI explanations, add your key as `GROQ_API_KEY=...` in `.env` (never commit this file).

## Windows installer

The installer bundles the Node.js runtime, so end users do not need Node installed. On the build machine, install Node.js, npm dependencies, and [Inno Setup 6](https://jrsoftware.org/isinfo.php), then run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-windows-installer.ps1
```

The installer is written to `.release/windows/dist/JalDrishti-Setup.exe`. The installed app starts a local web server and opens it in the browser. It stores its database under the current Windows user's Local AppData folder.

## Checks

```powershell
npm run typecheck
npm run lint
npm run build
```

## Data and limitations

The app uses bundled rainfall, groundwater, power-plant, and land-cover datasets as local context and fallback. It also requests weather, air-quality, river-flow, and reverse-location data from external services when available. Some values are regional or modelled estimates; check source notes and confirm important findings with authoritative local agencies.

See [`docs/DATA_INTEGRATION.md`](docs/DATA_INTEGRATION.md) for provider details and [`prisma/schema.prisma`](prisma/schema.prisma) for the database schema.
