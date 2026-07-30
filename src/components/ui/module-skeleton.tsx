import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

interface ModuleSkeletonProps {
  variant?: "cards" | "table" | "kpi" | "form"
  count?: number
  className?: string
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border p-5 space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border p-5 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border space-y-0">
      <div className="flex items-center gap-4 p-4 border-b">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b last:border-0">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-20 rounded-full ml-auto" />
        </div>
      ))}
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="rounded-xl border p-6 space-y-5">
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="space-y-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  )
}

export function ModuleSkeleton({ variant = "cards", count = 6, className }: ModuleSkeletonProps) {
  return (
    <div data-slot="module-skeleton" className={cn("animate-pulse", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {variant === "kpi" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: count }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      )}

      {variant === "cards" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {variant === "table" && <TableSkeleton />}

      {variant === "form" && <FormSkeleton />}
    </div>
  )
}
