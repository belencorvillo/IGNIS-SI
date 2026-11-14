import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button, CiteInline, PsiId, SectionHead, Segmented } from '../../shared/ui'
import { FUEL_PHASES, FUEL_PHASE_LABELS, HARDWARE_RACKS, RACK_LABELS, SAFETY_PILLARS, envelopeSummary } from '../../shared/catalog'
import { searchScore } from './search'
import CompareModal from './CompareModal'

const MAX_COMPARE = 4

function Select({ label, value, onChange, options, render = (o) => o }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] text-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-full border border-line-strong bg-ground px-4 text-[14px] text-ink outline-none transition-colors hover:border-ink focus-visible:border-nasa-red"
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

function Row({ inv, selected, canSelect, onToggle, onOpen }) {
  const env = envelopeSummary(inv.envelope)
  return (
    <li className={`group grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-b border-line py-6 md:grid-cols-[96px_1fr_220px_48px] ${selected ? 'bg-raised/40' : ''}`}>
      <PsiId id={inv.psi_id} className="hidden pt-0.5 md:block" />
      <div className="min-w-0">
        <button type="button" onClick={() => onOpen(inv)} className="text-left text-[17px] leading-snug text-ink hover:underline hover:decoration-nasa-red hover:underline-offset-4">
          <span className="num mr-2 text-[13px] md:hidden">{inv.psi_id}</span>
          {inv.title}
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-faint">
          <span>{inv.safety_pillars.join(' · ')}</span>
          <span aria-hidden="true">/</span>
          <span>{FUEL_PHASE_LABELS[inv.fuel_phase]}</span>
          <span aria-hidden="true">/</span>
          <span>{inv.project_type.replace(' Investigation', '')}</span>
          <CiteInline inv={inv} />
        </div>
      </div>
      <div className="num col-span-2 grid grid-cols-3 gap-2 text-[13px] text-muted md:col-span-1 md:grid-cols-1 md:gap-0.5">
        <span>{env.o2}</span>
        <span>{env.pressure}</span>
        <span className="text-faint">{env.gravity}</span>
      </div>
      <label className="col-start-2 row-start-1 flex h-11 w-11 cursor-pointer items-center justify-center md:col-start-4" title={selected ? 'Remove from comparison' : 'Add to comparison'}>
        <input
          type="checkbox"
          checked={selected}
          disabled={!canSelect && !selected}
          onChange={() => onToggle(inv.psi_id)}
          aria-label={`Compare ${inv.psi_id}`}
          className="h-4 w-4 accent-[#fc3d21]"
        />
      </label>
    </li>
  )
}

export default function LibraryPage({ investigations, onOpenDetail }) {
  const [query, setQuery] = useState('')
  const [pillar, setPillar] = useState('All')
  const [rack, setRack] = useState('All')
  const [fuel, setFuel] = useState('All')
  const [scope, setScope] = useState('All')
  const [selected, setSelected] = useState([])
  const [comparing, setComparing] = useState(false)
  const compareItems = useMemo(() => selected.map((id) => investigations.find((i) => i.psi_id === id)).filter(Boolean), [selected, investigations])

  const results = useMemo(
    () =>
      investigations
        .filter((i) => pillar === 'All' || i.safety_pillars.includes(pillar))
        .filter((i) => rack === 'All' || i.hardware_rack === rack)
        .filter((i) => fuel === 'All' || i.fuel_phase === fuel)
        .filter((i) => scope === 'All' || (scope === 'Ground' ? i.project_type === 'Ground Investigation' : i.project_type !== 'Ground Investigation'))
        .map((inv) => ({ inv, rel: searchScore(inv, query) }))
        .filter((r) => r.rel > 0)
        .sort((a, b) => b.rel - a.rel)
        .map((r) => r.inv),
    [investigations, query, pillar, rack, fuel, scope],
  )

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_COMPARE ? [...s, id] : s))
  const filtered = query || pillar !== 'All' || rack !== 'All' || fuel !== 'All' || scope !== 'All'
  const reset = () => {
    setQuery('')
    setPillar('All')
    setRack('All')
    setFuel('All')
    setScope('All')
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-40 pt-16 md:px-8 md:pt-24">
      <SectionHead index="Library" title="Microgravity combustion, catalogued">
        Every investigation in the active PSI catalog. Search in plain words, or narrow by safety pillar.
      </SectionHead>

      <div className="relative mb-6">
        <Search size={20} className="absolute left-0 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “droplet extinction” or “smoke detection”…"
          aria-label="Search investigations"
          spellCheck={false}
          className="h-16 w-full border-b border-line-strong bg-transparent pl-9 pr-4 font-display text-[clamp(20px,2.4vw,28px)] font-light text-ink outline-none placeholder:text-faint focus-visible:border-nasa-red"
        />
      </div>

      <div className="mb-10 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-faint">Pillar</span>
          <Segmented label="Safety pillar" size="sm" value={pillar} onChange={setPillar} options={['All', ...SAFETY_PILLARS].map((p) => ({ value: p, label: p }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-faint">Where</span>
          <Segmented
            label="Flight or ground"
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'All', label: 'All' },
              { value: 'Flight', label: 'In orbit' },
              { value: 'Ground', label: 'Ground' },
            ]}
          />
        </div>
        <Select label="Hardware" value={rack} onChange={setRack} options={HARDWARE_RACKS} render={(o) => RACK_LABELS[o].split(' (')[0]} />
        <Select label="Fuel" value={fuel} onChange={setFuel} options={FUEL_PHASES} render={(o) => FUEL_PHASE_LABELS[o]} />
        {filtered && (
          <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-1 text-[14px] text-muted hover:text-ink">
            <X size={14} aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      <div className="label mb-2" aria-live="polite">
        {results.length} of {investigations.length}
      </div>
      <ol className="border-t border-line">
        {results.map((inv) => (
          <Row key={inv.psi_id} inv={inv} selected={selected.includes(inv.psi_id)} canSelect={selected.length < MAX_COMPARE} onToggle={toggle} onOpen={onOpenDetail} />
        ))}
      </ol>
      {!results.length && (
        <p className="py-16 text-muted">
          Nothing matches.{' '}
          <button type="button" onClick={reset} className="link">
            Clear filters
          </button>
        </p>
      )}

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="num text-[14px] text-ink">{selected.join(' · ')}</span>
              <button type="button" onClick={() => setSelected([])} className="text-[14px] text-faint hover:text-ink">
                Clear
              </button>
            </div>
            <Button variant="primary" disabled={selected.length < 2} onClick={() => setComparing(true)}>
              {selected.length < 2 ? 'Pick one more to compare' : `Compare ${selected.length}`}
            </Button>
          </div>
        </div>
      )}
      <CompareModal open={comparing && compareItems.length >= 2} onClose={() => setComparing(false)} items={compareItems} />
    </div>
  )
}
