import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Sparkles } from 'lucide-react'
import { Button, CiteInline, PsiId, SectionHead, Segmented } from '../../shared/ui'
import { FUEL_PHASES, FUEL_PHASE_LABELS, HARDWARE_RACKS, RACK_LABELS, SAFETY_PILLARS, envelopeSummary } from '../../shared/catalog'
import CompareModal from './CompareModal'
import { getYoloVideo } from '../../shared/yoloVideos'

const MAX_COMPARE = 4

const THINKING_STEPS = [
  'Analyzing semantic intent of your query...',
  'Computing embeddings and vector similarity across PSI...',
  'Correlating experiments and raw files in the knowledge graph...',
]

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
  const media = getYoloVideo(inv.psi_id)
  const mediaLabel = media ? (media.isImage ? 'Photo' : 'Video') : inv.video_filename ? 'Video' : null

  return (
    <li className={`group grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-b border-line py-6 md:grid-cols-[96px_1fr_220px_48px] ${selected ? 'bg-raised/40' : ''}`}>
      <PsiId id={inv.psi_id} className="hidden pt-0.5 md:block" />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => onOpen(inv)}
          className="text-left text-[17px] leading-snug text-ink hover:underline hover:decoration-nasa-red hover:underline-offset-4"
        >
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
          {mediaLabel && (
            <span className="rounded-full border border-[#fc3d21]/40 bg-[#fc3d21]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#fc3d21]">
              {mediaLabel}
            </span>
          )}
        </div>
      </div>
      <div className="num col-span-2 grid grid-cols-3 gap-2 text-[13px] text-muted md:col-span-1 md:grid-cols-1 md:gap-0.5">
        <span>{env.o2}</span>
        <span>{env.pressure}</span>
        <span className="text-faint">{env.gravity}</span>
      </div>
      <label
        className="col-start-2 row-start-1 flex h-11 w-11 cursor-pointer items-center justify-center md:col-start-4"
        title={selected ? 'Remove from comparison' : 'Add to comparison'}
      >
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

function OllamaThinkingIndicator() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % THINKING_STEPS.length)
    }, 1100)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-line-strong bg-raised/75 px-4 py-3.5 backdrop-blur-md transition-all"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#fc3d21]/30 bg-[#fc3d21]/10 text-[#fc3d21]">
          <Sparkles size={16} className="animate-pulse" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-[#fc3d21]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <span>Reasoning semantic search</span>
            <span className="inline-flex items-center gap-1 pt-1">
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#fc3d21] [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#fc3d21] [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-[#fc3d21]" />
            </span>
          </div>
          <p className="truncate text-[12px] text-muted transition-opacity duration-300">
            {THINKING_STEPS[stepIndex]}
          </p>
        </div>
      </div>
      <span className="hidden shrink-0 rounded-full border border-line-strong bg-ground px-2.5 py-1 font-mono text-[11px] text-faint sm:inline-block">
        OLLAMA · PSI
      </span>
    </div>
  )
}

