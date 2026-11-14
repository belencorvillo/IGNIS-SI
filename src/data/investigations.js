// ── IGNIS-SI  ·  Investigation data, match scoring & mission presets ─────────

/**
 * PSI investigation dataset — representative ACME / fire‑safety studies
 * that map to the parametric envelope controlled by the Mission Simulator.
 */
export const investigations = [
  {
    id: 'PSI-159',
    title: 'Flame Spread over Thin PMMA in Microgravity',
    rack: 'CIR-ACME',
    pillars: ['Prevention'],
    o2Range: [21, 40],
    pressureRange: [10.2, 14.7],
    gravityRange: [0, 0.01],
    airflowRange: [0, 10],
    doi: '10.1016/j.proci.2024.05.159',
    finding: 'Concurrent airflow accelerates spread rate 3× above quiescent μg baseline.',
  },
  {
    id: 'PSI-162',
    title: 'Smoke Particle Size Distribution in Reduced Gravity',
    rack: 'MSG-SDS',
    pillars: ['Detection'],
    o2Range: [21, 30],
    pressureRange: [10.2, 14.7],
    gravityRange: [0, 0.38],
    airflowRange: [0, 15],
    doi: '10.1016/j.combustflame.2024.162',
    finding: 'μg smoke aerosol peaks at 1.2 µm — 40% larger than 1-g reference.',
  },
  {
    id: 'PSI-175',
    title: 'CO₂ Suppression Effectiveness in Low-Pressure O₂ Enriched Atm.',
    rack: 'CIR-ACME',
    pillars: ['Suppression'],
    o2Range: [30, 85],
    pressureRange: [4.3, 10.2],
    airflowRange: [0, 20],
    gravityRange: [0, 0.16],
    doi: '10.1016/j.firesaf.2024.175',
    finding: 'CO₂ extinguishment time doubles when O₂ exceeds 40% at 8.0 psi.',
  },
  {
    id: 'PSI-180',
    title: 'Wire Insulation Flammability Mapping for Habitat Wiring',
    rack: 'CIR-ACME',
    pillars: ['Prevention', 'Detection'],
    o2Range: [21, 50],
    pressureRange: [8.0, 14.7],
    gravityRange: [0, 1],
    airflowRange: [0, 12],
    doi: '10.1016/j.proci.2025.01.180',
    finding: 'Kapton insulation self-extinguishes below 24% O₂ at 10.2 psi in μg.',
  },
  {
    id: 'PSI-184',
    title: 'Droplet Combustion of Surrogate Fuels — Cool Flame Regime',
    rack: 'CIR-FLEX',
    pillars: ['Prevention'],
    o2Range: [21, 40],
    pressureRange: [14.7, 14.7],
    gravityRange: [0, 0.01],
    airflowRange: [0, 5],
    doi: '10.1016/j.combustflame.2025.184',
    finding: 'Cool-flame radiative fraction drops to 5%, complicating IR detection.',
  },
  {
    id: 'PSI-191',
    title: 'Aerosol Transport in Lunar-g Forced Ventilation',
    rack: 'MSG-FLOW',
    pillars: ['Detection'],
    o2Range: [21, 40],
    pressureRange: [8.0, 10.2],
    gravityRange: [0.1, 0.2],
    airflowRange: [5, 25],
    doi: '10.1016/j.jaerosci.2025.191',
    finding: 'Lunar-g buoyancy + ventilation creates bimodal smoke plume with 25 cm dead-zone.',
  },
  {
    id: 'PSI-200',
    title: 'Water-Mist Suppression Dynamics in Microgravity',
    rack: 'CIR-ACME',
    pillars: ['Suppression'],
    o2Range: [21, 50],
    pressureRange: [10.2, 14.7],
    gravityRange: [0, 0.01],
    airflowRange: [0, 10],
    doi: '10.1016/j.proci.2025.06.200',
    finding: 'Mist droplets stall near flame in μg; forced airflow essential for delivery.',
  },
  {
    id: 'PSI-207',
    title: 'Solid Surface Ignition Probability under EVA Atmosphere',
    rack: 'CIR-ACME',
    pillars: ['Prevention', 'Suppression'],
    o2Range: [60, 85],
    pressureRange: [4.3, 6.0],
    gravityRange: [0, 0.38],
    airflowRange: [0, 5],
    doi: '10.1016/j.firesaf.2025.207',
    finding: 'Ignition probability rises 6× at 85% O₂ / 4.3 psi vs. sea-level air.',
  },
]

