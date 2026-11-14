import { useState } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { More, SITag } from '../../shared/ui'

/**
 * Details of the node the camera has flown to. Rendered in the left column of
 * the Library stage, in place of the page title, so the graph stays uncovered.
 * `focus` comes from KnowledgeGraph3D's onFocus callback.
 */
export default function NodeDetails({ focus, onOpenInvestigation }) {
  const { node, kindLabel, match, neighbors, pick, close } = focus
  const [expanded, setExpanded] = useState(false)
  const isFile = node.kind !== 'tag'
  const summary = node.info.summary ?? match?.description

  return (
    <div className="rise max-w-[440px]">
      <button type="button" onClick={close} className="label mb-4 inline-flex items-center gap-2 transition-colors hover:!text-ink">
        <ArrowLeft size={13} aria-hidden="true" /> Back to the catalogue
      </button>

      <span className="label flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: node.color }} aria-hidden="true" />
        {kindLabel}
      </span>
      <h2 className="mt-3 break-words text-[clamp(26px,2.8vw,42px)] font-light leading-[1.05] text-ink">{node.info.title ?? node.text}</h2>
      {isFile && <p className="num mt-3 break-all text-[12px] text-faint">{node.label}</p>}

      <div className="mt-6 max-h-[42vh] space-y-5 overflow-y-auto overscroll-contain pr-2">
        {match && (
          <p className="num border-l-2 border-nasa-red pl-3 text-[12px] leading-relaxed text-muted">
            <span className="text-nasa-red">Search match</span>
            {match.score != null && <> · score {match.score}</>}
            {match.matches && (
              <>
                <br />
                {String(match.matches)}
              </>
            )}
          </p>
        )}

        {summary && (
          <div>
            <SITag />
            <p className={`mt-2 text-[16px] leading-relaxed text-ink/85 ${expanded ? '' : 'line-clamp-3'}`}>{summary}</p>
            <button type="button" onClick={() => setExpanded((v) => !v)} className="link mt-1 text-[14px] text-muted">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        )}

        <More
          summary={
            <span className="flex items-baseline gap-2">
              <span className="label">Connected</span>
              <span className="num text-[12px] text-faint">{neighbors.length}</span>
            </span>
          }
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {neighbors.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => pick(n.index)} className="inline-flex items-center gap-1.5 text-[14px] text-ink/80 transition-colors hover:text-ink">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.color }} aria-hidden="true" />
                  {n.text}
                </button>
              </li>
            ))}
          </ul>
        </More>

        {node.isPsi && (
          <button type="button" onClick={() => onOpenInvestigation?.(node)} className="link inline-flex items-center gap-1 text-[15px] text-ink">
            Open investigation <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
