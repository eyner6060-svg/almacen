'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft, ChevronRight, Download, X,
  ZoomIn, ZoomOut, RotateCw,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.mjs'

export default function VisorContent() {
  const searchParams = useSearchParams()
  const url = searchParams.get('url')

  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(container)
    setContainerWidth(container.clientWidth)
    return () => observer.disconnect()
  }, [])

  const onDocumentLoadSuccess = useCallback(({ numPages: np }: { numPages: number }) => {
    setNumPages(np)
    setPageNumber(1)
  }, [])

  if (!url) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <p>No se especificó un documento para visualizar.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-100 dark:bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.close()}>
            <X className="h-4 w-4 mr-1" />
            Cerrar
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={scale <= 0.25}
              onClick={() => setScale((s) => Math.max(0.25, +(s / 1.25).toFixed(2)))}
              title="Alejar"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={scale >= 3}
              onClick={() => setScale((s) => Math.min(3, +(s * 1.25).toFixed(2)))}
              title="Acercar"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScale(1)}
              title="Ajustar al ancho"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-px h-5 bg-border mx-1" />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {pageNumber} / {numPages || '?'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pageNumber >= numPages}
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="outline" size="sm" asChild>
            <a href={url} download>
              <Download className="h-3.5 w-3.5 mr-1" />
              Descargar
            </a>
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex flex-col items-center py-4"
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="text-sm">Cargando documento...</span>
              </div>
            </div>
          }
          error={
            <div className="flex flex-col items-center gap-3 min-h-[50vh] justify-center text-muted-foreground">
              <p className="text-sm">No se pudo cargar el PDF</p>
            </div>
          }
        >
          {numPages > 0 && (
            <Page
              pageNumber={pageNumber}
              width={containerWidth || undefined}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          )}
        </Document>
      </div>
    </div>
  )
}
