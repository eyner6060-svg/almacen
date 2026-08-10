'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  CheckCircle, XCircle, Clock, UserCheck, PackageCheck, Check,
  Package, FileText, Download, FileUp, MapPin, Calendar,
  Upload, Shield, Signature, Eraser, Fingerprint, PenLine
} from 'lucide-react'
import type { Order, Item, User, SystemConfig } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { useOrdersStore } from '@/store'
import { DocumentViewerModal } from '@/components/ui/document-viewer-modal'
import { getCurrentYearDenomination } from '@/lib/year-denomination'
import { downloadOrderDeliveryDocx } from '@/lib/order-docx'
import { isDnieAvailable, signWithDnie, type DnieSignMethod } from '@/lib/dnie'
import { fetchUserSignature } from '@/lib/delivery-doc'

interface OrderAuthorizationPanelProps {
  order: Order
  user: User | null
  config: SystemConfig | null
  onActionComplete: () => void
  onDialogClose: () => void
  onOrderUpdated?: (order: Order) => void
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

export function OrderAuthorizationPanel({ order, user, config, onActionComplete, onDialogClose, onOrderUpdated }: OrderAuthorizationPanelProps) {
  const { updateOrder } = useOrdersStore()

  const [isProcessing, setIsProcessing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [uploadPdfDialogOpen, setUploadPdfDialogOpen] = useState(false)
  const [signedPdfFile, setSignedPdfFile] = useState<File | null>(null)
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [selectedOrderItem, setSelectedOrderItem] = useState<{ id: number; item: Item } | null>(null)
  const [returnLocation, setReturnLocation] = useState('')
  const [actualReturnDate, setActualReturnDate] = useState('')
  const [returnStatus, setReturnStatus] = useState('OPERATIVO')
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [authorizationPin, setAuthorizationPin] = useState('')
  const [authorizationAction, setAuthorizationAction] = useState<'jefe' | 'almacenero' | 'delivery' | null>(null)
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [lockedMessage, setLockedMessage] = useState('')
  const defaultReturnDays = 15
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [signMethod, setSignMethod] = useState<DnieSignMethod>('MANUSCRITA')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [dnieAvailable] = useState<boolean>(() => (typeof window !== 'undefined' ? isDnieAvailable() : false))

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    setHasSignature(true)
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    ctx.beginPath()
    ctx.moveTo(
      (clientX - rect.left) * (canvas.width / rect.width),
      (clientY - rect.top) * (canvas.height / rect.height)
    )
  }, [])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    ctx.lineTo(
      (clientX - rect.left) * (canvas.width / rect.width),
      (clientY - rect.top) * (canvas.height / rect.height)
    )
    ctx.strokeStyle = config?.primaryColor || '#1e40af'
    ctx.lineWidth = 2.5 * (canvas.width / rect.width)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }, [isDrawing, config])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearSignatureCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }, [])

  useEffect(() => {
    if (!signDialogOpen || !user || signMethod !== 'MANUSCRITA') return
    fetchUserSignature(user.id).then(sig => {
      if (!sig) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setHasSignature(true)
      }
      img.src = sig
    })
  }, [signDialogOpen, signMethod, user])

  const canAuthorizeJefe = () => {
    if (!order || !user) return false
    return (user.role === 'JEFE_OFICINA' || user.role === 'ADMINISTRADOR') &&
      order.status === 'PENDIENTE' &&
      (user.role === 'ADMINISTRADOR' || order.officeId === user.officeId)
  }

  const canAuthorizeAlmacenero = () => {
    if (!order || !user) return false
    return (user.role === 'ALMACENERO' || user.role === 'ADMINISTRADOR') &&
      order.status === 'AUTORIZADO_JEFE'
  }

  const canConfirmDelivery = () => {
    if (!order || !user) return false
    return (user.role === 'ALMACENERO' || user.role === 'ADMINISTRADOR') &&
      order.status === 'AUTORIZADO_ALMACENERO'
  }

  const canReject = () => {
    if (!order || !user) return false
    return (user.role === 'JEFE_OFICINA' && order.status === 'PENDIENTE' && order.officeId === user.officeId) ||
      (user.role === 'ALMACENERO' && order.status === 'AUTORIZADO_JEFE') ||
      user.role === 'ADMINISTRADOR'
  }

  const handleAuthorizationWithPin = async () => {
    if (!authorizationPin || authorizationPin.length !== 4) {
      toast.error('Ingrese su PIN de 4 dígitos')
      return
    }
    if (!order || !authorizationAction) return

    setIsProcessing(true)
    try {
      const requestBody: Record<string, unknown> = {
        action: authorizationAction === 'jefe' ? 'authorize_jefe' :
          authorizationAction === 'almacenero' ? 'authorize_almacenero' : 'confirm_delivery',
        pin: authorizationPin
      }

      if (authorizationAction === 'delivery' && expectedReturnDate) {
        requestBody.expectedReturnDate = expectedReturnDate
      }

      const response = await apiFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (response.ok) {
        updateOrder(order.id, data.order)
        onOrderUpdated?.(data.order)
        setPinDialogOpen(false)
        setAuthorizationPin('')
        setAuthorizationAction(null)
        setExpectedReturnDate('')
        setRemainingAttempts(null)
        setIsLocked(false)
        setLockedMessage('')

        if (authorizationAction === 'jefe') {
          toast.success('✓ Pedido autorizado con firma digital. Se ha notificado al almacén.')
        } else if (authorizationAction === 'almacenero') {
          toast.success('✓ Bienes preparados con firma digital. Listos para entrega.')
        } else {
          toast.success('✓ Entrega confirmada con firma digital. Stock actualizado.')
          setConfirmDialogOpen(false)
        }

        onDialogClose()
        onActionComplete()
      } else {
        setAuthorizationPin('')
        if (data.locked) {
          setIsLocked(true)
          setLockedMessage(data.error || 'Cuenta bloqueada por demasiados intentos.')
          setRemainingAttempts(0)
        } else if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts)
          setIsLocked(false)
        }
        toast.error(`[${response.status}] ${data.error || 'Error en la autorización'}${data.code ? ` (${data.code})` : ''}`)
      }
    } catch {
      setAuthorizationPin('')
      toast.error('Error al procesar la autorización')
    } finally {
      setIsProcessing(false)
    }
  }

  const openPinDialog = (action: 'jefe' | 'almacenero' | 'delivery') => {
    setAuthorizationAction(action)
    setAuthorizationPin('')
    setRemainingAttempts(null)
    setIsLocked(false)
    setLockedMessage('')
    if (action === 'delivery' && order?.items.some(oi => oi.item.itemType === 'PATRIMONIAL')) {
      const date = new Date()
      date.setDate(date.getDate() + defaultReturnDays)
      setExpectedReturnDate(date.toISOString().split('T')[0] ?? '')
    }
    setPinDialogOpen(true)
  }

  const handleReject = async () => {
    if (!order || !rejectReason.trim()) {
      toast.error('Ingrese el motivo del rechazo')
      return
    }

    setIsProcessing(true)
    try {
      const response = await apiFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'reject', notes: rejectReason }),
      })

      if (response.ok) {
        const data = await response.json()
        updateOrder(order.id, data.order)
        toast.success('Pedido rechazado')
        setRejectDialogOpen(false)
        setRejectReason('')
        onDialogClose()
        onActionComplete()
      }
    } catch {
      toast.error('Error al rechazar el pedido')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUploadSignedPdf = async () => {
    if (!signedPdfFile || !order) {
      toast.error('Seleccione un archivo PDF')
      return
    }

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('file', signedPdfFile)
      formData.append('type', 'signed_pdf')

      const response = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()

        const updateResponse = await apiFetch(`/api/orders/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            action: 'upload_signed_pdf',
            signedPdfUrl: data.url
          })
        })

        if (updateResponse.ok) {
          const updated = await updateResponse.json()
          toast.success('PDF firmado subido correctamente')
          setUploadPdfDialogOpen(false)
          setSignedPdfFile(null)
          if (updated.order) onOrderUpdated?.(updated.order)
          onActionComplete()
        } else {
          toast.error('Error al guardar el PDF')
        }
      } else {
        toast.error('Error al subir el archivo')
      }
    } catch {
      toast.error('Error al subir el PDF')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRegisterReturn = async () => {
    if (!selectedOrderItem || !order) return
    if (!returnLocation.trim() && !actualReturnDate) {
      toast.error('Ingrese la ubicación o la fecha de retorno')
      return
    }

    setIsProcessing(true)
    try {
      const response = await apiFetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'register_return',
          orderItemId: selectedOrderItem.id,
          currentLocation: returnLocation || null,
          actualReturnDate: actualReturnDate || null,
          status: returnStatus
        })
      })

      if (response.ok) {
        toast.success('Retorno registrado correctamente')
        setReturnDialogOpen(false)
        setReturnLocation('')
        setActualReturnDate('')
        setReturnStatus('OPERATIVO')
        onActionComplete()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al registrar retorno')
      }
    } catch {
      toast.error('Error al registrar retorno')
    } finally {
      setIsProcessing(false)
    }
  }

  const generatePdfContent = (order: Order, signature?: { dataUrl?: string; signerName: string; signedAt: string; method: DnieSignMethod }) => {
    const primaryColor = config?.primaryColor || '#1e40af'
    const institutionName = config?.institutionName || 'Almacén Institucional'
    const footerText = config?.footerText || 'Ayacucho, Perú'

    let logoSrc = ''
    if (config?.logoUrl) {
      if (config.logoUrl.startsWith('/')) {
        logoSrc = `${window.location.origin}${config.logoUrl}`
      } else {
        logoSrc = config.logoUrl
      }
    }

    const consumibles = order.items.filter(oi => oi.item.itemType === 'CONSUMIBLE')
    const patrimoniales = order.items.filter(oi => oi.item.itemType === 'PATRIMONIAL')

    return `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; background: white;">
        <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:30px;border-bottom:3px solid ${primaryColor};padding-bottom:20px;">
          <div style="flex-shrink:0;">
          ${logoSrc
        ? `<img src="${logoSrc}" alt="Logo" style="height:60px;width:auto;object-fit:contain;" onerror="this.style.display='none'" />`
        : `<div style="display:flex;align-items:center;justify-content:center;width:60px;height:60px;background:${primaryColor};border-radius:12px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>`
      }
          </div>
          <div style="flex:1;text-align:center;">
            <h1 style="color:${primaryColor};margin:0;font-size:24px;font-weight:bold;">${institutionName}</h1>
            <p style="color:#666;margin:2px 0;font-size:13px;font-style:italic;">${getCurrentYearDenomination()}</p>
            <h2 style="color:#374151;margin:10px 0 0 0;font-size:18px;">ORDEN DE SALIDA DE ALMACÉN</h2>
            <p style="color:#6b7280;margin:5px 0 0 0;font-size:14px;">N° ${escapeHtml(order.orderNumber)}</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px;">
          <div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">Fecha de Emisión</p>
            <p style="margin: 5px 0 0 0; font-weight: 600;">${new Date(order.createdAt).toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">Oficina</p>
            <p style="margin: 5px 0 0 0; font-weight: 600;">${escapeHtml(order.office.name)}</p>
          </div>
          <div>
            <p style="margin: 0; color: #6b7280; font-size: 12px;">Solicitante</p>
            <p style="margin: 5px 0 0 0; font-weight: 600;">${escapeHtml(order.requestedBy.fullName)}</p>
          </div>
        </div>

        ${consumibles.length > 0 ? `
          <div style="margin-bottom: 25px;">
            <h3 style="color: ${primaryColor}; font-size: 14px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb;">
              📦 BIENES CONSUMIBLES
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: ${primaryColor}15;">
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">N°</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">Nombre</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">Código</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">Marca/Modelo</th>
                  <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${primaryColor};">Unidad</th>
                  <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${primaryColor};">Cantidad</th>
                  <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${primaryColor};">Estado</th>
                </tr>
              </thead>
              <tbody>
                ${consumibles.map((oi, idx) => `
                  <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 8px;">${idx + 1}</td>
                    <td style="padding: 8px;">${escapeHtml(oi.item.name)}</td>
                    <td style="padding: 8px; font-family: monospace;">${escapeHtml(oi.item.code)}</td>
                    <td style="padding: 8px;">${escapeHtml(oi.item.brand)} / ${escapeHtml(oi.item.model)}</td>
                    <td style="padding: 8px; text-align: center;">${escapeHtml(oi.item.unit || 'UNIDAD')}</td>
                    <td style="padding: 8px; text-align: center; font-weight: 600;">${oi.quantity}</td>
                    <td style="padding: 8px; text-align: center;">${escapeHtml(oi.item.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${patrimoniales.length > 0 ? `
          <div style="margin-bottom: 25px;">
            <h3 style="color: ${primaryColor}; font-size: 14px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb;">
              🔐 BIENES PATRIMONIALES
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: ${primaryColor}15;">
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">N°</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">Nombre</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">Cód. Patrimonio</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid ${primaryColor};">Serie</th>
                  <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${primaryColor};">Unidad</th>
                  <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${primaryColor};">Cantidad</th>
                  <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${primaryColor};">Estado</th>
                  <th style="padding: 8px; text-align: center; border-bottom: 2px solid ${primaryColor};">Color</th>
                </tr>
              </thead>
              <tbody>
                ${patrimoniales.map((oi, idx) => {
      const unitStatus = oi.patrimonialUnit?.status || oi.item.status
      return `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                      <td style="padding: 8px;">${idx + 1}</td>
                      <td style="padding: 8px;">${escapeHtml(oi.item.name)}</td>
                      <td style="padding: 8px; font-family: monospace; font-size: 10px;">${escapeHtml(oi.item.patrimonialCode || oi.patrimonialCode || 'S/N')}</td>
                      <td style="padding: 8px;">${escapeHtml(oi.item.series || '-')}</td>
                      <td style="padding: 8px; text-align: center;">${escapeHtml(oi.item.unit || 'UNIDAD')}</td>
                      <td style="padding: 8px; text-align: center; font-weight: 600;">${oi.quantity}</td>
                      <td style="padding: 8px; text-align: center;">${escapeHtml(unitStatus)}</td>
                      <td style="padding: 8px; text-align: center;">${escapeHtml(oi.item.color || '-')}</td>
                    </tr>
                  `
    }).join('')}
              </tbody>
            </table>
            <p style="font-size: 11px; color: #6b7280; margin-top: 8px; font-style: italic;">
              * Los bienes patrimoniales deben ser retornados en un plazo máximo de 15 días.
            </p>
          </div>
        ` : ''}

        ${order.notes ? `
          <div style="margin-bottom: 25px; padding: 10px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 12px; color: #92400e;"><strong>Observaciones:</strong> ${escapeHtml(order.notes)}</p>
          </div>
        ` : ''}

        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
          <div style="text-align: center; width: 30%;">
            <p style="margin: 0; font-size: 11px; color: #6b7280;">SOLICITANTE</p>
            <div style="height: 50px; margin: 10px 0;"></div>
            <div style="border-top: 1px solid #374151; padding-top: 8px;">
              <p style="margin: 0; font-size: 11px; font-weight: 600;">${escapeHtml(order.requestedBy.fullName)}</p>
              <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${escapeHtml(order.requestedBy.position)}</p>
              <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">DNI: ${escapeHtml(order.requestedBy.dni)}</p>
            </div>
          </div>
          ${(() => {
            const jefeAuth = order.authorizations.find(a => a.role === 'JEFE_OFICINA' || a.role === 'ADMINISTRADOR')
            const almacenAuth = order.authorizations.find(a => a.role === 'ALMACENERO')
            const jefeIsAdmin = jefeAuth?.role === 'ADMINISTRADOR'
            const almacenIsAdmin = almacenAuth?.role === 'ADMINISTRADOR'
            return `
          <div style="text-align: center; width: 30%;">
            <p style="margin: 0; font-size: 11px; color: #6b7280;">JEFE DE OFICINA/ÁREA</p>
            <div style="height: 50px; margin: 10px 0;"></div>
            <div style="border-top: 1px solid #374151; padding-top: 8px;">
              ${jefeAuth ? `
                <p style="margin: 0; font-size: 11px; font-weight: 600;">✓ Autorizado digitalmente</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${escapeHtml(jefeAuth.user.fullName)}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${jefeIsAdmin ? 'Administrador (actuó en representación del Jefe de Oficina)' : 'Jefe de Oficina'}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${new Date(jefeAuth.authorizedAt).toLocaleDateString('es-PE')}</p>
              ` : `
                <p style="margin: 0; font-size: 11px;">___________________</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">Firma / PIN</p>
              `}
            </div>
          </div>
          <div style="text-align: center; width: 30%;">
            <p style="margin: 0; font-size: 11px; color: #6b7280;">ENCARGADO DE ALMACÉN</p>
            ${signature ? `
              <div style="height: 50px; margin: 10px 0; display:flex;align-items:center;justify-content:center;">
                ${signature.method === 'DNIE'
        ? `<div style="display:flex;align-items:center;gap:6px;color:#065f46;font-size:10px;font-weight:600;border:1px solid #a7f3d0;background:#ecfdf5;padding:4px 10px;border-radius:8px;">🔐 Firma DNIE (RENIEC)</div>`
        : `<img src="${signature.dataUrl}" alt="Firma" style="max-height:48px;max-width:120px;" />`}
              </div>
            ` : `<div style="height: 50px; margin: 10px 0;"></div>`}
            <div style="border-top: 1px solid #374151; padding-top: 8px;">
              ${signature ? `
                <p style="margin: 0; font-size: 11px; font-weight: 600;">✓ Firmado digitalmente</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${escapeHtml(signature.signerName)}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${signature.method === 'DNIE' ? 'DNI Electrónico (RENIEC)' : 'Firma manuscrita digitalizada'}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${new Date(signature.signedAt).toLocaleDateString('es-PE')} a las ${new Date(signature.signedAt).toLocaleTimeString('es-PE')}</p>
              ` : almacenAuth ? `
                <p style="margin: 0; font-size: 11px; font-weight: 600;">✓ Autorizado digitalmente</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${escapeHtml(almacenAuth.user.fullName)}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${almacenIsAdmin ? 'Administrador (actuó en representación del Almacenero)' : 'Almacenero'}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">${new Date(almacenAuth.authorizedAt).toLocaleDateString('es-PE')}</p>
              ` : `
                <p style="margin: 0; font-size: 11px;">___________________</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">Firma</p>
              `}
            </div>
          </div>`
          })()}
        </div>

        <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 10px; color: #9ca3af;">${footerText}</p>
          <p style="margin: 5px 0 0 0; font-size: 9px; color: #9ca3af;">Documento generado el ${new Date().toLocaleDateString('es-PE')} a las ${new Date().toLocaleTimeString('es-PE')}</p>
        </div>

        ${signature ? `
          <div style="margin-top: 15px; padding: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px;">
            <p style="margin: 0; font-size: 11px; color: #065f46; text-align: center;">
              ✓ Documento firmado digitalmente por <strong>${escapeHtml(signature.signerName)}</strong>
              el ${new Date(signature.signedAt).toLocaleDateString('es-PE')} a las ${new Date(signature.signedAt).toLocaleTimeString('es-PE')}
              ${signature.method === 'DNIE' ? 'mediante DNI Electrónico (RENIEC)' : 'mediante firma manuscrita digitalizada'}.
            </p>
          </div>
        ` : ''}
      </div>
    `
  }

  const handleDownloadWord = async () => {
    if (!order) return
    try {
      await downloadOrderDeliveryDocx(order, {
        institutionName: config?.institutionName,
        logoUrl: config?.logoUrl,
        primaryColor: config?.primaryColor,
      })
      toast.success('Documento Word generado correctamente')
    } catch {
      toast.error('Error al generar el documento Word')
    }
  }

  const openSignDialog = () => {
    setSignDialogOpen(true)
    setSignMethod('MANUSCRITA')
    setTimeout(() => clearSignatureCanvas(), 150)
  }

  const handleSignDocument = async () => {
    if (!order || !user) return

    let signatureData = ''
    let certData: string | undefined

    if (signMethod === 'MANUSCRITA') {
      if (!hasSignature) {
        toast.error('Dibuje su firma en el recuadro o use la opción de DNI Electrónico')
        return
      }
      const canvas = canvasRef.current
      if (!canvas) return
      signatureData = canvas.toDataURL('image/png')
    } else {
      try {
        toast.info('Firmando con su DNI Electrónico...')
        const payload = JSON.stringify({
          docType: 'ORDER',
          orderId: order.id,
          orderNumber: order.orderNumber,
          ts: Date.now(),
        })
        const result = await signWithDnie(payload)
        signatureData = `data:application/pkcs1;base64,${result.signatureBase64}`
        certData = result.certData
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al firmar con DNI Electrónico')
        return
      }
    }

    setIsSigning(true)
    try {
      const signedAt = new Date().toISOString()
      const content = generatePdfContent(order, {
        dataUrl: signMethod === 'MANUSCRITA' ? signatureData : undefined,
        signerName: user.fullName,
        signedAt,
        method: signMethod,
      })

      const response = await apiFetch(`/api/orders/${order.id}/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: content, signatureData, certData }),
      })

      if (response.ok) {
        const data = await response.json()
        setSignDialogOpen(false)
        setHasSignature(false)
        updateOrder(order.id, { ...order, signedPdfUrl: data.url, pdfUrl: data.url })
        onOrderUpdated?.({ ...order, signedPdfUrl: data.url, pdfUrl: data.url })
        toast.success(signMethod === 'DNIE'
          ? '✓ Documento firmado con DNI Electrónico y registrado.'
          : '✓ Documento firmado y registrado correctamente.')
        onActionComplete()
      } else {
        const data = await response.json()
        toast.error(`[${response.status}] ${data.error || 'Error al firmar el documento'}`)
      }
    } catch {
      toast.error('Error al firmar el documento')
    } finally {
      setIsSigning(false)
    }
  }

  const handlePrintPdf = () => {
    if (!order) return
    const content = generatePdfContent(order)
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Orden de Salida - ${escapeHtml(order.orderNumber)}</title>
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

  return (
    <>
      <div className="space-y-4">
        {canAuthorizeJefe() && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-800">Paso 1: Autorización como Jefe de Oficina</p>
                <p className="text-sm text-blue-600">Al autorizar, el pedido pasará al almacén para su preparación.</p>
                {user?.role === 'ADMINISTRADOR' && (
                  <p className="text-xs text-purple-600 mt-1">
                    ✦ Usted es Administrador — esta autorización se registrará como emitida en representación del Jefe de Oficina
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => openPinDialog('jefe')}
                  style={{ backgroundColor: config?.primaryColor }}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4 mr-2" />
                  )}
                  Autorizar
                </Button>
              </div>
            </div>
          </div>
        )}

        {canAuthorizeAlmacenero() && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-800">Paso 2: Preparar Bienes en Almacén</p>
                <p className="text-sm text-amber-600">Verifique que los bienes estén disponibles y listos para entregar.</p>
                {user?.role === 'ADMINISTRADOR' && (
                  <p className="text-xs text-purple-600 mt-1">
                    ✦ Usted es Administrador — esta autorización se registrará como emitida en representación del Almacenero
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => openPinDialog('almacenero')}
                  style={{ backgroundColor: config?.secondaryColor }}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PackageCheck className="h-4 w-4 mr-2" />
                  )}
                  Bienes Listos
                </Button>
              </div>
            </div>
          </div>
        )}

        {canConfirmDelivery() && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-800">Paso 3: Confirmar Entrega</p>
                <p className="text-sm text-green-600">Al confirmar se descontará el stock y se generará el comprobante PDF.</p>
                {user?.role === 'ADMINISTRADOR' && (
                  <p className="text-xs text-purple-600 mt-1">
                    ✦ Usted es Administrador — esta entrega se registrará como emitida en representación del Almacenero
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setConfirmDialogOpen(true)}
                  style={{ backgroundColor: config?.accentColor || '#f59e0b' }}
                  className="text-white"
                  disabled={isProcessing}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar Entrega
                </Button>
                <Button
                  variant="outline"
                  onClick={openSignDialog}
                  title="Firmar el documento de salida digitalmente"
                >
                  <Signature className="h-4 w-4 mr-2" />
                  Firmar Documento
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrintPdf}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Vista Previa PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadWord}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Descargar Word
                </Button>
              </div>
            </div>
          </div>
        )}

        {canReject() && (
          <Button
            variant="destructive"
            onClick={() => setRejectDialogOpen(true)}
            disabled={isProcessing}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Rechazar Pedido
          </Button>
        )}

        {order.status === 'COMPLETADO' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrintPdf}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadWord}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                Descargar Word (.docx)
              </Button>
              {(user?.role === 'ALMACENERO' || user?.role === 'ADMINISTRADOR') && (
                <>
                  <Button
                    onClick={openSignDialog}
                    style={{ backgroundColor: config?.primaryColor }}
                    className="text-white flex-1"
                  >
                    <Signature className="h-4 w-4 mr-2" />
                    Firmar Documento
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setUploadPdfDialogOpen(true)}
                    className="flex-1"
                  >
                    <FileUp className="h-4 w-4 mr-2" />
                    Subir PDF Firmado
                  </Button>
                </>
              )}
            </div>

            {order.signedPdfUrl && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-800">PDF firmado registrado</span>
                <div className="ml-auto">
                  <DocumentViewerModal
                    url={order.signedPdfUrl}
                    title={`PDF Firmado - ${order.orderNumber}`}
                    variant="text"
                    buttonText="Ver documento"
                  />
                </div>
              </div>
            )}

            {(user?.role === 'ALMACENERO' || user?.role === 'ADMINISTRADOR') && order.items.some(oi => oi.item.itemType === 'PATRIMONIAL') && (
              <div className="mt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Control de Bienes Patrimoniales
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table responsiveCards>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Bien</TableHead>
                        <TableHead hideOnMobile>Código</TableHead>
                        <TableHead>Estado UNIDAD</TableHead>
                        <TableHead hideOnMobile>Ubicación</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items
                        .filter(oi => oi.item.itemType === 'PATRIMONIAL')
                        .map((oi) => {
                          const issueDate = oi.issueDate ? new Date(oi.issueDate) : null
                          const daysSinceIssue = issueDate ? Math.floor((Date.now() - issueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
                          const isOverdue = daysSinceIssue > 15 && !oi.actualReturnDate

                          return (
                            <TableRow key={oi.id} className={isOverdue ? 'bg-red-50' : ''}>
                              <TableCell>
                                <p className="font-medium">{oi.item.name}</p>
                                <p className="text-xs text-muted-foreground">{oi.item.color || 'Sin color'}</p>
                              </TableCell>
                              <TableCell hideOnMobile className="font-mono text-sm">
                                {oi.item.patrimonialCode || 'S/N'}
                                {oi.patrimonialUnit && (
                                  <p className="text-xs mt-1">
                                    <Badge variant={oi.patrimonialUnit.status === 'OPERATIVO' ? 'outline' : 'destructive'} className="text-[10px] px-1 py-0">
                                      {oi.patrimonialUnit.status}
                                    </Badge>
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                {oi.actualReturnDate ? (
                                  <Badge className="bg-green-100 text-green-800">Retornado</Badge>
                                ) : isOverdue ? (
                                  <Badge variant="destructive">Vencido ({daysSinceIssue} días)</Badge>
                                ) : (
                                  <Badge variant="secondary">En uso ({daysSinceIssue} días)</Badge>
                                )}
                              </TableCell>
                              <TableCell hideOnMobile className="text-sm">{oi.currentLocation || '-'}</TableCell>
                              <TableCell>
                                {!oi.actualReturnDate && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedOrderItem({ id: oi.id, item: oi.item })
                                      setReturnDialogOpen(true)
                                    }}
                                  >
                                    <MapPin className="h-3 w-3 mr-1" />
                                    Registrar
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diálogo de confirmación de entrega */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Confirmar Entrega de Bienes
            </DialogTitle>
            <DialogDescription>
              Al confirmar, se descontará el stock del inventario y se generará automáticamente el comprobante de salida.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">Pedido: {order.orderNumber}</p>
              <p className="text-sm text-muted-foreground">
                {order.items.length} items para {order.office.name}
              </p>
              <div className="mt-2 text-sm">
                <p><strong>Solicitante:</strong> {order.requestedBy.fullName}</p>
              </div>
            </div>

            {order.items.some(oi => oi.item.itemType === 'PATRIMONIAL') && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Bienes Patrimoniales - Fecha de Retorno</span>
                </div>
                <p className="text-sm text-amber-700">
                  Los bienes patrimoniales deben ser retornados en un plazo máximo.
                  Ingrese la fecha límite de retorno:
                </p>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Fecha de retorno esperada:</Label>
                  <Input
                    type="date"
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="flex-1"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const date = new Date()
                      date.setDate(date.getDate() + defaultReturnDays)
                      setExpectedReturnDate(date.toISOString().split('T')[0] ?? '')
                    }}
                  >
                    {defaultReturnDays} días (por defecto)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const date = new Date()
                      date.setDate(date.getDate() + 7)
                      setExpectedReturnDate(date.toISOString().split('T')[0] ?? '')
                    }}
                  >
                    7 días
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const date = new Date()
                      date.setDate(date.getDate() + 30)
                      setExpectedReturnDate(date.toISOString().split('T')[0] ?? '')
                    }}
                  >
                    30 días
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => { setConfirmDialogOpen(false); setTimeout(() => openPinDialog('delivery'), 150) }}
                style={{ backgroundColor: config?.accentColor || '#f59e0b' }}
                className="text-white"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar Entrega
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de rechazo */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rechazar Pedido</DialogTitle>
            <DialogDescription>
              Ingrese el motivo del rechazo. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo del rechazo..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isProcessing || !rejectReason.trim()}
              >
                {isProcessing ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Rechazar Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de subida de PDF firmado */}
      <Dialog open={uploadPdfDialogOpen} onOpenChange={setUploadPdfDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Subir PDF Firmado
            </DialogTitle>
            <DialogDescription>
              Suba el documento de salida de almacén con las firmas correspondientes para el control documentario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setSignedPdfFile(e.target.files?.[0] || null)}
                className="hidden"
                id="signed-pdf-upload"
              />
              <label htmlFor="signed-pdf-upload" className="cursor-pointer">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                {signedPdfFile ? (
                  <p className="text-sm font-medium">{signedPdfFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click para seleccionar archivo PDF</p>
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setUploadPdfDialogOpen(false); setSignedPdfFile(null) }}>
                Cancelar
              </Button>
              <Button
                onClick={handleUploadSignedPdf}
                style={{ backgroundColor: config?.primaryColor }}
                className="text-white"
                disabled={isProcessing || !signedPdfFile}
              >
                {isProcessing ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Subir PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de firma del documento de salida */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Signature className="h-5 w-5" style={{ color: config?.primaryColor }} />
              Firmar Documento de Salida
            </DialogTitle>
            <DialogDescription>
              Firme el documento {order?.orderNumber} para el control documentario. La firma quedará
              registrada y vinculada al pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSignMethod('MANUSCRITA')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                  signMethod === 'MANUSCRITA'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <PenLine className="h-4 w-4" />
                Firma Manuscrita
              </button>
              <button
                type="button"
                onClick={() => setSignMethod('DNIE')}
                className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                  signMethod === 'DNIE'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <Fingerprint className="h-4 w-4" />
                DNI Electrónico
              </button>
            </div>

            {signMethod === 'MANUSCRITA' ? (
              <div className="space-y-2">
                <div className="border rounded-lg overflow-hidden relative bg-white">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-48 touch-none cursor-crosshair"
                    width={800}
                    height={300}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={(e) => { startDrawing(e); e.preventDefault() }}
                    onTouchMove={(e) => { draw(e); e.preventDefault() }}
                    onTouchEnd={stopDrawing}
                  />
                  {!hasSignature && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                      Dibuje su firma aquí
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSignatureCanvas}
                  >
                    <Eraser className="h-4 w-4 mr-2" />
                    Limpiar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                <div className="flex items-center gap-2 text-green-700">
                  <Fingerprint className="h-5 w-5" />
                  <span className="font-medium">Firma con DNI Electrónico (RENIEC)</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  La firma se realizará con el certificado digital de firma del titular del DNIE.
                  Para usarla, inserte su DNI Electrónico en el lector y asegúrese de tener
                  instalado el middleware de RENIEC y el puente de firma del sistema.
                </p>
                {dnieAvailable ? (
                  <p className="text-xs text-green-700 font-medium">✓ DNI Electrónico detectado.</p>
                ) : (
                  <p className="text-xs text-amber-700">
                    ⚠ No se detectó el middleware del DNIE. Si no está disponible, use la firma manuscrita.
                  </p>
                )}
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Firmará como:</span>
              <span className="font-medium">{user?.fullName} {user?.dni ? `(DNI: ${user.dni})` : ''}</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSignDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSignDocument}
                style={{ backgroundColor: config?.primaryColor }}
                className="text-white"
                disabled={isSigning || (signMethod === 'MANUSCRITA' && !hasSignature)}
              >
                {isSigning ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Signature className="h-4 w-4 mr-2" />
                )}
                Firmar y Guardar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de registro de devolución */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Registrar Información del Bien Patrimonial
            </DialogTitle>
            <DialogDescription>
              Registre la ubicación actual del bien o la fecha de retorno si ya fue devuelto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedOrderItem && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedOrderItem.item.name}</p>
                <p className="text-sm text-muted-foreground">
                  Código: {selectedOrderItem.item.patrimonialCode || 'S/N'}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Ubicación Actual del Bien</Label>
              <Textarea
                value={returnLocation}
                onChange={(e) => setReturnLocation(e.target.value)}
                placeholder="Ej: Oficina de Sistemas, escritorio del Ing. Juan Pérez..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Ingrese la ubicación si el bien no ha sido retornado al almacén.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Fecha de Retorno (si aplica)</Label>
              <Input
                type="date"
                value={actualReturnDate}
                onChange={(e) => setActualReturnDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ingrese la fecha si el bien ya fue devuelto al almacén.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Estado del Bien al Retornar</Label>
              <select
                value={returnStatus}
                onChange={(e) => setReturnStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="OPERATIVO">OPERATIVO</option>
                <option value="AVERIADO">AVERIADO</option>
                <option value="OBSOLETO">OBSOLETO</option>
                <option value="EN_MANTENIMIENTO">EN MANTENIMIENTO</option>
                <option value="PERDIDO">PERDIDO</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Seleccione el estado en que se recibió el bien.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setReturnDialogOpen(false); setReturnLocation(''); setActualReturnDate('') }}>
                Cancelar
              </Button>
              <Button
                onClick={handleRegisterReturn}
                style={{ backgroundColor: config?.primaryColor }}
                className="text-white"
                disabled={isProcessing || (!returnLocation.trim() && !actualReturnDate)}
              >
                {isProcessing ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de autorización PIN */}
      <Dialog open={pinDialogOpen} onOpenChange={(open) => { if (!open) { setPinDialogOpen(false); setAuthorizationPin(''); setRemainingAttempts(null); setIsLocked(false); setLockedMessage(''); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Autorización Digital
            </DialogTitle>
            <DialogDescription>
              Ingrese su PIN de 4 dígitos para firmar digitalmente esta autorización.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">Acción a autorizar:</p>
              <p className="font-medium">
                {authorizationAction === 'jefe' && (user?.role === 'ADMINISTRADOR'
                  ? 'Autorizar pedido como Administrador (en representación del Jefe de Oficina)'
                  : 'Autorizar pedido como Jefe de Oficina')}
                {authorizationAction === 'almacenero' && (user?.role === 'ADMINISTRADOR'
                  ? 'Preparar bienes como Administrador (en representación del Almacenero)'
                  : 'Preparar bienes en almacén')}
                {authorizationAction === 'delivery' && (user?.role === 'ADMINISTRADOR'
                  ? 'Confirmar entrega como Administrador (en representación del Almacenero)'
                  : 'Confirmar entrega de bienes')}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-center block">PIN de Autorización</Label>
              <Input
                type="password"
                maxLength={4}
                value={authorizationPin}
                onChange={(e) => setAuthorizationPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="text-center text-2xl tracking-[1em] h-14 font-mono"
              />
              <p className="text-xs text-center text-muted-foreground">
                Ingrese los 4 dígitos de su PIN personal
              </p>
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setPinDialogOpen(false); setAuthorizationPin(''); setRemainingAttempts(null); setIsLocked(false); setLockedMessage(''); }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleAuthorizationWithPin}
                style={{ backgroundColor: config?.primaryColor }}
                disabled={isProcessing || authorizationPin.length !== 4}
              >
                {isProcessing ? (
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Firmar y Autorizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
