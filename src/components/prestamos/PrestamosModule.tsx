'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useAuthStore, useLoansStore, useConfigStore } from '@/store'
import {
  Plus, Search, BookOpen, CheckCircle, XCircle, RotateCcw,
  Printer, Building2, ArrowRight, Eye, Clock,
  ShieldAlert, Ban, Upload,
} from 'lucide-react'
import type { Loan, LoanStatus, Item, PatrimonialUnit } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { normalizeText } from '@/lib/utils'
import { getCurrentYearDenomination } from '@/lib/year-denomination'
import { useDebounce } from '@/hooks/use-debounce'
import { DocumentViewerModal } from '@/components/ui/document-viewer-modal'

const statusConfig: Record<LoanStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  AUTORIZADO_ALMACENERO: { label: 'Autorizado Almacén', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Building2 },
  AUTORIZADO_JEFE: { label: 'Autorizado Jefatura', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: ShieldAlert },
  PRESTADO: { label: 'En Préstamo', color: 'bg-green-100 text-green-800 border-green-200', icon: ArrowRight },
  DEVUELTO: { label: 'Devuelto', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: RotateCcw },
  RECHAZADO: { label: 'Rechazado', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
}

const statusOptions: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'AUTORIZADO_ALMACENERO', label: 'Autorizado Almacén' },
  { value: 'AUTORIZADO_JEFE', label: 'Autorizado Jefatura' },
  { value: 'PRESTADO', label: 'En Préstamo' },
  { value: 'DEVUELTO', label: 'Devuelto' },
  { value: 'RECHAZADO', label: 'Rechazado' },
]

