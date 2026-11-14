import { useState } from 'react'
import { CiteInline, More, PsiId, SectionHead } from '../../shared/ui'
import { SPINOFFS } from './spinoffs'

function Evidence({ linked, onOpen }) {
  const [all, setAll] = useState(false)
  if (!linked.length) return <p className="text-[14px] text-faint">No matching investigations in this catalog.</p>
  const shown = all ? linked : linked.slice(0, 3)
  return (
    <div>
      <ul className="border-t border-line">
        {shown.map((inv) => (
          <li key={inv.psi_id} className="flex items-center justify-between gap-4 border-b border-line py-3">
            <button type="button" onClick={() => onOpen(inv)} className="flex min-w-0 items-baseline gap-3 text-left hover:text-ink">
              <PsiId id={inv.psi_id} className="shrink-0" />
              <span className="truncate text-[14px] text-muted hover:text-ink">{inv.title}</span>
            </button>
            <CiteInline inv={inv} />
          </li>
        ))}
      </ul>
      {linked.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="link mt-3 text-[14px]">
          {all ? 'Show fewer' : `All ${linked.length} investigations`}
        </button>
      )}
    </div>
  )
}

function groupApplications(investigations) {
  const map = new Map()
  for (const inv of investigations)
    for (const app of inv.earth_spinoff_applications) {
      if (!map.has(app)) map.set(app, [])
      map.get(app).push(inv)
    }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
}

export default function EarthPage({ investigations, onOpenDetail }) {
  const groups = groupApplications(investigations)

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-32 pt-16 md:px-8 md:pt-24">
      <SectionHead index="On Earth" title="What orbit teaches the ground">
        Without buoyancy, fire shows physics that gravity hides. Those lessons come back down.
      </SectionHead>

      <ol>
        {SPINOFFS.map((s, n) => (
          <li key={s.id} className="grid gap-8 border-t border-line py-16 lg:grid-cols-[120px_1fr_1fr] lg:gap-16">
            <span className="num text-[56px] font-light leading-none text-faint">{String(n + 1).padStart(2, '0')}</span>
            <div>
              <h3 className="text-[clamp(28px,3.4vw,40px)] font-medium">{s.title}</h3>
              <p className="mt-3 text-[18px] text-muted">{s.lede}</p>
              <More summary="Read more" className="mt-6">
                <p className="measure text-[15px] text-muted">{s.body}</p>
              </More>
            </div>
            <div>
              <div className="label mb-3">Evidence</div>
              <Evidence linked={investigations.filter(s.match)} onOpen={onOpenDetail} />
            </div>
          </li>
        ))}
      </ol>

      <p className="label mt-2 normal-case tracking-normal">Editorial context, not PSI data. Verify claims against the cited sources and NASA Spinoff.</p>

      {groups.length > 0 && (
        <section className="mt-24 border-t border-line pt-16">
          <div className="label mb-2">Reported in the dataset</div>
          <h3 className="mb-10 text-[28px] font-medium">Applications listed by the investigations</h3>
          <ul className="grid gap-x-16 md:grid-cols-2">
            {groups.map(([app, invs]) => (
              <li key={app} className="border-b border-line py-5">
                <More
                  summary={
                    <span className="flex w-full items-baseline justify-between gap-4">
                      <span className="text-[16px] text-ink">{app}</span>
                      <span className="num text-[13px] text-faint">{invs.length}</span>
                    </span>
                  }
                >
                  <ul className="flex flex-wrap gap-x-3 gap-y-1 pl-5">
                    {invs.map((inv) => (
                      <li key={inv.psi_id}>
                        <button type="button" onClick={() => onOpenDetail(inv)} title={inv.title} className="num text-[13px] text-muted hover:text-ink">
                          {inv.psi_id}
                        </button>
                      </li>
                    ))}
                  </ul>
                </More>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
