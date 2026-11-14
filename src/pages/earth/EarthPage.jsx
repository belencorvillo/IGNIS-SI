import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { EARTH_ATM, envelopeSummary } from '../../shared/catalog'
import { CiteInline, Modal, More, PsiId, SectionHead, Segmented, Tag } from '../../shared/ui'
import EarthBackdrop from './EarthBackdrop'
import Illustration from './Illustrations'
import { CHAIN_STEPS, SCOPES, SOURCES, SPINOFFS, STATUS, TOPICS } from './spinoffs'

/* ── Evidence list: PSI ID, title, tested envelope and citation ─────────── */

function Evidence({ linked, onOpen }) {
  const [all, setAll] = useState(false)
  if (!linked.length) return <p className="text-[14px] text-faint">No matching investigations in this catalog.</p>
  const shown = all ? linked : linked.slice(0, 3)
  return (
    <div>
      <ul className="border-t border-line">
        {shown.map((inv) => {
          const env = envelopeSummary(inv.envelope)
          return (
            <li key={inv.psi_id} className="flex items-center justify-between gap-4 border-b border-line py-3">
              <button type="button" onClick={() => onOpen(inv)} className="min-w-0 text-left">
                <span className="flex min-w-0 items-baseline gap-3">
                  <PsiId id={inv.psi_id} className="shrink-0" />
                  <span className="truncate text-[14px] text-muted hover:text-ink">{inv.title}</span>
                </span>
                <span className="num mt-1 block text-[12px] text-faint">
                  {env.o2} · {env.airflow}
                </span>
              </button>
              <CiteInline inv={inv} />
            </li>
          )
        })}
      </ul>
      {linked.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="link mt-3 text-[14px]">
          {all ? 'Show fewer' : `All ${linked.length} investigations`}
        </button>
      )}
    </div>
  )
}

/* ── O₂ tested by the linked investigations vs Earth air ────────────────── */

function O2VsEarth({ linked }) {
  const mins = linked.map((i) => i.envelope.o2_min_pct).filter((v) => v != null)
  const maxs = linked.map((i) => i.envelope.o2_max_pct).filter((v) => v != null)
  if (!mins.length || !maxs.length) return null
  const lo = Math.min(...mins)
  const hi = Math.max(...maxs)
  const earth = EARTH_ATM.o2
  return (
    <figure className="mb-8">
      <figcaption className="label mb-3">Oxygen tested vs Earth air</figcaption>
      <div className="relative mb-1.5 h-4 text-[12px]">
        <span className="num absolute text-ember" style={{ left: `${lo}%` }}>
          {lo}%
        </span>
        <span className="num absolute -translate-x-full text-ember" style={{ left: `${hi}%` }}>
          {hi}%
        </span>
      </div>
      <div
        className="relative h-2 rounded-full bg-raised"
        role="img"
        aria-label={`Linked investigations tested ${lo} to ${hi} percent oxygen; Earth air is ${earth} percent.`}
      >
        <div className="absolute inset-y-0 rounded-full bg-ember/70" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        <div className="absolute -inset-y-1.5 w-0.5 rounded-full bg-sky" style={{ left: `${earth}%` }} />
      </div>
      <div className="relative mt-2 h-4 text-[12px]">
        <span className="num absolute -translate-x-1/2 whitespace-nowrap text-sky" style={{ left: `${earth}%` }}>
          Earth {earth}%
        </span>
      </div>
    </figure>
  )
}

/* ── PSI data → research → invention, at a glance ───────────────────────── */

