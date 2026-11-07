"use client"

import { useState } from "react"
import { AlertTriangleIcon, PencilIcon, PlusIcon } from "lucide-react"

import { ALL, FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { useCanEditContent } from "@/components/role-provider"
import { ReviewBadge, SeverityBadge } from "@/components/tone-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, humanize, instrumentLabels, reviewStatuses, suggestedActions } from "@/lib/labels"
import { adviceContent, instruments, severitiesFor } from "@/lib/mock-data"
import type { AdviceContent, LanguageCode, ReviewStatus, SeverityCode, SuggestedAction } from "@/lib/types"

const languages = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
  { value: "ilo", label: "Ilocano" },
]

// Phrases that read as a diagnosis. Advice must use "flag" wording (system context 7.3).
const DIAGNOSIS_PATTERNS = [/\byou have (depression|anxiety|a disorder)\b/i, /\byou are (depressed|mentally ill)\b/i, /\bdiagnos/i]

function instrumentCode(id: number | null) {
  return instruments.find((i) => i.instrument_id === id)?.code ?? null
}

export default function AdvicePage() {
  const canEdit = useCanEditContent()
  const [rows, setRows] = useState<AdviceContent[]>(adviceContent)
  const [instrument, setInstrument] = useState(ALL)
  const [language, setLanguage] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [editing, setEditing] = useState<AdviceContent | null>(null)

  const shown = rows.filter(
    (r) =>
      (instrument === ALL || String(r.instrument_id ?? "CRISIS") === instrument) &&
      (language === ALL || r.language_code === language) &&
      (status === ALL || r.review_status === status),
  )

  function save(next: AdviceContent) {
    setRows((prev) =>
      prev.some((r) => r.advice_id === next.advice_id)
        ? prev.map((r) => (r.advice_id === next.advice_id ? next : r))
        : [...prev, next],
    )
    setEditing(null)
  }

  return (
    <>
      <PageHeader
        title="Advice content"
        description="The message shown for each severity result. Only published rows reach users, and crisis content needs clinician sign-off."
        actions={
          canEdit && (
            <Button
              onClick={() =>
                setEditing({
                  advice_id: Math.max(...rows.map((r) => r.advice_id)) + 1,
                  instrument_id: 1,
                  severity_code: "MINIMAL",
                  language_code: "en",
                  headline: "",
                  message_body: "",
                  suggested_action: "MONITOR",
                  version: 1,
                  review_status: "DRAFT",
                  reviewed_by: null,
                  reviewed_at: null,
                  is_active: true,
                })
              }
            >
              <PlusIcon /> New advice
            </Button>
          )
        }
      />
      <PageBody>
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Instrument"
            value={instrument}
            onChange={setInstrument}
            allLabel="All"
            className="w-36"
            options={[
              ...instruments.slice(0, 3).map((i) => ({ value: String(i.instrument_id), label: instrumentLabels[i.code] })),
              { value: "CRISIS", label: "Crisis (generic)" },
            ]}
          />
          <FilterSelect label="Language" value={language} onChange={setLanguage} allLabel="All" className="w-36" options={languages} />
          <FilterSelect
            label="Review status"
            value={status}
            onChange={setStatus}
            allLabel="All"
            options={reviewStatuses.map((s) => ({ value: s, label: humanize(s) }))}
          />
        </div>
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Result</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => {
                  const code = instrumentCode(r.instrument_id)
                  return (
                    <TableRow key={r.advice_id} className="align-top">
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">{code ? instrumentLabels[code] : "Any"}</span>
                          <SeverityBadge code={r.severity_code} />
                        </div>
                      </TableCell>
                      <TableCell className="uppercase">{r.language_code}</TableCell>
                      <TableCell className="max-w-sm whitespace-normal">
                        <p className="font-medium">{r.headline}</p>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{r.message_body}</p>
                      </TableCell>
                      <TableCell className="text-xs">{humanize(r.suggested_action)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <ReviewBadge status={r.review_status} />
                          <span className="text-xs text-muted-foreground">v{r.version}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label="Open">
                          <PencilIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <AdviceEditor key={editing.advice_id} initial={editing} canEdit={canEdit} onSave={save} />}
      </Dialog>
    </>
  )
}

function AdviceEditor({
  initial,
  canEdit,
  onSave,
}: {
  initial: AdviceContent
  canEdit: boolean
  onSave: (a: AdviceContent) => void
}) {
  const [a, setA] = useState(initial)
  const [reviewer, setReviewer] = useState(initial.reviewed_by ?? "")
  const set = (patch: Partial<AdviceContent>) => setA((prev) => ({ ...prev, ...patch }))

  const code = instrumentCode(a.instrument_id) as "PHQ9" | "GAD7" | "WHO5" | null
  const severityOptions: (SeverityCode | "CRISIS")[] = code ? [...severitiesFor[code], "CRISIS"] : ["CRISIS"]
  const diagnosisWarning = DIAGNOSIS_PATTERNS.some((p) => p.test(a.headline + " " + a.message_body))
  const contentChanged = a.headline !== initial.headline || a.message_body !== initial.message_body

  function transition(status: ReviewStatus) {
    const patch: Partial<AdviceContent> = { review_status: status }
    if (status === "CLINICALLY_REVIEWED") Object.assign(patch, { reviewed_by: reviewer, reviewed_at: new Date().toISOString() })
    onSave({ ...a, ...patch, version: contentChanged ? a.version + 1 : a.version })
  }

  // Editing text after review sends the row back to draft.
  const effectiveStatus: ReviewStatus = contentChanged ? "DRAFT" : a.review_status

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{canEdit ? "Edit advice" : "Advice"}</DialogTitle>
        <DialogDescription className="flex items-center gap-2">
          <ReviewBadge status={effectiveStatus} /> v{a.version}
          {a.reviewed_by && a.reviewed_at && !contentChanged && (
            <span>
              · reviewed by {a.reviewed_by}, {formatDate(a.reviewed_at)}
            </span>
          )}
        </DialogDescription>
      </DialogHeader>
      <fieldset disabled={!canEdit} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <FilterSelect
            label="Instrument"
            value={a.instrument_id == null ? "NONE" : String(a.instrument_id)}
            onChange={(v) => set({ instrument_id: v === "NONE" ? null : +v, severity_code: v === "NONE" ? "CRISIS" : a.severity_code })}
            className="w-full"
            options={[
              ...instruments.slice(0, 3).map((i) => ({ value: String(i.instrument_id), label: instrumentLabels[i.code] })),
              { value: "NONE", label: "None (generic)" },
            ]}
          />
          <FilterSelect
            label="Severity"
            value={a.severity_code}
            onChange={(v) => set({ severity_code: v as SeverityCode | "CRISIS" })}
            className="w-full"
            options={severityOptions.map((s) => ({ value: s, label: humanize(s) }))}
          />
          <FilterSelect
            label="Language"
            value={a.language_code}
            onChange={(v) => set({ language_code: v as LanguageCode })}
            className="w-full"
            options={languages}
          />
          <FilterSelect
            label="Suggested action"
            value={a.suggested_action}
            onChange={(v) => set({ suggested_action: v as SuggestedAction })}
            className="w-full"
            options={suggestedActions.map((s) => ({ value: s, label: humanize(s) }))}
          />
        </div>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Headline
          <Input value={a.headline} maxLength={150} onChange={(e) => set({ headline: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Message
          <Textarea rows={5} value={a.message_body} onChange={(e) => set({ message_body: e.target.value })} />
        </label>
        {diagnosisWarning && (
          <p className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <AlertTriangleIcon className="size-4 shrink-0" />
            This reads like a diagnosis. Use flag wording, for example &ldquo;Your responses suggest…&rdquo;
          </p>
        )}
        {effectiveStatus === "DRAFT" && (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Reviewing clinician (name or role)
            <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="e.g. CHO Psychologist" />
          </label>
        )}
      </fieldset>
      {canEdit && (
        <DialogFooter>
          {effectiveStatus === "DRAFT" && (
            <>
              <Button variant="outline" onClick={() => transition("DRAFT")} disabled={!a.headline || !a.message_body}>
                Save draft
              </Button>
              <Button onClick={() => transition("CLINICALLY_REVIEWED")} disabled={!reviewer.trim() || !a.headline || diagnosisWarning}>
                Mark clinically reviewed
              </Button>
            </>
          )}
          {effectiveStatus === "CLINICALLY_REVIEWED" && <Button onClick={() => transition("PUBLISHED")}>Publish</Button>}
          {effectiveStatus === "PUBLISHED" && (
            <Button variant="outline" onClick={() => transition("RETIRED")}>
              Retire
            </Button>
          )}
        </DialogFooter>
      )}
    </DialogContent>
  )
}
