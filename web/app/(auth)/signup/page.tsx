import { Brand } from "@/components/brand"
import { SignupForm } from "@/components/signup-form"

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Brand tagline="Staff portal" />
        <SignupForm />
      </div>
    </div>
  )
}
