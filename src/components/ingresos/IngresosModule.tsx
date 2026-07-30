'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ResponsiveTable } from '@/components/ui/responsive-table'
import { useConfigStore, useAuthStore, useItemsStore, useWarehousesStore } from '@/store'
import {
  Plus, Search, TrendingUp, Calendar,
  BarChart3, Filter, Trash2, ArrowUpCircle as InboxIcon,
  Download, FileText, FileSpreadsheet, Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DocumentViewerModal } from '@/components/ui/document-viewer-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ItemCombobox } from '@/components/ui/item-combobox'
import { PatrimonialCodesInput } from '@/components/inventario/PatrimonialCodesInput'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { normalizeText } from '@/lib/utils'

interface Ingress {
  id: number
  ingressNumber: string
  itemId: number
  item: {
    id: number
    name: string
    code: string
    itemType: string
    category: string
    unit: string
  }
  quantity: number
  previousStock: number
  newStock: number
  supplier: string | null
  documentNumber: string | null
  receiptUrl: string | null
  notes: string | null
  receivedById: number
  receivedBy: {
    id: number
    fullName: string
  }
  warehouseId: number
  warehouse: {
    id: number
    name: string
  }
  createdAt: string
}

interface IngressStats {
  today: { count: number; total: number }
  week: { count: number; total: number }
  month: { count: number; total: number }
}

