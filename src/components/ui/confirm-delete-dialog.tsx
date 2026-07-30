'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  itemName: string
  onConfirm: () => Promise<void> | void
  onUndo?: () => Promise<void> | void
  undoable?: boolean
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = 'Confirmar eliminación',
  description,
  itemName,
  onConfirm,
  onUndo,
  undoable = true,
}: ConfirmDeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)

      if (undoable && onUndo) {
        toast(`"${itemName}" eliminado`, {
          icon: <Trash2 className="h-4 w-4 text-destructive" />,
          duration: 6000,
          action: {
            label: 'Deshacer',
            onClick: async () => {
              try {
                await onUndo()
                toast.success('Eliminación deshecha')
              } catch {
                toast.error('No se pudo deshacer la eliminación')
              }
            },
          },
        })
      } else {
        toast.success(`"${itemName}" eliminado correctamente`)
      }
    } catch {
      toast.error(`Error al eliminar "${itemName}"`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {description || (
              <>
                ¿Estás seguro de eliminar <strong className="text-foreground">{itemName}</strong>?
                {undoable && ' Esta acción se puede deshacer.'}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-2">
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
            className="gap-2 min-w-[120px]"
          >
            {loading ? (
              <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {undoable ? 'Eliminar' : 'Eliminar permanentemente'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
