"use client"

import { ShieldOffIcon } from "lucide-react"

import { useRole } from "@/components/role-provider"
import { roleLabels } from "@/lib/labels"
import type { StaffRole } from "@/lib/types"

/** Shows children only to the listed roles (data dictionary section 9, access matrix). */
export function RoleGate({ allow, children }: { allow: StaffRole[]; children: React.ReactNode }) {
  const { role } = useRole()
  if (allow.includes(role)) return <>{children}</>
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <ShieldOffIcon className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">No access for {roleLabels[role]}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This page is limited to {allow.map((r) => roleLabels[r]).join(", ")}. Use the role switcher in the sidebar
        to preview other roles.
      </p>
    </div>
  )
}
