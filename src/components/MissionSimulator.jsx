import { useMemo, useState } from 'react'
import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { Gauge, ListOrdered, Orbit, Scale, SlidersHorizontal, TriangleAlert, Moon } from 'lucide-react'
import Viewport3D from './Viewport3D'
import { Badge, CitationBlock, LunarBadge, PillarBadge, PsiIdTag, SectionTitle } from './ui'
import {
  GRAVITY_LEVELS,
  GRAVITY_REGIME_LABELS,
  LUNAR_TARGET,
  MISSION_PRESETS,
  RACK_LABELS,
  SAFETY_PILLARS,
  SCORE_WEIGHTS,
  SLIDER_LIMITS,
  STATUS_META,
  advisory,
  envelopeSummary,
  hazardLevel,
  isLunarZone,
  rankInvestigations,
} from '../data/investigations'

function Slider({ label, unit, value, onChange, min, max, step, marks, format = (v) => v }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="mono text-sm font-semibold text-cyan-300">
          {format(value)} <span className="text-[11px] text-slate-500">{unit}</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {marks && (
        <div className="relative mt-1 h-3 text-[9px] text-slate-500">
          {marks.map((m) => (
            <span
              key={m.v}
              className={`absolute -translate-x-1/2 whitespace-nowrap ${m.tone || ''}`}
              style={{ left: `${((m.v - min) / (max - min)) * 100}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      )}
    </label>
  )
}

function Controls({ params, setParams, presetId, applyPreset }) {
  const set = (key) => (v) => setParams((p) => ({ ...p, [key]: v }))
  const gIndex = Math.max(0, GRAVITY_LEVELS.findIndex((g) => g.value === params.gravity))
  const lunar = isLunarZone(params)
  const hz = hazardLevel(params)

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <SectionTitle icon={Orbit}>Mission Presets</SectionTitle>
        <div className="grid grid-cols-1 gap-1.5">
          {MISSION_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`preset-card rounded-lg border px-3 py-2 text-left ${
                presetId === p.id ? 'active border-cyan-400/60' : 'border-slate-700/70 bg-slate-900/40'
              }`}
            >
              <div className="text-xs font-semibold text-slate-100">{p.name}</div>
              <div className="mono text-[10px] text-slate-400">{p.detail}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <SectionTitle icon={SlidersHorizontal}>Target Conditions</SectionTitle>
        <Slider
          label="Target O₂"
          unit="%"
          {...SLIDER_LIMITS.o2}
          value={params.o2}
          onChange={set('o2')}
          marks={[
            { v: 21, label: 'Earth 21' },
            { v: 30, label: 'Lunar ≥30', tone: 'text-amber-400' },
            { v: 85, label: 'PSI max 85' },
          ]}
        />
        <Slider
          label="Cabin Pressure"
          unit="psi"
          {...SLIDER_LIMITS.pressure}
          value={params.pressure}
          onChange={set('pressure')}
          format={(v) => v.toFixed(1)}
          marks={[
            { v: 4.3, label: 'EVA 4.3' },
            { v: 10.2, label: 'Lunar ≤10.2', tone: 'text-amber-400' },
            { v: 14.7, label: 'Earth' },
          ]}
        />
        <Slider label="Forced Airflow" unit="cm/s" {...SLIDER_LIMITS.airflow} value={params.airflow} onChange={set('airflow')} />
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-300">Gravity Level</span>
            <span className="mono text-sm font-semibold text-cyan-300">{GRAVITY_LEVELS[gIndex].short}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {GRAVITY_LEVELS.map((g) => (
              <button
                key={g.value}
                onClick={() => set('gravity')(g.value)}
                title={g.name}
                className={`rounded-md border px-1 py-1.5 text-[11px] font-medium transition ${
                  params.gravity === g.value
                    ? 'border-cyan-400/60 bg-cyan-400/15 text-cyan-200'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {g.short}
                <span className="block text-[9px] text-slate-500">{g.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-500">Preset airflow values are simulator defaults, not PSI measurements.</p>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Heuristic cabin hazard index</span>
          <b style={{ color: hz.color }}>{hz.label}</b>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Lunar base / rover zone</span>
          {lunar ? <Badge tone="amber">O₂ ≥ {LUNAR_TARGET.o2MinPct}% or ≤ {LUNAR_TARGET.pressureMaxPsi} psi</Badge> : <Badge>No</Badge>}
        </div>
        <p className="text-[10px] leading-snug text-slate-500">
          Index rule: Critical if O₂ ≥ 40%; Elevated if O₂ ≥ 30% or enriched O₂ at ≤ 10.2 psi; Watch if ≤ 10.2 psi. Illustrative —
          not a certified NASA-STD-6001 assessment.
        </p>
      </div>
    </div>
  )
}

function ScoreBar({ value, tone }) {
  const color = { emerald: '#10B981', cyan: '#38BDF8', amber: '#F59E0B', slate: '#64748B' }[tone]
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

function RankingRow({ row, rank, onOpen }) {
  const [open, setOpen] = useState(false)
  const { inv, score, status, reasons, axes } = row
  const meta = STATUS_META[status]
  const env = envelopeSummary(inv.envelope)
  return (
    <div className="inv-card rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
      <div className="flex items-start gap-3">
        <div className="mono w-6 pt-0.5 text-right text-xs text-slate-500">#{rank}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PsiIdTag id={inv.psi_id} />
            <Badge tone={meta.tone} title={meta.hint}>
              {meta.label}
            </Badge>
            {inv.lunar_habitat_relevant && <LunarBadge />}
            {inv.envelope.gravity_regime === 'partial_g_proxy' && <Badge tone="violet">Partial-g proxy</Badge>}
          </div>
          <button onClick={() => onOpen(inv)} className="mt-1 block text-left text-sm font-medium text-slate-100 hover:text-cyan-300">
            {inv.title}
          </button>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
            <span>{RACK_LABELS[inv.hardware_rack]}</span>
            <span>{env.o2}</span>
            <span>{env.pressure}</span>
            <span>{env.airflow}</span>
            <span>{env.gravity}</span>
          </div>
        </div>
        <div className="w-24 shrink-0 text-right">
          <div className="mono text-lg font-bold text-white">{score}%</div>
          <ScoreBar value={score} tone={meta.tone} />
          <button onClick={() => setOpen((v) => !v)} className="mt-1 text-[10px] text-cyan-400 hover:underline">
            {open ? 'Hide' : 'Why?'}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-slate-700/60 pt-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Score breakdown</div>
            <table className="mono w-full text-[11px] text-slate-300">
              <tbody>
                {Object.entries(SCORE_WEIGHTS).map(([k, w]) => (
                  <tr key={k}>
                    <td className="py-0.5 capitalize">{k === 'o2' ? 'O₂' : k}</td>
                    <td className="text-slate-500">{Math.round(axes[k].score * 100)}% × {w}</td>
                    <td className="text-right">{(axes[k].score * w * 100).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-slate-400">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <CitationBlock inv={inv} />
        </div>
      )}
      {!open && (
        <div className="mt-2">
          <CitationBlock inv={inv} compact />
        </div>
      )}
    </div>
  )
}

const REGIME_X = { '0g_microgravity': 0, partial_g_proxy: 0.27, '1g_ground_reference': 1 }

function BoundingChart({ ranked, gravity }) {
  const points = ranked.map((r) => ({
    g: REGIME_X[r.inv.envelope.gravity_regime],
    score: r.score,
    id: r.inv.psi_id,
    proxy: r.inv.envelope.gravity_regime === 'partial_g_proxy',
  }))
  const best = (regime) => Math.max(0, ...ranked.filter((r) => r.inv.envelope.gravity_regime === regime).map((r) => r.score))
  const b0 = best('0g_microgravity')
  const b1 = best('1g_ground_reference')
  const bound = [
    { g: 0, bound: b0 },
    { g: 1, bound: b1 },
  ]
  return (
    <div>
      <SectionTitle icon={Scale}>Partial-Gravity Bounding Curve</SectionTitle>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 16, right: 12, bottom: 14, left: -10 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="g"
              domain={[0, 1]}
              ticks={[0, 0.16, 0.38, 1]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              label={{ value: 'Gravity level (g)', position: 'insideBottom', offset: -6, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'Match %', angle: -90, position: 'insideLeft', offset: 18, fill: '#64748b', fontSize: 10 }} />
            <ReferenceArea x1={0.12} x2={0.42} fill="#a855f7" fillOpacity={0.08} label={{ value: 'LUCI · FM2 (pending)', fill: '#c084fc', fontSize: 9, position: 'insideTop' }} />
            <ReferenceLine x={0.16} stroke="#94a3b8" strokeDasharray="2 4" label={{ value: 'Moon', fill: '#94a3b8', fontSize: 9, position: 'top' }} />
            <ReferenceLine x={0.38} stroke="#f59e0b" strokeDasharray="2 4" label={{ value: 'Mars', fill: '#f59e0b', fontSize: 9, position: 'top' }} />
            <ReferenceLine x={gravity} stroke="#38bdf8" strokeWidth={2} />
            <Line data={bound} dataKey="bound" stroke="#38bdf8" strokeDasharray="6 4" dot={false} isAnimationActive={false} name="0g ↔ 1g bound" />
            <Scatter
              data={points}
              dataKey="score"
              isAnimationActive={false}
              shape={(p) => (
                <circle cx={p.cx} cy={p.cy} r={p.payload.proxy ? 7 : 4.5} fill={p.payload.proxy ? '#c084fc' : '#38bdf8'} stroke={p.payload.proxy ? '#f5d0fe' : '#0b1120'} strokeWidth={p.payload.proxy ? 2 : 1} />
              )}
            />
            <Tooltip
              cursor={{ stroke: '#334155' }}
              contentStyle={{ background: '#0b1120', border: '1px solid #334155', fontSize: 11 }}
              formatter={(v, n, item) => [`${v}%`, item?.payload?.id || n]}
              labelFormatter={() => ''}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-400">
        Dots are investigations placed at their gravity regime (0g ISS, 1g ground). The dashed line bounds partial gravity between the best
        0g and 1g evidence. <span className="text-fuchsia-300">Purple</span> = ACME E-FIELD electric-field proxy (PSI-22). Direct lunar data
        from <b>LUCI</b> and <b>FM2</b> is pending.
      </p>
    </div>
  )
}

export default function MissionSimulator({ investigations, params, setParams, mode, setMode, onOpenDetail }) {
  const [presetId, setPresetId] = useState('iss')
  const [pillar, setPillar] = useState('All')
  const [showAll, setShowAll] = useState(false)

  const ranked = useMemo(() => rankInvestigations(investigations, params), [investigations, params])
  const filtered = pillar === 'All' ? ranked : ranked.filter((r) => r.inv.safety_pillars.includes(pillar))
  const visible = showAll ? filtered : filtered.slice(0, 6)
  const notes = advisory(params)
  const counts = filtered.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {})

  const applyPreset = (p) => {
    setPresetId(p.id)
    setParams(p.params)
    setMode(p.mode)
  }
  const setParamsManual = (fn) => {
    setPresetId(null)
    setParams(fn)
  }

  return (
    <div className="space-y-3 p-3">
      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <div className="glass-panel lg:max-h-[640px]">
          <Controls params={params} setParams={setParamsManual} presetId={presetId} applyPreset={applyPreset} />
        </div>
        <div className="glass-panel h-[520px] overflow-hidden lg:h-[640px]">
          <Viewport3D params={params} mode={mode} setMode={setMode} />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_420px]">
        <div className="glass-panel p-4">
          <SectionTitle
            icon={ListOrdered}
            right={
              <div className="flex flex-wrap gap-1">
                {['All', ...SAFETY_PILLARS].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPillar(p)}
                    className={`pillar-pill rounded-full border border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-400 ${pillar === p ? 'active' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            }
          >
            Match Score Ranking
          </SectionTitle>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <Gauge size={13} className="text-cyan-400" />
            Weights: O₂ {SCORE_WEIGHTS.o2 * 100}% · Pressure {SCORE_WEIGHTS.pressure * 100}% · Gravity {SCORE_WEIGHTS.gravity * 100}% · Airflow{' '}
            {SCORE_WEIGHTS.airflow * 100}%
            <span className="text-slate-600">|</span>
            {Object.entries(STATUS_META).map(([k, m]) => (
              <Badge key={k} tone={m.tone} title={m.hint}>
                {m.label}: {counts[k] || 0}
              </Badge>
            ))}
          </div>
          <div className="space-y-2">
            {visible.map((row, i) => (
              <RankingRow key={row.inv.psi_id} row={row} rank={i + 1} onOpen={onOpenDetail} />
            ))}
            {!filtered.length && <p className="text-sm text-slate-400">No investigations for this pillar.</p>}
          </div>
          {filtered.length > 6 && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-3 text-xs text-cyan-400 hover:underline">
              {showAll ? 'Show top 6' : `Show all ${filtered.length}`}
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="glass-panel p-4">
            <BoundingChart ranked={ranked} gravity={params.gravity} />
          </div>
          <div className="glass-panel p-4">
            <SectionTitle icon={TriangleAlert} right={<Badge>Rule-based</Badge>}>
              Mission Advisory
            </SectionTitle>
            <ul className="space-y-2 text-xs text-slate-300">
              {notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-slate-500">
              Deterministic rules derived from the project domain constants — no generative model involved.
            </p>
          </div>
          <div className="glass-panel p-4">
            <SectionTitle icon={Moon}>Top Lunar-Relevant Evidence</SectionTitle>
            <div className="space-y-2">
              {ranked
                .filter((r) => r.inv.lunar_habitat_relevant)
                .slice(0, 3)
                .map((r) => (
                  <div key={r.inv.psi_id} className="space-y-2 rounded-md border border-slate-700/60 bg-slate-900/40 p-2.5">
                  <button
                    onClick={() => onOpenDetail(r.inv)}
                    className="flex w-full items-center justify-between gap-2 text-left hover:text-cyan-300"
                  >
                    <span className="min-w-0">
                      <PsiIdTag id={r.inv.psi_id} />
                      <span className="ml-2 text-xs text-slate-200">{r.inv.title.split('(')[0].trim()}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {r.inv.safety_pillars.map((p) => (
                          <PillarBadge key={p} pillar={p} />
                        ))}
                        <Badge>{GRAVITY_REGIME_LABELS[r.inv.envelope.gravity_regime]}</Badge>
                      </span>
                    </span>
                    <span className="mono text-sm font-bold text-cyan-300">{r.score}%</span>
                  </button>
                  <CitationBlock inv={r.inv} compact />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
