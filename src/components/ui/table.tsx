"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent } from "@/components/ui/card"

import { cn } from "@/lib/utils"

interface TableProps extends React.ComponentProps<"table"> {
  responsiveCards?: boolean
  cardKey?: string
  cardTitle?: string
}

function Table({ className, responsiveCards, cardKey, cardTitle, children, ...props }: TableProps) {
  const isMobile = useIsMobile()

  if (isMobile && responsiveCards) {
    return <MobileCardTable cardKey={cardKey} cardTitle={cardTitle}>{children}</MobileCardTable>
  }

  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

function MobileCardTable({ children }: { children: React.ReactNode; cardKey?: string; cardTitle?: string }) {
  const heads: string[] = []
  const rows: React.ReactElement[] = []

  React.Children.forEach(children, (child) => {
    const el = child as React.ReactElement<{ children?: React.ReactNode }>
    if (el?.type === TableHeader) {
      React.Children.forEach(el.props.children, (rowChild) => {
        const row = rowChild as React.ReactElement<{ children?: React.ReactNode }>
        if (row?.type === TableRow) {
          React.Children.forEach(row.props.children, (cellChild) => {
            const cell = cellChild as React.ReactElement<{ children?: React.ReactNode; hideOnMobile?: boolean }>
            if (cell?.type === TableHead && !cell.props.hideOnMobile) {
              heads.push(String(cell.props.children || ''))
            }
          })
        }
      })
    }
    if (el?.type === TableBody) {
      React.Children.forEach(el.props.children, (rowChild) => {
        if ((rowChild as React.ReactElement)?.type === TableRow) {
          rows.push(rowChild as React.ReactElement)
        }
      })
    }
  })

  return (
    <div className="space-y-3">
      {rows.map((row, ri) => {
        const cells: React.ReactNode[] = []
        const rowEl = row as React.ReactElement<{ children?: React.ReactNode }>
        if (rowEl?.type === TableRow) {
          let ci = 0
          React.Children.forEach(rowEl.props.children, (cellChild) => {
            const cell = cellChild as React.ReactElement<{ children?: React.ReactNode; hideOnMobile?: boolean }>
            if (cell?.type === TableCell) {
              if (cell.props.hideOnMobile) return
              while (ci < heads.length && heads[ci] === '') ci++
              cells.push(
                <div key={ci} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {heads[ci] || `#${ci + 1}`}
                  </span>
                  <span className="text-sm text-right">{cell.props.children}</span>
                </div>
              )
              ci++
            }
          })
        }
        return (
          <Card key={ri}>
            <CardContent className="p-4 space-y-1">
              {cells}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

interface TableHeadProps extends React.ComponentProps<"th"> {
  hideOnMobile?: boolean
}

function TableHead({ className, hideOnMobile, children, ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        hideOnMobile && "hidden md:table-cell",
        className
      )}
      {...props}
    >
      {children}
    </th>
  )
}

interface TableCellProps extends React.ComponentProps<"td"> {
  hideOnMobile?: boolean
}

function TableCell({ className, hideOnMobile, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        hideOnMobile && "hidden md:table-cell",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
