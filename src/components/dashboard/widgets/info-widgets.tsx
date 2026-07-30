'use client'

import { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import type { DashboardStats } from '@/types'

const COLORS = ['#1e40af', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

export const BadgesCategories = memo(function BadgesCategories({ stats }: { stats: DashboardStats }) {
  const data = (stats.itemsByCategory || []).map((c, i) => ({
    name: c.category,
    value: c._count.id,
    color: COLORS[i % COLORS.length],
  }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Distribución por Categoría</CardTitle>
        <CardDescription className="text-xs">Bienes agrupados por categoría</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {data.map((cat, index) => (
            <Badge key={index} variant="outline" className="px-3 py-1.5" style={{ borderColor: cat.color, color: cat.color }}>
              {cat.name}: {cat.value}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})

export const WidgetWorkflowStats = memo(function WidgetWorkflowStats({ stats, primaryColor, accentColor, onNavigate }: {
  stats: DashboardStats; primaryColor: string; accentColor?: string; onNavigate?: (module: string) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4" style={{ color: accentColor || '#f59e0b' }} />
          Estado de Flujos de Trabajo
        </CardTitle>
        <CardDescription className="text-xs">Automatizaciones activas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-3xl font-bold" style={{ color: primaryColor }}>{stats.activeWorkflows || 0}</p>
            <p className="text-sm text-muted-foreground">Flujos Activos</p>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-3xl font-bold" style={{ color: accentColor || '#f59e0b' }}>{stats.workflowExecutionsToday || 0}</p>
            <p className="text-sm text-muted-foreground">Ejecuciones Hoy</p>
          </div>
        </div>
        <Button variant="outline" className="w-full mt-4" onClick={() => onNavigate?.('workflows')}>
          Gestionar Flujos
        </Button>
      </CardContent>
    </Card>
  )
})
