// ── IGNIS · On Earth page content ──────────────────────────────────────────
// Edit the text of the spin-off blocks here; layout lives in EarthPage.jsx.
// `match` decides which investigations are listed as evidence for each block.

/**
 * Curated editorial context — general descriptions of terrestrial applications,
 * not data extracted from PSI records. Linked investigations are matched by
 * pillar / fuel / title so users can explore the evidence.
 */
export const SPINOFFS = [
  {
    id: 'mist',
    title: 'Fine water mist',
    lede: 'Less water, no toxic agent.',
    body: 'The ISS replaced its CO₂ portable extinguishers with fine-water-mist units. Droplet and diluent extinction studies inform how mist and inert gases quench flames — relevant to mist systems for buildings, ships, aircraft cabins and data centres.',
    match: (i) => i.safety_pillars.includes('Suppression') && (i.fuel_phase === 'Liquid_Droplet' || /extingu|suppress/i.test(i.title)),
  },
  {
    id: 'smoke',
    title: 'Smarter smoke sensors',
    lede: 'Fewer false alarms from dust.',
    body: 'Smoke-aerosol (SAME) and dust-measurement (DAFT) experiments characterised the particles overheated spacecraft materials release. Knowing what a real fire emits helps detectors respond faster and tell smoke from dust — at home and in industry.',
    match: (i) => /\b(SAME|DAFT)\b|smoke|aerosol|dust/i.test(i.title),
  },
  {
    id: 'gear',
    title: 'Firefighter gear',
    lede: 'Materials that refuse to burn.',
    body: 'NASA fire-resistant materials work and lightweight composite pressure vessels are often cited as contributions to firefighter breathing apparatus and protective clothing. Solid-material flammability data — flame spread, oxygen limits — remain the basis for choosing fabrics and plastics.',
    match: (i) => i.fuel_phase === 'Solid' || i.hardware_rack === 'Saffire',
  },
]
