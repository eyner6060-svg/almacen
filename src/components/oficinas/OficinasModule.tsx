'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useOfficesStore, useConfigStore } from '@/store'
import { Plus, Edit, Trash2, Download, Building2, Users, FileText, FileSpreadsheet, Search, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { Office } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { normalizeText } from '@/lib/utils'

export function OficinasModule() {
  const { offices, setOffices, addOffice, updateOffice, removeOffice } = useOfficesStore()
  const { config } = useConfigStore()
  
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingOffice, setEditingOffice] = useState<Office | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [officeToDelete, setOfficeToDelete] = useState<Office | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  })

  const fetchOffices = useCallback(async () => {
    try {
      const response = await apiFetch('/api/offices')
      if (response.ok) {
        const data = await response.json()
        setOffices(data.offices)
      }
    } catch {
      // silencioso
      toast.error('Error al cargar las oficinas')
    } finally {
      setIsLoading(false)
    }
  }, [setOffices])

  useEffect(() => {
    fetchOffices()
  }, [fetchOffices])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsSaving(true)
    try {
      if (editingOffice) {
        const response = await apiFetch(`/api/offices/${editingOffice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        if (response.ok) {
          const data = await response.json()
          updateOffice(editingOffice.id, data.office)
          toast.success('Oficina actualizada correctamente')
        }
      } else {
        const response = await apiFetch('/api/offices', {
          method: 'POST',
          body: JSON.stringify(formData),
        })
        if (response.ok) {
          const data = await response.json()
          addOffice(data.office)
          toast.success('Oficina registrada correctamente')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al registrar')
        }
      }
      
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error al guardar office:', error)
      toast.error('Error al guardar la oficina')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = (office: Office) => {
    setOfficeToDelete(office)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!officeToDelete) return
    const response = await apiFetch(`/api/offices/${officeToDelete.id}`, { method: 'DELETE' })
    if (response.ok) {
      removeOffice(officeToDelete.id)
      setOfficeToDelete(null)
    } else {
      const data = await response.json()
      throw new Error(data.error || 'Error al eliminar')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', code: '', description: '' })
    setEditingOffice(null)
  }

  const openEditDialog = (office: Office) => {
    setEditingOffice(office)
    setFormData({
      name: office.name,
      code: office.code,
      description: office.description || '',
    })
    setIsDialogOpen(true)
  }

  const filteredOffices = offices.filter(o => {
    const matchesSearch = normalizeText(o.name).includes(normalizeText(search)) ||
      normalizeText(o.code).includes(normalizeText(search))
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && o.isActive) ||
      (statusFilter === 'inactive' && !o.isActive)
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Oficinas</h1>
          <p className="text-muted-foreground">Administrar oficinas de la institución</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: config?.primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Oficina
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOffice ? 'Editar Oficina' : 'Nueva Oficina'}</DialogTitle>
              <DialogDescription>
                Complete los campos para {editingOffice ? 'actualizar' : 'registrar'} la oficina
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
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  placeholder="Ej: OF-001"
                />
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
                  {isSaving ? 'Guardando...' : editingOffice ? 'Actualizar' : 'Registrar'}
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
              <DropdownMenuItem onClick={() => exportToCSV(filteredOffices, [
                { key: 'name', label: 'Nombre' },
                { key: 'code', label: 'Código' },
                { key: 'description', label: 'Descripción' },
                { key: 'isActive', label: 'Activa' },
              ], `oficinas-${new Date().toISOString().slice(0, 10)}`)}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(filteredOffices, [
                { key: 'name', label: 'Nombre' },
                { key: 'code', label: 'Código' },
                { key: 'description', label: 'Descripción' },
                { key: 'isActive', label: 'Activa' },
              ], `oficinas-${new Date().toISOString().slice(0, 10)}`)}>
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
                placeholder="Buscar por nombre o código..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="inactive">Inactivas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <ModuleSkeleton variant="cards" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOffices.map((office) => (
            <Card key={office.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${config?.primaryColor}20` }}
                    >
                      <Building2 className="h-5 w-5" style={{ color: config?.primaryColor }} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{office.name}</CardTitle>
                      <CardDescription>{office.code}</CardDescription>
                    </div>
                  </div>
                  <Badge className={office.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {office.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {office.description && (
                  <p className="text-sm text-muted-foreground mb-4">{office.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{(office as { _count?: { users: number } })._count?.users || 0} usuarios</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(office)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => handleDeleteClick(office)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredOffices.length === 0 && !isLoading && (
        <EmptyState icon={Building2} title={search || statusFilter !== 'all' ? 'No se encontraron oficinas con los filtros actuales' : 'No hay oficinas registradas'} />
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        itemName={officeToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
