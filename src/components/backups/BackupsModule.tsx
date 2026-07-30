'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { useAuthStore, useConfigStore } from '@/store'
import { Download, Upload, Trash2, Database, Save, Clock, HardDrive, AlertTriangle, Shield, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { BackupLog } from '@prisma/client'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'

function formatFileSize(bytes: bigint | number): string {
  const mb = Number(bytes) / 1024 / 1024
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(2)} MB`
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  COMPLETED: { label: 'Completado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  FAILED: { label: 'Fallido', color: 'bg-red-100 text-red-800', icon: XCircle },
  RUNNING: { label: 'En progreso', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
}

export function BackupsModule() {
  const { user } = useAuthStore()
  const { config } = useConfigStore()

  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [backups, setBackups] = useState<BackupLog[]>([])
  const [backupConfig, setBackupConfig] = useState({
    backupEnabled: false,
    backupSchedule: '1440',
    backupRetentionDays: 30,
    backupPath: './backups',
  })

  const [configOpen, setConfigOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoreBackupId, setRestoreBackupId] = useState<number | null>(null)
  const [restorePin, setRestorePin] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [configForm, setConfigForm] = useState({ ...backupConfig })

  const esAdmin = user?.role === 'ADMINISTRADOR'

  const fetchData = useCallback(async () => {
    try {
      const [backupsRes, configRes] = await Promise.all([
        apiFetch('/api/backups'),
        apiFetch('/api/backups/config'),
      ])
      if (backupsRes.ok) {
        const data = await backupsRes.json()
        setBackups(data.backups || [])
      }
      if (configRes.ok) {
        const data = await configRes.json()
        setBackupConfig(data)
      }
    } catch {
      toast.error('Error al cargar datos de backups')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreateBackup = async () => {
    setIsCreating(true)
    try {
      const res = await apiFetch('/api/backups', { method: 'POST' })
      if (res.ok) {
        toast.success('Copia de seguridad creada correctamente')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al crear copia de seguridad')
      }
    } catch {
      toast.error('Error al crear copia de seguridad')
    } finally {
      setIsCreating(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.sql')) {
      toast.error('Solo se permiten archivos .sql')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error('El archivo excede el límite de 500 MB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetch('/api/backups/upload', { method: 'POST', body: formData })
      if (res.ok) {
        toast.success('Respaldo cargado correctamente')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al cargar el respaldo')
      }
    } catch {
      toast.error('Error al cargar el respaldo')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (backupId: number) => {
    try {
      const res = await apiFetch(`/api/backups/${backupId}/download`)
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error al descargar')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backups.find(b => b.id === backupId)?.fileName || 'backup.sql'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Descarga iniciada')
    } catch {
      toast.error('Error al descargar la copia')
    }
  }

  const handleRestore = async () => {
    if (!restoreBackupId || !restorePin) return
    setIsRestoring(true)
    try {
      const res = await apiFetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: restoreBackupId, confirmPin: restorePin }),
      })
      if (res.ok) {
        toast.success('Base de datos restaurada correctamente. La aplicación se recargará.')
        setTimeout(() => window.location.reload(), 2000)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al restaurar')
      }
    } catch {
      toast.error('Error al restaurar la base de datos')
    } finally {
      setIsRestoring(false)
      setRestoreOpen(false)
      setRestorePin('')
      setRestoreBackupId(null)
    }
  }

  const handleDelete = async (backupId: number) => {
    try {
      const res = await apiFetch(`/api/backups/${backupId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Copia de seguridad eliminada')
        setBackups(prev => prev.filter(b => b.id !== backupId))
      } else {
        toast.error('Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar la copia')
    } finally {
      setDeleteConfirmId(null)
    }
  }

  const handleSaveConfig = async () => {
    try {
      const res = await apiFetch('/api/backups/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm),
      })
      if (res.ok) {
        setBackupConfig(configForm)
        toast.success('Configuración guardada correctamente')
        setConfigOpen(false)
      } else {
        toast.error('Error al guardar configuración')
      }
    } catch {
      toast.error('Error al guardar configuración')
    }
  }

  if (!esAdmin) {
    return (
      <EmptyState
        icon={Shield}
        title="Acceso restringido"
        description="Solo los administradores pueden gestionar copias de seguridad"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Copias de Seguridad
          </h1>
          <p className="text-muted-foreground">Gestión de respaldos de la base de datos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setConfigForm({ ...backupConfig }); setConfigOpen(true) }}>
            <Clock className="h-4 w-4 mr-2" />
            Programar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sql"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? 'Subiendo...' : 'Subir Respaldo'}
          </Button>
          <Button onClick={handleCreateBackup} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isCreating ? 'Creando...' : 'Crear Respaldo'}
          </Button>
        </div>
      </div>

      {/* Estado de programación */}
      {backupConfig.backupEnabled && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="text-sm text-blue-800">
              <strong>Backups automáticos activados</strong> — cada{' '}
              {parseInt(backupConfig.backupSchedule) >= 1440
                ? `${Math.floor(parseInt(backupConfig.backupSchedule) / 1440)} día(s)`
                : `${backupConfig.backupSchedule} minuto(s)`}
              , retención de {backupConfig.backupRetentionDays} días
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de backups */}
      {isLoading ? (
        <ModuleSkeleton variant="table" />
      ) : backups.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title="Sin copias de seguridad"
          description="Cree su primera copia de seguridad para comenzar"
          action={
            <div className="flex gap-2">
              <Button onClick={handleCreateBackup} disabled={isCreating}>
                <Save className="h-4 w-4 mr-2" />
                Crear Respaldo
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                <Upload className="h-4 w-4 mr-2" />
                Subir Respaldo
              </Button>
            </div>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table responsiveCards>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead hideOnMobile>Estado</TableHead>
                  <TableHead hideOnMobile>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => {
                  const cfg = statusConfig[backup.status] || { label: backup.status, color: 'bg-gray-100 text-gray-800', icon: Database }
                  const Icon = cfg.icon
                  return (
                    <TableRow key={backup.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-mono text-sm truncate max-w-[200px]">{backup.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {backup.type === 'MANUAL' ? 'Manual' : 'Automático'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatFileSize(backup.fileSize)}</TableCell>
                      <TableCell hideOnMobile>
                        <Badge className={cfg.color}>
                          <Icon className={`h-3 w-3 mr-1 ${backup.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell hideOnMobile className="text-sm text-muted-foreground">
                        {formatDate(backup.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(backup.id)}
                            disabled={backup.status !== 'COMPLETED'}
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-amber-600"
                            onClick={() => { setRestoreBackupId(backup.id); setRestoreOpen(true) }}
                            disabled={backup.status !== 'COMPLETED'}
                            title="Restaurar"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500"
                            onClick={() => setDeleteConfirmId(backup.id)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Diálogo de configuración */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Programación de Backups
            </DialogTitle>
            <DialogDescription>
              Configure la frecuencia y retención de las copias de seguridad automáticas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Backups automáticos</Label>
                <p className="text-sm text-muted-foreground">Activar respaldos programados</p>
              </div>
              <Switch
                checked={configForm.backupEnabled}
                onCheckedChange={(checked) => setConfigForm(prev => ({ ...prev, backupEnabled: checked }))}
              />
            </div>

            {configForm.backupEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Frecuencia</Label>
                  <Select
                    value={configForm.backupSchedule}
                    onValueChange={(value) => setConfigForm(prev => ({ ...prev, backupSchedule: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar frecuencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">Cada 1 hora</SelectItem>
                      <SelectItem value="360">Cada 6 horas</SelectItem>
                      <SelectItem value="720">Cada 12 horas</SelectItem>
                      <SelectItem value="1440">Cada 1 día</SelectItem>
                      <SelectItem value="4320">Cada 3 días</SelectItem>
                      <SelectItem value="10080">Cada 7 días</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Días de retención</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={configForm.backupRetentionDays}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, backupRetentionDays: parseInt(e.target.value) || 30 }))}
                  />
                  <p className="text-xs text-muted-foreground">Los backups más antiguos se eliminarán automáticamente</p>
                </div>

                <div className="space-y-2">
                  <Label>Ruta de almacenamiento</Label>
                  <Input
                    value={configForm.backupPath}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, backupPath: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Ruta absoluta o relativa al directorio del proyecto</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Importante</p>
                    <p>Asegúrese de que la ruta de almacenamiento tenga suficiente espacio disponible. Los backups se ejecutan en segundo plano.</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveConfig} style={{ backgroundColor: config?.primaryColor }}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Configuración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de restauración */}
      <Dialog open={restoreOpen} onOpenChange={(open) => { if (!isRestoring) setRestoreOpen(open) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Restaurar Base de Datos
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará todos los datos actuales y los reemplazará con la copia de seguridad seleccionada. Esta operación no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 mb-2">Confirme su identidad</p>
              <p className="text-sm text-red-600 mb-4">Ingrese su PIN de administrador para confirmar la restauración.</p>
              <Label>PIN de seguridad</Label>
              <Input
                type="password"
                maxLength={6}
                className="text-center text-lg tracking-widest mt-1"
                placeholder="* * * *"
                value={restorePin}
                onChange={(e) => setRestorePin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setRestoreOpen(false); setRestorePin(''); setRestoreBackupId(null) }} disabled={isRestoring}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestore}
              disabled={!restorePin || restorePin.length < 4 || isRestoring}
            >
              {isRestoring ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {isRestoring ? 'Restaurando...' : 'Restaurar Ahora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar copia de seguridad?</DialogTitle>
            <DialogDescription>
              El archivo se eliminará permanentemente. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
