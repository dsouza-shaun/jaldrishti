import { haversineDistanceKm } from "@/lib/data/geo";

/**
 * IMD Rainfall Station dataset
 * --------------------------------------------------------------
 * Annual and seasonal rainfall normals sourced from IMD "District-Wise
 * Rainfall Statistics" and IMD Climate Research & Services, Pune.
 *
 * Retained as fallback-only reference seeds. The annual/seasonal values are
 * labelled IMD-derived, while the 10-year series is representative rather
 * than a bundled station observation. Real district CSV data takes priority.
 */

export interface RainfallStationSeed {
  stationName: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  annualNormal: number;     // mm
  monsoonNormal: number;    // mm (Jun-Sep)
  postMonsoon: number | null; // mm (Oct-Dec)
  winterRain: number | null;  // mm (Jan-Feb)
  summerRain: number | null;  // mm (Mar-May)
  timeseries: { year: number; annual: number }[];
  source: string;
  sourceDate: string;
  evidenceStatus: "PROXY" | "UNKNOWN";
}

export const RAINFALL_STATIONS: RainfallStationSeed[] = [
  {
    stationName: "Mumbai (Santacruz)",
    state: "Maharashtra",
    district: "Mumbai Suburban",
    latitude: 19.11,
    longitude: 72.85,
    annualNormal: 2461,
    monsoonNormal: 2195,
    postMonsoon: 154,
    winterRain: 2,
    summerRain: 110,
    timeseries: [
      { year: 2014, annual: 2189 },
      { year: 2015, annual: 2231 },
      { year: 2016, annual: 2480 },
      { year: 2017, annual: 2798 },
      { year: 2018, annual: 1784 },
      { year: 2019, annual: 3725 },
      { year: 2020, annual: 2884 },
      { year: 2021, annual: 3144 },
      { year: 2022, annual: 3050 },
      { year: 2023, annual: 2489 },
    ],
    source: "IMD District-Wise Rainfall Statistics",
    sourceDate: "2023-12",
    evidenceStatus: "PROXY",
  },
  {
    stationName: "Mumbai (Colaba)",
    state: "Maharashtra",
    district: "Mumbai City",
    latitude: 18.9,
    longitude: 72.82,
    annualNormal: 2337,
    monsoonNormal: 2078,
    postMonsoon: 140,
    winterRain: 1,
    summerRain: 118,
    timeseries: [
      { year: 2014, annual: 2105 },
      { year: 2015, annual: 2240 },
      { year: 2016, annual: 2310 },
      { year: 2017, annual: 2698 },
      { year: 2018, annual: 1702 },
      { year: 2019, annual: 3512 },
      { year: 2020, annual: 2760 },
      { year: 2021, annual: 2980 },
      { year: 2022, annual: 2890 },
      { year: 2023, annual: 2360 },
    ],
    source: "IMD District-Wise Rainfall Statistics",
    sourceDate: "2023-12",
    evidenceStatus: "PROXY",
  },
  {
    stationName: "Taloja (MIDC)",
    state: "Maharashtra",
    district: "Raigad",
    latitude: 19.04,
    longitude: 73.08,
    annualNormal: 2380,
    monsoonNormal: 2120,
    postMonsoon: 145,
    winterRain: 2,
    summerRain: 113,
    timeseries: [
      { year: 2014, annual: 2098 },
      { year: 2015, annual: 2175 },
      { year: 2016, annual: 2390 },
      { year: 2017, annual: 2705 },
      { year: 2018, annual: 1745 },
      { year: 2019, annual: 3608 },
      { year: 2020, annual: 2798 },
      { year: 2021, annual: 3035 },
      { year: 2022, annual: 2960 },
      { year: 2023, annual: 2401 },
    ],
    source: "IMD District-Wise Rainfall Statistics (Raigad district avg)",
    sourceDate: "2023-12",
    evidenceStatus: "PROXY", // station-level data interpolated from district avg
  },
  {
    stationName: "Pune",
    state: "Maharashtra",
    district: "Pune",
    latitude: 18.52,
    longitude: 73.85,
    annualNormal: 738,
    monsoonNormal: 560,
    postMonsoon: 110,
    winterRain: 5,
    summerRain: 63,
    timeseries: [
      { year: 2014, annual: 698 },
      { year: 2015, annual: 612 },
      { year: 2016, annual: 745 },
      { year: 2017, annual: 812 },
      { year: 2018, annual: 685 },
      { year: 2019, annual: 1010 },
      { year: 2020, annual: 905 },
      { year: 2021, annual: 870 },
      { year: 2022, annual: 798 },
      { year: 2023, annual: 745 },
    ],
    source: "IMD District-Wise Rainfall Statistics",
    sourceDate: "2023-12",
    evidenceStatus: "PROXY",
  },
  {
    stationName: "Nashik",
    state: "Maharashtra",
    district: "Nashik",
    latitude: 19.99,
    longitude: 73.79,
    annualNormal: 1030,
    monsoonNormal: 845,
    postMonsoon: 130,
    winterRain: 8,
    summerRain: 47,
    timeseries: [
      { year: 2014, annual: 945 },
      { year: 2015, annual: 712 },
      { year: 2016, annual: 1080 },
      { year: 2017, annual: 1135 },
      { year: 2018, annual: 875 },
      { year: 2019, annual: 1342 },
      { year: 2020, annual: 1190 },
      { year: 2021, annual: 1065 },
      { year: 2022, annual: 998 },
      { year: 2023, annual: 945 },
    ],
    source: "IMD District-Wise Rainfall Statistics",
    sourceDate: "2023-12",
    evidenceStatus: "PROXY",
  },
  {
    stationName: "Nagpur",
    state: "Maharashtra",
    district: "Nagpur",
    latitude: 21.15,
    longitude: 79.09,
    annualNormal: 1110,
    monsoonNormal: 920,
    postMonsoon: 140,
    winterRain: 12,
    summerRain: 38,
    timeseries: [
      { year: 2014, annual: 1085 },
      { year: 2015, annual: 712 },
      { year: 2016, annual: 1150 },
      { year: 2017, annual: 1298 },
      { year: 2018, annual: 845 },
      { year: 2019, annual: 1412 },
      { year: 2020, annual: 1278 },
      { year: 2021, annual: 1180 },
      { year: 2022, annual: 1085 },
      { year: 2023, annual: 1012 },
    ],
    source: "IMD District-Wise Rainfall Statistics",
    sourceDate: "2023-12",
    evidenceStatus: "PROXY",
  },
  {
    stationName: "Hyderabad",
    state: "Telangana",
    district: "Hyderabad",
    latitude: 17.39,
    longitude: 78.49,
    annualNormal: 828,
    monsoonNormal: 612,
    postMonsoon: 158,
    winterRain: 5,
    summerRain: 53,
    timeseries: [
      { year: 2014, annual: 705 },
      { year: 2015, annual: 742 },
      { year: 2016, annual: 875 },
      { year: 2017, annual: 945 },
      { year: 2018, annual: 720 },
      { year: 2019, annual: 1010 },
      { year: 2020, annual: 920 },
      { year: 2021, annual: 870 },
      { year: 2022, annual: 845 },
      { year: 2023, annual: 798 },
    ],
    source: "IMD District-Wise Rainfall Statistics",
    sourceDate: "2023-12",
    evidenceStatus: "PROXY",
  },
  {
    stationName: "Chennai",
    state: "Tamil Nadu",
    district: "Chennai",
    latitude: 13.08,
    longitude: 80.27,
    annualNormal: 1450,
    monsoonNormal: 440,
    postMonsoon: 870,
    winterRain: 90,
    summerRain: 50,
    timeseries: [
      { year: 2014, annual: 1380 },
      { year: 2015, annual: 2218 },
      { year: 2016, annual: 642 },
      { year: 2017, annual: 985 },
      { year: 2018, annual: 845 },
      { year: 2019, annual: 1090 },
      { year: 2020, annual: 1785 },
      { year: 2021, annual: 1620 },
      { year: 2022, annual: 1505 },
      { year: 2023, annual: 1342 },
    ],
    source: "IMD District-Wise Rainfall Statistics",
    sourceDate: "2023-12",
    evidenceStatus: "PROXY",
  },
];

/**
 * Find nearest station by great-circle distance.
 */
export function nearestRainfallStation(
  lat: number,
  lng: number,
): { station: RainfallStationSeed; distanceKm: number; evidenceStatus: "PROXY" } | null {
  let best: { station: RainfallStationSeed; distanceKm: number } | null = null;
  for (const station of RAINFALL_STATIONS) {
    const distanceKm = haversineDistanceKm(
      { latitude: lat, longitude: lng },
      { latitude: station.latitude, longitude: station.longitude },
    );
    if (!best || distanceKm < best.distanceKm) {
      best = { station, distanceKm };
    }
  }
  if (!best || best.distanceKm > 50) return null;

  // The station values and synthetic/representative time series are retained
  // only as a fallback. Nearest-centroid proximity does not verify a station.
  return {
    station: best.station,
    distanceKm: Number(best.distanceKm.toFixed(2)),
    evidenceStatus: "PROXY",
  };
}
