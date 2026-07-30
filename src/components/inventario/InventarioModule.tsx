'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useItemsStore, useConfigStore, useWarehousesStore } from '@/store'
import { 
  Grid, List,
  Upload,
  Archive, FileSpreadsheet,
  Settings2, Pencil, X, Package
} from 'lucide-react'
import type { Item, ItemStatus, ItemType, PatrimonialUnit, ItemStatusEnum } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { normalizeText } from '@/lib/utils'

import { QRCodeGenerator } from './QRCodeGenerator'
import { BulkImportDialog } from './BulkImportDialog'
import { WhereaboutsDialog } from './WhereaboutsDialog'
import { ItemFormDialog } from './ItemFormDialog'
import type { ItemFormData } from './ItemFormDialog'
import { ItemFilters } from './ItemFilters'
import { ItemTable } from './ItemTable'

export function InventarioModule() {
  const items = useItemsStore(s => s.items)
  const categories = useItemsStore(s => s.categories)
  const setItems = useItemsStore(s => s.setItems)
  const setCategories = useItemsStore(s => s.setCategories)
  const addItem = useItemsStore(s => s.addItem)
  const updateItem = useItemsStore(s => s.updateItem)
  const removeItem = useItemsStore(s => s.removeItem)
  const config = useConfigStore(s => s.config)
  const warehouses = useWarehousesStore(s => s.warehouses)
  const setWarehouses = useWarehousesStore(s => s.setWarehouses)
  
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'CONSUMIBLE' | 'PATRIMONIAL'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [activeTab, setActiveTab] = useState('inventario')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 20
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)
  const [bulkPermanentDeleteOpen, setBulkPermanentDeleteOpen] = useState(false)
  const [permanentDeleteConfirmOpen, setPermanentDeleteConfirmOpen] = useState(false)
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState<Item | null>(null)
  const [supportDocument, setSupportDocument] = useState<File | null>(null)
  const [supportDocumentUrl, setSupportDocumentUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Estados de carga masiva
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null)
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [bulkUploadResults, setBulkUploadResults] = useState<{ success: Array<{ row: number; name: string; code: string; type: string }>; errors: Array<{ row: number; error: string }> } | null>(null)
  
  // Estado de importación desde Excel
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)

  // Diálogo de ubicación de unidades patrimoniales
  const [whereaboutsOpen, setWhereaboutsOpen] = useState(false)
  const [whereaboutsItemId, setWhereaboutsItemId] = useState(0)
  const [whereaboutsItemName, setWhereaboutsItemName] = useState('')

  // Estados de código QR
  const [isQROpen, setIsQROpen] = useState(false)
  const [selectedQRData, setSelectedQRData] = useState<{ patrimonialCode: string; name: string; brand: string; model: string; location: string; warehouse?: string; status?: string } | null>(null)
  const [multipleQRData, setMultipleQRData] = useState<Array<{ patrimonialCode: string; name: string; brand: string; model: string; location: string; warehouse?: string; status?: string }>>([])
  
  // Estados de vista de unidades patrimoniales
  const [patrimonialCodesList, setPatrimonialCodesList] = useState<string[]>([])
  const [existingPatrimonialCodes, setExistingPatrimonialCodes] = useState<string[]>([])
  const [patrimonialUnitStatuses, setPatrimonialUnitStatuses] = useState<Record<number, ItemStatus>>({})
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([])
  
  // Gestión dinámica de estados
  const [expandedPU, setExpandedPU] = useState<Set<number>>(new Set())
  const [estados, setEstados] = useState<ItemStatusEnum[]>([])
  const [isEstadosDialogOpen, setIsEstadosDialogOpen] = useState(false)
  const [estadosLoading, setEstadosLoading] = useState(false)
  const [editingEstado, setEditingEstado] = useState<ItemStatusEnum | null>(null)
  const [estadoFormData, setEstadoFormData] = useState({ name: '', label: '', color: 'gray' })
  const [deleteEstadoConfirm, setDeleteEstadoConfirm] = useState<ItemStatusEnum | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    model: 'S/M',
    brand: 'S/M',
    color: '',
    series: 'S/S',
    code: '',
    patrimonialCode: '',
    patrimonialCodes: '',  // Varios códigos separados por saltos de línea
    itemType: 'CONSUMIBLE' as ItemType,
    category: '',
    unit: 'UNIDAD', // Unidad de medida
    quantity: '1',
    minStock: '5',
    status: 'OPERATIVO',
    location: '',
    warehouseId: '',
    technicalSpecs: '',
  })

  // Búsqueda con retardo para evitar llamadas API en cada tecleo
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Obtener códigos patrimoniales existentes para validación
  const fetchExistingCodes = useCallback(async () => {
    try {
      const response = await apiFetch('/api/items/patrimonial-codes')
      if (response.ok) {
        const data = await response.json()
        const codes = data.patrimonialUnits?.map((u: PatrimonialUnit) => u.patrimonialCode) || []
        setExistingPatrimonialCodes(codes)
      }
    } catch (error) {
      console.error('Error al obtener patrimonial codes:', error)
    }
  }, [])

  useEffect(() => {
    if (isDialogOpen) {
      fetchExistingCodes()
    }
  }, [isDialogOpen, fetchExistingCodes])

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (itemTypeFilter !== 'all') params.append('itemType', itemTypeFilter)
      
      // Filtrar por tab
      if (activeTab === 'papelera') {
        params.append('deletedOnly', 'true')
      } else {
        params.append('includeDeleted', 'false')
      }

      params.append('page', String(page))
      params.append('perPage', String(perPage))
      params.append('view', 'detail')
      const response = await apiFetch(`/api/items?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.items)
        setCategories(data.categories)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error('Error al obtener items:', error)
      toast.error('Error al cargar los bienes')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, categoryFilter, statusFilter, itemTypeFilter, activeTab, page, setCategories, setItems])

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

  const fetchEstados = useCallback(async () => {
    try {
      setEstadosLoading(true)
      const response = await apiFetch('/api/estados')
      if (response.ok) {
        const data = await response.json()
        setEstados(data.estados)
      }
    } catch (error) {
      console.error('Error al obtener estados:', error)
    } finally {
      setEstadosLoading(false)
    }
  }, [])

  // Resetear página cuando cambian filtros
  useEffect(() => { setPage(1) }, [debouncedSearch, categoryFilter, statusFilter, itemTypeFilter, activeTab])

  useEffect(() => {
    setIsLoading(true)
    fetchItems()
    fetchWarehouses()
    fetchEstados()
  }, [fetchItems, fetchWarehouses, fetchEstados])

  const uploadSupportDocument = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true)
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('type', 'documents')

      const response = await apiFetch('/api/upload', {
        method: 'POST',
        body: formDataUpload
      })

      if (response.ok) {
        const data = await response.json()
        return data.url
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al subir archivo')
        return null
      }
    } catch (error) {
      console.error('Error de subida:', error)
      toast.error('Error al subir el archivo')
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validación previa antes de enviar al servidor
    if (!formData.warehouseId) {
      toast.error('Debe seleccionar un almacén')
      return
    }
    if (!formData.name.trim()) {
      toast.error('Debe ingresar el nombre del bien')
      return
    }
    if (!formData.code.trim()) {
      toast.error('Debe ingresar el código del bien')
      return
    }
    if (!formData.category.trim()) {
      toast.error('Debe ingresar la categoría del bien')
      return
    }
    
    try {
      // Subir documento de sustento si existe
      let documentUrl = supportDocumentUrl
      if (supportDocument && !supportDocumentUrl) {
        documentUrl = await uploadSupportDocument(supportDocument)
      }

      const payload: Record<string, unknown> = {
        ...formData,
        quantity: parseInt(formData.quantity),
        minStock: parseInt(formData.minStock),
        warehouseId: parseInt(formData.warehouseId),
        supportDocumentUrl: documentUrl
      }

      let success = false

      if (editingItem) {
        const unitUpdates = Object.entries(patrimonialUnitStatuses)
          .filter(([id, status]) => {
            const unit = editingItem.patrimonialUnits?.find(u => u.id === parseInt(id))
            return unit && status !== unit.status
          })
          .map(([id, status]) => ({ id: parseInt(id), status }))
        if (unitUpdates.length > 0) {
          payload.patrimonialUnitUpdates = unitUpdates
        }

        const response = await apiFetch(`/api/items/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          updateItem(editingItem.id, data.item)
          toast.success('Bien actualizado correctamente')
          success = true
        } else {
          const error = await response.json()
          toast.error(error.error || 'Error al actualizar')
        }
      } else {
        const response = await apiFetch('/api/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          addItem(data.item)
          toast.success('Bien registrado correctamente')
          success = true
        } else {
          const error = await response.json()
          toast.error(error.error || 'Error al crear')
        }
      }

      if (success) {
        setIsDialogOpen(false)
        resetForm()
        fetchItems()
        fetchExistingCodes()
      }
    } catch (error) {
      console.error('Error al guardar item:', error)
      toast.error('Error al guardar el bien')
    }
  }

  const handleDeleteClick = (item: Item) => {
    setItemToDelete(item)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return
    
    try {
      const response = await apiFetch(`/api/items/${itemToDelete.id}`, { method: 'DELETE' })
      if (response.ok) {
        removeItem(itemToDelete.id)
        toast.success('Bien movido a la papelera')
        fetchItems()
      }
    } catch (error) {
      console.error('Error al eliminar item:', error)
      toast.error('Error al eliminar el bien')
    } finally {
      setDeleteConfirmOpen(false)
      setItemToDelete(null)
    }
  }

  const handleRestore = async (id: number) => {
    try {
      const response = await apiFetch(`/api/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      })
      if (response.ok) {
        toast.success('Bien restaurado correctamente')
        fetchItems()
      }
    } catch (error) {
      console.error('Error al restaurar bien:', error)
      toast.error('Error al restaurar el bien')
    }
  }

  const handlePermanentDeleteClick = (item: Item) => {
    setItemToPermanentDelete(item)
    setPermanentDeleteConfirmOpen(true)
  }

  const handleConfirmPermanentDelete = async () => {
    if (!itemToPermanentDelete) return

    try {
      const response = await apiFetch(`/api/items/${itemToPermanentDelete.id}?permanent=true`, { method: 'DELETE' })
      if (response.ok) {
        removeItem(itemToPermanentDelete.id)
        toast.success('Bien eliminado permanentemente')
        fetchItems()
      }
    } catch (error) {
      console.error('Error al eliminar permanentemente:', error)
      toast.error('Error al eliminar permanentemente')
    } finally {
      setPermanentDeleteConfirmOpen(false)
      setItemToPermanentDelete(null)
    }
  }

  const handleBulkSoftDelete = async () => {
    if (selectedItems.length === 0) return
    
    try {
      const response = await apiFetch('/api/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'softDelete', ids: selectedItems })
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setSelectedItems([])
        fetchItems()
      }
    } catch (error) {
      console.error('Error al eliminar masivamente:', error)
      toast.error('Error al mover a papelera')
    } finally {
      setBulkDeleteConfirmOpen(false)
    }
  }

  const handleBulkRestore = async () => {
    if (selectedItems.length === 0) return
    
    try {
      const response = await apiFetch('/api/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', ids: selectedItems })
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setSelectedItems([])
        fetchItems()
      }
    } catch (error) {
      console.error('Error al restaurar masivamente:', error)
      toast.error('Error al restaurar')
    }
  }

  const handleBulkPermanentDelete = async () => {
    if (selectedItems.length === 0) return
    
    try {
      const response = await apiFetch('/api/items/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'permanentDelete', ids: selectedItems })
      })
      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setSelectedItems([])
        fetchItems()
      }
    } catch (error) {
      console.error('Error al eliminar masivamente (permanente):', error)
      toast.error('Error al eliminar permanentemente')
    } finally {
      setBulkPermanentDeleteOpen(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredItems.map(item => item.id))
    }
  }

  const toggleSelectItem = (id: number) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id))
    } else {
      setSelectedItems([...selectedItems, id])
    }
  }

  // Abrir diálogo QR para un solo bien
  const openQRDialog = (item: Item) => {
    if (item.itemType === 'PATRIMONIAL' && item.patrimonialUnits && item.patrimonialUnits.length > 0) {
      // Múltiples unidades - mostrar todos los códigos QR
      const qrDataList = item.patrimonialUnits.map((unit: PatrimonialUnit) => ({
        patrimonialCode: unit.patrimonialCode,
        name: item.name,
        brand: item.brand,
        model: item.model,
        location: item.location || '',
        warehouse: item.warehouse?.name,
        status: unit.status
      }))
      setMultipleQRData(qrDataList)
      setSelectedQRData(null)
    } else {
      // Bien único
      setSelectedQRData({
        patrimonialCode: item.patrimonialCode || item.code,
        name: item.name,
        brand: item.brand,
        model: item.model,
        location: item.location || '',
        warehouse: item.warehouse?.name,
        status: item.status
      })
      setMultipleQRData([])
    }
    setIsQROpen(true)
  }

  // Generar QR para múltiples bienes seleccionados
  const generateBulkQR = () => {
    const selectedPatrimonials = items.filter(
      item => selectedItems.includes(item.id) && item.itemType === 'PATRIMONIAL'
    )
    
    if (selectedPatrimonials.length === 0) {
      toast.error('Seleccione bienes patrimoniales para generar QR')
      return
    }
    
    const qrDataList = selectedPatrimonials.flatMap(item => {
      if (item.patrimonialUnits && item.patrimonialUnits.length > 0) {
        return item.patrimonialUnits.map((unit: PatrimonialUnit) => ({
          patrimonialCode: unit.patrimonialCode,
          name: item.name,
          brand: item.brand,
          model: item.model,
          location: item.location || '',
          warehouse: item.warehouse?.name,
          status: unit.status
        }))
      }
      return [{
        patrimonialCode: item.patrimonialCode || item.code,
        name: item.name,
        brand: item.brand,
        model: item.model,
        location: item.location || '',
        warehouse: item.warehouse?.name,
        status: item.status
      }]
    })
    
    setMultipleQRData(qrDataList)
    setSelectedQRData(null)
    setIsQROpen(true)
  }

  // Carga masiva desde Excel
  const handleBulkUpload = async () => {
    if (!bulkUploadFile) {
      toast.error('Seleccione un archivo Excel')
      return
    }

    setIsBulkUploading(true)
    setBulkUploadResults(null)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', bulkUploadFile)

      const response = await apiFetch('/api/items/bulk-upload', {
        method: 'POST',
        body: formDataUpload
      })

      const data = await response.json()

      if (response.ok) {
        setBulkUploadResults(data)
        toast.success(data.message)
        fetchItems()
      } else {
        toast.error(data.error || 'Error al procesar el archivo')
      }
    } catch (error) {
      console.error('Bulk Error de subida:', error)
      toast.error('Error al procesar el archivo')
    } finally {
      setIsBulkUploading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      model: 'S/M',
      brand: 'S/M',
      color: '',
      series: 'S/S',
      code: '',
      patrimonialCode: '',
      patrimonialCodes: '',
      itemType: 'CONSUMIBLE',
      category: '',
      unit: 'UNIDAD',
      quantity: '1',
      minStock: '5',
      status: 'OPERATIVO',
      location: '',
      warehouseId: '',
      technicalSpecs: '',
    })
    setEditingItem(null)
    setSupportDocument(null)
    setSupportDocumentUrl(null)
    setPatrimonialCodesList([])
    setExistingPatrimonialCodes([])
    setPatrimonialUnitStatuses({})
    setSelectedUnitIds([])
  }

  const openEditDialog = (item: Item) => {
    let codes: string[] = []
    if (item.patrimonialCodes) {
      try { codes = JSON.parse(item.patrimonialCodes) }
      catch { codes = item.patrimonialCodes.split('\n').filter(Boolean) }
    } else if (item.patrimonialCode) {
      codes = [item.patrimonialCode]
    }
    setPatrimonialCodesList(codes)

    const unitStatuses: Record<number, ItemStatus> = {}
    if (item.patrimonialUnits) {
      item.patrimonialUnits.forEach(u => { unitStatuses[u.id] = u.status })
    }
    setPatrimonialUnitStatuses(unitStatuses)

    setEditingItem(item)
    setFormData({
      name: item.name,
      model: item.model,
      brand: item.brand,
      color: item.color || '',
      series: item.series || 'S/S',
      code: item.code,
      patrimonialCode: item.patrimonialCode || '',
      patrimonialCodes: codes.join('\n'),
      itemType: item.itemType,
      category: item.category,
      unit: item.unit || 'UNIDAD',
      quantity: String(item.quantity),
      minStock: String(item.minStock),
      status: item.status,
      location: item.location || '',
      warehouseId: String(item.warehouseId),
      technicalSpecs: item.technicalSpecs || '',
    })
    setSupportDocumentUrl(item.supportDocumentUrl || null)
    setIsDialogOpen(true)
  }

  const statusBadgeMap = useMemo(() => {
    const map: Record<string, { label: string; color: string }> = {}
    estados.forEach(e => { map[e.name] = { label: e.label || e.name, color: e.color || 'gray' } })
    return map
  }, [estados])

  const BADGE_COLORS: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
    gray: 'bg-gray-100 text-gray-800',
    teal: 'bg-teal-100 text-teal-800',
    pink: 'bg-pink-100 text-pink-800',
    indigo: 'bg-indigo-100 text-indigo-800',
  }

  const UNIT_BADGE_COLORS: Record<string, string> = {
    green: 'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    purple: 'bg-purple-100 text-purple-800 border-purple-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
    teal: 'bg-teal-100 text-teal-800 border-teal-300',
    pink: 'bg-pink-100 text-pink-800 border-pink-300',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  }

  const getStatusBadge = (status: ItemStatus) => {
    const config = statusBadgeMap[status]
    const badgeColor = BADGE_COLORS[config?.color || 'gray'] || BADGE_COLORS.gray
    const label = config?.label || status || 'Sin estado'
    return <Badge className={badgeColor}>{label}</Badge>
  }

  const getUnitStatusBadge = (status: string): { badgeColor: string; label: string } => {
    const config = statusBadgeMap[status]
    const badgeColor = UNIT_BADGE_COLORS[config?.color || 'gray'] || UNIT_BADGE_COLORS.gray
    const label = config?.label || status || 'Sin estado'
    return { badgeColor: badgeColor || 'bg-gray-100 text-gray-800 border-gray-300', label }
  }

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items
    const q = normalizeText(debouncedSearch)
    return items.filter(item =>
      normalizeText(item.name).includes(q) ||
      normalizeText(item.code).includes(q) ||
      normalizeText(item.brand).includes(q) ||
      normalizeText(item.model).includes(q) ||
      normalizeText(item.category).includes(q)
    )
  }, [items, debouncedSearch])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventario de Bienes</h1>
          <p className="text-muted-foreground">Gestión de bienes y existencias</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab !== 'papelera' && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-muted' : ''}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-muted' : ''}
              >
                <List className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsBulkImportOpen(true)}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importar desde Excel
              </Button>
              {activeTab !== 'papelera' && (
                <ItemFormDialog
                  open={isDialogOpen}
                  onOpenChange={setIsDialogOpen}
                  editingItem={editingItem}
                  formData={formData as unknown as ItemFormData}
                  onFormDataChange={setFormData as React.Dispatch<React.SetStateAction<ItemFormData>>}
                  onSubmit={handleSubmit}
                  onReset={resetForm}
                  categories={categories}
                  warehouses={warehouses}
                  estados={estados}
                  config={config}
                  supportDocument={supportDocument}
                  onSupportDocumentChange={setSupportDocument}
                  supportDocumentUrl={supportDocumentUrl}
                  isUploading={isUploading}
                  patrimonialCodesList={patrimonialCodesList}
                  onPatrimonialCodesListChange={setPatrimonialCodesList}
                  existingPatrimonialCodes={existingPatrimonialCodes}
                  patrimonialUnitStatuses={patrimonialUnitStatuses}
                  onPatrimonialUnitStatusesChange={setPatrimonialUnitStatuses}
                  selectedUnitIds={selectedUnitIds}
                  onSelectedUnitIdsChange={setSelectedUnitIds}
                  onOpenEstadosDialog={() => {
                    setEditingEstado(null)
                    setEstadoFormData({ name: '', label: '', color: 'gray' })
                    setIsEstadosDialogOpen(true)
                  }}
                  getUnitStatusBadge={getUnitStatusBadge}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Pestañas: Inventario / Papelera */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="papelera" className="text-orange-600">
            <Archive className="h-4 w-4 mr-1" />
            Papelera
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="space-y-4">
          <ItemFilters
            search={search}
            onSearchChange={setSearch}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            itemTypeFilter={itemTypeFilter}
            onItemTypeFilterChange={setItemTypeFilter}
            categories={categories}
            estados={estados}
            config={config}
          />

          <ItemTable
            viewMode={viewMode}
            items={items}
            filteredItems={filteredItems}
            selectedItems={selectedItems}
            isLoading={isLoading}
            totalPages={totalPages}
            page={page}
            total={total}
            config={config}
            expandedPU={expandedPU}
            activeTab={activeTab}
            onToggleSelectItem={toggleSelectItem}
            onToggleSelectAll={toggleSelectAll}
            onSetSelectedItems={setSelectedItems}
            onSetPage={setPage}
            onSetExpandedPU={setExpandedPU as React.Dispatch<React.SetStateAction<Set<number>>>}
            onOpenEditDialog={openEditDialog}
            onDeleteClick={handleDeleteClick}
            onOpenQRDialog={openQRDialog}
            onWhereaboutsClick={(itemId, itemName) => {
              setWhereaboutsItemId(itemId)
              setWhereaboutsItemName(itemName)
              setWhereaboutsOpen(true)
            }}
            onGenerateBulkQR={generateBulkQR}
            onBulkDeleteConfirmOpen={setBulkDeleteConfirmOpen}
            getStatusBadge={getStatusBadge}
            getUnitStatusBadge={getUnitStatusBadge}
            onRestore={handleRestore}
            onPermanentDeleteClick={handlePermanentDeleteClick}
            onBulkRestore={handleBulkRestore}
            onBulkPermanentDeleteOpen={setBulkPermanentDeleteOpen}
          />
        </TabsContent>

        <TabsContent value="papelera" className="space-y-4">
          <ItemTable
            viewMode={viewMode}
            items={items}
            filteredItems={filteredItems}
            selectedItems={selectedItems}
            isLoading={isLoading}
            totalPages={totalPages}
            page={page}
            total={total}
            config={config}
            expandedPU={expandedPU}
            activeTab={activeTab}
            onToggleSelectItem={toggleSelectItem}
            onToggleSelectAll={toggleSelectAll}
            onSetSelectedItems={setSelectedItems}
            onSetPage={setPage}
            onSetExpandedPU={setExpandedPU as React.Dispatch<React.SetStateAction<Set<number>>>}
            onOpenEditDialog={openEditDialog}
            onDeleteClick={handleDeleteClick}
            onOpenQRDialog={openQRDialog}
            onWhereaboutsClick={(itemId, itemName) => {
              setWhereaboutsItemId(itemId)
              setWhereaboutsItemName(itemName)
              setWhereaboutsOpen(true)
            }}
            onGenerateBulkQR={generateBulkQR}
            onBulkDeleteConfirmOpen={setBulkDeleteConfirmOpen}
            getStatusBadge={getStatusBadge}
            getUnitStatusBadge={getUnitStatusBadge}
            onRestore={handleRestore}
            onPermanentDeleteClick={handlePermanentDeleteClick}
            onBulkRestore={handleBulkRestore}
            onBulkPermanentDeleteOpen={setBulkPermanentDeleteOpen}
          />
        </TabsContent>
      </Tabs>

      {/* Diálogo de importación desde Excel */}
      <BulkImportDialog
        open={isBulkImportOpen}
        onOpenChange={setIsBulkImportOpen}
        onImportComplete={fetchItems}
      />

      {/* Diálogo de códigos QR */}
      <QRCodeGenerator
        open={isQROpen}
        onOpenChange={setIsQROpen}
        data={selectedQRData}
        multipleCodes={multipleQRData}
      />

      {/* Modal de confirmación de eliminación */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mover a la papelera?</AlertDialogTitle>
            <AlertDialogDescription>
              El bien "{itemToDelete?.name}" será movido a la papelera. Podrá restaurarlo si lo necesita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-orange-600 hover:bg-orange-700">
              Mover a Papelera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmación de eliminación en bloque */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mover {selectedItems.length} bienes a la papelera?</AlertDialogTitle>
            <AlertDialogDescription>
              Los bienes seleccionados serán movidos a la papelera. Podrá restaurarlos si los necesita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkSoftDelete} className="bg-orange-600 hover:bg-orange-700">
              Mover a Papelera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmación de eliminación permanente en bloque */}
      <AlertDialog open={bulkPermanentDeleteOpen} onOpenChange={setBulkPermanentDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">¡Advertencia!</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar permanentemente {selectedItems.length} bienes? Esta acción NO se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkPermanentDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de eliminación permanente de un bien */}
      <AlertDialog open={permanentDeleteConfirmOpen} onOpenChange={setPermanentDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">¡Advertencia!</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar permanentemente el bien "<strong>{itemToPermanentDelete?.name}</strong>"? Esta acción <strong>NO se puede deshacer</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPermanentDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de carga masiva desde Excel */}
      <Dialog open={isBulkUploadOpen} onOpenChange={(open) => {
        setIsBulkUploadOpen(open)
        if (!open) {
          setBulkUploadFile(null)
          setBulkUploadResults(null)
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Carga Masiva de Bienes
            </DialogTitle>
            <DialogDescription>
              Importe múltiples bienes desde un archivo Excel (.xlsx, .xls)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instrucciones */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Formato del archivo Excel:</h4>
                <p className="text-sm text-blue-700 mb-2">El archivo debe tener las siguientes columnas (la primera fila como encabezado):</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-blue-600">
                  <span><strong>nombre</strong> - Nombre del bien *</span>
                  <span><strong>codigo</strong> - Código único (auto si vacío)</span>
                  <span><strong>modelo</strong> - Modelo</span>
                  <span><strong>marca</strong> - Marca</span>
                  <span><strong>color</strong> - Color</span>
                  <span><strong>serie</strong> - Número de serie</span>
                  <span><strong>tipo</strong> - CONSUMIBLE o PATRIMONIAL</span>
                  <span><strong>categoria</strong> - Categoría</span>
                  <span><strong>cantidad</strong> - Cantidad (número)</span>
                  <span><strong>stockMinimo</strong> - Stock mínimo</span>
                  <span><strong>codigoPatrimonial</strong> - Código(s) patrimonial(es)</span>
                  <span><strong>almacen</strong> - Nombre del almacén</span>
                  <span><strong>ubicacion</strong> - Ubicación física</span>
                  <span><strong>especificaciones</strong> - Especificaciones técnicas</span>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  * Campo obligatorio. Para bienes patrimoniales con múltiples unidades, 
                  separe los códigos patrimoniales con comas.
                </p>
              </CardContent>
            </Card>

            {/* Campo de archivo */}
            <div className="space-y-2">
              <Label>Archivo Excel</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setBulkUploadFile(file)
                      setBulkUploadResults(null)
                    }
                  }}
                  className="flex-1"
                />
              </div>
              {bulkUploadFile && (
                <p className="text-sm text-muted-foreground">
                  Archivo seleccionado: {bulkUploadFile.name}
                </p>
              )}
            </div>

            {/* Resultados */}
            {bulkUploadResults && (
              <div className="space-y-2">
                <h4 className="font-semibold">Resultados de la importación:</h4>
                
                {bulkUploadResults.success.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-800 font-medium text-sm">
                      ✓ {bulkUploadResults.success.length} bienes importados correctamente
                    </p>
                    <div className="max-h-32 overflow-y-auto mt-2">
                      {bulkUploadResults.success.map((item: { row: number; name: string; code: string; type: string }, idx: number) => (
                        <p key={idx} className="text-xs text-green-600">
                          Fila {item.row}: {item.name} ({item.code}) - {item.type}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {bulkUploadResults.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-800 font-medium text-sm">
                      ✗ {bulkUploadResults.errors.length} errores encontrados
                    </p>
                    <div className="max-h-32 overflow-y-auto mt-2">
                      {bulkUploadResults.errors.map((err: { row: number; error: string }, idx: number) => (
                        <p key={idx} className="text-xs text-red-600">
                          Fila {err.row}: {err.error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Acciones */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBulkUploadOpen(false)
                  setBulkUploadFile(null)
                  setBulkUploadResults(null)
                }}
              >
                Cerrar
              </Button>
              <Button
                onClick={handleBulkUpload}
                disabled={!bulkUploadFile || isBulkUploading}
                style={{ backgroundColor: config?.primaryColor }}
              >
                {isBulkUploading ? (
                  <>
                    <Package className="h-4 w-4 mr-2 animate-pulse" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Bienes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de ubicación de unidades patrimoniales */}
      <WhereaboutsDialog
        open={whereaboutsOpen}
        onOpenChange={setWhereaboutsOpen}
        itemId={whereaboutsItemId}
        itemName={whereaboutsItemName}
      />

      {/* Diálogo de gestión de estados */}
      <Dialog open={isEstadosDialogOpen} onOpenChange={(open) => { if (!open) { setEditingEstado(null); setEstadoFormData({ name: '', label: '', color: 'gray' }); } setIsEstadosDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Gestionar Estados
            </DialogTitle>
            <DialogDescription>
              Administre los estados disponibles para los bienes. Puede agregar, editar o eliminar estados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Formulario para agregar/editar estado */}
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-4 space-y-3">
                <h4 className="font-semibold text-sm">
                  {editingEstado ? 'Editar Estado' : 'Nuevo Estado'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre interno</Label>
                    <Input
                      placeholder="ej: OPERATIVO"
                      value={estadoFormData.name}
                      onChange={(e) => setEstadoFormData({ ...estadoFormData, name: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                      disabled={false}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Etiqueta visible</Label>
                    <Input
                      placeholder="ej: Operativo"
                      value={estadoFormData.label}
                      onChange={(e) => setEstadoFormData({ ...estadoFormData, label: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {['gray', 'green', 'yellow', 'red', 'blue', 'purple', 'orange', 'teal', 'pink', 'indigo'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEstadoFormData({ ...estadoFormData, color: c })}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          estadoFormData.color === c ? 'border-black scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: 
                          c === 'green' ? '#22c55e' : 
                          c === 'yellow' ? '#eab308' : 
                          c === 'red' ? '#ef4444' : 
                          c === 'blue' ? '#3b82f6' : 
                          c === 'purple' ? '#a855f7' : 
                          c === 'orange' ? '#f97316' : 
                          c === 'teal' ? '#14b8a6' : 
                          c === 'pink' ? '#ec4899' : 
                          c === 'indigo' ? '#6366f1' : 
                          '#6b7280'
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingEstado(null)
                      setEstadoFormData({ name: '', label: '', color: 'gray' })
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    style={{ backgroundColor: config?.primaryColor }}
                    onClick={async () => {
                      if (!estadoFormData.name.trim() || !estadoFormData.label.trim()) {
                        toast.error('Nombre y etiqueta son requeridos')
                        return
                      }
                      try {
                        if (editingEstado) {
                          const response = await apiFetch(`/api/estados/${editingEstado.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              name: estadoFormData.name,
                              label: estadoFormData.label,
                              color: estadoFormData.color
                            })
                          })
                          if (response.ok) {
                            toast.success('Estado actualizado correctamente')
                            setEditingEstado(null)
                            setEstadoFormData({ name: '', label: '', color: 'gray' })
                            fetchEstados()
                          } else {
                            const err = await response.json()
                            toast.error(err.error || 'Error al actualizar')
                          }
                        } else {
                          const response = await apiFetch('/api/estados', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(estadoFormData)
                          })
                          if (response.ok) {
                            toast.success('Estado creado correctamente')
                            setEstadoFormData({ name: '', label: '', color: 'gray' })
                            fetchEstados()
                          } else {
                            const err = await response.json()
                            toast.error(err.error || 'Error al crear')
                          }
                        }
                      } catch {
                        toast.error('Error al guardar estado')
                      }
                    }}
                  >
                    {editingEstado ? 'Guardar Cambios' : 'Agregar Estado'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de estados existentes */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <h4 className="font-semibold text-sm">Estados existentes</h4>
              {estadosLoading ? (
                <p className="text-sm text-muted-foreground">Cargando...</p>
              ) : estados.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay estados disponibles</p>
              ) : (
                estados.map((est) => (
                  <div key={est.id} className="flex items-center justify-between p-2 bg-white rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: 
                          est.color === 'green' ? '#22c55e' : 
                          est.color === 'yellow' ? '#eab308' : 
                          est.color === 'red' ? '#ef4444' : 
                          est.color === 'blue' ? '#3b82f6' : 
                          est.color === 'purple' ? '#a855f7' : 
                          est.color === 'orange' ? '#f97316' : 
                          est.color === 'teal' ? '#14b8a6' : 
                          est.color === 'pink' ? '#ec4899' : 
                          est.color === 'indigo' ? '#6366f1' : 
                          '#6b7280'
                        }}
                      />
                      <span className="font-medium text-sm">{est.label}</span>
                      <span className="text-xs text-muted-foreground">({est.name})</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingEstado(est)
                          setEstadoFormData({ name: est.name, label: est.label, color: est.color })
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500"
                        onClick={() => setDeleteEstadoConfirm(est)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de eliminación de estado */}
      <AlertDialog open={!!deleteEstadoConfirm} onOpenChange={(open) => { if (!open) setDeleteEstadoConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estado "{deleteEstadoConfirm?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el estado permanentemente. Si hay bienes usando este estado, no se podrá eliminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteEstadoConfirm(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!deleteEstadoConfirm) return
                try {
                  const response = await apiFetch(`/api/estados/${deleteEstadoConfirm.id}`, {
                    method: 'DELETE'
                  })
                  if (response.ok) {
                    toast.success('Estado eliminado correctamente')
                    setDeleteEstadoConfirm(null)
                    fetchEstados()
                    // Si el estado eliminado era el seleccionado en el formulario, resetear
                    if (formData.status === deleteEstadoConfirm.name) {
                      setFormData(prev => ({ ...prev, status: 'OPERATIVO' }))
                    }
                    if (statusFilter === deleteEstadoConfirm.name) {
                      setStatusFilter('all')
                    }
                  } else {
                    const err = await response.json()
                    toast.error(err.error || 'Error al eliminar')
                    setDeleteEstadoConfirm(null)
                  }
                } catch {
                  toast.error('Error al eliminar estado')
                  setDeleteEstadoConfirm(null)
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
