import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";

const projectDirectory = process.cwd();
const standaloneDirectory = path.join(projectDirectory, ".next", "standalone");

async function copyDirectoryIfPresent(source, destination) {
  try {
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true });
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

try {
  const entries = await readdir(standaloneDirectory, { withFileTypes: true });
  const environmentFiles = entries
    .filter((entry) => entry.isFile() && (entry.name === ".env" || entry.name.startsWith(".env.")))
    .map((entry) => entry.name);

  await Promise.all(
    environmentFiles.map((fileName) => rm(path.join(standaloneDirectory, fileName), { force: true })),
  );

  // Next standalone output intentionally omits public assets and static chunks.
  // Copy them explicitly so the generated server is self-contained.
  const publicCopied = await copyDirectoryIfPresent(
    path.join(projectDirectory, "public"),
    path.join(standaloneDirectory, "public"),
  );
  const staticCopied = await copyDirectoryIfPresent(
    path.join(projectDirectory, ".next", "static"),
    path.join(standaloneDirectory, ".next", "static"),
  );

  const messages = [];
  if (environmentFiles.length > 0) {
    messages.push(`removed ${environmentFiles.length} environment file(s)`);
  }
  if (publicCopied) messages.push("copied public assets");
  if (staticCopied) messages.push("copied static assets");
  if (messages.length > 0) {
    console.log(`Standalone output: ${messages.join(", ")}.`);
  }
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}
