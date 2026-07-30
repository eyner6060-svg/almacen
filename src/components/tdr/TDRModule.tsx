'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store'
import { apiFetch } from '@/lib/http'
import { toast } from 'sonner'
import {
  FileSearch, Plus, Download, Trash2, RefreshCw, Loader2,
  AlertTriangle, XCircle, Eye, FileDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import type { TDR, TDRItem, TDRStatus, TDRType } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const statusConfig: Record<TDRStatus, { label: string; color: string }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
  GENERADO: { label: 'Generado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  APROBADO: { label: 'Aprobado', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  OBSERVADO: { label: 'Observado', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
}

const typeConfig: Record<TDRType, { label: string; color: string }> = {
  BIENES: { label: 'Bienes', color: 'bg-indigo-100 text-indigo-800' },
  COMBUSTIBLE: { label: 'Combustible', color: 'bg-amber-100 text-amber-800' },
  DEVOLUCION: { label: 'Devolución', color: 'bg-teal-100 text-teal-800' },
}

export function TDRModule() {
  const { user } = useAuthStore()
  const [tdrs, setTdrs] = useState<TDR[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  const [createOpen, setCreateOpen] = useState(false)
  const [tdrType, setTdrType] = useState<TDRType>('BIENES')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [selectedItems, setSelectedItems] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '', justification: '', objective: '',
    requirements: '', deliverySchedule: '', lugarEntrega: '',
    formaPago: '', presupuesto: '', penalidades: '',
    marcoLegal: '', riesgos: '', anticorrupcion: '', adicional: '',
  })

  const [viewTdr, setViewTdr] = useState<TDR | null>(null)
  const [showLowStock, setShowLowStock] = useState(false)
  const [lowStockData, setLowStockData] = useState<any>(null)

  const fetchTdrs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), perPage: '20' })
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('tdrType', typeFilter)
      const res = await apiFetch(`/api/tdr?${params}`)
      const data = await res.json()
      if (data.tdrs) { setTdrs(data.tdrs); setTotalPages(data.pagination?.totalPages || 1) }
    } catch { toast.error('Error al cargar TDRs') }
    finally { setLoading(false) }
  }, [page, statusFilter, typeFilter])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiFetch('/api/item-catalog?perPage=1000')
      const data = await res.json()
      const cats = [...new Set<string>((data.catalog || []).map((i: any) => i.category).filter(Boolean))]
      setCategories(cats)
    } catch { /* ignorar */ }
  }, [])

  useEffect(() => { fetchTdrs() }, [fetchTdrs])
  useEffect(() => { fetchCategories() }, [fetchCategories])

  const checkLowStock = useCallback(async () => {
    try {
      const res = await apiFetch('/api/tdr/check-low-stock')
      const data = await res.json()
      setLowStockData(data)
      setShowLowStock(true)
      if (data.total === 0) toast.info('No hay bienes con stock bajo')
    } catch { toast.error('Error al verificar stock') }
  }, [])

  const openCreate = (type: TDRType) => {
    setTdrType(type)
    setCategory('')
    setSelectedItems([])
    setForm({ title: '', justification: '', objective: '', requirements: '', deliverySchedule: '', lugarEntrega: '', formaPago: '', presupuesto: '', penalidades: '', marcoLegal: '', riesgos: '', anticorrupcion: '', adicional: '' })
    fetchLowStockByType(type)
    setCreateOpen(true)
  }

  const fetchLowStockByType = async (type: TDRType) => {
    try {
      const res = await apiFetch('/api/tdr/check-low-stock')
      const data = await res.json()
      const all = [...(data.zeroStock || []), ...(data.lowStock || [])]
      if (type === 'COMBUSTIBLE') {
        setLowStockItems(all.filter((i: any) => i.category?.toUpperCase().includes('COMBUSTIBLE') || i.name?.toUpperCase().includes('COMBUSTIBLE') || i.name?.toUpperCase().includes('DIESEL') || i.name?.toUpperCase().includes('GASOLINA') || i.name?.toUpperCase().includes('GASOHOL')))
        setCategory('COMBUSTIBLE')
      } else {
        setLowStockItems(all)
        setCategory('')
      }
    } catch { setLowStockItems([]) }
  }

  const toggleItem = (item: any) => {
    setSelectedItems(prev =>
      prev.find(i => i.itemId === item.id)
        ? prev.filter(i => i.itemId !== item.id)
        : [...prev, {
            itemId: item.id, name: item.name, code: item.code,
            quantity: Math.max((item.minStock || 5) - (item.quantity || 0) + 5, 10),
            unit: item.unit || 'UNIDAD',
            technicalSpecs: item.technicalSpecs || '',
            currentStock: item.quantity || 0,
            minStock: item.minStock || 5,
            category: item.category || '',
          }]
    )
  }

  const updateQty = (itemId: number, qty: number) => {
    setSelectedItems(prev => prev.map(i => i.itemId === itemId ? { ...i, quantity: Math.max(1, qty) } : i))
  }

  const generateTdr = async () => {
    if (selectedItems.length === 0) { toast.error('Seleccione al menos un bien'); return }
    setGenerating(true)
    try {
      const cat = tdrType === 'COMBUSTIBLE' ? 'COMBUSTIBLE' : category
      const res = await apiFetch('/api/tdr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tdrType, category: cat,
          title: form.title || undefined,
          justification: form.justification || undefined,
          objective: form.objective || undefined,
          items: selectedItems,
          requirements: form.requirements || undefined,
          deliverySchedule: form.deliverySchedule || undefined,
          lugarEntrega: form.lugarEntrega || undefined,
          formaPago: form.formaPago || undefined,
          presupuesto: form.presupuesto || undefined,
          penalidades: form.penalidades || undefined,
          marcoLegal: form.marcoLegal || undefined,
          riesgos: form.riesgos || undefined,
          anticorrupcion: form.anticorrupcion || undefined,
          adicional: form.adicional || undefined,
        }),
      })
      const data = await res.json()
      if (data.tdr) {
        toast.success(`TDR ${data.tdr.tdrNumber} generado`)
        setCreateOpen(false)
        fetchTdrs()
      }
    } catch { toast.error('Error al generar TDR') }
    finally { setGenerating(false) }
  }

  const autoGenerate = async () => {
    setGenerating(true)
    try {
      const res = await apiFetch('/api/tdr/auto-generate', { method: 'POST' })
      const data = await res.json()
      if (data.generated) { toast.success(data.message); setShowLowStock(false); fetchTdrs() }
      else toast.info(data.message)
    } catch { toast.error('Error al generar automáticamente') }
    finally { setGenerating(false) }
  }

  const deleteTdr = async (id: number) => {
    try { await apiFetch(`/api/tdr/${id}`, { method: 'DELETE' }); toast.success('TDR enviado a la papelera'); fetchTdrs() }
    catch { toast.error('Error al eliminar') }
  }

  const updateStatus = async (id: number, status: TDRStatus) => {
    try { await apiFetch(`/api/tdr/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); toast.success('Estado actualizado'); fetchTdrs() }
    catch { toast.error('Error al actualizar') }
  }

  const canManage = user?.role === 'ADMINISTRADOR' || user?.role === 'ALMACENERO' || user?.role === 'JEFE_OFICINA'

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Términos de Referencia</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestión de documentos para contratación de bienes según Ley N° 32069</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={checkLowStock} disabled={!canManage}>
            <AlertTriangle className="h-4 w-4 mr-2" /> Ver Stock Bajo
          </Button>
          <Button onClick={() => openCreate('BIENES')}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo TDR Bienes
          </Button>
          <Button variant="secondary" onClick={() => openCreate('COMBUSTIBLE')}>
            <Fuel className="h-4 w-4 mr-2" /> TDR Combustible
          </Button>
        </div>
      </div>

      {/* Dialog: Detalle */}
      <Dialog open={!!viewTdr} onOpenChange={(o) => { if (!o) setViewTdr(null) }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewTdr?.tdrNumber} - {viewTdr?.title}</DialogTitle></DialogHeader>
          {viewTdr && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <Badge className={typeConfig[viewTdr.tdrType as TDRType]?.color}>{typeConfig[viewTdr.tdrType as TDRType]?.label}</Badge>
                <Badge className={statusConfig[viewTdr.status as TDRStatus]?.color}>{statusConfig[viewTdr.status as TDRStatus]?.label}</Badge>
                {viewTdr.isAutomatic && <Badge variant="outline" className="text-amber-600">Automático</Badge>}
              </div>
              {viewTdr.justification && <div><span className="font-semibold">Finalidad:</span><p className="mt-1 text-muted-foreground">{viewTdr.justification}</p></div>}
              {viewTdr.objective && <div><span className="font-semibold">Objetivo:</span><p className="mt-1 text-muted-foreground">{viewTdr.objective}</p></div>}
              {(viewTdr.items as TDRItem[])?.length > 0 && (
                <div>
                  <span className="font-semibold">Bienes ({viewTdr.items.length})</span>
                  <div className="mt-2 space-y-1">
                    {(viewTdr.items as TDRItem[]).map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                        <span>{item.name} ({item.code})</span>
                        <span className="font-medium">{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {viewTdr.presupuesto && <div><span className="font-semibold">Presupuesto:</span> {viewTdr.presupuesto}</div>}
              <div className="flex gap-2 pt-2">
                {viewTdr.fileUrl && (
                  <a href={`/api/files/docs/${viewTdr.fileUrl}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Descargar .docx</Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Nuevo TDR */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Término de Referencia - {tdrType === 'COMBUSTIBLE' ? 'COMBUSTIBLE' : 'BIENES'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Tipo</Label>
                <Select value={tdrType} onValueChange={(v) => { setTdrType(v as TDRType); fetchLowStockByType(v as TDRType) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIENES">Bienes</SelectItem>
                    <SelectItem value="COMBUSTIBLE">Combustible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tdrType === 'BIENES' && (
                <div className="flex-1">
                  <Label>Categoría</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">Todas</SelectItem>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Selección de items */}
            <div>
              <Label>Bienes con stock bajo ({lowStockItems.length} disponibles)</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1 mt-1">
                {lowStockItems.filter(i => !category || category === ' ' || i.category === category).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm p-1.5 hover:bg-muted/50 rounded cursor-pointer" onClick={() => toggleItem(item)}>
                    <input type="checkbox" checked={!!selectedItems.find(s => s.itemId === item.id)} readOnly className="accent-blue-600" />
                    <span className="flex-1">{item.name} ({item.code})</span>
                    <Badge variant={item.quantity === 0 ? 'destructive' : 'secondary'} className="text-xs">{item.quantity}/{item.minStock}</Badge>
                  </div>
                ))}
                {lowStockItems.length === 0 && <p className="text-xs text-muted-foreground p-2">No hay bienes con stock bajo para este tipo</p>}
              </div>
            </div>

            {/* Items seleccionados */}
            {selectedItems.length > 0 && (
              <div>
                <Label>Items seleccionados ({selectedItems.length})</Label>
                <div className="border rounded-md divide-y text-sm mt-1">
                  {selectedItems.map((item) => (
                    <div key={item.itemId} className="flex items-center gap-2 p-2">
                      <span className="flex-1 text-xs truncate">{item.name}</span>
                      <Input type="number" min={1} value={item.quantity} onChange={(e) => updateQty(item.itemId, parseInt(e.target.value) || 1)} className="w-20 h-8 text-xs" />
                      <span className="text-xs text-muted-foreground w-12">{item.unit}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedItems(p => p.filter(i => i.itemId !== item.itemId))}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Título de la Contratación</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej: Adquisición de combustible para la DRTCA" />
              </div>
              <div className="col-span-2">
                <Label>Finalidad Pública / Justificación</Label>
                <Textarea value={form.justification} onChange={e => setForm(p => ({ ...p, justification: e.target.value }))} rows={3} placeholder="Describa la necesidad y sustento legal de la contratación" />
              </div>
              <div className="col-span-2">
                <Label>Objetivo de la Contratación</Label>
                <Textarea value={form.objective} onChange={e => setForm(p => ({ ...p, objective: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label>Plazo de Entrega</Label>
                <Input value={form.deliverySchedule} onChange={e => setForm(p => ({ ...p, deliverySchedule: e.target.value }))} placeholder="Ej: 20 días calendario" />
              </div>
              <div>
                <Label>Lugar de Entrega</Label>
                <Input value={form.lugarEntrega} onChange={e => setForm(p => ({ ...p, lugarEntrega: e.target.value }))} placeholder="Almacén Central DRTCA" />
              </div>
              <div>
                <Label>Presupuesto Estimado</Label>
                <Input value={form.presupuesto} onChange={e => setForm(p => ({ ...p, presupuesto: e.target.value }))} placeholder="S/." />
              </div>
              <div>
                <Label>Forma de Pago</Label>
                <Input value={form.formaPago} onChange={e => setForm(p => ({ ...p, formaPago: e.target.value }))} placeholder="Pago único contra entrega" />
              </div>
              <div className="col-span-2">
                <Label>Requisitos del Proveedor</Label>
                <Textarea value={form.requirements} onChange={e => setForm(p => ({ ...p, requirements: e.target.value }))} rows={2} placeholder="RUC habilitado, RNP vigente, experiencia mínima, etc." />
              </div>
              <div className="col-span-2">
                <Label>Penalidades</Label>
                <Textarea value={form.penalidades} onChange={e => setForm(p => ({ ...p, penalidades: e.target.value }))} rows={2} />
              </div>
              <div className="col-span-2">
                <Label>Marco Legal</Label>
                <Textarea value={form.marcoLegal} onChange={e => setForm(p => ({ ...p, marcoLegal: e.target.value }))} rows={2} placeholder="Ley N° 32069, D.S. N° 009-2025-EF, etc." />
              </div>
              <div className="col-span-2">
                <Label>Gestión de Riesgos</Label>
                <Textarea value={form.riesgos} onChange={e => setForm(p => ({ ...p, riesgos: e.target.value }))} rows={2} />
              </div>
              <div className="col-span-2">
                <Label>Anticorrupción</Label>
                <Textarea value={form.anticorrupcion} onChange={e => setForm(p => ({ ...p, anticorrupcion: e.target.value }))} rows={2} />
              </div>
              <div className="col-span-2">
                <Label>Información Adicional</Label>
                <Textarea value={form.adicional} onChange={e => setForm(p => ({ ...p, adicional: e.target.value }))} rows={2} />
              </div>
            </div>

            <Button onClick={generateTdr} disabled={generating || selectedItems.length === 0} className="w-full">
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
              Generar Documento .docx
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Stock Bajo */}
      <Dialog open={showLowStock} onOpenChange={setShowLowStock}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Bienes con Stock Bajo</DialogTitle></DialogHeader>
          {lowStockData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{lowStockData.total} bienes detectados con stock ≤ mínimo.</p>
              {lowStockData.zeroStock?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-600 mb-2">Stock Cero ({lowStockData.zeroStock.length})</h3>
                  {lowStockData.zeroStock.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm p-2 bg-red-50 dark:bg-red-950/30 rounded mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-red-600 font-bold">0 / {item.minStock}</span>
                    </div>
                  ))}
                </div>
              )}
              {lowStockData.lowStock?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-amber-600 mb-2">Stock Bajo ({lowStockData.lowStock.length})</h3>
                  {lowStockData.lowStock.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm p-2 bg-amber-50 dark:bg-amber-950/30 rounded mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-amber-600 font-bold">{item.quantity} / {item.minStock}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={() => { setShowLowStock(false); openCreate('BIENES') }} disabled={lowStockData.total === 0} className="flex-1">Crear TDR Bienes</Button>
                <Button variant="secondary" onClick={autoGenerate} disabled={generating || lowStockData.total === 0} className="flex-1">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generar Automático
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg">Lista de TDRs</CardTitle>
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Todos</SelectItem>
                  <SelectItem value="BIENES">Bienes</SelectItem>
                  <SelectItem value="COMBUSTIBLE">Combustible</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Todos</SelectItem>
                  <SelectItem value="BORRADOR">Borrador</SelectItem>
                  <SelectItem value="GENERADO">Generado</SelectItem>
                  <SelectItem value="APROBADO">Aprobado</SelectItem>
                  <SelectItem value="OBSERVADO">Observado</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchTdrs} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : tdrs.length === 0 ? (
            <EmptyState icon={FileSearch} title="No hay TDRs" description="Genere un nuevo TDR de Bienes o Combustible, o use la detección automática de stock bajo." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tdrs.map((tdr) => {
                    const items = tdr.items as TDRItem[]
                    return (
                      <TableRow key={tdr.id}>
                        <TableCell className="font-medium text-xs">{tdr.tdrNumber}</TableCell>
                        <TableCell><Badge className={`text-xs ${typeConfig[tdr.tdrType as TDRType]?.color}`}>{typeConfig[tdr.tdrType as TDRType]?.label}</Badge></TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">{tdr.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tdr.category || '-'}</TableCell>
                        <TableCell><Badge className={`text-xs ${statusConfig[tdr.status as TDRStatus]?.color}`}>{statusConfig[tdr.status as TDRStatus]?.label}</Badge></TableCell>
                        <TableCell className="text-xs">{items?.length || 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(tdr.createdAt), 'dd/MM/yy', { locale: es })}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setViewTdr(tdr)}><Eye className="h-4 w-4" /></Button>
                            {tdr.fileUrl && (
                              <a href={`/api/files/docs/${tdr.fileUrl}`} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                              </a>
                            )}
                            {canManage && (
                              <>
                                {tdr.status === 'BORRADOR' || tdr.status === 'GENERADO' ? (
                                  <Select value={tdr.status} onValueChange={(v) => updateStatus(tdr.id, v as TDRStatus)}>
                                    <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="APROBADO">Aprobar</SelectItem>
                                      <SelectItem value="OBSERVADO">Observar</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : tdr.status === 'APROBADO' ? (
                                  <Button variant="ghost" size="icon" onClick={() => updateStatus(tdr.id, 'GENERADO')}><XCircle className="h-4 w-4" /></Button>
                                ) : null}
                                {['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(user?.role || '') && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>Eliminar TDR</AlertDialogTitle><AlertDialogDescription>¿Está seguro de eliminar {tdr.tdrNumber}?</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteTdr(tdr.id)} className="bg-red-600">Eliminar</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground self-center">Pág {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Fuel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.9C12.5 8.3 14 11 15 14c1.3-2.5 1.8-5.4.6-8.1A7 7 0 0 1 18 14v6a2 2 0 0 0 2 2" />
      <line x1="7" y1="20" x2="17" y2="20" />
    </svg>
  )
}
