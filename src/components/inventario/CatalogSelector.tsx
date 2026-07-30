'use client'

import { useEffect, useState, useCallback } from 'react'
import { normalizeText } from '@/lib/utils'
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, Search, Check } from 'lucide-react'
import type { ItemCatalog } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'

interface CatalogSelectorProps {
  onSelect: (item: ItemCatalog) => void
  buttonText?: string
  buttonVariant?: 'default' | 'outline' | 'ghost'
}

export function CatalogSelector({ 
  onSelect, 
  buttonText = 'Seleccionar del Catálogo',
  buttonVariant = 'outline'
}: CatalogSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [catalog, setCatalog] = useState<ItemCatalog[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(false)

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)

      const response = await apiFetch(`/api/item-catalog?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setCatalog(data.catalog)
        if (data.categories && !search) {
          setCategories(data.categories)
        }
      }
    } catch (error) {
      console.error('Error al obtener catalog:', error)
      toast.error('Error al cargar el catálogo')
    } finally {
      setIsLoading(false)
    }
  }, [search, categoryFilter])

  useEffect(() => {
    if (isOpen) {
      fetchCatalog()
    }
  }, [search, categoryFilter, isOpen, fetchCatalog])

  useEffect(() => {
    if (isOpen) {
      fetchCatalog()
    }
  }, [isOpen, fetchCatalog])

  const handleSelect = (item: ItemCatalog) => {
    onSelect(item)
    setIsOpen(false)
    setSearch('')
    setCategoryFilter('all')
  }

  const filteredCatalog = catalog.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
    if (search) {
      const searchLower = normalizeText(search)
      return normalizeText(item.name).includes(searchLower) ||
             normalizeText(item.brand).includes(searchLower) ||
             normalizeText(item.model).includes(searchLower)
    }
    return true
  })

  // Agrupar por categoría
  const groupedCatalog = filteredCatalog.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category]!.push(item)
    return acc
  }, {} as Record<string, ItemCatalog[]>)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} type="button">
          <BookOpen className="h-4 w-4 mr-2" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[75vh] sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catálogo de Bienes</DialogTitle>
          <DialogDescription>
            Seleccione un bien del catálogo para autocompletar los campos
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-4 py-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, marca o modelo..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Cargando catálogo...</p>
            </div>
          ) : Object.keys(groupedCatalog).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No hay bienes en el catálogo</p>
              <p className="text-xs text-muted-foreground">
                Agregue bienes al catálogo desde Configuración
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedCatalog).map(([category, items]) => (
                <div key={category}>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                    <Badge variant="outline">{category}</Badge>
                    <span className="text-xs">({items.length} items)</span>
                  </h4>
                  <div className="grid gap-2">
                    {items.map(item => (
                      <Card 
                        key={item.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelect(item)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.brand} - {item.model}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {item.unit || 'UNIDAD'}
                                </Badge>
                                {item.technicalSpecs && (
                                  <span className="text-xs text-muted-foreground line-clamp-1">
                                    {item.technicalSpecs}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}
                              </Badge>
                              <Check className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
