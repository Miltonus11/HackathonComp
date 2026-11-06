"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { ApiError, isLoggedIn, register } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isLoggedIn()) router.replace("/dashboard")
  }, [router])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get("password"))

    if (password !== String(form.get("confirm-password"))) {
      setErrors({ confirm: "Passwords do not match." })
      return
    }

    // The backend stores first/last name separately; split the single name field.
    const [first, ...rest] = String(form.get("name")).trim().split(/\s+/)

    setErrors({})
    setLoading(true)
    try {
      await register({
        email: String(form.get("email")),
        password,
        first_name: first ?? "",
        last_name: rest.join(" "),
      })
      router.push("/dashboard")
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors)
      } else {
        setErrors({ form: err instanceof Error ? err.message : "Sign up failed" })
      }
      setLoading(false)
    }
  }

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                autoComplete="name"
                required
              />
              <FieldError message={errors.first_name ?? errors.last_name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                autoComplete="email"
                required
              />
              <FieldError message={errors.email} />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
              <FieldDescription>
                Must be at least 8 characters long.
              </FieldDescription>
              <FieldError message={errors.password} />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm Password
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
              />
              <FieldError message={errors.confirm} />
            </Field>
            <Field>
              <FieldError message={errors.form} />
              <Button type="submit" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
              <FieldDescription className="px-6 text-center">
                Already have an account? <Link href="/login">Sign in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
