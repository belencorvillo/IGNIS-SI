import { useState } from 'react'
import { Droplets, Globe2, HardHat, Radar } from 'lucide-react'
import { Badge, CitationBlock, PsiIdTag, SectionTitle } from './ui'

/**
 * Curated editorial context. These are general descriptions of terrestrial
 * applications, not data extracted from PSI records — linked investigations are
 * matched by safety pillar / hardware so users can explore the evidence.
 */
const SPINOFFS = [
  {
    id: 'mist',
    Icon: Droplets,
    title: 'Fine-Water-Mist Extinguishers',
    tone: 'violet',
    summary:
      'The ISS replaced its CO₂ portable extinguishers with fine-water-mist units. Droplet and diluent extinction studies inform how mist and inert gases quench flames — knowledge relevant to mist systems for buildings, ships, aircraft cabins and data centers, where less water and no toxic agent are desirable.',
    match: (i) => i.safety_pillars.includes('Suppression') && (i.fuel_phase === 'Liquid_Droplet' || /extingu|suppress/i.test(i.title)),
    matchLabel: 'Extinction & suppression studies',
  },
  {
    id: 'smoke',
    Icon: Radar,
    title: 'Smoke & Dust Sensors (SAME / DAFT)',
    tone: 'cyan',
    summary:
      'Smoke-aerosol (SAME) and dust-measurement (DAFT) experiments characterized particle sizes from overheated spacecraft materials. Understanding which particles a fire actually produces helps design detectors that respond faster and give fewer false alarms — including from dust — in homes and industry.',
    match: (i) => /\b(SAME|DAFT)\b|smoke|aerosol|dust/i.test(i.title),
    matchLabel: 'Smoke / aerosol / dust studies',
  },
  {
    id: 'gear',
    Icon: HardHat,
    title: 'Firefighter Protective Gear & Air Tanks',
    tone: 'amber',
    summary:
      'NASA fire-resistant materials work and lightweight composite pressure vessels have long been cited as contributions to firefighter breathing apparatus and protective clothing. Solid-material flammability data (flame spread, oxygen limits) remain the basis for selecting fabrics and plastics that resist ignition.',
    match: (i) => i.fuel_phase === 'Solid' || i.hardware_rack === 'Saffire',
    matchLabel: 'Solid-material flammability studies',
  },
]

const PREVIEW = 4

function LinkedEvidence({ linked, onOpenDetail }) {
  const [all, setAll] = useState(false)
  if (!linked.length) return <p className="text-xs text-slate-500">No matching investigations in the current catalog.</p>
  const shown = all ? linked : linked.slice(0, PREVIEW)
  return (
    <div className="space-y-2">
      {shown.map((inv) => (
        <div key={inv.psi_id} className="rounded-md border border-slate-700/60 p-2">
          <button onClick={() => onOpenDetail(inv)} className="mb-1.5 flex w-full items-center gap-2 text-left text-xs text-slate-200 hover:text-cyan-300">
            <PsiIdTag id={inv.psi_id} />
            <span className="line-clamp-1">{inv.title}</span>
          </button>
          <CitationBlock inv={inv} compact />
        </div>
      ))}
      {linked.length > PREVIEW && (
        <button onClick={() => setAll((v) => !v)} className="text-xs text-cyan-400 hover:underline">
          {all ? 'Show fewer' : `Show all ${linked.length}`}
        </button>
      )}
    </div>
  )
}

/** Group dataset-reported applications: application → investigations that report it. */
function groupApplications(investigations) {
  const map = new Map()
  for (const inv of investigations) {
    for (const app of inv.earth_spinoff_applications) {
      if (!map.has(app)) map.set(app, [])
      map.get(app).push(inv)
    }
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
}

export default function Spinoffs({ investigations, onOpenDetail }) {
  const groups = groupApplications(investigations)

  return (
    <div className="space-y-3 p-3">
      <div className="glass-panel p-5">
        <SectionTitle icon={Globe2}>Earth Fire Safety Spin-offs</SectionTitle>
        <p className="max-w-3xl text-sm text-slate-300">
          Microgravity removes buoyancy, exposing combustion physics that are hidden on Earth. The same insights feed back into terrestrial fire
          safety: suppression, detection and protective materials.
        </p>
        <p className="mt-2 text-[11px] text-amber-300/80">
          Editorial context — the descriptions below are general background, not values extracted from PSI records. Linked investigations are
          matched by safety pillar or fuel type; verify specific claims with the cited sources and NASA Spinoff publications.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {SPINOFFS.map((s) => {
          const linked = investigations.filter(s.match)
          return (
            <article key={s.id} className="glass-panel flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-slate-800 p-2">
                  <s.Icon size={20} className="text-cyan-300" />
                </span>
                <h3 className="heading-font text-base font-semibold text-white">{s.title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">{s.summary}</p>
              <div className="mt-auto">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Related evidence <Badge tone={s.tone}>{s.matchLabel}</Badge>
                </div>
                <LinkedEvidence linked={linked} onOpenDetail={onOpenDetail} />
              </div>
            </article>
          )
        })}
      </div>

      <div className="glass-panel p-5">
        <SectionTitle icon={Globe2}>Spin-off Applications Reported in the Dataset</SectionTitle>
        {groups.length ? (
          <>
            <p className="mb-3 text-[11px] text-slate-400">
              Applications listed in the <span className="mono">earth_spinoff_applications</span> field of the active catalog, grouped by
              application. Click a PSI ID to open the investigation and its citation.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {groups.map(([app, invs]) => (
                <div key={app} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-slate-100">{app}</span>
                    <Badge tone="cyan">{invs.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {invs.map((inv) => (
                      <button key={inv.psi_id} onClick={() => onOpenDetail(inv)} title={inv.title} className="hover:opacity-80">
                        <PsiIdTag id={inv.psi_id} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            The active catalog has no <span className="mono">earth_spinoff_applications</span> entries yet. They will appear here automatically when
            the backend / catalogo_limpio.json provides them.
          </p>
        )}
      </div>
    </div>
  )
}
