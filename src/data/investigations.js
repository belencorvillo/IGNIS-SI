// ── IGNIS-SI · PSI investigation data loader, enums, presets & match scoring ──
//
// Load order (first one that returns a non-empty, valid list wins):
//   1. FastAPI backend (VITE_API_URL, default http://localhost:8000)
//   2. contracts/data/catalogo_limpio.json   (final dataset from Person 2)
//   3. contracts/data/mock_catalogo.json    (always-available fallback)
//
// The contract files are read as raw text (not JSON-imported) so that a UTF-8
// BOM — which the current mock file has — never breaks parsing.

// Vite resolves this at build time; files that do not exist yet are simply absent.
const contractFiles = import.meta.glob('../../contracts/data/*.json', {
  query: '?raw',
  import: 'default',
})

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const API_PATHS = ['/investigations', '/api/investigations']
const API_TIMEOUT_MS = 1500

// ── Enums (mirror contracts/types.ts) ─────────────────────────────────────────
export const PROJECT_TYPES = [
  'Microgravity Investigation',
  'Reduced Gravity Investigation',
  'Ground Investigation',
]
export const SAFETY_PILLARS = ['Prevention', 'Detection', 'Suppression']
export const HARDWARE_RACKS = ['CIR-ACME', 'CIR-MDCA', 'MSG-SPICE', 'Saffire', 'Ground-CFD', 'Other']
export const FUEL_PHASES = ['Solid', 'Liquid_Droplet', 'Gaseous', 'Multi-phase']
export const GRAVITY_REGIMES = ['0g_microgravity', 'partial_g_proxy', '1g_ground_reference']

export const FUEL_PHASE_LABELS = {
  Solid: 'Solid',
  Liquid_Droplet: 'Liquid droplet',
  Gaseous: 'Gaseous',
  'Multi-phase': 'Multi-phase',
}
export const GRAVITY_REGIME_LABELS = {
  '0g_microgravity': '0g microgravity',
  partial_g_proxy: 'Partial-g proxy',
  '1g_ground_reference': '1g ground reference',
}
export const RACK_LABELS = {
  'CIR-ACME': 'CIR · ACME (gaseous flames)',
  'CIR-MDCA': 'CIR · MDCA (liquid droplets)',
  'MSG-SPICE': 'MSG · SPICE (forced-flow duct)',
  Saffire: 'Saffire (large-scale, Cygnus)',
  'Ground-CFD': 'Ground / CFD reference',
  Other: 'Other',
}

// ── Domain constants (CLAUDE.md §3) ───────────────────────────────────────────
export const LUNAR_TARGET = { o2MinPct: 30, pressureMaxPsi: 10.2 }
export const EARTH_ATM = { o2: 21, pressure: 14.7 }
export const EVA_SUIT = { o2: 100, pressure: 4.3 }
export const PSI_O2_TEST_LIMIT = 85

export const SLIDER_LIMITS = {
  o2: { min: 21, max: 85, step: 1 },
  pressure: { min: 4.3, max: 14.7, step: 0.1 },
  airflow: { min: 0, max: 30, step: 0.5 },
}

export const GRAVITY_LEVELS = [
  { value: 0, short: '0g', name: 'Microgravity (orbit)' },
  { value: 0.16, short: '0.16g', name: 'Moon (1/6g)' },
  { value: 0.38, short: '0.38g', name: 'Mars (3/8g)' },
  { value: 1, short: '1.0g', name: 'Earth' },
]

/** 3D viewport modes. */
export const VIEW_MODES = {
  cabin: { id: 'cabin', label: 'Spacecraft Cabin (0g)', short: 'Cabin' },
  habitat: { id: 'habitat', label: 'Planetary Habitat (1/6g – 3/8g)', short: 'Habitat' },
  chamber: { id: 'chamber', label: 'Combustion Chamber Flame (CIR/MSG)', short: 'Flame' },
}

