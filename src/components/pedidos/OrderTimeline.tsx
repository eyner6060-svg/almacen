'use client'

import { Check, ArrowRight, XCircle } from 'lucide-react'
import type { Order } from '@/types'

interface OrderTimelineProps {
  order: Order
}

export function OrderTimeline({ order }: OrderTimelineProps) {
  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <h4 className="font-medium mb-3 text-sm text-slate-600">Flujo de Autorización</h4>
      <div className="flex items-center justify-between">
        {['PENDIENTE', 'AUTORIZADO_JEFE', 'AUTORIZADO_ALMACENERO', 'COMPLETADO'].map((step, idx) => {
          const isActive = order.status === step
          const isPast = ['PENDIENTE', 'AUTORIZADO_JEFE', 'AUTORIZADO_ALMACENERO', 'COMPLETADO'].indexOf(order.status) > idx
          const isRejected = order.status === 'RECHAZADO'

          return (
            <div key={step} className="flex items-center">
              <div className={`flex flex-col items-center ${isRejected && idx > 0 ? 'opacity-30' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-blue-500 text-white' :
                  isPast ? 'bg-green-500 text-white' :
                  'bg-slate-200 text-slate-500'
                }`}>
                  {isPast ? <Check className="h-5 w-5" /> : idx + 1}
                </div>
                <span className="text-xs mt-1 text-center max-w-[80px]">
                  {step === 'PENDIENTE' ? 'Pendiente' :
                   step === 'AUTORIZADO_JEFE' ? 'Jefe' :
                   step === 'AUTORIZADO_ALMACENERO' ? 'Almacén' :
                   'Entregado'}
                </span>
              </div>
              {idx < 3 && (
                <ArrowRight className={`h-5 w-5 mx-2 ${isPast ? 'text-green-500' : 'text-slate-300'}`} />
              )}
            </div>
          )
        })}
      </div>
      {order.status === 'RECHAZADO' && (
        <div className="mt-3 p-2 bg-red-100 rounded text-center">
          <XCircle className="h-5 w-5 text-red-500 inline mr-2" />
          <span className="text-red-700 font-medium">Pedido Rechazado</span>
        </div>
      )}
    </div>
  )
}
