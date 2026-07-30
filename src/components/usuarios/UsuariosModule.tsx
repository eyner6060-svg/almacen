'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { ResponsiveTable } from '@/components/ui/responsive-table'
import { useUsersStore, useConfigStore, useOfficesStore, useVehiclesStore } from '@/store'
import { Plus, Search, Edit, Trash2, Download, UserCheck, UserX, Shield, Truck, Check, X, Eye, EyeOff, Users, FileText, FileSpreadsheet, Loader2, Save } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { User, Role } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { normalizeText } from '@/lib/utils'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'

const roleConfig: Record<Role, { label: string; color: string }> = {
  ADMINISTRADOR: { label: 'Administrador', color: 'bg-purple-100 text-purple-800' },
  ALMACENERO: { label: 'Almacenero', color: 'bg-blue-100 text-blue-800' },
  JEFE_OFICINA: { label: 'Jefe de Oficina', color: 'bg-green-100 text-green-800' },
  TRABAJADOR: { label: 'Trabajador', color: 'bg-gray-100 text-gray-800' },
}

export function UsuariosModule() {
  const { users, setUsers, addUser, updateUser, removeUser } = useUsersStore()
  const { config } = useConfigStore()
  const { offices, setOffices } = useOfficesStore()
  const { vehicles, setVehicles } = useVehiclesStore()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  
  const [formData, setFormData] = useState({
    fullName: '',
    dni: '',
    phone: '',
    position: '',
    email: '',
    password: '',
    pin: '1234',
    role: 'TRABAJADOR' as Role,
    officeId: '',
    isActive: true,
    isDriver: false,
    vehicleId: '',
  })

  // Requisitos de validación de contraseña
  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
    { label: 'Al menos una mayúscula', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Al menos una minúscula', test: (p: string) => /[a-z]/.test(p) },
    { label: 'Al menos un número', test: (p: string) => /[0-9]/.test(p) },
    { label: 'Al menos un carácter especial (!@#$%^&*)', test: (p: string) => /[!@#$%^&*]/.test(p) },
  ]

  const getPasswordStrength = (password: string) => {
    const passed = passwordRequirements.filter(req => req.test(password)).length
    return {
      passed,
      total: passwordRequirements.length,
      percentage: (passed / passwordRequirements.length) * 100
    }
  }

  const passwordStrength = getPasswordStrength(formData.password)

  const fetchUsers = useCallback(async () => {
    try {
      const response = await apiFetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error al obtener users:', error)
      toast.error('Error al cargar los usuarios')
    } finally {
      setIsLoading(false)
    }
  }, [setUsers])

  const fetchOffices = useCallback(async () => {
    try {
      const response = await apiFetch('/api/offices')
      if (response.ok) {
        const data = await response.json()
        setOffices(data.offices)
      }
    } catch (error) {
      console.error('Error al obtener offices:', error)
    }
  }, [setOffices])

  const fetchVehicles = useCallback(async () => {
    try {
      const response = await apiFetch('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles)
      }
    } catch (error) {
      console.error('Error al obtener vehicles:', error)
    }
  }, [setVehicles])

  useEffect(() => {
    fetchUsers()
    fetchOffices()
    fetchVehicles()
  }, [fetchUsers, fetchOffices, fetchVehicles])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsSaving(true)

    // Validar contraseña para usuarios nuevos o al cambiar
    if (!editingUser || formData.password) {
      const allRequirementsMet = passwordRequirements.every(req => req.test(formData.password))
      if (!allRequirementsMet) {
        toast.error('La contraseña no cumple con todos los requisitos de seguridad')
        return
      }
    }
    
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        officeId: formData.officeId || undefined,
        vehicleId: formData.isDriver && formData.vehicleId ? formData.vehicleId : undefined,
      }

      if (editingUser) {
        const response = await apiFetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          updateUser(editingUser.id, data.user)
          toast.success('Usuario actualizado correctamente')
        } else {
          const data = await response.json()
          toast.error(`[${response.status}] ${data.error || 'Error al actualizar'}${data.code ? ` (${data.code})` : ''}${data.details ? ': ' + JSON.stringify(data.details) : ''}`)
        }
      } else {
        const response = await apiFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          addUser(data.user)
          toast.success('Usuario registrado correctamente')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al registrar')
        }
      }
      
      setIsDialogOpen(false)
      resetForm()
          fetchVehicles() // Refrescar vehículos para reflejar cambio de conductor
    } catch (error) {
      console.error('Error al guardar user:', error)
      toast.error('Error al guardar el usuario')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return
    
    try {
      const response = await apiFetch(`/api/users/${userToDelete.id}`, { method: 'DELETE' })
      if (response.ok) {
        removeUser(userToDelete.id)
        toast.success('Usuario eliminado correctamente')
        fetchVehicles()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error al eliminar user:', error)
      toast.error('Error al eliminar el usuario')
    } finally {
      setDeleteConfirmOpen(false)
      setUserToDelete(null)
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const response = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (response.ok) {
        const data = await response.json()
        updateUser(user.id, data.user)
        toast.success(`Usuario ${!user.isActive ? 'activado' : 'desactivado'}`)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al cambiar estado del usuario')
      }
    } catch (error) {
      console.error('Error al cambiar estado del usuario:', error)
      toast.error('Error al cambiar estado del usuario')
    }
  }

  const resetForm = () => {
    setFormData({
      fullName: '',
      dni: '',
      phone: '',
      position: '',
      email: '',
      password: '',
      pin: '1234',
      role: 'TRABAJADOR',
      officeId: '',
      isActive: true,
      isDriver: false,
      vehicleId: '',
    })
    setEditingUser(null)
  }

  const openEditDialog = async (user: User) => {
    setEditingUser(user)
    try {
      const response = await apiFetch(`/api/users/${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const fullUser = data.user
        setFormData({
          fullName: fullUser.fullName,
          dni: fullUser.dni,
          phone: fullUser.phone || '',
          position: fullUser.position,
          email: fullUser.email,
          password: '',
          pin: fullUser.hasPin ? '****' : '1234',
          role: fullUser.role,
          officeId: fullUser.officeId ? String(fullUser.officeId) : '',
          isActive: fullUser.isActive,
          isDriver: fullUser.isDriver || false,
          vehicleId: fullUser.vehicle?.id ? String(fullUser.vehicle.id) : '',
        })
      } else {
        toast.error('Error al cargar datos del usuario')
        return
      }
    } catch {
      toast.error('Error al cargar datos del usuario')
      return
    }
    setIsDialogOpen(true)
  }

  const getRoleBadge = (role: Role) => {
    const cfg = roleConfig[role]
    return (
      <Badge className={cfg.color}>
        <Shield className="h-3 w-3 mr-1" />
        {cfg.label}
      </Badge>
    )
  }

  // Filtrar vehículos disponibles (no asignados o asignados al usuario actual)
  const getAvailableVehicles = () => {
    if (!formData.isDriver) return []
    
    return vehicles.filter(v => {
      if (!v.isActive) return false
      if (!v.driverId) return true
      if (editingUser && v.driverId === editingUser.id) return true
      return false
    })
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = normalizeText(user.fullName).includes(normalizeText(search)) ||
      normalizeText(user.email).includes(normalizeText(search)) ||
      normalizeText(user.dni).includes(normalizeText(search))
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administrar usuarios del sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: config?.primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuario' : 'Registrar Usuario'}</DialogTitle>
              <DialogDescription>
                Complete los campos para {editingUser ? 'actualizar' : 'registrar'} el usuario
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre completo *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI *</Label>
                  <Input
                    id="dni"
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    required
                    maxLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Cargo *</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value: Role) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
                      <SelectItem value="ALMACENERO">Almacenero</SelectItem>
                      <SelectItem value="JEFE_OFICINA">Jefe de Oficina</SelectItem>
                      <SelectItem value="TRABAJADOR">Trabajador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="officeId">Oficina</Label>
                <Select 
                  value={formData.officeId} 
                  onValueChange={(value) => setFormData({ ...formData, officeId: value })}
                >
                  <SelectTrigger className="truncate">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices.map((office) => (
                      <SelectItem key={office.id} value={String(office.id)} className="truncate">
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN de autorización</Label>
                <Input
                  id="pin"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  Contraseña {editingUser ? '(dejar vacío para no cambiar)' : '*'}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                
                {/* Indicador de Fortaleza de Contraseña - Siempre visible */}
                <div className="space-y-2 mt-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Fortaleza de la contraseña</span>
                    <span className="text-xs font-medium">
                      {passwordStrength.passed}/{passwordStrength.total} requisitos cumplidos
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${passwordStrength.percentage}%`,
                        backgroundColor: passwordStrength.percentage === 100 ? '#22c55e' : 
                                       passwordStrength.percentage >= 60 ? '#eab308' : '#ef4444'
                      }}
                    />
                  </div>
                  
                  {/* Lista de Requisitos */}
                  <div className="grid grid-cols-1 gap-1.5 mt-2">
                    {passwordRequirements.map((req, idx) => {
                      const isMet = req.test(formData.password)
                      return (
                        <div 
                          key={idx}
                          className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                            isMet ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-50'
                          }`}
                        >
                          {isMet ? (
                            <Check className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <X className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span>{req.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              
              {/* Sección de Conductor */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="isDriver"
                    checked={formData.isDriver}
                    onChange={(e) => setFormData({ ...formData, isDriver: e.target.checked, vehicleId: '' })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="isDriver" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Es Conductor
                  </Label>
                </div>
                
                {formData.isDriver && (
                  <div className="space-y-2">
                    <Label>Vehículo Asignado</Label>
                    <Select 
                      value={formData.vehicleId} 
                      onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un vehículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableVehicles().map((vehicle) => (
                          <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                            {vehicle.name} - {vehicle.plate}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getAvailableVehicles().length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No hay vehículos disponibles para asignar
                      </p>
                    )}
                  </div>
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
                <Label htmlFor="isActive">Usuario activo</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {isSaving ? 'Guardando...' : editingUser ? 'Actualizar' : 'Registrar'}
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
              <DropdownMenuItem onClick={() => exportToCSV(filteredUsers, [
                { key: 'fullName', label: 'Nombre' },
                { key: 'dni', label: 'DNI' },
                { key: 'email', label: 'Email' },
                { key: 'position', label: 'Cargo' },
                { key: 'role', label: 'Rol' },
                { key: 'isActive', label: 'Activo' },
              ], `usuarios-${new Date().toISOString().slice(0, 10)}`)}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(filteredUsers, [
                { key: 'fullName', label: 'Nombre' },
                { key: 'dni', label: 'DNI' },
                { key: 'email', label: 'Email' },
                { key: 'position', label: 'Cargo' },
                { key: 'role', label: 'Rol' },
                { key: 'isActive', label: 'Activo' },
              ], `usuarios-${new Date().toISOString().slice(0, 10)}`)}>
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
                placeholder="Buscar por nombre, email o DNI..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
                <SelectItem value="ALMACENERO">Almacenero</SelectItem>
                <SelectItem value="JEFE_OFICINA">Jefe de Oficina</SelectItem>
                <SelectItem value="TRABAJADOR">Trabajador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Usuarios */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <ModuleSkeleton variant="table" />
          </CardContent>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState icon={Users} title="No se encontraron usuarios" />
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable<User>
          columns={[
            { key: 'name', label: 'Nombre', render: (user) => (
              <div>
                <p className="font-medium">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">{user.office?.name || 'Sin oficina'}</p>
              </div>
            )},
            { key: 'dni', label: 'DNI', render: (user) => (
              <span className="font-mono">{user.dni}</span>
            )},
            { key: 'email', label: 'Email', render: (user) => (
              <span className="text-sm">{user.email}</span>
            )},
            { key: 'position', label: 'Cargo', render: (user) => (
              <span>{user.position}</span>
            )},
            { key: 'role', label: 'Rol', render: (user) => getRoleBadge(user.role)},
            { key: 'driver', label: 'Conductor', render: (user) => (
              user.isDriver ? (
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    <Truck className="h-3 w-3 mr-1" />
                    Sí
                  </Badge>
                  {user.vehicle && (
                    <span className="text-xs text-muted-foreground">
                      {user.vehicle.plate}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No</span>
              )
            )},
            { key: 'status', label: 'Estado', render: (user) => (
              <Badge className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                {user.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            )},
            { key: 'actions', label: '', hideOnMobile: true, className: 'text-right', render: (user) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); handleToggleActive(user); }}
                  title={user.isActive ? 'Desactivar' : 'Activar'}
                >
                  {user.isActive ? (
                    <UserX className="h-4 w-4 text-red-500" />
                  ) : (
                    <UserCheck className="h-4 w-4 text-green-500" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditDialog(user); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(user); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )},
          ]}
          data={filteredUsers}
          keyExtractor={(user) => user.id}
        />
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="¿Eliminar usuario?"
        description={`¿Está seguro de eliminar al usuario ${userToDelete?.fullName}? Esta acción no se puede deshacer.`}
        itemName={userToDelete?.fullName || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
