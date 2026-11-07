import Image from "next/image"
import { cn } from "cn"

export const APP_NAME = "EunoiApp"

export function BrandLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/eunoia-logo.png"
      alt={`${APP_NAME} logo`}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-lg", className)}
      priority
    />
  )
}

/** Logo + name lockup for auth and landing pages. */
export function Brand({ tagline }: { tagline?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <BrandLogo size={64} className="rounded-2xl" />
      <p className="text-2xl font-semibold tracking-tight">{APP_NAME}</p>
      {tagline && <p className="text-sm text-muted-foreground">{tagline}</p>}
    </div>
  )
}
