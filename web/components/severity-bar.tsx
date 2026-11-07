import { humanize, severityBarClass } from "@/lib/labels"
import type { Cell } from "@/lib/mock-data"
import type { SeverityCode } from "@/lib/types"

const hatch =
  "bg-[repeating-linear-gradient(45deg,var(--muted)_0_4px,var(--border)_4px_8px)]"

/**
 * Stacked bar of severity bands. Suppressed bands are merged into one hatched
 * "hidden" segment, so no individual small cell can be read from the bar.
 */
export function SeverityBar({
  total,
  bands,
  order,
}: {
  total: Cell
  bands: Record<string, Cell>
  order: SeverityCode[]
}) {
  const count = total.count
  if (total.suppressed || !count) {
    return <div className={`h-3 w-full rounded-full ${hatch}`} title="Hidden: fewer than 5 people" />
  }
  const visible = order.filter((s) => !bands[s].suppressed)
  const shown = visible.reduce((sum, s) => sum + (bands[s].count ?? 0), 0)
  const hiddenPct = ((count - shown) / count) * 100

  return (
    <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-muted">
      {visible.map((s) => {
        const pct = ((bands[s].count ?? 0) / count) * 100
        return (
          <div
            key={s}
            className={severityBarClass[s]}
            style={{ width: `${pct}%` }}
            title={`${humanize(s)}: ${bands[s].count} (${pct.toFixed(0)}%)`}
          />
        )
      })}
      {hiddenPct > 0 && (
        <div className={hatch} style={{ width: `${hiddenPct}%` }} title="Hidden: small cells suppressed" />
      )}
    </div>
  )
}

export function SeverityLegend({ order }: { order: SeverityCode[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {order.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`size-2.5 rounded-sm ${severityBarClass[s]}`} />
          {humanize(s)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className={`size-2.5 rounded-sm ${hatch}`} />
        Hidden (&lt;5)
      </span>
    </div>
  )
}

/** Renders a count, or "<5" for a suppressed cell. */
export function CellValue({ cell }: { cell: Cell }) {
  if (cell.suppressed) return <span className="text-muted-foreground" title="Fewer than 5 people">&lt;5</span>
  return <>{cell.count?.toLocaleString()}</>
}
