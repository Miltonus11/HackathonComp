"use client"

import { useState } from "react"
import Link from "next/link"
import { PhoneOffIcon } from "lucide-react"

import { PageBody, PageHeader } from "@/components/page-header"
import { RoleGate } from "@/components/role-gate"
import { EscalationBadge, RiskLevelBadge } from "@/components/tone-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateTime, minutesBetween, riskSourceLabels } from "@/lib/labels"
import { barangayName, caseProfiles, escalations, riskFlags, staffName } from "@/lib/mock-data"
import type { RiskLevel } from "@/lib/types"

const NOW = "2026-11-07T02:00:00Z"
const levelRank: Record<RiskLevel, number> = { CRISIS: 0, HIGH: 1, MODERATE: 2 }

function waited(mins: number) {
  if (mins < 60) return `${mins} min`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)} h ${mins % 60} min`
  return `${Math.floor(mins / 1440)} d`
}

export default function CasesPage() {
  const [tab, setTab] = useState<"open" | "closed" | "all">("open")

  const rows = escalations
    .map((e) => {
      const flag = riskFlags.find((f) => f.flag_id === e.flag_id)!
      return { e, flag, profile: caseProfiles[flag.user_id] }
    })
    .filter(({ e }) => (tab === "all" ? true : tab === "open" ? e.status !== "CLOSED" : e.status === "CLOSED"))
    .sort((a, b) => levelRank[a.flag.level] - levelRank[b.flag.level] || a.e.queued_at.localeCompare(b.e.queued_at))

  const queued = escalations.filter((e) => e.status === "QUEUED")
  const responded = escalations.filter((e) => e.first_response_at)
  const avgResponse = Math.round(
    responded.reduce((s, e) => s + minutesBetween(e.queued_at, e.first_response_at!), 0) / (responded.length || 1),
  )

  return (
    <RoleGate allow={["CASE_OFFICER", "DPO"]}>
      <PageHeader
        title="Case queue"
        description="High-risk escalations and consented referrals. Opening a case is logged with your reason for access."
      />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Waiting for first response</CardDescription>
              <CardTitle className="text-3xl tabular-nums text-red-700 dark:text-red-400">{queued.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Open cases</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {escalations.filter((e) => e.status !== "CLOSED").length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Average time to first response</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{waited(avgResponse)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Target set by the city [DECIDE]</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="closed">Closed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Barangay</TableHead>
                  <TableHead>Queued</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ e, flag, profile }) => {
                  const wait = e.first_response_at ? null : minutesBetween(e.queued_at, NOW)
                  return (
                    <TableRow key={e.escalation_id} className="relative">
                      <TableCell className="font-medium">
                        <Link
                          href={`/cases/${e.escalation_id}`}
                          className="after:absolute after:inset-0 hover:underline"
                        >
                          {e.escalation_id.toUpperCase()}
                        </Link>
                        {!e.user_contactable && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <PhoneOffIcon className="size-3" /> No contact consent
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <RiskLevelBadge level={flag.level} />
                      </TableCell>
                      <TableCell>{riskSourceLabels[flag.source]}</TableCell>
                      <TableCell>{barangayName(profile?.barangay_id)}</TableCell>
                      <TableCell className="text-xs">
                        <p>{formatDateTime(e.queued_at)}</p>
                        {wait != null && (
                          <p className="font-medium text-red-700 dark:text-red-400">Waiting {waited(wait)}</p>
                        )}
                      </TableCell>
                      <TableCell className={e.assigned_staff_id ? "" : "text-muted-foreground"}>
                        {staffName(e.assigned_staff_id)}
                      </TableCell>
                      <TableCell>
                        <EscalationBadge status={e.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nothing here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </RoleGate>
  )
}