export default function LibraryPage({ investigations, onOpenDetail }) {
  const [inputQuery, setInputQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [ollamaData, setOllamaData] = useState(null)
  const [isSearching, setIsSearching] = useState(false)

  const [pillar, setPillar] = useState('All')
  const [rack, setRack] = useState('All')
  const [fuel, setFuel] = useState('All')
  const [scope, setScope] = useState('All')
  const [selected, setSelected] = useState([])
  const [comparing, setComparing] = useState(false)

  const iframeRef = useRef(null)
  const abortControllerRef = useRef(null)

  const compareItems = useMemo(
    () => selected.map((id) => investigations.find((i) => i.psi_id === id)).filter(Boolean),
    [selected, investigations]
  )

  const syncGraphHighlight = useCallback((data) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return

    if (!data || !data.files?.length) {
      win.postMessage({ type: 'RESET_HIGHLIGHT' }, '*')
      return
    }

    const nodeIds = data.files.map((f) => String(f[0]))
    const scores = Object.fromEntries(data.files.map((f) => [String(f[0]), f[4]]))

    win.postMessage(
      {
        type: 'HIGHLIGHT_NODES',
        nodeIds,
        scores,
      },
      '*'
    )
  }, [])

  useEffect(() => {
    syncGraphHighlight(ollamaData)
  }, [ollamaData, syncGraphHighlight])

  const cancelOrClearSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsSearching(false)
    setInputQuery('')
    setActiveQuery('')
    setOllamaData(null)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    const trimmed = inputQuery.trim()

    if (!trimmed) {
      cancelOrClearSearch()
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setActiveQuery(trimmed)
    setIsSearching(true)
    setOllamaData(null)

    try {
      const res = await fetch(`http://localhost:8000/buscar?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
      const data = await res.json()
      if (!controller.signal.aborted) {
        setOllamaData(data)
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error connecting to Ollama FastAPI:', error)
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
        setIsSearching(false)
      }
    }
  }

  const results = useMemo(() => {
    let filtered = investigations
      .filter((i) => pillar === 'All' || i.safety_pillars.includes(pillar))
      .filter((i) => rack === 'All' || i.hardware_rack === rack)
      .filter((i) => fuel === 'All' || i.fuel_phase === fuel)
      .filter((i) => scope === 'All' || (scope === 'Ground' ? i.project_type === 'Ground Investigation' : i.project_type !== 'Ground Investigation'))

    if (activeQuery) {
      if (!ollamaData) return []
      const scores = new Map(ollamaData.experiments.map((e) => [e[0], e[4]]))
      filtered = filtered
        .filter((inv) => scores.has(inv.psi_id))
        .sort((a, b) => scores.get(b.psi_id) - scores.get(a.psi_id))
    }

    return filtered
  }, [investigations, activeQuery, pillar, rack, fuel, scope, ollamaData])

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_COMPARE ? [...s, id] : s))

  const hasActiveSearch = Boolean(inputQuery || activeQuery || isSearching)
  const filteredUI = hasActiveSearch || pillar !== 'All' || rack !== 'All' || fuel !== 'All' || scope !== 'All'
  const isSearchCompleted = Boolean(activeQuery && ollamaData && !isSearching)

  const reset = () => {
    cancelOrClearSearch()
    setPillar('All')
    setRack('All')
    setFuel('All')
    setScope('All')
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-40 pt-16 md:px-8 md:pt-24">
      <SectionHead index="Library" title="Microgravity combustion, catalogued">
        Semantic search powered by NASA PSI Ollama Engine.
      </SectionHead>

      <form onSubmit={handleSearch} className="relative mb-6 flex items-center gap-3 border-b border-line-strong pb-2 focus-within:border-nasa-red">
        <Search size={20} className="shrink-0 text-faint" aria-hidden="true" />
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Search phenomena, sensors, or IDs (e.g. spherical flame, psi10)..."
          aria-label="Search investigations"
          spellCheck={false}
          className="h-14 w-full bg-transparent pl-2 pr-2 font-display text-[clamp(18px,2.2vw,26px)] font-light text-ink outline-none placeholder:text-faint"
        />
        {hasActiveSearch && (
          <button
            type="button"
            onClick={cancelOrClearSearch}
            aria-label={isSearching ? 'Stop search' : 'Clear search'}
            title={isSearching ? 'Stop search' : 'Clear search'}
            className="shrink-0 rounded-full p-2 text-faint transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={isSearching || !inputQuery.trim()}
          className="shrink-0"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {isSearching && <OllamaThinkingIndicator />}

      <div className="mb-10 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-faint">Pillar</span>
          <Segmented
            label="Safety pillar"
            size="sm"
            value={pillar}
            onChange={setPillar}
            options={['All', ...SAFETY_PILLARS].map((p) => ({ value: p, label: p }))}
          />
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
        {filteredUI && (
          <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-1 text-[14px] text-muted hover:text-ink">
            <X size={14} aria-hidden="true" /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-col">
        <div
          className={`relative w-full overflow-hidden rounded-xl border border-line-strong bg-[#07080b] ${
            isSearchCompleted ? 'order-2 mt-14' : 'order-1 mb-10'
          }`}
          style={{ height: '500px' }}
        >
          {ollamaData?.files?.length > 0 && (
            <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-[#fc3d21]/40 bg-[#18181b]/85 px-3.5 py-1.5 text-[12px] text-ink backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#fc3d21]" />
              <span>{ollamaData.files.length} highlighted nodes</span>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src="/galaxia_obsidian.html"
            onLoad={() => syncGraphHighlight(ollamaData)}
            width="100%"
            height="100%"
            title="File and tag galaxy"
            className="border-none"
          />
        </div>

        <div className={isSearchCompleted ? 'order-1' : 'order-2'}>
          <div className="label mb-2" aria-live="polite">
            {results.length} of {investigations.length} {ollamaData ? '(Semantic Matches)' : ''}
          </div>

          <ol className="border-t border-line">
            {results.map((inv) => (
              <Row
                key={inv.psi_id}
                inv={inv}
                selected={selected.includes(inv.psi_id)}
                canSelect={selected.length < MAX_COMPARE}
                onToggle={toggle}
                onOpen={onOpenDetail}
              />
            ))}
          </ol>

          {!results.length && !isSearching && (
            <p className="py-16 text-muted">
              No matches found.{' '}
              <button type="button" onClick={reset} className="link">
                Clear filters
              </button>
            </p>
          )}

          {ollamaData?.files?.length > 0 && (
            <div className="mb-4 mt-16 border-t border-line pt-8">
              <h3 className="label mb-4 !text-[#fc3d21]">Semantic Raw Files Found ({ollamaData.files.length})</h3>
              <ul className="divide-y divide-line-strong">
                {ollamaData.files.map((f) => {
                  const meta = JSON.parse(f[3] || '{}')
                  const filename = meta.filename || f[0]
                  return (
                    <li key={f[0]} className="py-4">
                      <div className="text-[15px] font-medium text-ink">
                        {filename} <span className="num ml-2 text-faint">(Score: {f[4]})</span>
                      </div>
                      <div className="mt-1 text-[14px] leading-relaxed text-muted">{f[2]}</div>
                      <div className="mt-2 inline-block rounded bg-ground px-2 py-1 font-mono text-[12px] text-faint">
                        Matches: {f[5]}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

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