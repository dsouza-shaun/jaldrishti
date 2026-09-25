import { readFile } from "node:fs/promises";
import path from "node:path";

export type CsvRow = Readonly<Record<string, string>>;

export interface CsvTable {
  readonly filePath: string;
  readonly headers: readonly string[];
  readonly rows: readonly CsvRow[];
}

interface DatasetCache {
  tables: Map<string, Promise<CsvTable>>;
}

const globalWithDatasetCache = globalThis as typeof globalThis & {
  __jaldrishtiDatasetCacheV1?: DatasetCache;
};

const datasetCache =
  globalWithDatasetCache.__jaldrishtiDatasetCacheV1 ??
  (globalWithDatasetCache.__jaldrishtiDatasetCacheV1 = {
    tables: new Map<string, Promise<CsvTable>>(),
  });

export function getDatasetRoot(): string {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.JALDRISHTI_DATASETS_DIR?.trim() ||
      path.join(process.cwd(), "datasets"),
  );
}

export function resolveDatasetPath(relativePath: string): string {
  const root = getDatasetRoot();
  const resolved = path.resolve(root, relativePath);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootPrefix)) {
    throw new Error("Dataset path escapes the configured datasets directory");
  }
  return resolved;
}

export function toPortableDatasetPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

/** RFC 4180 parser with CRLF, escaped quotes, and quoted-newline support. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoteClosed = false;

  const finishField = () => {
    row.push(field);
    field = "";
    quoteClosed = false;
  };

  const finishRow = () => {
    finishField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (quoteClosed && character !== "," && character !== "\r" && character !== "\n") {
      throw new Error("Unexpected character after a closed CSV field");
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error("Unexpected quote in an unquoted CSV field");
      }
      inQuotes = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\r") {
      if (text[index + 1] === "\n") index += 1;
      finishRow();
    } else if (character === "\n") {
      finishRow();
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error("CSV ends inside a quoted field");
  if (field.length > 0 || row.length > 0 || quoteClosed) finishRow();

  return rows;
}

function normalizeHeader(value: string, index: number): string {
  const normalized = value.replace(/^\uFEFF/u, "").trim();
  if (!normalized) throw new Error(`CSV header ${index + 1} is empty`);
  return normalized;
}

export function parseNullableNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (
    trimmed === "" ||
    trimmed.toUpperCase() === "NA" ||
    trimmed.toUpperCase() === "N/A" ||
    trimmed.toUpperCase() === "NULL" ||
    trimmed === "-"
  ) {
    return null;
  }

  const normalized = trimmed.replace(/,/gu, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cleanText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\s+/gu, " ") : null;
}

export async function loadCsvDataset(
  relativePath: string,
  requiredHeaders: readonly string[],
): Promise<CsvTable> {
  const filePath = resolveDatasetPath(relativePath);
  const cached = datasetCache.tables.get(filePath);
  if (cached) return cached;

  const loading = (async () => {
    const text = await readFile(/*turbopackIgnore: true*/ filePath, "utf8");
    const parsedRows = parseCsv(text);
    if (parsedRows.length === 0) throw new Error(`${relativePath} is empty`);

    const headers = parsedRows[0].map(normalizeHeader);
    const duplicateHeader = headers.find(
      (header, index) => headers.indexOf(header) !== index,
    );
    if (duplicateHeader) {
      throw new Error(`${relativePath} contains duplicate header ${duplicateHeader}`);
    }

    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.includes(header),
    );
    if (missingHeaders.length > 0) {
      throw new Error(
        `${relativePath} is missing required headers: ${missingHeaders.join(", ")}`,
      );
    }

    const rows = parsedRows.slice(1).map((values, rowIndex) => {
      if (values.length !== headers.length) {
        throw new Error(
          `${relativePath} row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}`,
        );
      }
      return Object.freeze(
        Object.fromEntries(
          headers.map((header, columnIndex) => [header, values[columnIndex]]),
        ),
      );
    });

    return Object.freeze({
      filePath,
      headers: Object.freeze(headers),
      rows: Object.freeze(rows),
    });
  })();

  datasetCache.tables.set(filePath, loading);
  try {
    return await loading;
  } catch (error) {
    datasetCache.tables.delete(filePath);
    throw error;
  }
}

export function clearDatasetCache(): void {
  datasetCache.tables.clear();
}