/**
 * Quick mission presets. Airflow values are simulator defaults chosen for the
 * visualization (not PSI measurements) and are labelled as such in the UI.
 */
export const MISSION_PRESETS = [
  {
    id: 'iss',
    name: 'ISS Cabin',
    detail: '21% O₂ · 14.7 psi · 0g',
    params: { o2: 21, pressure: 14.7, airflow: 8, gravity: 0 },
    mode: 'cabin',
  },
  {
    id: 'lunar',
    name: 'Lunar Base / Rover',
    detail: '32% O₂ · 8.2 psi · 1/6g',
    params: { o2: 32, pressure: 8.2, airflow: 5, gravity: 0.16 },
    mode: 'habitat',
  },
  {
    id: 'mars',
    name: 'Mars Habitat',
    detail: '34% O₂ · 8.0 psi · 3/8g',
    params: { o2: 34, pressure: 8.0, airflow: 5, gravity: 0.38 },
    mode: 'habitat',
  },
  {
    id: 'eva',
    name: 'Spacesuit Pre-Breathe',
    detail: '100% O₂ capped at 85% (PSI limit) · 4.3 psi',
    params: { o2: 85, pressure: 4.3, airflow: 2, gravity: 0 },
    mode: 'cabin',
  },
  {
    id: 'cfig',
    name: 'Extreme CFI-G',
    detail: '85% O₂ · inverted flame regime',
    params: { o2: 85, pressure: 14.7, airflow: 0, gravity: 0 },
    mode: 'chamber',
  },
]

export const DEFAULT_PARAMS = MISSION_PRESETS[0].params

// ── Normalization ─────────────────────────────────────────────────────────────
function toNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toStrArray(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

function toStrOrNull(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Coerce one raw record into the PSIInvestigation shape. Returns null if unusable. */
export function normalizeInvestigation(raw) {
  if (!raw || typeof raw !== 'object' || !raw.psi_id) return null
  const env = raw.envelope || {}
  return {
    psi_id: String(raw.psi_id).trim(),
    title: toStrOrNull(raw.title) || String(raw.psi_id),
    psi_url: toStrOrNull(raw.psi_url),
    doi_citation: toStrOrNull(raw.doi_citation),
    objectives: toStrOrNull(raw.objectives),
    approach: toStrOrNull(raw.approach),
    project_type: pickEnum(raw.project_type, PROJECT_TYPES, 'Microgravity Investigation'),
    safety_pillars: toStrArray(raw.safety_pillars).filter((p) => SAFETY_PILLARS.includes(p)),
    hardware_rack: pickEnum(raw.hardware_rack, HARDWARE_RACKS, 'Other'),
    fuel_phase: pickEnum(raw.fuel_phase, FUEL_PHASES, 'Multi-phase'),
    fuels_tested: toStrArray(raw.fuels_tested),
    envelope: {
      o2_min_pct: toNum(env.o2_min_pct),
      o2_max_pct: toNum(env.o2_max_pct),
      pressure_min_psi: toNum(env.pressure_min_psi),
      pressure_max_psi: toNum(env.pressure_max_psi),
      airflow_min_cms: toNum(env.airflow_min_cms),
      airflow_max_cms: toNum(env.airflow_max_cms),
      gravity_regime: pickEnum(env.gravity_regime, GRAVITY_REGIMES, '0g_microgravity'),
    },
    lunar_habitat_relevant: Boolean(raw.lunar_habitat_relevant),
    sensors_used: toStrArray(raw.sensors_used),
    variables_compared: toStrOrNull(raw.variables_compared),
    key_findings_summary: toStrOrNull(raw.key_findings_summary),
    earth_spinoff_applications: toStrArray(raw.earth_spinoff_applications),
    related_psi_ids: toStrArray(raw.related_psi_ids),
    video_filename: toStrOrNull(raw.video_filename),
  }
}

function parseJsonText(text) {
  return JSON.parse(String(text).replace(/^﻿/, ''))
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.investigations)) return payload.investigations
  if (payload && Array.isArray(payload.items)) return payload.items
  return null
}

