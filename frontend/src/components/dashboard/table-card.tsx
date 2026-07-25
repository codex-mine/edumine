import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"

export interface TableCardColumn {
  key: string
  label: string
  align?: "left" | "right"
}

export interface TableCardProps {
  title: string
  meta?: string
  columns: TableCardColumn[]
  rows?: Array<Record<string, React.ReactNode>>
  emptyMessage?: string
  className?: string
}

export function TableCard({ title, meta, columns, rows, emptyMessage = "No records yet.", className }: TableCardProps) {
  const hasRows = Boolean(rows && rows.length > 0)

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {meta && <CardDescription>{meta}</CardDescription>}
      </CardHeader>
      {!hasRows ? (
        <div className="px-4 pb-1">
          <EmptyState message={emptyMessage} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "px-4 py-2 text-xs font-medium text-muted-foreground",
                      column.align === "right" && "text-right"
                    )}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows!.map((row, index) => (
                <tr key={index} className="hover:bg-muted/50">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn("px-4 py-2.5", column.align === "right" && "text-right")}
                    >
                      {row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
