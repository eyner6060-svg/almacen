'use client'

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Order } from '@/types'

interface OrderItemsTableProps {
  order: Order
}

export function OrderItemsTable({ order }: OrderItemsTableProps) {
  return (
    <div>
      <h4 className="font-semibold mb-3">Bienes Solicitados</h4>
      <div className="border rounded-lg overflow-x-auto">
        <Table responsiveCards>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[100px]">Código</TableHead>
              <TableHead className="min-w-[200px]">Nombre</TableHead>
              <TableHead hideOnMobile>Tipo</TableHead>
              <TableHead hideOnMobile>Estado</TableHead>
              <TableHead hideOnMobile>Color</TableHead>
              <TableHead hideOnMobile className="text-center">Unidad</TableHead>
              <TableHead className="text-right min-w-[80px]">Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((oi) => (
              <TableRow key={oi.id}>
                <TableCell className="font-mono text-sm">{oi.item.code}</TableCell>
                <TableCell>
                  <p className="font-medium">{oi.item.name}</p>
                  <p className="text-xs text-muted-foreground">{oi.item.brand} {oi.item.model}</p>
                </TableCell>
                <TableCell hideOnMobile>
                  <Badge variant={oi.item.itemType === 'PATRIMONIAL' ? 'default' : 'secondary'}>
                    {oi.item.itemType === 'PATRIMONIAL' ? '🔐 Patrimonial' : '📦 Consumible'}
                  </Badge>
                </TableCell>
                <TableCell hideOnMobile>
                  {oi.item.itemType === 'PATRIMONIAL' && oi.patrimonialUnit ? (
                    <Badge variant={oi.patrimonialUnit.status === 'OPERATIVO' ? 'outline' : 'destructive'}>
                      {oi.patrimonialUnit.status}
                    </Badge>
                  ) : (
                    <Badge variant={oi.item.status === 'OPERATIVO' ? 'outline' : 'destructive'}>
                      {oi.item.status}
                    </Badge>
                  )}
                </TableCell>
                <TableCell hideOnMobile className="text-sm">{oi.item.color || '-'}</TableCell>
                <TableCell hideOnMobile className="text-center text-sm">{oi.item.unit || 'UNIDAD'}</TableCell>
                <TableCell className="text-right font-medium">{oi.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
