'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Package, Edit, Trash2, QrCode, Barcode, MapPin,
  QrCode as QrCodeIcon, RotateCcw, Trash, Archive
} from 'lucide-react'
import { DocumentViewerModal } from '@/components/ui/document-viewer-modal'
import type { Item, ItemStatus, SystemConfig } from '@/types'

interface ItemTableProps {
  viewMode: 'grid' | 'list'
  items: Item[]
  filteredItems: Item[]
  selectedItems: number[]
  isLoading: boolean
  totalPages: number
  page: number
  total: number
  config: SystemConfig | null
  expandedPU: Set<number>
  activeTab: string
  onToggleSelectItem: (id: number) => void
  onToggleSelectAll: () => void
  onSetSelectedItems: (ids: number[]) => void
  onSetPage: (page: number) => void
  onSetExpandedPU: (set: React.SetStateAction<Set<number>>) => void
  onOpenEditDialog: (item: Item) => void
  onDeleteClick: (item: Item) => void
  onOpenQRDialog: (item: Item) => void
  onWhereaboutsClick: (itemId: number, itemName: string) => void
  onGenerateBulkQR: () => void
  onBulkDeleteConfirmOpen: (open: boolean) => void
  getStatusBadge: (status: ItemStatus) => React.ReactNode
  getUnitStatusBadge: (status: string) => { badgeColor: string; label: string }
  onRestore: (id: number) => void
  onPermanentDeleteClick: (item: Item) => void
  onBulkRestore: () => void
  onBulkPermanentDeleteOpen: (open: boolean) => void
}

