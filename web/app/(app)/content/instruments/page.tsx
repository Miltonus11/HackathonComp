"use client"

import { InfoIcon, SirenIcon } from "lucide-react"

import { PageBody, PageHeader } from "@/components/page-header"
import { SeverityBadge, ToneBadge } from "@/components/tone-badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { instrumentLabels } from "@/lib/labels"
import { instruments, severityBands } from "@/lib/mock-data"

export default function InstrumentsPage() {
  return (
    <>
      <PageHeader
        title="Instruments and scoring"
        description="Validated screening instruments and their severity bands. Scoring is rule-based and versioned, and AI never sets severity."
      />
      <PageBody>
        <div className="flex gap-2 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            Read-only. Changing a band changes clinical results, so it ships as a new <code>scoring_version</code>{" "}
            through code review, not as a content edit. Older results keep the version they were scored with. WHO-5 bands
            and recall periods are marked [VERIFY].
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {instruments.map((i) => {
            const bands = severityBands.filter((b) => b.instrument_id === i.instrument_id)
            return (
              <Card key={i.instrument_id}>
                <CardHeader>
                  <CardTitle>{instrumentLabels[i.code]}</CardTitle>
                  <CardDescription>{i.name}</CardDescription>
                  <CardAction>
                    <ToneBadge tone="neutral">{i.scoring_version}</ToneBadge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Items</dt>
                      <dd>
                        {i.item_count} × {i.min_response}–{i.max_response}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Direction</dt>
                      <dd>{i.score_direction === "HIGHER_BETTER" ? "Higher is better" : "Higher is worse"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Recall period</dt>
                      <dd>{i.recall_period_days ? `${i.recall_period_days} days` : "—"}</dd>
                    </div>
                  </dl>
                  {bands.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{i.code === "WHO5" ? "Scaled score (0–100)" : "Total score"}</TableHead>
                          <TableHead>Band</TableHead>
                          <TableHead>Crisis flow</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bands.map((b) => (
                          <TableRow key={b.band_id}>
                            <TableCell className="tabular-nums">
                              {b.min_value}–{b.max_value}
                            </TableCell>
                            <TableCell>
                              <SeverityBadge code={b.severity_code} />
                            </TableCell>
                            <TableCell>
                              {b.triggers_crisis_flow ? <SirenIcon className="size-4 text-red-600" aria-label="Triggers crisis flow" /> : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Short screen. A positive result prompts the full {i.code === "PHQ2" ? "PHQ-9" : "GAD-7"}.
                    </p>
                  )}
                  {i.code === "PHQ9" && (
                    <p className="flex gap-1.5 text-xs text-red-700 dark:text-red-400">
                      <SirenIcon className="mt-0.5 size-3.5 shrink-0" />
                      Item 9 above 0 always triggers the crisis flow, whatever the total.
                    </p>
                  )}
                  {i.source_citation && <p className="text-xs text-muted-foreground">{i.source_citation}</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </PageBody>
    </>
  )
}
