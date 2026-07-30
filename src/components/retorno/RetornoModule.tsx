'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/http'
import { normalizeText } from '@/lib/utils'
import { useAuthStore, useConfigStore } from '@/store'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getDocumentHeaderHTML } from '@/lib/year-denomination'
import {
  Package, MapPin, User, ArrowLeftToLine,
  Loader2, Printer, Search, AlertTriangle, CheckCircle2, X
} from 'lucide-react'
import type { AvailableUnit, ItemStatusEnum } from '@/types'
import { openLostDocument, type LostDocData } from '@/lib/delivery-doc'

export function RetornoModule() {
  const { user } = useAuthStore()
  const { config } = useConfigStore()
  const primaryColor = config?.primaryColor || '#1e40af'
  const institutionName = config?.institutionName || 'Almacén Institucional'

  const [units, setUnits] = useState<AvailableUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState('')
  const [estados, setEstados] = useState<ItemStatusEnum[]>([])
  const [statusByUnit, setStatusByUnit] = useState<Record<number, string>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<{
    documentNumber: string
    returnedCount: number
    units: Array<{ patrimonialCode: string; itemName: string; itemCode: string; status: string }>
  } | null>(null)
  const [lostUnitIds, setLostUnitIds] = useState<number[]>([])
  const [isLostDialogOpen, setIsLostDialogOpen] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [lostDate, setLostDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pendingLostData, setPendingLostData] = useState<AvailableUnit | null>(null)

  const sourceBadge = (type: string) => {
    switch (type) {
      case 'ASSIGNMENT': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">ASIGNACIÓN</Badge>
      case 'LOAN': return <Badge className="bg-purple-100 text-purple-800 border-purple-200">PRÉSTAMO</Badge>
      case 'ORDER': return <Badge className="bg-amber-100 text-amber-800 border-amber-200">PEDIDO</Badge>
      default: return <Badge variant="outline">{type}</Badge>
    }
  }

  const fetchUnits = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/api/returns')
      if (response.ok) {
        const data = await response.json()
        setUnits(data.units || [])
      } else {
        toast.error('Error al cargar unidades fuera')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUnits() }, [fetchUnits])

  useEffect(() => {
    apiFetch('/api/estados').then(res => {
      if (res.ok) res.json().then(data => setEstados(data.estados || []))
    }).catch(() => {})
  }, [])

  const filteredUnits = units.filter(u => {
    if (!search) return true
    const q = normalizeText(search)
    return normalizeText(u.patrimonialCode).includes(q) ||
      normalizeText(u.itemName).includes(q) ||
      normalizeText(u.itemCode).includes(q) ||
      normalizeText(u.currentHolder ?? '').includes(q) ||
      normalizeText(u.referenceNumber).includes(q)
  })

  const toggleAll = () => {
    if (selectedIds.length === filteredUnits.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredUnits.map(u => u.id))
    }
  }

  const toggleUnit = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleReturn = async () => {
    if (selectedIds.length === 0) return
    setProcessing(true)
    try {
      const returnUnitIds = selectedIds.filter(id => !lostUnitIds.includes(id))
      const lostIds = selectedIds.filter(id => lostUnitIds.includes(id))

      if (lostIds.length > 0) {
        const lostUnits = units.filter(u => lostIds.includes(u.id))
        for (const lu of lostUnits) {
          const lostData: LostDocData = {
            docNumber: `PERD-${Date.now().toString(36).toUpperCase()}`,
            date: format(new Date(), 'dd/MM/yyyy', { locale: es }),
            declarantName: lu.currentHolder || '---',
            declarantOffice: lu.currentLocation || '---',
            lossReason: lostReason || 'No especificado',
            lossDate: lostDate,
            items: [{
              name: lu.itemName,
              code: lu.itemCode,
              patrimonialCode: lu.patrimonialCode,
              quantity: 1,
              estimatedValue: undefined,
            }],
          }
          openLostDocument(lostData, config ? { institutionName: config.institutionName, logoUrl: config.logoUrl, primaryColor: config.primaryColor } : undefined)
        }
      }

      if (returnUnitIds.length > 0) {
        const response = await apiFetch('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unitIds: returnUnitIds, notes, unitsStatus: statusByUnit })
        })
        if (response.ok) {
          const data = await response.json()
          setLastResult({
            documentNumber: data.documentNumber,
            returnedCount: data.returnedCount,
            units: data.units
          })
          toast.success(data.message)
        } else {
          const err = await response.json()
          toast.error(err.error || 'Error al procesar retorno')
        }
      }

      if (lostIds.length > 0) {
        toast.success(`${lostIds.length} declaración(es) de pérdida generada(s)`)
      }

      setSelectedIds([])
      setLostUnitIds([])
      setNotes('')
      fetchUnits()
    } catch {
      toast.error('Error de conexión')
    } finally {
      setProcessing(false)
      setConfirmOpen(false)
    }
  }

  const printActa = () => {
    if (!lastResult) return
    const date = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })
    const userName = user?.fullName || '---'
    const userDni = user?.dni || '---'
    const userRole = user?.role === 'ADMINISTRADOR' ? 'Administrador' : user?.role === 'ALMACENERO' ? 'Almacenero' : '---'
    const itemsRows = lastResult.units.map((u, i) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #000;text-align:center">${i + 1}</td>
        <td style="padding:6px 8px;border:1px solid #000;font-family:'Courier New',monospace">${u.itemCode}</td>
        <td style="padding:6px 8px;border:1px solid #000">${u.itemName}</td>
        <td style="padding:6px 8px;border:1px solid #000;font-family:'Courier New',monospace">${u.patrimonialCode}</td>
        <td style="padding:6px 8px;border:1px solid #000;text-align:center">1</td>
        <td style="padding:6px 8px;border:1px solid #000;text-align:center">${u.status}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Acta de Retorno - ${lastResult.documentNumber}</title>
<style>
  @page { size: A4; margin: 2.5cm 2cm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; margin: 0; padding: 0; }
  .page { width: 100%; }
  .header { text-align: center; margin-bottom: 25px; }
  .header h1 { font-size: 14pt; margin: 0 0 3px; text-transform: uppercase; font-weight: bold; }
  .header h2 { font-size: 12pt; margin: 0 0 3px; text-transform: uppercase; font-weight: bold; }
  .header p { font-size: 11pt; margin: 2px 0; }
  .title { text-align: center; margin: 25px 0; }
  .title h3 { font-size: 13pt; margin: 0 0 5px; text-decoration: underline; }
  .title p { font-size: 11pt; margin: 0; }
  .info { margin-bottom: 20px; }
  .info p { margin: 3px 0; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #f0f0f0; padding: 6px 8px; border: 1px solid #000; font-size: 9pt; text-align: center; font-weight: bold; }
  td { padding: 6px 8px; border: 1px solid #000; font-size: 10pt; }
  .signatures { margin-top: 60px; display: flex; justify-content: space-between; }
  .signature-box { text-align: center; width: 45%; }
  .signature-line { border-top: 1px solid #000; margin-top: 70px; padding-top: 8px; font-size: 10pt; font-weight: bold; }
  .footer { margin-top: 30px; font-size: 8pt; text-align: center; color: #666; }
  @media print {
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">
<div class="no-print" style="text-align:right;margin-bottom:20px">
  <button onclick="window.print()" style="padding:8px 20px;cursor:pointer;background:${primaryColor};color:white;border:none;border-radius:4px">Imprimir / PDF</button>
  <button onclick="downloadDoc()" style="padding:8px 20px;margin-left:8px;cursor:pointer;background:#6b7280;color:white;border:none;border-radius:4px">Descargar Word</button>
</div>

${getDocumentHeaderHTML({ institutionName, logoUrl: config?.logoUrl, primaryColor })}

<div class="title">
  <h3>ACTA DE RETORNO DE BIENES PATRIMONIALES</h3>
  <p>N° <strong>${lastResult.documentNumber}</strong></p>
</div>

<div class="info">
  <p><strong>FECHA DE RETORNO:</strong> ${date}</p>
  <p><strong>RECIBIDO POR:</strong> ${userName} — DNI: ${userDni} — ${userRole}</p>
  ${notes ? `<p><strong>OBSERVACIONES:</strong> ${notes}</p>` : ''}
</div>

<p style="font-size:11pt">Por medio de la presente, se deja constancia del retorno formal de los siguientes bienes patrimoniales al almacén institucional, los cuales fueron previamente asignados, prestados o solicitados:</p>

<table>
  <thead>
    <tr>
      <th style="width:40px">N°</th>
      <th style="width:100px">Código</th>
      <th>Descripción del Bien</th>
      <th style="width:130px">Cód. Patrimonial</th>
      <th style="width:60px">Cant.</th>
      <th style="width:80px">Estado</th>
    </tr>
  </thead>
  <tbody>
    ${itemsRows}
  </tbody>
</table>

<p style="font-size:11pt">Los bienes descritos han sido recibidos en el estado indicado, quedando a disposición del almacén para su control y futura asignación.</p>

<div class="signatures">
  <div class="signature-box">
    <div class="signature-line">ENTREGÓ</div>
    <p style="font-size:10pt;margin-top:4px"><strong>${lastResult.units[0] ? document.getElementById('holder-name')?.textContent || '---' : '---'}</strong></p>
  </div>
  <div class="signature-box">
    <div class="signature-line">RECIBÍ CONFORME</div>
    <p style="font-size:10pt;margin-top:4px"><strong>${userName}</strong></p>
    <p style="font-size:9pt;color:#666">Responsable de Almacén</p>
  </div>
</div>

<div class="footer">
  <p>Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })} — ${institutionName}</p>
</div>

<script>
function downloadDoc() {
  var html = document.documentElement.outerHTML
  var blob = new Blob([html], { type: 'application/msword' })
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  a.download = 'Acta_Retorno_${lastResult.documentNumber.replace(/[^\w]/g, '_')}.doc'
  a.click()
  URL.revokeObjectURL(url)
}
window.onload = function() {
  setTimeout(function() { window.print(); }, 500)
}
</script>
</div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  const groupByItem = (unitsList: AvailableUnit[]) => {
    const groups: Record<string, { item: AvailableUnit; units: AvailableUnit[] }> = {}
    for (const u of unitsList) {
      const key = `${u.itemId}`
      if (!groups[key]) {
        groups[key] = { item: u, units: [] }
      }
      groups[key].units.push(u)
    }
    return Object.values(groups)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Retorno de Bienes</h1>
          <p className="text-muted-foreground">Gestión de retorno de bienes patrimoniales al almacén</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchUnits} disabled={loading}>
            <Loader2 className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{units.length}</p>
          <p className="text-xs text-muted-foreground">Unidades fuera</p>
        </div>
        <div className="flex-1 rounded-lg border p-3 text-center border-green-200 bg-green-50">
          <p className="text-2xl font-bold text-green-700">{selectedIds.length}</p>
          <p className="text-xs text-green-600">Seleccionadas</p>
        </div>
      </div>

      {lastResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    Retorno registrado: {lastResult.documentNumber}
                  </p>
                  <p className="text-sm text-green-600">
                    {lastResult.returnedCount} unidad(es) retornada(s)
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={printActa}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Acta
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLastResult(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm"
          placeholder="Buscar por código patrimonial, bien, responsable o documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {units.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">No hay bienes fuera del almacén</p>
            <p className="text-sm">Todos los bienes patrimoniales están disponibles</p>
          </CardContent>
        </Card>
      ) : filteredUnits.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>No se encontraron resultados para "{search}"</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Selección masiva */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Checkbox
              id="select-all"
              checked={selectedIds.length === filteredUnits.length && filteredUnits.length > 0}
              onCheckedChange={toggleAll}
            />
            <label htmlFor="select-all" className="cursor-pointer select-none">
              {selectedIds.length === 0
                ? `Seleccionar todo (${filteredUnits.length})`
                : `${selectedIds.length} de ${filteredUnits.length} seleccionado(s)`}
            </label>
          </div>

          {/* Lista agrupada por bien */}
          <div className="space-y-4">
            {groupByItem(filteredUnits).map(group => (
              <Card key={group.item.itemId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{group.item.itemName}</CardTitle>
                      <Badge variant="outline" className="text-xs">{group.item.itemCode}</Badge>
                    </div>
                    <Badge>{group.units.length} unidad(es)</Badge>
                  </div>
                  <CardDescription>
                    {group.item.itemCategory} — {group.item.itemBrand} / {group.item.itemModel}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-72">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Cód. Patrimonial</TableHead>
                          <TableHead>Ubicación</TableHead>
                          <TableHead>Responsable</TableHead>
                          <TableHead>Fuente</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Desde</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.units.map(unit => (
                          <TableRow key={unit.id} className={selectedIds.includes(unit.id) ? 'bg-blue-50' : ''}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.includes(unit.id)}
                                onCheckedChange={() => toggleUnit(unit.id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{unit.patrimonialCode}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{unit.currentLocation || '---'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{unit.currentHolder || '---'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{unit.reason}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {sourceBadge(unit.referenceType)}
                                <span className="text-xs font-mono text-muted-foreground">{unit.referenceNumber || (unit.referenceType === 'ASSIGNMENT' ? `Acta #${unit.referenceId}` : '---')}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {unit.since ? format(new Date(unit.since), 'dd/MM/yy', { locale: es }) : '---'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={unit.status === 'OPERATIVO' ? 'secondary' : 'default'} className="text-xs">
                                {unit.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Acción de retorno */}
      {selectedIds.length > 0 && (
        <Card className="bg-blue-50 border-blue-200 sticky bottom-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-medium">{selectedIds.length} unidad(es) seleccionada(s)</p>
                <p className="text-sm text-muted-foreground">Confirme el retorno de las unidades seleccionadas</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setSelectedIds([])}>
                  Cancelar
                </Button>
                <Button
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => {
                    const init: Record<number, string> = {}
                    for (const u of units) {
                      if (selectedIds.includes(u.id)) init[u.id] = u.status || 'OPERATIVO'
                    }
                    setStatusByUnit(init)
                    setConfirmOpen(true)
                  }}
                >
                  <ArrowLeftToLine className="h-4 w-4 mr-2" />
                  Registrar Retorno
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de confirmación */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar Retorno de Bienes</AlertDialogTitle>
            <AlertDialogDescription>
              Se registrará el retorno de <strong>{selectedIds.length}</strong> unidad(es) patrimonial(es).
              Se generará un acta de retorno con número correlativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Unidades a retornar:</p>
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                  {units
                    .filter(u => selectedIds.includes(u.id))
                    .map(u => (
                      <div key={u.id} className="flex items-center gap-2 rounded-md border p-2">
                        {lostUnitIds.includes(u.id) ? (
                          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono truncate">{u.patrimonialCode}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.itemName}</p>
                          {lostUnitIds.includes(u.id) && <p className="text-xs text-red-500 font-medium">Declarado como perdido</p>}
                        </div>
                        <Select
                          value={statusByUnit[u.id] || 'OPERATIVO'}
                          onValueChange={(val) => setStatusByUnit(prev => ({ ...prev, [u.id]: val }))}
                          disabled={lostUnitIds.includes(u.id)}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {estados.length > 0 ? estados.map(est => (
                              <SelectItem key={est.id} value={est.name}>{est.label}</SelectItem>
                            )) : (
                              <SelectItem value="OPERATIVO">OPERATIVO</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {!lostUnitIds.includes(u.id) ? (
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { setPendingLostData(u); setLostReason(''); setLostDate(format(new Date(), 'yyyy-MM-dd')); setIsLostDialogOpen(true) }}>
                            Perdido
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setLostUnitIds(prev => prev.filter(i => i !== u.id))}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
              </div>
            </ScrollArea>
            <div className="space-y-1 pt-2">
              <label className="text-sm font-medium">Observaciones (opcional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre el estado de los bienes o condiciones del retorno..."
                rows={2}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturn}
              disabled={processing}
              style={{ backgroundColor: primaryColor }}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <ArrowLeftToLine className="h-4 w-4 mr-2" />
                  Confirmar Retorno
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de declaración de pérdida */}
      <AlertDialog open={isLostDialogOpen} onOpenChange={setIsLostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Declarar Pérdida</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingLostData ? (
                <>Se declarará la pérdida de <strong>{pendingLostData.itemName}</strong> ({pendingLostData.patrimonialCode})</>
              ) : 'Complete los detalles de la pérdida'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lossReason">Motivo de la pérdida</Label>
              <Textarea
                id="lossReason"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Describa las circunstancias de la pérdida..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lossDate">Fecha de la pérdida</Label>
              <Input
                id="lossDate"
                type="date"
                value={lostDate}
                onChange={(e) => setLostDate(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingLostData) {
                  setLostUnitIds(prev => [...prev, pendingLostData.id])
                  setLostReason(lostReason)
                }
                setIsLostDialogOpen(false)
              }}
              disabled={!lostReason.trim()}
            >
              Agregar como Perdido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
