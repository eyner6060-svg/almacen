'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'
import { Card, CardContent } from './card'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  label: string
  hideOnMobile?: boolean
  render: (item: T) => ReactNode
  className?: string
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  onRowClick?: (item: T) => void
  emptyMessage?: string
  className?: string
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Sin datos',
  className,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile()

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {data.map((item) => (
          <Card
            key={keyExtractor(item)}
            className={cn(
              "overflow-hidden",
              onRowClick && "cursor-pointer hover:shadow-md transition-shadow"
            )}
            onClick={() => onRowClick?.(item)}
          >
            <CardContent className="p-4 space-y-2">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {col.label}
                    </span>
                    <span className="text-sm text-right">{col.render(item)}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto rounded-xl border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow
              key={keyExtractor(item)}
              className={cn(onRowClick && "cursor-pointer")}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
