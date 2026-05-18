/**
 * v3 mega-industry taxonomy + persona types.
 *
 * Fixes three v2 defects flagged by Wahaj:
 *   1. MECE break — v2 had ~10 mega rows with tech ⊃ fintech, marketplaces-as-row,
 *      and consumer-services overlapping retail/travel. v3 has 18 MECE rows.
 *   2. Missing top-15 CX-volume verticals — v2 was missing insurance, energy-utilities,
 *      automotive, pharma-lifesci, real-estate-proptech, gaming, government-public-sector,
 *      CPG, professional-legal-services. v3 lists all 9.
 *   3. Fixed-size persona arrays — v2 stored 2–3 personas in flat columns. v3 stores
 *      personas as a variable-length JSONB array (typically 3–7 per vertical) with
 *      vertical-aware committee composition.
 *
 * Source of truth: ~/Desktop/opencx-deliverables/wahaj_v3_spec.md
 */

export type MegaIndustryKey =
  | "financial-services"
  | "insurance"
  | "tech-software"
  | "healthcare"
  | "pharma-lifesci"
  | "retail-ecom"
  | "CPG"
  | "travel-hospitality"
  | "media-entertainment"
  | "telecom"
  | "logistics"
  | "automotive"
  | "energy-utilities"
  | "real-estate-proptech"
  | "gaming"
  | "education"
  | "government-public-sector"
  | "professional-legal-services";

export type MegaIndustry = {
  key: MegaIndustryKey;
  label: string;
  // Free-text human description used in tooltips / row hints.
  blurb: string;
  // Primary 2-digit NAICS sectors. Used as a hint, not authoritative.
  naics: string[];
  // Megas that v2 had absent — used by audit overlays / "new in v3" badge.
  newInV3?: boolean;
};

/**
 * Canonical v3 mega-industry list.
 * Order is roughly by expected CX-spend rank, not alphabetic.
 */
export const MEGA_INDUSTRIES: MegaIndustry[] = [
  {
    key: "financial-services",
    label: "Financial services",
    blurb: "Banks, payments, lending, capital markets, crypto/DeFi. Fintech sits as sub-industry here, not as a separate mega.",
    naics: ["52 (excl. 524)"],
  },
  {
    key: "insurance",
    label: "Insurance",
    blurb: "Carriers, MGAs, brokers, claims platforms. CX center of gravity is FNOL + claims + renewals.",
    naics: ["524"],
    newInV3: true,
  },
  {
    key: "tech-software",
    label: "Tech & software",
    blurb: "Pure software, SaaS, dev infra, cybersecurity, data/AI tooling. Excludes fintech (→ financial-services).",
    naics: ["5112", "5182", "5415*", "5191"],
  },
  {
    key: "healthcare",
    label: "Healthcare",
    blurb: "Providers, payers, digital health, care delivery. Excludes pharma/biotech (→ pharma-lifesci).",
    naics: ["62"],
  },
  {
    key: "pharma-lifesci",
    label: "Pharma & life sciences",
    blurb: "Drug discovery, manufacture, distribution, clinical research, biotech, diagnostics.",
    naics: ["3254", "3391", "5417*"],
    newInV3: true,
  },
  {
    key: "retail-ecom",
    label: "Retail & e-commerce",
    blurb: "Branded retail, DTC, multi-channel commerce. Highest CX volume concentration.",
    naics: ["44", "45", "4541"],
  },
  {
    key: "CPG",
    label: "Consumer packaged goods",
    blurb: "Branded manufacturers of CPG sold primarily via retail/wholesale (F&B, household, personal care, beauty).",
    naics: ["311", "312", "315", "316", "3253", "3256"],
    newInV3: true,
  },
  {
    key: "travel-hospitality",
    label: "Travel & hospitality",
    blurb: "Air, lodging, OTA, ground, experiences, cruise. Includes lodging marketplaces (with marketplace flag).",
    naics: ["481", "487", "7211", "7212", "7213"],
  },
  {
    key: "media-entertainment",
    label: "Media & entertainment",
    blurb: "Streaming, publishing, music, sports, ad-supported content. Excludes gaming.",
    naics: ["511 (excl. 5112)", "512", "515", "711"],
  },
  {
    key: "telecom",
    label: "Telecom",
    blurb: "Network carriers, MVNOs, ISPs, infra.",
    naics: ["517"],
  },
  {
    key: "logistics",
    label: "Logistics",
    blurb: "Freight, parcel, last-mile, 3PL, warehousing, supply-chain operators. Passenger ride-hail sits here.",
    naics: ["482", "483", "484", "488", "492", "493"],
  },
  {
    key: "automotive",
    label: "Automotive",
    blurb: "OEMs, dealers, parts, mobility-as-a-service operators.",
    naics: ["3361", "3362", "3363", "4411", "4412", "4413"],
    newInV3: true,
  },
  {
    key: "energy-utilities",
    label: "Energy & utilities",
    blurb: "Power, gas, water utilities; oilfield services; renewables operators.",
    naics: ["21", "22", "2371"],
    newInV3: true,
  },
  {
    key: "real-estate-proptech",
    label: "Real estate & proptech",
    blurb: "Real estate operators, brokerages, property management, proptech platforms.",
    naics: ["531"],
    newInV3: true,
  },
  {
    key: "gaming",
    label: "Gaming",
    blurb: "AAA + indie studios, mobile publishers, gaming platforms, esports orgs, regulated iGaming.",
    naics: ["7132", "5112*"],
    newInV3: true,
  },
  {
    key: "education",
    label: "Education",
    blurb: "K-12, higher-ed, edtech, workforce training, certification.",
    naics: ["61"],
  },
  {
    key: "government-public-sector",
    label: "Government & public sector",
    blurb: "Federal, state, local, defense services, NGOs at scale.",
    naics: ["92"],
    newInV3: true,
  },
  {
    key: "professional-legal-services",
    label: "Professional & legal services",
    blurb: "Law, accounting, consulting, staffing, BPO, agency services.",
    naics: ["5411", "5412", "5413", "5414", "5416", "5418", "5613"],
    newInV3: true,
  },
];

