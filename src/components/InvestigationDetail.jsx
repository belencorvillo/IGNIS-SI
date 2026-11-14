import { useEffect, useState } from 'react'
import { Film, Link2, X } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, CitationBlock, LunarBadge, PillarBadge, PsiIdTag, SIBadge } from './ui'
import { FUEL_PHASE_LABELS, RACK_LABELS, envelopeSummary, loadTelemetry } from '../data/investigations'

/** Video / CV telemetry preview. Shows telemetry curves from contracts/data/cv_telemetry when available. */
export function MediaPanel({ inv }) {
  const [telemetry, setTelemetry] = useState(null)
  const [videoOk, setVideoOk] = useState(true)
  useEffect(() => {
    let alive = true
    loadTelemetry(inv).then((t) => alive && setTelemetry(t))
    return () => {
      alive = false
    }
  }, [inv])

  if (!inv.video_filename && !telemetry) {
    return <div className="rounded-lg border border-dashed border-slate-700 p-3 text-[11px] text-slate-500">No video or CV telemetry for this investigation.</div>
  }
  return (
    <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
          <Film size={13} className="text-cyan-400" /> Video / CV telemetry
        </span>
        {telemetry && <SIBadge />}
      </div>
      {inv.video_filename && (
        <>
          {videoOk ? (
            <video
              src={`/videos/${inv.video_filename}`}
              controls
              muted
              preload="metadata"
              onError={() => setVideoOk(false)}
              className="aspect-video w-full rounded-md bg-black"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md bg-slate-950 text-center text-[11px] text-slate-500">
              Video file not yet published
              <br />
              <span className="mono text-slate-400">{inv.video_filename}</span>
            </div>
          )}
        </>
      )}
      {telemetry ? (
        <div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry.points} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="time_s" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <YAxis yAxisId="d" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <YAxis yAxisId="s" orientation="right" domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <Tooltip contentStyle={{ background: '#0b1120', border: '1px solid #334155', fontSize: 11 }} />
                <Line yAxisId="d" dataKey="equivalent_diameter_mm" name="Diameter (mm)" stroke="#f97316" dot={false} />
                <Line yAxisId="s" dataKey="sphericity_index" name="Sphericity" stroke="#38bdf8" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-500">CV-extracted from video · {telemetry.file}</p>
        </div>
      ) : (
        <p className="text-[10px] text-slate-500">CV telemetry curve pending (contracts/data/cv_telemetry/).</p>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm leading-relaxed text-slate-200">{children}</div>
    </div>
  )
}

export default function InvestigationDetail({ inv, catalog, onClose, onOpen }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!inv) return null
  const env = envelopeSummary(inv.envelope)
  const byId = new Map(catalog.map((x) => [x.psi_id, x]))

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="fade-in h-full w-full max-w-xl overflow-y-auto border-l border-cyan-500/20 bg-[#070c18] p-5"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Investigation ${inv.psi_id}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <PsiIdTag id={inv.psi_id} />
              <Badge tone="cyan">{inv.project_type}</Badge>
              {inv.lunar_habitat_relevant && <LunarBadge />}
            </div>
            <h2 className="heading-font text-lg font-semibold leading-snug text-white">{inv.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <CitationBlock inv={inv} />

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {inv.safety_pillars.map((p) => (
              <PillarBadge key={p} pillar={p} />
            ))}
            <Badge>{RACK_LABELS[inv.hardware_rack]}</Badge>
            <Badge>{FUEL_PHASE_LABELS[inv.fuel_phase]}</Badge>
          </div>
          {inv.objectives && <Field label="Objectives">{inv.objectives}</Field>}
          {inv.approach && <Field label="Approach">{inv.approach}</Field>}
          {inv.key_findings_summary && (
            <div className="rounded-lg border border-fuchsia-400/25 bg-fuchsia-500/5 p-3">
              <SIBadge className="mb-2" />
              <p className="text-sm text-slate-200">{inv.key_findings_summary}</p>
              <p className="mt-1 text-[10px] text-slate-500">Verify against the cited PSI source.</p>
            </div>
          )}

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tested envelope</div>
            <table className="mono w-full text-xs text-slate-300">
              <tbody>
                {[
                  ['Oxygen', env.o2],
                  ['Pressure', env.pressure],
                  ['Forced airflow', env.airflow],
                  ['Gravity regime', env.gravity],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-800">
                    <td className="py-1.5 text-slate-500">{k}</td>
                    <td className="py-1.5 text-right">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inv.fuels_tested.length > 0 && <Field label="Fuels tested">{inv.fuels_tested.join(', ')}</Field>}
          {inv.sensors_used.length > 0 && <Field label="Sensors">{inv.sensors_used.join(', ')}</Field>}
          {inv.variables_compared && <Field label="Variables compared">{inv.variables_compared}</Field>}
          {inv.earth_spinoff_applications.length > 0 && <Field label="Earth spin-off applications">{inv.earth_spinoff_applications.join(' · ')}</Field>}

          {inv.related_psi_ids.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Link2 size={11} /> Related investigations (ground ↔ flight links)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {inv.related_psi_ids.map((id) => {
                  const rel = byId.get(id)
                  return rel ? (
                    <button
                      key={id}
                      onClick={() => onOpen(rel)}
                      className="rounded-md border border-cyan-400/30 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-400/10"
                      title={rel.title}
                    >
                      {id} · {rel.project_type === 'Ground Investigation' ? 'Ground' : 'Flight'}
                    </button>
                  ) : (
                    <span key={id} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-500" title="Not in the current catalog">
                      {id}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          <MediaPanel inv={inv} />
        </div>
      </aside>
    </div>
  )
}
