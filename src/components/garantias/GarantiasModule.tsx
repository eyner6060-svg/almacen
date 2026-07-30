'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { useConfigStore, useAuthStore } from '@/store'
import { apiFetch } from '@/lib/http'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { DocumentViewerModal } from '@/components/ui/document-viewer-modal'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Search,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Download,
  FileSpreadsheet,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format, differenceInDays, addYears } from 'date-fns'
import type { Warranty, Item, WarrantyStatus } from '@/types'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { normalizeText } from '@/lib/utils'
import { ItemCombobox } from '@/components/ui/item-combobox'

interface WarrantyWithItem extends Warranty {
  item: Item
}

export function GarantiasModule() {
  const { config } = useConfigStore()
  useAuthStore()
  
  const [warranties, setWarranties] = useState<WarrantyWithItem[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingWarranty, setEditingWarranty] = useState<WarrantyWithItem | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [warrantyToDelete, setWarrantyToDelete] = useState<WarrantyWithItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('all')

  // Estado del formulario
  const [formData, setFormData] = useState({
    itemId: '',
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    expiryDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
    supplierName: '',
    supplierContact: '',
    warrantyTerms: '',
    documentUrl: '',
    notes: '',
    status: 'ACTIVE' as WarrantyStatus,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [warrantyRes, itemsRes] = await Promise.all([
        apiFetch('/api/warranties'),
        apiFetch('/api/items?perPage=500&itemType=PATRIMONIAL'),
      ])
      
      if (warrantyRes.ok) {
        const data = await warrantyRes.json()
        setWarranties(data.warranties || [])
      }
      
      if (itemsRes.ok) {
        const data = await itemsRes.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Error al obtener data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveWarranty = async () => {
    if (!formData.itemId) {
      toast.error('Selecciona un bien')
      return
    }

    setIsSaving(true)
    try {
      const url = editingWarranty ? `/api/warranties/${editingWarranty.id}` : '/api/warranties'
      const method = editingWarranty ? 'PUT' : 'POST'

      const body = {
        itemId: parseInt(formData.itemId),
        purchaseDate: formData.purchaseDate,
        expiryDate: formData.expiryDate,
        supplierName: formData.supplierName || 'Proveedor no especificado',
        supplierContact: formData.supplierContact || undefined,
        warrantyTerms: formData.warrantyTerms || undefined,
        documentUrl: formData.documentUrl || undefined,
        notes: formData.notes || undefined,
        status: formData.status,
      }

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast.success('La garantía se ha guardado exitosamente')
        setIsDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error al guardar warranty:', error)
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la garantía')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (warranty: WarrantyWithItem) => {
    setWarrantyToDelete(warranty)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!warrantyToDelete) return
    const response = await apiFetch(`/api/warranties/${warrantyToDelete.id}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error('Error al eliminar la garantía')
    }
    setWarranties(prev => prev.filter(w => w.id !== warrantyToDelete.id))
    setWarrantyToDelete(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Solo se permiten archivos PDF')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo excede el tamaño máximo de 10MB')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'document')

      const res = await apiFetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        setFormData(prev => ({ ...prev, documentUrl: data.url }))
        toast.success('El archivo se ha subido correctamente')
      } else {
        throw new Error(data.error || 'Error al subir')
      }
    } catch {
      toast.error('No se pudo subir el documento')
    } finally {
      setIsUploading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      itemId: '',
      purchaseDate: format(new Date(), 'yyyy-MM-dd'),
      expiryDate: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
      supplierName: '',
      supplierContact: '',
      warrantyTerms: '',
      documentUrl: '',
      notes: '',
      status: 'ACTIVE',
    })
    setEditingWarranty(null)
  }

  const openEditDialog = (warranty: WarrantyWithItem) => {
    setEditingWarranty(warranty)
    setFormData({
      itemId: String(warranty.itemId),
      purchaseDate: format(new Date(warranty.purchaseDate), 'yyyy-MM-dd'),
      expiryDate: format(new Date(warranty.expiryDate), 'yyyy-MM-dd'),
      supplierName: warranty.supplierName || '',
      supplierContact: warranty.supplierContact || '',
      warrantyTerms: warranty.warrantyTerms || '',
      documentUrl: warranty.documentUrl || '',
      notes: warranty.notes || '',
      status: warranty.status,
    })
    setIsDialogOpen(true)
  }

  const getStatusBadge = (status: WarrantyStatus, daysRemaining: number) => {
    switch (status) {
      case 'ACTIVE':
        return daysRemaining <= 30 ? (
          <Badge className="bg-amber-500">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Próxima a vencer
          </Badge>
        ) : (
          <Badge className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Activa
          </Badge>
        )
      case 'EXPIRED':
        return <Badge variant="destructive">Vencida</Badge>
      case 'CLAIMED':
        return <Badge className="bg-blue-500">Reclamada</Badge>
      case 'VOID':
        return <Badge variant="secondary">Anulada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredWarranties = warranties.filter(w => {
    const matchesSearch = 
      normalizeText(w.item.name).includes(normalizeText(searchTerm)) ||
      normalizeText(w.supplierName ?? '').includes(normalizeText(searchTerm))
    
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter
    
    const now = new Date()
    const daysRemaining = differenceInDays(new Date(w.expiryDate), now)
    
    if (activeTab === 'expiring') {
      return matchesSearch && matchesStatus && daysRemaining > 0 && daysRemaining <= 30
    }
    if (activeTab === 'expired') {
      return matchesSearch && matchesStatus && (daysRemaining <= 0 || w.status === 'EXPIRED')
    }
    
    return matchesSearch && matchesStatus
  })

  // Estadísticas
  const now = new Date()
  const activeCount = warranties.filter(w => w.status === 'ACTIVE').length
  const expiringCount = warranties.filter(w => {
    const days = differenceInDays(new Date(w.expiryDate), now)
    return w.status === 'ACTIVE' && days > 0 && days <= 30
  }).length
  const expiredCount = warranties.filter(w => w.status === 'EXPIRED' || differenceInDays(new Date(w.expiryDate), now) <= 0).length

  if (isLoading) {
    return <ModuleSkeleton variant="cards" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Garantías</h1>
          <p className="text-muted-foreground">
            Controla las garantías de los bienes patrimoniales
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: config?.primaryColor }} onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Garantía
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingWarranty ? 'Editar Garantía' : 'Nueva Garantía'}
              </DialogTitle>
              <DialogDescription>
                Registra la información de la garantía
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Bien Patrimonial *</Label>
                <ItemCombobox
                  items={items}
                  value={formData.itemId}
                  onValueChange={(v) => setFormData({ ...formData, itemId: v })}
                  placeholder="Buscar y seleccionar bien..."
                  filterFn={(i) => i.itemType === 'PATRIMONIAL'}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de Compra</Label>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Vencimiento</Label>
                  <Input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Input
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  placeholder="Nombre del proveedor"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Contacto del Proveedor</Label>
                <Input
                  value={formData.supplierContact}
                  onChange={(e) => setFormData({ ...formData, supplierContact: e.target.value })}
                  placeholder="Teléfono o email"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Términos de Garantía</Label>
                <Textarea
                  value={formData.warrantyTerms}
                  onChange={(e) => setFormData({ ...formData, warrantyTerms: e.target.value })}
                  placeholder="Condiciones y cobertura"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Documento PDF</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="flex-1"
                  />
                  {isUploading && (
                    <div className="flex items-center px-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
                {formData.documentUrl && (
                  <div className="flex items-center gap-2 text-sm">
                    <DocumentViewerModal
                      url={formData.documentUrl}
                      title="Documento de Garantía"
                      variant="text"
                      buttonText="Ver Documento"
                    />
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700 ml-auto"
                      onClick={() => setFormData(prev => ({ ...prev, documentUrl: '' }))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as WarrantyStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Activa</SelectItem>
                    <SelectItem value="EXPIRED">Vencida</SelectItem>
                    <SelectItem value="CLAIMED">Reclamada</SelectItem>
                    <SelectItem value="VOID">Anulada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observaciones adicionales"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveWarranty} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              const data = filteredWarranties.map(w => ({
                bien: w.item.name,
                codigo: w.item.code,
                proveedor: w.supplierName || '',
                fechaCompra: w.purchaseDate,
                fechaVencimiento: w.expiryDate,
                estado: w.status,
              }))
              exportToCSV(data, [
                { key: 'bien', label: 'Bien' },
                { key: 'codigo', label: 'Código' },
                { key: 'proveedor', label: 'Proveedor' },
                { key: 'fechaCompra', label: 'Fecha Compra' },
                { key: 'fechaVencimiento', label: 'Fecha Vencimiento' },
                { key: 'estado', label: 'Estado' },
              ], `garantias-${new Date().toISOString().slice(0, 10)}`)
            }}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const data = filteredWarranties.map(w => ({
                bien: w.item.name,
                codigo: w.item.code,
                proveedor: w.supplierName || '',
                fechaCompra: w.purchaseDate,
                fechaVencimiento: w.expiryDate,
                estado: w.status,
              }))
              exportToExcel(data, [
                { key: 'bien', label: 'Bien' },
                { key: 'codigo', label: 'Código' },
                { key: 'proveedor', label: 'Proveedor' },
                { key: 'fechaCompra', label: 'Fecha Compra' },
                { key: 'fechaVencimiento', label: 'Fecha Vencimiento' },
                { key: 'estado', label: 'Estado' },
              ], `garantias-${new Date().toISOString().slice(0, 10)}`)
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Garantías Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiringCount}</p>
                <p className="text-xs text-muted-foreground">Por Vencer (30 días)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-100">
                <Clock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiredCount}</p>
                <p className="text-xs text-muted-foreground">Vencidas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{warranties.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por bien o proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ACTIVE">Activas</SelectItem>
                <SelectItem value="EXPIRED">Vencidas</SelectItem>
                <SelectItem value="CLAIMED">Reclamadas</SelectItem>
                <SelectItem value="VOID">Anuladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pestañas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="expiring">
            Por Vencer
            {expiringCount > 0 && (
              <Badge className="ml-2 bg-amber-500">{expiringCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="expired">
            Vencidas
            {expiredCount > 0 && (
              <Badge variant="destructive" className="ml-2">{expiredCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {filteredWarranties.length === 0 ? (
                  <EmptyState icon={Shield} title="No hay garantías para mostrar" />
                ) : (
                  <div className="divide-y">
                    {filteredWarranties.map((warranty) => {
                      const daysRemaining = differenceInDays(new Date(warranty.expiryDate), now)
                      
                      return (
                        <div key={warranty.id} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-primary/10">
                                <Shield className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{warranty.item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Código: {warranty.item.code}
                                </p>
                                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {warranty.supplierName || 'Sin proveedor'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Vence: {format(new Date(warranty.expiryDate), 'dd/MM/yyyy')}
                                  </span>
                                  {warranty.documentUrl && (
                                    <DocumentViewerModal
                                      url={warranty.documentUrl}
                                      title={`Documento - ${warranty.item?.name || 'Garantía'}`}
                                      variant="text"
                                      buttonText="Documento"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getStatusBadge(warranty.status, daysRemaining)}
                              {warranty.status === 'ACTIVE' && (
                                <span className={`text-xs ${daysRemaining <= 30 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                  {daysRemaining > 0 ? `${daysRemaining} días restantes` : 'Vencida'}
                                </span>
                              )}
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(warranty)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(warranty)}
                                  className="text-red-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        itemName={warrantyToDelete?.item.name || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
