'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/http'
import { toast } from 'sonner'
import {
  Bell, Mail, Smartphone, Settings,
  CheckCircle2, AlertTriangle, Clock, PackageX,
  FileText, Truck, Shield, Zap, RefreshCw, Loader2, Fuel,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Notification, NotificationPreference, NotifType } from '@/types'
import { getModuleFromNotif } from '@/lib/navigation'
import { useModuleStore } from '@/store'

const notificationTypes: { type: NotifType; label: string; description: string; icon: React.ElementType }[] = [
  { type: 'STOCK_BAJO', label: 'Stock Bajo', description: 'Cuando el stock de un bien cae por debajo del mínimo', icon: PackageX },
  { type: 'PEDIDO_PENDIENTE', label: 'Pedido Pendiente', description: 'Cuando hay un nuevo pedido esperando autorización', icon: Clock },
  { type: 'PEDIDO_AUTORIZADO', label: 'Pedido Autorizado', description: 'Cuando un pedido es autorizado', icon: CheckCircle2 },
  { type: 'PEDIDO_RECHAZADO', label: 'Pedido Rechazado', description: 'Cuando un pedido es rechazado', icon: AlertTriangle },
  { type: 'BIEN_VENCIDO', label: 'Bien Vencido', description: 'Cuando un bien patrimonial excede su fecha de retorno', icon: AlertTriangle },
  { type: 'GARANTIA_PROXIMA_VENCER', label: 'Garantía por Vencer', description: 'Cuando una garantía está próxima a vencer', icon: Shield },
  { type: 'ITEM_MOVIMIENTO', label: 'Movimiento de Bien', description: 'Cuando se registra un movimiento de bien patrimonial', icon: Truck },
  { type: 'WORKFLOW_EJECUTADO', label: 'Flujo Ejecutado', description: 'Cuando un flujo de trabajo se ejecuta automáticamente', icon: Zap },
  { type: 'REPORTE_MENSUAL', label: 'Reporte Mensual', description: 'Recordatorio de reportes mensuales', icon: FileText },
  { type: 'SOLICITUD_COMBUSTIBLE', label: 'Solicitud de Combustible', description: 'Cuando se registra una nueva solicitud de vale de combustible', icon: Fuel },
]

const CHANNELS: { key: 'emailEnabled' | 'pushEnabled' | 'smsEnabled'; label: string; icon: React.ElementType }[] = [
  { key: 'emailEnabled', label: 'Email', icon: Mail },
  { key: 'pushEnabled', label: 'Push', icon: Bell },
  { key: 'smsEnabled', label: 'SMS', icon: Smartphone },
]

