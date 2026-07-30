'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const VisorContent = dynamic(() => import('./visor-content'), { ssr: false })

export default function VisorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">Cargando visor...</span>
        </div>
      </div>
    }>
      <VisorContent />
    </Suspense>
  )
}
