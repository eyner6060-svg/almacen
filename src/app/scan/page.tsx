'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useConfigStore, useAuthStore } from '@/store'
import {
  QrCode,
  Camera,
  MapPin,
  Package,
  User,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'
import { format } from 'date-fns'
import type { Item } from '@/types'

export default function ScanPage() {
  const { config } = useConfigStore()
  const { user } = useAuthStore()
  
  const [scannedCode, setScannedCode] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [item, setItem] = useState<Item | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<Array<{ code: string; item: Item | null; timestamp: Date }>>([])
  
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Obtener geolocalización
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
          setLocationError(null)
        },
        (error) => {
          console.error('Error de geolocalización:', error)
          setLocationError('No se pudo obtener la ubicación')
        },
        { enableHighAccuracy: true }
      )
    }

    // Enfocar input al montar
    inputRef.current?.focus()
  }, [])

  const handleScan = async (code: string) => {
    if (!code.trim()) return

    setIsLoading(true)
    setScannedCode(code)
    
    try {
      // Registrar el escaneo
      await fetch('/api/traceability/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          scanType: 'ITEM',
          latitude: location?.latitude,
          longitude: location?.longitude,
          deviceInfo: navigator.userAgent,
        }),
      })

      // Obtener detalles del bien
      const response = await fetch(`/api/items?search=${encodeURIComponent(code)}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.items && data.items.length > 0) {
          const foundItem = data.items.find((i: Item) => 
            i.code === code || i.patrimonialCode === code ||
            (i.patrimonialCodes && (() => { try { return JSON.parse(i.patrimonialCodes).includes(code) } catch { return false } })())
          )
          setItem(foundItem || data.items[0])
          setScanHistory(prev => [{
            code,
            item: foundItem || data.items[0],
            timestamp: new Date(),
          }, ...prev.slice(0, 9)])
        } else {
          setItem(null)
          toast.error('No se encontró ningún bien con este código')
        }
      }
    } catch (error) {
      console.error('Error al escanear:', error)
      toast.error('Error al procesar el escaneo')
    } finally {
      setIsLoading(false)
      setManualCode('')
      inputRef.current?.focus()
    }
  }

  const handleManualSearch = () => {
    if (manualCode.trim()) {
      handleScan(manualCode.trim())
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Encabezado */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Escanear QR</h1>
            <p className="text-sm text-muted-foreground">Escanea o ingresa un código</p>
          </div>
        </div>

        {/* Estado de ubicación */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${location ? 'bg-green-100' : 'bg-amber-100'}`}>
                <MapPin className={`h-5 w-5 ${location ? 'text-green-600' : 'text-amber-600'}`} />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {location ? 'Ubicación activa' : 'Ubicación no disponible'}
                </p>
                {location ? (
                  <p className="text-xs text-muted-foreground">
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{locationError}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Área de escaneo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Escanear Código</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Entrada manual */}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ingresa el código manualmente..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
              />
              <Button onClick={handleManualSearch} disabled={isLoading || !manualCode.trim()}>
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Espacio para cámara - integraría con API de cámara real */}
            <div className="aspect-square bg-black rounded-lg flex flex-col items-center justify-center text-white">
              <Camera className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-sm opacity-70">Cámara QR</p>
              <p className="text-xs opacity-50 mt-1">Apunta al código QR del bien</p>
            </div>
          </CardContent>
        </Card>

        {/* Bien escaneado */}
        {scannedCode && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Bien Escaneado</CardTitle>
                <Badge variant="outline">{scannedCode}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {item ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config?.primaryColor}20` }}>
                      <Package className="h-6 w-6" style={{ color: config?.primaryColor }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.code}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Categoría</p>
                      <p className="font-medium">{item.category}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tipo</p>
                      <p className="font-medium">{item.itemType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stock</p>
                      <p className={`font-medium ${item.quantity < item.minStock ? 'text-red-500' : ''}`}>
                        {item.quantity} {item.quantity < item.minStock && <AlertTriangle className="inline h-4 w-4" />}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estado</p>
                      <Badge variant={item.status === 'OPERATIVO' ? 'default' : 'secondary'}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                  
                  {item.warehouse && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Ubicación</p>
                      <p className="font-medium">{item.warehouse.name}</p>
                      <p className="text-sm text-muted-foreground">{item.warehouse.location}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No se encontró información del bien</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Historial de escaneos */}
        {scanHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Historial de Escaneos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scanHistory.map((scan, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                    <QrCode className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{scan.item?.name || 'No encontrado'}</p>
                      <p className="text-xs text-muted-foreground">{scan.code}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(scan.timestamp, 'HH:mm')}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información del usuario */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">{user?.position}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
