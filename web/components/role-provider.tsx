"use client"

import { createContext, useContext } from "react"

import type { StaffRole } from "@/lib/types"

type RoleContextValue = { role: StaffRole }

const RoleContext = createContext<RoleContextValue | null>(null)

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used inside <RoleProvider>")
  return ctx
}

/** Content tables are writable only by the Content Manager; everyone else reads. */
export function useCanEditContent() {
  return useRole().role === "CONTENT_MANAGER"
}

/**
 * The staff portal is currently admin-only, so the role is fixed.
 * Replace with the role returned by the backend once other staff accounts are enabled.
 */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  return <RoleContext.Provider value={{ role: "ADMIN" }}>{children}</RoleContext.Provider>
}
