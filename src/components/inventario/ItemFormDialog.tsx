'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { CatalogSelector } from './CatalogSelector'
import { DocumentViewerModal } from '@/components/ui/document-viewer-modal'
import { PatrimonialCodesInput } from './PatrimonialCodesInput'
import {
  Plus, Upload, Download, Sparkles,
  Settings2
} from 'lucide-react'
import type { Item, ItemType, ItemStatus, ItemStatusEnum, ItemCatalog, Warehouse, SystemConfig } from '@/types'

export interface ItemFormData {
  name: string
  model: string
  brand: string
  color: string
  series: string
  code: string
  patrimonialCode: string
  patrimonialCodes: string
  itemType: ItemType
  category: string
  unit: string
  quantity: string
  minStock: string
  status: string
  location: string
  warehouseId: string
  technicalSpecs: string
}

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: Item | null
  formData: ItemFormData
  onFormDataChange: (data: ItemFormData | ((prev: ItemFormData) => ItemFormData)) => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  onReset: () => void
  categories: string[]
  warehouses: Warehouse[]
  estados: ItemStatusEnum[]
  config: SystemConfig | null
  supportDocument: File | null
  onSupportDocumentChange: (file: File | null) => void
  supportDocumentUrl: string | null
  isUploading: boolean
  patrimonialCodesList: string[]
  onPatrimonialCodesListChange: (codes: string[]) => void
  existingPatrimonialCodes: string[]
  patrimonialUnitStatuses: Record<number, ItemStatus>
  onPatrimonialUnitStatusesChange: (statuses: Record<number, ItemStatus> | ((prev: Record<number, ItemStatus>) => Record<number, ItemStatus>)) => void
  selectedUnitIds: number[]
  onSelectedUnitIdsChange: (ids: number[] | ((prev: number[]) => number[])) => void
  onOpenEstadosDialog: () => void
  getUnitStatusBadge: (status: string) => { badgeColor: string; label: string }
}

