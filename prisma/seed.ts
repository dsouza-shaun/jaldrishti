/**
 * Development seed.
 *
 * Creates the two demo accounts and one project per developer, so that project
 * isolation is demonstrable: signing in as the second developer must not reveal
 * the first developer's project.
 *
 * No analysis rows are seeded. An analysis is only ever produced by the real
 * pipeline, so seeding one here would mean inventing screening output. The
 * intended demo order is: sign in as the developer, run a screening, submit it
 * for review, then sign in as the authority to see it in the queue.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

interface SeedUser {
  username: string;
  password: string;
  role: "DEVELOPER" | "AUTHORITY";
  displayName: string;
  organisation: string;
}

const USERS: SeedUser[] = [
  {
    username: "developer",
    password: "dev@demo",
    role: "DEVELOPER",
    displayName: "Developer One",
    organisation: "Demo Developer",
  },
  {
    username: "developer2",
    password: "dev2@demo",
    role: "DEVELOPER",
    displayName: "Developer Two",
    organisation: "Demo Developer",
  },
  {
    username: "authority",
    password: "auth@demo",
    role: "AUTHORITY",
    displayName: "Authority Officer",
    organisation: "Demo Reviewing Authority",
  },
];

const PROJECTS = [
  {
    developerIndex: 0,
    projectName: "Taloja DC Park - Building 1",
    latitude: 19.0418,
    longitude: 73.0856,
    itLoad: 100,
    pue: 1.4,
    wue: 1.5,
    coolingType: "water-cooled-chiller",
    builtUpArea: 80000,
    landTenure: "midc",
    proposedWaterSource: "groundwater",
    alternativeWaterSource: "municipal",
    notes: "Hypothetical 100 MW data-centre campus at Taloja MIDC phase 2.",
  },
  {
    developerIndex: 1,
    projectName: "Hinjewadi Phase 3 - Plot 44",
    latitude: 18.5913,
    longitude: 73.7389,
    itLoad: 40,
    pue: 1.3,
    wue: 1.2,
    coolingType: "hybrid",
    builtUpArea: 32000,
    landTenure: "private-freehold",
    proposedWaterSource: "municipal",
    alternativeWaterSource: "groundwater",
    notes: "Seeded to demonstrate per-developer project isolation.",
  },
];

async function main() {
  const created: Array<{ user: SeedUser; id: string }> = [];

  for (const user of USERS) {
    const row = await db.user.upsert({
      where: { username: user.username },
      update: {
        passwordHash: await bcrypt.hash(user.password, 10),
        role: user.role,
        displayName: user.displayName,
        organisation: user.organisation,
      },
      create: {
        username: user.username,
        passwordHash: await bcrypt.hash(user.password, 10),
        role: user.role,
        displayName: user.displayName,
        organisation: user.organisation,
      },
    });
    created.push({ user, id: row.id });
    console.log(`  user  ${user.username.padEnd(12)} ${user.role}`);
  }

  for (const spec of PROJECTS) {
    const owner = created[spec.developerIndex];
    const existing = await db.project.findFirst({
      where: { developerId: owner.id, projectName: spec.projectName },
    });
    if (existing) {
      console.log(`  skip  ${spec.projectName} (already present)`);
      continue;
    }
    const { developerIndex: _developerIndex, ...fields } = spec;
    await db.project.create({ data: { ...fields, developerId: owner.id } });
    console.log(`  proj  ${spec.projectName} -> ${owner.user.username}`);
  }

  console.log("\nSeed complete. Sign in at /login");
  console.log("  developer / dev@demo    DEVELOPER");
  console.log("  developer2 / dev2@demo  DEVELOPER");
  console.log("  authority / auth@demo   AUTHORITY");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
