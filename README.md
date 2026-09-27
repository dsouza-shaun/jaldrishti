# JalDrishti

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite)](https://sqlite.org)
[![Inno Setup](https://img.shields.io/badge/Installer-Inno%20Setup-44A72C?style=flat-square)](https://jrsoftware.org/isinfo.php)
[![Node](https://img.shields.io/badge/Node-20.9%2B-5FA04E?style=flat-square&logo=nodedotjs)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-Proprietary-8A8A8A?style=flat-square)](#license)
[![Windows](https://img.shields.io/badge/Desktop-Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](https://www.microsoft.com/windows)

Pre-development screening for proposed data-centre sites in India. JalDrishti checks
water demand, groundwater, rainfall, ecological constraints and regulatory
requirements, then produces an explainable preliminary result with its evidence.

**JalDrishti is decision support, not the authority.** A screening result is not an
approval, a consent, or a statement of legal compliance.

## What it does

- **Calculates** water demand from IT load, PUE, WUE and cooling technology.
- **Checks** site points against eco-sensitive zones, forest, wetland and coastal boundaries.
- **Screens** groundwater extraction, environmental clearance and consent requirements.
- **Explains** every outcome, with the constraint, the source and the date behind it.
- **Exports** the screening as PDF, Word or a printable page.
- **Separates** evidence into calculated, sourced, and needing verification.

## Screens

| | |
|---|---|
| Sign in | Two roles: Developer and Authority |
| Screening result | Result, water demand, and the conditions behind both |
| Report | Full document with PDF and Word export |
| Scenarios | Mitigation presets and baseline comparison |
| Review | Authority queue and recorded decisions |

## Quick start

Requires Node.js 20.9 or newer.

```powershell
git clone https://github.com/dsouza-shaun/jaldrishti.git
cd jaldrishti
.\scripts\setup.ps1
```

`setup.ps1` runs every step below. Run it once after cloning.

<details>
<summary>Manual steps</summary>

```powershell
npm install
New-Item -ItemType Directory -Force db | Out-Null
Copy-Item .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

</details>

Open <http://localhost:3000> and sign in.

| Role | Username | Password |
|---|---|---|
| Developer | `developer` | `dev@demo` |
| Developer | `developer2` | `dev2@demo` |
| Authority | `authority` | `auth@demo` |

The `db:seed` step creates these accounts and a starter project per developer. A
Developer only sees their own projects; an Authority sees every submitted project.

To enable AI explanations, set `GROQ_API_KEY` in `.env`. Never commit `.env`.

## Windows installer

The installer bundles the Node.js runtime, so end users need nothing installed. On the
build machine install Node.js, dependencies, and
[Inno Setup 6 or later](https://jrsoftware.org/isinfo.php), then run:

```powershell
.\scripts\build-windows-installer.ps1
```

Output: `.release/windows/dist/JalDrishti-Setup.exe`. The app starts a local server
and opens it in the browser. Its database lives under the Windows user's Local AppData.

## Checks

```powershell
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build
```

## Project layout

```
src/app/          Routes and API handlers
src/components/   UI, split into jaldrishti/ (product) and ui/ (primitives)
src/lib/          Analysis engines, data providers, auth, report generation
datasets/         Bundled CSV and raster data
prisma/           Schema, seed, client
scripts/          Setup, build and installer scripts
```

## Data and limits

Bundled rainfall, groundwater, power-plant and land-cover data provide local context
and fallback. Live weather, air quality, river flow and location services are used when
available. Many values are regional or modelled rather than site measurements. Each one
is labelled, and uncertain items are listed as needing verification.

JalDrishti does not model a split between freshwater and reclaimed demand, so no such
split is reported. The reduction chart compares total water demand.

See [`TECHNICAL_APPROACH.md`](TECHNICAL_APPROACH.md) for the design.

## License

Proprietary. Internal use only.