export function NotificacionesModule() {
  const { setModule } = useModuleStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [preferences, setPreferences] = useState<Record<string, NotificationPreference>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [savingTypes, setSavingTypes] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('all')

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [notifRes, prefRes] = await Promise.all([
        apiFetch('/api/notifications?limit=50'),
        apiFetch('/api/notifications/preferences'),
      ])
      if (notifRes.ok) {
        const notifData = await notifRes.json()
        setNotifications(notifData.notifications || [])
      }
      if (prefRes.ok) {
        const prefData = await prefRes.json()
        const prefMap: Record<string, NotificationPreference> = {}
        ;(prefData.preferences || []).forEach((p: NotificationPreference) => {
          prefMap[p.notifType] = p
        })
        setPreferences(prefMap)
      }
    } catch {
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const updatePreference = useCallback(async (notifType: string, channel: 'emailEnabled' | 'pushEnabled' | 'smsEnabled', value: boolean) => {
    setSavingTypes(prev => new Set(prev).add(notifType))
    try {
      const currentPref = preferences[notifType] || { notifType, emailEnabled: true, pushEnabled: true, smsEnabled: false }
      const updatedPref = { ...currentPref, [channel]: value }
      const response = await apiFetch('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(updatedPref),
      })
      if (response.ok) {
        setPreferences(prev => ({ ...prev, [notifType]: updatedPref }))
      } else {
        throw new Error('Error al guardar')
      }
    } catch {
      toast.error('No se pudo guardar la preferencia')
    } finally {
      setSavingTypes(prev => { const next = new Set(prev); next.delete(notifType); return next })
    }
  }, [preferences])

  const updateBulkPreference = useCallback(async (channel: 'emailEnabled' | 'pushEnabled' | 'smsEnabled', value: boolean) => {
    const types = notificationTypes.map(t => t.type)
    setSavingTypes(prev => new Set([...prev, ...types]))
    try {
      const results = await Promise.allSettled(
        types.map(async (notifType) => {
          const currentPref = preferences[notifType] || { notifType, emailEnabled: true, pushEnabled: true, smsEnabled: false }
          const updatedPref = { ...currentPref, [channel]: value }
          const response = await apiFetch('/api/notifications/preferences', {
            method: 'PUT',
            body: JSON.stringify(updatedPref),
          })
          if (!response.ok) throw new Error()
          setPreferences(prev => ({ ...prev, [notifType]: updatedPref }))
        })
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed === 0) {
        toast.success(`Canal ${value ? 'activado' : 'desactivado'} para todos los tipos`)
      } else {
        toast.error(`${failed} tipo(s) no se pudieron actualizar`)
      }
    } catch {
      toast.error('Error al actualizar preferencias')
    } finally {
      setSavingTypes(new Set())
    }
  }, [preferences])

  const updateMasterToggle = useCallback(async (notifType: string, enabled: boolean) => {
    setSavingTypes(prev => new Set(prev).add(notifType))
    try {
      const updatedPref = { notifType, emailEnabled: enabled, pushEnabled: enabled, smsEnabled: enabled }
      const response = await apiFetch('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(updatedPref),
      })
      if (response.ok) {
        setPreferences(prev => ({ ...prev, [notifType]: updatedPref }))
      } else {
        throw new Error()
      }
    } catch {
      toast.error('No se pudo actualizar')
    } finally {
      setSavingTypes(prev => { const next = new Set(prev); next.delete(notifType); return next })
    }
  }, [])

  const markAsRead = useCallback(async (notifId: number) => {
    try {
      const response = await apiFetch(`/api/notifications/${notifId}/read`, { method: 'PUT' })
      if (response.ok) {
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n))
      }
    } catch { /* silencio */ }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await apiFetch('/api/notifications?markAll=true', { method: 'PUT' })
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        toast.success('Todas las notificaciones marcadas como leídas')
      }
    } catch {
      toast.error('Error al marcar como leídas')
    }
  }, [])

  const getNotifIcon = (type: NotifType) => notificationTypes.find(t => t.type === type)?.icon || Bell

  const getNotifColor = (type: NotifType) => {
    switch (type) {
      case 'STOCK_BAJO': return 'text-orange-500'
      case 'PEDIDO_PENDIENTE': return 'text-blue-500'
      case 'PEDIDO_AUTORIZADO': return 'text-green-500'
      case 'PEDIDO_RECHAZADO': return 'text-red-500'
      case 'BIEN_VENCIDO': return 'text-red-500'
      case 'GARANTIA_PROXIMA_VENCER': return 'text-amber-500'
      case 'ITEM_MOVIMIENTO': return 'text-purple-500'
      case 'WORKFLOW_EJECUTADO': return 'text-indigo-500'
      default: return 'text-gray-500'
    }
  }

  const filteredNotifications = useMemo(() => notifications.filter(n => {
    if (activeTab === 'all') return true
    if (activeTab === 'unread') return !n.isRead
    return n.type === activeTab
  }), [notifications, activeTab])

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications])

  const allEmailOn = notificationTypes.every(t => preferences[t.type]?.emailEnabled !== false)
  const allPushOn = notificationTypes.every(t => preferences[t.type]?.pushEnabled !== false)
  const allSmsOn = notificationTypes.every(t => preferences[t.type]?.smsEnabled === true)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Notificaciones</h1>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground">Gestiona tus notificaciones y preferencias</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} sin leer</Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de Notificaciones */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Notificaciones Recientes</CardTitle>
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllAsRead}>
                    Marcar todas como leídas
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">Todas</TabsTrigger>
                  <TabsTrigger value="unread">
                    Sin leer
                    {unreadCount > 0 && (
                      <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">{unreadCount}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value={activeTab}>
                  <ScrollArea className="h-[500px]">
                    {filteredNotifications.length > 0 ? (
                      <div className="space-y-2">
                        {filteredNotifications.map((notif) => {
                          const Icon = getNotifIcon(notif.type)
                          const colorClass = getNotifColor(notif.type)
                          return (
                            <div
                              key={notif.id}
                              className={`p-4 rounded-lg border transition-all hover:shadow-sm cursor-pointer ${
                                !notif.isRead ? 'bg-primary/5 border-primary/20' : 'bg-card'
                              }`}
                              onClick={() => {
                                if (!notif.isRead) markAsRead(notif.id)
                                setModule(getModuleFromNotif(notif.type))
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 ${colorClass}`}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">
                                      {notificationTypes.find(t => t.type === notif.type)?.label || notif.type}
                                    </p>
                                    {!notif.isRead && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                                  <p className="text-xs text-muted-foreground/60 mt-2">
                                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: es })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Bell className="h-12 w-12 mb-4 opacity-50" />
                        <p>No hay notificaciones</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Panel de Preferencias */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Preferencias
              </CardTitle>
              <CardDescription>Configura cómo deseas recibir las notificaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-xs text-muted-foreground font-medium">Activación rápida por canal</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Button variant="outline" size="sm" className="flex-col gap-0.5 h-auto py-2" onClick={() => updateBulkPreference('emailEnabled', !allEmailOn)}>
                  <Mail className="h-3.5 w-3.5" />
                  <span className="text-[10px]">{allEmailOn ? 'Todo' : 'Nada'}</span>
                </Button>
                <Button variant="outline" size="sm" className="flex-col gap-0.5 h-auto py-2" onClick={() => updateBulkPreference('pushEnabled', !allPushOn)}>
                  <Bell className="h-3.5 w-3.5" />
                  <span className="text-[10px]">{allPushOn ? 'Todo' : 'Nada'}</span>
                </Button>
                <Button variant="outline" size="sm" className="flex-col gap-0.5 h-auto py-2" onClick={() => updateBulkPreference('smsEnabled', !allSmsOn)}>
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="text-[10px]">{allSmsOn ? 'Todo' : 'Nada'}</span>
                </Button>
              </div>
              <Separator className="mb-4" />
              <ScrollArea className="h-[400px] pr-2">
                <div className="space-y-5">
                  {notificationTypes.map((notifType) => {
                    const Icon = notifType.icon
                    const pref = preferences[notifType.type] || { emailEnabled: true, pushEnabled: true, smsEnabled: false }
                    const isSaving = savingTypes.has(notifType.type)
                    const allActive = pref.emailEnabled && pref.pushEnabled && pref.smsEnabled
                    const noneActive = !pref.emailEnabled && !pref.pushEnabled && !pref.smsEnabled
                    return (
                      <div key={notifType.type}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${noneActive ? 'text-muted-foreground/50' : ''}`}>
                                {notifType.label}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{notifType.description}</p>
                            </div>
                          </div>
                          <Switch
                            checked={allActive}
                            onCheckedChange={(checked) => updateMasterToggle(notifType.type, checked)}
                            disabled={isSaving}
                            className="shrink-0"
                          />
                        </div>
                        <div className="flex gap-2 pl-6">
                          {CHANNELS.map(({ key, label, icon: ChanIcon }) => (
                            <div key={key} className="flex items-center gap-1.5">
                              <Switch
                                checked={pref[key]}
                                onCheckedChange={(checked) => updatePreference(notifType.type, key, checked)}
                                disabled={isSaving}
                                className="h-5 w-8"
                              />
                              <Label className={`text-[11px] flex items-center gap-0.5 ${!pref[key] ? 'text-muted-foreground/50' : ''}`}>
                                <ChanIcon className="h-3 w-3" />
                                {label}
                              </Label>
                            </div>
                          ))}
                          {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