/**
 * Compute a 0–100 match score between an investigation and the active
 * simulator parameters + safety-pillar filter.
 */
export function computeMatchScore(inv, { o2, pressure, gravity, airflow, pillar }) {
  // Pillar filter — hard gate
  if (pillar && pillar !== 'All') {
    const pillarRoot = pillar.split(' ')[0] // "Prevention (Materials)" → "Prevention"
    if (!inv.pillars.includes(pillarRoot)) return 0
  }

  const inRange = (val, [lo, hi]) => {
    if (val >= lo && val <= hi) return 1
    const dist = val < lo ? lo - val : val - hi
    const span = hi - lo || 1
    return Math.max(0, 1 - dist / span)
  }

  const scores = [
    inRange(o2, inv.o2Range),
    inRange(pressure, inv.pressureRange),
    inRange(gravity, inv.gravityRange),
    inRange(airflow, inv.airflowRange),
  ]

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return Math.round(avg * 100)
}

// ── IGNIS-SI  ·  Investigation helpers & mission presets ──────────────────────

/**
 * Mission presets used by the LeftPanel quick-select cards.
 * Each preset defines nominal environment parameters and metadata.
 */
export const missionPresets = [
  {
    id: 'iss',
    name: 'ISS Microgravity (CIR)',
    o2: 21,
    pressure: 14.7,
    gravity: 0.0,
    airflow: 5,
    badge: null,
  },
  {
    id: 'lunar',
    name: 'Lunar Habitat (Artemis)',
    o2: 30,
    pressure: 10.2,
    gravity: 0.16,
    airflow: 10,
    badge: 'Elevated O₂',
  },
  {
    id: 'mars',
    name: 'Mars Transit Vehicle',
    o2: 26,
    pressure: 10.2,
    gravity: 0.0,
    airflow: 8,
    badge: null,
  },
  {
    id: 'eva',
    name: 'EVA Suit (xEMU)',
    o2: 85,
    pressure: 4.3,
    gravity: 0.16,
    airflow: 2,
    badge: 'High O₂ ⚠',
  },
]

// ── Flame / combustion analysis helpers ──────────────────────────────────────

/**
 * Return a human-readable flame regime label for the given parameters.
 */
export function getFlameRegime({ gravity, airflow, o2 }) {
  if (gravity < 0.01 && airflow < 1) return 'Diffusion · Spherical'
  if (gravity < 0.01 && airflow >= 1) return 'Forced-Flow · Elongated'
  if (gravity >= 0.01 && gravity < 0.3) return 'Low-g Buoyant · Teardrop'
  if (o2 > 50) return 'O₂-Enriched · Intense'
  return 'Buoyant · Normal Gravity'
}

/**
 * Return the equivalent ISS rack for the current parameter set.
 */
export function getActiveRack({ gravity, airflow }) {
  if (gravity < 0.01 && airflow < 3) return 'CIR (Combustion Integrated Rack)'
  if (gravity < 0.01) return 'MSG (Microgravity Science Glovebox)'
  return 'Ground Analog'
}

/**
 * Estimate a soot index (0 – 10) based on oxygen and airflow.
 * Higher O₂ or lower airflow → more soot.
 */
export function getSootIndex({ o2, airflow }) {
  const base = Math.min(10, Math.max(0, (o2 - 21) / 6.4))
  const flowFactor = Math.max(0, 1 - airflow / 30)
  return Math.round((base * 0.6 + flowFactor * 4) * 10) / 10
}

