"use client"

import { useState } from "react"
import { DownloadIcon } from "lucide-react"

import { ALL, FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { RoleGate } from "@/components/role-gate"
import { ToneBadge } from "@/components/tone-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime, humanize } from "@/lib/labels"
import { auditLog, staffName } from "@/lib/mock-data"

export default function AuditPage() {
  const [actor, setActor] = useState(ALL)
  const [result, setResult] = useState(ALL)
  const [action, setAction] = useState(ALL)
  const [q, setQ] = useState("")

  const actions = [...new Set(auditLog.map((a) => a.action))].sort()
  const shown = auditLog.filter(
    (a) =>
      (actor === ALL || a.actor_type === actor) &&
      (result === ALL || a.result === result) &&
      (action === ALL || a.action === action) &&
      (!q || [a.actor_id, a.target_id, a.reason_code].some((v) => v?.toLowerCase().includes(q.toLowerCase()))),
  )
  const denied = auditLog.filter((a) => a.result === "DENIED")
  const noReason = auditLog.filter((a) => a.action === "VIEW_CASE_RECORD" && !a.reason_code)

  return (
    <RoleGate allow={["DPO"]}>
      <PageHeader
        title="Audit log"
        description="Append-only record of every access to individual-level data and every admin or content action."
        actions={
          <Button variant="outline">
            <DownloadIcon /> Export CSV
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardHeader>
              <CardDescription>Events shown</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{shown.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Denied access attempts</CardDescription>
              <CardTitle className="text-3xl tabular-nums text-red-700 dark:text-red-400">{denied.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Case views without a reason</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{noReason.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">These are always denied (rule 10)</CardContent>
          </Card>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Actor"
            value={actor}
            onChange={setActor}
            allLabel="All actors"
            className="w-36"
            options={["USER", "STAFF", "SYSTEM"].map((v) => ({ value: v, label: humanize(v) }))}
          />
          <FilterSelect label="Action" value={action} onChange={setAction} allLabel="All actions" className="w-52" options={actions.map((a) => ({ value: a, label: humanize(a) }))} />
          <FilterSelect
            label="Result"
            value={result}
            onChange={setResult}
            allLabel="All"
            className="w-32"
            options={[
              { value: "ALLOWED", label: "Allowed" },
              { value: "DENIED", label: "Denied" },
            ]}
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Search IDs
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Actor, target or reason" className="w-56" />
          </label>
        </div>
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a) => (
                  <TableRow key={a.audit_id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDateTime(a.occurred_at)}</TableCell>
                    <TableCell className="text-xs">
                      <p>{a.actor_type === "STAFF" ? staffName(a.actor_id) : a.actor_id}</p>
                      <p className="text-muted-foreground">{humanize(a.actor_type)}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.action}</TableCell>
                    <TableCell className="text-xs">
                      {a.target_type && <span className="text-muted-foreground">{a.target_type} </span>}
                      {a.target_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.reason_code ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <ToneBadge tone={a.result === "ALLOWED" ? "ok" : "crisis"}>{humanize(a.result)}</ToneBadge>
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
