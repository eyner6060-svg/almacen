'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResponsiveTable } from '@/components/ui/responsive-table'
import { useConfigStore, useAuthStore, useVehiclesStore, useFuelInventoryStore, useFuelRequestsStore } from '@/store'
import { apiFetch } from '@/lib/http'
import { 
  Fuel, Plus, Search, Eye, CheckCircle, XCircle, Clock, 
  Droplets, AlertTriangle, Pencil, Trash2,
  Check, Printer, User, Download, FileText, FileSpreadsheet, Loader2,
  Upload,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { DocumentViewerModal } from '@/components/ui/document-viewer-modal'
import type { FuelRequest, FuelType, FuelRequestStatus, FuelEntry } from '@/types'
import { toast } from 'sonner'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { normalizeText } from '@/lib/utils'
import { getCurrentYearDenomination } from '@/lib/year-denomination'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

const fuelTypeLabels: Record<FuelType, string> = {
  GASOLINA: 'Gasolina',
  PETROLEO: 'Petróleo'
}

const statusConfig: Record<FuelRequestStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  AUTORIZADO: { label: 'Autorizado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  COMPLETADO: { label: 'Completado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  RECHAZADO: { label: 'Rechazado', color: 'bg-red-100 text-red-800', icon: XCircle }
}

export function CombustibleModule() {
  const { config } = useConfigStore()
  const { user } = useAuthStore()
  const { vehicles, setVehicles } = useVehiclesStore()
  const { inventory, setInventory } = useFuelInventoryStore()
  const { fuelRequests, setFuelRequests, addFuelRequest, updateFuelRequest } = useFuelRequestsStore()

  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('solicitudes')

  // Diálogo de nueva solicitud
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false)
  const [viewRequestOpen, setViewRequestOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<FuelRequest | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Diálogo de agregar/editar combustible
  const [isAddFuelOpen, setIsAddFuelOpen] = useState(false)
  const [editingFuelEntry, setEditingFuelEntry] = useState<FuelEntry | null>(null)
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([])
  const [addFuelType, setAddFuelType] = useState<FuelType>('GASOLINA')
  const [addFuelQuantity, setAddFuelQuantity] = useState('')
  const [addFuelSupplier, setAddFuelSupplier] = useState('')
  const [addFuelDocumentNumber, setAddFuelDocumentNumber] = useState('')
  const [addFuelNotes, setAddFuelNotes] = useState('')

  // Diálogo PIN para autorización
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [authorizationPin, setAuthorizationPin] = useState('')
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [lockedMessage, setLockedMessage] = useState('')

  // Diálogo de confirmación de rechazo
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false)

  // Subir vale firmado
  const [uploadSignedOpen, setUploadSignedOpen] = useState(false)
  const [signedFile, setSignedFile] = useState<File | null>(null)
  const [isUploadingSigned, setIsUploadingSigned] = useState(false)

  // Formulario de nueva solicitud
  const [formData, setFormData] = useState({
    fuelType: 'GASOLINA' as FuelType,
    quantity: '',
    reason: '',
    destinations: '',
    requestDate: new Date().toISOString().split('T')[0],
    vehicleId: ''
  })

  const resetAddFuelForm = () => {
    setAddFuelType('GASOLINA')
    setAddFuelQuantity('')
    setAddFuelSupplier('')
    setAddFuelDocumentNumber('')
    setAddFuelNotes('')
    setEditingFuelEntry(null)
  }

  const openEditFuelEntry = (entry: FuelEntry) => {
    setEditingFuelEntry(entry)
    setAddFuelType(entry.fuelType)
    setAddFuelQuantity(String(entry.quantity))
    setAddFuelSupplier(entry.supplier || '')
    setAddFuelDocumentNumber(entry.documentNumber || '')
    setAddFuelNotes(entry.notes || '')
    setIsAddFuelOpen(true)
  }

  const fetchData = useCallback(async () => {
    try {
      const [vehiclesRes, inventoryRes, requestsRes, entriesRes] = await Promise.all([
        apiFetch('/api/vehicles'),
        apiFetch('/api/fuel-inventory'),
        apiFetch(`/api/fuel-requests?status=${statusFilter}`),
        apiFetch('/api/fuel-entries')
      ])

      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json()
        setVehicles(data.vehicles)
      }

      if (inventoryRes.ok) {
        const data = await inventoryRes.json()
        setInventory(data.inventory)
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setFuelRequests(data.fuelRequests)
      }

      if (entriesRes.ok) {
        const data = await entriesRes.json()
        setFuelEntries(data.entries)
      }
    } catch (error) {
      console.error('Error al obtener data:', error)
      toast.error('Error al cargar los datos')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, setFuelRequests, setInventory, setVehicles])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-seleccionar vehículo del conductor cuando se cargan los datos
  useEffect(() => {
    if (vehicles.length > 0 && user?.id && formData.vehicleId === '') {
      const assignedVehicle = vehicles.find(v => v.driverId === user.id)
      if (assignedVehicle) {
        setFormData(prev => ({ ...prev, vehicleId: String(assignedVehicle.id) }))
      }
    }
  }, [vehicles, user?.id, formData.vehicleId, isNewRequestOpen])

  const handleCreateRequest = async () => {
    // Validar campos requeridos
    const missingFields: string[] = []
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) missingFields.push('Cantidad')
    if (!formData.reason) missingFields.push('Motivo del viaje')
    if (!formData.destinations) missingFields.push('Localidades a visitar')
    if (!formData.vehicleId) missingFields.push('Vehículo')
    
    if (missingFields.length > 0) {
      toast.error(`Complete los siguientes campos: ${missingFields.join(', ')}`)
      return
    }

    // Validar cantidad disponible
    const currentInventory = inventory.find(i => i.fuelType === formData.fuelType)
    const availableQuantity = currentInventory?.quantity || 0
    const requestedQuantity = parseFloat(formData.quantity)
    
    if (requestedQuantity > availableQuantity) {
      toast.error(`No hay suficiente ${formData.fuelType === 'GASOLINA' ? 'gasolina' : 'petróleo'} disponible. Máximo: ${availableQuantity.toFixed(2)} galones.`)
      // Auto-ajustar al máximo disponible
      setFormData(prev => ({ ...prev, quantity: availableQuantity.toFixed(2) }))
      return
    }

    setIsProcessing(true)
    try {
      const response = await apiFetch('/api/fuel-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          quantity: parseFloat(formData.quantity),
          vehicleId: parseInt(formData.vehicleId)
        })
      })

      if (response.ok) {
        const data = await response.json()
        addFuelRequest(data.fuelRequest)
        toast.success('Solicitud creada correctamente')
        setIsNewRequestOpen(false)
        resetForm()
        fetchData()
      } else {
        const data = await response.json()
        console.error('Error al crear fuel request:', data)
        const detailMsg = data.details?.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`).join(', ')
        toast.error(detailMsg ? `Datos inválidos: ${detailMsg}` : (data.error || 'Error al crear solicitud'))
      }
    } catch (error) {
      console.error('Error al crear request:', error)
      toast.error('Error al crear solicitud')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAuthorize = async (skipPin = false, requestOverride?: FuelRequest) => {
    const target = requestOverride || selectedRequest
    if (!target) return
    if (!skipPin && (!authorizationPin || authorizationPin.length !== 4)) {
      toast.error('Ingrese su PIN de 4 dígitos')
      return
    }

    setIsProcessing(true)
    try {
      const body: Record<string, unknown> = {
        id: target.id,
        action: 'authorize',
      }
      if (!skipPin) {
        body.pin = authorizationPin
      }

      const response = await apiFetch('/api/fuel-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        const data = await response.json()
        updateFuelRequest(target.id, data.fuelRequest)
        toast.success(skipPin
          ? 'Solicitud autorizada por Administrador correctamente'
          : 'Solicitud autorizada correctamente')
        setPinDialogOpen(false)
        setAuthorizationPin('')
        setRemainingAttempts(null)
        setIsLocked(false)
        setLockedMessage('')
        setViewRequestOpen(false)
        fetchData()
      } else {
        const data = await response.json()
        setAuthorizationPin('')
        if (data.locked) {
          setIsLocked(true)
          setLockedMessage(data.error || 'Cuenta bloqueada por demasiados intentos.')
          setRemainingAttempts(0)
        } else if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts)
          setIsLocked(false)
        }
        toast.error(data.error || 'Error al autorizar')
      }
    } catch (error) {
      console.error('Error al autorizar:', error)
      setAuthorizationPin('')
      toast.error('Error al autorizar')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectClick = () => {
    setRejectConfirmOpen(true)
  }

  const handleConfirmReject = async () => {
    if (!selectedRequest) return

    setIsProcessing(true)
    try {
      const response = await apiFetch('/api/fuel-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          action: 'reject'
        })
      })

      if (response.ok) {
        const data = await response.json()
        updateFuelRequest(selectedRequest.id, data.fuelRequest)
        toast.success('Solicitud rechazada')
        setViewRequestOpen(false)
        fetchData()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al rechazar')
      }
    } catch (error) {
      console.error('Error al rechazar:', error)
      toast.error('Error al rechazar')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleComplete = async () => {
    if (!selectedRequest) return

    setIsProcessing(true)
    try {
      const response = await apiFetch('/api/fuel-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          action: 'complete'
        })
      })

      if (response.ok) {
        const data = await response.json()
        updateFuelRequest(selectedRequest.id, data.fuelRequest)
        toast.success('Solicitud marcada como completada')
        setViewRequestOpen(false)
        fetchData()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al completar')
      }
    } catch (error) {
      console.error('Error al completar:', error)
      toast.error('Error al completar')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddFuel = async () => {
    if (!addFuelQuantity || parseFloat(addFuelQuantity) <= 0) {
      toast.error('Ingrese una cantidad válida')
      return
    }

    setIsProcessing(true)
    try {
      if (editingFuelEntry) {
        const response = await apiFetch(`/api/fuel-entries/${editingFuelEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fuelType: addFuelType,
            quantity: parseFloat(addFuelQuantity),
            supplier: addFuelSupplier || null,
            documentNumber: addFuelDocumentNumber || null,
            notes: addFuelNotes || null
          })
        })

        if (response.ok) {
          toast.success('Ingreso actualizado correctamente')
          setIsAddFuelOpen(false)
          resetAddFuelForm()
          fetchData()
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al actualizar ingreso')
        }
      } else {
        const response = await apiFetch('/api/fuel-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fuelType: addFuelType,
            quantity: parseFloat(addFuelQuantity),
            supplier: addFuelSupplier || null,
            documentNumber: addFuelDocumentNumber || null,
            notes: addFuelNotes || null
          })
        })

        if (response.ok) {
          const data = await response.json()
          toast.success(data.message || 'Combustible agregado al inventario')
          setIsAddFuelOpen(false)
          resetAddFuelForm()
          fetchData()
        } else {
          const data = await response.json()
          toast.error(data.error || 'Error al agregar combustible')
        }
      }
    } catch (error) {
      console.error('Error al agregar combustible:', error)
      toast.error('Error al agregar combustible')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrintVoucher = (fuelRequest: FuelRequest) => {
    const primaryColor = config?.primaryColor || '#1e40af'
    const institutionName = config?.institutionName || 'Almacén Institucional'
    
    const content = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; background: white;">
        <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:30px;border-bottom:3px solid ${primaryColor};padding-bottom:20px;">
          ${config?.logoUrl ? `<div style="flex-shrink:0;"><img src="${config.logoUrl}" style="height:60px;width:auto;object-fit:contain;" /></div>` : ''}
          <div style="flex:1;text-align:center;">
            <h1 style="color:${primaryColor};margin:0;font-size:24px;font-weight:bold;">${institutionName}</h1>
            <p style="color:#666;margin:2px 0;font-size:13px;font-style:italic;">${getCurrentYearDenomination()}</p>
            <h2 style="color:#374151;margin:10px 0 0 0;font-size:18px;">VALE DE COMBUSTIBLE</h2>
            <p style="color:#6b7280;margin:5px 0 0 0;font-size:14px;">N° ${escapeHtml(fuelRequest.requestNumber)}</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px;">
          <div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">Fecha de Solicitud</p>
            <p style="margin: 5px 0 0 0; font-weight: 600;">${new Date(fuelRequest.requestDate).toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">Tipo de Combustible</p>
            <p style="margin: 5px 0 0 0; font-weight: 600;">${fuelTypeLabels[fuelRequest.fuelType]}</p>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr style="background: ${primaryColor}15;">
              <td style="padding: 10px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Solicitante:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(fuelRequest.requestedBy.fullName)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Cargo:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(fuelRequest.requestedBy.position)}</td>
            </tr>
            <tr style="background: ${primaryColor}15;">
              <td style="padding: 10px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Vehículo:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(fuelRequest.vehicle.name)} - Placa: ${escapeHtml(fuelRequest.vehicle.plate)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Galones:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(String(fuelRequest.quantity))} galones</td>
            </tr>
            <tr style="background: ${primaryColor}15;">
              <td style="padding: 10px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Motivo del Viaje:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(fuelRequest.reason)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">Localidades a Visitar:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(fuelRequest.destinations)}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 40px;">
          <h3 style="font-size: 14px; margin-bottom: 15px; color: #374151; text-align: center;">FIRMAS DE AUTORIZACIÓN</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px 40px; max-width: 750px; margin: 0 auto;">
            ${fuelRequest.signatures.map((sig, _idx) => `
              <div style="text-align: center;">
                <p style="margin: 0 0 4px; font-size: 10px; color: #6b7280; font-weight: 600;">${escapeHtml(sig.position)}</p>
                <div style="height: 70px; margin: 8px 0; border-bottom: 2px solid #374151;"></div>
                <p style="margin: 0; font-size: 9px; color: #6b7280;">Firma / Sello</p>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 10px; color: #9ca3af;">${escapeHtml(config?.footerText || 'Ayacucho, Perú')}</p>
        </div>
      </div>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Vale de Combustible - ${escapeHtml(fuelRequest.requestNumber)}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                @page { margin: 1cm; }
              }
            </style>
          </head>
          <body>
            ${content}
            <script>
              window.onload = function() {
                window.print();
              }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const resetForm = () => {
    setFormData({
      fuelType: 'GASOLINA',
      quantity: '',
      reason: '',
      destinations: '',
      requestDate: new Date().toISOString().split('T')[0],
      vehicleId: ''
    })
  }

  const getStatusBadge = (status: FuelRequestStatus) => {
    const conf = statusConfig[status]
    const Icon = conf.icon
    return (
      <Badge className={conf.color}>
        <Icon className="h-3 w-3 mr-1" />
        {conf.label}
      </Badge>
    )
  }

  const isAdmin = user?.role === 'ADMINISTRADOR'
  const isAlmacenero = isAdmin || user?.role === 'ALMACENERO'
  const isJefeOficina = user?.role === 'JEFE_OFICINA'
  const canAuthorizeFuel = isAdmin || ((isAlmacenero || isJefeOficina) && user?.canAuthorizeFuel)
  const isDriverUser = user?.isDriver === true
  const isOnlyDriver = isDriverUser && user?.role !== 'ADMINISTRADOR' && user?.role !== 'ALMACENERO' && user?.role !== 'JEFE_OFICINA'
  const isDriver = isDriverUser || isAlmacenero || isJefeOficina

  const userVehicle = useMemo(() => vehicles.find(v => v.driverId === user?.id), [vehicles, user?.id])
  const driverHasVehicle = isDriverUser ? !!userVehicle : true
  const activeVehicles = useMemo(() => {
    let filtered = vehicles.filter(v => v.isActive)
    if (isOnlyDriver) {
      filtered = filtered.filter(v => v.driverId === user?.id)
    }
    return filtered
  }, [vehicles, isOnlyDriver, user?.id])
  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === parseInt(formData.vehicleId)), [vehicles, formData.vehicleId])

  const filteredRequests = useMemo(() => fuelRequests.filter(req => {
    const matchesSearch = normalizeText(req.requestNumber).includes(normalizeText(search)) ||
      normalizeText(req.requestedBy.fullName).includes(normalizeText(search))
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter
    return matchesSearch && matchesStatus
  }), [fuelRequests, search, statusFilter])

  const gasolineInventory = useMemo(() => inventory.find(i => i.fuelType === 'GASOLINA'), [inventory])
  const petroleumInventory = useMemo(() => inventory.find(i => i.fuelType === 'PETROLEO'), [inventory])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Fuel className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Gestión de Combustible
          </h1>
          <p className="text-muted-foreground">Control de vales de combustible e inventario</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToCSV(filteredRequests, [
              { key: 'requestNumber', label: 'Número' },
              { key: 'fuelType', label: 'Tipo' },
              { key: 'quantity', label: 'Galones' },
              { key: 'status', label: 'Estado' },
              { key: 'requestDate', label: 'Fecha' },
            ], `combustible-${new Date().toISOString().slice(0, 10)}`)}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToExcel(filteredRequests, [
              { key: 'requestNumber', label: 'Número' },
              { key: 'fuelType', label: 'Tipo' },
              { key: 'quantity', label: 'Galones' },
              { key: 'status', label: 'Estado' },
              { key: 'requestDate', label: 'Fecha' },
            ], `combustible-${new Date().toISOString().slice(0, 10)}`)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tarjetas de Inventario */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-green-600" />
                Gasolina
              </div>
            </CardTitle>
            {isAlmacenero && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setAddFuelType('GASOLINA')
                  setIsAddFuelOpen(true)
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{gasolineInventory?.quantity?.toFixed(2) || 0}</div>
            <p className="text-xs text-muted-foreground">galones disponibles</p>
            {(gasolineInventory?.quantity || 0) < (gasolineInventory?.minStock || 10) && (
              <div className="flex items-center gap-2 mt-2 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Stock bajo</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-amber-600" />
                Petróleo
              </div>
            </CardTitle>
            {isAlmacenero && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setAddFuelType('PETROLEO')
                  setIsAddFuelOpen(true)
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{petroleumInventory?.quantity?.toFixed(2) || 0}</div>
            <p className="text-xs text-muted-foreground">galones disponibles</p>
            {(petroleumInventory?.quantity || 0) < (petroleumInventory?.minStock || 10) && (
              <div className="flex items-center gap-2 mt-2 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Stock bajo</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial de ingresos de combustible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Historial de Ingresos</CardTitle>
          <CardDescription>Registro de ingresos de combustible al inventario</CardDescription>
        </CardHeader>
        <CardContent>
          {fuelEntries.length === 0 ? (
            <EmptyState
              icon={Droplets}
              title="Sin ingresos registrados"
              description="Los ingresos de combustible aparecerán aquí"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left font-medium py-2 px-3">N° Ingreso</th>
                    <th className="text-left font-medium py-2 px-3">Tipo</th>
                    <th className="text-right font-medium py-2 px-3">Cantidad</th>
                    <th className="text-left font-medium py-2 px-3">Proveedor</th>
                    <th className="text-left font-medium py-2 px-3">Documento</th>
                    <th className="text-left font-medium py-2 px-3">Registrado por</th>
                    <th className="text-left font-medium py-2 px-3">Fecha</th>
                    {isAlmacenero && <th className="text-right font-medium py-2 px-3">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {fuelEntries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-medium">{entry.entryNumber}</td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className={entry.fuelType === 'GASOLINA' ? 'text-green-600' : 'text-amber-600'}>
                          {fuelTypeLabels[entry.fuelType]}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right font-medium">{entry.quantity.toFixed(2)}</td>
                      <td className="py-2 px-3">{entry.supplier || '-'}</td>
                      <td className="py-2 px-3">{entry.documentNumber || '-'}</td>
                      <td className="py-2 px-3">{entry.receivedBy.fullName}</td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleDateString('es-PE')}
                      </td>
                      {isAlmacenero && (
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditFuelEntry(entry)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              if (!confirm('¿Está seguro de eliminar este ingreso? Esta acción ajustará el inventario.')) return
                              try {
                                const res = await apiFetch(`/api/fuel-entries/${entry.id}`, { method: 'DELETE' })
                                if (res.ok) {
                                  toast.success('Ingreso eliminado correctamente')
                                  fetchData()
                                } else {
                                  const err = await res.json()
                                  toast.error(err.error || 'Error al eliminar')
                                }
                              } catch {
                                toast.error('Error al eliminar ingreso')
                              }
                            }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>
          {canAuthorizeFuel && <TabsTrigger value="pendientes">Pendientes</TabsTrigger>}
        </TabsList>

        <TabsContent value="solicitudes" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número o solicitante..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="AUTORIZADO">Autorizado</SelectItem>
                  <SelectItem value="COMPLETADO">Completado</SelectItem>
                  <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {isDriver && (
              <Dialog open={isNewRequestOpen} onOpenChange={setIsNewRequestOpen}>
                <DialogTrigger asChild>
                  <Button style={{ backgroundColor: config?.primaryColor }} disabled={!driverHasVehicle}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Solicitud
                  </Button>
                </DialogTrigger>
                {!driverHasVehicle && (
                  <p className="text-xs text-orange-600 mt-1">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Debe tener un vehículo asignado para solicitar combustible
                  </p>
                )}
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Solicitar Combustible</DialogTitle>
                    <DialogDescription>
                      Complete los datos para el vale de combustible
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Combustible</Label>
                        <Select 
                          value={formData.fuelType} 
                          onValueChange={(value: FuelType) => setFormData({ ...formData, fuelType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GASOLINA">Gasolina</SelectItem>
                            <SelectItem value="PETROLEO">Petróleo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cantidad (galones) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          placeholder="0.00"
                          max={inventory.find(i => i.fuelType === formData.fuelType)?.quantity || 0}
                        />
                        <p className="text-xs text-muted-foreground">
                          Disponible: {(inventory.find(i => i.fuelType === formData.fuelType)?.quantity || 0).toFixed(2)} galones
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Vehículo *</Label>
                      <Select 
                        value={formData.vehicleId || (userVehicle ? String(userVehicle.id) : '')} 
                        onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione vehículo" />
                        </SelectTrigger>
                        <SelectContent>
                          {userVehicle && (
                            <SelectItem value={String(userVehicle.id)}>
                              {userVehicle.name} - {userVehicle.plate} (Mi vehículo)
                            </SelectItem>
                          )}
                          {/* Mostrar todos los vehículos activos disponibles */}
                          {activeVehicles
                            .filter(v => v.id !== userVehicle?.id)
                            .map(vehicle => (
                            <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                              {vehicle.name} - {vehicle.plate}
                              {vehicle.driver ? ` (${vehicle.driver.fullName})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {activeVehicles.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No hay vehículos activos registrados
                        </p>
                      )}
                    </div>

                    {/* Mostrar conductor automáticamente */}
                    {selectedVehicle?.driver && (
                      <div className="space-y-2">
                        <Label>Conductor Asignado</Label>
                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{selectedVehicle.driver.fullName}</p>
                            <p className="text-xs text-muted-foreground">{selectedVehicle.driver.position}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Fecha de Solicitud</Label>
                      <Input
                        type="date"
                        value={formData.requestDate}
                        onChange={(e) => setFormData({ ...formData, requestDate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Motivo del Viaje</Label>
                      <Textarea
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="Describa el motivo del viaje..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Localidades a Visitar</Label>
                      <Textarea
                        value={formData.destinations}
                        onChange={(e) => setFormData({ ...formData, destinations: e.target.value })}
                        placeholder="Ej: Huamanga, Huanta, San Miguel..."
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsNewRequestOpen(false)}>
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleCreateRequest}
                        style={{ backgroundColor: config?.primaryColor }}
                        disabled={isProcessing}
                      >
                        {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {isProcessing ? 'Guardando...' : 'Crear Solicitud'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Tabla de solicitudes */}
          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <ModuleSkeleton variant="table" />
              </CardContent>
            </Card>
          ) : filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <EmptyState icon={Fuel} title="No se encontraron solicitudes" />
              </CardContent>
            </Card>
          ) : (
            <ResponsiveTable<FuelRequest>
              columns={[
                { key: 'number', label: 'Número', render: (req) => (
                  <span className="font-mono font-medium">{req.requestNumber}</span>
                )},
                { key: 'requestor', label: 'Solicitante', render: (req) => (
                  <div>
                    <p className="font-medium">{req.requestedBy.fullName}</p>
                    <p className="text-xs text-muted-foreground">{req.vehicle?.name}</p>
                  </div>
                )},
                { key: 'type', label: 'Tipo', hideOnMobile: true, render: (req) => (
                  <Badge variant="outline">{fuelTypeLabels[req.fuelType]}</Badge>
                )},
                { key: 'quantity', label: 'Galones', render: (req) => (
                  <span>{req.quantity}</span>
                )},
                { key: 'status', label: 'Estado', render: (req) => getStatusBadge(req.status)},
                { key: 'date', label: 'Fecha', hideOnMobile: true, render: (req) => (
                  <span className="text-sm">{new Date(req.requestDate).toLocaleDateString('es-PE')}</span>
                )},
                { key: 'actions', label: '', hideOnMobile: true, className: 'text-right', render: (req) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedRequest(req)
                        setViewRequestOpen(true)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(req.status === 'AUTORIZADO' || req.status === 'COMPLETADO') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handlePrintVoucher(req); }}
                        title="Imprimir Vale"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )},
              ]}
              data={filteredRequests}
              keyExtractor={(req) => req.id}
            />
          )}
        </TabsContent>

        <TabsContent value="pendientes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes Pendientes de Autorización</CardTitle>
              <CardDescription>
                Revise y autorice las solicitudes de combustible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fuelRequests.filter(r => r.status === 'PENDIENTE').length === 0 ? (
                  <EmptyState icon={Clock} title="No hay solicitudes pendientes" />
                ) : (
                  fuelRequests.filter(r => r.status === 'PENDIENTE').map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{request.requestNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.requestedBy.fullName} - {fuelTypeLabels[request.fuelType]} - {request.quantity} galones
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Motivo: {request.reason}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => {
                            setSelectedRequest(request)
                            handleRejectClick()
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          style={{ backgroundColor: config?.primaryColor }}
                          onClick={() => {
                            setSelectedRequest(request)
                            if (user?.role === 'ADMINISTRADOR') {
                              handleAuthorize(true, request)
                            } else {
                               setRemainingAttempts(null); setIsLocked(false); setLockedMessage(''); setPinDialogOpen(true)
                            }
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {user?.role === 'ADMINISTRADOR' ? 'Autorizar (Admin)' : 'Autorizar'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo ver solicitud */}
      <Dialog open={viewRequestOpen} onOpenChange={setViewRequestOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vale de Combustible {selectedRequest?.requestNumber}</DialogTitle>
            <DialogDescription>
              Detalles de la solicitud
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Solicitante</p>
                  <p className="font-medium">{selectedRequest.requestedBy.fullName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cargo</p>
                  <p className="font-medium">{selectedRequest.requestedBy.position}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehículo</p>
                  <p className="font-medium">{selectedRequest.vehicle?.name} - {selectedRequest.vehicle?.plate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Combustible</p>
                  <p className="font-medium">{fuelTypeLabels[selectedRequest.fuelType]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cantidad</p>
                  <p className="font-medium">{selectedRequest.quantity} galones</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-medium">{new Date(selectedRequest.requestDate).toLocaleDateString('es-PE')}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Motivo del Viaje</p>
                <p className="font-medium">{selectedRequest.reason}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Localidades a Visitar</p>
                <p className="font-medium">{selectedRequest.destinations}</p>
              </div>

              {selectedRequest.signatures.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Firmas Requeridas</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedRequest.signatures.map((sig, idx) => (
                      <Badge key={idx} variant="outline">
                        {idx + 1}. {sig.position}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setViewRequestOpen(false)}>
                  Cerrar
                </Button>
                {selectedRequest.status === 'PENDIENTE' && canAuthorizeFuel && (
                  <>
                    <Button
                      variant="outline"
                      className="text-red-600"
                      onClick={handleRejectClick}
                    >
                      Rechazar
                    </Button>
                    <Button
                      style={{ backgroundColor: config?.primaryColor }}
                      onClick={() => {
                        const req = selectedRequest
                        setViewRequestOpen(false)
                        if (user?.role === 'ADMINISTRADOR' && req) {
                          handleAuthorize(true, req)
                        } else {
                          setPinDialogOpen(true)
                        }
                      }}
                    >
                      {user?.role === 'ADMINISTRADOR' ? 'Autorizar (Admin)' : 'Autorizar'}
                    </Button>
                  </>
                )}
                {selectedRequest.status === 'AUTORIZADO' && isAlmacenero && (
                  <Button
                    style={{ backgroundColor: config?.primaryColor }}
                    onClick={handleComplete}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Marcar Completado
                  </Button>
                )}
                {(selectedRequest.status === 'AUTORIZADO' || selectedRequest.status === 'COMPLETADO') && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handlePrintVoucher(selectedRequest)}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir Vale
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setSignedFile(null); setUploadSignedOpen(true) }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedRequest.signedPdfUrl ? 'Actualizar Vale Firmado' : 'Subir Vale Firmado'}
                    </Button>
                    {selectedRequest.signedPdfUrl && (
                      <DocumentViewerModal
                        url={selectedRequest.signedPdfUrl}
                        title={`Vale Firmado - ${selectedRequest.requestNumber}`}
                        fileName={`${selectedRequest.requestNumber}.pdf`}
                        trigger={
                          <Button variant="ghost" type="button">
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Firmado
                          </Button>
                        }
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo subir vale firmado */}
      <Dialog open={uploadSignedOpen} onOpenChange={(o) => { setUploadSignedOpen(o); if (!o) setSignedFile(null) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir Vale de Combustible Firmado</DialogTitle>
            <DialogDescription>
              Suba el vale de combustible debidamente firmado para {selectedRequest?.requestNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedRequest?.signedPdfUrl && (
              <DocumentViewerModal
                url={selectedRequest.signedPdfUrl}
                title={`Vale Firmado - ${selectedRequest.requestNumber}`}
                fileName={`${selectedRequest.requestNumber}.pdf`}
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
                if (!selectedRequest || !signedFile) return
                setIsUploadingSigned(true)
                try {
                  const formData = new FormData()
                  formData.append('file', signedFile)
                  const uploadRes = await apiFetch('/api/upload', { method: 'POST', body: formData })
                  if (!uploadRes.ok) { toast.error('Error al subir archivo'); setIsUploadingSigned(false); return }
                  const uploadData = await uploadRes.json()
                  const fileUrl = uploadData.url || `/api/files/${uploadData.filename}`
                  const updateRes = await apiFetch('/api/fuel-requests', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: selectedRequest.id, action: 'upload_signed_pdf', signedPdfUrl: fileUrl }),
                  })
                  if (updateRes.ok) {
                    const data = await updateRes.json()
                    toast.success('Vale firmado subido correctamente')
                    setUploadSignedOpen(false)
                    setSignedFile(null)
                    updateFuelRequest(selectedRequest.id, data.fuelRequest)
                  } else {
                    const data = await updateRes.json()
                    toast.error(data.error || 'Error al actualizar el vale')
                  }
                } catch {
                  toast.error('Error al subir el archivo')
                } finally {
                  setIsUploadingSigned(false)
                }
              }}
            >
              {isUploadingSigned ? 'Subiendo...' : 'Subir Vale Firmado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Agregar/Editar Combustible */}
      <Dialog open={isAddFuelOpen} onOpenChange={(open) => { if (!open) resetAddFuelForm(); setIsAddFuelOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFuelEntry ? 'Editar Ingreso de Combustible' : 'Agregar Combustible al Inventario'}</DialogTitle>
            <DialogDescription>
              {editingFuelEntry
                ? `Actualice los datos del ingreso ${editingFuelEntry.entryNumber}`
                : `Registre el ingreso de ${fuelTypeLabels[addFuelType]} al inventario`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Combustible</Label>
                <Select value={addFuelType} onValueChange={(value: FuelType) => setAddFuelType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GASOLINA">Gasolina</SelectItem>
                    <SelectItem value="PETROLEO">Petróleo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad (galones) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={addFuelQuantity}
                  onChange={(e) => setAddFuelQuantity(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input
                value={addFuelSupplier}
                onChange={(e) => setAddFuelSupplier(e.target.value)}
                placeholder="Nombre del proveedor (opcional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Número de Documento</Label>
              <Input
                value={addFuelDocumentNumber}
                onChange={(e) => setAddFuelDocumentNumber(e.target.value)}
                placeholder="Factura/Guía (opcional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={addFuelNotes}
                onChange={(e) => setAddFuelNotes(e.target.value)}
                placeholder="Notas adicionales (opcional)"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setIsAddFuelOpen(false); resetAddFuelForm(); }}>
                Cancelar
              </Button>
              <Button
                onClick={handleAddFuel}
                style={{ backgroundColor: config?.primaryColor }}
                disabled={isProcessing}
              >
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isProcessing ? 'Guardando...' : (editingFuelEntry ? 'Guardar Cambios' : 'Agregar')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={rejectConfirmOpen}
        onOpenChange={setRejectConfirmOpen}
        title="¿Rechazar solicitud?"
        description={`¿Está seguro de rechazar la solicitud ${selectedRequest?.requestNumber}?`}
        itemName={selectedRequest?.requestNumber || ''}
        onConfirm={handleConfirmReject}
        undoable={false}
      />

      {/* Diálogo PIN */}
      <Dialog open={pinDialogOpen} onOpenChange={(open) => { if (!open) { setPinDialogOpen(false); setAuthorizationPin(''); setRemainingAttempts(null); setIsLocked(false); setLockedMessage(''); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Autorización con PIN</DialogTitle>
            <DialogDescription>
              {user?.role === 'ADMINISTRADOR'
                ? 'Como Administrador, ingrese su PIN para autorizar en representación del personal autorizado'
                : 'Ingrese su PIN de 4 dígitos para autorizar'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>PIN de Autorización</Label>
              <Input
                type="password"
                maxLength={4}
                value={authorizationPin}
                onChange={(e) => setAuthorizationPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="****"
                className="text-center text-2xl tracking-widest"
              />
            </div>

            {isLocked ? (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-center">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{lockedMessage}</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  Contacte al administrador para desbloquear su cuenta.
                </p>
              </div>
            ) : remainingAttempts !== null && remainingAttempts <= 3 ? (
              <div className={`p-3 rounded-lg text-center ${remainingAttempts === 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                <p className={`text-sm font-medium ${remainingAttempts === 0 ? 'text-red-700 dark:text-red-400' : 'text-yellow-800 dark:text-yellow-300'}`}>
                  Intentos restantes: <span className="font-bold">{remainingAttempts}</span>
                </p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPinDialogOpen(false); setAuthorizationPin(''); setRemainingAttempts(null); setIsLocked(false); setLockedMessage(''); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => handleAuthorize()}
                style={{ backgroundColor: config?.primaryColor }}
                disabled={isProcessing || authorizationPin.length !== 4}
              >
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isProcessing ? 'Guardando...' : 'Autorizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
