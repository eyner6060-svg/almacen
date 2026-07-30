'use client'

import { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Users, PieChart as PieChartIcon, BarChart3, Package, Fuel, TrendingUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from 'recharts'
import type { DashboardStats, User, Item, OrderStatus } from '@/types'

const COLORS = ['#1e40af', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDIENTE: 'Pendiente',
  AUTORIZADO_JEFE: 'Autorizado Jefe',
  AUTORIZADO_ALMACENERO: 'Autorizado Almacén',
  COMPLETADO: 'Completado',
  RECHAZADO: 'Rechazado',
}

const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: '#f59e0b',
  AUTORIZADO_JEFE: '#3b82f6',
  AUTORIZADO_ALMACENERO: '#8b5cf6',
  COMPLETADO: '#10b981',
  RECHAZADO: '#ef4444',
}

export const ChartInventoryTrends = memo(function ChartInventoryTrends({ stats }: { stats: DashboardStats }) {
  const data = stats.inventoryTrends || [
    { date: 'Lun', ingresos: 45, salidas: 32 },
    { date: 'Mar', ingresos: 52, salidas: 40 },
    { date: 'Mié', ingresos: 38, salidas: 45 },
    { date: 'Jue', ingresos: 65, salidas: 38 },
    { date: 'Vie', ingresos: 48, salidas: 50 },
    { date: 'Sáb', ingresos: 20, salidas: 15 },
    { date: 'Dom', ingresos: 10, salidas: 8 },
  ]
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-[var(--color-primary)]" />
          Tendencia de Inventario
        </CardTitle>
        <CardDescription className="text-xs">Ingresos y salidas de la última semana</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="ingresos" stroke="#10b981" fill="#10b98140" name="Ingresos" />
            <Area type="monotone" dataKey="salidas" stroke="#f59e0b" fill="#f59e0b40" name="Salidas" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
})

export const ChartOrdersByUser = memo(function ChartOrdersByUser({ stats, primaryColor }: { stats: DashboardStats; primaryColor: string }) {
  const data = (stats.usersWithMostOrders || [])
    .filter((u): u is { user: User; count: number } => u.user !== undefined)
    .map(u => ({ name: u.user.fullName.split(' ')[0], pedidos: u.count }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-[var(--color-primary)]" />
          Usuarios con Más Salidas
        </CardTitle>
        <CardDescription className="text-xs">Top 5 usuarios con más pedidos</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="pedidos" fill={primaryColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No hay datos disponibles        </div>
        )}
      </CardContent>
    </Card>
  )
})

export const ChartItemsByCategory = memo(function ChartItemsByCategory({ stats }: { stats: DashboardStats }) {
  const data = (stats.mostRequestedItems || [])
    .filter((i): i is { item: Item; totalQuantity: number | null } => i.item !== undefined)
    .map(i => ({
      name: i.item.name.length > 15 ? i.item.name.substring(0, 15) + '...' : i.item.name,
      cantidad: i.totalQuantity || 0,
    }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <PieChartIcon className="h-4 w-4 text-[var(--color-accent)]" />
          Bienes Más Solicitados
        </CardTitle>
        <CardDescription className="text-xs">Top 5 bienes más pedidos</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="cantidad" nameKey="name"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                {data.map((_, index) => (<Cell key={index} fill={COLORS[index % COLORS.length]} />))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No hay datos disponibles        </div>
        )}
      </CardContent>
    </Card>
  )
})

export const ChartConsumptionByOffice = memo(function ChartConsumptionByOffice({ stats, secondaryColor }: { stats: DashboardStats; secondaryColor?: string }) {
  const data = (stats.consumptionByOffice || []).map(c => ({
    name: c.office.name.length > 10 ? c.office.name.substring(0, 10) + '...' : c.office.name,
    pedidos: c.count,
    items: c.totalItems,
  }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-4 w-4 text-[var(--color-secondary)]" />
          Consumo por Oficina
        </CardTitle>
        <CardDescription className="text-xs">Pedidos por área</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={12} />
              <YAxis dataKey="name" type="category" fontSize={10} width={80} />
              <Tooltip />
              <Bar dataKey="pedidos" fill={secondaryColor || '#3b82f6'} radius={[0, 4, 4, 0]} name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No hay datos disponibles        </div>
        )}
      </CardContent>
    </Card>
  )
})

export const ChartStockLevels = memo(function ChartStockLevels({ stats, primaryColor }: { stats: DashboardStats; primaryColor: string }) {
  const categoryData = (stats.itemsByCategory || []).map((c, _i) => ({
    category: c.category,
    current: c._count.id,
    minimum: Math.max(1, Math.floor(c._count.id * 0.3)),
  }))
  const data = stats.stockLevels || categoryData
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-[var(--color-primary)]" />
          Niveles de Stock por Categoría
        </CardTitle>
        <CardDescription className="text-xs">Stock actual vs stock mínimo</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" fontSize={10} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Bar dataKey="current" fill={primaryColor} name="Stock Actual" radius={[4, 4, 0, 0]} />
            <Bar dataKey="minimum" fill="#ef4444" name="Stock Mínimo" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
})

export const ChartFuelUsers = memo(function ChartFuelUsers({ stats, accentColor }: { stats: DashboardStats; accentColor?: string }) {
  const data = (stats.usersWithMostFuelRequests || [])
    .filter((u): u is { user: User; totalGallons: number } => u.user !== undefined)
    .map(u => ({ name: u.user.fullName.split(' ')[0], galones: u.totalGallons }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Fuel className="h-4 w-4 text-[var(--color-accent)]" />
          Top Consumidores de Combustible
        </CardTitle>
        <CardDescription className="text-xs">Usuarios con más galones solicitados</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="galones" fill={accentColor || '#f59e0b'} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No hay datos disponibles        </div>
        )}
      </CardContent>
    </Card>
  )
})

export const ChartFuelMonthly = memo(function ChartFuelMonthly({ stats }: { stats: DashboardStats }) {
  const data = (stats.fuelRequestsByMonth || []).map(m => ({
    name: m.month, gasolina: m.gasoline, petroleo: m.petroleum,
  }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-[var(--color-accent)]" />
          Consumo Mensual de Combustible
        </CardTitle>
        <CardDescription className="text-xs">Últimos 6 meses</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="gasolina" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="petroleo" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No hay datos disponibles        </div>
        )}
      </CardContent>
    </Card>
  )
})

export const ChartOrdersByStatus = memo(function ChartOrdersByStatus({ stats }: { stats: DashboardStats }) {
  const data = (stats.ordersByStatus || []).map(s => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s._count.id,
    color: STATUS_COLORS[s.status] || '#6b7280',
  }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <PieChartIcon className="h-4 w-4 text-emerald-500" />
          Pedidos por Estado
        </CardTitle>
        <CardDescription className="text-xs">Distribución de pedidos por estado actual</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" nameKey="name"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                {data.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No hay datos disponibles        </div>
        )}
      </CardContent>
    </Card>
  )
})

export const ChartMonthlyComparison = memo(function ChartMonthlyComparison({ stats }: { stats: DashboardStats }) {
  const data = (stats.inventoryTrends || []).slice(-5).map(d => ({
    name: d.date,
    ingresos: d.ingresos,
    salidas: d.salidas,
  }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-4 w-4 text-violet-500" />
          Comparativa Mensual
        </CardTitle>
        <CardDescription className="text-xs">Ingresos vs Salidas (últimos 5 períodos)</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingresos" />
              <Bar dataKey="salidas" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Salidas" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">No hay datos disponibles</div>
        )}
      </CardContent>
    </Card>
  )
})