export function ItemFormDialog({
  open,
  onOpenChange,
  editingItem,
  formData,
  onFormDataChange,
  onSubmit,
  onReset,
  categories,
  warehouses,
  estados,
  config,
  supportDocument,
  onSupportDocumentChange,
  supportDocumentUrl,
  isUploading,
  patrimonialCodesList,
  onPatrimonialCodesListChange,
  existingPatrimonialCodes,
  patrimonialUnitStatuses,
  onPatrimonialUnitStatusesChange,
  selectedUnitIds,
  onSelectedUnitIdsChange,
  onOpenEstadosDialog,
  getUnitStatusBadge,
}: ItemFormDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) { onReset() } onOpenChange(open) }}>
      <DialogTrigger asChild>
        <Button style={{ backgroundColor: config?.primaryColor }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Bien
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Editar Bien' : 'Registrar Nuevo Bien'}</DialogTitle>
          <DialogDescription>
            Complete los campos para {editingItem ? 'actualizar' : 'registrar'} el bien
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Selector de Catálogo */}
          {!editingItem && (
            <div className="flex justify-end">
              <CatalogSelector
                onSelect={(catalogItem: ItemCatalog) => {
                  onFormDataChange({
                    ...formData,
                    name: catalogItem.name,
                    brand: catalogItem.brand,
                    model: catalogItem.model,
                    category: catalogItem.category,
                    itemType: catalogItem.itemType,
                    unit: catalogItem.unit || 'UNIDAD',
                    technicalSpecs: catalogItem.technicalSpecs || '',
                    minStock: String(catalogItem.defaultMinStock)
                  })
                }}
                buttonText="Autocompletar desde Catálogo"
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => onFormDataChange({ ...formData, code: e.target.value })}
                required
                placeholder="Ej: IT-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => onFormDataChange({ ...formData, model: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => onFormDataChange({ ...formData, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => onFormDataChange({ ...formData, color: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="series">Serie</Label>
              <Input
                id="series"
                value={formData.series}
                onChange={(e) => onFormDataChange({ ...formData, series: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemType">Tipo *</Label>
              <Select
                value={formData.itemType}
                onValueChange={(value: ItemType) => onFormDataChange({ ...formData, itemType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSUMIBLE">Consumible</SelectItem>
                  <SelectItem value="PATRIMONIAL">Patrimonial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.itemType === 'PATRIMONIAL' && (
              <>
                {parseInt(formData.quantity) === 1 ? (
                  <div className="space-y-2">
                    <Label htmlFor="patrimonialCode">Código Patrimonial *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="patrimonialCode"
                        value={formData.patrimonialCode}
                        onChange={(e) => onFormDataChange({
                          ...formData,
                          patrimonialCode: e.target.value,
                          patrimonialCodes: e.target.value
                        })}
                        placeholder="Ej: PAT-000001"
                        required
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const nextNum = (existingPatrimonialCodes.length > 0
                            ? Math.max(...existingPatrimonialCodes.map(c => {
                                const match = c.match(/PAT-(\d+)/)
                                return match ? parseInt(match[1] || '0') : 0
                              })) + 1
                            : 1)
                          const newCode = `PAT-${String(nextNum).padStart(6, '0')}`
                          onFormDataChange({
                            ...formData,
                            patrimonialCode: newCode,
                            patrimonialCodes: newCode
                          })
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cada bien patrimonial debe tener un código único
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 col-span-2">
                    <PatrimonialCodesInput
                      quantity={parseInt(formData.quantity) || 1}
                      value={patrimonialCodesList}
                      onChange={(codes) => {
                        onPatrimonialCodesListChange(codes)
                        onFormDataChange({ ...formData, patrimonialCodes: codes.join('\n') })
                      }}
                      existingCodes={existingPatrimonialCodes.filter(c => !patrimonialCodesList.includes(c))}
                    />
                  </div>
                )}
              </>
            )}
            {editingItem && editingItem.itemType === 'PATRIMONIAL' && editingItem.patrimonialUnits && editingItem.patrimonialUnits.length > 0 && (() => {
              const units = editingItem!.patrimonialUnits!
              return (
                <div className="col-span-2 space-y-3 p-4 border rounded-lg bg-muted/30">
                  <Label className="text-base font-semibold">Estado por Unidad Patrimonial</Label>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="selectAllUnits"
                        checked={selectedUnitIds.length === units.length}
                        onCheckedChange={(checked) => {
                          onSelectedUnitIdsChange(checked ? units.map(u => u.id) : [])
                        }}
                      />
                      <Label htmlFor="selectAllUnits" className="text-sm cursor-pointer">
                        {selectedUnitIds.length === units.length
                          ? 'Deseleccionar todo'
                          : selectedUnitIds.length > 0
                            ? `${selectedUnitIds.length} seleccionado(s)`
                            : 'Seleccionar todo'}
                      </Label>
                    </div>
                    {selectedUnitIds.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Cambiar estado a:</span>
                        <Select
                          value=""
                          onValueChange={(value: ItemStatus) => {
                            onPatrimonialUnitStatusesChange(prev => {
                              const next = { ...prev }
                              selectedUnitIds.forEach(id => { next[id] = value })
                              return next
                            })
                            onSelectedUnitIdsChange([])
                          }}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {estados.map((est) => (
                              <SelectItem key={est.id} value={est.name}>{est.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="divide-y rounded-md border bg-card">
                    {units.map((unit) => {
                      const isSelected = selectedUnitIds.includes(unit.id)
                      const { badgeColor, label } = getUnitStatusBadge(patrimonialUnitStatuses[unit.id] || unit.status)
                      return (
                        <div key={unit.id} className={`flex items-center justify-between gap-4 p-3 ${isSelected ? 'bg-primary/5' : ''}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                onSelectedUnitIdsChange(prev =>
                                  checked ? [...prev, unit.id] : prev.filter(id => id !== unit.id)
                                )
                              }}
                            />
                            <span className="font-mono text-sm font-medium">{unit.patrimonialCode}</span>
                            <Badge className={badgeColor}>{label}</Badge>
                          </div>
                          <Select
                            value={patrimonialUnitStatuses[unit.id] || unit.status}
                            onValueChange={(value: ItemStatus) => onPatrimonialUnitStatusesChange(prev => ({ ...prev, [unit.id]: value }))}
                          >
                            <SelectTrigger className="w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {estados.map((est) => (
                                <SelectItem key={est.id} value={est.name}>{est.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
            <div className="space-y-2">
              <Label htmlFor="category">Categoría *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => onFormDataChange({ ...formData, category: e.target.value })}
                required
                list="categories"
              />
              <datalist id="categories">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unidad de Medida *</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => onFormDataChange({ ...formData, unit: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIDAD">Unidad</SelectItem>
                  <SelectItem value="KG">Kilogramo (Kg)</SelectItem>
                  <SelectItem value="G">Gramo (g)</SelectItem>
                  <SelectItem value="L">Litro (L)</SelectItem>
                  <SelectItem value="ML">Mililitro (mL)</SelectItem>
                  <SelectItem value="M">Metro (m)</SelectItem>
                  <SelectItem value="CM">Centímetro (cm)</SelectItem>
                  <SelectItem value="M2">Metro cuadrado (m²)</SelectItem>
                  <SelectItem value="M3">Metro cúbico (m³)</SelectItem>
                  <SelectItem value="CAJA">Caja</SelectItem>
                  <SelectItem value="PAQUETE">Paquete</SelectItem>
                  <SelectItem value="ROLLO">Rollo</SelectItem>
                  <SelectItem value="GALON">Galón</SelectItem>
                  <SelectItem value="DOCENA">Docena</SelectItem>
                  <SelectItem value="PAR">Par</SelectItem>
                  <SelectItem value="JUEGO">Juego</SelectItem>
                  <SelectItem value="CIENTO">Ciento</SelectItem>
                  <SelectItem value="MILLAR">Millar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="warehouseId">Almacén *</Label>
              <Select
                value={formData.warehouseId}
                onValueChange={(value) => onFormDataChange({ ...formData, warehouseId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione almacén" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => onFormDataChange({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">Stock Mínimo *</Label>
              <Input
                id="minStock"
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) => onFormDataChange({ ...formData, minStock: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <div className="flex gap-2">
                <Select
                  value={formData.status}
                  onValueChange={(value: ItemStatus) => onFormDataChange({ ...formData, status: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {estados.map((est) => (
                      <SelectItem key={est.id} value={est.name}>{est.label}</SelectItem>
                    ))}
                    {estados.length === 0 && (
                      <SelectItem value="OPERATIVO" disabled>No hay estados disponibles</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onOpenEstadosDialog}
                  title="Gestionar estados"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => onFormDataChange({ ...formData, location: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="technicalSpecs">Especificaciones Técnicas</Label>
            <Textarea
              id="technicalSpecs"
              value={formData.technicalSpecs}
              onChange={(e) => onFormDataChange({ ...formData, technicalSpecs: e.target.value })}
              rows={3}
            />
          </div>

          {/* Documento de sustento */}
          <div className="space-y-2">
            <Label>Documento de Sustento</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    onSupportDocumentChange(file)
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir Archivo
              </Button>
              {supportDocument && (
                <span className="text-sm text-muted-foreground">
                  {supportDocument.name}
                </span>
              )}
              {supportDocumentUrl && !supportDocument && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Archivo cargado</span>
                  <DocumentViewerModal
                    url={supportDocumentUrl}
                    title="Documento de Sustento"
                    variant="icon"
                    buttonText="Ver documento"
                  />
                  <a
                    href={supportDocumentUrl}
                    download
                    className="text-blue-600 hover:underline"
                    title="Descargar archivo"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PDF, DOC, DOCX, JPG o PNG (máx. 10MB)
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); onReset() }}>
              Cancelar
            </Button>
            <Button type="submit" style={{ backgroundColor: config?.primaryColor }} disabled={isUploading}>
              {isUploading ? 'Subiendo...' : editingItem ? 'Actualizar' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
