"use client"

import { useState } from "react"
import { AlertTriangleIcon, PencilIcon, PhoneIcon, PlusIcon, SirenIcon } from "lucide-react"

import { ALL, FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { useCanEditContent } from "@/components/role-provider"
import { SeverityBadge, ToneBadge } from "@/components/tone-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, humanize, sectorLabels, serviceTypeLabels } from "@/lib/labels"
import { barangayName, barangays, sectors, services, severitiesFor } from "@/lib/mock-data"
import type { CostType, LanguageCode, Sector, Service, ServiceType, SeverityCode } from "@/lib/types"

const TODAY = "2026-11-07"
const STALE_DAYS = 90
const languageLabels: Record<LanguageCode, string> = { en: "English", fil: "Filipino", ilo: "Ilocano" }

function daysSince(date: string) {
  return Math.floor((new Date(TODAY).getTime() - new Date(date).getTime()) / 86400000)
}

export default function ServicesPage() {
  const canEdit = useCanEditContent()
  const [rows, setRows] = useState<Service[]>(services)
  const [type, setType] = useState(ALL)
  const [barangay, setBarangay] = useState(ALL)
  const [editing, setEditing] = useState<Service | null>(null)

  const shown = rows.filter(
    (s) =>
      (type === ALL || s.service_type === type) &&
      (barangay === ALL || (barangay === "CITY" ? s.barangay_id == null : s.barangay_id === +barangay)),
  )
  const stale = rows.filter((s) => s.is_active && daysSince(s.last_verified_at) > STALE_DAYS)

  function save(next: Service) {
    setRows((prev) =>
      prev.some((r) => r.service_id === next.service_id)
        ? prev.map((r) => (r.service_id === next.service_id ? next : r))
        : [...prev, next],
    )
    setEditing(null)
  }

  return (
    <>
      <PageHeader
        title="Service directory"
        description="Referral options shown to users. Matching uses transparent filters on severity, location, language and sector."
        actions={
          canEdit && (
            <Button
              onClick={() =>
                setEditing({
                  service_id: Math.max(...rows.map((r) => r.service_id)) + 1,
                  name: "",
                  service_type: "BARANGAY_HEALTH_CENTER",
                  barangay_id: null,
                  address: null,
                  phone: null,
                  email: null,
                  schedule_text: null,
                  cost_type: "FREE",
                  accepts_walk_in: true,
                  min_severity: null,
                  is_crisis_service: false,
                  last_verified_at: TODAY,
                  is_active: true,
                  languages: ["en", "fil"],
                  sectors: [...sectors],
                })
              }
            >
              <PlusIcon /> Add service
            </Button>
          )
        }
      />
      <PageBody>
        {stale.length > 0 && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <AlertTriangleIcon className="size-5 shrink-0" />
            <p>
              {stale.length} active {stale.length === 1 ? "service has" : "services have"} not been verified in over{" "}
              {STALE_DAYS} days: {stale.map((s) => s.name).join(", ")}. Confirm phone numbers and hours.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Type"
            value={type}
            onChange={setType}
            allLabel="All types"
            className="w-52"
            options={(Object.keys(serviceTypeLabels) as ServiceType[]).map((t) => ({ value: t, label: serviceTypeLabels[t] }))}
          />
          <FilterSelect
            label="Barangay"
            value={barangay}
            onChange={setBarangay}
            allLabel="All locations"
            options={[
              { value: "CITY", label: "City-wide / hotlines" },
              ...barangays.map((b) => ({ value: String(b.barangay_id), label: b.name })),
            ]}
          />
        </div>
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Suited from</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((s) => {
                  const age = daysSince(s.last_verified_at)
                  return (
                    <TableRow key={s.service_id} className={s.is_active ? "align-top" : "align-top opacity-60"}>
                      <TableCell className="max-w-64 whitespace-normal">
                        <p className="flex items-center gap-1.5 font-medium">
                          {s.is_crisis_service && <SirenIcon className="size-3.5 text-red-600" aria-label="Crisis service" />}
                          {s.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {serviceTypeLabels[s.service_type]} · {humanize(s.cost_type)}
                          {s.accepts_walk_in && " · walk-in"}
                          {!s.is_active && " · inactive"}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p>{barangayName(s.barangay_id)}</p>
                        <p className="text-muted-foreground">{s.schedule_text}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.phone && (
                          <p className="flex items-center gap-1">
                            <PhoneIcon className="size-3" />
                            {s.phone}
                          </p>
                        )}
                        {s.email && <p className="text-muted-foreground">{s.email}</p>}
                      </TableCell>
                      <TableCell>{s.min_severity ? <SeverityBadge code={s.min_severity} /> : <span className="text-xs text-muted-foreground">Any</span>}</TableCell>
                      <TableCell className="text-xs uppercase">{s.languages.join(", ")}</TableCell>
                      <TableCell>
                        <ToneBadge tone={age > STALE_DAYS ? "warn" : "neutral"}>{formatDate(s.last_verified_at)}</ToneBadge>
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(s)} aria-label="Edit">
                            <PencilIcon />
                          </Button>
                        )}
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
        {editing && <ServiceEditor key={editing.service_id} initial={editing} onSave={save} />}
      </Dialog>
    </>
  )
}

function ServiceEditor({ initial, onSave }: { initial: Service; onSave: (s: Service) => void }) {
  const [s, setS] = useState(initial)
  const set = (patch: Partial<Service>) => setS((prev) => ({ ...prev, ...patch }))
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const text = (label: string, key: "name" | "address" | "phone" | "email" | "schedule_text", props?: React.ComponentProps<"input">) => (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Input value={s[key] ?? ""} onChange={(e) => set({ [key]: e.target.value || null })} {...props} />
    </label>
  )

  return (
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{initial.name ? "Edit service" : "Add service"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        {text("Name", "name", { required: true })}
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Type"
            value={s.service_type}
            onChange={(v) => set({ service_type: v as ServiceType })}
            className="w-full"
            options={(Object.keys(serviceTypeLabels) as ServiceType[]).map((t) => ({ value: t, label: serviceTypeLabels[t] }))}
          />
          <FilterSelect
            label="Barangay"
            value={s.barangay_id == null ? "CITY" : String(s.barangay_id)}
            onChange={(v) => set({ barangay_id: v === "CITY" ? null : +v })}
            className="w-full"
            options={[{ value: "CITY", label: "City-wide" }, ...barangays.map((b) => ({ value: String(b.barangay_id), label: b.name }))]}
          />
          <FilterSelect
            label="Cost"
            value={s.cost_type}
            onChange={(v) => set({ cost_type: v as CostType })}
            className="w-full"
            options={["FREE", "SUBSIDIZED", "PAID"].map((c) => ({ value: c, label: humanize(c) }))}
          />
        </div>
        {text("Address", "address")}
        <div className="grid gap-3 sm:grid-cols-3">
          {text("Phone", "phone")}
          {text("Email", "email", { type: "email" })}
          {text("Hours", "schedule_text")}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            label="Lowest severity suited for"
            value={s.min_severity ?? "ANY"}
            onChange={(v) => set({ min_severity: v === "ANY" ? null : (v as SeverityCode) })}
            className="w-full"
            options={[{ value: "ANY", label: "Any" }, ...severitiesFor.PHQ9.map((x) => ({ value: x, label: humanize(x) }))]}
          />
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Last verified
            <Input type="date" value={s.last_verified_at} onChange={(e) => set({ last_verified_at: e.target.value })} />
          </label>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Languages</legend>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(languageLabels) as LanguageCode[]).map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm">
                <Checkbox checked={s.languages.includes(l)} onCheckedChange={() => set({ languages: toggle(s.languages, l) })} />
                {languageLabels[l]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Sectors served</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sectors.map((x: Sector) => (
              <label key={x} className="flex items-center gap-2 text-sm">
                <Checkbox checked={s.sectors.includes(x)} onCheckedChange={() => set({ sectors: toggle(s.sectors, x) })} />
                {sectorLabels[x]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["accepts_walk_in", "Accepts walk-ins"],
              ["is_crisis_service", "Show in crisis flow"],
              ["is_active", "Active"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              {label}
              <Switch checked={s[key]} onCheckedChange={(v) => set({ [key]: v })} />
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(s)} disabled={!s.name.trim()}>
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
