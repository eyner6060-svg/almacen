'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { ResponsiveTable } from '@/components/ui/responsive-table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useConfigStore, useAuthStore } from '@/store'
import { Plus, Search, Edit, Trash2, Download, BookOpen, Package, FileText, FileSpreadsheet, Loader2, Save } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ItemCatalog, ItemType } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { normalizeText } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

export function CatalogManagementModule() {
  const config = useConfigStore(s => s.config)
  const user = useAuthStore(s => s.user)

  const [catalog, setCatalog] = useState<ItemCatalog[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemCatalog | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<ItemCatalog | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    brand: 'S/M',
    model: 'S/M',
    category: '',
    itemType: 'PATRIMONIAL' as ItemType,
    unit: 'UNIDAD',
    technicalSpecs: '',
    defaultMinStock: '1'
  })

  const fetchCatalog = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)

      const response = await apiFetch(`/api/item-catalog?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setCatalog(data.catalog)
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error al obtener el catálogo:', error)
      toast.error('Error al cargar el catálogo')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, categoryFilter])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        defaultMinStock: parseInt(formData.defaultMinStock)
      }

      if (editingItem) {
        const response = await apiFetch('/api/item-catalog', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingItem.id }),
        })
        if (response.ok) {
          toast.success('Item actualizado correctamente')
          fetchCatalog()
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al actualizar')
        }
      } else {
        const response = await apiFetch('/api/item-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          toast.success('Item agregado al catálogo')
          fetchCatalog()
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al crear')
        }
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error al guardar item del catálogo:', error)
      toast.error('Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (item: ItemCatalog) => {
    setItemToDelete(item)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return

    try {
      const response = await apiFetch(`/api/item-catalog?id=${itemToDelete.id}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Item eliminado del catálogo')
        fetchCatalog()
      }
    } catch (error) {
      console.error('Error al eliminar item del catálogo:', error)
      toast.error('Error al eliminar')
    } finally {
      setDeleteConfirmOpen(false)
      setItemToDelete(null)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      brand: 'S/M',
      model: 'S/M',
      category: '',
      itemType: 'PATRIMONIAL',
      unit: 'UNIDAD',
      technicalSpecs: '',
      defaultMinStock: '1'
    })
    setEditingItem(null)
  }

  const openEditDialog = (item: ItemCatalog) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      brand: item.brand,
      model: item.model,
      category: item.category,
      itemType: item.itemType,
      unit: item.unit || 'UNIDAD',
      technicalSpecs: item.technicalSpecs || '',
      defaultMinStock: String(item.defaultMinStock)
    })
    setIsDialogOpen(true)
  }

  const filteredCatalog = useMemo(() => catalog.filter(item => {
    const matchesSearch = !search || normalizeText(item.name).includes(normalizeText(search)) ||
      normalizeText(item.brand).includes(normalizeText(search)) ||
      normalizeText(item.model).includes(normalizeText(search))
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchesSearch && matchesCategory
  }), [catalog, search, categoryFilter])

  const isAuthorized = user?.role === 'ADMINISTRADOR' || user?.role === 'ALMACENERO'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Catálogo de Bienes
          </h1>
          <p className="text-muted-foreground">Gestión de tipos de bienes predefinidos</p>
        </div>
        {isAuthorized && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: config?.primaryColor }}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Item' : 'Nuevo Item del Catálogo'}</DialogTitle>
                <DialogDescription>
                  Complete los campos para {editingItem ? 'actualizar' : 'agregar'} el item al catálogo
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Laptop HP"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoría *</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Ej: Equipos de cómputo"
                      required
                      list="categories-list"
                    />
                    <datalist id="categories-list">
                      {categories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Ej: HP"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="Ej: ProBook 450"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="itemType">Tipo</Label>
                    <Select
                      value={formData.itemType}
                      onValueChange={(value: ItemType) => setFormData({ ...formData, itemType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PATRIMONIAL">Patrimonial</SelectItem>
                        <SelectItem value="CONSUMIBLE">Consumible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidad de Medida</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNIDAD">Unidad</SelectItem>
                        <SelectItem value="KG">Kilogramo (Kg)</SelectItem>
                        <SelectItem value="G">Gramo (g)</SelectItem>
                        <SelectItem value="L">Litro (L)</SelectItem>
                        <SelectItem value="ML">Mililitro (mL)</SelectItem>
                        <SelectItem value="M">Metro (m)</SelectItem>
                        <SelectItem value="CM">Centímetro (cm)</SelectItem>
                        <SelectItem value="M2">Metro cuadrado (m²)</SelectItem>
                        <SelectItem value="M3">Metro cúbico (m³)</SelectItem>
                        <SelectItem value="CAJA">Caja</SelectItem>
                        <SelectItem value="PAQUETE">Paquete</SelectItem>
                        <SelectItem value="ROLLO">Rollo</SelectItem>
                        <SelectItem value="GALON">Galón</SelectItem>
                        <SelectItem value="DOCENA">Docena</SelectItem>
                        <SelectItem value="PAR">Par</SelectItem>
                        <SelectItem value="JUEGO">Juego</SelectItem>
                        <SelectItem value="CIENTO">Ciento</SelectItem>
                        <SelectItem value="MILLAR">Millar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultMinStock">Stock Mínimo</Label>
                    <Input
                      id="defaultMinStock"
                      type="number"
                      min="1"
                      value={formData.defaultMinStock}
                      onChange={(e) => setFormData({ ...formData, defaultMinStock: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technicalSpecs">Especificaciones Técnicas</Label>
                  <Textarea
                    id="technicalSpecs"
                    value={formData.technicalSpecs}
                    onChange={(e) => setFormData({ ...formData, technicalSpecs: e.target.value })}
                    placeholder="Ej: Core i5, 8GB RAM, 256GB SSD"
                    rows={2}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {isSaving ? 'Guardando...' : editingItem ? 'Actualizar' : 'Guardar'}
                  </Button>
                </DialogFooter>
              </form>
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
            <DropdownMenuItem onClick={() => exportToCSV(filteredCatalog, [
              { key: 'name', label: 'Nombre' },
              { key: 'brand', label: 'Marca' },
              { key: 'model', label: 'Modelo' },
              { key: 'category', label: 'Categoría' },
              { key: 'itemType', label: 'Tipo' },
              { key: 'unit', label: 'Unidad' },
            ], `catalogo-${new Date().toISOString().slice(0, 10)}`)}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToExcel(filteredCatalog, [
              { key: 'name', label: 'Nombre' },
              { key: 'brand', label: 'Marca' },
              { key: 'model', label: 'Modelo' },
              { key: 'category', label: 'Categoría' },
              { key: 'itemType', label: 'Tipo' },
              { key: 'unit', label: 'Unidad' },
            ], `catalogo-${new Date().toISOString().slice(0, 10)}`)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, marca o modelo..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Catálogo */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <ModuleSkeleton variant="table" />
          </CardContent>
        </Card>
      ) : filteredCatalog.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState icon={Package} title="No hay items en el catálogo" description="Agregue items para agilizar el registro de bienes" />
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable<ItemCatalog>
          columns={[
            { key: 'name', label: 'Nombre', render: (item) => (
              <div>
                <p className="font-medium">{item.name}</p>
                {item.technicalSpecs && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{item.technicalSpecs}</p>
                )}
              </div>
            )},
            { key: 'brand_model', label: 'Marca / Modelo', render: (item) => (
              <span className="text-sm">{item.brand} / {item.model}</span>
            )},
            { key: 'category', label: 'Categoría', render: (item) => (
              <Badge variant="outline">{item.category}</Badge>
            )},
            { key: 'type', label: 'Tipo', render: (item) => (
              <Badge variant={item.itemType === 'PATRIMONIAL' ? 'default' : 'secondary'}>
                {item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}
              </Badge>
            )},
            { key: 'unit', label: 'Unidad', render: (item) => (
              <Badge variant="outline" className="text-xs">
                {item.unit || 'UNIDAD'}
              </Badge>
            )},
            { key: 'actions', label: '', hideOnMobile: true, className: 'text-right', render: (item) => (
              isAuthorized ? (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditDialog(item); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(item); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null
            )},
          ]}
          data={filteredCatalog}
          keyExtractor={(item) => item.id}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="¿Eliminar item del catálogo?"
        description={`¿Está seguro de eliminar ${itemToDelete?.name} del catálogo? Esta acción no se puede deshacer.`}
        itemName={itemToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
