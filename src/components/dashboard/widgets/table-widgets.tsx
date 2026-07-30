'use client'

import { memo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertTriangle, ShieldAlert, ArrowRightLeft, CheckCircle2 } from 'lucide-react'
import type { DashboardStats } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const TableLowStock = memo(function TableLowStock({ stats, onNavigate }: { stats: DashboardStats; onNavigate?: (module: string) => void }) {
  const items = stats.lowStockItems || []
  return (
    <Card className={items.length > 0 ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          Alerta de Stock Bajo
        </CardTitle>
        <CardDescription className="text-xs">Bienes con stock por debajo del mínimo</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <ScrollArea className="h-48 pr-2">
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.code}</p>
                  </div>
                  <Badge variant="destructive">{item.quantity} / {item.minStock}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm">No hay alertas de stock bajo</p>
          </div>
        )}
        {items.length > 5 && (
          <Button variant="outline" className="w-full mt-4" onClick={() => onNavigate?.('inventario')}>
            Ver todos los bienes
          </Button>
        )}
      </CardContent>
    </Card>
  )
})

export const TableWarrantyAlerts = memo(function TableWarrantyAlerts({ stats }: { stats: DashboardStats }) {
  const alerts = stats.warrantyAlerts || []
  return (
    <Card className={alerts.length > 0 ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4" />
          Garantías Próximas a Vencer
        </CardTitle>
        <CardDescription className="text-xs">Bienes con garantía que vence en los próximos 30 días</CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length > 0 ? (
          <ScrollArea className="h-48 pr-2">
            <div className="space-y-2">
              {alerts.map(alert => (
                <div key={alert.warranty.id} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{alert.item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence: {format(new Date(alert.warranty.expiryDate), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </div>
                  <Badge variant={alert.daysRemaining <= 7 ? 'destructive' : 'secondary'}>
                    {alert.daysRemaining} días
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm">No hay garantías próximas a vencer</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

export const TableItemsOnLoan = memo(function TableItemsOnLoan({ stats, accentColor }: { stats: DashboardStats; accentColor?: string }) {
  const loans = stats.patrimonialItemsOnLoan || []
  if (loans.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ArrowRightLeft className="h-4 w-4" style={{ color: accentColor || '#f59e0b' }} />
          Patrimoniales Pendientes de Retorno
        </CardTitle>
        <CardDescription className="text-xs">Bienes patrimoniales que aún no han sido devueltos</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 pr-2">
          <div className="space-y-2">
            {loans.map(loan => (
              <div key={loan.item.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-sm">{loan.item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Prestado a: {loan.order.requestedBy.fullName} - {loan.order.requestedBy.office?.name}
                  </p>
                </div>
                <Badge style={{ backgroundColor: accentColor || '#f59e0b', color: 'white' }}>En préstamo</Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
})
