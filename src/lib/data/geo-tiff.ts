import { open } from "node:fs/promises";

export interface GeoTiffBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeoTiffInfo {
  width: number;
  height: number;
  epsg: number | null;
  /** Six coefficients of the affine model-pixel-to-world transform. */
  affine: [number, number, number, number, number, number];
  bounds: GeoTiffBounds;
  noData: number | null;
}

interface TagDescriptor {
  tag: number;
  type: number;
  count: number;
  entryOffset: number;
}

const TIFF_HEADER_BYTES = 1024 * 1024;
const TYPE_SIZES: Readonly<Record<number, number>> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
};

async function readBytes(
  handle: Awaited<ReturnType<typeof open>>,
  position: number,
  length: number,
): Promise<Buffer> {
  const result = Buffer.alloc(length);
  let offset = 0;

  while (offset < length) {
    const { bytesRead } = await handle.read(
      result,
      offset,
      length - offset,
      position + offset,
    );
    if (bytesRead === 0) {
      throw new Error(`Unexpected end of TIFF while reading ${length} bytes`);
    }
    offset += bytesRead;
  }

  return result;
}

function parseTagValues(
  buffer: Buffer,
  type: number,
  count: number,
  littleEndian: boolean,
): Array<string | number> {
  const values: Array<string | number> = [];

  if (type === 2) {
    return buffer.toString("ascii").replace(/\0+$/u, "").split("\0");
  }

  for (let index = 0; index < count; index += 1) {
    const offset = index * (TYPE_SIZES[type] ?? 0);
    switch (type) {
      case 1:
      case 6:
      case 7:
        values.push(buffer.readUInt8(offset));
        break;
      case 3:
        values.push(
          littleEndian
            ? buffer.readUInt16LE(offset)
            : buffer.readUInt16BE(offset),
        );
        break;
      case 8:
        values.push(
          littleEndian
            ? buffer.readInt16LE(offset)
            : buffer.readInt16BE(offset),
        );
        break;
      case 4:
        values.push(
          littleEndian
            ? buffer.readUInt32LE(offset)
            : buffer.readUInt32BE(offset),
        );
        break;
      case 9:
        values.push(
          littleEndian
            ? buffer.readInt32LE(offset)
            : buffer.readInt32BE(offset),
        );
        break;
      case 11:
        values.push(
          littleEndian ? buffer.readFloatLE(offset) : buffer.readFloatBE(offset),
        );
        break;
      case 12:
        values.push(
          littleEndian
            ? buffer.readDoubleLE(offset)
            : buffer.readDoubleBE(offset),
        );
        break;
      default:
        throw new Error(`Unsupported TIFF tag type ${type}`);
    }
  }

  return values;
}

function asNumbers(values: Array<string | number>): number[] {
  return values.map(Number);
}

