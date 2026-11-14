import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ChevronDown, ExternalLink, ScanEye } from 'lucide-react'
import Viewport3D from './Viewport3D'
import { Citation, CiteInline, Modal, More, PsiId, SectionHead, Segmented } from '../../shared/ui'
import { GRAVITY_REGIME_LABELS, LUNAR_TARGET, RACK_LABELS, SAFETY_PILLARS, isLunarZone } from '../../shared/catalog'
import {
  GRAVITY_LEVELS,
  MISSION_PRESETS,
  SCORE_WEIGHTS,
  SLIDER_LIMITS,
  SOURCES,
  STATUS_META,
  VIEW_MODES,
  advisory,
  flameRegime,
  hazardLevel,
  rankInvestigations,
} from './simulation'

const STATUS_TEXT = { covers: 'text-ink', bounds: 'text-sky', partial: 'text-ember', outside: 'text-faint' }
const MODE_OPTIONS = [
  { value: 'chamber', label: 'Flame', title: VIEW_MODES.chamber.label },
  { value: 'cabin', label: 'Cabin', title: VIEW_MODES.cabin.label },
  { value: 'habitat', label: 'Habitat', title: VIEW_MODES.habitat.label },
]
const HAZARD_DOT = { nominal: 'bg-sky', watch: 'bg-sky', elevated: 'bg-ember', critical: 'bg-nasa-red' }

const pct = (v, { min, max }) => ((v - min) / (max - min)) * 100
const shortTitle = (t) => t.replace(/\s*\(.*?\)\s*/g, ' ').trim()

/* ── Stage overlays ──────────────────────────────────────────────────────── */

function Control({ label, value, unit, children, pct }) {
  return (
    <label className="block min-w-0" style={{ '--p': `${pct}%` }}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="num text-[15px] text-ink">
          {value}
          <span className="ml-1 text-[12px] text-faint">{unit}</span>
        </span>
      </span>
      {children}
    </label>
  )
}

function OrbitLines() {
  // Decorative trajectory lines, in the spirit of the poster references.
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#f2efe9" strokeOpacity="0.07">
        <ellipse cx="720" cy="430" rx="640" ry="190" transform="rotate(-12 720 430)" />
        <ellipse cx="720" cy="430" rx="420" ry="420" />
      </g>
      <circle cx="1270" cy="300" r="3" fill="#f2efe9" fillOpacity="0.5" />
      <circle cx="300" cy="610" r="2" fill="#f2efe9" fillOpacity="0.35" />
    </svg>
  )
}

