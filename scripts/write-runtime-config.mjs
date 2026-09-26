import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Bakes the runtime configuration a desktop build needs into the staged app.
 *
 * Why this exists: `scripts/clean-standalone.mjs` deliberately deletes every
 * `.env*` file from the Next.js standalone output, which is correct for a web
 * deploy where configuration is injected by the platform. It is wrong for the
 * Windows desktop build, where the app is started by a launcher that a user
 * double-clicks on a machine that has no environment variables at all. Without
 * this step the installed app silently loses the Groq key (so the AI
 * explanation panel dies), the Nominatim contact string (which the Nominatim
 * usage policy requires, so geocoding gets blocked), and any Open-Meteo key.
 *
 * Security note, stated plainly because it cannot be engineered away: these
 * values are recoverable from the shipped installer by anyone who unzips it.
 * That is inherent to bundling a credential in a desktop binary. It is fine for
 * a scoped, rate-limited, public-service key; it is NOT fine for a key holding
 * billing or write access to anything. Keep the keys in a low-privilege,
 * read-only, quota-capped account, and prefer the optional-key path when a
 * feature degrades gracefully.
 *
 * Environment variables always win over baked values, so a developer or IT
 * administrator can still override anything at launch without a rebuild.
 */

/**
 * `required` keys abort the build when missing, because the resulting installer
 * would ship with a feature that is dead with no user-visible explanation.
 * Everything else is reported but does not block.
 *
 * Only GROQ_API_KEY is required, and deliberately so: with no key
 * `/api/explain` returns 503 and the AI explanation panel is permanently
 * unavailable. There is no fallback.
 *
 * NOMINATIM_USER_AGENT is NOT required, because the app falls back to the bare
 * string "JalDrishti/0.2.1", which Nominatim accepts (verified: HTTP 200). It
 * is reported and sanity-checked because the Nominatim usage policy asks for a
 * contact, and because a plausible-looking placeholder is an easy way to
 * ship a User-Agent that gets the whole client blocked.
 */
const CONFIG_KEYS = [
  { name: "GROQ_API_KEY", required: true, note: "Plain-language explanations (/api/explain)" },
  { name: "GROQ_MODEL", required: false, note: "Explanation model override" },
  { name: "NOMINATIM_USER_AGENT", required: false, note: "Identifies this app to Nominatim; app falls back to a bare UA if unset" },
  { name: "NOMINATIM_EMAIL", required: false, note: "Nominatim contact address" },
  { name: "NOMINATIM_BASE_URL", required: false, note: "Nominatim host override" },
  { name: "NOMINATIM_ZOOM", required: false, note: "Reverse-geocode zoom" },
  { name: "OPEN_METEO_API_KEY", required: false, note: "Open-Meteo customer key" },
  { name: "OPEN_METEO_FORECAST_BASE_URL", required: false, note: "Open-Meteo forecast host" },
  { name: "OPEN_METEO_AIR_QUALITY_BASE_URL", required: false, note: "Open-Meteo air-quality host" },
  { name: "OPEN_METEO_FLOOD_BASE_URL", required: false, note: "Open-Meteo flood host" },
  { name: "JALDRISHTI_NWIC_COOKIE", required: false, note: "National Water Mission session" },
  { name: "JALDRISHTI_NWIC_BASE_URL", required: false, note: "National Water Mission host override" },
  { name: "JALDRISHTI_NWIC_TIMEOUT_MS", required: false, note: "National Water Mission timeout" },
  { name: "JALDRISHTI_DATASETS_DIR", required: false, note: "External datasets directory" },
];

/**
 * Nominatim User-Agent checks, split into two categories because they have
 * different consequences and must not be reported as the same problem.
 *
 * Verified against the live service on 2026-09-26:
 *
 *   no User-Agent                                   -> 403 Access denied
 *   Mozilla/5.0                                     -> 403 Access denied
 *   JalDrishti/0.2.1                                -> 200 OK
 *   JalDrishti/0.2.1 (maintainer: ops@invalid.test) -> 200 OK
 *   JalDrishti/0.2.1 (maintainer: ops@example.org) -> 403 Access denied
 *
 * The last line is the trap: example.org, example.com and example.net are
 * reserved documentation domains and Nominatim blocks any User-Agent
 * containing one, so a placeholder that looks harmless in a config file turns
 * into a runtime outage with a misleading "Access denied" message.
 */
const USER_AGENT_CHECKS = [
  {
    pattern: /example\.(org|com|net)\b/i,
    blocks: true,
    reason: "example.org/com/net are reserved documentation domains and Nominatim returns 403 for any User-Agent containing one",
  },
  {
    pattern: /^(mozilla|curl|wget|python-requests|okhttp|axios|node|postman|java|go-http-client)/i,
    blocks: true,
    reason: "a generic client string is both rejected by Nominatim (403) and does not identify this application",
  },
  {
    pattern: /\b(your|replace|placeholder|changeme|change-me|todo|fixme|xxx+)\b|[-_](your|here)\b|(^|[^a-z])me@/i,
    blocks: false,
    reason: "still an unreplaced placeholder; it works but publishes a contact nobody can answer to",
  },
  {
    pattern: /@?(invalid|localhost|test)\b|\b127\.0\.0\.1\b/i,
    blocks: false,
    reason: "a reserved or loopback domain cannot be a real contact address",
  },
];


