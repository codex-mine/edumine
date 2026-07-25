import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"

export interface ListCardItem {
  id: string
  icon: LucideIcon
  label: string
  secondary?: string
  trailing?: React.ReactNode
}

export interface ListCardProps {
  title: string
  meta?: string
  items?: ListCardItem[]
  emptyMessage?: string
  className?: string
}

export function ListCard({ title, meta, items, emptyMessage = "Nothing to show yet.", className }: ListCardProps) {
  const hasItems = Boolean(items && items.length > 0)

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {meta && <CardDescription>{meta}</CardDescription>}
      </CardHeader>
      <CardContent>
        {!hasItems ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items!.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <item.icon className="size-4" aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
                  {item.secondary && (
                    <span className="truncate text-xs text-muted-foreground">{item.secondary}</span>
                  )}
                </div>
                {item.trailing && <div className="shrink-0 text-sm">{item.trailing}</div>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
