'use client'

import { useRef, useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfigStore, useThemeStore } from '@/store'
import { 
  Download, QrCode, Printer, Copy, Check, 
  Barcode, X, Tags, FileDown
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

interface QRData {
  patrimonialCode: string
  name: string
  brand: string
  model: string
  location: string
  warehouse?: string
  status?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: QRData | null
  multipleCodes?: QRData[]
}

export function QRCodeGenerator({ open, onOpenChange, data, multipleCodes = [] }: Props) {
  const { config } = useConfigStore()
  const { isDarkMode } = useThemeStore()
  const primaryColor = config?.primaryColor || '#1e40af'
  
  const [copied, setCopied] = useState(false)
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'CODE39'>('CODE128')
  const [qrSize, setQrSize] = useState(250)
  const [viewMode, setViewMode] = useState<'qr' | 'barcode' | 'both'>('both')
  const [currentIndex, setCurrentIndex] = useState(0)
  const prevOpenRef = useRef(open)

  const items = multipleCodes.length > 0 ? multipleCodes : (data ? [data] : [])
  const currentItem = items[currentIndex] || items[0]

  // Actualizar ref cuando cambia open
  useEffect(() => {
    prevOpenRef.current = open
  }, [open])

  // Generar el contenido del QR como JSON
  const generateQRContent = (item: QRData): string => {
    return JSON.stringify({
      codigoPatrimonial: item.patrimonialCode,
      nombre: item.name,
      marca: item.brand,
      modelo: item.model,
      ubicacion: item.location,
      almacen: item.warehouse,
      estado: item.status
    })
  }

  // Generar contenido como texto legible
  const generateReadableContent = (item: QRData): string => {
    return [
      `Código: ${item.patrimonialCode}`,
      `Nombre: ${item.name}`,
      `Marca: ${item.brand}`,
      `Modelo: ${item.model}`,
      `Ubicación: ${item.location || 'No especificada'}`
    ].join('\n')
  }

  // Generar código de barras
  const generateBarcode = (item: QRData, format: string = 'CODE128') => {
    try {
      const canvas = document.createElement('canvas')
      JsBarcode(canvas, item.patrimonialCode, {
        format: format,
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 8,
        background: isDarkMode ? '#27272a' : '#ffffff',
        lineColor: isDarkMode ? '#ffffff' : '#000000'
      })
      return canvas.toDataURL('image/png')
    } catch (error) {
      console.error('Error al generar el código de barras:', error)
      return null
    }
  }

  // Descargar QR como PNG
  const downloadQR = (item: QRData) => {
    const svgElement = document.getElementById('qr-svg-main')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    canvas.width = qrSize + 80
    canvas.height = qrSize + 100
    
    ctx!.fillStyle = isDarkMode ? '#27272a' : 'white'
    ctx!.fillRect(0, 0, canvas.width, canvas.height)
    
    const img = typeof window !== 'undefined' ? new window.Image() : null
    if (!img) return
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    
    img.onload = () => {
      ctx!.drawImage(img, 40, 30, qrSize, qrSize)
      
      ctx!.fillStyle = isDarkMode ? '#ffffff' : primaryColor
      ctx!.font = 'bold 16px Arial'
      ctx!.textAlign = 'center'
      ctx!.fillText(item.patrimonialCode, canvas.width / 2, qrSize + 70)
      
      URL.revokeObjectURL(url)
      
      const pngUrl = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.href = pngUrl
      downloadLink.download = `QR-${item.patrimonialCode}.png`
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      
      toast.success('Código QR descargado')
    }
    
    img.src = url
  }

  // Descargar código de barras
  const downloadBarcode = (item: QRData) => {
    const barcodeUrl = generateBarcode(item, barcodeFormat)
    if (!barcodeUrl) {
      toast.error('Error al generar código de barras')
      return
    }

    const downloadLink = document.createElement('a')
    downloadLink.href = barcodeUrl
    downloadLink.download = `BARRAS-${item.patrimonialCode}.png`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    
    toast.success('Código de barras descargado')
  }

  // Descargar ambos
  const downloadBoth = (item: QRData) => {
    const svgElement = document.getElementById('qr-svg-main')
    if (!svgElement) return

    const svgData = new XMLSerializer().serializeToString(svgElement)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    canvas.width = 340
    canvas.height = 420
    
    ctx!.fillStyle = isDarkMode ? '#27272a' : 'white'
    ctx!.fillRect(0, 0, canvas.width, canvas.height)
    
    const qrImg = typeof window !== 'undefined' ? new window.Image() : null
    if (!qrImg) return
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    
    qrImg.onload = () => {
      ctx!.drawImage(qrImg, 70, 20, qrSize, qrSize)
      
      ctx!.fillStyle = isDarkMode ? '#ffffff' : primaryColor
      ctx!.font = 'bold 14px Arial'
      ctx!.textAlign = 'center'
      ctx!.fillText(item.patrimonialCode, canvas.width / 2, qrSize + 40)
      
      const barcodeUrl = generateBarcode(item, barcodeFormat)
      if (barcodeUrl) {
        const barcodeImg = typeof window !== 'undefined' ? new window.Image() : null
        if (!barcodeImg) return
        barcodeImg.onload = () => {
          ctx!.drawImage(barcodeImg, 20, qrSize + 60, 300, 60)
          URL.revokeObjectURL(url)
          
          const pngUrl = canvas.toDataURL('image/png')
          const downloadLink = document.createElement('a')
          downloadLink.href = pngUrl
          downloadLink.download = `${item.patrimonialCode}-completo.png`
          document.body.appendChild(downloadLink)
          downloadLink.click()
          document.body.removeChild(downloadLink)
          
          toast.success('Códigos descargados')
        }
        barcodeImg.src = barcodeUrl
      }
    }
    
    qrImg.src = url
  }

  // Descargar todos
  const downloadAll = async () => {
    if (items.length === 0) return
    
    for (let i = 0; i < items.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 400))
      const item = items[i]
      if (item) downloadBoth(item)
    }
    
    toast.success(`${items.length} códigos descargados`)
  }

  // Copiar datos
  const copyData = (item: QRData) => {
    navigator.clipboard.writeText(generateReadableContent(item))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Datos copiados')
  }

  // Imprimir en nueva pestaña
  const printCodes = async (item: QRData) => {
    const safeCode = escapeHtml(item.patrimonialCode)
    const safeName = escapeHtml(item.name)
    const safeColor = escapeHtml(primaryColor)
    const safeQrContent = JSON.stringify(generateQRContent(item))

    let qrImgSrc = ''
    try {
      qrImgSrc = await QRCode.toDataURL(safeQrContent, { width: 250, margin: 1 })
    } catch {
      qrImgSrc = ''
    }

    const barcodeUrl = generateBarcode(item, barcodeFormat)

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR - ${safeCode}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: #fff; padding: 20px; text-align: center; }
            .no-print { text-align: center; margin-bottom: 20px; }
            .no-print button { padding: 10px 24px; background: ${safeColor}; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
            .no-print button:hover { background: #1e3a8a; }
            .qr-section { border: 2px solid ${safeColor}; padding: 20px; border-radius: 8px; margin-bottom: 20px; page-break-inside: avoid; display: inline-block; }
            .barcode-section { border: 2px solid ${safeColor}; padding: 20px; border-radius: 8px; page-break-inside: avoid; display: inline-block; }
            h3 { color: ${safeColor}; margin: 0 0 10px; }
            .code { margin-top: 10px; font-size: 16px; font-weight: bold; color: ${safeColor}; }
            .name { margin: 8px 0 0; font-size: 13px; color: #333; }
            @media print { @page { margin: 1cm; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">🖨 Imprimir</button>
          </div>
          <div class="qr-section">
            <h3>CÓDIGO QR</h3>
            ${qrImgSrc ? `<img src="${qrImgSrc}" style="width:250px;height:250px" />` : '<p style="color:red">Error al generar QR</p>'}
            <div class="code">${safeCode}</div>
            <p class="name">${safeName}</p>
          </div>
          <div class="barcode-section">
            <h3>CÓDIGO DE BARRAS</h3>
            ${barcodeUrl ? `<img src="${barcodeUrl}" style="max-width:100%" />` : '<p style="color:red">Error al generar código de barras</p>'}
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Imprimir todos los códigos en nueva pestaña
  const printAllCodes = async () => {
    if (items.length === 0) return

    const results = await Promise.all(items.map(async (item) => {
      const content = JSON.stringify(generateQRContent(item))
      let qrSrc = ''
      try {
        qrSrc = await QRCode.toDataURL(content, { width: 250, margin: 1 })
      } catch { /* empty */ }
      const barcodeSrc = generateBarcode(item, barcodeFormat) || ''
      return { qrSrc, barcodeSrc }
    }))

    const safeColor = escapeHtml(primaryColor)

    const cardsHtml = items.map((item, idx) => {
      const safeName = escapeHtml(item.name)
      const safeCode = escapeHtml(item.patrimonialCode)
      const { qrSrc, barcodeSrc } = results[idx]!
      return `
        <div class="card">
          <div class="qr-section">
            <h3>CÓDIGO QR</h3>
            ${qrSrc ? `<img src="${qrSrc}" class="qr-img" />` : '<p style="color:red">Error QR</p>'}
            <div class="code">${safeCode}</div>
            <p class="name">${safeName}</p>
          </div>
          <div class="barcode-section">
            <h3>CÓDIGO DE BARRAS</h3>
            ${barcodeSrc ? `<img src="${barcodeSrc}" class="barcode-img" />` : '<p style="color:red">Error barras</p>'}
          </div>
        </div>
      `
    }).join('')

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir ${items.length} códigos</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: #fff; padding: 20px; }
            .no-print { text-align: center; margin-bottom: 20px; }
            .no-print button { padding: 10px 24px; background: ${safeColor}; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
            .no-print button:hover { background: #1e3a8a; }
            .card { border: 2px solid ${safeColor}; border-radius: 8px; padding: 20px; margin-bottom: 20px; page-break-after: always; text-align: center; }
            .qr-section { margin-bottom: 15px; }
            .barcode-section { border-top: 1px solid #ccc; padding-top: 15px; }
            h3 { color: ${safeColor}; margin: 0 0 10px; }
            .qr-img { width: 250px; height: 250px; }
            .barcode-img { max-width: 100%; }
            .code { margin-top: 10px; font-size: 16px; font-weight: bold; color: ${safeColor}; }
            .name { margin: 8px 0 0; font-size: 13px; color: #333; }
            @media print { @page { margin: 0.5cm; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">🖨 Imprimir todos (${items.length})</button>
          </div>
          ${cardsHtml}
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Generar vista de impresión de etiquetas para múltiples ítems
  const printBatchLabels = async () => {
    if (items.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const qrImages = await Promise.all(items.map(async (item) => {
      const content = JSON.stringify(generateQRContent(item))
      try {
        return await QRCode.toDataURL(content, { width: 100, margin: 0 })
      } catch {
        return ''
      }
    }))

    const labelsHtml = items.map((item, idx) => {
      const safeName = escapeHtml(item.name)
      const safeCode = escapeHtml(item.patrimonialCode)
      const safeBrand = escapeHtml(item.brand || '')
      const safeModel = escapeHtml(item.model || '')
      const qrSrc = qrImages[idx] || ''
      return `
        <div class="label-item">
          <div class="qr-wrapper">
            ${qrSrc ? `<img src="${qrSrc}" style="width:100px;height:100px" />` : '<p style="color:red">Error QR</p>'}
          </div>
          <div class="label-info">
            <p class="label-name">${safeName}</p>
            <p class="label-code">${safeCode}</p>
            <p class="label-detail">${safeBrand} ${safeModel ? '/ ' + safeModel : ''}</p>
          </div>
        </div>
      `
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas QR - ${items.length} bienes</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: #fff; padding: 10px; }
            .labels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
            .label-item { border: 1.5px solid #1e40af; border-radius: 8px; padding: 12px; text-align: center; page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; align-items: center; }
            .qr-wrapper { background: #fff; padding: 8px; border-radius: 6px; display: inline-block; }
            .label-info { margin-top: 8px; }
            .label-name { font-size: 11px; font-weight: bold; color: #1e3a5f; line-height: 1.3; }
            .label-code { font-size: 10px; font-family: monospace; color: #1e40af; margin-top: 2px; font-weight: 600; }
            .label-detail { font-size: 9px; color: #64748b; margin-top: 2px; }
            @media print {
              @page { margin: 0.5cm; size: auto; }
              body { padding: 0; }
              .label-item { border-color: #000 !important; }
            }
            @media screen {
              body { padding: 20px; }
              .no-print { text-align: center; margin-bottom: 20px; }
              .no-print button { padding: 10px 24px; background: #1e40af; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
              .no-print button:hover { background: #1e3a8a; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">🖨 Imprimir etiquetas</button>
            <p style="margin-top:6px;font-size:12px;color:#64748b">${items.length} etiqueta(s) para imprimir</p>
          </div>
          <div class="labels-grid">
            ${labelsHtml}
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Descargar etiquetas en lote como PDF
  const downloadPDFLabels = async () => {
    if (items.length === 0) return

    const qrImages = await Promise.all(items.map(async (item) => {
      const content = JSON.stringify(generateQRContent(item))
      try {
        return await QRCode.toDataURL(content, { width: 90, margin: 0 })
      } catch {
        return ''
      }
    }))

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const labelsHtml = items.map((item, idx) => {
      const safeName = escapeHtml(item.name)
      const safeCode = escapeHtml(item.patrimonialCode)
      const safeBrand = escapeHtml(item.brand || '')
      const safeModel = escapeHtml(item.model || '')
      const qrSrc = qrImages[idx] || ''
      return `
        <div class="label-item">
          <div class="qr-wrapper">
            ${qrSrc ? `<img src="${qrSrc}" style="width:90px;height:90px" />` : '<p style="color:red">Error QR</p>'}
          </div>
          <div class="label-info">
            <p class="label-name">${safeName}</p>
            <p class="label-code">${safeCode}</p>
            <p class="label-detail">${safeBrand} ${safeModel ? '/ ' + safeModel : ''}</p>
          </div>
        </div>
      `
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas QR - ${items.length} bienes</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: #fff; padding: 0; }
            .labels-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; padding: 10px; }
            .label-item { border: 1.5px solid #000; border-radius: 6px; padding: 10px; text-align: center; page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; align-items: center; }
            .qr-wrapper { background: #fff; padding: 6px; border-radius: 4px; display: inline-block; }
            .label-info { margin-top: 6px; }
            .label-name { font-size: 10px; font-weight: bold; color: #000; line-height: 1.3; }
            .label-code { font-size: 9px; font-family: monospace; color: #000; margin-top: 2px; font-weight: 600; }
            .label-detail { font-size: 8px; color: #333; margin-top: 2px; }
            @media print { @page { margin: 0.3cm; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="labels-grid">
            ${labelsHtml}
          </div>
          <script>setTimeout(() => window.print(), 300);</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  if (!currentItem) return null

  const barcodeUrl = generateBarcode(currentItem, barcodeFormat)

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] max-w-[650px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: primaryColor }}>
              <QrCode className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="font-semibold text-xl text-zinc-900 dark:text-white">
                Generador de códigos
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400">
                Código QR y de barras patrimonial
              </DialogDescription>
            </div>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs de selección */}
        <div className="flex items-center justify-center gap-2 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
          <button
            onClick={() => setViewMode('both')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'both' 
                ? 'text-white' 
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-600'
            }`}
            style={viewMode === 'both' ? { backgroundColor: primaryColor } : {}}
          >
            <QrCode className="h-4 w-4" />
            Ambos
          </button>
          <button
            onClick={() => setViewMode('qr')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'qr' 
                ? 'text-white' 
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-600'
            }`}
            style={viewMode === 'qr' ? { backgroundColor: primaryColor } : {}}
          >
            <QrCode className="h-4 w-4" />
            QR
          </button>
          <button
            onClick={() => setViewMode('barcode')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'barcode' 
                ? 'text-white' 
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-300 dark:border-zinc-600'
            }`}
            style={viewMode === 'barcode' ? { backgroundColor: primaryColor } : {}}
          >
            <Barcode className="h-4 w-4" />
            Barras
          </button>
        </div>

        {/* Configuración */}
        <div className="flex items-center gap-6 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex-1">
            <Label className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tamaño QR</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={qrSize}
                onChange={(e) => setQrSize(Number(e.target.value))}
                className="w-24 h-9 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">px</span>
            </div>
          </div>
          <div className="flex-1">
            <Label className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Formato</Label>
            <Select value={barcodeFormat} onValueChange={(v) => setBarcodeFormat(v as 'CODE128' | 'CODE39')}>
              <SelectTrigger className="mt-1 h-9 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700">
                <SelectItem value="CODE128" className="text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700">CODE128</SelectItem>
                <SelectItem value="CODE39" className="text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700">CODE39</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Navegación de múltiples items */}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-4 px-5 py-2 bg-zinc-100 dark:bg-zinc-800/50">
            <button 
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {currentIndex + 1} de {items.length}
            </span>
            <button 
              onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
              disabled={currentIndex === items.length - 1}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        )}

        {/* Área de códigos */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 m-4 rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <div className="flex flex-col items-center">
              {viewMode !== 'barcode' && (
                <div className="p-4 rounded-xl shadow-sm bg-white dark:bg-zinc-900">
                  <QRCodeSVG
                    id="qr-svg-main"
                    value={generateQRContent(currentItem)}
                    size={Math.min(qrSize, 200)}
                    level="H"
                    bgColor={isDarkMode ? "#27272a" : "#ffffff"}
                    fgColor={isDarkMode ? "#ffffff" : primaryColor}
                  />
                </div>
              )}
              
              {viewMode !== 'qr' && barcodeUrl && (
                <div className="p-3 rounded-lg shadow-sm mt-3 bg-white dark:bg-zinc-900">
                  <Image 
                    src={barcodeUrl} 
                    alt={`Barras ${currentItem.patrimonialCode}`}
                    className="max-w-full"
                    style={{ height: 50 }}
                    width={300}
                    height={50}
                  />
                </div>
              )}
              
              <p className="font-semibold mt-3 text-lg" style={{ color: isDarkMode ? '#ffffff' : primaryColor }}>
                {currentItem.patrimonialCode}
              </p>
            </div>
          </div>

          {/* Información del bien */}
          <div className="px-5 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3 bg-zinc-100 dark:bg-zinc-800">
                <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Marca</p>
                <p className="font-medium mt-1 text-zinc-900 dark:text-white">{currentItem.brand || 'Sin marca'}</p>
              </div>
              <div className="rounded-lg p-3 bg-zinc-100 dark:bg-zinc-800">
                <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Modelo</p>
                <p className="font-medium mt-1 text-zinc-900 dark:text-white">{currentItem.model || 'Sin modelo'}</p>
              </div>
              <div className="rounded-lg p-3 bg-zinc-100 dark:bg-zinc-800">
                <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Estado</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <p className="font-medium text-zinc-900 dark:text-white">
                    {currentItem.status || 'Sin estado'}
                  </p>
                </div>
              </div>
              <div className="rounded-lg p-3 bg-zinc-100 dark:bg-zinc-800">
                <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Ubicación</p>
                <p className="font-medium mt-1 truncate text-zinc-900 dark:text-white">{currentItem.location || 'No especificada'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-center gap-3 px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
          <Button
            variant="outline"
            className="flex-1 max-w-[160px] px-5 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => copyData(currentItem)}
          >
            {copied ? <Check className="h-4 w-4 mr-2 text-green-400" /> : <Copy className="h-4 w-4 mr-2" />}
            Copiar
          </Button>
          <Button
            variant="outline"
            className="flex-1 max-w-[160px] px-5 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              if (viewMode === 'qr') downloadQR(currentItem)
              else if (viewMode === 'barcode') downloadBarcode(currentItem)
              else downloadBoth(currentItem)
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            className="flex-1 max-w-[160px] px-5 text-white"
            style={{ backgroundColor: primaryColor }}
            onClick={() => printCodes(currentItem)}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>

        {/* Botones de lote */}
        {items.length > 1 && (
          <div className="px-6 pb-5 space-y-3">
            <Button
              className="w-full text-white px-5"
              style={{ backgroundColor: primaryColor }}
              onClick={downloadAll}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar todos ({items.length})
            </Button>
            <div className="flex gap-3">
              <Button
                className="flex-1 text-white px-5"
                style={{ backgroundColor: primaryColor }}
                onClick={printAllCodes}
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Todos
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={printBatchLabels}
              >
                <Tags className="h-4 w-4 mr-2" />
                Etiquetas
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={downloadPDFLabels}
              >
                <FileDown className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    </>
  )
}
