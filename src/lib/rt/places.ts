import type { CountryCode } from "../regions";

/** Approximate city centres used to place a report on the map. City-level only, never an address. */
const CITIES: Record<string, { country: CountryCode; at: [number, number] }> = {
  singapore: { country: "SG", at: [103.82, 1.35] },
  "kuala lumpur": { country: "MY", at: [101.69, 3.14] },
  penang: { country: "MY", at: [100.33, 5.41] },
  "george town": { country: "MY", at: [100.33, 5.41] },
  "johor bahru": { country: "MY", at: [103.76, 1.49] },
  melaka: { country: "MY", at: [102.25, 2.19] },
  malacca: { country: "MY", at: [102.25, 2.19] },
  ipoh: { country: "MY", at: [101.08, 4.6] },
  "kota kinabalu": { country: "MY", at: [116.07, 5.98] },
  kuching: { country: "MY", at: [110.35, 1.55] },
  bangkok: { country: "TH", at: [100.5, 13.75] },
  "chiang mai": { country: "TH", at: [98.99, 18.79] },
  phuket: { country: "TH", at: [98.39, 7.88] },
  jakarta: { country: "ID", at: [106.85, -6.21] },
  surabaya: { country: "ID", at: [112.75, -7.25] },
  bandung: { country: "ID", at: [107.61, -6.91] },
  medan: { country: "ID", at: [98.67, 3.6] },
  denpasar: { country: "ID", at: [115.22, -8.65] },
  bali: { country: "ID", at: [115.22, -8.65] },
  manila: { country: "PH", at: [120.98, 14.6] },
  "quezon city": { country: "PH", at: [121.04, 14.68] },
  cebu: { country: "PH", at: [123.89, 10.32] },
  davao: { country: "PH", at: [125.61, 7.07] },
  "hong kong": { country: "HK", at: [114.17, 22.32] },
  kowloon: { country: "HK", at: [114.18, 22.32] },
  tokyo: { country: "JP", at: [139.69, 35.69] },
  osaka: { country: "JP", at: [135.5, 34.69] },
  nagoya: { country: "JP", at: [136.91, 35.18] },
  yokohama: { country: "JP", at: [139.64, 35.44] },
  fukuoka: { country: "JP", at: [130.4, 33.59] },
  sapporo: { country: "JP", at: [141.35, 43.06] },
  sydney: { country: "AU", at: [151.21, -33.87] },
  melbourne: { country: "AU", at: [144.96, -37.81] },
  brisbane: { country: "AU", at: [153.03, -27.47] },
  perth: { country: "AU", at: [115.86, -31.95] },
  adelaide: { country: "AU", at: [138.6, -34.93] },
  canberra: { country: "AU", at: [149.13, -35.28] },
  mumbai: { country: "IN", at: [72.88, 19.08] },
  delhi: { country: "IN", at: [77.21, 28.61] },
  "new delhi": { country: "IN", at: [77.21, 28.61] },
  bengaluru: { country: "IN", at: [77.59, 12.97] },
  bangalore: { country: "IN", at: [77.59, 12.97] },
  chennai: { country: "IN", at: [80.27, 13.08] },
  hyderabad: { country: "IN", at: [78.49, 17.39] },
  kolkata: { country: "IN", at: [88.36, 22.57] },
  pune: { country: "IN", at: [73.86, 18.52] },
  ahmedabad: { country: "IN", at: [72.57, 23.02] },
  kochi: { country: "IN", at: [76.27, 9.93] },
};

const COUNTRY_CENTRE: Record<CountryCode, [number, number]> = {
  SG: [103.82, 1.35],
  MY: [101.69, 3.14],
  TH: [100.5, 13.75],
  ID: [106.85, -6.21],
  PH: [120.98, 14.6],
  HK: [114.17, 22.32],
  JP: [139.69, 35.69],
  AU: [151.21, -33.87],
  IN: [77.21, 28.61],
  XX: [110, 5],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Find a city; otherwise use the country centre with a small stable offset so dots don't stack. */
export function locate(country: CountryCode, city: string | undefined, seed: string): { at: [number, number]; city: string } {
  const key = city?.trim().toLowerCase();
  if (key && CITIES[key]) return { at: CITIES[key].at, city: city!.trim() };
  const base = COUNTRY_CENTRE[country] ?? COUNTRY_CENTRE.XX;
  const h = hash(seed);
  const dx = ((h % 1000) / 1000 - 0.5) * 1.6;
  const dy = (((h >> 10) % 1000) / 1000 - 0.5) * 1.2;
  return { at: [base[0] + dx, base[1] + dy], city: city?.trim() || "" };
}

/** Approximate USD rates for comparing amounts across currencies on the network view. */
export const USD_RATE: Record<string, number> = {
  USD: 1,
  INR: 0.012,
  SGD: 0.77,
  AUD: 0.66,
  JPY: 0.0067,
  MYR: 0.23,
  IDR: 0.000061,
  PHP: 0.0175,
  THB: 0.0295,
  HKD: 0.128,
};

export function toUsd(amount: number, currency: string): number {
  return Math.round(amount * (USD_RATE[currency] ?? 0));
}
