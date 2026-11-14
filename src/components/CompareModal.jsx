import { ArrowRightLeft, Equal, GitCompareArrows } from 'lucide-react'
import { Badge, CitationBlock, Modal, PsiIdTag } from './ui'
import { MediaPanel } from './InvestigationDetail'
import { FUEL_PHASE_LABELS, RACK_LABELS, envelopeSummary, GRAVITY_REGIME_LABELS } from '../data/investigations'

const EMPTY = '—'
const list = (arr) => (arr.length ? [...arr].sort().join(', ') : EMPTY)

// Rows whose values are empty for every selected investigation are hidden
// (e.g. objectives/approach are optional and absent from catalogo_limpio.json).
const ROWS = [
  { key: 'objectives', label: 'Objectives', get: (i) => i.objectives || EMPTY, long: true },
  { key: 'approach', label: 'Approach', get: (i) => i.approach || EMPTY, long: true },
  { key: 'findings', label: 'Key findings (SI-Assisted)', get: (i) => i.key_findings_summary || EMPTY, long: true },
  { key: 'fuels', label: 'Fuels tested', get: (i) => list(i.fuels_tested) },
  { key: 'sensors', label: 'Sensors', get: (i) => list(i.sensors_used) },
  { key: 'project_type', label: 'Project type', get: (i) => i.project_type },
  { key: 'hardware', label: 'Hardware', get: (i) => RACK_LABELS[i.hardware_rack] },
  { key: 'fuel', label: 'Fuel phase', get: (i) => FUEL_PHASE_LABELS[i.fuel_phase] },
  { key: 'pillars', label: 'Safety pillars', get: (i) => [...i.safety_pillars].sort().join(', ') || '—' },
  { key: 'o2', label: 'O₂ range', get: (i) => envelopeSummary(i.envelope).o2 },
  { key: 'pressure', label: 'Pressure range', get: (i) => envelopeSummary(i.envelope).pressure },
  { key: 'airflow', label: 'Airflow range', get: (i) => envelopeSummary(i.envelope).airflow },
  { key: 'gravity', label: 'Gravity regime', get: (i) => GRAVITY_REGIME_LABELS[i.envelope.gravity_regime] },
  { key: 'lunar', label: 'Lunar-relevant', get: (i) => (i.lunar_habitat_relevant ? 'Yes' : 'No') },
  { key: 'related', label: 'Related PSI IDs', get: (i) => list(i.related_psi_ids) },
]

function Matrix({ rows, items, tone }) {
  if (!rows.length) return <p className="text-xs text-slate-500">None.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 w-36 bg-[#0b1120] p-2 text-left text-[10px] uppercase tracking-wider text-slate-500">Attribute</th>
            {items.map((i) => (
              <th key={i.psi_id} className="p-2 text-left">
                <PsiIdTag id={i.psi_id} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="sticky left-0 border-t border-slate-800 bg-[#0b1120] p-2 align-top font-medium text-slate-400">{r.label}</td>
              {items.map((i) => (
                <td
                  key={i.psi_id}
                  className={`border-t border-slate-800 p-2 align-top ${tone === 'changed' ? 'text-amber-100' : 'text-slate-300'} ${r.long ? 'leading-relaxed' : 'mono'}`}
                >
                  {r.get(i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function crossLinks(items) {
  const ids = new Set(items.map((i) => i.psi_id))
  const links = []
  for (const a of items) {
    for (const id of a.related_psi_ids) {
      if (!ids.has(id)) continue
      const b = items.find((x) => x.psi_id === id)
      const aGround = a.project_type === 'Ground Investigation'
      const bGround = b.project_type === 'Ground Investigation'
      links.push({ from: a.psi_id, to: id, kind: aGround !== bGround ? 'Ground ↔ Flight' : aGround ? 'Ground ↔ Ground' : 'Flight ↔ Flight' })
    }
  }
  return links
}

export default function CompareModal({ open, onClose, items }) {
  if (!open) return null
  const changed = []
  const same = []
  for (const r of ROWS) {
    const values = new Set(items.map((i) => r.get(i)))
    if (values.size === 1 && values.has(EMPTY)) continue
    ;(values.size > 1 ? changed : same).push(r)
  }
  const links = crossLinks(items)

  return (
    <Modal open={open} onClose={onClose} title="Compare Investigations" wide>
      <div className="space-y-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}>
          {items.map((i) => (
            <div key={i.psi_id} className="space-y-2 rounded-lg border border-slate-700/60 p-3">
              <div className="text-sm font-semibold leading-snug text-slate-100">{i.title}</div>
              <CitationBlock inv={i} />
            </div>
          ))}
        </div>

        <section>
          <h3 className="heading-font mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
            <ArrowRightLeft size={15} /> What Changed <Badge tone="amber">{changed.length}</Badge>
          </h3>
          <Matrix rows={changed} items={items} tone="changed" />
        </section>

        <section>
          <h3 className="heading-font mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Equal size={15} /> What Stayed the Same <Badge tone="emerald">{same.length}</Badge>
          </h3>
          <Matrix rows={same} items={items} tone="same" />
        </section>

        <section>
          <h3 className="heading-font mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-300">
            <GitCompareArrows size={15} /> Ground-to-Flight Links Within Selection
          </h3>
          {links.length ? (
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <span key={`${l.from}-${l.to}`} className="mono rounded-md border border-cyan-400/30 bg-cyan-400/5 px-2 py-1 text-[11px] text-cyan-200">
                  {l.from} → {l.to} <span className="text-slate-400">({l.kind})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">The selected investigations do not reference each other in related_psi_ids.</p>
          )}
        </section>

        <section>
          <h3 className="heading-font mb-2 text-sm font-semibold text-slate-200">Video & CV Telemetry Preview</h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))` }}>
            {items.map((i) => (
              <div key={i.psi_id}>
                <div className="mb-1">
                  <PsiIdTag id={i.psi_id} />
                </div>
                <MediaPanel inv={i} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}
