"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { cn } from "cn"
import { InfoIcon, MapIcon } from "lucide-react"

import { ALL, FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { RoleGate } from "@/components/role-gate"
import { CellValue, SeverityBar, SeverityLegend } from "@/components/severity-bar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ageBandLabels,
  humanize,
  instrumentLabels,
  MAP_STEPS,
  MAP_SUPPRESSED,
  sectorLabels,
  SUPPRESSION_THRESHOLD,
} from "@/lib/labels"
import type { BarangayValue } from "@/components/barangay-map"
import {
  ageBands,
  barangayName,
  barangays,
  engagementMonthly,
  screeningHighByBarangay,
  months,
  moodWeekly,
  screeningBands,
  screeningBy,
  screeningTotal,
  sectors,
  severitiesFor,
  sexes,
  type ScreeningFilters,
} from "@/lib/mock-data"
import type { AgeBand, Sector, Sex } from "@/lib/types"

// Leaflet touches `window` on import, so the map only loads in the browser.
const BarangayMap = dynamic(() => import("@/components/barangay-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted" />,
})

type Instrument = "PHQ9" | "GAD7" | "WHO5"
type MapMetric = "HIGH" | "SCREENINGS" | "ESCALATIONS"
type GroupBy = "barangay_id" | "sector" | "age_band" | "sex"

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", year: "numeric", timeZone: "UTC" })

const groupLabels: Record<GroupBy, string> = {
  barangay_id: "Barangay",
  sector: "Sector",
  age_band: "Age band",
  sex: "Sex",
}

