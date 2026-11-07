"use client"

import { useState } from "react"
import { PencilIcon, PlusIcon } from "lucide-react"

import { ALL, FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { useCanEditContent } from "@/components/role-provider"
import { ReviewBadge, ToneBadge } from "@/components/tone-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { humanize, journalDomains, reviewStatuses } from "@/lib/labels"
import { journalPrompts } from "@/lib/mock-data"
import type { JournalDomain, JournalPrompt, LanguageCode, ReviewStatus } from "@/lib/types"

const languages = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
  { value: "ilo", label: "Ilocano" },
]

export default function PromptsPage() {
  const canEdit = useCanEditContent()
  const [rows, setRows] = useState<JournalPrompt[]>(journalPrompts)
  const [domain, setDomain] = useState(ALL)
  const [editing, setEditing] = useState<JournalPrompt | null>(null)

  const shown = rows.filter((r) => domain === ALL || r.domain_code === domain)
  const live = rows.filter((r) => r.is_active && r.review_status === "PUBLISHED")

  function save(next: JournalPrompt) {
    setRows((prev) =>
      prev.some((r) => r.prompt_id === next.prompt_id)
        ? prev.map((r) => (r.prompt_id === next.prompt_id ? next : r))
        : [...prev, next],
    )
    setEditing(null)
  }

  return (
    <>
      <PageHeader
        title="Journal prompts"
        description="Guided prompts rotate by weight and loosely cover each domain. They prompt reflection and never produce a score."
        actions={
          canEdit && (
            <Button
              onClick={() =>
                setEditing({
                  prompt_id: Math.max(...rows.map((r) => r.prompt_id)) + 1,
                  domain_code: "MOOD",
                  language_code: "en",
                  prompt_text: "",
                  rotation_weight: 1,
                  review_status: "DRAFT",
                  is_active: true,
                })
              }
            >
              <PlusIcon /> New prompt
            </Button>
          )
        }
      />
      <PageBody>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Domain coverage (published and active)</CardTitle>
            <CardDescription>Domains with no live prompt are highlighted.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {journalDomains.map((d) => {
              const n = live.filter((p) => p.domain_code === d).length
              return (
                <ToneBadge key={d} tone={n ? "ok" : "warn"}>
                  {humanize(d)} · {n}
                </ToneBadge>
              )
            })}
          </CardContent>
        </Card>
        <FilterSelect
          label="Domain"
          value={domain}
          onChange={setDomain}
          allLabel="All domains"
          options={journalDomains.map((d) => ({ value: d, label: humanize(d) }))}
        />
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((p) => (
                  <TableRow key={p.prompt_id} className={p.is_active ? "" : "opacity-60"}>
                    <TableCell className="max-w-md whitespace-normal">{p.prompt_text}</TableCell>
                    <TableCell>{humanize(p.domain_code)}</TableCell>
                    <TableCell className="uppercase">{p.language_code}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.rotation_weight}</TableCell>
                    <TableCell>
                      <ReviewBadge status={p.review_status} />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.is_active}
                        disabled={!canEdit}
                        onCheckedChange={(v) => save({ ...p, is_active: v })}
                        aria-label="Active"
                      />
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(p)} aria-label="Edit">
                          <PencilIcon />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && <PromptEditor key={editing.prompt_id} initial={editing} onSave={save} />}
      </Dialog>
    </>
  )
}

function PromptEditor({ initial, onSave }: { initial: JournalPrompt; onSave: (p: JournalPrompt) => void }) {
  const [p, setP] = useState(initial)
  const set = (patch: Partial<JournalPrompt>) => setP((prev) => ({ ...prev, ...patch }))

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{initial.prompt_text ? "Edit prompt" : "New prompt"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Prompt text
          <Textarea rows={3} value={p.prompt_text} onChange={(e) => set({ prompt_text: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <FilterSelect
            label="Domain"
            value={p.domain_code}
            onChange={(v) => set({ domain_code: v as JournalDomain })}
            className="w-full"
            options={journalDomains.map((d) => ({ value: d, label: humanize(d) }))}
          />
          <FilterSelect
            label="Language"
            value={p.language_code}
            onChange={(v) => set({ language_code: v as LanguageCode })}
            className="w-full"
            options={languages}
          />
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Rotation weight
            <Input
              type="number"
              min={1}
              max={10}
              value={p.rotation_weight}
              onChange={(e) => set({ rotation_weight: Math.max(1, +e.target.value) })}
            />
          </label>
          <FilterSelect
            label="Review status"
            value={p.review_status}
            onChange={(v) => set({ review_status: v as ReviewStatus })}
            className="w-full"
            options={reviewStatuses.map((s) => ({ value: s, label: humanize(s) }))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(p)} disabled={!p.prompt_text.trim()}>
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
