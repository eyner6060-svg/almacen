'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  Dialog, DialogContent, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Eye, ExternalLink, File, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, Download,
  ZoomIn, ZoomOut, RotateCw,
} from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.mjs'

function detectFileType(url: string): 'pdf' | 'image' | 'other' {
  const base = url.split('?')[0] || ''
  const ext = base.split('.').pop()?.toLowerCase() || ''
  if (['pdf'].includes(ext)) return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image'
  return 'other'
}

function getFileName(url: string): string {
  const parts = url.split('/')
  return parts[parts.length - 1]?.split('?')[0] || url
}

interface DocumentViewerModalProps {
  url: string
  title?: string
  fileName?: string
  trigger?: React.ReactNode
  variant?: 'icon' | 'text' | 'button'
  buttonText?: string
}

export function DocumentViewerModal({
  url,
  title,
  fileName,
  trigger,
  variant = 'text',
  buttonText = 'Ver Documento',
}: DocumentViewerModalProps) {
  const [open, setOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const fileType = detectFileType(url)
  const displayName = fileName || getFileName(url)
  const modalTitle = title || displayName

  useEffect(() => {
    if (!open || fileType !== 'pdf') return
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
  }, [open, fileType])

  const onDocumentLoadSuccess = useCallback(({ numPages: np }: { numPages: number }) => {
    setNumPages(np)
    setPageNumber(1)
  }, [])

  if (!url) return null

  const defaultTrigger = variant === 'icon' ? (
    <Button variant="ghost" size="icon" title={buttonText}>
      <Eye className="h-4 w-4" />
    </Button>
  ) : variant === 'button' ? (
    <Button variant="default" size="default" className="gap-2">
      <Eye className="h-4 w-4" />
      {buttonText}
    </Button>
  ) : (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors text-sm font-medium"
      title={buttonText}
    >
      <Eye className="h-4 w-4" />
      {buttonText}
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen} modal>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent
        className="max-w-[95vw] sm:max-w-5xl w-full h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 gap-2">
          <DialogTitle className="text-base truncate pr-4">{modalTitle}</DialogTitle>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" asChild>
              <a href={url} download={displayName}>
                <Download className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline text-xs">Descargar</span>
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={fileType === 'pdf' ? `/visor?url=${encodeURIComponent(url)}` : url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden sm:inline">Abrir</span>
              </a>
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-all duration-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              <span className="sr-only">Cerrar</span>
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex-1 relative min-h-[50vh] bg-zinc-100 dark:bg-zinc-900 overflow-auto flex flex-col items-center"
        >
          {fileType === 'pdf' ? (
            <>
              <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-sm">Cargando documento...</span>
                    </div>
                  </div>
                }
                error={
                  <div className="flex flex-col items-center gap-3 min-h-[50vh] justify-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 text-destructive" />
                    <span className="text-sm">No se pudo cargar el PDF</span>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/visor?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Abrir en nueva pestaña
                      </a>
                    </Button>
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

              {numPages > 0 && (
                <div className="sticky bottom-0 flex items-center gap-2 py-2 px-4 bg-background/90 border-t w-full justify-center">
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
                      className="hidden sm:inline-flex"
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
                      {pageNumber} / {numPages}
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
                </div>
              )}
            </>
          ) : fileType === 'image' ? (
            <div className="flex items-center justify-center h-full p-6">
              {imageError ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <span className="text-sm">No se pudo cargar la imagen</span>
                  <Button variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Abrir en nueva pestaña
                    </a>
                  </Button>
                </div>
              ) : (
                <img
                  src={url}
                  alt={modalTitle}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  onError={() => setImageError(true)}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 min-h-[400px] h-full text-muted-foreground">
              <File className="h-16 w-16" />
              <div className="text-center">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs mt-1">Vista previa no disponible para este tipo de archivo</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Abrir en nueva pestaña
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
