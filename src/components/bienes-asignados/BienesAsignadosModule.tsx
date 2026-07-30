'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { normalizeText } from '@/lib/utils'
import { useConfigStore } from '@/store'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import {
  UserCheck, Plus, Search, ArrowLeftRight, FileText,
  Calendar, User, Package, Loader2, Building2, ClipboardList,
  Download, FileSpreadsheet, Upload, Pen,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { AssignedAsset, User as UserType, Item, PatrimonialUnit } from '@/types'
import { ItemCombobox } from '@/components/ui/item-combobox'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import {
  openDeliveryDocument,
  saveDeliveryDocument,
  generateReturnHtml,
  openLostDocument,
  saveReturnDocument,
  fetchUserSignature,
  type DeliveryDocData,
  type DeliveryDocItem,
  type LostDocData,
} from '@/lib/delivery-doc'

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface AssignmentItemRow {
  id: string
  itemId: string
  patrimonialUnitId: string
  quantity: string
}

interface RequestItemRow {
  id: string
  itemId: string
  patrimonialUnitId: string
  quantity: string
}

interface RequestFromAPI {
  id: number
  userId: number
  userName: string
  userOffice: string
  items: { itemId: number; itemName: string; quantity: number }[]
  notes: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  processedAt?: string
  processedBy?: string
  rejectionReason?: string
}

export function BienesAsignadosModule() {
  const { config } = useConfigStore()

  const [assignedAssets, setAssignedAssets] = useState<AssignedAsset[]>([])
  const [users, setUsers] = useState<UserType[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [userFilter] = useState('')
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<AssignedAsset | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [patrimonialCache, setPatrimonialCache] = useState<Record<string, PatrimonialUnit[]>>({})
  const [requestPatrimonialCache, setRequestPatrimonialCache] = useState<Record<string, PatrimonialUnit[]>>({})
  const nextRowId = useRef(1)
  const [isBulkSelectOpen, setIsBulkSelectOpen] = useState(false)
  const [bulkSearch, setBulkSearch] = useState('')
  const [isRequestSaving, setIsRequestSaving] = useState(false)
  const [isReturnSaving, setIsReturnSaving] = useState(false)

  const [authUser, setAuthUser] = useState<UserType | null>(null)
  const [requests, setRequests] = useState<RequestFromAPI[]>([])
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [requestFormItems, setRequestFormItems] = useState<RequestItemRow[]>([{ id: '1', itemId: '', patrimonialUnitId: '', quantity: '1' }])
  const requestNextRowId = useRef(1)
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [isRequestBulkSelectOpen, setIsRequestBulkSelectOpen] = useState(false)
  const [requestBulkSearch, setRequestBulkSearch] = useState('')
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false)
  const [lostConfirmOpen, setLostConfirmOpen] = useState(false)
  const [assetToMarkLost, setAssetToMarkLost] = useState<AssignedAsset | null>(null)
  const [lossReason, setLossReason] = useState('')
  const [lossDate, setLossDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [lastAssignedData, setLastAssignedData] = useState<{
    docNumber: string
    recipientName: string
    recipientOffice: string
    items: DeliveryDocItem[]
  } | null>(null)

  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [signingAsset, setSigningAsset] = useState<AssignedAsset | null>(null)

  const handleCanvasStart = (id: string) => (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    canvas.setAttribute('data-drawing', 'true')
  }

  const handleCanvasMove = (id: string) => (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null
    if (!canvas || canvas.getAttribute('data-drawing') !== 'true') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#2563eb'
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const handleCanvasEnd = () => {
    document.querySelectorAll<HTMLCanvasElement>('canvas[data-drawing="true"]').forEach(c => c.setAttribute('data-drawing', 'false'))
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>, id: string) => {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    if (!touch) return
    ctx.beginPath()
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top)
    canvas.setAttribute('data-drawing', 'true')
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>, id: string) => {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null
    if (!canvas || canvas.getAttribute('data-drawing') !== 'true') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    if (!touch) return
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#2563eb'
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top)
    ctx.stroke()
  }

  useEffect(() => {
    if (!signDialogOpen || !authUser) return
    fetchUserSignature(authUser.id).then(sig => {
      if (!sig) return
      const img = new Image()
      img.onload = () => {
        const canvas = document.getElementById('firma-canvas-d') as HTMLCanvasElement | null
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      img.src = sig
    })
  }, [signDialogOpen, authUser])

  const [formData, setFormData] = useState({
    userId: '',
    assignmentDocNumber: '',
    assignmentDocUrl: '',
    notes: '',
    items: [{ id: '1', itemId: '', patrimonialUnitId: '', quantity: '1' }] as AssignmentItemRow[],
  })

  const [returnForm, setReturnForm] = useState({
    returnDocNumber: '',
    returnDocUrl: '',
    notes: '',
    returnQuantity: '',
  })

  const addItemRow = () => {
    const id = String(++nextRowId.current)
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { id, itemId: '', patrimonialUnitId: '', quantity: '1' }],
    }))
  }

  const removeItemRow = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id),
    }))
  }

  const openBulkSelectDialog = () => {
    setBulkSearch('')
    setIsBulkSelectOpen(true)
  }

  const handleBulkSelect = (selectedIds: number[]) => {
    const existingIds = new Set(formData.items.map(i => i.itemId).filter(Boolean))
    const newItems = selectedIds
      .filter(id => !existingIds.has(String(id)))
      .map(id => ({
        id: String(++nextRowId.current),
        itemId: String(id),
        patrimonialUnitId: '',
        quantity: '1',
      }))
    if (newItems.length === 0) {
      toast.info('Los bienes seleccionados ya están en la lista')
      return
    }
    setFormData(prev => ({ ...prev, items: [...prev.items, ...newItems] }))
    newItems.forEach(ni => {
      const item = items.find(i => i.id === parseInt(ni.itemId))
      if (item?.itemType === 'PATRIMONIAL') loadPatrimonialUnits(ni.itemId)
    })
    toast.success(`${newItems.length} bien(es) agregado(s)`)
    setIsBulkSelectOpen(false)
  }

  const updateItemRow = (id: string, updates: Partial<AssignmentItemRow>) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(i => (i.id === id ? { ...i, ...updates } : i)),
    }))
  }

  const loadPatrimonialUnits = async (itemId: string) => {
    if (patrimonialCache[itemId]) return
    try {
      const res = await apiFetch(`/api/items/patrimonial-codes?itemId=${itemId}&available=true`)
      const data = await res.json()
      setPatrimonialCache(prev => ({ ...prev, [itemId]: data.patrimonialUnits || [] }))
    } catch {
      setPatrimonialCache(prev => ({ ...prev, [itemId]: [] }))
    }
  }

  const loadRequestPatrimonialUnits = async (itemId: string) => {
    if (requestPatrimonialCache[itemId]) return
    try {
      const res = await apiFetch(`/api/items/patrimonial-codes?itemId=${itemId}&available=true`)
      const data = await res.json()
      setRequestPatrimonialCache(prev => ({ ...prev, [itemId]: data.patrimonialUnits || [] }))
    } catch {
      setRequestPatrimonialCache(prev => ({ ...prev, [itemId]: [] }))
    }
  }

  const handleRequestRowItemChange = (rowId: string, itemId: string) => {
    updateRequestItemRow(rowId, { itemId, patrimonialUnitId: '' })
    const item = items.find(i => i.id === parseInt(itemId))
    if (item?.itemType === 'PATRIMONIAL') loadRequestPatrimonialUnits(itemId)
  }

  const handleRowItemChange = (rowId: string, itemId: string) => {
    updateItemRow(rowId, { itemId, patrimonialUnitId: '' })
    const item = items.find(i => i.id === parseInt(itemId))
    if (item?.itemType === 'PATRIMONIAL') loadPatrimonialUnits(itemId)
  }

  const handleRequestBulkSelect = (selectedIds: number[]) => {
    const existingIds = new Set(requestFormItems.map(i => i.itemId).filter(Boolean))
    const newItems = selectedIds
      .filter(id => !existingIds.has(String(id)))
      .map(id => ({
        id: String(++requestNextRowId.current),
        itemId: String(id),
        patrimonialUnitId: '',
        quantity: '1',
      }))
    if (newItems.length === 0) {
      toast.info('Los bienes seleccionados ya están en la lista')
      return
    }
    setRequestFormItems(prev => [...prev, ...newItems])
    newItems.forEach(ni => {
      const item = items.find(i => i.id === parseInt(ni.itemId))
      if (item?.itemType === 'PATRIMONIAL') loadRequestPatrimonialUnits(ni.itemId)
    })
    toast.success(`${newItems.length} bien(es) agregado(s)`)
    setIsRequestBulkSelectOpen(false)
  }

  const addRequestItemRow = () => {
    const id = String(++requestNextRowId.current)
    setRequestFormItems(prev => [...prev, { id, itemId: '', patrimonialUnitId: '', quantity: '1' }])
  }

  const removeRequestItemRow = (id: string) => {
    setRequestFormItems(prev => prev.filter(i => i.id !== id))
  }

  const updateRequestItemRow = (id: string, updates: Partial<RequestItemRow>) => {
    setRequestFormItems(prev => prev.map(i => (i.id === id ? { ...i, ...updates } : i)))
  }

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const res = await apiFetch('/api/assignment-requests')
      const data = await res.json()
      setRequests(data.requests || [])
    } catch {
      toast.error('Error al cargar las solicitudes')
    } finally {
      setRequestsLoading(false)
    }
  }, [])

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const effectiveItems = requestFormItems.filter(i => i.itemId)
    if (effectiveItems.length === 0) {
      toast.error('Seleccione al menos un bien')
      return
    }

    setIsRequestSaving(true)
    try {
      const res = await apiFetch('/api/assignment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: effectiveItems.map(i => ({ itemId: i.itemId, quantity: i.quantity, patrimonialUnitId: i.patrimonialUnitId || undefined })),
          notes: '',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al crear solicitud')
        return
      }

      toast.success('Solicitud enviada correctamente')
      setIsRequestDialogOpen(false)
      setRequestFormItems([{ id: '1', itemId: '', patrimonialUnitId: '', quantity: '1' }])
      setRequestPatrimonialCache({})
      fetchRequests()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setIsRequestSaving(false)
    }
  }

  const resetForm = () => {
    setFormData({
      userId: '',
      assignmentDocNumber: '',
      assignmentDocUrl: '',
      notes: '',
      items: [{ id: '1', itemId: '', patrimonialUnitId: '', quantity: '1' }],
    })
    setPatrimonialCache({})
  }

  const resetReturnForm = () => {
    setReturnForm({ returnDocNumber: '', returnDocUrl: '', notes: '', returnQuantity: '' })
    setSelectedAsset(null)
  }

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (userFilter) params.set('userId', userFilter)

      const [assetsRes, usersRes, itemsRes, meRes] = await Promise.all([
        apiFetch(`/api/assigned-assets?${params}`),
        apiFetch('/api/users?limit=200'),
        apiFetch('/api/items?perPage=500'),
        apiFetch('/api/auth/me'),
      ])

      const assetsData = await assetsRes.json()
      const usersData = await usersRes.json()
      const itemsData = await itemsRes.json()

      setAssignedAssets(assetsData.assignedAssets || [])
      setUsers(usersData.users || [])
      setItems(itemsData.items || [])

      if (meRes.ok) {
        const meData = await meRes.json()
        setAuthUser(meData.user)
      }
    } catch (error) {
      console.error('Error al obtener data:', error)
      toast.error('Error al cargar los datos')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, userFilter])

  const handleApproveRequest = useCallback(async (reqId: number) => {
    try {
      const res = await apiFetch(`/api/assignment-requests/${reqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED', assignmentDocNumber: `ASIG-${Date.now()}` }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al aprobar solicitud')
        return
      }

      toast.success(data.message || 'Solicitud aprobada')
      await fetchRequests()
      await fetchData()

      if (data.assignedAssets?.length > 0) {
        const user = users.find(u => u.id === data.assignedAssets[0].userId)
        const deliveredByName = authUser?.fullName || 'Responsable de Almacén'
        const isAdmin = authUser?.role === 'ADMINISTRADOR'
        const docData: DeliveryDocData = {
          docNumber: data.assignedAssets[0].assignmentDocNumber,
          date: format(new Date(), 'dd/MM/yyyy', { locale: es }),
          recipientName: user?.fullName || data.assignedAssets[0].user?.fullName || '---',
          recipientOffice: user?.office?.name || data.assignedAssets[0].user?.office?.name || '---',
          deliveredBy: deliveredByName,
          warehouseManager: deliveredByName,
          authorizedBy: authUser?.fullName || deliveredByName,
          authorizationDetail: isAdmin ? 'Administrador actuó en representación del Almacenero' : '',
          items: data.assignedAssets.map((a: AssignedAsset) => ({
            name: a.item.name,
            code: a.item.code,
            patrimonialCode: a.patrimonialUnit?.patrimonialCode || 'S/N',
            quantity: a.quantity,
            itemType: a.item.itemType,
            category: a.item.category || '---',
            unit: a.item.unit || 'UNIDAD',
            status: a.patrimonialUnit?.status || 'OPERATIVO',
          })),
        }

        const assetsIds = data.assignedAssets.map((a: AssignedAsset) => a.id)
        await saveDeliveryDocument(docData, assetsIds, config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined)

        setLastAssignedData({
          docNumber: docData.docNumber,
          recipientName: docData.recipientName,
          recipientOffice: docData.recipientOffice,
          items: docData.items,
        })
        setIsDocDialogOpen(true)
      }
    } catch {
      toast.error('Error de conexión')
    }
  }, [users, authUser, config, fetchData, fetchRequests])

  const handleRejectRequest = useCallback(async (reqId: number, reason: string) => {
    try {
      const res = await apiFetch(`/api/assignment-requests/${reqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', rejectionReason: reason || 'Sin especificar' }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al rechazar solicitud')
        return
      }

      toast.success('Solicitud rechazada')
      fetchRequests()
    } catch {
      toast.error('Error de conexión')
    }
  }, [fetchRequests])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  useEffect(() => {
    fetchData()
  }, [statusFilter, userFilter])

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.userId) {
      toast.error('Seleccione un usuario')
      return
    }
    const docNumber = formData.assignmentDocNumber?.trim()
      ? formData.assignmentDocNumber
      : `ACTA-${Date.now().toString(36).toUpperCase()}`
    if (formData.items.length === 0) {
      toast.error('Agregue al menos un bien para asignar')
      return
    }

    const effectiveItems = formData.items.filter(i => i.itemId)
    if (effectiveItems.length === 0) {
      toast.error('Seleccione al menos un bien')
      return
    }

    for (const row of effectiveItems) {
      const item = items.find(i => i.id === parseInt(row.itemId))
      if (item?.itemType === 'PATRIMONIAL' && !row.patrimonialUnitId) {
        toast.error(`Seleccione una unidad patrimonial para "${item.name}"`)
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await apiFetch('/api/assigned-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: formData.userId,
          assignmentDocNumber: docNumber,
          assignmentDocUrl: formData.assignmentDocUrl,
          notes: formData.notes,
          items: effectiveItems.map(i => ({
            itemId: i.itemId,
            patrimonialUnitId: i.patrimonialUnitId || undefined,
            quantity: i.quantity,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al asignar bienes')
        return
      }

      toast.success(data.message || `${data.assignedAssets?.length || 0} bien(es) asignado(s) correctamente`)
      if (data.errors?.length) {
        data.errors.forEach((err: string) => toast.warning(err))
      }

      const recipient = users.find(u => String(u.id) === formData.userId)
      const currentUserName = authUser?.fullName || 'Responsable de Almacén'
      const isAdmin = authUser?.role === 'ADMINISTRADOR'
      const docData: DeliveryDocData = {
        docNumber: formData.assignmentDocNumber,
        date: format(new Date(), 'dd/MM/yyyy', { locale: es }),
        recipientName: recipient?.fullName || '---',
        recipientOffice: recipient?.office?.name || '---',
        deliveredBy: currentUserName,
        warehouseManager: currentUserName,
        authorizedBy: authUser?.fullName || currentUserName,
        authorizationDetail: isAdmin ? 'Administrador actuó en representación del Almacenero' : '',
        items: (data.assignedAssets || []).map((a: AssignedAsset) => ({
          name: a.item.name,
          code: a.item.code,
          patrimonialCode: a.patrimonialUnit?.patrimonialCode || 'S/N',
          quantity: a.quantity,
          itemType: a.item.itemType,
          category: a.item.category || '---',
          unit: a.item.unit || 'UNIDAD',
          status: a.patrimonialUnit?.status || 'OPERATIVO',
        })),
      }

      const assetsIds = (data.assignedAssets || []).map((a: AssignedAsset) => a.id)
      saveDeliveryDocument(docData, assetsIds, config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined)

      setLastAssignedData({
        docNumber: docData.docNumber,
        recipientName: docData.recipientName,
        recipientOffice: docData.recipientOffice,
        items: docData.items,
      })

      setIsAssignDialogOpen(false)
      resetForm()
      fetchData()
      setIsDocDialogOpen(true)
    } catch {
      toast.error('Error de conexión al asignar bienes')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkLostClick = (asset: AssignedAsset) => {
    setAssetToMarkLost(asset)
    setLossReason('')
    setLossDate(format(new Date(), 'yyyy-MM-dd'))
    setLostConfirmOpen(true)
  }

  const handleConfirmMarkLost = async () => {
    if (!assetToMarkLost) return
    if (!lossReason.trim()) {
      toast.error('Debe ingresar el motivo de la pérdida')
      return
    }
    const res = await apiFetch(`/api/assigned-assets/${assetToMarkLost.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lost', notes: `Perdido: ${lossReason}` }),
    })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error || 'Error al marcar como perdido')
      return
    }

    const lostDocData: LostDocData = {
      docNumber: `PERD-${Date.now().toString(36).toUpperCase()}`,
      date: format(new Date(), 'dd/MM/yyyy', { locale: es }),
      declarantName: assetToMarkLost.user.fullName,
      declarantOffice: assetToMarkLost.user.office?.name || '---',
      lossReason,
      lossDate,
      items: [{
        name: assetToMarkLost.item.name,
        code: assetToMarkLost.item.code,
        patrimonialCode: assetToMarkLost.patrimonialUnit?.patrimonialCode || 'S/N',
        quantity: assetToMarkLost.quantity,
      }],
    }
    openLostDocument(lostDocData, config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined)

    setAssetToMarkLost(null)
    fetchData()
  }

  const openReturnDialog = (asset: AssignedAsset) => {
    setSelectedAsset(asset)
    setReturnForm({ returnDocNumber: '', returnDocUrl: '', notes: '', returnQuantity: String(asset.quantity) })
    setIsReturnDialogOpen(true)
  }

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAsset || !returnForm.returnDocNumber) {
      toast.error('Complete el número de documento de devolución')
      return
    }

    const qtyToReturn = parseInt(returnForm.returnQuantity) || selectedAsset.quantity
    if (qtyToReturn <= 0 || qtyToReturn > selectedAsset.quantity) {
      toast.error(`Cantidad inválida. Debe ser entre 1 y ${selectedAsset.quantity}`)
      return
    }

    setIsReturnSaving(true)
    try {
      const res = await apiFetch(`/api/assigned-assets/${selectedAsset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return', ...returnForm, returnQuantity: String(qtyToReturn) }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al registrar devolución')
        return
      }

      toast.success(`Devolución registrada correctamente (${qtyToReturn} unidades)`)

      const returnDocData = {
        docNumber: selectedAsset.assignmentDocNumber,
        date: format(new Date(), 'dd/MM/yyyy', { locale: es }),
        returnDocNumber: returnForm.returnDocNumber,
        recipientName: selectedAsset.user.fullName,
        recipientOffice: selectedAsset.user.office?.name || '---',
        deliveredBy: authUser?.fullName || 'Responsable de Almacén',
        items: [{
          name: selectedAsset.item.name,
          code: selectedAsset.item.code,
          patrimonialCode: selectedAsset.patrimonialUnit?.patrimonialCode || 'S/N',
          quantity: qtyToReturn,
          itemType: selectedAsset.item.itemType,
        }],
      }

      const branding = config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined

      saveReturnDocument(returnDocData, [selectedAsset.id], branding)

      const returnHtml = generateReturnHtml(returnDocData, branding)
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(returnHtml)
        win.document.close()
        win.focus()
      }

      setIsReturnDialogOpen(false)
      resetReturnForm()
      fetchData()
    } catch {
      toast.error('Error de conexión al registrar devolución')
    } finally {
      setIsReturnSaving(false)
    }
  }

  const filteredAssets = useMemo(() => {
    if (!search) return assignedAssets
    const q = normalizeText(search)
    return assignedAssets.filter(a =>
      normalizeText(a.item.name).includes(q) ||
      normalizeText(a.item.code).includes(q) ||
      normalizeText(a.user.fullName).includes(q) ||
      normalizeText(a.assignmentDocNumber).includes(q)
    )
  }, [assignedAssets, search])

  const activeAssets = useMemo(() => filteredAssets.filter(a => a.status === 'ASIGNADO'), [filteredAssets])
  const returnedAssets = useMemo(() => filteredAssets.filter(a => a.status === 'DEVUELTO'), [filteredAssets])
  const pendingRequestsCount = useMemo(() => requests.filter(r => r.status === 'PENDING').length, [requests])
  const docsWithNumber = useMemo(() => assignedAssets.filter(a => a.assignmentDocUrl || a.assignmentDocNumber), [assignedAssets])
  const uniqueDocs = useMemo(() => docsWithNumber.filter((a, i, arr) => a.assignmentDocNumber && arr.findIndex(x => x.assignmentDocNumber === a.assignmentDocNumber) === i), [docsWithNumber])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ASIGNADO':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Asignado</Badge>
      case 'DEVUELTO':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Devuelto</Badge>
      case 'PERDIDO':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Perdido</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return <ModuleSkeleton variant="cards" />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-xl font-bold">Bienes Asignados</CardTitle>
              {pendingRequestsCount > 0 && (
                <Badge className="bg-amber-500 text-white text-xs whitespace-nowrap">
                  {pendingRequestsCount} pendiente(s)
                </Badge>
              )}
            </div>
            <CardDescription>Gestión de bienes asignados a usuarios</CardDescription>
          </div>
          <Dialog open={isAssignDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsAssignDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: config?.primaryColor }}>
                <Plus className="h-4 w-4 mr-2" />
                Asignar Bienes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Asignar Bienes a Usuario</DialogTitle>
                <DialogDescription>
                  Registre la asignación de uno o más bienes con su documento correspondiente
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAssign} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userId">Usuario *</Label>
                  <Select value={formData.userId} onValueChange={(v) => setFormData({ ...formData, userId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(u => u.isActive).map(u => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.fullName} - {u.dni} ({u.office?.name || 'Sin oficina'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Bienes a Asignar *</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Agregar fila
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={openBulkSelectDialog}>
                        <Search className="h-3.5 w-3.5 mr-1" />
                        Selección múltiple
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {formData.items.map((row) => {
                      const selectedItem = items.find(i => i.id === parseInt(row.itemId))
                      const isPatrimonial = selectedItem?.itemType === 'PATRIMONIAL'

                      return (
                        <div key={row.id} className="flex flex-col sm:flex-row gap-2 items-start p-3 border rounded-lg">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <div className="flex-1 min-w-0">
                                <ItemCombobox
                                  items={items}
                                  value={row.itemId}
                                  onValueChange={(v) => handleRowItemChange(row.id, v)}
                                />
                              </div>

                              {isPatrimonial ? (
                                <div className="w-full sm:w-56">
                                  <Select
                                    value={row.patrimonialUnitId}
                                    onValueChange={(v) => updateItemRow(row.id, { patrimonialUnitId: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Código patrimonial" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(() => {
                                          const list = patrimonialCache?.[row?.itemId ?? '']
                                          const safe = Array.isArray(list) ? list : []
                                          const selectedInOtherRows = formData.items
                                            .filter(r => r.id !== row.id && r.patrimonialUnitId)
                                            .map(r => parseInt(r.patrimonialUnitId))
                                          const available = safe.filter(u => !selectedInOtherRows.includes(u.id))
                                          return available.length > 0 ? available.map(u => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                              <span className="flex items-center gap-2">
                                                <span>{u.patrimonialCode}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                                  u.status === 'OPERATIVO' ? 'bg-green-100 text-green-700' :
                                                  u.status === 'DAÑADO' ? 'bg-red-100 text-red-700' :
                                                  u.status === 'MAL_ESTADO' ? 'bg-orange-100 text-orange-700' :
                                                  u.status === 'INCOMPLETO' ? 'bg-yellow-100 text-yellow-700' :
                                                  'bg-gray-100 text-gray-600'
                                                }`}>
                                                  {u.status}
                                                </span>
                                              </span>
                                            </SelectItem>
                                          )) : (
                                            <SelectItem value="__none" disabled>
                                              {list === undefined ? 'Cargando...' : 'No hay unidades disponibles'}
                                            </SelectItem>
                                          )
                                        })()}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <div className="w-full sm:w-24">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={row.quantity}
                                    onChange={(e) => updateItemRow(row.id, { quantity: e.target.value })}
                                    placeholder="Cant."
                                  />
                                </div>
                              )}
                            </div>

                            {isPatrimonial && !row.patrimonialUnitId && (() => {
                              const list = patrimonialCache?.[row?.itemId]
                              const safe = Array.isArray(list) ? list : []
                              const selectedInOtherRows = formData.items
                                .filter(r => r.id !== row.id && r.patrimonialUnitId)
                                .map(r => parseInt(r.patrimonialUnitId))
                              const remaining = safe.filter(u => !selectedInOtherRows.includes(u.id))
                              return remaining.length > 0
                            })() && (
                              <p className="text-xs text-amber-600">Debe seleccionar un código patrimonial</p>
                            )}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 flex-shrink-0 mt-0.5"
                            onClick={() => removeItemRow(row.id)}
                            disabled={formData.items.length <= 1}
                          >
                            <span className="sr-only">Eliminar</span>
                            <svg className="h-4 w-4 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <Dialog open={isBulkSelectOpen} onOpenChange={setIsBulkSelectOpen}>
                  <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Seleccionar Bienes</DialogTitle>
                      <DialogDescription>Marque los bienes que desea asignar</DialogDescription>
                    </DialogHeader>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar bienes..."
                        className="pl-10"
                        value={bulkSearch}
                        onChange={(e) => setBulkSearch(e.target.value)}
                      />
                    </div>
                    <ScrollArea className="flex-1 max-h-[50vh]">
                      <div className="space-y-1">
                        {items
                          .filter(i => !i.isDeleted && (!bulkSearch || normalizeText(i.name).includes(normalizeText(bulkSearch)) || normalizeText(i.code).includes(normalizeText(bulkSearch))))
                          .map(item => {
                            const isSelected = formData.items.some(fi => fi.itemId === String(item.id))
                            return (
                              <label key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      const row = formData.items.find(fi => fi.itemId === String(item.id))
                                      if (row) removeItemRow(row.id)
                                    } else {
                                      handleBulkSelect([item.id])
                                    }
                                  }}
                                  className="h-4 w-4"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">{item.code} · {item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'} · Stock: {item.quantity}</p>
                                </div>
                              </label>
                            )
                          })}
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                      <Button variant="outline" onClick={() => setIsBulkSelectOpen(false)}>
                        Cerrar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="space-y-2">
                  <Label htmlFor="assignmentDocNumber">N° Documento de Asignación</Label>
                  <Input
                    id="assignmentDocNumber"
                    value={formData.assignmentDocNumber}
                    onChange={(e) => setFormData({ ...formData, assignmentDocNumber: e.target.value })}
                    placeholder="Dejar vacío para generar automático"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignmentDocUrl">URL del Documento (opcional)</Label>
                  <Input
                    id="assignmentDocUrl"
                    value={formData.assignmentDocUrl}
                    onChange={(e) => setFormData({ ...formData, assignmentDocUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas (opcional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsAssignDialogOpen(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Asignando...
                      </>
                    ) : (
                      `Asignar (${formData.items.filter(i => i.itemId).length || 0})`
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ClipboardList className="h-4 w-4 mr-2" />
                Solicitar Bienes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Solicitar Asignación de Bienes</DialogTitle>
                <DialogDescription>
                  Envíe una solicitud al responsable de almacén para la asignación de bienes
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Bienes Solicitados *</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addRequestItemRow}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Agregar otro bien
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => { setRequestBulkSearch(''); setIsRequestBulkSelectOpen(true); }}>
                        <Search className="h-3.5 w-3.5 mr-1" />
                        Selección múltiple
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {requestFormItems.map((row) => {
                      const selectedItem = items.find(i => i.id === parseInt(row.itemId))
                      const isPatrimonial = selectedItem?.itemType === 'PATRIMONIAL'
                      return (
                      <div key={row.id} className="flex flex-col sm:flex-row gap-2 items-start p-3 border rounded-lg">
                        <div className="flex-1 flex flex-col sm:flex-row gap-2">
                          <div className="flex-1 min-w-0">
                            <ItemCombobox
                              items={items}
                              value={row.itemId}
                              onValueChange={(v) => handleRequestRowItemChange(row.id, v)}
                              placeholder="Seleccionar bien"
                            />
                          </div>
                          {isPatrimonial ? (
                            <div className="w-full sm:w-56">
                              <Select
                                value={row.patrimonialUnitId}
                                onValueChange={(v) => updateRequestItemRow(row.id, { patrimonialUnitId: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Código patrimonial" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(() => {
                                    const list = requestPatrimonialCache?.[row?.itemId ?? '']
                                    const safe = Array.isArray(list) ? list : []
                                    const selectedInOtherRows = requestFormItems
                                      .filter(r => r.id !== row.id && r.patrimonialUnitId)
                                      .map(r => parseInt(r.patrimonialUnitId))
                                    const available = safe.filter(u => !selectedInOtherRows.includes(u.id))
                                    return available.length > 0 ? available.map(u => (
                                      <SelectItem key={u.id} value={String(u.id)}>
                                        <span className="flex items-center gap-2">
                                          <span>{u.patrimonialCode}</span>
                                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                            u.status === 'OPERATIVO' ? 'bg-green-100 text-green-700' :
                                            u.status === 'DAÑADO' ? 'bg-red-100 text-red-700' :
                                            u.status === 'MAL_ESTADO' ? 'bg-orange-100 text-orange-700' :
                                            u.status === 'INCOMPLETO' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-600'
                                          }`}>
                                            {u.status}
                                          </span>
                                        </span>
                                      </SelectItem>
                                    )) : (
                                      <SelectItem value="__none" disabled>
                                        {list === undefined ? 'Cargando...' : 'No hay unidades disponibles'}
                                      </SelectItem>
                                    )
                                  })()}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div className="w-full sm:w-24">
                              <Input
                                type="number"
                                min="1"
                                value={row.quantity}
                                onChange={(e) => updateRequestItemRow(row.id, { quantity: e.target.value })}
                                placeholder="Cant."
                              />
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 flex-shrink-0 mt-0.5"
                          onClick={() => removeRequestItemRow(row.id)}
                          disabled={requestFormItems.length <= 1}
                        >
                          <svg className="h-4 w-4 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                    )})}
                  </div>
                </div>

                <Dialog open={isRequestBulkSelectOpen} onOpenChange={setIsRequestBulkSelectOpen}>
                  <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Seleccionar Bienes</DialogTitle>
                      <DialogDescription>Marque los bienes que desea solicitar</DialogDescription>
                    </DialogHeader>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar bienes..."
                        className="pl-10"
                        value={requestBulkSearch}
                        onChange={(e) => setRequestBulkSearch(e.target.value)}
                      />
                    </div>
                    <ScrollArea className="flex-1 max-h-[50vh]">
                      <div className="space-y-1">
                        {items
                          .filter(i => !i.isDeleted && (!requestBulkSearch || normalizeText(i.name).includes(normalizeText(requestBulkSearch)) || normalizeText(i.code).includes(normalizeText(requestBulkSearch))))
                          .map(item => {
                            const isSelected = requestFormItems.some(fi => fi.itemId === String(item.id))
                            return (
                              <label key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      const row = requestFormItems.find(fi => fi.itemId === String(item.id))
                                      if (row) removeRequestItemRow(row.id)
                                    } else {
                                      handleRequestBulkSelect([item.id])
                                    }
                                  }}
                                  className="h-4 w-4"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">{item.code} · {item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'} · Stock: {item.quantity}</p>
                                </div>
                              </label>
                            )
                          })}
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                      <Button variant="outline" onClick={() => setIsRequestBulkSelectOpen(false)}>
                        Cerrar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsRequestDialogOpen(false); setRequestFormItems([{ id: '1', itemId: '', patrimonialUnitId: '', quantity: '1' }]); setRequestPatrimonialCache({}); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={isRequestSaving}>
                    {isRequestSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isRequestSaving ? 'Guardando...' : 'Enviar Solicitud'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por bien, usuario o documento..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="ASIGNADO">Asignado</SelectItem>
            <SelectItem value="DEVUELTO">Devuelto</SelectItem>
            <SelectItem value="PERDIDO">Perdido</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              const data = filteredAssets.map(a => ({
                bien: a.item.name,
                codigo: a.item.code,
                usuario: a.user.fullName,
                oficina: a.user.office?.name || '',
                documento: a.assignmentDocNumber,
                estado: a.status,
                fecha: a.assignmentDate,
              }))
              exportToCSV(data, [
                { key: 'bien', label: 'Bien' },
                { key: 'codigo', label: 'Código' },
                { key: 'usuario', label: 'Usuario' },
                { key: 'oficina', label: 'Oficina' },
                { key: 'documento', label: 'Documento' },
                { key: 'estado', label: 'Estado' },
                { key: 'fecha', label: 'Fecha' },
              ], `bienes-asignados-${new Date().toISOString().slice(0, 10)}`)
            }}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const data = filteredAssets.map(a => ({
                bien: a.item.name,
                codigo: a.item.code,
                usuario: a.user.fullName,
                oficina: a.user.office?.name || '',
                documento: a.assignmentDocNumber,
                estado: a.status,
                fecha: a.assignmentDate,
              }))
              exportToExcel(data, [
                { key: 'bien', label: 'Bien' },
                { key: 'codigo', label: 'Código' },
                { key: 'usuario', label: 'Usuario' },
                { key: 'oficina', label: 'Oficina' },
                { key: 'documento', label: 'Documento' },
                { key: 'estado', label: 'Estado' },
                { key: 'fecha', label: 'Fecha' },
              ], `bienes-asignados-${new Date().toISOString().slice(0, 10)}`)
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="overflow-x-auto flex-nowrap w-full sm:overflow-visible sm:flex-wrap">
          <TabsTrigger value="active">
            Asignados
            {activeAssets.length > 0 && (
              <Badge className="ml-2 bg-blue-500 text-white">{activeAssets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="returned">
            Devueltos
            {returnedAssets.length > 0 && (
              <Badge className="ml-2 bg-green-500 text-white">{returnedAssets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests">
            Solicitudes
            {pendingRequestsCount > 0 && (
              <Badge className="ml-2 bg-amber-500 text-white">{pendingRequestsCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Actas
            {uniqueDocs.length > 0 && (
              <Badge className="ml-2 bg-purple-500 text-white">{uniqueDocs.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeAssets.length === 0 ? (
            <EmptyState icon={UserCheck} title="No hay bienes asignados" description='Use el botón "Asignar Bienes" para asignar un bien a un usuario' />
          ) : (
            <ScrollArea className="h-[calc(100vh-22rem)]">
              <div className="grid gap-3">
                {activeAssets.map((asset) => (
                  <Card key={asset.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <p className="font-medium truncate">{asset.item.name}</p>
                            {getStatusBadge(asset.status)}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {asset.user.fullName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {asset.user.office?.name || 'Sin oficina'}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              Doc: {asset.assignmentDocNumber}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(asset.assignmentDate), 'dd/MM/yyyy', { locale: es })}
                            </span>
                            {asset.item.itemType === 'CONSUMIBLE' && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                Cant: {asset.quantity}
                              </span>
                            )}
                            {asset.patrimonialUnit && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {asset.patrimonialUnit.patrimonialCode}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {asset.assignmentDocUrl ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(asset.assignmentDocUrl!, '_blank')}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Documento
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const isAdmin = authUser?.role === 'ADMINISTRADOR'
                                const data: DeliveryDocData = {
                                  docNumber: asset.assignmentDocNumber,
                                  date: format(new Date(asset.assignmentDate), 'dd/MM/yyyy', { locale: es }),
                                  recipientName: asset.user.fullName,
                                  recipientOffice: asset.user.office?.name || '---',
                                  deliveredBy: authUser?.fullName || 'Responsable de Almacén',
                                  warehouseManager: authUser?.fullName || 'Responsable de Almacén',
                                  authorizedBy: authUser?.fullName || 'Responsable de Almacén',
                                  authorizationDetail: isAdmin ? 'Administrador actuó en representación del Almacenero' : '',
                                  items: [{
                                    name: asset.item.name,
                                    code: asset.item.code,
                                    patrimonialCode: asset.patrimonialUnit?.patrimonialCode || 'S/N',
                                    quantity: asset.quantity,
                                    itemType: asset.item.itemType,
                                    category: asset.item.category || '---',
                                    unit: asset.item.unit || 'UNIDAD',
                                    status: asset.patrimonialUnit?.status || 'OPERATIVO',
                                  }],
                                }
                                openDeliveryDocument(data, config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined)
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Documento
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkLostClick(asset)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Perdido
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReturnDialog(asset)}
                          >
                            <ArrowLeftRight className="h-4 w-4 mr-1" />
                            Devolver
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="returned" className="space-y-4">
          {returnedAssets.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No hay devoluciones registradas" />
          ) : (
            <ScrollArea className="h-[calc(100vh-22rem)]">
              <div className="grid gap-3">
                {returnedAssets.map((asset) => (
                  <Card key={asset.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <p className="font-medium truncate">{asset.item.name}</p>
                            {getStatusBadge(asset.status)}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {asset.user.fullName}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              Asignación: {asset.assignmentDocNumber}
                            </span>
                            {asset.returnDocNumber && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                Devolución: {asset.returnDocNumber}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Asignado: {format(new Date(asset.assignmentDate), 'dd/MM/yyyy', { locale: es })}
                            </span>
                            {asset.returnDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Devuelto: {format(new Date(asset.returnDate), 'dd/MM/yyyy', { locale: es })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No hay solicitudes" description='Use el botón "Solicitar Bienes" para crear una solicitud' />
          ) : (
            <ScrollArea className="h-[calc(100vh-22rem)]">
              <div className="grid gap-3">
                {requests.map((req) => (
                  <Card key={req.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <p className="font-medium">Solicitud #{req.id}</p>
                            {req.status === 'PENDING' ? (
                              <Badge className="bg-amber-100 text-amber-800">Pendiente</Badge>
                            ) : req.status === 'APPROVED' ? (
                              <Badge className="bg-green-100 text-green-800">Aprobada</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">Rechazada</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Solicitante:</strong> {req.userName} ({req.userOffice})</p>
                            <p><strong>Fecha:</strong> {format(new Date(req.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                            <p><strong>Bienes:</strong> {req.items.map(i => `${i.itemName} x${i.quantity}`).join(', ')}</p>
                            {req.notes && <p><strong>Notas:</strong> {req.notes}</p>}
                            {req.status === 'APPROVED' && req.processedBy && (
                              <p><strong>Aprobado por:</strong> {req.processedBy} {req.processedAt ? `el ${format(new Date(req.processedAt), 'dd/MM/yyyy HH:mm', { locale: es })}` : ''}</p>
                            )}
                            {req.status === 'REJECTED' && (
                              <p><strong>Motivo:</strong> {req.rejectionReason || 'Sin especificar'}</p>
                            )}
                          </div>
                        </div>
                        {req.status === 'PENDING' && authUser && (authUser.role === 'ADMINISTRADOR' || authUser.role === 'ALMACENERO') && (
                          <RequestActions req={req} onApprove={handleApproveRequest} onReject={handleRejectRequest} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {docsWithNumber.length === 0 ? <EmptyState icon={FileText} title="No hay actas generadas" description="Las actas de entrega se generan automáticamente al asignar bienes" /> : (
            <ScrollArea className="h-[calc(100vh-22rem)]">
              <div className="grid gap-3">
                {uniqueDocs.map((asset) => (
                  <Card key={asset.id} className="overflow-hidden cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <p className="font-medium">Acta N° {asset.assignmentDocNumber}</p>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Usuario:</strong> {asset.user.fullName} ({asset.user.office?.name || 'Sin oficina'})</p>
                            <p><strong>Fecha:</strong> {format(new Date(asset.assignmentDate), 'dd/MM/yyyy', { locale: es })}</p>
                            <p className="text-xs text-muted-foreground/70">{docsWithNumber.filter(a => a.assignmentDocNumber === asset.assignmentDocNumber).length} bien(es) en esta acta</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const docUrl = asset.assignmentDocUrl
                              if (docUrl) {
                                window.open(docUrl, '_blank')
                              } else {
                                const items = docsWithNumber.filter(a => a.assignmentDocNumber === asset.assignmentDocNumber)
                                const isAdmin = authUser?.role === 'ADMINISTRADOR'
                                const data: DeliveryDocData = {
                                  docNumber: asset.assignmentDocNumber,
                                  date: format(new Date(asset.assignmentDate), 'dd/MM/yyyy', { locale: es }),
                                  recipientName: asset.user.fullName,
                                  recipientOffice: asset.user.office?.name || '---',
                                  deliveredBy: authUser?.fullName || 'Responsable de Almacén',
                                  warehouseManager: authUser?.fullName || 'Responsable de Almacén',
                                  authorizedBy: authUser?.fullName || 'Responsable de Almacén',
                                  authorizationDetail: isAdmin ? 'Administrador actuó en representación del Almacenero' : '',
                                  items: items.map(a => ({
                                    name: a.item.name,
                                    code: a.item.code,
                                    patrimonialCode: a.patrimonialUnit?.patrimonialCode || 'S/N',
                                    quantity: a.quantity,
                                    itemType: a.item.itemType,
                                    category: a.item.category || '---',
                                    unit: a.item.unit || 'UNIDAD',
                                    status: a.patrimonialUnit?.status || 'OPERATIVO',
                                  })),
                                }
                                openDeliveryDocument(data, config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined)
                              }
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            {asset.assignmentDocUrl ? 'Ver' : 'Generar'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const fileInput = document.getElementById(`signed-upload-${asset.id}`) as HTMLInputElement
                              if (fileInput) fileInput.click()
                            }}
                            title="Subir acta firmada"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <input
                            id={`signed-upload-${asset.id}`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const formData = new FormData()
                              formData.append('file', file)
                              const res = await apiFetch('/api/upload', { method: 'POST', body: formData })
                              if (res.ok) {
                                const data = await res.json()
                                const fileUrl = data.url || `/api/files/${data.filename}`
                                await apiFetch(`/api/assigned-assets/${asset.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'update_doc_url', assignmentDocUrl: fileUrl }),
                                })
                                toast.success('Acta firmada subida correctamente')
                                fetchData()
                              } else {
                                toast.error('Error al subir el archivo')
                              }
                              e.target.value = ''
                            }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSigningAsset(asset)
                              setSignDialogOpen(true)
                            }}
                            title="Firmar digitalmente"
                          >
                            <Pen className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDocDialogOpen} onOpenChange={setIsDocDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Documento de Entrega</DialogTitle>
            <DialogDescription>
              Genere el acta de entrega para imprimir o descargar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Se ha generado el acta de entrega con {lastAssignedData?.items.length || 0} bien(es)
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => {
                  if (lastAssignedData) {
                    const deliveredByName = authUser?.fullName || 'Responsable de Almacén'
                    const isAdmin = authUser?.role === 'ADMINISTRADOR'
                    openDeliveryDocument({
                      docNumber: lastAssignedData.docNumber,
                      date: format(new Date(), 'dd/MM/yyyy', { locale: es }),
                      recipientName: lastAssignedData.recipientName,
                      recipientOffice: lastAssignedData.recipientOffice,
                      deliveredBy: deliveredByName,
                      warehouseManager: deliveredByName,
                      authorizedBy: authUser?.fullName || deliveredByName,
                      authorizationDetail: isAdmin ? 'Administrador actuó en representación del Almacenero' : '',
                      items: lastAssignedData.items,
                    }, config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined)
                  }
                }}
                className="w-full"
                style={{ backgroundColor: config?.primaryColor }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Ver / Imprimir Acta de Entrega
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Al hacer clic podrá imprimir (PDF) o descargar en Word desde el documento generado
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDocDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReturnDialogOpen} onOpenChange={(open) => { if (!open) resetReturnForm(); setIsReturnDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Devolución</DialogTitle>
            <DialogDescription>
              {selectedAsset && (
                <span>Devolución de <strong>{selectedAsset.item.name}</strong> por <strong>{selectedAsset.user.fullName}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReturn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="returnDocNumber">N° Documento de Devolución *</Label>
              <Input
                id="returnDocNumber"
                value={returnForm.returnDocNumber}
                onChange={(e) => setReturnForm({ ...returnForm, returnDocNumber: e.target.value })}
                placeholder="Ej: DEV-2024-00123"
              />
            </div>
            {selectedAsset?.item.itemType === 'CONSUMIBLE' && selectedAsset.quantity > 1 && (
              <div className="space-y-2">
                <Label htmlFor="returnQuantity">Cantidad a devolver *</Label>
                <Input
                  id="returnQuantity"
                  type="number"
                  min="1"
                  max={selectedAsset.quantity}
                  value={returnForm.returnQuantity}
                  onChange={(e) => setReturnForm({ ...returnForm, returnQuantity: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Asignado: {selectedAsset.quantity} unidades. Puede devolver parcialmente.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="returnDocUrl">URL del Documento (opcional)</Label>
              <Input
                id="returnDocUrl"
                value={returnForm.returnDocUrl}
                onChange={(e) => setReturnForm({ ...returnForm, returnDocUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="returnNotes">Notas (opcional)</Label>
              <Textarea
                id="returnNotes"
                value={returnForm.notes}
                onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsReturnDialogOpen(false); resetReturnForm(); }}>
                Cancelar
              </Button>
              <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={isReturnSaving}>
                {isReturnSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isReturnSaving ? 'Guardando...' : 'Registrar Devolución'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={lostConfirmOpen} onOpenChange={setLostConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Declaración de Pérdida</AlertDialogTitle>
            <AlertDialogDescription>
              {assetToMarkLost?.item.name} asignado a {assetToMarkLost?.user.fullName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Fecha de Pérdida</Label>
              <Input type="date" value={lossDate} onChange={(e) => setLossDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Motivo de la Pérdida *</Label>
              <Textarea
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                placeholder="Describa las circunstancias de la pérdida..."
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se generará una Declaración Jurada de Pérdida que podrá imprimir y firmar.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLossReason('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMarkLost} disabled={!lossReason.trim()}>
              Generar Declaración
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={signDialogOpen} onOpenChange={(open) => {
        if (!open) { setSignDialogOpen(false); return }
        setSignDialogOpen(true)
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Firma Digital - Acta {signingAsset?.assignmentDocNumber}</DialogTitle>
            <DialogDescription>
              {authUser?.id === signingAsset?.userId
                ? 'Usted es el responsable y el destinatario. Firme una sola vez y se aplicará en ambos campos.'
                : 'Firme según su rol. La firma de "Recibí Conforme" es opcional (se puede firmar físicamente después).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {authUser?.id === signingAsset?.userId ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">FIRMA ÚNICA (Aplica para ENTREGÓ y RECIBÍ CONFORME)</Label>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => {
                    const canvas = document.getElementById('firma-canvas-unica') as HTMLCanvasElement
                    if (canvas) { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height) }
                  }}>
                    Limpiar
                  </Button>
                </div>
                <div className="flex justify-center border rounded-lg p-2 bg-white">
                  <canvas
                    id="firma-canvas-unica"
                    width={500}
                    height={150}
                    className="border cursor-crosshair max-w-full"
                    style={{ touchAction: 'none' }}
                    onMouseDown={handleCanvasStart('firma-canvas-unica')}
                    onMouseMove={handleCanvasMove('firma-canvas-unica')}
                    onMouseUp={handleCanvasEnd}
                    onMouseLeave={handleCanvasEnd}
                    onTouchStart={(e) => { handleTouchStart(e, 'firma-canvas-unica'); e.preventDefault() }}
                    onTouchMove={(e) => { handleTouchMove(e, 'firma-canvas-unica'); e.preventDefault() }}
                    onTouchEnd={(e) => { handleCanvasEnd(); e.preventDefault() }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">FIRMA DEL ENTREGÓ ({authUser?.role === 'ADMINISTRADOR' ? 'Administrador' : authUser?.role === 'ALMACENERO' ? 'Almacenero' : authUser?.fullName || 'Responsable'})</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => {
                      const canvas = document.getElementById('firma-canvas-d') as HTMLCanvasElement
                      if (canvas) { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height) }
                    }}>
                      Limpiar
                    </Button>
                  </div>
                  <div className="flex justify-center border rounded-lg p-2 bg-white">
                    <canvas
                      id="firma-canvas-d"
                      width={500}
                      height={150}
                      className="border cursor-crosshair max-w-full"
                      style={{ touchAction: 'none' }}
                      onMouseDown={handleCanvasStart('firma-canvas-d')}
                      onMouseMove={handleCanvasMove('firma-canvas-d')}
                      onMouseUp={handleCanvasEnd}
                      onMouseLeave={handleCanvasEnd}
                      onTouchStart={(e) => { handleTouchStart(e, 'firma-canvas-d'); e.preventDefault() }}
                      onTouchMove={(e) => { handleTouchMove(e, 'firma-canvas-d'); e.preventDefault() }}
                      onTouchEnd={(e) => { handleCanvasEnd(); e.preventDefault() }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">FIRMA DEL RECIBÍ CONFORME ({signingAsset?.user.fullName || 'Destinatario'}) <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => {
                      const canvas = document.getElementById('firma-canvas-r') as HTMLCanvasElement
                      if (canvas) { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height) }
                    }}>
                      Limpiar
                    </Button>
                  </div>
                  <div className="flex justify-center border rounded-lg p-2 bg-white">
                    <canvas
                      id="firma-canvas-r"
                      width={500}
                      height={150}
                      className="border cursor-crosshair max-w-full"
                      style={{ touchAction: 'none' }}
                      onMouseDown={handleCanvasStart('firma-canvas-r')}
                      onMouseMove={handleCanvasMove('firma-canvas-r')}
                      onMouseUp={handleCanvasEnd}
                      onMouseLeave={handleCanvasEnd}
                      onTouchStart={(e) => { handleTouchStart(e, 'firma-canvas-r'); e.preventDefault() }}
                      onTouchMove={(e) => { handleTouchMove(e, 'firma-canvas-r'); e.preventDefault() }}
                      onTouchEnd={(e) => { handleCanvasEnd(); e.preventDefault() }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!signingAsset) return
              const sameUser = authUser?.id === signingAsset.userId
              let dSig: string
              let rSig: string | undefined

              if (sameUser) {
                const uCanvas = document.getElementById('firma-canvas-unica') as HTMLCanvasElement
                if (!uCanvas) return
                dSig = uCanvas.toDataURL('image/png')
                const uPixels = uCanvas.getContext('2d')?.getImageData(0, 0, uCanvas.width, uCanvas.height).data
                const uBlank = uPixels ? uPixels.every(p => p === 0) : true
                if (uBlank) {
                  toast.error('Debe dibujar la firma')
                  return
                }
                rSig = dSig
              } else {
                const dCanvas = document.getElementById('firma-canvas-d') as HTMLCanvasElement
                const rCanvas = document.getElementById('firma-canvas-r') as HTMLCanvasElement
                if (!dCanvas) return
                dSig = dCanvas.toDataURL('image/png')
                const dPixels = dCanvas.getContext('2d')?.getImageData(0, 0, dCanvas.width, dCanvas.height).data
                const dBlank = dPixels ? dPixels.every(p => p === 0) : true
                if (dBlank) {
                  toast.error('Debe dibujar la firma de ENTREGÓ')
                  return
                }
                if (rCanvas) {
                  const rPixels = rCanvas.getContext('2d')?.getImageData(0, 0, rCanvas.width, rCanvas.height).data
                  const rBlank = rPixels ? rPixels.every(p => p === 0) : true
                  if (!rBlank) rSig = rCanvas.toDataURL('image/png')
                }
              }

              try {
                const items = docsWithNumber.filter(a => a.assignmentDocNumber === signingAsset.assignmentDocNumber)
                const isAdmin = authUser?.role === 'ADMINISTRADOR'
                const data: DeliveryDocData = {
                  docNumber: signingAsset.assignmentDocNumber,
                  date: format(new Date(signingAsset.assignmentDate), 'dd/MM/yyyy', { locale: es }),
                  recipientName: signingAsset.user.fullName,
                  recipientOffice: signingAsset.user.office?.name || '---',
                  deliveredBy: authUser?.fullName || 'Responsable de Almacén',
                  warehouseManager: authUser?.fullName || 'Responsable de Almacén',
                  authorizedBy: authUser?.fullName || 'Responsable de Almacén',
                  authorizationDetail: isAdmin ? 'Administrador actuó en representación del Almacenero' : '',
                  items: items.map(a => ({
                    name: a.item.name,
                    code: a.item.code,
                    patrimonialCode: a.patrimonialUnit?.patrimonialCode || 'S/N',
                    quantity: a.quantity,
                    itemType: a.item.itemType,
                    category: a.item.category || '---',
                    unit: a.item.unit || 'UNIDAD',
                    status: a.patrimonialUnit?.status || 'OPERATIVO',
                  })),
                  signatureDeliveredBy: dSig,
                  signatureReceivedBy: rSig,
                }
                const savedUrl = await saveDeliveryDocument(data, items.map(a => a.id), config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined)
                if (savedUrl) {
                  toast.success('Acta firmada digitalmente y guardada')
                  setSignDialogOpen(false)
                  fetchData()
                } else {
                  toast.error('Error al guardar el acta firmada')
                }
              } catch (err) {
                console.error('Error al firmar:', err)
                toast.error('Error al procesar la firma')
              }
            }}>
              Firmar y Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RequestActions({
  req,
  onApprove,
  onReject,
}: {
  req: { id: number; userName: string }
  onApprove: (id: number) => void
  onReject: (id: number, reason: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [approvalPin, setApprovalPin] = useState('')
  const [pinError, setPinError] = useState('')

  const handleConfirm = async () => {
    if (action === 'approve') {
      if (!approvalPin || approvalPin.length !== 4) {
        setPinError('Debe ingresar su PIN de 4 dígitos')
        return
      }
      try {
        const res = await apiFetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: approvalPin }),
        })
        if (!res.ok) {
          setPinError('PIN incorrecto')
          return
        }
      } catch {
        setPinError('Error al verificar PIN')
        return
      }
      onApprove(req.id)
    } else if (action === 'reject') {
      onReject(req.id, rejectionReason)
    }
    setOpen(false)
    setRejectionReason('')
    setAction(null)
    setApprovalPin('')
    setPinError('')
  }

  return (
    <>
      <div className="flex gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="text-green-600 border-green-200 hover:bg-green-50"
          onClick={() => { setAction('approve'); setOpen(true) }}
        >
          Aprobar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => { setAction('reject'); setOpen(true) }}
        >
          Rechazar
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setAction(null); setApprovalPin(''); setPinError(''); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{action === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'} #{req.id}</DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? `Ingrese su PIN para autorizar la asignación de bienes a ${req.userName}`
                : `Indique el motivo de rechazo para ${req.userName}`}
            </DialogDescription>
          </DialogHeader>

          {action === 'approve' && (
            <div className="space-y-2 py-2">
              <Label htmlFor="approvalPin">PIN de Autorización</Label>
              <Input
                id="approvalPin"
                type="password"
                maxLength={4}
                value={approvalPin}
                onChange={(e) => { setApprovalPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError('') }}
                placeholder="****"
                className="text-center text-2xl tracking-widest"
              />
              {pinError && <p className="text-sm text-red-500">{pinError}</p>}
            </div>
          )}

          {action === 'reject' && (
            <div className="space-y-2 py-2">
              <Label htmlFor="rejectionReason">Motivo de Rechazo</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Describa el motivo..."
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setAction(null); setRejectionReason(''); setApprovalPin(''); setPinError('') }}>
              Cancelar
            </Button>
            <Button type="button" variant={action === 'approve' ? 'default' : 'destructive'} onClick={handleConfirm}>
              {action === 'approve' ? 'Autorizar con PIN' : 'Confirmar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
