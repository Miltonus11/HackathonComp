"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeftIcon,
  CheckIcon,
  LockIcon,
  MessageCircleIcon,
  PhoneIcon,
  ShieldAlertIcon,
  XIcon,
} from "lucide-react"

import { ALL, FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { RoleGate } from "@/components/role-gate"
import { EscalationBadge, RiskLevelBadge, SeverityBadge, ToneBadge } from "@/components/tone-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  escalationStatusOrder,
  formatDate,
  formatDateTime,
  humanize,
  instrumentLabels,
  outcomeCodes,
  riskSourceLabels,
  sectorLabels,
} from "@/lib/labels"
import {
  barangayName,
  caseAssessments,
  caseConsents,
  caseMood,
  caseProfiles,
  escalations,
  riskFlags,
  staffName,
} from "@/lib/mock-data"
import type { Escalation, EscalationStatus, OutcomeCode, RiskStatus } from "@/lib/types"

// Demo: the signed-in Case Officer. Comes from the session once staff auth exists.
const ME = "s-002"

const accessReasons = [
  { value: "ACTIVE_ESCALATION", label: "Responding to this escalation" },
  { value: "CONSENTED_REFERRAL", label: "Consented referral follow-up" },
  { value: "CLINICAL_REVIEW", label: "Clinical supervision / review" },
]

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const initial = escalations.find((e) => e.escalation_id === id)
  const [reason, setReason] = useState(ALL)
  const [unlocked, setUnlocked] = useState(false)

  if (!initial) {
    return (
      <RoleGate allow={["CASE_OFFICER"]}>
        <PageHeader title="Case not found" />
        <PageBody>
          <Button variant="outline" render={<Link href="/cases" />} nativeButton={false} className="w-fit">
            <ArrowLeftIcon /> Back to queue
          </Button>
        </PageBody>
      </RoleGate>
    )
  }

  return (
    <RoleGate allow={["CASE_OFFICER"]}>
      <PageHeader
        title={`Case ${initial.escalation_id.toUpperCase()}`}
        description="Individual record. Every view is written to the audit log."
        actions={
          <Button variant="outline" render={<Link href="/cases" />} nativeButton={false}>
            <ArrowLeftIcon /> Queue
          </Button>
        }
      />
      <PageBody>
        {unlocked ? (
          <CaseRecord initial={initial} />
        ) : (
          <Card className="mx-auto w-full max-w-lg">
            <CardHeader>
              <LockIcon className="size-5 text-muted-foreground" />
              <CardTitle>State your reason for access</CardTitle>
              <CardDescription>
                Access to individual-level data needs a reason. It is logged with your name and time, and the DPO
                reviews it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterSelect
                label="Reason"
                value={reason}
                onChange={setReason}
                allLabel="Select a reason…"
                className="w-full"
                options={accessReasons}
              />
              <Button className="w-full" disabled={reason === ALL} onClick={() => setUnlocked(true)}>
                Open record
              </Button>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </RoleGate>
  )
}

function CaseRecord({ initial }: { initial: Escalation }) {
  const [esc, setEsc] = useState(initial)
  const flag = riskFlags.find((f) => f.flag_id === esc.flag_id)!
  const [flagStatus, setFlagStatus] = useState<RiskStatus>(flag.status)
  const [notes, setNotes] = useState(esc.notes ?? "")
  const [saved, setSaved] = useState(false)

  const profile = caseProfiles[flag.user_id]
  const assessments = caseAssessments(flag.user_id)
  const mood = caseMood(flag.user_id)
  const consents = caseConsents(flag.user_id)
  const sessions = [...new Set(assessments.map((a) => a.taken_at))].reverse()
  const age = 2026 - profile.birth_year

  function update(patch: Partial<Escalation>) {
    setSaved(false)
    setEsc((prev) => {
      const next = { ...prev, ...patch }
      if (!next.first_response_at && next.status !== "QUEUED") next.first_response_at = new Date().toISOString()
      if (next.status === "CLOSED" && !next.closed_at) next.closed_at = new Date().toISOString()
      return next
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {flag.level === "CRISIS" && esc.status !== "CLOSED" && (
          <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            <ShieldAlertIcon className="size-5 shrink-0" />
            <div>
              <p className="font-medium">Crisis-level flag</p>
              <p>
                The user was shown the crisis screen with hotlines. Reach out as soon as possible.
                {!esc.user_contactable &&
                  " The user has not consented to contact. Follow the city's policy for non-consenting crisis cases [DECIDE]."}
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>What raised this flag</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Item label="Level">
                <RiskLevelBadge level={flag.level} />
              </Item>
              <Item label="Source">{riskSourceLabels[flag.source]}</Item>
              <Item label="Detected">{formatDateTime(flag.created_at)}</Item>
              <Item label="Triggering record">
                {flag.source_ref_type ? humanize(flag.source_ref_type) : "—"}{" "}
                <span className="text-muted-foreground">{flag.source_ref_id}</span>
              </Item>
              <Item label="Flag status">{humanize(flagStatus)}</Item>
            </dl>
            {(flag.source_ref_type === "JOURNAL_ENTRY" || flag.source_ref_type === "CHAT_MESSAGE") && (
              <div className="mt-4 flex gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                <LockIcon className="size-3.5 shrink-0" />
                The {flag.source_ref_type === "JOURNAL_ENTRY" ? "journal entry" : "chat message"} text is not shown.
                Whether officers can read it during an active escalation is still to be decided [DECIDE].
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Screening history</CardTitle>
            <CardDescription>Scores from validated instruments only. Each instrument is shown separately.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>PHQ-9</TableHead>
                  <TableHead>GAD-7</TableHead>
                  <TableHead>WHO-5</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((d) => (
                  <TableRow key={d}>
                    <TableCell>{formatDate(d)}</TableCell>
                    {(["PHQ9", "GAD7", "WHO5"] as const).map((code) => {
                      const a = assessments.find((x) => x.taken_at === d && x.instrument_code === code)!
                      return (
                        <TableCell key={code}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="tabular-nums" title={instrumentLabels[code]}>
                              {code === "WHO5" ? `${a.scaled_score}%` : a.raw_score}
                            </span>
                            <SeverityBadge code={a.severity_code} />
                            {a.critical_item_positive && <ToneBadge tone="crisis">Item 9</ToneBadge>}
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mood check-ins, last 21 days</CardTitle>
            <CardDescription>1–10 tracker. Not an assessment.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-24 items-end gap-1">
              {mood.map((m) => (
                <div key={m.entry_date} className="flex flex-1 flex-col items-center justify-end">
                  <div
                    className={`w-full rounded-sm ${m.mood_score <= 3 ? "bg-orange-500" : "bg-primary/70"}`}
                    style={{ height: `${m.mood_score * 10}%` }}
                    title={`${m.entry_date}: ${m.mood_score}/10`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>{formatDate(mood[0].entry_date)}</span>
              <span>{formatDate(mood[mood.length - 1].entry_date)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              Response
              <EscalationBadge status={esc.status} />
            </CardTitle>
            <CardDescription>
              Queued {formatDateTime(esc.queued_at)}
              {esc.first_response_at && <> · first response {formatDateTime(esc.first_response_at)}</>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Assigned to</span>
              {esc.assigned_staff_id ? (
                <span className="font-medium">{staffName(esc.assigned_staff_id)}</span>
              ) : (
                <Button size="sm" onClick={() => update({ assigned_staff_id: ME, status: "ASSIGNED" })}>
                  Assign to me
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!esc.user_contactable}>
                <PhoneIcon /> Call
              </Button>
              <Button variant="outline" disabled={!esc.user_contactable}>
                <MessageCircleIcon /> Message
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Contact goes through the platform. Phone numbers and emails stay in the Identity Store.
            </p>
            <FilterSelect
              label="Status"
              value={esc.status}
              onChange={(v) => update({ status: v as EscalationStatus })}
              className="w-full"
              options={escalationStatusOrder.map((s) => ({ value: s, label: humanize(s) }))}
            />
            <FilterSelect
              label="Outcome"
              value={esc.outcome_code ?? ALL}
              onChange={(v) => update({ outcome_code: v === ALL ? null : (v as OutcomeCode) })}
              allLabel="Not set"
              className="w-full"
              options={outcomeCodes.map((o) => ({ value: o, label: humanize(o) }))}
            />
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Notes (encrypted)
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setSaved(false)
                }}
                rows={4}
                placeholder="What happened, next steps…"
              />
            </label>
            {esc.status === "CLOSED" && !esc.outcome_code && (
              <p className="text-xs text-red-700 dark:text-red-400">Set an outcome before closing.</p>
            )}
            <Button
              className="w-full"
              disabled={esc.status === "CLOSED" && !esc.outcome_code}
              onClick={() => {
                update({ notes })
                setSaved(true)
              }}
            >
              {saved ? <CheckIcon /> : null}
              {saved ? "Saved" : "Save update"}
            </Button>
            {flagStatus !== "FALSE_ALARM" && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setFlagStatus("FALSE_ALARM")
                  update({ status: "CLOSED", outcome_code: "NOT_ACTIONABLE" })
                }}
              >
                <XIcon /> Mark flag as false alarm
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Pseudonymous ID {profile.user_id}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Item label="Age">{age}</Item>
              <Item label="Sex">{humanize(profile.sex)}</Item>
              <Item label="Sector">{sectorLabels[profile.sector]}</Item>
              <Item label="Barangay">{barangayName(profile.barangay_id)}</Item>
              <Item label="Language">{{ en: "English", fil: "Filipino", ilo: "Ilocano" }[profile.language_code]}</Item>
              <Item label="Contact consent">{esc.user_contactable ? "Yes" : "No"}</Item>
            </dl>
            {age < 18 && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                Possible minor. Follow the city&apos;s guidance for minors [DECIDE].
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {consents.map((c) => (
              <div key={c.consent_type} className="flex items-center justify-between gap-2">
                <span>{humanize(c.consent_type)}</span>
                <ToneBadge tone={c.granted ? "ok" : "neutral"}>{c.granted ? "Granted" : "Not granted"}</ToneBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
