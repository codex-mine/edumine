import type { Tone } from "@/lib/landing-content"

/**
 * Landing-page accents reuse the dashboard's stat-tile palette
 * (primary / success / warning / info) so both surfaces feel like one product.
 */

/** Icon tile: tinted background + matching foreground. */
export const TONE_TILE: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
}

/**
 * Soft gradient wash layered over image placeholders. Kept separate from the
 * base surface class because `tailwind-merge` treats `bg-muted` and
 * `bg-gradient-*` as the same conflict group and would drop one of them.
 */
export const TONE_WASH: Record<Tone, string> = {
  primary: "from-primary/25 via-primary/10 to-transparent",
  success: "from-success/25 via-success/10 to-transparent",
  warning: "from-warning/25 via-warning/10 to-transparent",
  info: "from-info/25 via-info/10 to-transparent",
}

/** Foreground tint for the placeholder icon and its faint grid. */
export const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
}

/** Border tint applied on hover for interactive cards. */
export const TONE_HOVER_BORDER: Record<Tone, string> = {
  primary: "hover:border-primary/40",
  success: "hover:border-success/40",
  warning: "hover:border-warning/40",
  info: "hover:border-info/40",
}
