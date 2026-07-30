'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store'
import { Trash2, RotateCcw, Skull, FileText, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const entityConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  tdr: { label: 'TDR', icon: FileText, color: 'bg-blue-100 text-blue-800' },
  loan: { label: 'Préstamo', icon: BookOpen, color: 'bg-purple-100 text-purple-800' },
}

export function PapeleraModule() {
  const { user } = useAuthStore()
  const [items, setItems] = useState<Array<{ id: number; entityType: string; identifier: string; label: string; deletedAt: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [entityFilter, setEntityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [confirmDeletePermanent, setConfirmDeletePermanent] = useState<{ id: number; entityType: string; identifier: string } | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (entityFilter !== 'all') params.append('entity', entityFilter)
      params.append('page', String(page))
      params.append('perPage', '20')

      const response = await apiFetch(`/api/trash?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        const filtered = search
          ? data.items.filter((i: { identifier: string; label: string }) =>
              i.identifier.toLowerCase().includes(search.toLowerCase()) ||
              i.label.toLowerCase().includes(search.toLowerCase())
            )
          : data.items
        setItems(filtered)
        setTotalPages(data.pagination.totalPages)
      }
    } catch {
      toast.error('Error al cargar elementos eliminados')
    } finally {
      setIsLoading(false)
    }
  }, [entityFilter, page, search])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { setPage(1) }, [entityFilter, search])

  const handleRestore = async (entity: string, entityId: number) => {
    try {
      const response = await apiFetch('/api/trash', {
        method: 'POST',
        body: JSON.stringify({ entity, entityId: String(entityId), action: 'restore' }),
      })
      if (response.ok) {
        toast.success('Elemento restaurado correctamente')
        fetchItems()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al restaurar')
      }
    } catch {
      toast.error('Error al restaurar elemento')
    }
  }

  const handlePermanentDelete = async () => {
    if (!confirmDeletePermanent) return
    try {
      const response = await apiFetch('/api/trash', {
        method: 'POST',
        body: JSON.stringify({ entity: confirmDeletePermanent.entityType, entityId: String(confirmDeletePermanent.id), action: 'permanent_delete' }),
      })
      if (response.ok) {
        toast.success('Elemento eliminado permanentemente')
        setConfirmDeletePermanent(null)
        fetchItems()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar elemento')
    }
  }

  const isAdmin = user?.role === 'ADMINISTRADOR'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" />
            Papelera de Elementos Eliminados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por identificador o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas las entidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                <SelectItem value="tdr">TDR</SelectItem>
                <SelectItem value="loan">Préstamos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trash2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No hay elementos en la papelera</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Identificador</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Eliminado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const cfg = entityConfig[item.entityType] || { label: 'Desconocido', icon: FileText, color: 'bg-gray-100 text-gray-800' }
                    const Icon = cfg.icon
                    return (
                      <TableRow key={`${item.entityType}-${item.id}`}>
                        <TableCell>
                          <Badge className={`${cfg.color} border-0`}>
                            <Icon className="h-3 w-3 mr-1 inline" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.identifier}</TableCell>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(item.deletedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleRestore(item.entityType, item.id)}>
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restaurar
                            </Button>
                            {isAdmin && (
                              <Button variant="destructive" size="sm" onClick={() => setConfirmDeletePermanent({ id: item.id, entityType: item.entityType, identifier: item.identifier })}>
                                <Skull className="h-4 w-4 mr-1" />
                                Eliminar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDeletePermanent} onOpenChange={(open) => !open && setConfirmDeletePermanent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">¿Eliminar permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El elemento <strong>{confirmDeletePermanent?.identifier}</strong> será eliminado definitivamente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-red-500 hover:bg-red-600">
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
