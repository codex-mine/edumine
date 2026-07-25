import type { LucideIcon } from "lucide-react"
import { TrendingDown, TrendingUp } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const ACCENT_CLASSES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
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
    <Card className={cn(className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
          <span className="text-[22px] font-bold leading-none text-foreground">{value}</span>
          {(delta || caption) && (
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              {delta && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium",
                    delta.direction === "up" ? "text-success" : "text-destructive"
                  )}
                >
                  {delta.direction === "up" ? (
                    <TrendingUp className="size-3" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="size-3" aria-hidden="true" />
                  )}
                  {delta.value}
                </span>
              )}
              {caption && <span className="text-muted-foreground">{caption}</span>}
            </div>
          )}
        </div>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ACCENT_CLASSES[accent])}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  )
}