/**
 * Deliberately excluded: `DATABASE_URL`. The launcher points each install at
 * its own SQLite file under LOCALAPPDATA, and baking a build-machine path in
 * would either be wrong or would overwrite a user's data.
 */
const NEVER_BAKED = new Set(["DATABASE_URL", "NODE_ENV", "PORT", "HOSTNAME"]);

function parseArguments(argv) {
  const options = { output: null, allowMissingRequired: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output" || argument === "-o") {
      options.output = argv[index + 1] ?? null;
      index += 1;
    } else if (argument === "--allow-missing-required") {
      options.allowMissingRequired = true;
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options.output) {
    throw new Error(
      "Usage: node scripts/write-runtime-config.mjs --output <path> [--allow-missing-required]",
    );
  }

  const baked = {};
  const missingRequired = [];
  const missingOptional = [];
  const present = [];

  for (const key of CONFIG_KEYS) {
    if (NEVER_BAKED.has(key.name)) continue;
    const raw = process.env[key.name];
    // An empty or whitespace-only value is treated as unset: shipping
    // `GROQ_API_KEY=""` is worse than shipping nothing, because the app would
    // try to authenticate with an empty key and report a confusing 401.
    const value = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
    if (value === null) {
      if (key.required) missingRequired.push(key);
      else missingOptional.push(key);
      continue;
    }
    baked[key.name] = value;
    present.push(key);
  }

  const target = path.resolve(options.output);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `${JSON.stringify(
      {
        _comment:
          "Generated by scripts/write-runtime-config.mjs. Contains build-time credentials and is intentionally shipped with the desktop build. Regenerate rather than hand-edit.",
        bakedAt: new Date().toISOString(),
        keys: baked,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const nameOnly = (key) => key.name;
  for (const key of present) {
    console.log(`  baked    ${key.name.padEnd(30)} ${key.note}`);
  }
  for (const key of missingOptional) {
    console.log(`  absent   ${key.name.padEnd(30)} ${key.note} (optional)`);
  }

  // Sanity-check the Nominatim User-Agent before it is baked. This is a
  // warning rather than a hard stop, because the app's bare fallback works;
  // but shipping a value Nominatim will 403 on, or a placeholder that will be
  // quoted back at an operator, is worth shouting about.
  const userAgent = baked.NOMINATIM_USER_AGENT;
  if (userAgent) {
    const blocking = [];
    const cosmetic = [];
    for (const check of USER_AGENT_CHECKS) {
      if (!check.pattern.test(userAgent)) continue;
      (check.blocks ? blocking : cosmetic).push(check.reason);
    }
    if (blocking.length > 0) {
      console.warn(
        `\n  WARNING  NOMINATIM_USER_AGENT WILL FAIL. Reverse geocoding returns` +
          `\n           HTTP 403 "Access denied" for this value, with no other` +
          `\n           diagnostic.\n` +
          blocking.map((r) => `             - ${r}`).join("\n") +
          `\n           value: ${userAgent}\n`,
      );
    }
    if (cosmetic.length > 0) {
      console.warn(
        `\n  note     NOMINATIM_USER_AGENT will be sent as-is. It works, but:\n` +
          cosmetic.map((r) => `             - ${r}`).join("\n") +
          `\n           value: ${userAgent}\n` +
          `           Shipping this means the operator cannot be contacted if\n` +
          `           this client ever needs to be throttled or blocked.\n`,
      );
    }
    if (blocking.length === 0 && cosmetic.length === 0) {
      console.log(`  verified NOMINATIM_USER_AGENT has a real-looking contact and no blocked domain`);
    }
  } else {
    console.warn(
      "\n  note     NOMINATIM_USER_AGENT is unset. The app will fall back to the\n" +
        "           bare string \"JalDrishti/0.2.1\", which Nominatim accepts, but\n" +
        "           it carries no contact address for the operator.\n",
    );
  }

  if (missingRequired.length > 0) {
    const lines = missingRequired
      .map((key) => `  - ${key.name}: ${key.note}`)
      .join("\n");
    const message = [
      "Required runtime configuration is missing:",
      lines,
      "",
      "Set them in the environment or in .env before building, for example:",
      "  GROQ_API_KEY=gsk_...",
      "  NOMINATIM_USER_AGENT='JalDrishti/0.2.1 (maintainer: you@example.org)'",
      "",
      "Or pass --allow-missing-required to ship anyway. The installer will then",
      "start with those features disabled.",
    ].join("\n");

    if (!options.allowMissingRequired) {
      console.error(`\n${message}\n`);
      throw new Error(
        `${missingRequired.map(nameOnly).join(", ")} not set. Refusing to build an installer that silently cannot do its job.`,
      );
    }
    console.warn(`\n${message}\n`);
  }

  const written = await readFile(target, "utf8").catch(() => "");
  if (!written.includes("bakedAt")) {
    throw new Error("Runtime config verification failed: file did not round-trip");
  }
  console.log(
    `\nRuntime config written to ${target} (${Object.keys(baked).length} key(s)).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