function normalizeList(payload) {
  const list = extractList(payload)
  if (!list) return []
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const inv = normalizeInvestigation(raw)
    if (inv && !seen.has(inv.psi_id)) {
      seen.add(inv.psi_id)
      out.push(inv)
    }
  }
  return out
}

async function loadContractFile(name) {
  const key = Object.keys(contractFiles).find((k) => k.endsWith(`/${name}`))
  if (!key) return []
  try {
    return normalizeList(parseJsonText(await contractFiles[key]()))
  } catch (err) {
    console.warn(`[IGNIS-SI] Could not parse ${name}:`, err)
    return []
  }
}

async function loadFromBackend() {
  for (const path of API_PATHS) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
    try {
      const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal })
      if (!res.ok) continue
      const list = normalizeList(await res.json())
      if (list.length) return list
    } catch {
      // Backend not running — silently fall through to the static contracts.
    } finally {
      clearTimeout(timer)
    }
  }
  return []
}

/**
 * Load the catalog. Resolves to `{ investigations, source }` where `source`
 * is one of 'backend' | 'catalogo_limpio' | 'mock'.
 */
export async function loadInvestigations() {
  const backend = await loadFromBackend()
  if (backend.length) return { investigations: backend, source: 'backend' }

  const clean = await loadContractFile('catalogo_limpio.json')
  if (clean.length) return { investigations: clean, source: 'catalogo_limpio' }

  const mock = await loadContractFile('mock_catalogo.json')
  return { investigations: mock, source: 'mock' }
}

export const SOURCE_LABELS = {
  backend: { label: 'Live API', detail: `FastAPI backend · ${API_BASE}`, tone: 'emerald' },
  catalogo_limpio: { label: 'Clean catalog', detail: 'contracts/data/catalogo_limpio.json', tone: 'cyan' },
  mock: { label: 'Mock catalog', detail: 'contracts/data/mock_catalogo.json (fallback)', tone: 'amber' },
}

// ── CV telemetry (Person 3) — optional ───────────────────────────────────────
const telemetryFiles = import.meta.glob('../../contracts/data/cv_telemetry/*.json', {
  query: '?raw',
  import: 'default',
})

