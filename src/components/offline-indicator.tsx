'use client';

import { useOffline } from '@/hooks/use-offline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Clock,
  CheckCircle2,
  Trash2,
  Package,
  QrCode,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const {
    isOnline,
    isOffline,
    pendingOperations,
    pendingCount,
    syncNow,
    clearPending,
    removePendingOperation,
  } = useOffline();

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <FileText className="h-4 w-4" />;
      case 'scan':
        return <QrCode className="h-4 w-4" />;
      case 'item':
        return <Package className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getOperationLabel = (type: string, url: string) => {
    switch (type) {
      case 'order':
        return 'Pedido pendiente';
      case 'scan':
        return 'Escaneo pendiente';
      case 'item':
        return 'Actualización de item';
      default:
        return url.split('/').pop() || 'Operación pendiente';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) {
      return 'Hace un momento';
    } else if (diff < 3600000) {
      return `Hace ${Math.floor(diff / 60000)} minutos`;
    } else if (diff < 86400000) {
      return `Hace ${Math.floor(diff / 3600000)} horas`;
    } else {
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  return (
    <>
      {/* Banner sin conexión */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          Sin conexión - Los cambios se guardarán localmente
        </div>
      )}

      {/* Indicador de operaciones pendientes */}
      {pendingCount > 0 && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'fixed bottom-4 right-4 z-40 gap-2 shadow-lg',
                isOffline ? 'bg-amber-500 text-amber-950 hover:bg-amber-600' : 'bg-primary text-primary-foreground'
              )}
            >
              <RefreshCw className="h-4 w-4 animate-spin-slow" />
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {isOnline ? (
                  <>
                    <Wifi className="h-5 w-5 text-green-500" />
                    Operaciones Pendientes
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-amber-500" />
                    Modo Offline
                  </>
                )}
              </SheetTitle>
              <SheetDescription>
                {isOnline
                  ? 'Tienes operaciones pendientes de sincronización.'
                  : 'Estás sin conexión. Las operaciones se procesarán cuando vuelvas a estar en línea.'}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4">
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {pendingOperations.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-start justify-between p-3 rounded-lg border bg-muted/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-muted-foreground">
                          {getOperationIcon(op.type)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {getOperationLabel(op.type, op.url)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(op.timestamp)}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {op.method}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removePendingOperation(op.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="mt-4 flex gap-2">
              {isOnline && (
                <Button
                  onClick={syncNow}
                  className="flex-1 gap-2"
                  disabled={pendingCount === 0}
                >
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar Ahora
                </Button>
              )}
              <Button
                variant="outline"
                onClick={clearPending}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Limpiar
              </Button>
            </div>

            {isOnline && (
              <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Conexión establecida
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Las operaciones pendientes se sincronizarán automáticamente.
                </p>
              </div>
            )}

            {isOffline && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <WifiOff className="h-4 w-4" />
                  Sin conexión
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Verifica tu conexión a internet para sincronizar.
                </p>
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

export default OfflineIndicator;
