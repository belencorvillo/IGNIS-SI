import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookMarked, Database, Flame, Globe2, Loader2, Telescope, Orbit } from 'lucide-react'
import MissionSimulator from './components/MissionSimulator'
import Explorer from './components/Explorer'
import Spinoffs from './components/Spinoffs'
import CompareModal from './components/CompareModal'
import CiteModal from './components/CiteModal'
import InvestigationDetail from './components/InvestigationDetail'
import { Badge, ScopeNote } from './components/ui'
import { DEFAULT_PARAMS, SOURCE_LABELS, loadInvestigations } from './data/investigations'

const TABS = [
  { id: 'simulator', label: 'Mission Simulator', Icon: Orbit },
  { id: 'explorer', label: 'SI Explorer', Icon: Telescope },
  { id: 'spinoffs', label: 'Earth Fire Safety Spin-offs', Icon: Globe2 },
]

export default function App() {
  const [tab, setTab] = useState('simulator')
  const [data, setData] = useState({ investigations: [], source: null, loading: true, error: null })
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [mode, setMode] = useState('cabin')
  const [detail, setDetail] = useState(null)
  const [compareIds, setCompareIds] = useState(null)
  const [citeOpen, setCiteOpen] = useState(false)

  useEffect(() => {
    let alive = true
    loadInvestigations()
      .then((r) => alive && setData({ ...r, loading: false, error: null }))
      .catch((error) => alive && setData({ investigations: [], source: null, loading: false, error }))
    return () => {
      alive = false
    }
  }, [])

  const { investigations, source } = data
  const compareItems = useMemo(
    () => (compareIds ? compareIds.map((id) => investigations.find((i) => i.psi_id === id)).filter(Boolean) : []),
    [compareIds, investigations],
  )
  const closeDetail = useCallback(() => setDetail(null), [])
  const src = SOURCE_LABELS[source]

  return (
    <div className="grid-bg flex min-h-screen flex-col bg-[#050811]">
      <header className="sticky top-0 z-30 border-b border-cyan-500/15 bg-[#050811]/90 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-gradient-to-br from-orange-500 to-cyan-500 p-1.5">
              <Flame size={18} className="text-white" />
            </span>
            <div>
              <div className="heading-font text-base font-bold tracking-wide text-white">IGNIS-SI</div>
              <div className="text-[10px] text-slate-400">Flame in Freefall · SI-powered fire safety insights from microgravity combustion</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {src && (
              <Badge tone={src.tone} title={src.detail}>
                <Database size={11} /> {src.label}
              </Badge>
            )}
            <button
              onClick={() => setCiteOpen(true)}
              disabled={!investigations.length}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50"
            >
              <BookMarked size={14} /> Cite Active Datasets (DOIs)
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4" aria-label="Main views">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`nav-tab flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm ${tab === t.id ? 'active' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <t.Icon size={15} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        {data.loading && (
          <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Loading PSI catalog…
          </div>
        )}
        {!data.loading && !investigations.length && (
          <div className="glass-panel m-4 p-8 text-center text-sm text-amber-300">
            No investigations could be loaded from the backend, catalogo_limpio.json or mock_catalogo.json.
          </div>
        )}
        {!data.loading && investigations.length > 0 && (
          <>
            {tab === 'simulator' && (
              <MissionSimulator
                investigations={investigations}
                params={params}
                setParams={setParams}
                mode={mode}
                setMode={setMode}
                onOpenDetail={setDetail}
              />
            )}
            {tab === 'explorer' && <Explorer investigations={investigations} onOpenDetail={setDetail} onCompare={setCompareIds} />}
            {tab === 'spinoffs' && <Spinoffs investigations={investigations} onOpenDetail={setDetail} />}
          </>
        )}
      </main>

      <footer className="border-t border-cyan-500/10 bg-[#050811]/90 px-4 py-3">
        <ScopeNote className="mx-auto max-w-5xl text-center" />
        <p className="mx-auto mt-1 max-w-5xl text-center text-[10px] text-slate-500">
          Data: NASA Physical Sciences Informatics (PSI). Each investigation shows its PSI ID and citation. Content marked “SI-Assisted Analysis”
          was produced with Space Intelligence assistance. NASA Space Apps Challenge 2026 project — not an official NASA product.
        </p>
      </footer>

      {detail && (
        <InvestigationDetail inv={detail} catalog={investigations} onClose={closeDetail} onOpen={setDetail} />
      )}
      <CompareModal open={compareItems.length >= 2} onClose={() => setCompareIds(null)} items={compareItems} />
      <CiteModal open={citeOpen} onClose={() => setCiteOpen(false)} investigations={investigations} source={source} />
    </div>
  )
}
