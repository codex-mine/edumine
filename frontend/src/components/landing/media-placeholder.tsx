import type { LucideIcon } from "lucide-react"

import type { Tone } from "@/lib/landing-content"
import { cn } from "@/lib/utils"

import { TONE_TEXT, TONE_WASH } from "./tone-styles"

interface MediaPlaceholderProps {
  /** Announced to assistive tech; describes the photograph that will replace this. */
  label: string
  icon: LucideIcon
  tone: Tone
  /** Optional caption rendered over the wash, e.g. a gallery tile title. */
  children?: React.ReactNode
  iconClassName?: string
  className?: string
}

/**
 * Stands in for photography that has not been supplied yet. Swap this component
 * for `next/image` once real assets exist — the surrounding layout stays intact
 * because the placeholder fills its container exactly like an image would.
 */
export function MediaPlaceholder({
  label,
  icon: Icon,
  tone,
  children,
  iconClassName,
  className,
}: MediaPlaceholderProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-muted",
        TONE_TEXT[tone],
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn("absolute inset-0 bg-gradient-to-br", TONE_WASH[tone])}
      />
      {/* Faint grid keeps the empty area from reading as a loading failure. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <Icon
        className={cn("relative size-24 opacity-45", iconClassName)}
        aria-hidden="true"
      />
      {children}
    </div>
  )
}
