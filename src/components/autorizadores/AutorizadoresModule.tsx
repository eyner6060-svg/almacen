'use client'

import { useEffect, useState, useRef, startTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { Switch } from '@/components/ui/switch'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useUsersStore, useConfigStore, useOfficesStore } from '@/store'
import { Search, Shield, UserCheck, Fuel, ClipboardList, Edit, Trash2, Loader2, Save, ChevronsUpDown, BookOpen } from 'lucide-react'
import { normalizeText } from '@/lib/utils'
import type { User, Role } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'

const roleConfig: Record<Role, { label: string; color: string }> = {
  ADMINISTRADOR: { label: 'Administrador', color: 'bg-purple-100 text-purple-800' },
  ALMACENERO: { label: 'Almacenero', color: 'bg-blue-100 text-blue-800' },
  JEFE_OFICINA: { label: 'Jefe de Oficina', color: 'bg-green-100 text-green-800' },
  TRABAJADOR: { label: 'Trabajador', color: 'bg-gray-100 text-gray-800' },
}

const authorizeRoles: Role[] = ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA']

export function AutorizadoresModule() {
  const { users, setUsers, updateUser } = useUsersStore()
  const { config } = useConfigStore()
  const { offices, setOffices } = useOfficesStore()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [userSelectorOpen, setUserSelectorOpen] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const userSearchRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    role: '' as Role | '',
    officeId: '',
    isActive: true,
    canAuthorizeOrders: false,
    canAuthorizeFuel: false,
    canAuthorizeAssignments: false,
    canAuthorizeLoans: false,
  })
  const roleChangedByUser = useRef(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersRes, officesRes] = await Promise.all([
          apiFetch('/api/users'),
          apiFetch('/api/offices'),
        ])
        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.users)
        }
        if (officesRes.ok) {
          const data = await officesRes.json()
          setOffices(data.offices)
        }
      } catch {
        toast.error('Error al cargar los datos')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [setUsers, setOffices])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        officeId: formData.officeId ? parseInt(formData.officeId) : null,
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
          toast.success('Autorización actualizada correctamente')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al actualizar')
        }
      } else {
        if (!selectedUserId) {
          toast.error('Debe seleccionar un usuario')
          setIsSaving(false)
          return
        }
        const response = await apiFetch(`/api/users/${selectedUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (response.ok) {
          const data = await response.json()
          updateUser(selectedUserId, data.user)
          toast.success('Autorización otorgada correctamente')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al otorgar autorización')
        }
      }

      setIsDialogOpen(false)
      resetForm()
    } catch {
      toast.error('Error al guardar la autorización')
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
      const response = await apiFetch(`/api/users/${userToDelete.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'TRABAJADOR',
          officeId: userToDelete.officeId,
          canAuthorizeOrders: false,
          canAuthorizeFuel: false,
          canAuthorizeAssignments: false,
          canAuthorizeLoans: false,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        updateUser(userToDelete.id, data.user)
        toast.success('Autorización removida correctamente')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al remover autorización')
      }
    } catch {
      toast.error('Error al remover la autorización')
    } finally {
      setDeleteConfirmOpen(false)
      setUserToDelete(null)
    }
  }

  const resetForm = () => {
    setFormData({
      role: '',
      officeId: '',
      isActive: true,
      canAuthorizeOrders: false,
      canAuthorizeFuel: false,
      canAuthorizeAssignments: false,
      canAuthorizeLoans: false,
    })
    setSelectedUserId(null)
    setEditingUser(null)
    setUserSearch('')
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setSelectedUserId(user.id)
    setFormData({
      role: user.role,
      officeId: user.officeId ? String(user.officeId) : '',
      isActive: user.isActive,
      canAuthorizeOrders: user.canAuthorizeOrders,
      canAuthorizeFuel: user.canAuthorizeFuel,
      canAuthorizeAssignments: user.canAuthorizeAssignments,
      canAuthorizeLoans: user.canAuthorizeLoans,
    })
    setIsDialogOpen(true)
  }

  // Auto-set autorizaciones según el rol seleccionado (solo cuando el usuario cambia el rol manualmente)
  useEffect(() => {
    if (!formData.role || !roleChangedByUser.current) return
    roleChangedByUser.current = false
    if (formData.role === 'ADMINISTRADOR' || formData.role === 'ALMACENERO') {
      setFormData(prev => ({ ...prev, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, canAuthorizeLoans: true }))
    } else if (formData.role === 'JEFE_OFICINA') {
      setFormData(prev => ({ ...prev, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeLoans: true }))
    }
  }, [formData.role])

  useEffect(() => {
    if (userSelectorOpen) {
      setTimeout(() => userSearchRef.current?.focus(), 10)
    } else {
      startTransition(() => setUserSearch(''))
    }
  }, [userSelectorOpen])

  const authorizers = users.filter(u => authorizeRoles.includes(u.role))

  const nonAuthorizerUsers = users.filter(
    u => !authorizeRoles.includes(u.role)
  )

  const filteredUsers = nonAuthorizerUsers.filter(u => {
    if (!userSearch) return true
    const q = normalizeText(userSearch)
    return (
      normalizeText(u.fullName).includes(q) ||
      normalizeText(u.dni).includes(q) ||
      normalizeText(u.email).includes(q)
    )
  })

  const selectedUser = users.find(u => u.id === selectedUserId)

  const filteredAuthorizers = authorizers.filter(user => {
    const q = normalizeText(search)
    const matchesSearch = normalizeText(user.fullName).includes(q) ||
      normalizeText(user.email).includes(q) ||
      normalizeText(user.dni).includes(q)
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const getAuthBadges = (user: User) => (
    <div className="flex gap-1 flex-wrap">
      {user.canAuthorizeOrders && (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
          <ClipboardList className="h-3 w-3 mr-1" />
          Pedidos
        </Badge>
      )}
      {user.canAuthorizeFuel && (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          <Fuel className="h-3 w-3 mr-1" />
          Combustible
        </Badge>
      )}
      {user.canAuthorizeAssignments && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
          <UserCheck className="h-3 w-3 mr-1" />
          Bienes
        </Badge>
      )}
      {user.canAuthorizeLoans && (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
          <BookOpen className="h-3 w-3 mr-1" />
          Préstamos
        </Badge>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Gestión de Autorizadores
          </h1>
          <p className="text-muted-foreground">
            Administrar usuarios con permisos de autorización para pedidos, combustible, bienes y préstamos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <Button
            style={{ backgroundColor: config?.primaryColor }}
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Nueva Autorización
          </Button>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Autorización' : 'Otorgar Autorización'}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? `Modifique los permisos de autorización para ${editingUser.fullName}`
                  : 'Seleccione un usuario existente y asígnele permisos de autorización'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editingUser ? (
                <div className="p-3 bg-gray-50 border rounded-lg">
                  <p className="text-sm font-medium">{editingUser.fullName}</p>
                  <p className="text-xs text-muted-foreground">{editingUser.dni} · {editingUser.email}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Usuario *</Label>
                  <Popover open={userSelectorOpen} onOpenChange={setUserSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userSelectorOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedUser ? (
                          <span className="truncate">
                            {selectedUser.fullName} · {selectedUser.dni}
                            <span className="text-muted-foreground ml-1 text-xs">({selectedUser.email})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Buscar y seleccionar usuario...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <CommandInput
                            ref={userSearchRef}
                            placeholder="Buscar por nombre, DNI o email..."
                            value={userSearch}
                            onValueChange={setUserSearch}
                            className="h-10"
                          />
                        </div>
                        <CommandList>
                          <CommandEmpty>
                            {userSearch ? `Sin resultados para "${userSearch}"` : 'No hay usuarios disponibles'}
                          </CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-y-auto">
                            {filteredUsers.map((u) => (
                              <CommandItem
                                key={u.id}
                                value={String(u.id)}
                                onSelect={(currentValue) => {
                                  setSelectedUserId(parseInt(currentValue))
                                  setUserSelectorOpen(false)
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{u.fullName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {u.dni} · {u.email} · {u.office?.name || 'Sin oficina'}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {!editingUser && selectedUser && (
                    <p className="text-xs text-muted-foreground">
                      Rol actual: <Badge className={roleConfig[selectedUser.role].color}>{roleConfig[selectedUser.role].label}</Badge>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: Role) => { roleChangedByUser.current = true; setFormData({ ...formData, role: value }) }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMINISTRADOR">
                        <span className="flex items-center gap-2">
                          <Shield className="h-3 w-3" /> Administrador
                        </span>
                      </SelectItem>
                      <SelectItem value="ALMACENERO">
                        <span className="flex items-center gap-2">
                          <ClipboardList className="h-3 w-3" /> Almacenero
                        </span>
                      </SelectItem>
                      <SelectItem value="JEFE_OFICINA">
                        <span className="flex items-center gap-2">
                          <UserCheck className="h-3 w-3" /> Jefe de Oficina
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="officeId">Oficina</Label>
                  <Select
                    value={formData.officeId}
                    onValueChange={(value) => setFormData({ ...formData, officeId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      {offices.map((office) => (
                        <SelectItem key={office.id} value={String(office.id)}>
                          {office.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isActive">Activo</Label>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">Permisos de autorización:</p>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                      Pedidos
                    </span>
                    <Switch
                      checked={formData.canAuthorizeOrders}
                      onCheckedChange={(v) => setFormData({ ...formData, canAuthorizeOrders: v })}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Fuel className="h-4 w-4 text-amber-600" />
                      Combustible
                    </span>
                    <Switch
                      checked={formData.canAuthorizeFuel}
                      onCheckedChange={(v) => setFormData({ ...formData, canAuthorizeFuel: v })}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <UserCheck className="h-4 w-4 text-green-600" />
                      Bienes
                    </span>
                    <Switch
                      checked={formData.canAuthorizeAssignments}
                      onCheckedChange={(v) => setFormData({ ...formData, canAuthorizeAssignments: v })}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-purple-600" />
                      Préstamos
                    </span>
                    <Switch
                      checked={formData.canAuthorizeLoans}
                      onCheckedChange={(v) => setFormData({ ...formData, canAuthorizeLoans: v })}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  style={{ backgroundColor: config?.primaryColor }}
                  disabled={isSaving || (!editingUser && !selectedUserId)}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {isSaving ? 'Guardando...' : editingUser ? 'Actualizar' : 'Otorgar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tarjetas de información */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {authorizers.filter(u => u.canAuthorizeOrders).length}
            </div>
            <p className="text-xs text-muted-foreground">pueden autorizar pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Fuel className="h-4 w-4 text-amber-600" />
              Combustible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {authorizers.filter(u => u.canAuthorizeFuel).length}
            </div>
            <p className="text-xs text-muted-foreground">pueden autorizar combustible</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              Bienes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {authorizers.filter(u => u.canAuthorizeAssignments).length}
            </div>
            <p className="text-xs text-muted-foreground">pueden asignar bienes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-600" />
              Préstamos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {authorizers.filter(u => u.canAuthorizeLoans).length}
            </div>
            <p className="text-xs text-muted-foreground">pueden autorizar préstamos</p>
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
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      {isLoading ? (
        <ModuleSkeleton variant="table" />
      ) : filteredAuthorizers.length === 0 ? (
        <EmptyState icon={Shield} title="No se encontraron autorizadores" description="Otorgue permisos de autorización a usuarios existentes para gestionar pedidos, combustible y bienes" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table responsiveCards>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead hideOnMobile>DNI</TableHead>
                  <TableHead hideOnMobile>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Oficina</TableHead>
                  <TableHead hideOnMobile>Autorizaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuthorizers.map((user) => {
                  const cfg = roleConfig[user.role]
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground">{user.position}</p>
                      </TableCell>
                      <TableCell hideOnMobile>
                        <span className="font-mono text-sm">{user.dni}</span>
                      </TableCell>
                      <TableCell hideOnMobile className="text-sm">{user.email}</TableCell>
                      <TableCell>
                        <Badge className={cfg.color}>
                          <Shield className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{user.office?.name || 'Sin oficina'}</TableCell>
                      <TableCell hideOnMobile>{getAuthBadges(user)}</TableCell>
                      <TableCell>
                        <Badge className={user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)} title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500"
                            onClick={() => handleDeleteClick(user)}
                            title="Remover autorización"
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

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="¿Remover autorización?"
        description={`¿Está seguro de remover los permisos de autorización de ${userToDelete?.fullName}? El usuario volverá al rol de Trabajador.`}
        itemName={userToDelete?.fullName || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