function EnvironmentInfo({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Where the environments come from">
      <p className="measure mb-8 text-[15px] text-muted">
        Each preset sets oxygen, pressure and gravity from a published source. Airflow values are illustrative defaults, not measurements.
      </p>
      <ol className="border-t border-line">
        {MISSION_PRESETS.map((p) => (
          <li key={p.id} className="border-b border-line py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[19px] font-medium">{p.name}</h3>
              <span className="num text-[13px] text-muted">
                {p.params.o2}% O₂ · {p.params.pressure} psi · {p.params.gravity}g
              </span>
            </div>
            <p className="mt-2 text-[15px] text-ink">{p.why}</p>
            {p.notes && <p className="mt-2 text-[14px] text-faint">{p.notes}</p>}
            <ul className="mt-3 space-y-1">
              {p.sources.map((k) => (
                <li key={k}>
                  <a href={SOURCES[k].url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-[13px] text-muted">
                    {SOURCES[k].label} <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-[13px] text-faint">
        Gravity: Moon 1.62 m/s² ≈ 0.16g, Mars 3.71 m/s² ≈ 0.38g (NASA NSSDC fact sheets). The lunar-zone threshold (O₂ ≥ 30% or ≤ 10.2 psi)
        follows the project’s domain constants.
      </p>
    </Modal>
  )
}

function Dock({ params, setParams, presetId, applyPreset }) {
  const [info, setInfo] = useState(false)
  const set = (key) => (e) => setParams((p) => ({ ...p, [key]: Number(e.target.value) }))
  return (
    <div className="relative z-10 border-t border-line bg-ground lg:absolute lg:inset-x-0 lg:bottom-0">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-5 md:px-8 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-12">
        {/* Block 1 — predefined environments */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[15px] font-medium tracking-normal">Use a predefined environment</h2>
            <button
              type="button"
              onClick={() => setInfo(true)}
              aria-label="Where these values come from"
              title="Where these values come from"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-[13px] text-muted transition-colors hover:border-ink hover:text-ink"
            >
              ?
            </button>
          </div>
          <ul className="grid">
            {MISSION_PRESETS.map((p) => {
              const active = presetId === p.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => applyPreset(p)}
                    aria-pressed={active}
                    className={`group flex h-9 w-full items-center justify-between gap-4 border-b border-line text-left text-[14px] transition-colors ${
                      active ? 'text-ink' : 'text-muted hover:text-ink'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`h-1.5 w-1.5 rounded-full transition-colors ${active ? 'bg-nasa-red' : 'bg-line-strong group-hover:bg-faint'}`} aria-hidden="true" />
                      {p.name}
                    </span>
                    <span className="num truncate text-[12px] text-faint">{p.detail}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Block 2 — custom configuration (follows the selected environment) */}
        <div className="lg:border-l lg:border-line lg:pl-12">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-medium tracking-normal">Or configure your own</h2>
            {!presetId && <span className="label">Custom</span>}
          </div>
          <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
            <Control label="Oxygen" value={params.o2} unit="%" pct={pct(params.o2, SLIDER_LIMITS.o2)}>
              <input type="range" {...SLIDER_LIMITS.o2} value={params.o2} onChange={set('o2')} aria-label="Oxygen concentration" />
            </Control>
            <Control label="Pressure" value={params.pressure.toFixed(1)} unit="psi" pct={pct(params.pressure, SLIDER_LIMITS.pressure)}>
              <input type="range" {...SLIDER_LIMITS.pressure} value={params.pressure} onChange={set('pressure')} aria-label="Cabin pressure" />
            </Control>
            <Control label="Airflow" value={params.airflow} unit="cm/s" pct={pct(params.airflow, SLIDER_LIMITS.airflow)}>
              <input type="range" {...SLIDER_LIMITS.airflow} value={params.airflow} onChange={set('airflow')} aria-label="Forced airflow" />
            </Control>
            <div>
              <span className="mb-1 block text-[13px] text-muted">Gravity</span>
              <Segmented
                label="Gravity level"
                size="sm"
                value={params.gravity}
                onChange={(g) => setParams((p) => ({ ...p, gravity: g }))}
                options={GRAVITY_LEVELS.map((g) => ({ value: g.value, label: g.short, title: g.name }))}
              />
            </div>
          </div>
        </div>
      </div>
      <EnvironmentInfo open={info} onClose={() => setInfo(false)} />
    </div>
  )
}

function Stage({ params, setParams, mode, setMode, ranked, presetId, applyPreset }) {
  const [xray, setXray] = useState(true)
  const regime = flameRegime(params)
  const hz = hazardLevel(params)
  const lunar = isLunarZone(params)
  const top = ranked.slice(0, 3)

  return (
    <section aria-label="Digital twin" className="relative overflow-hidden lg:h-[calc(100svh-64px)] lg:min-h-[800px]">
      <div className="relative h-[640px] lg:absolute lg:inset-0 lg:h-auto">
      <OrbitLines />
      <Viewport3D params={params} mode={mode} xray={xray} />

      <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-[1440px] flex-col px-4 pt-8 md:px-8 md:pt-12">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="pointer-events-auto rise">
            <div className="label mb-4">Digital twin · {VIEW_MODES[mode].label}</div>
            <h1 className="text-[clamp(44px,7vw,96px)] font-light leading-[0.95]">
              Flame in
              <br />
              freefall
            </h1>
            <p className="mt-5 hidden max-w-[34ch] text-muted sm:block">Set a habitat atmosphere. Watch the flame respond, and see which experiments back it up.</p>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {mode !== 'chamber' && (
              <button
                type="button"
                onClick={() => setXray((v) => !v)}
                aria-pressed={xray}
                className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                  xray ? 'border-line-strong text-ink' : 'border-line text-faint hover:text-ink'
                }`}
                title="Translucent hull to reveal interior indicators"
              >
                <ScanEye size={14} aria-hidden="true" /> X-ray
              </button>
            )}
            <Segmented label="Scene" value={mode} onChange={setMode} options={MODE_OPTIONS} />
          </div>
        </div>

        {/* HUD — corner readouts */}
        <dl className="pointer-events-auto mb-6 mt-auto grid w-fit gap-4 text-[14px] lg:mb-0 lg:mt-10">
          {mode === 'chamber' ? (
            <div>
              <dt className="label">Flame regime</dt>
              <dd className="mt-1 text-ink">{regime.name}</dd>
              <dd className="num text-[12px] text-faint">{regime.ref}</dd>
            </div>
          ) : (
            <div>
              <dt className="label">Cabin hazard</dt>
              <dd className="mt-1 flex items-center gap-2 text-ink">
                <span className={`h-2 w-2 rounded-full ${HAZARD_DOT[hz.level]} ${hz.level === 'critical' ? 'pulse-dot' : ''}`} aria-hidden="true" />
                {hz.label}
              </dd>
            </div>
          )}
          {lunar && (
            <div>
              <dt className="label">Exploration atmosphere</dt>
              <dd className="mt-1 text-ember">
                O₂ ≥ {LUNAR_TARGET.o2MinPct}% or ≤ {LUNAR_TARGET.pressureMaxPsi} psi
              </dd>
            </div>
          )}
        </dl>

        {/* Best evidence — right column on wide screens */}
        <aside aria-label="Best matching evidence" className="pointer-events-auto absolute right-8 top-1/2 hidden w-[300px] -translate-y-1/2 xl:block">
          <div className="label mb-3">Best evidence</div>
          <ol className="divide-y divide-line border-y border-line">
            {top.map((r) => (
              <li key={r.inv.psi_id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <PsiId id={r.inv.psi_id} />
                  <span className="block truncate text-[14px] text-muted" title={r.inv.title}>
                    {shortTitle(r.inv.title)}
                  </span>
                </span>
                <span className="num text-[22px] text-ink">{r.score}</span>
              </li>
            ))}
          </ol>
          <a href="#ranking" className="mt-3 inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink">
            Full ranking <ArrowDown size={14} aria-hidden="true" />
          </a>
        </aside>

        <span className="label pointer-events-none absolute bottom-4 left-8 hidden md:block lg:bottom-[268px]">Illustrative, not CFD · click scene to zoom</span>
      </div>
      </div>

      <Dock params={params} setParams={setParams} presetId={presetId} applyPreset={applyPreset} />
    </section>
  )
}

/* ── Ranking ─────────────────────────────────────────────────────────────── */

function ScoreBar({ value }) {
  return (
    <span className="block h-px w-full bg-line-strong">
      <span className="block h-px bg-ink transition-[width] duration-500" style={{ width: `${value}%` }} />
    </span>
  )
}

function RankRow({ row, rank, onOpen }) {
  const [open, setOpen] = useState(false)
  const { inv, score, status, axes, reasons } = row
  return (
    <li className="border-b border-line">
      <div className="grid grid-cols-[28px_1fr_auto] items-center gap-x-4 gap-y-1 py-5 md:grid-cols-[36px_88px_1fr_96px_120px_44px]">
        <span className="num text-[13px] text-faint">{String(rank).padStart(2, '0')}</span>
        <PsiId id={inv.psi_id} className="hidden md:block" />
        <span className="min-w-0">
          <button type="button" onClick={() => onOpen(inv)} className="text-left text-[16px] text-ink hover:underline hover:decoration-nasa-red hover:underline-offset-4">
            <span className="num mr-2 text-[13px] md:hidden">{inv.psi_id}</span>
            {shortTitle(inv.title)}
          </button>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-faint">
            <span>{RACK_LABELS[inv.hardware_rack].split(' (')[0]}</span>
            <span>{GRAVITY_REGIME_LABELS[inv.envelope.gravity_regime]}</span>
            <CiteInline inv={inv} />
          </span>
        </span>
        <span className={`hidden text-[14px] md:block ${STATUS_TEXT[status]}`} title={STATUS_META[status].hint}>
          {STATUS_META[status].label}
        </span>
        <span className="flex items-center gap-3">
          <span className="num w-10 text-right text-[22px] text-ink">{score}</span>
          <span className="hidden w-16 md:block">
            <ScoreBar value={score} />
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Why ${inv.psi_id} scores ${score}`}
          className="col-start-3 row-start-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-faint hover:bg-raised hover:text-ink md:col-start-6"
        >
          <ChevronDown size={16} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="rise grid gap-8 pb-8 md:grid-cols-[1fr_1fr] md:pl-[136px]">
          <div>
            <div className="label mb-3">Why this score</div>
            <ul className="space-y-3">
              {Object.entries(SCORE_WEIGHTS).map(([k, w], i) => (
                <li key={k} className="grid grid-cols-[80px_1fr_56px] items-center gap-3 text-[14px]">
                  <span className="text-muted">{k === 'o2' ? 'Oxygen' : k[0].toUpperCase() + k.slice(1)}</span>
                  <ScoreBar value={axes[k].score * 100} />
                  <span className="num text-right text-[13px] text-faint">× {w}</span>
                  <span className="col-span-3 -mt-2 text-[13px] text-faint">{reasons[i]}</span>
                </li>
              ))}
            </ul>
          </div>
          <Citation inv={inv} />
        </div>
      )}
    </li>
  )
}

function Ranking({ ranked, params, onOpen }) {
  const [pillar, setPillar] = useState('All')
  const [all, setAll] = useState(false)
  const rows = pillar === 'All' ? ranked : ranked.filter((r) => r.inv.safety_pillars.includes(pillar))
  const shown = all ? rows : rows.slice(0, 8)
  const notes = advisory(params)

  return (
    <section id="ranking" className="mx-auto max-w-[1440px] px-4 py-24 md:px-8 md:py-32">
      <SectionHead
        index="02 — Evidence"
        title="What the experiments say"
        right={
          <Segmented label="Safety pillar" size="sm" value={pillar} onChange={setPillar} options={['All', ...SAFETY_PILLARS].map((p) => ({ value: p, label: p }))} />
        }
      >
        {ranked.length} PSI investigations, ranked by how closely they tested your conditions.
      </SectionHead>

      <div className="grid gap-16 lg:grid-cols-[1fr_300px]">
        <div>
          <ol className="border-t border-line">
            {shown.map((r, i) => (
              <RankRow key={r.inv.psi_id} row={r} rank={i + 1} onOpen={onOpen} />
            ))}
          </ol>
          {!rows.length && <p className="py-10 text-muted">No investigations in this pillar.</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {rows.length > 8 ? (
              <button type="button" onClick={() => setAll((v) => !v)} className="link text-[15px]">
                {all ? 'Show top 8' : `Show all ${rows.length}`}
              </button>
            ) : (
              <span />
            )}
            <More summary="How the score works">
              <p className="measure text-[14px] text-muted">
                Each investigation’s tested envelope is compared with your conditions. Oxygen weighs {SCORE_WEIGHTS.o2 * 100}%, pressure{' '}
                {SCORE_WEIGHTS.pressure * 100}%, gravity {SCORE_WEIGHTS.gravity * 100}% and airflow {SCORE_WEIGHTS.airflow * 100}%. Inside the range
                scores full marks; outside decays with distance. 0g and 1g data <em>bound</em> partial gravity rather than cover it.
              </p>
            </More>
          </div>
        </div>

        <aside aria-label="Watch-outs">
          <div className="label mb-4">Watch-outs</div>
          <ul className="space-y-5 border-l border-line pl-5">
            {notes.slice(0, 2).map((n) => (
              <li key={n} className="text-[15px] text-muted">
                {n}
              </li>
            ))}
          </ul>
          {notes.length > 2 && (
            <More summary={`${notes.length - 2} more`} className="mt-4 pl-5">
              <ul className="space-y-4">
                {notes.slice(2).map((n) => (
                  <li key={n} className="text-[15px] text-muted">
                    {n}
                  </li>
                ))}
              </ul>
            </More>
          )}
          <p className="label mt-6 pl-5 normal-case tracking-normal">Rule-based, no generative model.</p>
        </aside>
      </div>
    </section>
  )
}

/* ── Partial gravity ─────────────────────────────────────────────────────── */

const REGIME_X = { '0g_microgravity': 0, partial_g_proxy: 0.27, '1g_ground_reference': 1 }

function GravitySection({ ranked, gravity }) {
  const points = ranked.map((r) => ({
    g: REGIME_X[r.inv.envelope.gravity_regime],
    score: r.score,
    id: r.inv.psi_id,
    proxy: r.inv.envelope.gravity_regime === 'partial_g_proxy',
  }))
  const best = (regime) => Math.max(0, ...ranked.filter((r) => r.inv.envelope.gravity_regime === regime).map((r) => r.score))
  const bound = [
    { g: 0, bound: best('0g_microgravity') },
    { g: 1, bound: best('1g_ground_reference') },
  ]
  const count = (regime) => ranked.filter((r) => r.inv.envelope.gravity_regime === regime).length
  const proxies = ranked.filter((r) => r.inv.envelope.gravity_regime === 'partial_g_proxy').map((r) => r.inv.psi_id)

  return (
    <section id="gravity" className="border-t border-line">
      <div className="mx-auto max-w-[1440px] px-4 py-24 md:px-8 md:py-32">
        <SectionHead index="03 — Partial gravity" title="Between zero and one g">
          There is no flame data from the Moon or Mars yet, so partial gravity is bounded by orbit data, ground tests and electric-field proxies.
        </SectionHead>

        <div className="grid gap-16 lg:grid-cols-[1fr_300px]">
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 24, right: 16, bottom: 24, left: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="g"
                  domain={[0, 1]}
                  ticks={[0, 0.16, 0.38, 1]}
                  tickFormatter={(v) => `${v}g`}
                  tick={{ fill: '#7d818a', fontSize: 12, fontFamily: 'DM Mono' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.16)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 50, 100]}
                  tick={{ fill: '#7d818a', fontSize: 12, fontFamily: 'DM Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <ReferenceArea x1={0.12} x2={0.42} fill="#0b3d91" fillOpacity={0.35} />
                <ReferenceLine x={0.16} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 4" label={{ value: 'Moon', fill: '#a6a9b1', fontSize: 12, position: 'top' }} />
                <ReferenceLine x={0.38} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 4" label={{ value: 'Mars', fill: '#a6a9b1', fontSize: 12, position: 'top' }} />
                <ReferenceLine x={gravity} stroke="#f2efe9" strokeWidth={1} />
                <Line data={bound} dataKey="bound" stroke="#7aa3f5" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Scatter
                  data={points}
                  dataKey="score"
                  isAnimationActive={false}
                  shape={(p) => <circle cx={p.cx} cy={p.cy} r={p.payload.proxy ? 6 : 3.5} fill={p.payload.proxy ? '#fc3d21' : '#f2efe9'} fillOpacity={p.payload.proxy ? 1 : 0.7} />}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{ background: '#151821', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, fontSize: 13 }}
                  formatter={(v, n, item) => [`${v}`, item?.payload?.id || n]}
                  labelFormatter={() => ''}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <dl className="grid content-start gap-8">
            <div>
              <dt className="label">Orbit (0g)</dt>
              <dd className="num mt-1 text-[40px] leading-none">{count('0g_microgravity')}</dd>
            </div>
            <div>
              <dt className="label">Ground (1g)</dt>
              <dd className="num mt-1 text-[40px] leading-none">{count('1g_ground_reference')}</dd>
            </div>
            <div>
              <dt className="label flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-nasa-red" aria-hidden="true" /> Partial-g proxy
              </dt>
              <dd className="num mt-1 text-[40px] leading-none">{count('partial_g_proxy')}</dd>
              {proxies.length > 0 && <dd className="num text-[13px] text-faint">{proxies.join(', ')}</dd>}
            </div>
            <div>
              <dt className="label">Lunar flight data</dt>
              <dd className="mt-1 text-[15px] text-muted">LUCI and FM2 — pending</dd>
            </div>
          </dl>
        </div>

        <More summary="How to read this chart" className="mt-8">
          <p className="measure text-[14px] text-muted">
            Each dot is an investigation at its gravity regime; height is its match score for your conditions. The dashed line joins the best 0g and
            1g evidence, bounding the blue Moon–Mars band. The red dot is the ACME E-FIELD electric-field proxy for partial-gravity buoyancy. The white
            line marks your selected gravity.
          </p>
        </More>
      </div>
    </section>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function SimulatorPage({ investigations, params, setParams, mode, setMode, onOpenDetail }) {
  const [presetId, setPresetId] = useState('iss')
  const ranked = useMemo(() => rankInvestigations(investigations, params), [investigations, params])

  const applyPreset = (p) => {
    setPresetId(p.id)
    setParams(p.params)
    setMode(p.mode)
  }
  const setManual = (fn) => {
    setPresetId(null)
    setParams(fn)
  }

  return (
    <>
      <Stage params={params} setParams={setManual} mode={mode} setMode={setMode} ranked={ranked} presetId={presetId} applyPreset={applyPreset} />
      <Ranking ranked={ranked} params={params} onOpen={onOpenDetail} />
      <GravitySection ranked={ranked} gravity={params.gravity} />
    </>
  )
}
