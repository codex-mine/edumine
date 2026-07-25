"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"

export interface ChartCardProps {
  title: string
  subtitle?: string
  type?: "line" | "bar"
  data?: Array<Record<string, string | number>>
  xKey?: string
  yKey?: string
  caption?: string
  emptyMessage?: string
  className?: string
}

export function ChartCard({
  title,
  subtitle,
  type = "line",
  data,
  xKey = "label",
  yKey = "value",
  caption,
  emptyMessage = "No data to chart yet.",
  className,
}: ChartCardProps) {
  const hasData = Boolean(data && data.length > 0)

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-56">
          {!hasData ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState message={emptyMessage} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {type === "bar" ? (
                <BarChart data={data}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey={xKey} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-lg)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey={yKey} fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={data}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey={xKey} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-lg)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey={yKey} stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
      {caption && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{caption}</div>
      )}
    </Card>
  )
}