export function PrestamosModule() {
  const { user } = useAuthStore()
  const { config } = useConfigStore()
  const { loans, total, setLoans, addLoan, updateLoan, removeLoan } = useLoansStore()

  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const perPage = 15

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  // Formulario de nuevo préstamo
  const [formData, setFormData] = useState({
    borrowerName: '',
    borrowerDni: '',
    borrowerPhone: '',
    borrowerAddress: '',
    expectedReturnDate: '',
    reason: '',
  })

  // Selección de bienes
  const [availableItems, setAvailableItems] = useState<Item[]>([])
  const [selectedItems, setSelectedItems] = useState<Array<{
    rowId: number
    itemId: number
    quantity: number
    name: string
    code: string
    itemType: string
    patrimonialUnitId?: number
    patrimonialCode?: string
  }>>([])
  const [itemSearch, setItemSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [nextRowId, setNextRowId] = useState(1)

  // Selección de código patrimonial
  const [patrimonialCache, setPatrimonialCache] = useState<Record<string, PatrimonialUnit[]>>({})
  const [pendingItem, setPendingItem] = useState<Item | null>(null)
  const [patrimonialDialogOpen, setPatrimonialDialogOpen] = useState(false)
  const [selectedPatrimonialUnitId, setSelectedPatrimonialUnitId] = useState('')

  // Confirmaciones
  const [authorizeAlmaceneroOpen, setAuthorizeAlmaceneroOpen] = useState(false)
  const [authorizeJefeOpen, setAuthorizeJefeOpen] = useState(false)
  const [confirmLoanOpen, setConfirmLoanOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null)

  // PIN autorización
  const [authorizationPin, setAuthorizationPin] = useState('')
  const [pinError, setPinError] = useState('')

  // Estado de devolución
  const [returnCondition, setReturnCondition] = useState('OPERATIVO')

  // Subir documento firmado
  const [uploadSignedOpen, setUploadSignedOpen] = useState(false)
  const [signedFile, setSignedFile] = useState<File | null>(null)
  const [isUploadingSigned, setIsUploadingSigned] = useState(false)

  const fetchLoans = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (statusFilter !== 'todos') params.append('status', statusFilter)
      params.append('page', String(page))
      params.append('perPage', String(perPage))

      const response = await apiFetch(`/api/loans?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setLoans(data.loans)
        setTotalPages(data.pagination.totalPages)
      }
    } catch {
      toast.error('Error al cargar préstamos')
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, statusFilter, page, setLoans])

  const fetchAvailableItems = useCallback(async () => {
    try {
      const response = await apiFetch('/api/items?perPage=500&includeDeleted=false&view=list')
      if (response.ok) {
        const data = await response.json()
        setAvailableItems(data.items)
      }
    } catch {
      toast.error('Error al cargar bienes')
    }
  }, [])

  useEffect(() => { setPage(1) }, [search, statusFilter])

  useEffect(() => {
    setIsLoading(true)
    fetchLoans()
  }, [fetchLoans])

  const filteredItems = useMemo(() => {
    const q = normalizeText(itemSearch)
    return availableItems.filter((item) => {
      if (selectedItems.some((s) => s.itemId === item.id)) return false
      return (
        !q ||
        normalizeText(item.name).includes(q) ||
        normalizeText(item.code).includes(q) ||
        (normalizeText(item.patrimonialCode ?? '').includes(q) ?? false)
      )
    })
  }, [availableItems, itemSearch, selectedItems])

  const patrimonialCacheRef = useRef(patrimonialCache)
  patrimonialCacheRef.current = patrimonialCache

  const loadPatrimonialUnits = useCallback(async (itemId: number) => {
    const key = String(itemId)
    if (patrimonialCacheRef.current[key]) return
    try {
      const res = await apiFetch(`/api/items/patrimonial-codes?itemId=${itemId}&available=true`)
      const data = await res.json()
      setPatrimonialCache(prev => ({ ...prev, [key]: data.patrimonialUnits || [] }))
    } catch {
      setPatrimonialCache(prev => ({ ...prev, [key]: [] }))
    }
  }, [])

  const handleAddItem = (item: Item) => {
    if (item.itemType === 'PATRIMONIAL') {
      setPendingItem(item)
      loadPatrimonialUnits(item.id)
      setSelectedPatrimonialUnitId('')
      setPatrimonialDialogOpen(true)
    } else {
      const rid = nextRowId
      setNextRowId(rid + 1)
      setSelectedItems([...selectedItems, {
        rowId: rid,
        itemId: item.id,
        quantity: 1,
        name: item.name,
        code: item.code,
        itemType: item.itemType,
      }])
      setItemDialogOpen(false)
    }
  }

  const handleConfirmPatrimonial = () => {
    if (!pendingItem || !selectedPatrimonialUnitId) return
    const units = patrimonialCache[String(pendingItem.id)] || []
    const unit = units.find(u => String(u.id) === selectedPatrimonialUnitId)
    const rid = nextRowId
    setNextRowId(rid + 1)
    setSelectedItems([...selectedItems, {
      rowId: rid,
      itemId: pendingItem.id,
      quantity: 1,
      name: pendingItem.name,
      code: pendingItem.code,
      itemType: pendingItem.itemType,
      patrimonialUnitId: unit?.id,
      patrimonialCode: unit?.patrimonialCode,
    }])
    setPatrimonialDialogOpen(false)
    setItemDialogOpen(false)
    setPendingItem(null)
  }

  const handleRemoveItem = (rowId: number) => {
    setSelectedItems(selectedItems.filter((s) => s.rowId !== rowId))
  }

  const handleQuantityChange = (rowId: number, quantity: number) => {
    setSelectedItems(selectedItems.map((s) =>
      s.rowId === rowId ? { ...s, quantity: Math.max(1, quantity) } : s
    ))
  }

  const resetForm = () => {
    setFormData({
      borrowerName: '',
      borrowerDni: '',
      borrowerPhone: '',
      borrowerAddress: '',
      expectedReturnDate: '',
      reason: '',
    })
    setSelectedItems([])
  }

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.borrowerName.trim()) {
      toast.error('Debe ingresar el nombre del prestatario')
      return
    }
    if (!formData.expectedReturnDate) {
      toast.error('Debe ingresar la fecha de retorno')
      return
    }
    if (!formData.reason.trim()) {
      toast.error('Debe ingresar el motivo del préstamo')
      return
    }
    if (selectedItems.length === 0) {
      toast.error('Debe seleccionar al menos un bien')
      return
    }

    try {
      const response = await apiFetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expectedReturnDate: new Date(formData.expectedReturnDate).toISOString(),
          items: selectedItems.map((s) => ({
            itemId: s.itemId,
            quantity: s.itemType === 'PATRIMONIAL' ? 1 : s.quantity,
            patrimonialUnitId: s.patrimonialUnitId,
          })),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        addLoan(data.loan)
        toast.success(`Préstamo ${data.loan.documentNumber} creado correctamente`)
        setIsDialogOpen(false)
        resetForm()
        fetchLoans()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al crear préstamo')
      }
    } catch {
      toast.error('Error al crear préstamo')
    }
  }

  const verifyPin = async (pin: string): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  const handleAction = async (action: string, loanId: number, extra?: Record<string, unknown>) => {
    try {
      const body: Record<string, unknown> = { action, ...extra }
      const response = await apiFetch(`/api/loans/${loanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.loan) updateLoan(loanId, data.loan)
        toast.success(data.message)
        fetchLoans()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al procesar la acción')
      }
    } catch {
      toast.error('Error al procesar la acción')
    }
  }

  const handlePrintDocument = (loan: Loan) => {
    const statusInfo = (statusConfig[loan.status as LoanStatus] || statusConfig.PENDIENTE)!
    const itemsHtml = loan.items.map((li, idx) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${li.itemName}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${li.itemCode}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${li.patrimonialCode || '—'}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${li.itemBrand} ${li.itemModel}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${li.itemCategory || '—'}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db; text-align: center;">${li.quantity}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${li.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}</td>
      </tr>
    `).join('')

    const primaryColor = config?.primaryColor || '#1e40af'
    const institutionName = config?.institutionName || 'Almacén Institucional'
    const logoHtml = config?.logoUrl
      ? `<img src="${config.logoUrl}" style="max-height: 70px;" alt="Logo" />`
      : `<div style="width: 70px; height: 70px; background: ${primaryColor}; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 28px; font-weight: bold;">A</span>
         </div>`

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${loan.documentNumber}</title>
<style>
  @page { margin: 1.5cm; size: A4; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #1f2937; margin: 0; padding: 0; }
  .header { display: flex; align-items: flex-start; gap: 20px; border-bottom: 3px solid ${primaryColor}; padding-bottom: 20px; margin-bottom: 25px; }
  .header-text { flex: 1; text-align: center; }
  .header-text h1 { font-size: 18pt; margin: 0; color: ${primaryColor}; }
  .header-text h2 { font-size: 14pt; margin: 2px 0 0 0; color: ${primaryColor}; }
  .header-text .year { font-size: 11pt; margin: 2px 0 0 0; color: #6b7280; font-style: italic; }
  .title { text-align: center; font-size: 16pt; font-weight: bold; color: ${primaryColor}; margin: 25px 0; text-transform: uppercase; letter-spacing: 1px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .info-grid .field { margin-bottom: 8px; }
  .info-grid .field .label { font-weight: bold; font-size: 10pt; color: #6b7280; }
  .info-grid .field .value { font-size: 11pt; border-bottom: 1px solid #d1d5db; padding: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10pt; }
  th { background: ${primaryColor}; color: white; padding: 10px 8px; text-align: left; font-size: 9pt; }
  td, th { border: 1px solid #d1d5db; padding: 8px; }
  tr:nth-child(even) { background: #f9fafb; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 50px; }
  .signature-box { text-align: center; }
  .signature-box .line { border-top: 1px solid #374151; margin-top: 50px; padding-top: 8px; font-size: 10pt; }
  .footer { margin-top: 30px; text-align: center; font-size: 9pt; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 10pt; font-weight: bold; }
  .print-hide { display: block; }
  @media print { .print-hide { display: none; } }
</style></head>
<body>
  <div class="header">
    ${logoHtml}
    <div class="header-text">
      <h1>${institutionName}</h1>
      <div class="year">${getCurrentYearDenomination()}</div>
      <h2>${loan.documentLabel}</h2>
    </div>
  </div>

  <div class="title">${loan.documentLabel} ${loan.documentNumber}</div>

  <div style="text-align: center; margin-bottom: 20px;">
    <span class="status-badge" style="background: ${statusInfo.color.split(' ')[0]}; color: ${(statusInfo.color.split(' ')[1] ?? '').replace('text-', '')}">
      ${statusInfo.label}
    </span>
  </div>

  <div class="info-grid">
    <div>
      <div class="field">
        <div class="label">PRESTATARIO</div>
        <div class="value">${loan.borrowerName}</div>
      </div>
      <div class="field">
        <div class="label">DNI</div>
        <div class="value">${loan.borrowerDni || '—'}</div>
      </div>
      <div class="field">
        <div class="label">TELÉFONO</div>
        <div class="value">${loan.borrowerPhone || '—'}</div>
      </div>
      <div class="field">
        <div class="label">DIRECCIÓN</div>
        <div class="value">${loan.borrowerAddress || '—'}</div>
      </div>
    </div>
    <div>
      <div class="field">
        <div class="label">FECHA DE PRÉSTAMO</div>
        <div class="value">${format(new Date(loan.loanDate), 'dd/MM/yyyy', { locale: es })}</div>
      </div>
      <div class="field">
        <div class="label">FECHA DE RETORNO ESPERADA</div>
        <div class="value">${format(new Date(loan.expectedReturnDate), 'dd/MM/yyyy', { locale: es })}</div>
      </div>
      ${loan.actualReturnDate ? `
      <div class="field">
        <div class="label">FECHA DE RETORNO REAL</div>
        <div class="value">${format(new Date(loan.actualReturnDate), 'dd/MM/yyyy', { locale: es })}</div>
      </div>` : ''}
      <div class="field">
        <div class="label">MOTIVO</div>
        <div class="value">${loan.reason}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>N°</th>
        <th>Bien</th>
        <th>Código</th>
        <th>Cód. Patrimonial</th>
        <th>Marca / Modelo</th>
        <th>Categoría</th>
        <th>Cant.</th>
        <th>Tipo</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="signatures">
    <div class="signature-box">
      <div class="line">ALMACENERO</div>
      ${loan.almaceneroAuth ? `<p style="font-size: 9pt; margin: 2px 0;">${loan.almaceneroAuth.fullName}</p>
      <p style="font-size: 8pt; color: #6b7280;">${loan.almaceneroAuthAt ? format(new Date(loan.almaceneroAuthAt), 'dd/MM/yyyy HH:mm', { locale: es }) : ''}</p>` : ''}
    </div>
    <div class="signature-box">
      <div class="line">JEFE DE OFICINA</div>
      ${loan.jefeAuth ? `<p style="font-size: 9pt; margin: 2px 0;">${loan.jefeAuth.fullName}</p>
      <p style="font-size: 8pt; color: #6b7280;">${loan.jefeAuthAt ? format(new Date(loan.jefeAuthAt), 'dd/MM/yyyy HH:mm', { locale: es }) : ''}</p>` : ''}
    </div>
    <div class="signature-box">
      <div class="line">PRESTATARIO</div>
      <p style="font-size: 9pt; margin: 2px 0;">${loan.borrowerName}</p>
    </div>
  </div>

  <div class="footer">
    <p>Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
    <p>${institutionName} — Sistema de Gestión de Almacén</p>
  </div>

  <div class="print-hide" style="text-align: center; margin-top: 20px;">
    <button onclick="window.print()" style="padding: 10px 30px; background: ${primaryColor}; color: white; border: none; border-radius: 8px; font-size: 12pt; cursor: pointer;">Imprimir Documento</button>
  </div>

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); }</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  const handleViewLoan = (loan: Loan) => {
    setSelectedLoan(loan)
    setViewDialogOpen(true)
  }

  const canDelete = () => {
    return user && (user.role === 'ADMINISTRADOR' || user.role === 'ALMACENERO')
  }

  const getDaysUntilReturn = (loan: Loan): number | null => {
    if (!loan.expectedReturnDate || loan.status === 'DEVUELTO') return null
    const now = new Date()
    const expected = new Date(loan.expectedReturnDate)
    const diff = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Préstamos de Bienes</h1>
          <p className="text-muted-foreground">Gestión de préstamos de bienes a personas externas</p>
        </div>
        <Button
          style={{ backgroundColor: config?.primaryColor }}
          onClick={() => { resetForm(); setIsDialogOpen(true); fetchAvailableItems() }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Préstamo
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, prestatario o DNI..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table responsiveCards>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Prestatario</TableHead>
                  <TableHead>Bienes</TableHead>
                  <TableHead>Fecha Préstamo</TableHead>
                  <TableHead>Retorno</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => {
    const statusInfo = (statusConfig[loan.status as LoanStatus] || statusConfig.PENDIENTE)!
                  const StatusIcon = statusInfo.icon
                  const daysLeft = getDaysUntilReturn(loan)
                  return (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{loan.documentNumber}</div>
                        <div className="text-xs text-muted-foreground">{loan.documentLabel}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{loan.borrowerName}</div>
                        {loan.borrowerDni && <div className="text-xs text-muted-foreground">DNI: {loan.borrowerDni}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{loan.items.length} bien(es)</div>
                        <div className="text-xs text-muted-foreground">
                          {loan.items.filter(i => i.itemType === 'PATRIMONIAL').length} patrimonial(es)
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(loan.loanDate), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(loan.expectedReturnDate), 'dd/MM/yyyy', { locale: es })}
                        </div>
                        {daysLeft !== null && (
                          <div className={`text-xs ${daysLeft < 0 ? 'text-red-600 font-bold' : daysLeft <= 3 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                            {daysLeft < 0 ? `Vencido hace ${Math.abs(daysLeft)} días` : `${daysLeft} días restantes`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewLoan(loan)} title="Ver detalle">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handlePrintDocument(loan)} title="Imprimir documento">
                            <Printer className="h-4 w-4" />
                          </Button>
                          {loan.status === 'PENDIENTE' && user && ['ADMINISTRADOR', 'ALMACENERO'].includes(user.role) && (
                            <Button variant="ghost" size="icon" className="text-blue-600" onClick={() => { setSelectedLoan(loan); setAuthorizeAlmaceneroOpen(true) }} title="Autorizar como almacenero">
                              <Building2 className="h-4 w-4" />
                            </Button>
                          )}
                          {loan.status === 'AUTORIZADO_ALMACENERO' && user && ['ADMINISTRADOR', 'JEFE_OFICINA'].includes(user.role) && (
                            <Button variant="ghost" size="icon" className="text-indigo-600" onClick={() => { setSelectedLoan(loan); setAuthorizeJefeOpen(true) }} title="Autorizar como jefe">
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                          {loan.status === 'AUTORIZADO_JEFE' && user && ['ADMINISTRADOR', 'ALMACENERO'].includes(user.role) && (
                            <Button variant="ghost" size="icon" className="text-green-600" onClick={() => { setSelectedLoan(loan); setConfirmLoanOpen(true) }} title="Confirmar préstamo">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {loan.status === 'PRESTADO' && user && ['ADMINISTRADOR', 'ALMACENERO'].includes(user.role) && (
                            <Button variant="ghost" size="icon" className="text-gray-600" onClick={() => { setSelectedLoan(loan); setReturnOpen(true) }} title="Registrar devolución">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {['PRESTADO', 'DEVUELTO'].includes(loan.status) && user && ['ADMINISTRADOR', 'ALMACENERO'].includes(user.role) && (
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedLoan(loan); setUploadSignedOpen(true) }} title="Subir documento firmado">
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}
                          {loan.signedPdfUrl && (
                            <DocumentViewerModal
                              url={loan.signedPdfUrl}
                              title={`Documento Firmado - ${loan.documentNumber}`}
                              fileName={`${loan.documentNumber}.pdf`}
                              variant="icon"
                              buttonText="Ver Firmado"
                            />
                          )}
                          {!['DEVUELTO', 'RECHAZADO'].includes(loan.status) && user && ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(user.role) && (
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { setSelectedLoan(loan); setRejectReason(''); setRejectOpen(true) }} title="Rechazar">
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete() && ['PENDIENTE', 'RECHAZADO'].includes(loan.status) && (
                            <AlertDialog open={deleteConfirmOpen && loanToDelete?.id === loan.id} onOpenChange={(open) => { if (!open) { setDeleteConfirmOpen(false); setLoanToDelete(null) } }}>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { setLoanToDelete(loan); setDeleteConfirmOpen(true) }} title="Eliminar">
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Eliminar Préstamo</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Está seguro de eliminar el préstamo <strong>{loan.documentNumber}</strong> de <strong>{loan.borrowerName}</strong>? Será enviado a la papelera.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => {
                                    try {
                                      const response = await apiFetch(`/api/loans/${loan.id}`, { method: 'DELETE' })
                                      if (response.ok) {
                                        removeLoan(loan.id)
                                        toast.success('Préstamo enviado a la papelera')
                                      }
                                    } catch {
                                      toast.error('Error al eliminar')
                                    }
                                    setDeleteConfirmOpen(false)
                                    setLoanToDelete(null)
                                  }} className="bg-red-600">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {loans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No se encontraron préstamos</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">Página {page} de {totalPages} ({total} préstamos)</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Diálogo: Nuevo Préstamo */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Nuevo Préstamo de Bienes
            </DialogTitle>
            <DialogDescription>
              Registre un préstamo de bienes a una persona externa a la institución
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLoan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="borrowerName">Nombre del Prestatario *</Label>
                <Input
                  id="borrowerName"
                  value={formData.borrowerName}
                  onChange={(e) => setFormData({ ...formData, borrowerName: e.target.value })}
                  placeholder="Nombre y apellidos"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="borrowerDni">DNI</Label>
                <Input
                  id="borrowerDni"
                  value={formData.borrowerDni}
                  onChange={(e) => setFormData({ ...formData, borrowerDni: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="borrowerPhone">Teléfono</Label>
                <Input
                  id="borrowerPhone"
                  value={formData.borrowerPhone}
                  onChange={(e) => setFormData({ ...formData, borrowerPhone: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="borrowerAddress">Dirección</Label>
                <Input
                  id="borrowerAddress"
                  value={formData.borrowerAddress}
                  onChange={(e) => setFormData({ ...formData, borrowerAddress: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedReturnDate">Fecha de Retorno *</Label>
                <Input
                  id="expectedReturnDate"
                  type="date"
                  value={formData.expectedReturnDate}
                  onChange={(e) => setFormData({ ...formData, expectedReturnDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo del Préstamo *</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Describa el motivo del préstamo"
                required
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Bienes a Prestar *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setItemSearch(''); setItemDialogOpen(true) }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Bien
                </Button>
              </div>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                  No hay bienes seleccionados. Agregue al menos un bien.
                </p>
              ) : (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {selectedItems.map((item) => (
                    <div key={item.rowId} className="flex items-center justify-between p-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm block truncate">{item.name}</span>
                        <span className="text-xs text-muted-foreground">({item.code})</span>
                        <Badge variant="outline" className="ml-1 text-xs shrink-0">
                          {item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}
                        </Badge>
                        {item.patrimonialCode && (
                          <span className="text-xs text-muted-foreground block truncate mt-0.5">
                            Cód. patrimonial: {item.patrimonialCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {item.itemType !== 'PATRIMONIAL' ? (
                          <div className="flex items-center gap-1">
                            <Label className="text-xs">Cant:</Label>
                            <Input
                              type="number"
                              min="1"
                              className="w-16 h-8 text-sm"
                              value={item.quantity}
                              onChange={(e) => handleQuantityChange(item.rowId, parseInt(e.target.value) || 1)}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2">1 unid.</span>
                        )}
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveItem(item.rowId)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }}>
                Cancelar
              </Button>
              <Button type="submit" style={{ backgroundColor: config?.primaryColor }}>
                Generar {config?.institutionName ? 'Documento' : 'Préstamo'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Seleccionar Bienes */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seleccionar Bienes</DialogTitle>
            <DialogDescription>Seleccione los bienes a incluir en el préstamo</DialogDescription>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar bien..."
              className="pl-10"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay bienes disponibles</p>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                  onClick={() => handleAddItem(item)}
                >
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.code} {item.patrimonialCode ? `| ${item.patrimonialCode}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Seleccionar Código Patrimonial */}
      <Dialog open={patrimonialDialogOpen} onOpenChange={setPatrimonialDialogOpen}>
                    <DialogContent className="max-w-[95vw] sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Seleccionar Código Patrimonial</DialogTitle>
                        <DialogDescription>
                          Elija el código patrimonial que desea asignar
                        </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedPatrimonialUnitId} onValueChange={setSelectedPatrimonialUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Código patrimonial" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const units = patrimonialCache[String(pendingItem?.id ?? '')] || []
                  const usedIds = selectedItems
                    .filter(s => s.patrimonialUnitId)
                    .map(s => String(s.patrimonialUnitId))
                  const available = units.filter(u => !usedIds.includes(String(u.id)))
                  return available.length > 0 ? available.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.patrimonialCode} ({u.status})
                    </SelectItem>
                  )) : (
                    <SelectItem value="__none" disabled>
                      No hay unidades disponibles
                    </SelectItem>
                  )
                })()}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPatrimonialDialogOpen(false); setPendingItem(null) }}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmPatrimonial} disabled={!selectedPatrimonialUnitId}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Ver Detalle */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {selectedLoan?.documentNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Prestatario</Label>
                  <p className="font-medium">{selectedLoan.borrowerName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <div>
                    {(() => {
                      const si = (statusConfig[selectedLoan.status as LoanStatus] || statusConfig.PENDIENTE)!
                      const SI = si.icon
                      return <Badge className={si.color}><SI className="h-3 w-3 mr-1" />{si.label}</Badge>
                    })()}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">DNI</Label>
                  <p>{selectedLoan.borrowerDni || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Teléfono</Label>
                  <p>{selectedLoan.borrowerPhone || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha de Préstamo</Label>
                  <p>{format(new Date(selectedLoan.loanDate), 'dd/MM/yyyy', { locale: es })}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Retorno Esperado</Label>
                  <p>{format(new Date(selectedLoan.expectedReturnDate), 'dd/MM/yyyy', { locale: es })}</p>
                </div>
                {selectedLoan.actualReturnDate && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Retorno Real</Label>
                    <p>{format(new Date(selectedLoan.actualReturnDate), 'dd/MM/yyyy', { locale: es })}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Motivo</Label>
                <p className="text-sm">{selectedLoan.reason}</p>
              </div>
              {selectedLoan.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <Label className="text-xs text-red-600 font-bold">Motivo de Rechazo</Label>
                  <p className="text-sm text-red-700">{selectedLoan.rejectionReason}</p>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Bienes</Label>
                <div className="overflow-x-auto mt-2">
                  <Table responsiveCards>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bien</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead hideOnMobile>Patrimonial</TableHead>
                        <TableHead>Cant.</TableHead>
                        <TableHead hideOnMobile>Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLoan.items.map((li) => (
                        <TableRow key={li.id}>
                          <TableCell className="font-medium">{li.itemName}</TableCell>
                          <TableCell className="font-mono text-xs">{li.itemCode}</TableCell>
                          <TableCell className="font-mono text-xs text-blue-600">{li.patrimonialCode || '—'}</TableCell>
                          <TableCell>{li.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{li.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Autorizado por Almacenero</Label>
                  <p className="font-medium">{selectedLoan.almaceneroAuth?.fullName || '—'}</p>
                  {selectedLoan.almaceneroAuthAt && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedLoan.almaceneroAuthAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Autorizado por Jefatura</Label>
                  <p className="font-medium">{selectedLoan.jefeAuth?.fullName || '—'}</p>
                  {selectedLoan.jefeAuthAt && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedLoan.jefeAuthAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handlePrintDocument(selectedLoan)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Documento
                </Button>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmación: Autorizar Almacenero */}
      <AlertDialog open={authorizeAlmaceneroOpen} onOpenChange={(o) => { setAuthorizeAlmaceneroOpen(o); if (!o) { setAuthorizationPin(''); setPinError(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              ¿Autorizar como Almacenero?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ingrese su PIN para autorizar el préstamo <strong>{selectedLoan?.documentNumber}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="pin-almacenero">PIN de Autorización</Label>
            <Input
              id="pin-almacenero"
              type="password"
              maxLength={4}
              value={authorizationPin}
              onChange={(e) => { setAuthorizationPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
              placeholder="****"
              className="text-center text-2xl tracking-widest"
            />
            {pinError && <p className="text-sm text-red-500">{pinError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAuthorizationPin(''); setPinError('') }}>Cancelar</AlertDialogCancel>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={async () => {
                if (!selectedLoan) return
                if (!authorizationPin || authorizationPin.length !== 4) { setPinError('Debe ingresar su PIN de 4 dígitos'); return }
                const ok = await verifyPin(authorizationPin)
                if (!ok) { setPinError('PIN incorrecto'); return }
                const currentPin = authorizationPin; setAuthorizationPin(''); setPinError('')
                await handleAction('authorize_almacenero', selectedLoan.id, { pin: currentPin })
                setAuthorizeAlmaceneroOpen(false)
              }}
            >
              Autorizar como Almacenero
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación: Autorizar Jefe */}
      <AlertDialog open={authorizeJefeOpen} onOpenChange={(o) => { setAuthorizeJefeOpen(o); if (!o) { setAuthorizationPin(''); setPinError(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-indigo-600" />
              ¿Autorizar como Jefe?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ingrese su PIN para autorizar el préstamo <strong>{selectedLoan?.documentNumber}</strong> como jefe de oficina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="pin-jefe">PIN de Autorización</Label>
            <Input
              id="pin-jefe"
              type="password"
              maxLength={4}
              value={authorizationPin}
              onChange={(e) => { setAuthorizationPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
              placeholder="****"
              className="text-center text-2xl tracking-widest"
            />
            {pinError && <p className="text-sm text-red-500">{pinError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAuthorizationPin(''); setPinError('') }}>Cancelar</AlertDialogCancel>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={async () => {
                if (!selectedLoan) return
                if (!authorizationPin || authorizationPin.length !== 4) { setPinError('Debe ingresar su PIN de 4 dígitos'); return }
                const ok = await verifyPin(authorizationPin)
                if (!ok) { setPinError('PIN incorrecto'); return }
                const currentPin = authorizationPin; setAuthorizationPin(''); setPinError('')
                await handleAction('authorize_jefe', selectedLoan.id, { pin: currentPin })
                setAuthorizeJefeOpen(false)
              }}
            >
              Autorizar como Jefe
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación: Confirmar Préstamo */}
      <AlertDialog open={confirmLoanOpen} onOpenChange={(o) => { setConfirmLoanOpen(o); if (!o) { setAuthorizationPin(''); setPinError(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              ¿Confirmar Préstamo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ingrese su PIN para confirmar la entrega de los bienes del préstamo <strong>{selectedLoan?.documentNumber}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="pin-confirm">PIN de Autorización</Label>
            <Input
              id="pin-confirm"
              type="password"
              maxLength={4}
              value={authorizationPin}
              onChange={(e) => { setAuthorizationPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
              placeholder="****"
              className="text-center text-2xl tracking-widest"
            />
            {pinError && <p className="text-sm text-red-500">{pinError}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAuthorizationPin(''); setPinError('') }}>Cancelar</AlertDialogCancel>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={async () => {
                if (!selectedLoan) return
                if (!authorizationPin || authorizationPin.length !== 4) { setPinError('Debe ingresar su PIN de 4 dígitos'); return }
                const ok = await verifyPin(authorizationPin)
                if (!ok) { setPinError('PIN incorrecto'); return }
                const currentPin = authorizationPin; setAuthorizationPin(''); setPinError('')
                await handleAction('confirm_loan', selectedLoan.id, { pin: currentPin })
                setConfirmLoanOpen(false)
              }}
            >
              Confirmar Préstamo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación: Devolución */}
      <AlertDialog open={returnOpen} onOpenChange={(o) => { setReturnOpen(o); if (!o) { setAuthorizationPin(''); setPinError(''); setReturnCondition('OPERATIVO'); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-gray-600" />
              ¿Registrar Devolución?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Registre la devolución de los bienes del préstamo <strong>{selectedLoan?.documentNumber}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Estado de los bienes al devolver</Label>
              <Select value={returnCondition} onValueChange={setReturnCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATIVO">Operativo</SelectItem>
                  <SelectItem value="DAÑADO">Dañado</SelectItem>
                  <SelectItem value="INCOMPLETO">Incompleto</SelectItem>
                  <SelectItem value="MAL_ESTADO">Mal estado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin-return">PIN de Autorización</Label>
              <Input
                id="pin-return"
                type="password"
                maxLength={4}
                value={authorizationPin}
                onChange={(e) => { setAuthorizationPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
                placeholder="****"
                className="text-center text-2xl tracking-widest"
              />
              {pinError && <p className="text-sm text-red-500">{pinError}</p>}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAuthorizationPin(''); setPinError(''); setReturnCondition('OPERATIVO') }}>Cancelar</AlertDialogCancel>
            <Button
              onClick={async () => {
                if (!selectedLoan) return
                if (!authorizationPin || authorizationPin.length !== 4) { setPinError('Debe ingresar su PIN de 4 dígitos'); return }
                const ok = await verifyPin(authorizationPin)
                if (!ok) { setPinError('PIN incorrecto'); return }
                const currentPin = authorizationPin; setAuthorizationPin(''); setPinError('')
                await handleAction('return', selectedLoan.id, { pin: currentPin, returnCondition })
                setReturnOpen(false)
              }}
            >
              Registrar Devolución
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo: Subir documento firmado */}
      <Dialog open={uploadSignedOpen} onOpenChange={(o) => { setUploadSignedOpen(o); if (!o) { setSignedFile(null) } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir Documento Firmado</DialogTitle>
            <DialogDescription>
              Suba el documento del préstamo <strong>{selectedLoan?.documentNumber}</strong> debidamente firmado.
              {selectedLoan?.signedPdfUrl && (
                <span className="block mt-1 text-green-600">Ya existe un documento firmado.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedLoan?.signedPdfUrl && (
              <DocumentViewerModal
                url={selectedLoan.signedPdfUrl}
                title={`Documento Firmado - ${selectedLoan.documentNumber}`}
                fileName={`${selectedLoan.documentNumber}.pdf`}
                variant="button"
                buttonText="Ver documento actual"
              />
            )}
            <div className="space-y-2">
              <Label>Archivo PDF firmado</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSignedFile(e.target.files?.[0] || null)}
              />
              {signedFile && <p className="text-xs text-muted-foreground">{signedFile.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadSignedOpen(false); setSignedFile(null) }}>
              Cancelar
            </Button>
            <Button
              style={{ backgroundColor: config?.primaryColor }}
              disabled={!signedFile || isUploadingSigned}
              onClick={async () => {
                if (!selectedLoan || !signedFile) return
                setIsUploadingSigned(true)
                try {
                  const formData = new FormData()
                  formData.append('file', signedFile)
                  const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: formData })
                  if (!uploadRes.ok) { toast.error('Error al subir archivo'); setIsUploadingSigned(false); return }
                  const uploadData = await uploadRes.json()
                  const fileUrl = uploadData.url || `/api/files/${uploadData.filename}`
                  await handleAction('upload_signed_pdf', selectedLoan.id, { signedPdfUrl: fileUrl })
                  setUploadSignedOpen(false)
                  setSignedFile(null)
                } catch {
                  toast.error('Error al subir el archivo')
                } finally {
                  setIsUploadingSigned(false)
                }
              }}
            >
              {isUploadingSigned ? 'Subiendo...' : 'Subir Documento Firmado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación: Rechazar */}
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-600" />
              ¿Rechazar Préstamo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Va a rechazar el préstamo <strong>{selectedLoan?.documentNumber}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">Motivo del Rechazo *</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Indique el motivo del rechazo"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={!rejectReason.trim()}
              onClick={() => {
                if (selectedLoan) handleAction('reject', selectedLoan.id, { reason: rejectReason })
                setRejectOpen(false)
              }}
            >
              Rechazar Préstamo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
