import { cn } from "cn"

import {
  escalationTone,
  humanize,
  reviewTone,
  riskLevelTone,
  severityTone,
  toneClasses,
} from "@/lib/labels"
import type { EscalationStatus, ReviewStatus, RiskLevel, SeverityCode } from "@/lib/types"

export function ToneBadge({
  tone,
  className,
  children,
}: {
  tone: keyof typeof toneClasses
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SeverityBadge({ code }: { code: SeverityCode | "CRISIS" }) {
  return <ToneBadge tone={severityTone[code]}>{humanize(code)}</ToneBadge>
}

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return <ToneBadge tone={riskLevelTone[level]}>{humanize(level)}</ToneBadge>
}

export function EscalationBadge({ status }: { status: EscalationStatus }) {
  return <ToneBadge tone={escalationTone[status]}>{humanize(status)}</ToneBadge>
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <ToneBadge tone={reviewTone[status]}>{humanize(status)}</ToneBadge>
}