export const MEGA_LOOKUP: Record<string, MegaIndustry> = MEGA_INDUSTRIES.reduce(
  (acc, m) => {
    acc[m.key] = m;
    acc[m.label.toLowerCase()] = m;
    return acc;
  },
  {} as Record<string, MegaIndustry>,
);

/**
 * Resolve a DB row's free-text industry/mega label to a canonical v3 mega.
 * Tolerant of the v2 strings the DB still carries: "tech", "fintech",
 * "consumer services", "marketplaces" etc. Returns null if no confident match.
 */
export function resolveMega(raw: string | null | undefined): MegaIndustry | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (MEGA_LOOKUP[s]) return MEGA_LOOKUP[s];
  // v2 → v3 reroute hints
  if (/fintech|payments?|bank|lending|crypto|capital markets/.test(s)) return MEGA_LOOKUP["financial-services"];
  if (/insur/.test(s)) return MEGA_LOOKUP["insurance"];
  if (/software|saas|devtools|cyber|cloud|ai infra/.test(s)) return MEGA_LOOKUP["tech-software"];
  if (/health|provider|payer|telehealth|digital health/.test(s)) return MEGA_LOOKUP["healthcare"];
  if (/pharma|biotech|life sci|cro|cdmo|diagnostic/.test(s)) return MEGA_LOOKUP["pharma-lifesci"];
  if (/retail|e[- ]?com|dtc/.test(s)) return MEGA_LOOKUP["retail-ecom"];
  if (/cpg|consumer goods|fmcg|food.*beverage|beauty/.test(s)) return MEGA_LOOKUP["CPG"];
  if (/travel|hospitality|hotel|airline|cruise|lodging/.test(s)) return MEGA_LOOKUP["travel-hospitality"];
  if (/media|entertain|streaming|publishing|broadcast/.test(s)) return MEGA_LOOKUP["media-entertainment"];
  if (/telecom|carrier|isp/.test(s)) return MEGA_LOOKUP["telecom"];
  if (/logistics|freight|3pl|parcel|last[- ]?mile|warehous/.test(s)) return MEGA_LOOKUP["logistics"];
  if (/auto|ev|oem|fleet/.test(s)) return MEGA_LOOKUP["automotive"];
  if (/energy|utility|oil|gas|power|renewable/.test(s)) return MEGA_LOOKUP["energy-utilities"];
  if (/real estate|proptech|reit|brokerage|property/.test(s)) return MEGA_LOOKUP["real-estate-proptech"];
  if (/gaming|game|igaming|esports|casino/.test(s)) return MEGA_LOOKUP["gaming"];
  if (/edu|k-?12|university|edtech/.test(s)) return MEGA_LOOKUP["education"];
  if (/gov|public sector|federal|state|municipal|defense/.test(s)) return MEGA_LOOKUP["government-public-sector"];
  if (/legal|law|accounting|consult|bpo|staffing|agency/.test(s)) return MEGA_LOOKUP["professional-legal-services"];
  return null;
}

