'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useWarehousesStore, useConfigStore, useUsersStore } from '@/store'
import { Plus, Edit, Trash2, Download, Warehouse as WarehouseIcon, Package, User, FileText, FileSpreadsheet, Search, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { Warehouse } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { normalizeText } from '@/lib/utils'

export function AlmacenesModule() {
  const warehouses = useWarehousesStore(s => s.warehouses)
  const setWarehouses = useWarehousesStore(s => s.setWarehouses)
  const addWarehouse = useWarehousesStore(s => s.addWarehouse)
  const updateWarehouse = useWarehousesStore(s => s.updateWarehouse)
  const removeWarehouse = useWarehousesStore(s => s.removeWarehouse)
  const users = useUsersStore(s => s.users)
  const setUsers = useUsersStore(s => s.setUsers)
  const config = useConfigStore(s => s.config)

  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    managerId: '',
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const fetchWarehouses = useCallback(async () => {
    try {
      const response = await apiFetch('/api/warehouses')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data.warehouses)
      }
    } catch (error) {
      console.error('Error al obtener warehouses:', error)
      toast.error('Error al cargar los almacenes')
    } finally {
      setIsLoading(false)
    }
  }, [setWarehouses])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiFetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error al obtener users:', error)
    }
  }, [setUsers])

  useEffect(() => {
    fetchWarehouses()
    fetchUsers()
  }, [fetchWarehouses, fetchUsers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        managerId: formData.managerId ? parseInt(formData.managerId) : null,
      }

      if (editingWarehouse) {
        const response = await apiFetch(`/api/warehouses/${editingWarehouse.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          updateWarehouse(editingWarehouse.id, data.warehouse)
          toast.success('Almacén actualizado correctamente')
        }
      } else {
        const response = await apiFetch('/api/warehouses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          addWarehouse(data.warehouse)
          toast.success('Almacén registrado correctamente')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al registrar')
        }
      }
      
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error al guardar warehouse:', error)
      toast.error('Error al guardar el almacén')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (warehouse: Warehouse) => {
    setWarehouseToDelete(warehouse)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!warehouseToDelete) return
    const response = await apiFetch(`/api/warehouses/${warehouseToDelete.id}`, { method: 'DELETE' })
    if (response.ok) {
      removeWarehouse(warehouseToDelete.id)
      setWarehouseToDelete(null)
    } else {
      const data = await response.json()
      throw new Error(data.error || 'Error al eliminar')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', location: '', description: '', managerId: '' })
    setEditingWarehouse(null)
  }

  const openEditDialog = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setFormData({
      name: warehouse.name,
      location: warehouse.location,
      description: warehouse.description || '',
      managerId: warehouse.managerId ? String(warehouse.managerId) : '',
    })
    setIsDialogOpen(true)
  }

  const almaceneros = useMemo(() => users.filter(u => u.role === 'ALMACENERO'), [users])

  const filteredWarehouses = useMemo(() => {
    const normalizedSearch = normalizeText(search)
    return warehouses.filter(w => {
      const matchesSearch = normalizeText(w.name).includes(normalizedSearch) ||
        normalizeText(w.location).includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && w.isActive) ||
        (statusFilter === 'inactive' && !w.isActive)
      return matchesSearch && matchesStatus
    })
  }, [warehouses, search, statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Almacenes</h1>
          <p className="text-muted-foreground">Administrar almacenes de la institución</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: config?.primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Almacén
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingWarehouse ? 'Editar Almacén' : 'Nuevo Almacén'}</DialogTitle>
              <DialogDescription>
                Complete los campos para {editingWarehouse ? 'actualizar' : 'registrar'} el almacén
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Ubicación *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="managerId">Responsable</Label>
                <Select 
                  value={formData.managerId} 
                  onValueChange={(value) => setFormData({ ...formData, managerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {almaceneros.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isSaving ? 'Guardando...' : editingWarehouse ? 'Actualizar' : 'Registrar'}
                </Button>
              </div>
            </form>
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
              <DropdownMenuItem onClick={() => exportToCSV(filteredWarehouses, [
                { key: 'name', label: 'Nombre' },
                { key: 'location', label: 'Ubicación' },
                { key: 'description', label: 'Descripción' },
                { key: 'isActive', label: 'Activo' },
              ], `almacenes-${new Date().toISOString().slice(0, 10)}`)}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(filteredWarehouses, [
                { key: 'name', label: 'Nombre' },
                { key: 'location', label: 'Ubicación' },
                { key: 'description', label: 'Descripción' },
                { key: 'isActive', label: 'Activo' },
              ], `almacenes-${new Date().toISOString().slice(0, 10)}`)}>
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
                placeholder="Buscar por nombre o ubicación..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <ModuleSkeleton variant="cards" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWarehouses.map((warehouse) => (
            <Card key={warehouse.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${config?.secondaryColor}20` }}
                    >
                      <WarehouseIcon className="h-5 w-5" style={{ color: config?.secondaryColor }} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                      <CardDescription>{warehouse.location}</CardDescription>
                    </div>
                  </div>
                  <Badge className={warehouse.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {warehouse.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {warehouse.description && (
                  <p className="text-sm text-muted-foreground mb-4">{warehouse.description}</p>
                )}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{(warehouse as { _count?: { items: number } })._count?.items || 0} bienes</span>
                  </div>
                  {warehouse.manager && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{warehouse.manager.fullName}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(warehouse)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => handleDeleteClick(warehouse)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredWarehouses.length === 0 && !isLoading && (
        <EmptyState icon={WarehouseIcon} title={search || statusFilter !== 'all' ? 'No se encontraron almacenes con los filtros actuales' : 'No hay almacenes registrados'} />
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        itemName={warehouseToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