function Chain({ steps, compact = false }) {
  return (
    <ol
      className={`${compact ? 'mt-4' : 'mt-6'} grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch`}
    >
      {steps.map((text, k) => (
        <li key={CHAIN_STEPS[k]} className="contents">
          {k > 0 && <ArrowRight size={16} className="rotate-90 self-center justify-self-center text-faint sm:rotate-0" aria-hidden="true" />}
          <div className={`rounded-xl border ${compact ? 'px-3 py-2' : 'p-3'} ${k === 2 ? 'border-ember/40' : 'border-line'}`}>
            <div className="label mb-1">{CHAIN_STEPS[k]}</div>
            <div className={`text-[14px] leading-snug ${k === 2 ? 'text-ink' : 'text-muted'}`}>{text}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ── Summary numbers ─────────────────────────────────────────────────────── */

function Summary({ investigations }) {
  const linkedIds = new Set(SPINOFFS.flatMap((s) => investigations.filter(s.match).map((i) => i.psi_id)))
  const inDemo = SPINOFFS.filter(isStarted).length
  const stats = [
    [SPINOFFS.length, 'research lines', 'text-ink'],
    [linkedIds.size, 'PSI investigations linked', 'text-ink'],
    [inDemo, 'already started', 'text-ember'],
  ]
  return (
    <section className="mb-24 mt-20 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
      <dl className="grid grid-cols-3 gap-8">
        {stats.map(([n, label, color]) => (
          <div key={label}>
            <dt className="sr-only">{label}</dt>
            <dd className={`num text-[clamp(56px,6vw,85px)] font-light leading-none ${color}`}>{n}</dd>
            <dd className="mt-3 text-[16px] text-muted">{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ── Filters ─────────────────────────────────────────────────────────────── */

const TOPIC_OPTIONS = [{ value: 'all', label: 'All topics' }, ...Object.entries(TOPICS).map(([value, label]) => ({ value, label }))]
const isStarted = (s) => s.status === 'demo' || s.status === 'partial'

/** Colours of the toggle chips (full class names so Tailwind generates them). */
const CHIP_TONES = {
  yellow: { on: 'border-yellow-300 bg-yellow-300', hover: 'hover:border-yellow-300/60', dot: 'bg-yellow-300' },
  sky: { on: 'border-sky bg-sky', hover: 'hover:border-sky/60', dot: 'bg-sky' },
  red: { on: 'border-nasa-red bg-nasa-red', hover: 'hover:border-nasa-red/60', dot: 'bg-nasa-red' },
}
const SCOPE_TONES = { earth: 'sky', equipment: 'red' }

/** Pill that switches a filter on and off: coloured dot when off, filled with its colour when on. */
function ToggleChip({ tone, pressed, onToggle, children }) {
  const c = CHIP_TONES[tone]
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${
        pressed ? `${c.on} text-ground` : `border-line text-muted ${c.hover} hover:text-ink`
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${pressed ? 'bg-ground' : c.dot}`} aria-hidden="true" />
      {children}
    </button>
  )
}

function Filters({ scope, onScope, topic, onTopic, started, onStarted }) {
  return (
    <div className="mb-10 grid gap-3">
      {/* One scope at a time; pressing the active one again shows all lines. */}
      <div role="group" aria-label="Filter by scope" className="flex flex-wrap gap-3">
        {Object.entries(SCOPES).map(([value, { label }]) => (
          <ToggleChip
            key={value}
            tone={SCOPE_TONES[value]}
            pressed={scope === value}
            onToggle={() => onScope(scope === value ? 'all' : value)}
          >
            {label}
          </ToggleChip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <Segmented label="Filter by topic" options={TOPIC_OPTIONS} value={topic} onChange={onTopic} size="sm" />
        </div>
        <ToggleChip tone="yellow" pressed={started} onToggle={() => onStarted(!started)}>
          In the demo
        </ToggleChip>
      </div>
    </div>
  )
}

/* ── One research line: what the row shows, and what only the popup shows ─ */

function LineSummary({ s, showTitle = true, compact = false }) {
  const st = STATUS[s.status]
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {st.show && (
          <Tag tone={st.tone} title={s.statusNote}>
            {st.label}
          </Tag>
        )}
        {s.scopes.map((sc) => (
          <Tag key={sc}>{SCOPES[sc].tag}</Tag>
        ))}
        {s.topics.map((t) => (
          <Tag key={t}>{TOPICS[t]}</Tag>
        ))}
      </div>
      {showTitle && (
        <h3 className={`${compact ? 'mt-3 text-[clamp(24px,2.6vw,32px)]' : 'mt-4 text-[clamp(28px,3.4vw,40px)]'} font-medium`}>{s.title}</h3>
      )}
      <p className={`${showTitle ? (compact ? 'mt-1.5' : 'mt-3') : 'mt-4'} ${compact ? 'text-[16px]' : 'text-[18px]'} text-muted`}>
        {s.lede}
      </p>
      <Chain steps={s.chain} compact={compact} />
      <div className={`measure ${compact ? 'mt-4' : 'mt-6'} text-[15px]`}>
        <div className="label mb-1">Future research</div>
        <p className="text-muted">{s.research}</p>
      </div>
    </>
  )
}

function LineDetails({ s, linked, onOpen }) {
  return (
    <>
      <dl className="measure mt-5 grid gap-5 text-[15px]">
        <div>
          <dt className="label mb-1">Invention</dt>
          <dd className="text-ink">{s.invention}</dd>
        </div>
        <div>
          <dt className="label mb-1">PSI data</dt>
          <dd className="text-muted">{s.data}</dd>
          {s.statusNote && <dd className="mt-2 text-[14px] text-faint">{s.statusNote}</dd>}
        </div>
      </dl>
      <div className="measure mt-8">
        <O2VsEarth linked={linked} />
      </div>
      <More
        summary={
          <span className="flex items-baseline gap-2">
            <span className="label">Evidence</span>
            <span className="num text-[12px] text-faint">
              {linked.length} {linked.length === 1 ? 'investigation' : 'investigations'}
            </span>
          </span>
        }
      >
        <Evidence linked={linked} onOpen={onOpen} />
      </More>
    </>
  )
}

export default function EarthPage({ investigations, onOpenDetail }) {
  const [scope, setScope] = useState('all')
  const [topic, setTopic] = useState('all')
  const [started, setStarted] = useState(false)
  const [openId, setOpenId] = useState(null)
  const openLine = SPINOFFS.find((s) => s.id === openId)
  const visible = SPINOFFS.map((s, n) => ({ s, n })).filter(
    ({ s }) =>
      (scope === 'all' || s.scopes.includes(scope)) && (topic === 'all' || s.topics.includes(topic)) && (!started || isStarted(s)),
  )

  return (
    <div className="relative isolate mx-auto max-w-[1440px] px-4 pb-32 pt-16 md:px-8 md:pt-24">
      <EarthBackdrop />
      {/* The header boxes span the full width; let the pointer pass through their
          empty space so the planet behind can be dragged. Text and links stay usable. */}
      <div className="pointer-events-none [&_a]:pointer-events-auto [&_dd]:pointer-events-auto [&_h2]:pointer-events-auto [&_p]:pointer-events-auto">
        <SectionHead index="On Earth" title="What orbit teaches firefighters">
          Microgravity removes buoyancy, so these results do not transfer 1:1 to fires on Earth. Each line below goes from
          PSI data to an open research question to a device that could come out of it.
        </SectionHead>

        <Summary investigations={investigations} />
      </div>
      <Filters
        scope={scope}
        onScope={setScope}
        topic={topic}
        onTopic={setTopic}
        started={started}
        onStarted={setStarted}
      />

      {visible.length === 0 ? (
        <p className="border-t border-line py-14 text-[15px] text-faint">No research lines match these filters.</p>
      ) : (
        <ol>
          {visible.map(({ s, n }) => (
            <li
              key={s.id}
              id={`line-${s.id}`}
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-label={`${s.title}: open full details`}
              onClick={() => setOpenId(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setOpenId(s.id)
                }
              }}
              className="group grid scroll-mt-24 cursor-pointer gap-5 border-t border-line py-8 transition-colors duration-150 hover:bg-white/[0.02] lg:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-12"
            >
              <span className="num text-[40px] font-light leading-none text-faint transition-colors group-hover:text-ink">
                {String(n + 1).padStart(2, '0')}
              </span>
              <div>
                <LineSummary s={s} compact />
                <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] text-muted transition-colors group-hover:text-ink">
                  Invention, PSI data and evidence
                  <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="hidden self-center lg:block">
                <Illustration id={s.id} className="h-[260px]" />
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Portal: the page wrapper is `isolate`, which would keep the popup under the site header. */}
      {openLine &&
        createPortal(
        <Modal open onClose={() => setOpenId(null)} title={openLine.title} wide>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <LineSummary s={openLine} showTitle={false} />
              <LineDetails
                s={openLine}
                linked={investigations.filter(openLine.match)}
                onOpen={(inv) => {
                  setOpenId(null)
                  onOpenDetail(inv)
                }}
              />
            </div>
            <div className="hidden lg:block">
              <Illustration id={openLine.id} />
            </div>
          </div>
        </Modal>,
          document.body,
        )}

      <p className="label mt-2 normal-case tracking-normal">
        Editorial context, not PSI data. Proposed research lines and devices; verify claims against the cited sources.
      </p>

      <section className="mt-16 border-t border-line pt-10">
        <div className="label mb-4">Sources</div>
        <ul className="measure grid gap-3 text-[14px] text-muted">
          {SOURCES.map((src) => (
            <li key={src.label}>
              {src.parts ? (
                src.parts.map((p) =>
                  typeof p === 'string' ? (
                    p
                  ) : (
                    <a key={p.href} href={p.href} target="_blank" rel="noreferrer" className="link">
                      {p.text}
                    </a>
                  ),
                )
              ) : src.href ? (
                <a href={src.href} target="_blank" rel="noreferrer" className="link">
                  {src.label}
                </a>
              ) : (
                src.label
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
