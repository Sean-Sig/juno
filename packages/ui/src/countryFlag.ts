// Maps IOC 3-letter country codes (as stored by Enet) to ISO 3166-1 alpha-2 codes.
const IOC_TO_ISO2: Record<string, string> = {
  AFG: "AF", ALB: "AL", ALG: "DZ", AND: "AD", ANG: "AO", ANT: "AG",
  ARG: "AR", ARM: "AM", ARU: "AW", ASA: "AS", AUS: "AU", AUT: "AT",
  AZE: "AZ", BAH: "BS", BAN: "BD", BAR: "BB", BDI: "BI", BEL: "BE",
  BEN: "BJ", BER: "BM", BHU: "BT", BIH: "BA", BIZ: "BZ", BLR: "BY",
  BOL: "BO", BOT: "BW", BRA: "BR", BRN: "BH", BRU: "BN", BUL: "BG",
  BUR: "BF", CAF: "CF", CAM: "KH", CAN: "CA", CAY: "KY", CGO: "CG",
  CHA: "TD", CHI: "CL", CHN: "CN", CIV: "CI", CMR: "CM", COD: "CD",
  COK: "CK", COL: "CO", COM: "KM", CPV: "CV", CRC: "CR", CRO: "HR",
  CUB: "CU", CYP: "CY", CZE: "CZ", DEN: "DK", DJI: "DJ", DMA: "DM",
  DOM: "DO", ECU: "EC", EGY: "EG", ERI: "ER", ESA: "SV", ESP: "ES",
  EST: "EE", ETH: "ET", FIJ: "FJ", FIN: "FI", FRA: "FR", FSM: "FM",
  GAB: "GA", GAM: "GM", GBR: "GB", GBS: "GW", GEO: "GE", GEQ: "GQ",
  GER: "DE", GHA: "GH", GRE: "GR", GRN: "GD", GUA: "GT", GUI: "GN",
  GUM: "GU", GUY: "GY", HAI: "HT", HKG: "HK", HON: "HN", HUN: "HU",
  INA: "ID", IND: "IN", IRI: "IR", IRL: "IE", IRQ: "IQ", ISL: "IS",
  ISR: "IL", ISV: "VI", ITA: "IT", IVB: "VG", JAM: "JM", JOR: "JO",
  JPN: "JP", KAZ: "KZ", KEN: "KE", KGZ: "KG", KIR: "KI", KOR: "KR",
  KOS: "XK", KSA: "SA", KUW: "KW", LAO: "LA", LAT: "LV", LBA: "LY",
  LBN: "LB", LBR: "LR", LCA: "LC", LES: "LS", LIE: "LI", LTU: "LT",
  LUX: "LU", MAD: "MG", MAR: "MA", MAS: "MY", MAW: "MW", MDA: "MD",
  MDV: "MV", MEX: "MX", MGL: "MN", MHL: "MH", MKD: "MK", MLI: "ML",
  MLT: "MT", MNE: "ME", MON: "MC", MOZ: "MZ", MRI: "MU", MTN: "MR",
  MYA: "MM", NAM: "NA", NCA: "NI", NED: "NL", NEP: "NP", NGR: "NG",
  NIG: "NE", NOR: "NO", NRU: "NR", NZL: "NZ", OMA: "OM", PAK: "PK",
  PAN: "PA", PAR: "PY", PER: "PE", PHI: "PH", PLE: "PS", PLW: "PW",
  PNG: "PG", POL: "PL", POR: "PT", PRK: "KP", PUR: "PR", QAT: "QA",
  ROU: "RO", RSA: "ZA", RUS: "RU", RWA: "RW", SAM: "WS", SEN: "SN",
  SEY: "SC", SIN: "SG", SKN: "KN", SLE: "SL", SLO: "SI", SMR: "SM",
  SOL: "SB", SOM: "SO", SRB: "RS", SRI: "LK", SSD: "SS", STP: "ST",
  SUD: "SD", SUI: "CH", SUR: "SR", SVK: "SK", SWE: "SE", SWZ: "SZ",
  SYR: "SY", TAN: "TZ", TGA: "TO", THA: "TH", TJK: "TJ", TKM: "TM",
  TLS: "TL", TOG: "TG", TPE: "TW", TTO: "TT", TUN: "TN", TUR: "TR",
  TUV: "TV", UAE: "AE", UGA: "UG", UKR: "UA", URU: "UY", USA: "US",
  UZB: "UZ", VAN: "VU", VEN: "VE", VIE: "VN", VIN: "VC", YEM: "YE",
  ZAM: "ZM", ZIM: "ZW",
};

