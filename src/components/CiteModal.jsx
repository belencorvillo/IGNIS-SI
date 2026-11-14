import { CopyButton, Modal, PsiIdTag } from './ui'
import { SOURCE_LABELS, citationFor } from '../data/investigations'

export default function CiteModal({ open, onClose, investigations, source }) {
  const all = investigations.map((i) => `[${i.psi_id}] ${citationFor(i)}`).join('\n\n')
  const src = SOURCE_LABELS[source]
  return (
    <Modal open={open} onClose={onClose} title="Cite Active Datasets (DOIs)">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {investigations.length} investigations from NASA Physical Sciences Informatics (PSI) · source: <span className="text-slate-200">{src?.detail}</span>
        </p>
        <CopyButton text={all} label="Copy all citations" />
      </div>
      <ol className="space-y-2">
        {investigations.map((i) => {
          const c = citationFor(i)
          return (
            <li key={i.psi_id} className="flex items-start gap-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
              <PsiIdTag id={i.psi_id} />
              <p className="mono min-w-0 flex-1 break-words text-[11px] leading-snug text-slate-300">{c}</p>
              <CopyButton text={c} />
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}
