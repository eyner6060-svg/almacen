'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

import { ResponsiveTable } from '@/components/ui/responsive-table'
import { useVehiclesStore, useConfigStore, useUsersStore } from '@/store'
import { Plus, Search, Edit, Trash2, Download, Truck, User, CheckCircle, XCircle, FileText, FileSpreadsheet, Loader2, Save } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { normalizeText } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { Vehicle } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'

export function VehiculosModule() {
  const { vehicles, setVehicles, addVehicle, updateVehicle, removeVehicle } = useVehiclesStore()
  const { config } = useConfigStore()
  const { users, setUsers } = useUsersStore()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    plate: '',
    description: '',
    isActive: true,
    driverId: ''
  })

  const fetchVehicles = useCallback(async () => {
    try {
      const response = await apiFetch('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles)
      }
    } catch (error) {
      console.error('Error al obtener vehicles:', error)
      toast.error('Error al cargar los vehículos')
    } finally {
      setIsLoading(false)
    }
  }, [setVehicles])

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
    fetchVehicles()
    fetchUsers()
  }, [fetchVehicles, fetchUsers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        driverId: formData.driverId ? parseInt(formData.driverId) : undefined
      }

      if (editingVehicle) {
        const response = await apiFetch(`/api/vehicles/${editingVehicle.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          updateVehicle(editingVehicle.id, data.vehicle)
          toast.success('Vehículo actualizado correctamente')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al actualizar')
        }
      } else {
        const response = await apiFetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          addVehicle(data.vehicle)
          toast.success('Vehículo registrado correctamente')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al registrar')
        }
      }

      setIsDialogOpen(false)
      resetForm()
      fetchVehicles()
    } catch (error) {
      console.error('Error al guardar vehicle:', error)
      toast.error('Error al guardar el vehículo')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (vehicle: Vehicle) => {
    setVehicleToDelete(vehicle)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!vehicleToDelete) return

    try {
      const response = await apiFetch(`/api/vehicles/${vehicleToDelete.id}`, { method: 'DELETE' })
      if (response.ok) {
        removeVehicle(vehicleToDelete.id)
        toast.success('Vehículo eliminado correctamente')
        fetchVehicles()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error al eliminar vehicle:', error)
      toast.error('Error al eliminar el vehículo')
    } finally {
      setDeleteConfirmOpen(false)
      setVehicleToDelete(null)
    }
  }

  const handleToggleActive = async (vehicle: Vehicle) => {
    try {
      const response = await apiFetch(`/api/vehicles/${vehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !vehicle.isActive }),
      })
      if (response.ok) {
        const data = await response.json()
        updateVehicle(vehicle.id, data.vehicle)
        toast.success(`Vehículo ${!vehicle.isActive ? 'activado' : 'desactivado'}`)
      }
    } catch (error) {
      console.error('Error al cambiar estado del vehículo:', error)
      toast.error('Error al cambiar estado del vehículo')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      plate: '',
      description: '',
      isActive: true,
      driverId: ''
    })
    setEditingVehicle(null)
  }

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setFormData({
      name: vehicle.name,
      plate: vehicle.plate,
      description: vehicle.description || '',
      isActive: vehicle.isActive,
      driverId: vehicle.driverId ? String(vehicle.driverId) : ''
    })
    setIsDialogOpen(true)
  }

  // Obtener conductores (usuarios con isDriver = true)
  const drivers = users.filter(u => u.isDriver && u.isActive)
  
  // Filtrar conductores disponibles (no asignados o asignados al vehículo actual)
  const getAvailableDrivers = () => {
    return drivers.filter(d => {
      if (!d.vehicle) return true
      if (editingVehicle && d.vehicle.id === editingVehicle.id) return true
      return false
    })
  }

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = normalizeText(vehicle.name).includes(normalizeText(search)) ||
      normalizeText(vehicle.plate).includes(normalizeText(search))
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Gestión de Vehículos
          </h1>
          <p className="text-muted-foreground">Administrar vehículos de la institución</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: config?.primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Vehículo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingVehicle ? 'Editar Vehículo' : 'Registrar Vehículo'}</DialogTitle>
              <DialogDescription>
                Complete los campos para {editingVehicle ? 'actualizar' : 'registrar'} el vehículo
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre / Descripción *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Toyota Hilux"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plate">Placa *</Label>
                  <Input
                    id="plate"
                    value={formData.plate}
                    onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                    placeholder="Ej: ABC-123"
                    required
                    maxLength={8}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Características adicionales del vehículo..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverId">Conductor Asignado</Label>
                <Select
                  value={formData.driverId || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, driverId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {getAvailableDrivers().map((driver) => (
                      <SelectItem key={driver.id} value={String(driver.id)}>
                        {driver.fullName} - {driver.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getAvailableDrivers().length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay conductores disponibles. Registre usuarios como conductores primero.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="isActive">Vehículo activo</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {isSaving ? 'Guardando...' : editingVehicle ? 'Actualizar' : 'Registrar'}
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
              <DropdownMenuItem onClick={() => exportToCSV(filteredVehicles, [
                { key: 'name', label: 'Nombre' },
                { key: 'plate', label: 'Placa' },
                { key: 'description', label: 'Descripción' },
                { key: 'isActive', label: 'Activo' },
              ], `vehiculos-${new Date().toISOString().slice(0, 10)}`)}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(filteredVehicles, [
                { key: 'name', label: 'Nombre' },
                { key: 'plate', label: 'Placa' },
                { key: 'description', label: 'Descripción' },
                { key: 'isActive', label: 'Activo' },
              ], `vehiculos-${new Date().toISOString().slice(0, 10)}`)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o placa..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Vehículos */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <ModuleSkeleton variant="table" />
          </CardContent>
        </Card>
      ) : filteredVehicles.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState icon={Truck} title="No se encontraron vehículos" />
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable<Vehicle>
          columns={[
            { key: 'name', label: 'Nombre', render: (vehicle) => (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">{vehicle.name}</p>
                  {vehicle.description && (
                    <p className="text-xs text-muted-foreground">{vehicle.description}</p>
                  )}
                </div>
              </div>
            )},
            { key: 'plate', label: 'Placa', render: (vehicle) => (
              <span className="font-mono font-medium">{vehicle.plate}</span>
            )},
            { key: 'driver', label: 'Conductor', render: (vehicle) => (
              vehicle.driver ? (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium">{vehicle.driver.fullName}</p>
                    <p className="text-xs text-muted-foreground">{vehicle.driver.position}</p>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Sin asignar</span>
              )
            )},
            { key: 'status', label: 'Estado', render: (vehicle) => (
              <Badge className={vehicle.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {vehicle.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            )},
            { key: 'actions', label: '', hideOnMobile: true, className: 'text-right', render: (vehicle) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); handleToggleActive(vehicle); }}
                  title={vehicle.isActive ? 'Desactivar' : 'Activar'}
                >
                  {vehicle.isActive ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditDialog(vehicle); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(vehicle); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )},
          ]}
          data={filteredVehicles}
          keyExtractor={(vehicle) => vehicle.id}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="¿Eliminar vehículo?"
        description={`¿Está seguro de eliminar el vehículo ${vehicleToDelete?.name} (${vehicleToDelete?.plate})? Esta acción no se puede deshacer.`}
        itemName={vehicleToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