function getEpsgFromGeoKeys(values: number[]): number | null {
  if (values.length < 4) return null;
  const numberOfKeys = values[3];
  if (!Number.isInteger(numberOfKeys) || numberOfKeys < 0) return null;

  for (let index = 0; index < numberOfKeys; index += 1) {
    const offset = 4 + index * 4;
    const keyId = values[offset];
    const tagLocation = values[offset + 1];
    const value = values[offset + 3];
    if (keyId === 2048 && tagLocation === 0 && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function affineFromTags(
  transform: number[] | undefined,
  pixelScale: number[] | undefined,
  tiepoint: number[] | undefined,
): [number, number, number, number, number, number] | null {
  if (transform && transform.length >= 8) {
    return [
      transform[0],
      transform[1],
      transform[3],
      transform[4],
      transform[5],
      transform[7],
    ];
  }

  if (pixelScale && pixelScale.length >= 2 && tiepoint && tiepoint.length >= 6) {
    const [scaleX, scaleY] = pixelScale;
    const [rasterX, rasterY, , worldX, worldY] = tiepoint;
    return [
      scaleX,
      0,
      worldX - rasterX * scaleX,
      0,
      -Math.abs(scaleY),
      worldY + rasterY * Math.abs(scaleY),
    ];
  }

  return null;
}

function boundsFromAffine(
  affine: [number, number, number, number, number, number],
  width: number,
  height: number,
): GeoTiffBounds {
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([column, row]) => ({
    longitude: affine[0] * column + affine[1] * row + affine[2],
    latitude: affine[3] * column + affine[4] * row + affine[5],
  }));

  return {
    west: Math.min(...corners.map((point) => point.longitude)),
    south: Math.min(...corners.map((point) => point.latitude)),
    east: Math.max(...corners.map((point) => point.longitude)),
    north: Math.max(...corners.map((point) => point.latitude)),
  };
}

/**
 * Reads only the classic-TIFF header and GeoTIFF tags. Raster pixels are left
 * to the caller, so building a 120-raster index does not decode 120 images.
 */
export async function readGeoTiffInfo(filePath: string): Promise<GeoTiffInfo> {
  const handle = await open(/*turbopackIgnore: true*/ filePath, "r");
  try {
    const stats = await handle.stat();
    const prefix = await readBytes(
      handle,
      0,
      Math.min(stats.size, TIFF_HEADER_BYTES),
    );

    if (prefix.length < 8) throw new Error("TIFF header is incomplete");
    const byteOrder = prefix.toString("ascii", 0, 2);
    if (byteOrder !== "II" && byteOrder !== "MM") {
      throw new Error("Input is not a classic TIFF file");
    }

    const littleEndian = byteOrder === "II";
    const readUInt16 = (offset: number) =>
      littleEndian ? prefix.readUInt16LE(offset) : prefix.readUInt16BE(offset);
    const readUInt32 = (offset: number) =>
      littleEndian ? prefix.readUInt32LE(offset) : prefix.readUInt32BE(offset);

    if (readUInt16(2) !== 42) {
      throw new Error("BigTIFF and non-TIFF inputs are not supported");
    }

    const ifdOffset = readUInt32(4);
    if (ifdOffset < 8 || ifdOffset + 2 > prefix.length) {
      throw new Error("TIFF IFD offset is outside the header");
    }

    const tagCount = readUInt16(ifdOffset);
    const entriesEnd = ifdOffset + 2 + tagCount * 12;
    if (entriesEnd > prefix.length) {
      throw new Error("TIFF IFD is outside the header");
    }

    const tags = new Map<number, TagDescriptor>();
    for (let index = 0; index < tagCount; index += 1) {
      const entryOffset = ifdOffset + 2 + index * 12;
      const descriptor: TagDescriptor = {
        tag: readUInt16(entryOffset),
        type: readUInt16(entryOffset + 2),
        count: readUInt32(entryOffset + 4),
        entryOffset,
      };
      tags.set(descriptor.tag, descriptor);
    }

    const readTag = async (tag: number): Promise<Array<string | number> | undefined> => {
      const descriptor = tags.get(tag);
      if (!descriptor) return undefined;
      const unitSize = TYPE_SIZES[descriptor.type];
      if (!unitSize) throw new Error(`Unsupported TIFF type for tag ${tag}`);

      const totalBytes = unitSize * descriptor.count;
      if (
        !Number.isSafeInteger(totalBytes) ||
        totalBytes < 0 ||
        totalBytes > Math.max(TIFF_HEADER_BYTES, 16 * 1024 * 1024)
      ) {
        throw new Error(`TIFF tag ${tag} has an unreasonable size`);
      }

      let valueBuffer: Buffer;
      if (totalBytes <= 4) {
        valueBuffer = prefix.subarray(
          descriptor.entryOffset + 8,
          descriptor.entryOffset + 8 + totalBytes,
        );
      } else {
        const valueOffset = readUInt32(descriptor.entryOffset + 8);
        valueBuffer = await readBytes(handle, valueOffset, totalBytes);
      }

      return parseTagValues(
        valueBuffer,
        descriptor.type,
        descriptor.count,
        littleEndian,
      );
    };

    const widthValues = await readTag(256);
    const heightValues = await readTag(257);
    const width = widthValues?.[0];
    const height = heightValues?.[0];
    if (
      typeof width !== "number" ||
      typeof height !== "number" ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new Error("TIFF dimensions are missing or invalid");
    }

    const transform = await readTag(34264);
    const pixelScale = await readTag(33550);
    const tiepoint = await readTag(33922);
    const geoKeys = await readTag(34735);
    const noDataTag = await readTag(42113);

    const affine = affineFromTags(
      transform ? asNumbers(transform) : undefined,
      pixelScale ? asNumbers(pixelScale) : undefined,
      tiepoint ? asNumbers(tiepoint) : undefined,
    );
    if (!affine) throw new Error("GeoTIFF affine transform is missing");

    const epsg = geoKeys ? getEpsgFromGeoKeys(asNumbers(geoKeys)) : null;
    const noDataValue = noDataTag?.[0];
    const noData =
      typeof noDataValue === "number" && Number.isFinite(noDataValue)
        ? noDataValue
        : typeof noDataValue === "string" && Number.isFinite(Number(noDataValue))
          ? Number(noDataValue)
          : null;

    return {
      width,
      height,
      epsg,
      affine,
      bounds: boundsFromAffine(affine, width, height),
      noData,
    };
  } finally {
    await handle.close();
  }
}

export function rasterCoordinateForPoint(
  info: GeoTiffInfo,
  longitude: number,
  latitude: number,
): { column: number; row: number } | null {
  const [a, b, c, d, e, f] = info.affine;
  const determinant = a * e - b * d;
  if (!Number.isFinite(determinant) || determinant === 0) return null;

  const deltaLongitude = longitude - c;
  const deltaLatitude = latitude - f;
  const column = (deltaLongitude * e - deltaLatitude * b) / determinant;
  const row = (deltaLatitude * a - deltaLongitude * d) / determinant;

  if (column < 0 || row < 0 || column >= info.width || row >= info.height) {
    return null;
  }

  return { column, row };
}

export function boundsContainPoint(
  bounds: GeoTiffBounds,
  longitude: number,
  latitude: number,
): boolean {
  return (
    longitude >= bounds.west &&
    longitude < bounds.east &&
    latitude >= bounds.south &&
    latitude < bounds.north
  );
}