function keyLabel(groupBy: GroupBy, key: string | number) {
  if (groupBy === "barangay_id") return barangayName(key as number)
  if (groupBy === "sector") return sectorLabels[key as Sector]
  if (groupBy === "age_band") return ageBandLabels[key as AgeBand]
  return humanize(String(key))
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—")

export default function DashboardPage() {
  const [from, setFrom] = useState(String(months.length - 3))
  const [to, setTo] = useState(String(months.length - 1))
  const [barangay, setBarangay] = useState(ALL)
  const [sector, setSector] = useState(ALL)
  const [ageBand, setAgeBand] = useState(ALL)
  const [sex, setSex] = useState(ALL)
  const [instrument, setInstrument] = useState<Instrument>("PHQ9")
  const [groupBy, setGroupBy] = useState<GroupBy>("barangay_id")
  const [mapMetric, setMapMetric] = useState<MapMetric>("HIGH")

  const filters: ScreeningFilters = {
    fromMonth: Math.min(+from, +to),
    toMonth: Math.max(+from, +to),
    barangay_id: barangay === ALL ? undefined : +barangay,
    sector: sector === ALL ? undefined : (sector as Sector),
    age_band: ageBand === ALL ? undefined : (ageBand as AgeBand),
    sex: sex === ALL ? undefined : (sex as Sex),
  }
  const demographicFilter = sector !== ALL || ageBand !== ALL || sex !== ALL

  const total = screeningTotal(filters)
  const bands = screeningBands(filters, instrument)
  const rows = screeningBy(filters, instrument, groupBy)
  const order = severitiesFor[instrument]

  // Engagement is aggregated by barangay and month only (agg_engagement_monthly).
  const inRange = engagementMonthly.filter((e) => {
    const i = months.indexOf(e.period_month)
    return i >= filters.fromMonth && i <= filters.toMonth && (filters.barangay_id == null || e.barangay_id === filters.barangay_id)
  })
  const sum = (k: keyof (typeof inRange)[number]) => inRange.reduce((s, e) => s + (e[k] as number), 0)
  const engagement = {
    started: sum("assessments_started"),
    completed: sum("assessments_completed"),
    rescreens: sum("rescreens_completed"),
    suggested: sum("referrals_suggested"),
    initiated: sum("referrals_initiated"),
    escalations: sum("escalations_opened"),
  }

  const highBands = instrument === "WHO5" ? ["POOR", "LIKELY_DEPRESSION"] : ["MODERATE", "MODERATELY_SEVERE", "SEVERE"]
  const highVisible = highBands.every((b) => bands[b] && !bands[b].suppressed)
  const highCount = highBands.reduce((s, b) => s + (bands[b]?.count ?? 0), 0)

  // The map always shows every barangay; the barangay filter only highlights one.
  const cityScreening = screeningHighByBarangay({ ...filters, barangay_id: undefined }, instrument)
  const reached = cityScreening.filter((s) => !s.total.suppressed).length
  const scope = barangay === ALL ? "City-wide" : barangayName(+barangay)

  const monthOptions = months.map((m, i) => ({ value: String(i), label: monthLabel(m) }))

  return (
    <RoleGate allow={["ADMIN", "DPO"]}>
      <PageHeader
        title="Dashboard"
        description={`Aggregated, de-identified screening activity. Any cell with fewer than ${SUPPRESSION_THRESHOLD} people is hidden.`}
        actions={
          <Button render={<Link href="/reports" />} nativeButton={false}>
            Generate report
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="From" value={from} onChange={setFrom} options={monthOptions} className="w-36" />
          <FilterSelect label="To" value={to} onChange={setTo} options={monthOptions} className="w-36" />
          <FilterSelect
            label="Barangay"
            value={barangay}
            onChange={setBarangay}
            allLabel="All barangays"
            options={barangays.map((b) => ({ value: String(b.barangay_id), label: b.name }))}
          />
          <FilterSelect
            label="Sector"
            value={sector}
            onChange={setSector}
            allLabel="All sectors"
            options={sectors.map((s) => ({ value: s, label: sectorLabels[s] }))}
          />
          <FilterSelect
            label="Age band"
            value={ageBand}
            onChange={setAgeBand}
            allLabel="All ages"
            className="w-32"
            options={ageBands.map((a) => ({ value: a, label: ageBandLabels[a] }))}
          />
          <FilterSelect
            label="Sex"
            value={sex}
            onChange={setSex}
            allLabel="All"
            className="w-40"
            options={sexes.map((s) => ({ value: s, label: humanize(s) }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label={`${instrumentLabels[instrument]} moderate or higher`}
            value={highVisible ? highCount.toLocaleString() : "<5"}
            hint={`${scope} · ${highVisible ? `${pct(highCount, total.count ?? 0)} of screenings` : "hidden, fewer than 5"}`}
            active={mapMetric === "HIGH"}
            onClick={() => setMapMetric("HIGH")}
          />
          <Kpi
            label="Screenings completed"
            value={<CellValue cell={total} />}
            hint={`${scope} · ${pct(engagement.completed, engagement.started)} of started screenings finished`}
            active={mapMetric === "SCREENINGS"}
            onClick={() => setMapMetric("SCREENINGS")}
          />
          <Kpi
            label="High-risk escalations"
            value={engagement.escalations < SUPPRESSION_THRESHOLD ? "<5" : engagement.escalations.toLocaleString()}
            hint={`${scope} · sent to case officers${demographicFilter ? " · barangay and date filters only" : ""}`}
            active={mapMetric === "ESCALATIONS"}
            onClick={() => setMapMetric("ESCALATIONS")}
          />
          <Kpi
            label="Barangays reached"
            value={`${reached} / ${barangays.length}`}
            hint={`With ${SUPPRESSION_THRESHOLD} or more screenings; the rest show grey on the map`}
          />
        </div>

        <BarangayMapCard
          filters={filters}
          instrument={instrument}
          screening={cityScreening}
          metric={mapMetric}
          selectedId={filters.barangay_id}
          onSelect={(id) => setBarangay((prev) => (prev === String(id) ? ALL : String(id)))}
        />

        <Card>
          <CardHeader>
            <CardTitle>Severity distribution</CardTitle>
            <CardDescription>
              Each instrument is reported separately. Results are never combined into a single score.
            </CardDescription>
            <CardAction>
              <Tabs value={instrument} onValueChange={(v) => setInstrument(v as Instrument)}>
                <TabsList>
                  <TabsTrigger value="PHQ9">PHQ-9</TabsTrigger>
                  <TabsTrigger value="GAD7">GAD-7</TabsTrigger>
                  <TabsTrigger value="WHO5">WHO-5</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <SeverityBar total={total} bands={bands} order={order} />
              <SeverityLegend order={order} />
            </div>
            <div className="flex items-end justify-between gap-3">
              <h3 className="text-sm font-medium">Breakdown</h3>
              <FilterSelect
                label="Group by"
                value={groupBy}
                onChange={(v) => setGroupBy(v as GroupBy)}
                className="w-36"
                options={(Object.keys(groupLabels) as GroupBy[]).map((g) => ({ value: g, label: groupLabels[g] }))}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{groupLabels[groupBy]}</TableHead>
                  <TableHead className="text-right">People</TableHead>
                  {order.map((s) => (
                    <TableHead key={s} className="text-right">
                      {humanize(s)}
                    </TableHead>
                  ))}
                  <TableHead className="w-[28%] min-w-40">Distribution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={String(r.key)}>
                    <TableCell className="font-medium">{keyLabel(groupBy, r.key)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <CellValue cell={r.total} />
                    </TableCell>
                    {order.map((s) => (
                      <TableCell key={s} className="text-right tabular-nums">
                        <CellValue cell={r.bands[s]} />
                      </TableCell>
                    ))}
                    <TableCell>
                      <SeverityBar total={r.total} bands={r.bands} order={order} />
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={order.length + 3} className="py-8 text-center text-muted-foreground">
                      No screenings match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-5">
          <MoodTrend barangayId={filters.barangay_id} />
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Program activity</CardTitle>
              <CardDescription>
                {barangay === ALL ? "All barangays" : barangayName(+barangay)}, selected months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                {[
                  ["Screenings started", engagement.started],
                  ["Screenings completed", engagement.completed],
                  ["Repeat screenings", engagement.rescreens],
                  ["Referrals shown", engagement.suggested],
                  ["Referrals acted on", engagement.initiated],
                  ["High-risk escalations", engagement.escalations],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium tabular-nums">
                      {(v as number) < SUPPRESSION_THRESHOLD ? "<5" : v.toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>
              {demographicFilter && (
                <p className="mt-3 flex gap-1.5 text-xs text-muted-foreground">
                  <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                  Activity counts are kept by barangay and month only, so sector, age and sex filters don&apos;t apply here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </RoleGate>
  )
}

function BarangayMapCard({
  filters,
  instrument,
  screening,
  metric,
  selectedId,
  onSelect,
}: {
  filters: ScreeningFilters
  instrument: Instrument
  screening: ReturnType<typeof screeningHighByBarangay>
  metric: MapMetric
  selectedId?: number
  onSelect: (id: number) => void
}) {
  const metricLabels: Record<MapMetric, string> = {
    HIGH: `${instrumentLabels[instrument]} moderate or higher`,
    SCREENINGS: "Screenings completed",
    ESCALATIONS: "High-risk escalations",
  }

  const points = barangays.map((b) => {
    const s = screening.find((x) => x.barangay_id === b.barangay_id)!
    let cell = s.total
    let detail: string | undefined
    if (metric === "HIGH") {
      cell = s.high
      if (!s.high.suppressed && !s.total.suppressed && s.total.count)
        detail = `${Math.round((s.high.count! / s.total.count) * 100)}% of ${s.total.count} screened`
    } else if (metric === "ESCALATIONS") {
      // Escalation counts come from agg_engagement_monthly, which has no sector/age/sex split.
      const n = engagementMonthly
        .filter((e) => {
          const i = months.indexOf(e.period_month)
          return e.barangay_id === b.barangay_id && i >= filters.fromMonth && i <= filters.toMonth
        })
        .reduce((sum, e) => sum + e.escalations_opened, 0)
      cell = n < SUPPRESSION_THRESHOLD ? { count: null, suppressed: true } : { count: n, suppressed: false }
    }
    return { barangay_id: b.barangay_id, name: b.name, cell, detail }
  })
  const values: Record<number, BarangayValue> = Object.fromEntries(points.map((p) => [p.barangay_id, p]))
  const ranked = [...points].sort((a, b) => (b.cell.count ?? -1) - (a.cell.count ?? -1) || a.name.localeCompare(b.name))
  const max = Math.max(1, ...points.map((p) => p.cell.count ?? 0))
  const hiddenCount = points.filter((p) => p.cell.suppressed).length
  const stepLabel = (i: number) =>
    `${Math.ceil((max * i) / MAP_STEPS.length)}–${i === MAP_STEPS.length - 1 ? max : Math.ceil((max * (i + 1)) / MAP_STEPS.length) - 1}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>{metricLabels[metric]} by barangay</CardTitle>
        <CardDescription>
          All {barangays.length} barangays, shaded by count for the selected filters. Darker means more people. Pick a
          card above to change what the map shows; click a barangay to filter the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <div className="h-96 lg:h-120">
            <BarangayMap values={values} metricLabel={metricLabels[metric]} selectedId={selectedId} onSelect={onSelect} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {MAP_STEPS.map((c, i) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm border" style={{ background: c }} />
                <span className="tabular-nums">{stepLabel(i)}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-dashed border-gray-500" style={{ background: MAP_SUPPRESSED }} />
              Hidden (&lt;5) · {hiddenCount} barangays
            </span>
          </div>
        </div>
        <ol className="max-h-120 space-y-1 overflow-y-auto pr-1 text-sm">
          {ranked.map((p) => (
            <li key={p.barangay_id}>
              <button
                type="button"
                onClick={() => onSelect(p.barangay_id)}
                className={`w-full rounded-md px-2 py-1.5 text-left hover:bg-muted ${p.barangay_id === selectedId ? "bg-muted" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular-nums">
                    <CellValue cell={p.cell} />
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  {!p.cell.suppressed && (
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${((p.cell.count ?? 0) / max) * 100}%` }} />
                  )}
                </div>
              </button>
            </li>
          ))}
        </ol>
        {metric === "ESCALATIONS" && (filters.sector != null || filters.age_band != null || filters.sex != null) && (
          <p className="flex gap-1.5 text-xs text-muted-foreground lg:col-span-3">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            Escalation counts are kept by barangay and month only, so sector, age and sex filters don&apos;t apply.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Kpi({
  label,
  value,
  hint,
  active,
  onClick,
}: {
  label: string
  value: React.ReactNode
  hint: string
  active?: boolean
  /** When set, the card switches the map to this metric. */
  onClick?: () => void
}) {
  const card = (
    <Card size="sm" className={cn("h-full", active && "ring-2 ring-primary")}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">{value}</CardTitle>
        {onClick && (
          <CardAction>
            <MapIcon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        {hint}
        {active && <span className="mt-1 block font-medium text-primary">Shown on map</span>}
      </CardContent>
    </Card>
  )
  if (!onClick) return card
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-xl text-left transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary"
    >
      {card}
    </button>
  )
}

/** Weekly average mood (agg_mood_weekly). Suppressed weeks break the line. */
function MoodTrend({ barangayId }: { barangayId?: number }) {
  const weeks = [...new Set(moodWeekly.map((m) => m.period_week))]
  const points = weeks.map((w) => {
    const rows = moodWeekly.filter((m) => m.period_week === w && (barangayId == null || m.barangay_id === barangayId))
    const shown = rows.filter((r) => !r.suppressed)
    const n = shown.reduce((s, r) => s + (r.user_count ?? 0), 0)
    if (n < SUPPRESSION_THRESHOLD) return { week: w, value: null as number | null, n }
    return { week: w, value: shown.reduce((s, r) => s + (r.avg_mood ?? 0) * (r.user_count ?? 0), 0) / n, n }
  })

  const W = 560
  const H = 180
  const pad = { l: 28, r: 8, t: 10, b: 22 }
  const min = 1
  const max = 10
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)

  const segments: string[] = []
  let current = ""
  points.forEach((p, i) => {
    if (p.value == null) {
      if (current) segments.push(current)
      current = ""
    } else current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`
  })
  if (current) segments.push(current)

  const last = [...points].reverse().find((p) => p.value != null)

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Mood check-in trend</CardTitle>
        <CardDescription>
          Weekly average of the 1–10 mood tracker. A tracker, not an assessment: it never sets severity.
        </CardDescription>
        {last?.value != null && (
          <CardAction className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{last.value.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">latest week</p>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Weekly average mood">
          {[2, 4, 6, 8, 10].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray="2 4" />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {v}
              </text>
            </g>
          ))}
          {segments.map((d, i) => (
            <path key={i} d={d} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" />
          ))}
          {points.map((p, i) =>
            p.value == null ? null : (
              <circle key={p.week} cx={x(i)} cy={y(p.value)} r={3} className="fill-background stroke-primary" strokeWidth={2}>
                <title>{`Week of ${p.week}: ${p.value.toFixed(1)} (${p.n} people)`}</title>
              </circle>
            ),
          )}
          {points.map((p, i) =>
            i % 3 === 0 ? (
              <text key={p.week} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {new Date(p.week).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" })}
              </text>
            ) : null,
          )}
        </svg>
      </CardContent>
    </Card>
  )
}