/**
 * Convection / diffusion ratio.  Pure diffusion → 0, pure convection → ∞.
 */
export function getConvDiffRatio({ gravity, airflow }) {
  const buoyancy = gravity * 9.81
  const forced = airflow / 100 // m/s
  const ratio = (buoyancy + forced * 10) / (0.2 + 0.001) // normalised
  return Math.round(ratio * 100) / 100
}

// ── Flammability risk & advisory (used by RightPanel) ────────────────────────

/**
 * Compute a composite Flammability Risk Index (0 – 100) from the four
 * environmental parameters.  The model is a weighted heuristic inspired by
 * NASA-STD-6001B concepts:
 *   • O₂ concentration is the dominant driver (40 %)
 *   • Cabin pressure amplifies combustion (20 %)
 *   • Gravity reduction raises risk (25 %) — lower buoyancy means less
 *     natural convective quenching
 *   • Airflow can help or hurt (15 %) — moderate flow aids detection,
 *     high flow fans flames
 */
export function computeFlammabilityRisk(o2, pressure, gravity, airflow) {
  // Normalise each axis to 0-1
  const o2Norm = Math.min(1, Math.max(0, (o2 - 21) / (85 - 21)))
  const presNorm = Math.min(1, Math.max(0, (pressure - 4.3) / (14.7 - 4.3)))
  // Lower gravity → higher risk
  const gravNorm = 1 - Math.min(1, Math.max(0, gravity))
  // Airflow: risk peaks at high airflow, but zero airflow in 0g is also bad
  const flowNorm = Math.min(1, Math.max(0, airflow / 30))
  const flowRisk = gravity < 0.05
    ? 0.5 + 0.5 * (1 - flowNorm) // 0g: stagnant = worst
    : 0.3 + 0.7 * flowNorm       // 1g: more flow = more risk

  const raw =
    o2Norm   * 40 +
    presNorm * 20 +
    gravNorm * 25 +
    flowRisk * 15

  return Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10
}

/**
 * Map a numeric risk score to a { label, color } pair.
 */
export function getRiskLevel(score) {
  if (score >= 65)
    return { label: 'Critical Lunar Regime', color: '#EF4444' }
  if (score >= 40)
    return { label: 'Elevated',              color: '#F59E0B' }
  return   { label: 'Nominal',               color: '#10B981' }
}

/**
 * Return an array of actionable advisory strings based on the current
 * parameter combination and risk score.
 */
export function generateAdvisory(o2, pressure, gravity, airflow, riskScore) {
  const items = []

  if (o2 > 30)
    items.push('⚠️ O₂ exceeds 30 % — enforce NASA-STD-6001B material screening for all cabin contents.')
  if (o2 > 60)
    items.push('🔴 Extreme O₂ enrichment — restrict ignition sources, mandate Class-A materials only.')
  if (gravity < 0.05 && airflow < 3)
    items.push('🔵 Near-zero-g stagnant flow — flame detection via ionisation sensors recommended; smoke detectors may lag.')
  if (gravity >= 0.05 && gravity < 0.2)
    items.push('🟡 Partial-gravity regime — flame spread models un-validated; apply 0g upper-bound safety margins.')
  if (pressure < 8)
    items.push('ℹ️ Low cabin pressure — reduced convective cooling; monitor surface temperatures on electronics.')
  if (airflow > 20)
    items.push('⚠️ High ventilation rate — consider baffles to prevent flame-spread acceleration in corridors.')
  if (riskScore >= 65)
    items.push('🔴 Risk index critical — recommend immediate suppression system readiness check and crew drill.')
  if (riskScore < 40)
    items.push('✅ Parameters within nominal envelope — standard monitoring protocols sufficient.')
  if (items.length === 0)
    items.push('✅ All parameters within expected operational bounds.')

  return items
}
