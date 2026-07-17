// Maps national-team names (as they appear on TxLINE fixtures — World Cup and
// International Friendlies) to either:
//   • an ISO-3166-1 alpha-2 code → rendered as a regional-indicator emoji pair, OR
//   • a pre-built subdivision flag string for the GB home nations (England, Scotland,
//     Wales, Northern Ireland), which each have their own Unicode tag-sequence flag
//     (🏴 + tag chars) even though they share the "GB" alpha-2 code.

// ---------------------------------------------------------------------------
// ISO-3166-1 alpha-2 → team-name mapping
// ---------------------------------------------------------------------------
const TEAM_CODES: Array<[code: string, names: string[]]> = [
  // AFC
  ["IR", ["IR Iran", "Iran"]],
  ["JP", ["Japan"]],
  ["KR", ["Korea Republic", "South Korea", "Korea"]],
  ["KP", ["Korea DPR", "North Korea", "DPR Korea"]],
  ["SA", ["Saudi Arabia"]],
  ["AU", ["Australia", "Socceroos"]],
  ["QA", ["Qatar"]],
  ["AE", ["United Arab Emirates", "UAE", "U.A.E."]],
  ["IQ", ["Iraq"]],
  ["UZ", ["Uzbekistan"]],
  ["JO", ["Jordan"]],
  ["OM", ["Oman"]],
  ["BH", ["Bahrain"]],
  ["KW", ["Kuwait"]],
  ["CN", ["China PR", "China", "PR China"]],
  ["VN", ["Vietnam", "Viet Nam"]],
  ["TH", ["Thailand"]],
  ["ID", ["Indonesia"]],
  ["IN", ["India"]],
  ["SY", ["Syria"]],
  ["LB", ["Lebanon"]],
  ["PS", ["Palestine"]],
  ["YE", ["Yemen"]],
  ["MM", ["Myanmar"]],
  ["KH", ["Cambodia"]],
  ["MY", ["Malaysia"]],
  ["SG", ["Singapore"]],
  ["PH", ["Philippines"]],
  ["HK", ["Hong Kong"]],
  ["TW", ["Chinese Taipei", "Taiwan"]],
  ["NP", ["Nepal"]],
  ["BD", ["Bangladesh"]],
  ["LK", ["Sri Lanka"]],
  ["BT", ["Bhutan"]],
  ["MV", ["Maldives"]],
  ["AF", ["Afghanistan"]],
  ["PK", ["Pakistan"]],
  ["TJ", ["Tajikistan"]],
  ["TM", ["Turkmenistan"]],
  ["KG", ["Kyrgyzstan"]],
  ["MN", ["Mongolia"]],
  ["LA", ["Laos"]],
  ["BN", ["Brunei", "Brunei Darussalam"]],
  ["TL", ["Timor-Leste", "East Timor"]],
  ["MO", ["Macau", "Macao"]],
  ["GU", ["Guam"]],

  // CAF
  ["MA", ["Morocco"]],
  ["SN", ["Senegal"]],
  ["TN", ["Tunisia"]],
  ["DZ", ["Algeria"]],
  ["EG", ["Egypt"]],
  ["NG", ["Nigeria"]],
  ["GH", ["Ghana"]],
  ["CM", ["Cameroon"]],
  ["CI", ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire", "Cote dIvoire"]],
  ["ML", ["Mali"]],
  ["BF", ["Burkina Faso"]],
  ["ZA", ["South Africa"]],
  [
    "CD",
    ["DR Congo", "Congo DR", "Democratic Republic of the Congo", "Congo, DR"],
  ],
  ["CG", ["Congo", "Republic of Congo", "Congo Republic"]],
  ["ZM", ["Zambia"]],
  ["ZW", ["Zimbabwe"]],
  ["UG", ["Uganda"]],
  ["KE", ["Kenya"]],
  ["TZ", ["Tanzania"]],
  ["ET", ["Ethiopia"]],
  ["GN", ["Guinea"]],
  ["GW", ["Guinea-Bissau"]],
  ["GA", ["Gabon"]],
  ["GQ", ["Equatorial Guinea"]],
  ["AO", ["Angola"]],
  ["MZ", ["Mozambique"]],
  ["NA", ["Namibia"]],
  ["BW", ["Botswana"]],
  ["BJ", ["Benin"]],
  ["TG", ["Togo"]],
  ["NE", ["Niger"]],
  ["TD", ["Chad"]],
  ["CF", ["Central African Republic"]],
  ["SL", ["Sierra Leone"]],
  ["LR", ["Liberia"]],
  ["GM", ["The Gambia", "Gambia"]],
  ["MR", ["Mauritania"]],
  ["LY", ["Libya"]],
  ["SD", ["Sudan"]],
  ["SS", ["South Sudan"]],
  ["SO", ["Somalia"]],
  ["ER", ["Eritrea"]],
  ["DJ", ["Djibouti"]],
  ["KM", ["Comoros"]],
  ["MG", ["Madagascar"]],
  ["MW", ["Malawi"]],
  ["LS", ["Lesotho"]],
  ["SZ", ["Eswatini", "Swaziland"]],
  ["CV", ["Cape Verde", "Cabo Verde"]],
  [
    "ST",
    ["Sao Tome and Principe", "São Tomé and Príncipe", "Sao Tome & Principe"],
  ],
  ["BI", ["Burundi"]],
  ["RW", ["Rwanda"]],
  ["SC", ["Seychelles"]],
  ["MU", ["Mauritius"]],

  // CONCACAF
  [
    "US",
    ["USA", "United States", "United States of America", "U.S.A.", "U.S."],
  ],
  ["MX", ["Mexico", "México"]],
  ["CA", ["Canada"]],
  ["CR", ["Costa Rica"]],
  ["JM", ["Jamaica"]],
  ["HN", ["Honduras"]],
  ["PA", ["Panama"]],
  ["SV", ["El Salvador"]],
  ["GT", ["Guatemala"]],
  ["TT", ["Trinidad and Tobago", "Trinidad & Tobago"]],
  ["HT", ["Haiti"]],
  ["CW", ["Curacao", "Curaçao"]],
  ["NI", ["Nicaragua"]],
  ["SR", ["Suriname"]],
  ["CU", ["Cuba"]],
  ["DO", ["Dominican Republic"]],
  ["BM", ["Bermuda"]],
  ["GY", ["Guyana"]],
  ["AG", ["Antigua and Barbuda", "Antigua & Barbuda"]],
  ["BS", ["Bahamas", "The Bahamas"]],
  ["BB", ["Barbados"]],
  ["BZ", ["Belize"]],
  ["DM", ["Dominica"]],
  ["GD", ["Grenada"]],
  ["MS", ["Montserrat"]],
  [
    "KN",
    [
      "St Kitts and Nevis",
      "Saint Kitts and Nevis",
      "St. Kitts and Nevis",
      "St Kitts & Nevis",
    ],
  ],
  ["LC", ["St Lucia", "Saint Lucia", "St. Lucia"]],
  [
    "VC",
    [
      "St Vincent and the Grenadines",
      "Saint Vincent and the Grenadines",
      "St. Vincent and the Grenadines",
    ],
  ],
  ["PR", ["Puerto Rico"]],
  ["VI", ["US Virgin Islands"]],
  ["VG", ["British Virgin Islands"]],
  ["KY", ["Cayman Islands"]],
  ["TC", ["Turks and Caicos Islands"]],
  ["AI", ["Anguilla"]],
  ["AW", ["Aruba"]],
  ["SX", ["Sint Maarten"]],

  // CONMEBOL
  ["BR", ["Brazil", "Brasil"]],
  ["AR", ["Argentina"]],
  ["UY", ["Uruguay"]],
  ["CO", ["Colombia"]],
  ["CL", ["Chile"]],
  ["PE", ["Peru", "Perú"]],
  ["PY", ["Paraguay"]],
  ["EC", ["Ecuador"]],
  ["BO", ["Bolivia"]],
  ["VE", ["Venezuela"]],

  // UEFA
  ["FR", ["France"]],
  ["DE", ["Germany"]],
  ["ES", ["Spain", "España"]],
  ["IT", ["Italy", "Italia"]],
  ["PT", ["Portugal"]],
  ["NL", ["Netherlands", "Holland", "The Netherlands"]],
  ["BE", ["Belgium"]],
  ["HR", ["Croatia"]],
  ["CH", ["Switzerland"]],
  ["PL", ["Poland"]],
  ["DK", ["Denmark"]],
  ["SE", ["Sweden"]],
  ["NO", ["Norway"]],
  ["AT", ["Austria"]],
  ["RS", ["Serbia"]],
  ["IE", ["Republic of Ireland", "Ireland"]],
  ["UA", ["Ukraine"]],
  ["CZ", ["Czech Republic", "Czechia"]],
  ["SK", ["Slovakia"]],
  ["HU", ["Hungary"]],
  ["RO", ["Romania"]],
  ["BG", ["Bulgaria"]],
  ["GR", ["Greece"]],
  ["TR", ["Turkey", "Türkiye", "Turkiye"]],
  ["RU", ["Russia"]],
  ["IS", ["Iceland"]],
  ["FI", ["Finland"]],
  ["SI", ["Slovenia"]],
  ["BA", ["Bosnia and Herzegovina", "Bosnia & Herzegovina"]],
  ["MK", ["North Macedonia", "Macedonia"]],
  ["AL", ["Albania"]],
  ["ME", ["Montenegro"]],
  ["XK", ["Kosovo"]],
  ["MD", ["Moldova"]],
  ["BY", ["Belarus"]],
  ["GE", ["Georgia"]],
  ["AM", ["Armenia"]],
  ["AZ", ["Azerbaijan"]],
  ["IL", ["Israel"]],
  ["CY", ["Cyprus"]],
  ["MT", ["Malta"]],
  ["LU", ["Luxembourg"]],
  ["LI", ["Liechtenstein"]],
  ["SM", ["San Marino"]],
  ["AD", ["Andorra"]],
  ["FO", ["Faroe Islands"]],
  ["GI", ["Gibraltar"]],
  ["KZ", ["Kazakhstan"]],
  ["EE", ["Estonia"]],
  ["LV", ["Latvia"]],
  ["LT", ["Lithuania"]],

  // OFC
  ["NZ", ["New Zealand"]],
  ["FJ", ["Fiji"]],
  ["PG", ["Papua New Guinea"]],
  ["SB", ["Solomon Islands"]],
  ["VU", ["Vanuatu"]],
  ["NC", ["New Caledonia"]],
  ["PF", ["Tahiti", "French Polynesia"]],
  ["WS", ["Samoa"]],
  ["AS", ["American Samoa"]],
  ["TO", ["Tonga"]],
  ["CK", ["Cook Islands"]],
]

// ---------------------------------------------------------------------------
// GB home nations — Unicode subdivision tag-sequence flags
// Each is encoded as: BLACK FLAG (U+1F3F4) + tag chars for the subdivision code
// + CANCEL TAG (U+E007F). These render as 🏴󠁧󠁢󠁥󠁮󠁧󠁿 / 🏴󠁧󠁢󠁳󠁣󠁴󠁿 / 🏴󠁧󠁢󠁷󠁬󠁳󠁿 / 🏴󠁧󠁢󠁮󠁩󠁲󠁿
// in all modern OS emoji sets.
// ---------------------------------------------------------------------------
const BLACK_FLAG = "\u{1F3F4}"
const CANCEL_TAG = "\u{E007F}"

function buildSubdivisionFlag(subdivCode: string): string {
  const tags = subdivCode
    .toLowerCase()
    .split("")
    .map((ch) => String.fromCodePoint(0xe0000 + ch.charCodeAt(0)))
  return BLACK_FLAG + tags.join("") + CANCEL_TAG
}

const SUBDIVISION_FLAGS: Array<[flag: string, names: string[]]> = [
  [buildSubdivisionFlag("gbeng"), ["England"]],
  [buildSubdivisionFlag("gbsct"), ["Scotland"]],
  [buildSubdivisionFlag("gbwls"), ["Wales", "Cymru"]],
  [buildSubdivisionFlag("gbnir"), ["Northern Ireland"]],
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

// Build the main name → alpha-2 lookup
const NAME_TO_CODE = new Map<string, string>()
for (const [code, names] of TEAM_CODES) {
  for (const name of names) {
    NAME_TO_CODE.set(normalize(name), code)
  }
}

// Build the subdivision name → pre-built flag lookup
const NAME_TO_SUBDIVISION_FLAG = new Map<string, string>()
for (const [flag, names] of SUBDIVISION_FLAGS) {
  for (const name of names) {
    NAME_TO_SUBDIVISION_FLAG.set(normalize(name), flag)
  }
}

const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - "A".charCodeAt(0)

function codeToFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((letter) =>
      String.fromCodePoint(letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET)
    )
    .join("")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the flag emoji for a team name, or null if there's no mapping. */
export function getTeamFlag(name: string | null | undefined): string | null {
  if (!name) return null
  const key = normalize(name)

  // Check subdivision flags first (GB home nations)
  const subdivFlag = NAME_TO_SUBDIVISION_FLAG.get(key)
  if (subdivFlag) return subdivFlag

  // Fall back to regional-indicator pair via alpha-2 code
  const code = NAME_TO_CODE.get(key)
  return code ? codeToFlagEmoji(code) : null
}