// Full country names as stored by Enet when country_code is absent.
// Derived from the exact strings in the tennis.players table.
const NAME_TO_ISO2: Record<string, string> = {
  "Andorra": "AD",
  "Argentina": "AR",
  "Australia": "AU",
  "Austria": "AT",
  "Belarus": "BY",
  "Belgium": "BE",
  "Bolivia": "BO",
  "Bosnia and Herzegovina": "BA",
  "Brazil": "BR",
  "Bulgaria": "BG",
  "Burundi": "BI",
  "Canada": "CA",
  "Chile": "CL",
  "China": "CN",
  "Colombia": "CO",
  "Croatia": "HR",
  "Czechia": "CZ",
  "Czech Republic": "CZ",
  "Denmark": "DK",
  "Ecuador": "EC",
  "Egypt": "EG",
  "El Salvador": "SV",
  "Estonia": "EE",
  "Finland": "FI",
  "France": "FR",
  "Georgia": "GE",
  "Germany": "DE",
  "Great Britain": "GB",
  "United Kingdom": "GB",
  "Greece": "GR",
  "Hong Kong": "HK",
  "Hungary": "HU",
  "India": "IN",
  "Indonesia": "ID",
  "Italy": "IT",
  "Japan": "JP",
  "Kazakhstan": "KZ",
  "Latvia": "LV",
  "Lebanon": "LB",
  "Lithuania": "LT",
  "Mexico": "MX",
  "Monaco": "MC",
  "Montenegro": "ME",
  "Morocco": "MA",
  "Netherlands": "NL",
  "New Zealand": "NZ",
  "Norway": "NO",
  "Paraguay": "PY",
  "Peru": "PE",
  "Philippines": "PH",
  "Poland": "PL",
  "Portugal": "PT",
  "Qatar": "QA",
  "Romania": "RO",
  "Russia": "RU",
  "Serbia": "RS",
  "Slovakia": "SK",
  "Slovenia": "SI",
  "Spain": "ES",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Taiwan": "TW",
  "Thailand": "TH",
  "Tunisia": "TN",
  "Turkey": "TR",
  "Turkiye": "TR",
  "Ukraine": "UA",
  "United States": "US",
  "USA": "US",
  "Uzbekistan": "UZ",
  "Ireland": "IE",
  "Republic of Ireland": "IE",
  "South Korea": "KR",
  "Korea Republic": "KR",
  // Additional nations common in soccer/World Cup contexts not covered by
  // the original tennis-derived list above.
  "Haiti": "HT",
  "Jamaica": "JM",
  "Cuba": "CU",
  "Honduras": "HN",
  "Costa Rica": "CR",
  "Panama": "PA",
  "Curacao": "CW",
  "Curaçao": "CW",
  "Trinidad and Tobago": "TT",
  "Saudi Arabia": "SA",
  "Iran": "IR",
  "Iraq": "IQ",
  "Jordan": "JO",
  "Senegal": "SN",
  "Ivory Coast": "CI",
  "Cote d'Ivoire": "CI",
  "Côte d'Ivoire": "CI",
  "Cameroon": "CM",
  "Ghana": "GH",
  "Nigeria": "NG",
  "Algeria": "DZ",
  "Cape Verde": "CV",
  "DR Congo": "CD",
  "South Africa": "ZA",
  "Iceland": "IS",
  "North Macedonia": "MK",
  "Albania": "AL",
  "Kosovo": "XK",
  "Uruguay": "UY",
  "Venezuela": "VE",
  "Guatemala": "GT",
  "Nicaragua": "NI",
  "Dominican Republic": "DO",
  "Israel": "IL",
  "Bahamas": "BS",
  "The Bahamas": "BS",
  "Puerto Rico": "PR",
  "Guinea": "GN",
  "Equatorial Guinea": "GQ",
  "Papua New Guinea": "PG",
  "South Sudan": "SS",
};

// Nations with subdivision flags or no ISO code — returned as literal emoji.
const SPECIAL_FLAGS: Record<string, string> = {
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Northern Ireland": "🇬🇧",
};

function iso2ToFlag(iso2: string): string {
  return Array.from(iso2.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function countryFlag(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  const upper = trimmed.toUpperCase();

  // Nations with subdivision flags or no ISO code
  if (SPECIAL_FLAGS[trimmed]) return SPECIAL_FLAGS[trimmed];

  // 2-letter ISO code
  if (upper.length === 2) return iso2ToFlag(upper);

  // 3-letter IOC code
  const fromIoc = IOC_TO_ISO2[upper];
  if (fromIoc) return iso2ToFlag(fromIoc);

  // Full country name
  const fromName = NAME_TO_ISO2[trimmed] ?? NAME_TO_ISO2[trimmed.toLowerCase()];
  if (fromName) return iso2ToFlag(fromName);

  return null;
}
