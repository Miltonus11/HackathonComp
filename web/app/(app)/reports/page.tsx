"use client"

import { useState } from "react"
import { DownloadIcon, PlusIcon, SparklesIcon } from "lucide-react"

import { ALL, FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { RoleGate } from "@/components/role-gate"
import { ToneBadge } from "@/components/tone-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ageBandLabels, formatDate, formatDateTime, humanize, sectorLabels, SUPPRESSION_THRESHOLD } from "@/lib/labels"
import { ageBands, barangayName, barangays, reports as seedReports, sectors, staffName } from "@/lib/mock-data"
import type { AgeBand, Report, ReportType, Sector } from "@/lib/types"

const reportTypes: ReportType[] = ["SEVERITY_BY_BARANGAY", "SECTOR_SUMMARY", "ENGAGEMENT", "TREND", "CUSTOM"]

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>(seedReports)
  const [open, setOpen] = useState(false)

  return (
    <RoleGate allow={["ADMIN", "DPO"]}>
      <PageHeader
        title="Reports"
        description={`PDF and CSV exports from the analytics store. Exports follow the same rule as the dashboard: cells under ${SUPPRESSION_THRESHOLD} people are hidden.`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <PlusIcon />
              Generate report
            </DialogTrigger>
            <GenerateReportDialog
              onCreate={(r) => {
                setReports((prev) => [r, ...prev])
                setOpen(false)
              }}
            />
          </Dialog>
        }
      />
      <PageBody>
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Filters</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.report_id} className="align-top">
                    <TableCell className="max-w-md whitespace-normal">
                      <p className="font-medium">{humanize(r.report_type)}</p>
                      {r.ai_summary_text && (
                        <p className="mt-1 flex gap-1.5 text-xs text-muted-foreground">
                          <SparklesIcon className="mt-0.5 size-3 shrink-0" />
                          {r.ai_summary_text}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <p>
                        {formatDate(r.filters_json.from)} – {formatDate(r.filters_json.to)}
                      </p>
                      <p>
                        {[
                          r.filters_json.barangay_id != null && barangayName(r.filters_json.barangay_id),
                          r.filters_json.sector && sectorLabels[r.filters_json.sector],
                          r.filters_json.age_band && ageBandLabels[r.filters_json.age_band],
                        ]
                          .filter(Boolean)
                          .join(" · ") || "All areas and groups"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone="neutral">{r.format}</ToneBadge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>{formatDateTime(r.generated_at)}</p>
                      <p className="text-muted-foreground">{staffName(r.generated_by)}</p>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" disabled={!r.file_ref}>
                        <DownloadIcon />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </RoleGate>
  )
}

function GenerateReportDialog({ onCreate }: { onCreate: (r: Report) => void }) {
  const [type, setType] = useState<ReportType>("SEVERITY_BY_BARANGAY")
  const [from, setFrom] = useState("2026-08-01")
  const [to, setTo] = useState("2026-10-31")
  const [barangay, setBarangay] = useState(ALL)
  const [sector, setSector] = useState(ALL)
  const [ageBand, setAgeBand] = useState(ALL)
  const [format, setFormat] = useState<"PDF" | "CSV">("PDF")
  const [aiSummary, setAiSummary] = useState(true)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const id = `r-${Math.floor(Math.random() * 900 + 100)}`
    onCreate({
      report_id: id,
      generated_by: "s-001",
      report_type: type,
      filters_json: {
        from,
        to,
        ...(barangay !== ALL && { barangay_id: +barangay }),
        ...(sector !== ALL && { sector: sector as Sector }),
        ...(ageBand !== ALL && { age_band: ageBand as AgeBand }),
      },
      format,
      ai_summary_text: aiSummary ? "Summary will appear once the Report Service has generated it." : null,
      file_ref: `reports/${id}.${format.toLowerCase()}`,
      generated_at: new Date().toISOString(),
    })
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Generate report</DialogTitle>
          <DialogDescription>Built from aggregated tables only. No individual records are included.</DialogDescription>
        </DialogHeader>
        <FilterSelect
          label="Report type"
          value={type}
          onChange={(v) => setType(v as ReportType)}
          className="w-full"
          options={reportTypes.map((t) => ({ value: t, label: humanize(t) }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs text-muted-foreground">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs text-muted-foreground">To</Label>
            <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FilterSelect
            label="Barangay"
            value={barangay}
            onChange={setBarangay}
            allLabel="All barangays"
            className="w-full"
            options={barangays.map((b) => ({ value: String(b.barangay_id), label: b.name }))}
          />
          <FilterSelect
            label="Sector"
            value={sector}
            onChange={setSector}
            allLabel="All sectors"
            className="w-full"
            options={sectors.map((s) => ({ value: s, label: sectorLabels[s] }))}
          />
          <FilterSelect
            label="Age band"
            value={ageBand}
            onChange={setAgeBand}
            allLabel="All ages"
            className="w-full"
            options={ageBands.map((a) => ({ value: a, label: ageBandLabels[a] }))}
          />
          <FilterSelect
            label="Format"
            value={format}
            onChange={(v) => setFormat(v as "PDF" | "CSV")}
            className="w-full"
            options={[
              { value: "PDF", label: "PDF" },
              { value: "CSV", label: "CSV" },
            ]}
          />
        </div>
        <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Add plain-language AI summary</span>
            <span className="block text-xs text-muted-foreground">
              Written by the LLM from the aggregated numbers in this report only.
            </span>
          </span>
          <Switch checked={aiSummary} onCheckedChange={setAiSummary} />
        </label>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button type="submit">Generate</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