export function ItemTable({
  viewMode,
  items,
  filteredItems,
  selectedItems,
  isLoading,
  totalPages,
  page,
  total,
  config,
  expandedPU,
  activeTab,
  onToggleSelectItem,
  onToggleSelectAll,
  onSetSelectedItems,
  onSetPage,
  onSetExpandedPU,
  onOpenEditDialog,
  onDeleteClick,
  onOpenQRDialog,
  onWhereaboutsClick,
  onGenerateBulkQR,
  onBulkDeleteConfirmOpen,
  getStatusBadge,
  getUnitStatusBadge,
  onRestore,
  onPermanentDeleteClick,
  onBulkRestore,
  onBulkPermanentDeleteOpen,
}: ItemTableProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (activeTab === 'papelera') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Papelera de Bienes
          </CardTitle>
          <CardDescription>
            Bienes eliminados. Puede restaurarlos o eliminarlos permanentemente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedItems.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedItems.length} bien(es) seleccionado(s)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-green-600" onClick={onBulkRestore}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Restaurar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onBulkPermanentDeleteOpen(true)}>
                    <Trash className="h-4 w-4 mr-1" />
                    Eliminar Permanentemente
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onSetSelectedItems([])}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>La papelera está vacía</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table responsiveCards>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                        onCheckedChange={onToggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Cód. Patrimonial</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Eliminado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className={selectedItems.includes(item.id) ? 'bg-blue-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={() => onToggleSelectItem(item.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{item.code}</TableCell>
                      <TableCell className="font-mono text-blue-600">{item.patrimonialCode || 'S/N'}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('es-PE') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-green-600" onClick={() => onRestore(item.id)}>
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restaurar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onPermanentDeleteClick(item)}>
                          <Trash className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (filteredItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No se encontraron bienes</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Acciones masivas */}
      {selectedItems.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedItems.length} bien(es) seleccionado(s)
              </span>
              <div className="flex gap-2 flex-wrap">
                {items.filter(item => selectedItems.includes(item.id) && item.itemType === 'PATRIMONIAL').length > 0 && (
                  <Button variant="outline" size="sm" onClick={onGenerateBulkQR}>
                    <QrCodeIcon className="h-4 w-4 mr-1" />
                    Generar QR
                  </Button>
                )}
                <Button variant="outline" size="sm" className="text-orange-600" onClick={() => onBulkDeleteConfirmOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Mover a Papelera
                </Button>
                <Button variant="outline" size="sm" onClick={() => onSetSelectedItems([])}>
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'grid' ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="select-all-grid"
                checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                onCheckedChange={() => {
                  if (selectedItems.length === filteredItems.length) {
                    onSetSelectedItems([])
                  } else {
                    onSetSelectedItems(filteredItems.map(item => item.id))
                  }
                }}
              />
              <label htmlFor="select-all-grid" className="text-sm text-muted-foreground cursor-pointer select-none">
                {selectedItems.length === 0
                  ? 'Seleccionar todo'
                  : `${selectedItems.length} de ${filteredItems.length} seleccionado(s)`}
              </label>
              {selectedItems.length > 0 && selectedItems.length < filteredItems.length && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onSetSelectedItems(filteredItems.map(item => item.id))}>
                  Seleccionar todo ({filteredItems.length})
                </Button>
              )}
              {selectedItems.length === filteredItems.length && filteredItems.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onSetSelectedItems([])}>
                  Deseleccionar todo
                </Button>
              )}
            </div>
            {filteredItems.length > 0 && (
              <p className="text-xs text-muted-foreground">{filteredItems.length} bien(es)</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <Card key={item.id} className={`overflow-hidden ${selectedItems.includes(item.id) ? 'ring-2 ring-blue-500' : ''} ${item.quantity === 0 ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800/50' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => onToggleSelectItem(item.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Package className="h-3 w-3" />
                          {item.code}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Marca:</span>
                      <p className="font-medium">{item.brand}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Modelo:</span>
                      <p className="font-medium">{item.model}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Categoría:</span>
                      <p className="font-medium">{item.category}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Cód. Patrimonial:</span>
                      <p className="font-medium text-blue-600">{item.patrimonialCode || 'S/N'}</p>
                    </div>
                    {item.itemType === 'PATRIMONIAL' && item.patrimonialUnits && item.patrimonialUnits.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-xs">Unidades patrimoniales:</span>
                        <div className="flex flex-col gap-1 mt-1">
                          {(expandedPU.has(item.id) ? item.patrimonialUnits : item.patrimonialUnits.slice(0, 3)).filter(pu => pu.isAvailable).map((pu) => {
                            const { badgeColor, label } = getUnitStatusBadge(pu.status)
                            return (
                              <div key={pu.id} className="flex items-center gap-2 text-xs bg-muted/50 px-2 py-1 rounded-md">
                                <span className="font-mono font-medium flex-1">{pu.patrimonialCode}</span>
                                <Badge className={`${badgeColor} text-[10px] px-1.5 py-0`}>{label}</Badge>
                              </div>
                            )
                          })}
                          {item.patrimonialUnits.filter(pu => pu.isAvailable).length > 3 && (
                            <button
                              onClick={() => onSetExpandedPU(prev => {
                                const next = new Set(prev)
                                if (next.has(item.id)) next.delete(item.id); else next.add(item.id)
                                return next
                              })}
                              className="text-xs text-blue-600 hover:underline text-left mt-0.5"
                            >
                              {expandedPU.has(item.id) ? 'Mostrar menos' : `Ver más (${item.patrimonialUnits.filter(pu => pu.isAvailable).length - 3})`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-muted-foreground text-sm">Stock:</span>
                        <Badge variant={item.quantity <= item.minStock ? 'destructive' : 'secondary'} className="ml-2">
                          {item.quantity} / {item.minStock}
                        </Badge>
                        {item.itemType === 'PATRIMONIAL' && item.patrimonialUnits && (() => {
                          const total = item.patrimonialUnits.length
                          const available = item.patrimonialUnits.filter(u => u.isAvailable).length
                          const out = total - available
                          if (out > 0) {
                            return (
                              <Badge variant="outline" className="ml-1 text-orange-600 border-orange-300 text-xs">
                                {available}/{total} disp.
                              </Badge>
                            )
                          }
                          return null
                        })()}
                      </div>
                      {item.supportDocumentUrl && (
                        <DocumentViewerModal
                          url={item.supportDocumentUrl}
                          title={`Documento - ${item.name}`}
                          variant="icon"
                          buttonText="Ver documento de sustento"
                        />
                      )}
                    </div>
                    <div className="flex gap-1">
                      {item.itemType === 'PATRIMONIAL' && item.patrimonialUnits && (() => {
                        const total = item.patrimonialUnits.length
                        const available = item.patrimonialUnits.filter(u => u.isAvailable).length
                        if (available < total) {
                          return (
                            <Button variant="ghost" size="icon" onClick={() => onWhereaboutsClick(item.id, item.name)} title="Ver ubicación de unidades fuera" className="text-orange-500">
                              <MapPin className="h-4 w-4" />
                            </Button>
                          )
                        }
                        return null
                      })()}
                      <Button variant="ghost" size="icon" onClick={() => onOpenQRDialog(item)} title="Ver código QR">
                        <QrCode className="h-4 w-4" />
                      </Button>
                      {item.itemType === 'PATRIMONIAL' && (
                        <Button variant="ghost" size="icon" onClick={() => onOpenQRDialog(item)} title="Ver código de barras">
                          <Barcode className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => onOpenEditDialog(item)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDeleteClick(item)} title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table responsiveCards>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={onToggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Cód. Patrimonial</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className={`${selectedItems.includes(item.id) ? 'bg-blue-50' : ''} ${item.quantity === 0 ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => onToggleSelectItem(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{item.code}</TableCell>
                    <TableCell className="font-mono text-blue-600 whitespace-normal">
                      <span className="truncate block max-w-[120px] sm:max-w-none">{item.patrimonialCode || 'S/N'}</span>
                      {item.itemType === 'PATRIMONIAL' && item.patrimonialUnits && item.patrimonialUnits.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1">
                          {(expandedPU.has(item.id) ? item.patrimonialUnits : item.patrimonialUnits.slice(0, 3)).filter(pu => pu.isAvailable).map((pu) => {
                            const { badgeColor, label } = getUnitStatusBadge(pu.status)
                            return (
                              <span key={pu.id} className="text-[10px] flex items-center gap-1">
                                <Badge className={`${badgeColor} text-[9px] px-1 py-0 leading-tight`}>{label}</Badge>
                                <span className="font-mono truncate max-w-[80px] sm:max-w-none">{pu.patrimonialCode}</span>
                              </span>
                            )
                          })}
                          {item.patrimonialUnits.filter(pu => pu.isAvailable).length > 3 && (
                            <button
                              onClick={() => onSetExpandedPU(prev => {
                                const next = new Set(prev)
                                if (next.has(item.id)) next.delete(item.id); else next.add(item.id)
                                return next
                              })}
                              className="text-[10px] text-blue-600 hover:underline text-left"
                            >
                              {expandedPU.has(item.id) ? 'Mostrar menos' : `Ver más (${item.patrimonialUnits.filter(pu => pu.isAvailable).length - 3})`}
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{item.unit || 'UNIDAD'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.quantity <= item.minStock ? 'destructive' : 'secondary'}>{item.quantity}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.supportDocumentUrl && (
                          <DocumentViewerModal
                            url={item.supportDocumentUrl}
                            title={`Documento - ${item.name}`}
                            variant="icon"
                            buttonText="Ver documento de sustento"
                          />
                        )}
                        {item.itemType === 'PATRIMONIAL' && item.patrimonialUnits && (() => {
                          const total = item.patrimonialUnits.length
                          const available = item.patrimonialUnits.filter(u => u.isAvailable).length
                          if (available < total) {
                            return (
                              <Button variant="ghost" size="icon" onClick={() => onWhereaboutsClick(item.id, item.name)} title="Ver ubicación de unidades fuera" className="text-orange-500">
                                <MapPin className="h-4 w-4" />
                              </Button>
                            )
                          }
                          return null
                        })()}
                        <Button variant="ghost" size="icon" onClick={() => onOpenQRDialog(item)} title="Ver código QR">
                          <QrCode className="h-4 w-4" />
                        </Button>
                        {item.itemType === 'PATRIMONIAL' && (
                          <Button variant="ghost" size="icon" onClick={() => onOpenQRDialog(item)} title="Ver código de barras">
                            <Barcode className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => onOpenEditDialog(item)} title="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDeleteClick(item)} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {totalPages > 1 && !isLoading && filteredItems.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} ({total} bienes)
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onSetPage(Math.max(1, page - 1))}>
              Anterior
            </Button>
            {(() => {
              const pages: (number | string)[] = []
              const delta = 2
              const start = Math.max(1, page - delta)
              const end = Math.min(totalPages, page + delta)
              if (start > 1) { pages.push(1); if (start > 2) pages.push('...') }
              for (let i = start; i <= end; i++) pages.push(i)
              if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages) }
              return pages.map((p, idx) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${idx}`} className="text-muted-foreground px-1">...</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-[36px]"
                    style={p === page ? { backgroundColor: config?.primaryColor } : undefined}
                    onClick={() => onSetPage(p)}
                  >
                    {p}
                  </Button>
                )
              )
            })()}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onSetPage(Math.min(totalPages, page + 1))}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