// ─── Persona types ────────────────────────────────────────────────────────────

export type PersonaFunction =
  | "cx"
  | "ops"
  | "finance"
  | "tech"
  | "compliance"
  | "domain"
  | "procurement"
  | "marketing"
  | "product"
  | "clinical"
  | "legal";

export type PersonaSeniority = "c-suite" | "vp" | "director" | "manager";

/**
 * Canonical v3 persona shape. Tolerant of legacy v2 shape and the richer
 * shape used in the spec doc; see `normalizePersona` below.
 */
export type Persona = {
  role: string;
  function?: PersonaFunction | string;
  seniority?: PersonaSeniority | string;
  is_economic_buyer?: boolean;
  is_champion?: boolean;
  notes?: string;
  // Optional v2-compat shape (kept so older rows still render)
  fit?: string;
  // Optional v3-spec shape (kept so spec-shape rows render too)
  buying_power?: "economic" | "technical" | "user" | "champion" | "blocker";
  priority?: number;
};

/**
 * Normalize any persona-like blob into the canonical v3 shape used by the
 * renderer. Handles three input formats:
 *   - v2:           { title, seniority?, fit?, why? }
 *   - v3 (prompt):  { role, function, seniority, is_economic_buyer, is_champion, notes? }
 *   - v3 (spec):    { role, function, seniority, buying_power, priority, ... }
 *
 * Always returns a stable shape with `role` populated.
 */
export function normalizePersona(p: any): Persona {
  if (!p || typeof p !== "object") return { role: "Unknown" };
  const role = p.role ?? p.title ?? "Unknown";
  const seniority = p.seniority ?? undefined;
  const fn = p.function ?? undefined;
  // Derive economic-buyer / champion flags from either explicit booleans
  // or the spec's `buying_power` enum.
  const bp = p.buying_power as string | undefined;
  const is_economic_buyer = p.is_economic_buyer === true || bp === "economic";
  const is_champion = p.is_champion === true || bp === "champion";
  return {
    role,
    function: fn,
    seniority,
    is_economic_buyer,
    is_champion,
    notes: p.notes ?? p.why ?? undefined,
    fit: p.fit,
    buying_power: bp as Persona["buying_power"],
    priority: p.priority,
  };
}

// Tailwind color classes per function. Kept conservative so palette stays clean
// against the dark-surface theme. Unknown functions fall through to muted.
export const FUNCTION_CLASSES: Record<string, string> = {
  cx: "bg-accent/12 text-accent border-accent/25",
  ops: "bg-info/12 text-info border-info/25",
  finance: "bg-warn/12 text-warn border-warn/25",
  tech: "bg-info/12 text-info border-info/25",
  compliance: "bg-loss/12 text-loss border-loss/25",
  domain: "bg-surface3 text-ink2 border-line2",
  procurement: "bg-surface3 text-muted border-line2",
  marketing: "bg-warn/12 text-warn border-warn/25",
  product: "bg-accent/12 text-accent border-accent/25",
  clinical: "bg-loss/12 text-loss border-loss/25",
  legal: "bg-loss/12 text-loss border-loss/25",
};

export function functionClass(fn: string | undefined): string {
  if (!fn) return "bg-surface3 text-muted border-line";
  return FUNCTION_CLASSES[fn] ?? "bg-surface3 text-muted border-line";
}
