'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useConfigStore, useAuthStore } from '@/store'
import Image from 'next/image'
import {
  PenTool,
  RefreshCw,
  CheckCircle2,
  Clock,
  FileText,
  User,
  Download,
  Save,
  RotateCcw,
  Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'

interface Signature {
  id: number
  documentType: string
  documentId: number
  userId: number
  signatureData: string
  signedAt: string
  ipAddress: string | null
  userAgent: string | null
  user: {
    id: number
    fullName: string
    email: string
    role: string
  }
}

interface DocumentToSign {
  id: number
  type: string
  typeLabel: string
  number: string
  status: string
  createdAt: string
  requiresSignature: boolean
  signedAt: string | null
  signatureId: number | null
}

export function FirmaDigitalModule() {
  const { config } = useConfigStore()
  const { user } = useAuthStore()
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [documents, setDocuments] = useState<DocumentToSign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<DocumentToSign | null>(null)
  const [documentType, setDocumentType] = useState<string>('all')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const signaturesResponse = await apiFetch('/api/digital-signatures')
      if (signaturesResponse.ok) {
        const data = await signaturesResponse.json()
        setSignatures(data.signatures || [])
      }

      // Obtener documentos pendientes de firma
      // En producción, esto obtendría datos de endpoints reales
      setDocuments([
        { id: 1, type: 'ORDER', typeLabel: 'Pedido', number: 'PED-2024-001', status: 'PENDIENTE', createdAt: new Date().toISOString(), requiresSignature: true, signedAt: null, signatureId: null },
        { id: 2, type: 'FUEL_REQUEST', typeLabel: 'Solicitud de Combustible', number: 'COMB-2024-005', status: 'AUTORIZADO', createdAt: new Date().toISOString(), requiresSignature: true, signedAt: null, signatureId: null },
      ])
    } catch (error) {
      console.error('Error al obtener data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Funciones de dibujo en canvas
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
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
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

    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.strokeStyle = '#1e40af'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }, [isDrawing])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }, [])

  const saveSignature = async () => {
    if (!selectedDocument || !hasSignature) {
      toast.error('Firma requerida')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const signatureData = canvas.toDataURL('image/png')

      const response = await apiFetch('/api/digital-signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: selectedDocument.type,
          documentId: selectedDocument.id,
          signatureData
        })
      })

      if (response.ok) {
        toast.success('Firma guardada exitosamente')
        setSignDialogOpen(false)
        clearCanvas()
        fetchData()
      } else {
        toast.error('Error al guardar firma')
      }
    } catch (error) {
      console.error('Error al guardar firma:', error)
      toast.error('Error de conexión')
    }
  }

  const openSignDialog = (doc: DocumentToSign) => {
    if (doc.signedAt || doc.signatureId) {
      if (!confirm('Este documento ya tiene una firma registrada. ¿Desea reemplazarla con una nueva firma?')) return
    }
    setSelectedDocument(doc)
    setSignDialogOpen(true)
    setTimeout(clearCanvas, 100)
  }

  const handleDeleteSignature = async () => {
    if (deleteConfirmId === null) return
    setIsDeleting(true)
    try {
      const response = await apiFetch(`/api/digital-signatures/${deleteConfirmId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        toast.success('Firma eliminada correctamente')
        setSignatures(prev => prev.filter(s => s.id !== deleteConfirmId))
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al eliminar firma')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  const filteredDocuments = documents.filter(doc => 
    documentType === 'all' || doc.type === documentType
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Firma Digital</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PenTool className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Firma Digital
          </h1>
          <p className="text-muted-foreground">
            Gestión de firmas digitales para documentos
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            <FileText className="h-4 w-4 mr-2" />
            Pendientes de Firma
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="h-4 w-4 mr-2" />
            Historial de Firmas
          </TabsTrigger>
        </TabsList>

        {/* Documentos Pendientes */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Documentos Pendientes</CardTitle>
                  <CardDescription>
                    Documentos que requieren su firma
                  </CardDescription>
                </div>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ORDER">Pedidos</SelectItem>
                    <SelectItem value="FUEL_REQUEST">Combustible</SelectItem>
                    <SelectItem value="PATRIMONIAL_EXIT">Salida Patrimonial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length > 0 ? (
                <div className="space-y-3">
                  {filteredDocuments.map((doc) => {
                    const isSigned = !!(doc.signedAt || doc.signatureId)
                    return (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5" style={{ color: config?.primaryColor }} />
                        </div>
                        <div>
                          <p className="font-medium">{doc.typeLabel}</p>
                          <p className="text-sm text-muted-foreground">{doc.number}</p>
                          {isSigned && (
                            <p className="text-xs text-green-600 font-medium mt-0.5">
                              <CheckCircle2 className="h-3 w-3 inline mr-0.5" />
                              Firmado
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge variant="outline">{doc.status}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                        <Button variant={isSigned ? 'outline' : 'default'} onClick={() => openSignDialog(doc)}>
                          <PenTool className="h-4 w-4 mr-2" />
                          {isSigned ? 'Resellar' : 'Firmar'}
                        </Button>
                      </div>
                    </div>
                  )})}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay documentos pendientes de firma</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historial de firmas */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Firmas</CardTitle>
              <CardDescription>
                Registro de todas las firmas realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {signatures.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {signatures.map((sig) => (
                      <div key={sig.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-32 border rounded bg-white flex items-center justify-center">
                            <Image 
                              src={sig.signatureData} 
                              alt="Firma" 
                              className="max-h-full max-w-full object-contain"
                              width={128}
                              height={64}
                            />
                          </div>
                          <div>
                            <p className="font-medium">
                              {sig.documentType === 'ORDER' ? 'Pedido' : 
                               sig.documentType === 'FUEL_REQUEST' ? 'Solicitud de Combustible' : 
                               'Salida Patrimonial'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <User className="h-3 w-3 inline mr-1" />
                              {sig.user.fullName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(sig.signedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            Descargar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => setDeleteConfirmId(sig.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Eliminar
                          </Button>
                          <Badge className="bg-green-500 text-white">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Válida
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <PenTool className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay firmas registradas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de firma */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Firmar Documento</DialogTitle>
            <DialogDescription>
              {selectedDocument?.typeLabel} - {selectedDocument?.number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Firma Digital</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Dibuje su firma en el área below
              </p>
              <div className="border rounded-lg p-2 bg-white">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full border border-dashed rounded cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <div className="flex justify-end mt-2">
                <Button variant="outline" size="sm" onClick={clearCanvas}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              </div>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium">Información de la Firma</p>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p><User className="h-3 w-3 inline mr-1" />{user?.fullName}</p>
                <p><Clock className="h-3 w-3 inline mr-1" />{format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveSignature} disabled={!hasSignature}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Firma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tarjeta de instrucciones */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <PenTool className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Sobre la Firma Digital</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Las firmas digitales tienen validez legal según la legislación vigente</li>
                <li>Se registra la dirección IP y fecha/hora de cada firma</li>
                <li>Las firmas son inmutables una vez guardadas</li>
                <li>Consulte con el área legal para mayor información</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmar Eliminación */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar Firma</DialogTitle>
            <DialogDescription>
              ¿Está seguro de eliminar esta firma digital? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteSignature} disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
