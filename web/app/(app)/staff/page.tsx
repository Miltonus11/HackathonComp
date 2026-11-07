"use client"

import { useState } from "react"
import { PlusIcon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react"

import { FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { RoleGate } from "@/components/role-gate"
import { ToneBadge } from "@/components/tone-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, roleLabels } from "@/lib/labels"
import { staffUsers } from "@/lib/mock-data"
import type { StaffRole, StaffUser } from "@/lib/types"

const roles = Object.keys(roleLabels) as StaffRole[]

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>(staffUsers)
  const [open, setOpen] = useState(false)

  return (
    <RoleGate allow={["ADMIN", "DPO"]}>
      <PageHeader
        title="Staff accounts"
        description="Web system users. Every staff account needs multi-factor authentication, and Case Officers need a professional license number."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>
              <PlusIcon /> Invite staff
            </DialogTrigger>
            <InviteStaff
              onInvite={(s) => {
                setStaff((prev) => [...prev, s])
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
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>License no.</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.staff_id} className={s.status === "DISABLED" ? "opacity-60" : ""}>
                    <TableCell>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </TableCell>
                    <TableCell>{roleLabels[s.role]}</TableCell>
                    <TableCell className="font-mono text-xs">{s.license_no ?? "—"}</TableCell>
                    <TableCell>
                      {s.mfa_enabled ? (
                        <ShieldCheckIcon className="size-4 text-emerald-600" aria-label="MFA on" />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
                          <ShieldOffIcon className="size-4" /> Off
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={s.status === "ACTIVE" ? "ok" : "neutral"}>
                        {s.status === "ACTIVE" ? "Active" : "Disabled"}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(s.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setStaff((prev) =>
                            prev.map((x) =>
                              x.staff_id === s.staff_id ? { ...x, status: x.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } : x,
                            ),
                          )
                        }
                      >
                        {s.status === "ACTIVE" ? "Disable" : "Enable"}
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

function InviteStaff({ onInvite }: { onInvite: (s: StaffUser) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<StaffRole>("CASE_OFFICER")
  const [license, setLicense] = useState("")

  const needsLicense = role === "CASE_OFFICER"

  return (
    <DialogContent className="sm:max-w-md">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          onInvite({
            staff_id: `s-${Date.now()}`,
            full_name: name,
            email,
            mfa_enabled: false,
            role,
            license_no: needsLicense ? license : null,
            status: "ACTIVE",
            created_at: new Date().toISOString(),
          })
        }}
      >
        <DialogHeader>
          <DialogTitle>Invite staff</DialogTitle>
          <DialogDescription>They set a password and turn on MFA at first sign-in.</DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Full name
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <FilterSelect
          label="Role"
          value={role}
          onChange={(v) => setRole(v as StaffRole)}
          className="w-full"
          options={roles.map((r) => ({ value: r, label: roleLabels[r] }))}
        />
        {needsLicense && (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Professional license no.
            <Input value={license} onChange={(e) => setLicense(e.target.value)} required />
          </label>
        )}
        <DialogFooter>
          <Button type="submit" disabled={!name || !email || (needsLicense && !license)}>
            Send invite
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
