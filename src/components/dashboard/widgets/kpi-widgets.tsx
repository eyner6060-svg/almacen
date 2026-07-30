'use client'

import { memo } from 'react'
import { Package, ClipboardList, AlertTriangle, ArrowRightLeft, Droplets, TrendingUp, TrendingDown, Shield, Clock } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { DashboardStats, FuelType } from '@/types'

function KpiCard({ title, value, icon: Icon, color, description, trend, trendUp }: {
  title: string; value: string | number; icon: React.ElementType; color: string
  description: string; trend?: string; trendUp?: boolean
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
      style={{ '--kpi-color': color, background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)` } as React.CSSProperties}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%]" />
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-3xl font-bold tracking-tight mt-1">{value}</h3>
        </div>
        <div className="rounded-xl p-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg bg-[var(--kpi-color)]/20">
          <Icon className="h-6 w-6 text-[var(--kpi-color)]" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {trend && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            trendUp ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
          }`}>
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </div>
  )
}

export const KpiTotalItems = memo(function KpiTotalItems({ stats, primaryColor }: { stats: DashboardStats; primaryColor: string }) {
  return (
    <KpiCard
      title="Total de Bienes"
      value={stats.totalItems || 0}
      icon={Package}
      color={primaryColor}
      description="Bienes registrados"
      trend="+12%"
      trendUp
    />
  )
})

export const KpiPendingOrders = memo(function KpiPendingOrders({ stats, secondaryColor }: { stats: DashboardStats; secondaryColor?: string }) {
  return (
    <KpiCard
      title="Pedidos Pendientes"
      value={stats.pendingOrders || 0}
      icon={ClipboardList}
      color={secondaryColor || '#3b82f6'}
      description="Esperan autorización"
    />
  )
})

export const KpiMonthlyOrders = memo(function KpiMonthlyOrders({ stats, secondaryColor }: { stats: DashboardStats; secondaryColor?: string }) {
  return (
    <KpiCard
      title="Pedidos del Mes"
      value={stats.monthlyOrders || 0}
      icon={ClipboardList}
      color={secondaryColor || '#3b82f6'}
      description="Pedidos realizados"
      trend="+8%"
      trendUp
    />
  )
})

export const KpiLowStock = memo(function KpiLowStock({ stats }: { stats: DashboardStats }) {
  return (
    <KpiCard
      title="Stock Bajo"
      value={stats.lowStockItems?.length || 0}
      icon={AlertTriangle}
      color="#ef4444"
      description="Alertas de stock"
      trend={stats.lowStockItems?.length ? '-5%' : '0%'}
      trendUp={!stats.lowStockItems?.length}
    />
  )
})

export const KpiItemsOnLoan = memo(function KpiItemsOnLoan({ stats, accentColor }: { stats: DashboardStats; accentColor?: string }) {
  return (
    <KpiCard
      title="Patrimoniales Fuera"
      value={stats.patrimonialItemsOnLoan?.length || 0}
      icon={ArrowRightLeft}
      color={accentColor || '#f59e0b'}
      description="En préstamo"
      trend="+2%"
    />
  )
})

function KpiFuel({ stats, fuelType, color }: { stats: DashboardStats; fuelType: FuelType; color: string }) {
  const inventory = stats.fuelInventory?.find(i => i.fuelType === fuelType)
  if (!inventory) return null
  const percentage = Math.min(100, (inventory.quantity / inventory.minStock) * 100)
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%]" />
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{fuelType === 'GASOLINA' ? 'Gasolina' : 'Petróleo'}</p>
          <h3 className="text-3xl font-bold tracking-tight mt-1">{inventory.quantity.toFixed(1)}</h3>
        </div>
        <div className="rounded-xl p-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg" style={{ backgroundColor: `${color}20` }}>
          <Droplets className="h-6 w-6" style={{ color }} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-2">galones disponibles</p>
      <Progress value={percentage} className="h-2" />
      {inventory.quantity < inventory.minStock && (
        <Badge variant="destructive" className="mt-2">Stock Bajo</Badge>
      )}
    </div>
  )
}

export const KpiFuelGasoline = memo(function KpiFuelGasoline({ stats }: { stats: DashboardStats }) {
  return <KpiFuel stats={stats} fuelType="GASOLINA" color="#22c55e" />
})

export const KpiFuelPetroleum = memo(function KpiFuelPetroleum({ stats }: { stats: DashboardStats }) {
  return <KpiFuel stats={stats} fuelType="PETROLEO" color="#f59e0b" />
})

export const KpiTotalPatrimonialUnits = memo(function KpiTotalPatrimonialUnits({ stats }: { stats: DashboardStats }) {
  const operativas = stats.patrimonialUnitsByStatus?.find(s => s.status === 'OPERATIVO')
  const noOperativas = (stats.totalPatrimonialUnits || 0) - (operativas?._count?.id || 0)
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%]" />
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Unidades Patrimoniales</p>
          <h3 className="text-3xl font-bold tracking-tight mt-1">{stats.totalPatrimonialUnits || 0}</h3>
        </div>
        <div className="rounded-xl p-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg bg-[var(--color-primary)]/20">
          <Shield className="h-6 w-6 text-[var(--color-primary)]" />
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {operativas?._count?.id || 0} Operativas
        </span>
        {noOperativas > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {noOperativas} Otras
          </span>
        )}
      </div>
    </div>
  )
})

export const KpiPatrimonialUnitsOut = memo(function KpiPatrimonialUnitsOut({ stats, accentColor }: { stats: DashboardStats; accentColor?: string }) {
  return (
    <KpiCard
      title="Unidades Fuera"
      value={stats.patrimonialUnitsOut || 0}
      icon={ArrowRightLeft}
      color={accentColor || '#f59e0b'}
      description="No disponibles en almacén"
    />
  )
})

export const KpiOverdueReturns = memo(function KpiOverdueReturns({ stats }: { stats: DashboardStats }) {
  return (
    <KpiCard
      title="Retornos Vencidos"
      value={stats.patrimonialUnitsOverdue || 0}
      icon={Clock}
      color="#ef4444"
      description="Fuera de plazo"
      trend={stats.patrimonialUnitsOverdue ? `+${stats.patrimonialUnitsOverdue}` : '0'}
      trendUp={false}
    />
  )
})