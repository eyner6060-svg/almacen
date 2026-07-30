'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfigStore, useSignatureConfigStore } from '@/store'
import { 
  PenTool, Plus, Trash2, Edit, GripVertical, FileText, Fuel, Pen,
  Download, FileSpreadsheet, Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { SignatureConfig, SignatureType } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'

const typeLabels: Record<SignatureType, string> = {
  FUEL_VOUCHER: 'Vales de Combustible',
  PATRIMONIAL_EXIT: 'Salida Patrimonial'
}

export function SignatureConfigModule() {
  const { config } = useConfigStore()
  const { signatureConfigs, setSignatureConfigs, addSignatureConfig, updateSignatureConfig, removeSignatureConfig } = useSignatureConfigStore()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<SignatureType>('FUEL_VOUCHER')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<SignatureConfig | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [configToDelete, setConfigToDelete] = useState<SignatureConfig | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    isRequired: true
  })

  const fetchConfigs = useCallback(async () => {
    try {
      const response = await apiFetch('/api/signature-config')
      if (response.ok) {
        const data = await response.json()
        setSignatureConfigs(data.configs)
      }
    } catch (error) {
      console.error('Error al obtener configs:', error)
      toast.error('Error al cargar configuración')
    } finally {
      setIsLoading(false)
    }
  }, [setSignatureConfigs])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      toast.error('El título es requerido')
      return
    }

    setIsSaving(true)
    try {
      if (editingConfig) {
        const response = await apiFetch('/api/signature-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingConfig.id,
            title: formData.title,
            isRequired: formData.isRequired
          })
        })

        if (response.ok) {
          const data = await response.json()
          updateSignatureConfig(editingConfig.id, data.config)
          toast.success('Configuración actualizada')
        } else {
          toast.error('Error al actualizar')
        }
      } else {
        const response = await apiFetch('/api/signature-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: activeTab,
            title: formData.title,
            isRequired: formData.isRequired
          })
        })

        if (response.ok) {
          const data = await response.json()
          addSignatureConfig(data.config)
          toast.success('Firma agregada correctamente')
        } else {
          toast.error('Error al agregar firma')
        }
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error al guardar config:', error)
      toast.error('Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (config: SignatureConfig) => {
    setConfigToDelete(config)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!configToDelete) return
    const response = await apiFetch(`/api/signature-config?id=${configToDelete.id}`, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Error al eliminar')
    }
    removeSignatureConfig(configToDelete.id)
    setConfigToDelete(null)
  }

  const handleToggleRequired = async (config: SignatureConfig) => {
    try {
      const response = await apiFetch('/api/signature-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: config.id,
          isRequired: !config.isRequired
        })
      })

      if (response.ok) {
        updateSignatureConfig(config.id, { isRequired: !config.isRequired })
      }
    } catch (error) {
      console.error('Error al cambiar requerido:', error)
    }
  }

  const resetForm = () => {
    setFormData({ title: '', isRequired: true })
    setEditingConfig(null)
  }

  const openEditDialog = (config: SignatureConfig) => {
    setEditingConfig(config)
    setFormData({
      title: config.title,
      isRequired: config.isRequired
    })
    setIsDialogOpen(true)
  }

  const filteredConfigs = signatureConfigs.filter(c => c.type === activeTab)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PenTool className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Configuración de Firmas
          </h1>
          <p className="text-muted-foreground">Configure las firmas requeridas para documentos</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToCSV(signatureConfigs, [
              { key: 'title', label: 'Título' },
              { key: 'type', label: 'Tipo' },
              { key: 'isRequired', label: 'Requerido' },
              { key: 'position', label: 'Orden' },
            ], `firmas-${new Date().toISOString().slice(0, 10)}`)}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToExcel(signatureConfigs, [
              { key: 'title', label: 'Título' },
              { key: 'type', label: 'Tipo' },
              { key: 'isRequired', label: 'Requerido' },
              { key: 'position', label: 'Orden' },
            ], `firmas-${new Date().toISOString().slice(0, 10)}`)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SignatureType)}>
        <TabsList>
          <TabsTrigger value="FUEL_VOUCHER" className="flex items-center gap-2">
            <Fuel className="h-4 w-4" />
            Vales de Combustible
          </TabsTrigger>
          <TabsTrigger value="PATRIMONIAL_EXIT" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Salida Patrimonial
          </TabsTrigger>
        </TabsList>

        {(['FUEL_VOUCHER', 'PATRIMONIAL_EXIT'] as SignatureType[]).map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Firmas para {typeLabels[type]}</CardTitle>
                    <CardDescription>
                      Configure el orden y los cargos de las firmas requeridas
                    </CardDescription>
                  </div>
                  <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
                    <DialogTrigger asChild>
                      <Button 
                        style={{ backgroundColor: config?.primaryColor }}
                        onClick={() => { resetForm(); setActiveTab(type); }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Firma
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {editingConfig ? 'Editar Firma' : 'Nueva Firma'}
                        </DialogTitle>
                        <DialogDescription>
                          Configure la firma para {typeLabels[type]}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Cargo / Título</Label>
                          <Input
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ej: Jefe Directo, Director de Telecomunicaciones"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="required">Firma Requerida</Label>
                          <Switch
                            id="required"
                            checked={formData.isRequired}
                            onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                            Cancelar
                          </Button>
                          <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isSaving ? 'Guardando...' : editingConfig ? 'Actualizar' : 'Agregar'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <ModuleSkeleton variant="cards" />
                ) : filteredConfigs.length === 0 ? (
                  <EmptyState icon={Pen} title="No hay firmas configuradas" description="Agregue firmas para este tipo de documento." />
                ) : (
                  <div className="space-y-3">
                    {filteredConfigs.map((cfg, index) => (
                      <div 
                        key={cfg.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                          <span className="font-mono text-lg">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{cfg.title}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Requerido</span>
                            <Switch
                              checked={cfg.isRequired}
                              onCheckedChange={() => handleToggleRequired(cfg)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(cfg)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500"
                            onClick={() => handleDeleteClick(cfg)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vista Previa */}
            <Card>
              <CardHeader>
                <CardTitle>Vista Previa</CardTitle>
                <CardDescription>
                  Así se verán las firmas en el documento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredConfigs.length === 0 ? (
                  <p className="text-muted-foreground">Agregue firmas para ver la vista previa</p>
                ) : (
                  <div className="grid grid-cols-3 gap-6 justify-items-center p-4 bg-muted/30 rounded-lg">
                    {filteredConfigs.map((cfg, _index) => (
                      <div key={cfg.id} className="text-center w-full max-w-48">
                        <p className="text-xs text-muted-foreground mb-2">{cfg.position}. {cfg.title}</p>
                        <div className="h-20 border-b-2 border-gray-400 mb-2"></div>
                        <p className="text-xs text-muted-foreground">Firma / Sello</p>
                        {cfg.isRequired && (
                          <Badge variant="outline" className="mt-1 text-xs">Requerido</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        itemName={configToDelete?.title || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
