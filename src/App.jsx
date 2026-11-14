// App shell: header, navigation, footer and state shared across pages.
// Each tab lives in its own folder under src/pages/ — see src/README.md.
import { useCallback, useEffect, useState } from 'react'
import SimulatorPage from './pages/simulator/SimulatorPage'
import LibraryPage from './pages/library/LibraryPage'
import EarthPage from './pages/earth/EarthPage'
import CiteModal from './shared/CiteModal'
import InvestigationDetail from './shared/InvestigationDetail'
import { Button } from './shared/ui'
import { SOURCE_LABELS, loadInvestigations } from './shared/catalog'
import { MODEL_CREDITS } from './shared/credits'
import { DEFAULT_MODE, DEFAULT_PARAMS } from './pages/simulator/simulation'

const PAGES = [
  { id: 'simulator', label: 'Simulator' },
  { id: 'library', label: 'Library' },
  { id: 'earth', label: 'On Earth' },
]

function Wordmark() {
  // Project wordmark only — no NASA insignia, logotype or mission patches.
  return (
    <span className="flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r="10" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <ellipse cx="11" cy="11" rx="10" ry="3.6" fill="none" stroke="currentColor" strokeOpacity="0.35" transform="rotate(-24 11 11)" />
        <circle cx="11" cy="11" r="3.4" fill="#fc3d21" />
      </svg>
      <span className="font-display text-[17px] font-semibold tracking-tight">IGNIS-SI</span>
    </span>
  )
}

export default function App() {
  const [page, setPage] = useState('simulator')
  const [data, setData] = useState({ investigations: [], source: null, loading: true })
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [mode, setMode] = useState(DEFAULT_MODE)
  const [detail, setDetail] = useState(null)
  const [citeOpen, setCiteOpen] = useState(false)

  useEffect(() => {
    let alive = true
    loadInvestigations()
      .then((r) => alive && setData({ ...r, loading: false }))
      .catch(() => alive && setData({ investigations: [], source: null, loading: false }))
    return () => {
      alive = false
    }
  }, [])

  const { investigations, source } = data
  const closeDetail = useCallback(() => setDetail(null), [])
  const closeCite = useCallback(() => setCiteOpen(false), [])
  const go = (id) => {
    setPage(id)
    window.scrollTo({ top: 0 })
  }
  const src = SOURCE_LABELS[source]

  return (
    <div className="grain min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ground">
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-line bg-ground">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-8">
          <button type="button" onClick={() => go('simulator')} aria-label="IGNIS-SI home" className="rounded-full">
            <Wordmark />
          </button>
          <nav aria-label="Main" className="flex items-center gap-1">
            {PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => go(p.id)}
                aria-current={page === p.id ? 'page' : undefined}
                className={`h-10 whitespace-nowrap rounded-full px-2.5 text-[14px] transition-colors duration-150 sm:text-[15px] md:px-4 ${
                  page === p.id ? 'text-ink' : 'text-faint hover:text-ink'
                }`}
              >
                {p.label}
                <span className={`mx-auto mt-0.5 block h-px w-4 transition-colors ${page === p.id ? 'bg-nasa-red' : 'bg-transparent'}`} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <span className="hidden sm:block">
            <Button variant="secondary" className="h-9 px-4 text-[14px]" onClick={() => setCiteOpen(true)} disabled={!investigations.length}>
              Cite data
            </Button>
          </span>
        </div>
      </header>

      <main id="main" className="pt-16">
        {data.loading && <div className="label flex h-[60vh] items-center justify-center">Loading PSI catalog…</div>}
        {!data.loading && !investigations.length && (
          <div className="mx-auto max-w-xl px-6 py-32 text-center text-muted">
            No investigations could be loaded. Check the backend, catalogo_limpio.json or mock_catalogo.json.
          </div>
        )}
        {!data.loading && investigations.length > 0 && (
          <>
            {page === 'simulator' && (
              <SimulatorPage
                investigations={investigations}
                params={params}
                setParams={setParams}
                mode={mode}
                setMode={setMode}
                onOpenDetail={setDetail}
              />
            )}
            {page === 'library' && <LibraryPage investigations={investigations} onOpenDetail={setDetail} />}
            {page === 'earth' && <EarthPage investigations={investigations} onOpenDetail={setDetail} />}
          </>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 md:grid-cols-[1fr_1fr_auto] md:px-8">
          <p className="measure text-[14px] text-muted">
            Rocket engines and propellants are out of scope: their high flow velocities make combustion effectively gravity-independent.
          </p>
          <p className="measure text-[14px] text-muted">
            Data from NASA Physical Sciences Informatics (PSI). Content marked “SI-assisted analysis” was produced with Space Intelligence assistance.
            Built for NASA Space Apps 2026 — not an official NASA product.
          </p>
          <p className="measure text-[13px] text-faint md:col-span-2">
            3D models:{' '}
            {[MODEL_CREDITS.cabin, MODEL_CREDITS.habitat].map((c, i) => (
              <span key={c.url}>
                {i > 0 && ' · '}
                <a href={c.url} target="_blank" rel="noreferrer" className="link text-faint">
                  {c.title}
                </a>{' '}
                by{' '}
                <a href={c.authorUrl} target="_blank" rel="noreferrer" className="link text-faint">
                  {c.author}
                </a>{' '}
                (
                <a href={c.licenseUrl} target="_blank" rel="noreferrer" className="link text-faint">
                  {c.license}
                </a>
                {c.modified ? ', modified' : ''})
              </span>
            ))}
          </p>
          <div className="flex flex-col items-start gap-2 md:items-end">
            {src && (
              <span className="label flex items-center gap-2" title={src.detail}>
                <span className={`h-1.5 w-1.5 rounded-full ${source === 'mock' ? 'bg-ember' : 'bg-sky'}`} aria-hidden="true" />
                {src.label} · {investigations.length} investigations
              </span>
            )}
            <button type="button" onClick={() => setCiteOpen(true)} className="link text-[14px] sm:hidden">
              Cite data
            </button>
          </div>
        </div>
      </footer>

      {detail && <InvestigationDetail inv={detail} catalog={investigations} onClose={closeDetail} onOpen={setDetail} />}
      <CiteModal open={citeOpen} onClose={closeCite} investigations={investigations} source={source} />
    </div>
  )
}
