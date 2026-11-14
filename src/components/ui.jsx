import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Sparkles, Info, ShieldCheck, Eye, Droplets, Moon } from 'lucide-react'
import { citationFor } from '../data/investigations'

const TONES = {
  cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  red: 'border-red-400/30 bg-red-400/10 text-red-300',
  violet: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  slate: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
}

export function Badge({ tone = 'slate', children, title, className = '' }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

const PILLAR_META = {
  Prevention: { tone: 'emerald', Icon: ShieldCheck },
  Detection: { tone: 'cyan', Icon: Eye },
  Suppression: { tone: 'violet', Icon: Droplets },
}

export function PillarBadge({ pillar }) {
  const meta = PILLAR_META[pillar] || { tone: 'slate', Icon: Info }
  return (
    <Badge tone={meta.tone}>
      <meta.Icon size={11} /> {pillar}
    </Badge>
  )
}

export function LunarBadge() {
  return (
    <Badge tone="amber" title="Flagged as relevant to lunar habitats / pressurized rovers (O₂ ≥ 30%, ≤ 10.2 psi)">
      <Moon size={11} /> Lunar-relevant
    </Badge>
  )
}

export function PsiIdTag({ id }) {
  return <span className="mono rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-300">{id}</span>
}

/** "SI-Assisted Analysis" disclosure — required on every SI-generated insight. */
export function SIBadge({ className = '' }) {
  return (
    <span
      title="This content was generated or classified with Space Intelligence (SI) assistance and should be verified against the cited PSI source."
      className={`inline-flex items-center gap-1 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300 ${className}`}
    >
      <Sparkles size={10} /> SI-Assisted Analysis
    </span>
  )
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation()
        if (await copyText(text)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        }
      }}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-cyan-400/30 px-2 py-1 text-[11px] font-medium text-cyan-300 transition hover:bg-cyan-400/10 ${className}`}
      aria-label={label}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

/** psi_id + full DOI citation + one-click copy. Shown on every investigation surface. */
export function CitationBlock({ inv, compact = false }) {
  const citation = citationFor(inv)
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Cite this Investigation · <PsiIdTag id={inv.psi_id} />
        </span>
        <div className="flex items-center gap-1">
          {inv.psi_url && (
            <a
              href={inv.psi_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/50"
            >
              PSI <ExternalLink size={11} />
            </a>
          )}
          <CopyButton text={citation} label="Copy" />
        </div>
      </div>
      <p className={`mono break-words text-[11px] leading-snug text-slate-300 ${compact ? 'line-clamp-2' : ''}`} title={citation}>
        {citation}
      </p>
      {!inv.doi_citation && <p className="mt-1 text-[10px] text-amber-300">Official DOI citation not provided in dataset.</p>}
    </div>
  )
}

export function ScopeNote({ className = '' }) {
  return (
    <p className={`text-[11px] leading-snug text-slate-400 ${className}`}>
      <strong className="text-slate-300">Technical scope:</strong> rocket engines and propellants are excluded — their high
      flow velocities make combustion effectively gravity-independent, so microgravity findings do not transfer.
    </p>
  )
}

export function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="heading-font flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-100">
        {Icon && <Icon size={16} className="text-cyan-400" />}
        {children}
      </h3>
      {right}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`glass-panel fade-in my-8 w-full ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-3">
          <h2 className="heading-font text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
