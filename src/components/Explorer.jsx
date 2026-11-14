import { useMemo, useState } from 'react'
import { Columns3, FilterX, Search } from 'lucide-react'
import { Badge, CitationBlock, LunarBadge, PillarBadge, PsiIdTag, SIBadge } from './ui'
import {
  FUEL_PHASES,
  FUEL_PHASE_LABELS,
  HARDWARE_RACKS,
  PROJECT_TYPES,
  RACK_LABELS,
  SAFETY_PILLARS,
  envelopeSummary,
} from '../data/investigations'
import { searchScore } from '../data/search'

const MAX_COMPARE = 4

function Select({ label, value, onChange, options, render = (o) => o }) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-400/60"
      >
        <option value="All">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {render(o)}
          </option>
        ))}
      </select>
    </label>
  )
}

function InvestigationCard({ inv, selected, onToggle, onOpen, canSelect }) {
  const env = envelopeSummary(inv.envelope)
  return (
    <article className={`inv-card flex flex-col gap-2 rounded-xl border bg-slate-900/50 p-4 ${selected ? 'border-cyan-400/60' : 'border-slate-700/60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <PsiIdTag id={inv.psi_id} />
          <Badge tone={inv.project_type === 'Ground Investigation' ? 'slate' : 'cyan'}>{inv.project_type.replace(' Investigation', '')}</Badge>
          {inv.lunar_habitat_relevant && <LunarBadge />}
        </div>
        <label className={`flex items-center gap-1 text-[11px] ${canSelect || selected ? 'cursor-pointer text-slate-300' : 'text-slate-600'}`}>
          <input type="checkbox" checked={selected} disabled={!canSelect && !selected} onChange={() => onToggle(inv.psi_id)} className="accent-cyan-400" />
          Compare
        </label>
      </div>
      <button onClick={() => onOpen(inv)} className="text-left text-sm font-semibold leading-snug text-slate-100 hover:text-cyan-300">
        {inv.title}
      </button>
      {inv.objectives && <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">{inv.objectives}</p>}
      {inv.key_findings_summary && (
        <div className="rounded-md bg-fuchsia-500/5 p-2">
          <SIBadge />
          <p className="mt-1 line-clamp-2 text-xs text-slate-300">{inv.key_findings_summary}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {inv.safety_pillars.map((p) => (
          <PillarBadge key={p} pillar={p} />
        ))}
        <Badge>{inv.hardware_rack}</Badge>
        <Badge>{FUEL_PHASE_LABELS[inv.fuel_phase]}</Badge>
      </div>
      <div className="mono grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
        <span>{env.o2}</span>
        <span>{env.pressure}</span>
        <span>{env.airflow}</span>
        <span>{env.gravity}</span>
      </div>
      <div className="mt-auto pt-1">
        <CitationBlock inv={inv} compact />
      </div>
    </article>
  )
}

export default function Explorer({ investigations, onOpenDetail, onCompare }) {
  const [query, setQuery] = useState('')
  const [pillars, setPillars] = useState([])
  const [rack, setRack] = useState('All')
  const [fuel, setFuel] = useState('All')
  const [ptype, setPtype] = useState('All')
  const [lunarOnly, setLunarOnly] = useState(false)
  const [selected, setSelected] = useState([])

  const results = useMemo(() => {
    return investigations
      .filter((inv) => !pillars.length || pillars.every((p) => inv.safety_pillars.includes(p)))
      .filter((inv) => rack === 'All' || inv.hardware_rack === rack)
      .filter((inv) => fuel === 'All' || inv.fuel_phase === fuel)
      .filter((inv) => ptype === 'All' || inv.project_type === ptype)
      .filter((inv) => !lunarOnly || inv.lunar_habitat_relevant)
      .map((inv) => ({ inv, rel: searchScore(inv, query) }))
      .filter((r) => r.rel > 0)
      .sort((a, b) => b.rel - a.rel)
      .map((r) => r.inv)
  }, [investigations, query, pillars, rack, fuel, ptype, lunarOnly])

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_COMPARE ? [...s, id] : s))
  const togglePillar = (p) => setPillars((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))
  const reset = () => {
    setQuery('')
    setPillars([])
    setRack('All')
    setFuel('All')
    setPtype('All')
    setLunarOnly(false)
  }

  return (
    <div className="space-y-3 p-3">
      <div className="glass-panel space-y-3 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Semantic search — e.g. “droplet extinction with CO2”, “smoke detection”, “lunar oxygen-enriched”"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/70 py-2.5 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Safety pillars</span>
            <div className="flex gap-1">
              {SAFETY_PILLARS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePillar(p)}
                  className={`pillar-pill rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 ${pillars.includes(p) ? 'active' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Select label="Hardware rack" value={rack} onChange={setRack} options={HARDWARE_RACKS} render={(o) => RACK_LABELS[o]} />
          <Select label="Fuel phase" value={fuel} onChange={setFuel} options={FUEL_PHASES} render={(o) => FUEL_PHASE_LABELS[o]} />
          <Select label="Project type" value={ptype} onChange={setPtype} options={PROJECT_TYPES} />
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-slate-300">
            <input type="checkbox" checked={lunarOnly} onChange={(e) => setLunarOnly(e.target.checked)} className="accent-amber-400" />
            Lunar-relevant only
          </label>
          <button onClick={reset} className="flex items-center gap-1 pb-1.5 text-xs text-slate-400 hover:text-white">
            <FilterX size={13} /> Reset
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          Search runs locally with domain-synonym expansion (e.g. “smoke” also matches detection / aerosol studies). Results ranked by field relevance.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-xs text-slate-400">
          {results.length} of {investigations.length} investigations
        </span>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} className="text-xs text-slate-400 hover:text-white">
              Clear selection
            </button>
          )}
          <button
            disabled={selected.length < 2}
            onClick={() => onCompare(selected)}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <Columns3 size={14} /> Compare Investigations ({selected.length}/{MAX_COMPARE})
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {results.map((inv) => (
          <InvestigationCard
            key={inv.psi_id}
            inv={inv}
            selected={selected.includes(inv.psi_id)}
            canSelect={selected.length < MAX_COMPARE}
            onToggle={toggle}
            onOpen={onOpenDetail}
          />
        ))}
      </div>
      {!results.length && <div className="glass-panel p-8 text-center text-sm text-slate-400">No investigations match these filters.</div>}
    </div>
  )
}
