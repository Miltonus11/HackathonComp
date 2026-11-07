"use client"

import { useState } from "react"
import { ExternalLinkIcon, PlusIcon, UploadIcon } from "lucide-react"

import { FilterSelect } from "@/components/filter-select"
import { PageBody, PageHeader } from "@/components/page-header"
import { useCanEditContent } from "@/components/role-provider"
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
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/labels"
import { knowledgeDocuments } from "@/lib/mock-data"
import type { KnowledgeDocument, LanguageCode } from "@/lib/types"

const sourceOrgs: KnowledgeDocument["source_org"][] = ["DOH", "NCMH", "WHO", "CITY_HEALTH_OFFICE", "OTHER_VETTED"]
const orgLabel = (o: KnowledgeDocument["source_org"]) => (o === "CITY_HEALTH_OFFICE" ? "City Health Office" : o === "OTHER_VETTED" ? "Other (vetted)" : o)

export default function KnowledgePage() {
  const canEdit = useCanEditContent()
  const [docs, setDocs] = useState<KnowledgeDocument[]>(knowledgeDocuments)
  const [open, setOpen] = useState(false)

  const active = docs.filter((d) => d.is_active)

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description="Vetted sources the chatbot answers from. Only active documents are retrievable, and replies cite them."
        actions={
          canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button />}>
                <PlusIcon /> Add document
              </DialogTrigger>
              <AddDocument
                onAdd={(d) => {
                  setDocs((prev) => [d, ...prev])
                  setOpen(false)
                }}
              />
            </Dialog>
          )
        }
      />
      <PageBody>
        <p className="text-sm text-muted-foreground">
          {active.length} active documents · {active.reduce((s, d) => s + d.chunk_count, 0)} indexed passages
        </p>
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Lang</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead className="text-right">Passages</TableHead>
                  <TableHead>Retrievable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.doc_id} className={d.is_active ? "" : "opacity-60"}>
                    <TableCell className="max-w-md whitespace-normal font-medium">
                      {d.title}
                      {d.source_url && (
                        <a
                          href={d.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1.5 inline-flex text-muted-foreground hover:text-foreground"
                          aria-label="Open source"
                        >
                          <ExternalLinkIcon className="size-3.5" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone="neutral">{orgLabel(d.source_org)}</ToneBadge>
                    </TableCell>
                    <TableCell className="uppercase">{d.language_code}</TableCell>
                    <TableCell className="text-xs">
                      <p>{formatDate(d.approved_at)}</p>
                      <p className="text-muted-foreground">{d.approved_by}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.chunk_count || "Indexing…"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={d.is_active}
                        disabled={!canEdit}
                        aria-label="Retrievable by chatbot"
                        onCheckedChange={(v) =>
                          setDocs((prev) => prev.map((x) => (x.doc_id === d.doc_id ? { ...x, is_active: v } : x)))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}

function AddDocument({ onAdd }: { onAdd: (d: KnowledgeDocument) => void }) {
  const [title, setTitle] = useState("")
  const [org, setOrg] = useState<KnowledgeDocument["source_org"]>("DOH")
  const [url, setUrl] = useState("")
  const [lang, setLang] = useState<LanguageCode>("en")
  const [approvedBy, setApprovedBy] = useState("")
  const [file, setFile] = useState<File | null>(null)

  return (
    <DialogContent className="sm:max-w-lg">
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          onAdd({
            doc_id: `d-${Date.now()}`,
            title,
            source_org: org,
            source_url: url || null,
            language_code: lang,
            approved_by: approvedBy,
            approved_at: new Date().toISOString(),
            is_active: false,
            chunk_count: 0,
          })
        }}
      >
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>
            New documents start inactive. Turn on retrieval after the passages are indexed and spot-checked.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <FilterSelect
            label="Source organization"
            value={org}
            onChange={(v) => setOrg(v as KnowledgeDocument["source_org"])}
            className="w-full"
            options={sourceOrgs.map((o) => ({ value: o, label: orgLabel(o) }))}
          />
          <FilterSelect
            label="Language"
            value={lang}
            onChange={(v) => setLang(v as LanguageCode)}
            className="w-full"
            options={[
              { value: "en", label: "English" },
              { value: "fil", label: "Filipino" },
              { value: "ilo", label: "Ilocano" },
            ]}
          />
        </div>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Source URL
          <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Approved by
          <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} required placeholder="Reviewer name or role" />
        </label>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/50">
          <UploadIcon className="size-5" />
          {file ? file.name : "Choose a PDF, DOCX or TXT file"}
          <input type="file" accept=".pdf,.docx,.txt,.md" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <DialogFooter>
          <Button type="submit" disabled={!title || !approvedBy}>
            Add document
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
