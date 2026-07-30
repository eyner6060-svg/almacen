import type { NotifType } from '@/types'
import type { Module } from '@/store/stores/ui.store'

const notifToModuleMap: Record<NotifType, Module> = {
  STOCK_BAJO: 'inventario',
  PEDIDO_PENDIENTE: 'pedidos',
  PEDIDO_AUTORIZADO: 'pedidos',
  PEDIDO_RECHAZADO: 'pedidos',
  BIEN_VENCIDO: 'inventario',
  REPORTE_MENSUAL: 'reportes',
  GARANTIA_PROXIMA_VENCER: 'garantias',
  ITEM_MOVIMIENTO: 'traceability',
  WORKFLOW_EJECUTADO: 'workflows',
  SOLICITUD_COMBUSTIBLE: 'combustible',
  PRESTAMO_CREADO: 'prestamos',
}

export function getModuleFromNotif(type: NotifType): Module {
  return notifToModuleMap[type] || 'dashboard'
}