export function IngresosModule() {
  const { config } = useConfigStore()
  const { user } = useAuthStore()
  const { items, setItems } = useItemsStore()
  const { warehouses, setWarehouses } = useWarehousesStore()
  
  const [isLoading, setIsLoading] = useState(true)
  const [ingresses, setIngresses] = useState<Ingress[]>([])
  const [stats, setStats] = useState<IngressStats>({ today: { count: 0, total: 0 }, week: { count: 0, total: 0 }, month: { count: 0, total: 0 } })
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [isNewIngressOpen, setIsNewIngressOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Estado del formulario
  const [supplier, setSupplier] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [notes, setNotes] = useState('')

  // Estado de bienes en lote
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [bulkItems, setBulkItems] = useState<Array<{ itemId: number; name: string; code: string; unit: string; quantity: number }>>([])
  
  // Creación de nuevo bien
  const [isCreatingNewItem, setIsCreatingNewItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCode, setNewItemCode] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('UNIDAD')
  const [newItemType, setNewItemType] = useState<'CONSUMIBLE' | 'PATRIMONIAL'>('CONSUMIBLE')
  const [newItemPatrimonialCodes, setNewItemPatrimonialCodes] = useState<string[]>([])
  const [existingPatrimonialCodes, setExistingPatrimonialCodes] = useState<string[]>([])
  
  // Documento de recibo/comprobante
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const fetchExistingPatrimonialCodes = useCallback(async () => {
    try {
      const res = await apiFetch('/api/items/patrimonial-codes')
      if (res.ok) {
        const data = await res.json()
        setExistingPatrimonialCodes((data.patrimonialUnits || []).map((u: { patrimonialCode: string }) => u.patrimonialCode))
      }
    } catch {
      // ignorar
    }
  }, [setExistingPatrimonialCodes])

  const fetchIngresses = useCallback(async () => {
    try {
      const response = await apiFetch('/api/ingresses')
      if (response.ok) {
        const data = await response.json()
        setIngresses(data.ingresses || [])
        setStats(data.stats || { today: { count: 0, total: 0 }, week: { count: 0, total: 0 }, month: { count: 0, total: 0 } })
      }
    } catch (error) {
      console.error('Error al obtener ingresses:', error)
    } finally {
      setIsLoading(false)
    }
  }, [setIngresses, setStats])

  const fetchItems = useCallback(async () => {
    try {
      const response = await apiFetch('/api/items?perPage=500')
      if (response.ok) {
        const data = await response.json()
        setItems(data.items)
      }
    } catch (error) {
      console.error('Error al obtener items:', error)
    }
  }, [setItems])

  const fetchWarehouses = useCallback(async () => {
    try {
      const response = await apiFetch('/api/warehouses')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data.warehouses)
      }
    } catch (error) {
      console.error('Error al obtener warehouses:', error)
    }
  }, [setWarehouses])

  useEffect(() => {
    fetchIngresses()
    fetchItems()
    fetchWarehouses()
    fetchExistingPatrimonialCodes()
  }, [fetchIngresses, fetchItems, fetchWarehouses, fetchExistingPatrimonialCodes])

  const createAndAddItem = async () => {
    if (!newItemName || !newItemCode) {
      toast.error('Complete nombre y código del bien')
      return
    }
    if (newItemType === 'PATRIMONIAL') {
      if (newItemPatrimonialCodes.length === 0) {
        toast.error('Debe ingresar al menos un código patrimonial')
        return
      }
      if (quantity && parseInt(quantity) > 0 && newItemPatrimonialCodes.length !== parseInt(quantity)) {
        toast.error(`La cantidad (${quantity}) debe coincidir con el número de códigos patrimoniales (${newItemPatrimonialCodes.length})`)
        return
      }
    } else if (!quantity || parseInt(quantity) < 1) {
      toast.error('Ingrese una cantidad válida')
      return
    }

    const effectiveQuantity = newItemType === 'PATRIMONIAL' ? newItemPatrimonialCodes.length : (parseInt(quantity) || 1)

    try {
      const res = await apiFetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItemName,
          code: newItemCode,
          category: newItemCategory || 'GENERAL',
          itemType: newItemType,
          unit: newItemUnit,
          quantity: effectiveQuantity,
          minStock: 0,
          ...(newItemType === 'PATRIMONIAL' && newItemPatrimonialCodes.length > 0
            ? { patrimonialCodes: newItemPatrimonialCodes.join('\n') }
            : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Error al crear bien')
        return
      }
      const data = await res.json()
      const item = data.item
      if (bulkItems.some(bi => bi.itemId === item.id)) {
        toast.error('El bien ya está en la lista')
        return
      }
      setBulkItems([...bulkItems, { itemId: item.id, name: item.name, code: item.code, unit: item.unit || 'UNIDAD', quantity: effectiveQuantity }])
      setNewItemName('')
      setNewItemCode('')
      setNewItemCategory('')
      setNewItemUnit('UNIDAD')
      setNewItemType('CONSUMIBLE')
      setNewItemPatrimonialCodes([])
      setIsCreatingNewItem(false)
      setQuantity('')
      await fetchItems()
      await fetchExistingPatrimonialCodes()
    } catch {
      toast.error('Error de conexión al crear bien')
    }
  }

  const addBulkItem = () => {
    if (!selectedItem || !quantity) {
      toast.error('Seleccione un bien y una cantidad')
      return
    }
    if (selectedItem === '__new__') {
      setIsCreatingNewItem(true)
      return
    }
    const item = items.find(i => i.id === parseInt(selectedItem))
    if (!item) return
    if (bulkItems.some(bi => bi.itemId === item.id)) {
      toast.error('El bien ya está en la lista')
      return
    }
    setBulkItems([...bulkItems, { itemId: item.id, name: item.name, code: item.code, unit: item.unit || 'UNIDAD', quantity: parseInt(quantity) }])
    setSelectedItem('')
    setQuantity('')
  }

  const removeBulkItem = (itemId: number) => {
    setBulkItems(bulkItems.filter(bi => bi.itemId !== itemId))
  }

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        return data.url || null
      }
    } catch {
      // ignorar
    }
    return null
  }

  const handleCreateIngress = async () => {
    if (bulkItems.length === 0 || !selectedWarehouse) {
      toast.error('Agregue al menos un bien y seleccione un almacén')
      return
    }

    setIsSaving(true)
    try {
      let receiptUrl: string | null = null
      if (receiptFile) {
        receiptUrl = await uploadFile(receiptFile)
      }

      const response = await apiFetch('/api/ingresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: bulkItems.map(bi => ({ itemId: bi.itemId, quantity: bi.quantity })),
          supplier,
          documentNumber,
          warehouseId: parseInt(selectedWarehouse),
          notes,
          receiptUrl,
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`${data.count || bulkItems.length} ingreso(s) registrado(s) correctamente`)
        setIsNewIngressOpen(false)
        resetForm()
        fetchIngresses()
        fetchItems()
      } else {
        toast.error(data.error || 'Error al registrar el ingreso')
      }
    } catch (error) {
      console.error('Error al crear ingress:', error)
      toast.error('Error al registrar el ingreso')
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    setSelectedItem('')
    setQuantity('')
    setSupplier('')
    setDocumentNumber('')
    setSelectedWarehouse('')
    setNotes('')
    setBulkItems([])
    setIsCreatingNewItem(false)
    setNewItemName('')
    setNewItemCode('')
    setNewItemCategory('')
    setNewItemUnit('UNIDAD')
    setNewItemType('CONSUMIBLE')
    setNewItemPatrimonialCodes([])
    setReceiptFile(null)
  }

  const filterByDate = (ingress: Ingress) => {
    if (dateFilter === 'all') return true
    
    const ingressDate = new Date(ingress.createdAt)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    if (dateFilter === 'today') {
      return ingressDate >= today
    }
    
    if (dateFilter === 'week') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return ingressDate >= weekAgo
    }
    
    if (dateFilter === 'month') {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return ingressDate >= monthAgo
    }
    
    return true
  }

  const filteredIngresses = ingresses.filter(ingress => {
    const matchesSearch = 
      normalizeText(ingress.ingressNumber).includes(normalizeText(search)) ||
      normalizeText(ingress.item.name).includes(normalizeText(search)) ||
      normalizeText(ingress.item.code).includes(normalizeText(search)) ||
      (ingress.supplier && normalizeText(ingress.supplier).includes(normalizeText(search)))
    
    return matchesSearch && filterByDate(ingress)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Control de Ingresos</h1>
          <p className="text-muted-foreground">Registro de ingresos de bienes al almacén</p>
        </div>
        {(user?.role === 'ALMACENERO' || user?.role === 'ADMINISTRADOR') && (
          <Dialog open={isNewIngressOpen} onOpenChange={setIsNewIngressOpen}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: config?.primaryColor }}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Ingreso
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Ingreso de Bienes</DialogTitle>
                <DialogDescription>
                  Ingrese los datos del proveedor y los bienes a ingresar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Almacén *</Label>
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione almacén" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={String(wh.id)}>
                          {wh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                  <div className="border rounded-lg p-4 space-y-3">
                    <Label className="text-sm font-semibold">Bienes a Ingresar</Label>

                    {bulkItems.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {bulkItems.map((bi) => {
                          const itemInStore = items.find(i => i.id === bi.itemId)
                          const isPatrimonial = itemInStore?.itemType === 'PATRIMONIAL'
                          return (
                            <div key={bi.itemId} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{bi.code}</span> - {bi.name}
                                <span className="ml-2 text-muted-foreground">x{bi.quantity} {bi.unit}</span>
                                {isPatrimonial && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    +{bi.quantity} código(s) patrimonial(es)
                                  </Badge>
                                )}
                              </div>
                              <button
                                onClick={() => removeBulkItem(bi.itemId)}
                                className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {isCreatingNewItem ? (
                      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-dashed">
                        <Label className="text-xs font-semibold text-primary">Nuevo Bien</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Nombre *</Label>
                            <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nombre del bien" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Código *</Label>
                            <Input value={newItemCode} onChange={e => setNewItemCode(e.target.value)} placeholder="Código único" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Categoría</Label>
                            <Input value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} placeholder="GENERAL" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unidad</Label>
                            <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UNIDAD">UNIDAD</SelectItem>
                                <SelectItem value="CAJA">CAJA</SelectItem>
                                <SelectItem value="LITRO">LITRO</SelectItem>
                                <SelectItem value="KILO">KILO</SelectItem>
                                <SelectItem value="METRO">METRO</SelectItem>
                                <SelectItem value="PAR">PAR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tipo</Label>
                            <Select value={newItemType} onValueChange={(v) => { setNewItemType(v as 'CONSUMIBLE' | 'PATRIMONIAL'); setNewItemPatrimonialCodes([]); }}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CONSUMIBLE">Consumible</SelectItem>
                                <SelectItem value="PATRIMONIAL">Patrimonial</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {newItemType !== 'PATRIMONIAL' && (
                            <div className="space-y-1">
                              <Label className="text-xs">Cantidad *</Label>
                              <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
                            </div>
                          )}
                        </div>

                        {newItemType === 'PATRIMONIAL' && (
                          <div className="pt-2 border-t">
                            <PatrimonialCodesInput
                              quantity={newItemPatrimonialCodes.length > 0 ? newItemPatrimonialCodes.length : 1}
                              value={newItemPatrimonialCodes}
                              onChange={setNewItemPatrimonialCodes}
                              existingCodes={existingPatrimonialCodes}
                            />
                          </div>
                        )}

                        <div className="flex gap-2 justify-end pt-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => { setIsCreatingNewItem(false); setQuantity(''); setNewItemPatrimonialCodes([]) }}>
                            Cancelar
                          </Button>
                          <Button type="button" size="sm" onClick={createAndAddItem} disabled={!newItemName || !newItemCode || (newItemType !== 'PATRIMONIAL' && !quantity)}>
                            Crear y Agregar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 min-w-0 space-y-1">
                          <Label className="text-xs">Bien</Label>
                          <ItemCombobox
                            items={items}
                            value={selectedItem}
                            onValueChange={(v) => {
                              if (v === '__new__') {
                                setIsCreatingNewItem(true)
                              } else {
                                setSelectedItem(v)
                              }
                            }}
                            placeholder="Seleccione bien"
                            customOption={{ label: 'Crear nuevo bien', value: '__new__' }}
                            onCustomSelect={() => setIsCreatingNewItem(true)}
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <Label className="text-xs">Cant.</Label>
                          <Input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={addBulkItem}
                          disabled={!selectedItem || !quantity}
                          className="h-10 w-10 mt-5"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Proveedor</Label>
                    <Input
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Nombre del proveedor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>N° Documento (Boleta/Factura/Guía)</Label>
                    <Input
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="Ej: B001-00012345"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Adjuntar Boleta / Comprobante</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  />
                  {receiptFile && (
                    <p className="text-xs text-muted-foreground">
                      Archivo: {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Observaciones</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas adicionales..."
                    rows={2}
                  />
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setIsNewIngressOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreateIngress}
                    style={{ backgroundColor: config?.primaryColor }}
                    disabled={isSaving || bulkItems.length === 0 || !selectedWarehouse}
                  >
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isSaving ? 'Guardando...' : `Registrar (${bulkItems.length} bienes)`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToCSV(filteredIngresses, [
              { key: 'ingressNumber', label: 'N° Ingreso' },
              { key: 'quantity', label: 'Cantidad' },
              { key: 'supplier', label: 'Proveedor' },
              { key: 'documentNumber', label: 'Documento' },
              { key: 'notes', label: 'Notas' },
              { key: 'createdAt', label: 'Fecha' },
            ], `ingresos-${new Date().toISOString().slice(0, 10)}`)}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToExcel(filteredIngresses, [
              { key: 'ingressNumber', label: 'N° Ingreso' },
              { key: 'quantity', label: 'Cantidad' },
              { key: 'supplier', label: 'Proveedor' },
              { key: 'documentNumber', label: 'Documento' },
              { key: 'notes', label: 'Notas' },
              { key: 'createdAt', label: 'Fecha' },
            ], `ingresos-${new Date().toISOString().slice(0, 10)}`)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Hoy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today.count}</div>
            <p className="text-xs text-muted-foreground">{stats.today.total} unidades</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Semana</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.week.count}</div>
            <p className="text-xs text-muted-foreground">{stats.week.total} unidades</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.month.count}</div>
            <p className="text-xs text-muted-foreground">{stats.month.total} unidades</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, bien, proveedor..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as 'all' | 'today' | 'week' | 'month')}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <ModuleSkeleton variant="table" />
          </CardContent>
        </Card>
      ) : filteredIngresses.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState icon={InboxIcon} title="No se encontraron ingresos" />
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable<Ingress>
          columns={[
            { key: 'number', label: 'N° Ingreso', render: (ingress) => (
              <span className="font-mono font-medium">{ingress.ingressNumber}</span>
            )},
            { key: 'item', label: 'Bien', render: (ingress) => (
              <div>
                <p className="font-medium">{ingress.item.name}</p>
                <p className="text-xs text-muted-foreground">{ingress.item.code}</p>
              </div>
            )},
            { key: 'type', label: 'Tipo', hideOnMobile: true, render: (ingress) => (
              <Badge variant={ingress.item.itemType === 'PATRIMONIAL' ? 'default' : 'secondary'}>
                {ingress.item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}
              </Badge>
            )},
            { key: 'unit', label: 'Unidad', hideOnMobile: true, className: 'text-center', render: (ingress) => (
              <span className="text-sm">{ingress.item.unit || 'UNIDAD'}</span>
            )},
            { key: 'quantity', label: 'Cantidad', className: 'text-right font-medium text-green-600', render: (ingress) => (
              <span>+{ingress.quantity}</span>
            )},
            { key: 'prevStock', label: 'Stock Ant.', hideOnMobile: true, render: (ingress) => (
              <span className="text-muted-foreground">{ingress.previousStock}</span>
            )},
            { key: 'newStock', label: 'Stock Nuevo', hideOnMobile: true, render: (ingress) => (
              <span className="font-medium">{ingress.newStock}</span>
            )},
            { key: 'supplier', label: 'Proveedor', hideOnMobile: true, render: (ingress) => (
              <span className="text-sm">{ingress.supplier || '-'}</span>
            )},
            { key: 'receipt', label: 'Boleta', hideOnMobile: true, render: (ingress) => (
              ingress.receiptUrl ? (
                <DocumentViewerModal
                  url={ingress.receiptUrl}
                  title={`Boleta - ${ingress.ingressNumber}`}
                  variant="button"
                  buttonText="Ver Boleta"
                />
              ) : <span className="text-muted-foreground text-sm">-</span>
            )},
            { key: 'date', label: 'Fecha', hideOnMobile: true, render: (ingress) => (
              <span className="text-sm">{new Date(ingress.createdAt).toLocaleDateString('es-PE')}</span>
            )},
          ]}
          data={filteredIngresses}
          keyExtractor={(ingress) => ingress.id}
        />
      )}
    </div>
  )
}
