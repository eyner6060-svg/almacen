'use client'

import { normalizeText } from '@/lib/utils'
import { useState, useRef, useEffect, startTransition } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command'
import { ChevronsUpDown, Search, Plus } from 'lucide-react'
import type { Item } from '@/types'

interface ItemComboboxProps {
  items: Item[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  filterFn?: (item: Item) => boolean
  customOption?: {
    label: string
    value: string
  }
  onCustomSelect?: () => void
}

export function ItemCombobox({ items, value, onValueChange, placeholder = 'Seleccionar bien', disabled, filterFn, customOption, onCustomSelect }: ItemComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredItems = items.filter(i => {
    if (i.isDeleted) return false
    if (filterFn && !filterFn(i)) return false
    if (!search) return true
    const terms = normalizeText(search).split(/\s+/).filter(Boolean)
    if (terms.length === 0) return true
    const haystack = `${normalizeText(i.name)} ${normalizeText(i.code)} ${normalizeText(i.category ?? '')} ${normalizeText(i.brand ?? '')} ${normalizeText(i.model ?? '')}`
    return terms.every(term => haystack.includes(term))
  })

  const selectedItem = items.find(i => i.id === parseInt(value))

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10)
    } else {
      startTransition(() => setSearch(''))
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedItem ? (
            <span className="truncate">
              {selectedItem.name} - {selectedItem.code}
              <span className="text-muted-foreground ml-1 text-xs">
                ({selectedItem.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'}) Stock: {selectedItem.quantity}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              ref={inputRef}
              placeholder="Buscar por nombre, código..."
              value={search}
              onValueChange={setSearch}
              className="h-10"
            />
          </div>
          <CommandList>
            <CommandEmpty>
              {search ? `Sin resultados para "${search}"` : 'No hay bienes disponibles'}
            </CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {filteredItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={String(item.id)}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue)
                    setOpen(false)
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.code} · {item.itemType === 'PATRIMONIAL' ? 'Patrimonial' : 'Consumible'} · Stock: {item.quantity} {item.unit || 'UNIDAD'}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {customOption && (
              <>
                <CommandSeparator />
                <CommandItem
                  value={customOption.value}
                  onSelect={() => {
                    onCustomSelect?.()
                    setOpen(false)
                  }}
                  className="text-primary font-medium"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {customOption.label}
                </CommandItem>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