/** Find and parse a CV telemetry curve for an investigation, or null. */
export async function loadTelemetry(inv) {
  const keys = Object.keys(telemetryFiles)
  if (!keys.length) return null
  const id = inv.psi_id.toLowerCase().replace(/[^a-z0-9]/g, '')
  const stem = inv.video_filename ? inv.video_filename.replace(/\.[^.]+$/, '').toLowerCase() : null
  const key = keys.find((k) => {
    const file = k.split('/').pop().toLowerCase()
    return (stem && file.startsWith(stem)) || file.replace(/[^a-z0-9]/g, '').includes(id)
  })
  if (!key) return null
  try {
    const payload = parseJsonText(await telemetryFiles[key]())
    const points = Array.isArray(payload) ? payload : payload.points || payload.telemetry
    return Array.isArray(points) && points.length ? { file: key.split('/').pop(), points } : null
  } catch {
    return null
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────
export function formatRange(min, max, unit) {
  if (min == null && max == null) return 'n/a'
  if (min == null || max == null || min === max) return `${min ?? max} ${unit}`
  return `${min}–${max} ${unit}`
}

export function envelopeSummary(env) {
  return {
    o2: formatRange(env.o2_min_pct, env.o2_max_pct, '% O₂'),
    pressure: formatRange(env.pressure_min_psi, env.pressure_max_psi, 'psi'),
    airflow: formatRange(env.airflow_min_cms, env.airflow_max_cms, 'cm/s'),
    gravity: GRAVITY_REGIME_LABELS[env.gravity_regime],
  }
}

export function citationFor(inv) {
  return inv.doi_citation || `${inv.psi_id}: ${inv.title}. NASA Physical Sciences Informatics (PSI).${inv.psi_url ? ` ${inv.psi_url}` : ''}`
}

export function isLunarZone({ o2, pressure }) {
  return o2 >= LUNAR_TARGET.o2MinPct || pressure <= LUNAR_TARGET.pressureMaxPsi
}

export function gravityRegimeFor(g) {
  if (g <= 0.001) return '0g_microgravity'
  if (g >= 0.999) return '1g_ground_reference'
  return 'partial_g_proxy'
}

// ── Explainable match score ──────────────────────────────────────────────────
/** Visible, deterministic weights (sum = 1). */
export const SCORE_WEIGHTS = { o2: 0.35, pressure: 0.25, gravity: 0.25, airflow: 0.15 }

/**
 * How well each gravity regime informs each target gravity level.
 * 0g and 1g data *bound* partial gravity; E-FIELD proxies approximate it.
 */
export const GRAVITY_FIT = {
  '0g_microgravity': { 0: 1, 0.16: 0.6, 0.38: 0.5, 1: 0.15 },
  partial_g_proxy: { 0: 0.6, 0.16: 1, 0.38: 1, 1: 0.6 },
  '1g_ground_reference': { 0: 0.15, 0.16: 0.5, 0.38: 0.6, 1: 1 },
}

function axisFit(value, min, max, span) {
  if (min == null && max == null) return { score: 0.5, inside: false, unknown: true, dist: null }
  const lo = min ?? max
  const hi = max ?? min
  if (value >= lo - 1e-9 && value <= hi + 1e-9) return { score: 1, inside: true, unknown: false, dist: 0 }
  const dist = value < lo ? lo - value : value - hi
  return { score: Math.max(0, 1 - dist / (span * 0.5)), inside: false, unknown: false, dist }
}

/**
 * Score one investigation against the simulator parameters.
 * Returns { score (0-100), status, axes, reasons } — every number is traceable.
 */
export function scoreInvestigation(inv, { o2, pressure, airflow, gravity }) {
  const e = inv.envelope
  const axes = {
    o2: axisFit(o2, e.o2_min_pct, e.o2_max_pct, SLIDER_LIMITS.o2.max - SLIDER_LIMITS.o2.min),
    pressure: axisFit(pressure, e.pressure_min_psi, e.pressure_max_psi, SLIDER_LIMITS.pressure.max - SLIDER_LIMITS.pressure.min),
    airflow: axisFit(airflow, e.airflow_min_cms, e.airflow_max_cms, SLIDER_LIMITS.airflow.max - SLIDER_LIMITS.airflow.min),
  }
  const gFit = GRAVITY_FIT[e.gravity_regime]?.[gravity] ?? 0.5
  axes.gravity = { score: gFit, inside: gFit === 1, unknown: false, dist: null }

  const raw = Object.entries(SCORE_WEIGHTS).reduce((sum, [k, w]) => sum + w * axes[k].score, 0)
  const score = Math.round(raw * 100)

  const envInside = axes.o2.inside && axes.pressure.inside && axes.airflow.inside
  const partialTarget = gravity > 0 && gravity < 1
  let status
  if (envInside && axes.gravity.inside) status = 'covers'
  else if (envInside && partialTarget && e.gravity_regime !== 'partial_g_proxy') status = 'bounds'
  else if (score >= 50) status = 'partial'
  else status = 'outside'

  const reasons = []
  const label = { o2: 'O₂', pressure: 'Pressure', airflow: 'Airflow' }
  for (const k of ['o2', 'pressure', 'airflow']) {
    const a = axes[k]
    if (a.unknown) reasons.push(`${label[k]}: not reported (scored 50%)`)
    else if (a.inside) reasons.push(`${label[k]}: inside tested range`)
    else reasons.push(`${label[k]}: ${+a.dist.toFixed(1)} outside tested range`)
  }
  reasons.push(
    `Gravity: ${GRAVITY_REGIME_LABELS[e.gravity_regime]} → ${Math.round(gFit * 100)}% fit for ${gravity}g`,
  )
  return { score, status, axes, reasons }
}

export const STATUS_META = {
  covers: { label: 'Covers', tone: 'emerald', hint: 'Envelope contains all selected conditions.' },
  bounds: { label: 'Bounds', tone: 'cyan', hint: 'Envelope matches; result bounds the partial-g target from 0g or 1g.' },
  partial: { label: 'Partial', tone: 'amber', hint: 'Some conditions fall outside the tested envelope.' },
  outside: { label: 'Outside', tone: 'slate', hint: 'Mostly outside the tested envelope.' },
}

export function rankInvestigations(list, params) {
  return list
    .map((inv) => ({ inv, ...scoreInvestigation(inv, params) }))
    .sort((a, b) => b.score - a.score || Number(b.inv.lunar_habitat_relevant) - Number(a.inv.lunar_habitat_relevant))
}

// ── Heuristic hazard index (illustrative, deterministic) ─────────────────────
export function hazardLevel({ o2, pressure }) {
  if (o2 >= 40) return { level: 'critical', label: 'Critical', color: '#EF4444' }
  if (o2 >= LUNAR_TARGET.o2MinPct || (o2 > 21 && pressure <= LUNAR_TARGET.pressureMaxPsi))
    return { level: 'elevated', label: 'Elevated', color: '#F59E0B' }
  if (pressure <= LUNAR_TARGET.pressureMaxPsi) return { level: 'watch', label: 'Watch', color: '#38BDF8' }
  return { level: 'nominal', label: 'Nominal', color: '#10B981' }
}

/** Deterministic rule-based advisory strings for the current conditions. */
export function advisory({ o2, pressure, airflow, gravity }) {
  const out = []
  if (o2 >= LUNAR_TARGET.o2MinPct)
    out.push(`O₂ ≥ ${LUNAR_TARGET.o2MinPct}%: exploration-atmosphere regime — material flammability screening must be performed at this O₂ level, not at 21%.`)
  if (o2 >= 70)
    out.push('Near the PSI 85% O₂ test limit: inverse (inside-out) and cool-flame regimes observed in ACME CFI-G become relevant.')
  if (pressure <= LUNAR_TARGET.pressureMaxPsi)
    out.push(`Pressure ≤ ${LUNAR_TARGET.pressureMaxPsi} psi: reduced-pressure / elevated-O₂ cabin as targeted for lunar bases and pressurized rovers.`)
  if (gravity === 0 && airflow < 1)
    out.push('Quiescent 0g: no buoyant plume — smoke does not rise to ceiling detectors; detection relies on ventilation transport.')
  if (gravity === 0 && airflow >= 5)
    out.push('Forced ventilation in 0g sustains flames that would self-extinguish in still air — consider fan shutdown in fire response.')
  if (gravity > 0 && gravity < 1)
    out.push('Partial gravity: no direct flight data yet — results are bounded between 0g ISS data, 1g ground references and ACME E-FIELD proxies (PSI-22). LUCI and FM2 lunar data pending.')
  if (!out.length) out.push('Conditions resemble standard ISS cabin air; existing 0g fire-safety data apply directly.')
  return out
}

/** Flame regime label + supporting evidence for the procedural flame view. */
export function flameRegime({ o2, airflow, gravity }) {
  if (o2 >= 75) return { name: 'Inverse (inside-out) flame', ref: 'ACME CFI-G · PSI-159' }
  if (gravity === 0 && airflow < 1) return { name: 'Spherical diffusion flame (0g)', ref: 'ACME Flame Design · PSI-10' }
  if (gravity === 0) return { name: 'Forced-flow flame, tilted downstream', ref: 'SPICE / BASS-II · PSI-107, PSI-26' }
  if (gravity < 1) return { name: 'Partial-g buoyant flame (bounded)', ref: '0g ↔ 1g, E-FIELD proxy · PSI-22' }
  return { name: 'Buoyant teardrop flame (1g reference)', ref: 'Ground reference' }
}
