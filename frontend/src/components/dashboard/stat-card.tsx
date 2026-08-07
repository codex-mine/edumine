import type { LucideIcon } from "lucide-react"
import { TrendingDown, TrendingUp } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const ACCENT_CLASSES = {
  primary: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  info: "bg-info text-info-foreground",
} as const

const WATERMARK_CLASSES = {
  primary: "text-primary/10",
  success: "text-success/10",
  warning: "text-warning/10",
  info: "text-info/10",
} as const

export interface StatCardProps {
  label: string
  value: React.ReactNode
  icon: LucideIcon
  accent?: keyof typeof ACCENT_CLASSES
  delta?: { value: string; direction: "up" | "down" }
  caption?: string
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
  delta,
  caption,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("relative rounded px-5 pt-t pb-10 border-l-4", className)}>
      <Icon
        className={cn(
          "pointer-events-none absolute right-2 bottom-1 size-32",
          WATERMARK_CLASSES[accent]
        )}
        aria-hidden="true"
      />
      <CardContent className="relative flex items-start gap-4 p-0">
        <div
          className={cn(
            "flex   shrink-0 items-center justify-center rounded p-4",
            ACCENT_CLASSES[accent]
          )}
        >
          <Icon className="size-16" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="text-3xl font-bold leading-none text-foreground">{value}</span>
          {(delta || caption) && (
            <div className="mt-4 flex items-center gap-1.5 text-sm">
              {delta && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold",
                    delta.direction === "up" ? "text-success" : "text-destructive"
                  )}
                >
                  {delta.direction === "up" ? (
                    <TrendingUp className="size-4" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="size-4" aria-hidden="true" />
                  )}
                  {delta.value}
                </span>
              )}
              {caption && <span className="text-muted-foreground">{caption}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
