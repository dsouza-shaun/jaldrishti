export interface Coordinates {
  latitude: number;
  longitude: number;
}

const STATE_ALIASES: Readonly<Record<string, string>> = {
  orissa: "odisha",
  uttaranchal: "uttarakhand",
  uttarpradesh: "uttarpradesh",
  madhyapradesh: "madhyapradesh",
  tamilnadu: "tamilnadu",
  pondicherry: "puducherry",
  chatsgarh: "chhattisgarh",
  chatisgarh: "chhattisgarh",
  chattisgarh: "chhattisgarh",
  jk: "jammuandkashmir",
  jandk: "jammuandkashmir",
  jammuandkashmir: "jammuandkashmir",
  aandnisland: "andamanandnicobarislands",
  andamanandnicobarislands: "andamanandnicobarislands",
  dadarnagarhaveli: "dadraandnagarhavelianddamananddiu",
  dadraandnagarhaveli: "dadraandnagarhavelianddamananddiu",
  daman: "dadraandnagarhavelianddamananddiu",
  diu: "dadraandnagarhavelianddamananddiu",
  damananddui: "dadraandnagarhavelianddamananddiu",
};

export function normalizeRegionName(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function normalizeStateName(value: string | null | undefined): string {
  const normalized = normalizeRegionName(value);
  return STATE_ALIASES[normalized] ?? normalized;
}

export function regionKey(
  state: string | null | undefined,
  district: string | null | undefined,
): string {
  return `${normalizeStateName(state)}|${normalizeRegionName(district)}`;
}

export function isValidCoordinates(value: Coordinates): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

export function roundCoordinate(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** Great-circle distance. This is suitable for nearest-neighbour ranking. */
export function haversineDistanceKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371.0088;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}
