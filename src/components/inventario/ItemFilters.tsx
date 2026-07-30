'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Search } from 'lucide-react'
import type { ItemStatusEnum, SystemConfig } from '@/types'

interface ItemFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryFilterChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  itemTypeFilter: 'all' | 'CONSUMIBLE' | 'PATRIMONIAL'
  onItemTypeFilterChange: (value: 'all' | 'CONSUMIBLE' | 'PATRIMONIAL') => void
  categories: string[]
  estados: ItemStatusEnum[]
  config: SystemConfig | null
}

export function ItemFilters({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  itemTypeFilter,
  onItemTypeFilterChange,
  categories,
  estados,
  config,
}: ItemFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, código o código patrimonial..."
              className="pl-10"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {estados.map((est) => (
                <SelectItem key={est.id} value={est.name}>{est.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            Tipo de bien:
          </span>
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant={itemTypeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onItemTypeFilterChange('all')}
              style={itemTypeFilter === 'all' ? { backgroundColor: config?.primaryColor } : undefined}
            >
              Todos
            </Button>
            <Button
              variant={itemTypeFilter === 'PATRIMONIAL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onItemTypeFilterChange('PATRIMONIAL')}
              style={itemTypeFilter === 'PATRIMONIAL' ? { backgroundColor: config?.primaryColor } : undefined}
            >
              Patrimoniales
            </Button>
            <Button
              variant={itemTypeFilter === 'CONSUMIBLE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onItemTypeFilterChange('CONSUMIBLE')}
              style={itemTypeFilter === 'CONSUMIBLE' ? { backgroundColor: config?.primaryColor } : undefined}
            >
              Consumibles
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
