"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { getMe, isLoggedIn, logout as clearSession, type User } from "@/lib/api"

type AuthContextValue = { user: User; logout: () => void }

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}

/** Gate for logged-in pages: loads the current user, sends everyone else to /login. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login")
      return
    }
    getMe()
      .then(setUser)
      .catch(() => {
        // Expired/invalid session (authFetch already tried a refresh).
        clearSession()
        router.replace("/login")
      })
  }, [router])

  function logout() {
    clearSession()
    router.replace("/login")
  }

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
