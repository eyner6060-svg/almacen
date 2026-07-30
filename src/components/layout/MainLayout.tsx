'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore, useSidebarStore, useModuleStore, useConfigStore, useNotificationsStore, useThemeStore, useSearchStore, type Module } from '@/store'
import Image from 'next/image'
import { DefaultLogoIcon } from '@/components/ui/default-logo'
import { OfflineIndicator } from '@/components/offline-indicator'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsHelp } from '@/components/ui/keyboard-shortcuts-help'
import { apiFetch } from '@/lib/http'
import { getModuleFromNotif } from '@/lib/navigation'
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  Building2,
  Warehouse,
  Settings,
  User,
  UserCheck,
  Bell,
  Search,
  Menu,
  LogOut,
  ChevronLeft,
  PackageX,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Fuel,
  PenTool,
  Truck,
  BookOpen,
  Moon,
  Sun,
  QrCode,
  Zap,
  Shield,
  Save,
  Command,
  HelpCircle,
  ArrowLeftToLine,
  FileSearch,
  Trash2,
} from 'lucide-react'
import type { Role, Notification, NotifType } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface MainLayoutProps {
  children: React.ReactNode
  onLogout: () => void
}

const menuItems: Array<{
  id: string
  label: string
  icon: React.ElementType
  roles: Role[]
  isDriverOnly?: boolean
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'] },
  { id: 'inventario', label: 'Inventario', icon: Package, roles: ['ADMINISTRADOR', 'ALMACENERO'] },
  { id: 'bienes-asignados', label: 'Bienes Asignados', icon: UserCheck, roles: ['ADMINISTRADOR', 'ALMACENERO'] },
  { id: 'retorno', label: 'Retorno de Bienes', icon: ArrowLeftToLine, roles: ['ADMINISTRADOR', 'ALMACENERO'] },
  { id: 'catalogo', label: 'Catálogo', icon: BookOpen, roles: ['ADMINISTRADOR', 'ALMACENERO'] },
  { id: 'ingresos', label: 'Ingresos', icon: TrendingUp, roles: ['ADMINISTRADOR', 'ALMACENERO'] },
  { id: 'prestamos', label: 'Préstamos', icon: BookOpen, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'] },
  { id: 'pedidos', label: 'Pedidos', icon: ClipboardList, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'] },
  { id: 'predicciones', label: 'Predicciones', icon: TrendingUp, roles: ['ADMINISTRADOR', 'ALMACENERO'] },
  { id: 'reportes', label: 'Reportes', icon: FileText, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'] },
  { id: 'traceability', label: 'Trazabilidad', icon: QrCode, roles: ['ADMINISTRADOR', 'ALMACENERO'] },
  { id: 'garantias', label: 'Garantías', icon: Shield, roles: ['ADMINISTRADOR', 'ALMACENERO'] },
  { id: 'combustible', label: 'Combustible', icon: Fuel, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'], isDriverOnly: true },
  { id: 'workflows', label: 'Flujos de Trabajo', icon: Zap, roles: ['ADMINISTRADOR'] },
  { id: 'sincronizacion', label: 'Sync SIGA', icon: TrendingUp, roles: ['ADMINISTRADOR'] },
  { id: 'api-docs', label: 'API Docs', icon: BookOpen, roles: ['ADMINISTRADOR'] },
  { id: 'auditoria-forense', label: 'Auditoría Forense', icon: Shield, roles: ['ADMINISTRADOR'] },
  { id: 'firma-digital', label: 'Firma Digital', icon: PenTool, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'] },
  { id: 'tdr', label: 'Términos de Referencia', icon: FileSearch, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'] },
  { id: 'papelera', label: 'Papelera', icon: Trash2, roles: ['ADMINISTRADOR', 'JEFE_OFICINA'] },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'] },
  { id: 'usuarios', label: 'Usuarios', icon: Users, roles: ['ADMINISTRADOR'] },
  { id: 'autorizadores', label: 'Autorizadores', icon: Shield, roles: ['ADMINISTRADOR'] },
  { id: 'backups', label: 'Backups', icon: Save, roles: ['ADMINISTRADOR'] },
  { id: 'vehiculos', label: 'Vehículos', icon: Truck, roles: ['ADMINISTRADOR'] },
  { id: 'oficinas', label: 'Oficinas', icon: Building2, roles: ['ADMINISTRADOR'] },
  { id: 'almacenes', label: 'Almacenes', icon: Warehouse, roles: ['ADMINISTRADOR'] },
  { id: 'firmas', label: 'Config. Firmas', icon: PenTool, roles: ['ADMINISTRADOR'] },
  { id: 'configuracion', label: 'Configuración', icon: Settings, roles: ['ADMINISTRADOR'] },
  { id: 'perfil', label: 'Mi Perfil', icon: User, roles: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'] },
]

const menuCategories = [
  { label: 'PRINCIPAL', items: ['dashboard'] },
  { label: 'GESTIÓN', items: ['inventario', 'catalogo', 'ingresos', 'pedidos', 'prestamos', 'retorno', 'bienes-asignados', 'tdr'] },
  { label: 'MONITOREO', items: ['predicciones', 'reportes', 'traceability', 'garantias', 'combustible'] },
  { label: 'AUTOMATIZACIÓN', items: ['workflows', 'sincronizacion'] },
  { label: 'SEGURIDAD', items: ['api-docs', 'auditoria-forense', 'firma-digital', 'papelera', 'notificaciones'] },
  { label: 'CONFIGURACIÓN', items: ['usuarios', 'vehiculos', 'oficinas', 'almacenes', 'firmas', 'backups', 'configuracion', 'perfil'] },
]

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function getRoleLabel(role: Role) {
  const labels: Record<Role, string> = {
    ADMINISTRADOR: 'Administrador',
    ALMACENERO: 'Almacenero',
    JEFE_OFICINA: 'Jefe de Oficina',
    TRABAJADOR: 'Trabajador',
  }
  return labels[role]
}

function getNotifIcon(type: NotifType) {
  switch (type) {
    case 'STOCK_BAJO': return <PackageX className="h-4 w-4 text-orange-500" />
    case 'PEDIDO_PENDIENTE': return <Clock className="h-4 w-4 text-blue-500" />
    case 'PEDIDO_AUTORIZADO': return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'PEDIDO_RECHAZADO': return <XCircle className="h-4 w-4 text-red-500" />
    case 'BIEN_VENCIDO': return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'REPORTE_MENSUAL': return <FileText className="h-4 w-4 text-purple-500" />
    case 'SOLICITUD_COMBUSTIBLE': return <Fuel className="h-4 w-4 text-yellow-500" />
    default: return <Bell className="h-4 w-4 text-gray-500" />
  }
}

function getNotifLabel(type: NotifType) {
  const labels: Record<NotifType, string> = {
    STOCK_BAJO: 'Stock Bajo',
    PEDIDO_PENDIENTE: 'Pedido Pendiente',
    PEDIDO_AUTORIZADO: 'Pedido Autorizado',
    PEDIDO_RECHAZADO: 'Pedido Rechazado',
    BIEN_VENCIDO: 'Bien Vencido',
    REPORTE_MENSUAL: 'Reporte Mensual',
    GARANTIA_PROXIMA_VENCER: 'Garantía por Vencer',
    ITEM_MOVIMIENTO: 'Movimiento de Ítem',
    WORKFLOW_EJECUTADO: 'Flujo Ejecutado',
    SOLICITUD_COMBUSTIBLE: 'Solicitud de Combustible',
    PRESTAMO_CREADO: 'Préstamo Creado',
  }
  return labels[type]
}

interface SidebarContentProps {
  isOpen: boolean
  currentModule: string
  onMenuClick: (id: string) => void
}

const SidebarContent = React.memo(function SidebarContent({ isOpen, currentModule, onMenuClick }: SidebarContentProps) {
  const user = useAuthStore(s => s.user)
  const config = useConfigStore(s => s.config)
  const primaryColor = config?.primaryColor || '#1e40af'
  const institutionName = config?.institutionName || 'Almacén Institucional'

  const filteredMenuItems = menuItems.filter(item => {
    const hasRolePermission = user && item.roles.includes(user.role)
    const isDriverAndFuel = item.id === 'combustible' && user?.isDriver === true
    return hasRolePermission || isDriverAndFuel
  })

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b dark:border-zinc-800">
        <div className="flex items-center gap-2">
          {config?.logoUrl ? (
            <Image src={config.logoUrl} alt="Logo" className="h-8 w-8 object-contain flex-shrink-0" width={32} height={32} priority />
          ) : (
            <div className="flex-shrink-0">
              <DefaultLogoIcon size="sm" color={primaryColor} />
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <h1 className="font-semibold text-xs truncate whitespace-nowrap dark:text-white">{institutionName}</h1>
            <p className="text-[10px] text-muted-foreground dark:text-zinc-400 truncate whitespace-nowrap">Sistema de Gestión</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4 [&>[data-slot=scroll-area-viewport]>div]:!block [&>[data-slot=scroll-area-viewport]]:!block">
        <nav className="px-2 space-y-1">
          {(() => {
            const shownCategories = new Set<string>()
            return filteredMenuItems.map((item) => {
              const category = menuCategories.find(cat => cat.items.includes(item.id))?.label
              const showCategory = category && !shownCategories.has(category)
              if (category) shownCategories.add(category)
              const isActive = currentModule === item.id
              const Icon = item.icon
              return (
                <React.Fragment key={item.id}>
                  {showCategory && isOpen && (
                    <div className="px-3 pt-4 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{category}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onMenuClick(item.id)}
                    className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isOpen ? 'justify-start' : 'justify-center'
                    } ${
                      isActive
                        ? 'text-white shadow-sm bg-[var(--color-primary)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-zinc-800/50'
                    }`}
                    title={!isOpen ? item.label : undefined}
                  >
                    {isActive && isOpen && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-white/90 shadow-sm" />
                    )}
                    <span className="transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-5deg]">
                      <Icon className="h-5 w-5 flex-shrink-0" />
                    </span>
                    {isOpen && <span className="truncate">{item.label}</span>}
                  </button>
                </React.Fragment>
              )
            })
          })()}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="text-xs" style={{ backgroundColor: primaryColor, color: 'white' }}>
              {user ? getInitials(user.fullName) : '?'}
            </AvatarFallback>
          </Avatar>
          {isOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight dark:text-white">{user?.fullName}</p>
              <p className="text-[11px] text-muted-foreground dark:text-zinc-400 truncate">{user ? getRoleLabel(user.role) : ''}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export function MainLayout({ children, onLogout }: MainLayoutProps) {
  const user = useAuthStore(s => s.user)
  const isOpen = useSidebarStore(s => s.isOpen)
  const toggle = useSidebarStore(s => s.toggle)
  const currentModule = useModuleStore(s => s.currentModule)
  const setModule = useModuleStore(s => s.setModule)
  const config = useConfigStore(s => s.config)
  const notifications = useNotificationsStore(s => s.notifications)
  const unreadCount = useNotificationsStore(s => s.unreadCount)
  const setNotifications = useNotificationsStore(s => s.setNotifications)
  const setUnreadCount = useNotificationsStore(s => s.setUnreadCount)
  const isDarkMode = useThemeStore(s => s.isDarkMode)
  const toggleDarkMode = useThemeStore(s => s.toggleDarkMode)
  const setSearchOpen = useSearchStore(s => s.setSearchOpen)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentModule])

  const primaryColor = config?.primaryColor || '#1e40af'

  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      handler: () => !isMobile && setSearchOpen(true),
      description: 'Abrir búsqueda global',
    },
    {
      key: 'b',
      ctrl: true,
      handler: () => toggle(),
      description: 'Alternar sidebar',
    },
    {
      key: 'n',
      ctrl: true,
      handler: () => {
        const btn = document.querySelector<HTMLButtonElement>('[data-keyboard="new"]')
        btn?.click()
      },
      description: 'Nuevo elemento',
    },
    {
      key: '/',
      shift: true,
      handler: () => setHelpOpen(true),
      description: 'Atajos de teclado',
    },
    {
      key: '?',
      handler: () => setHelpOpen(true),
      description: 'Atajos de teclado',
    },
  ])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) setMobileSheetOpen(false)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      document.body.style.setProperty('--sidebar-width', '4rem')
    } else {
      document.body.style.setProperty('--sidebar-width', '16rem')
    }
  }, [isOpen])

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await apiFetch('/api/notifications')
        if (response.ok) {
          const data = await response.json()
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        }
      } catch { /* ignorar */ }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [setNotifications, setUnreadCount])

  const handleMenuClick = useCallback((moduleId: string) => {
    setModule(moduleId as Module)
    if (isMobile) setMobileSheetOpen(false)
  }, [setModule, isMobile])

  const handleMarkAsRead = useCallback(async (notifId: number) => {
    try {
      await apiFetch(`/api/notifications/${notifId}/read`, { method: 'PUT' })
      setNotifications(notifications.map((n: Notification) =>
        n.id === notifId ? { ...n, isRead: true } : n
      ))
      setUnreadCount(Math.max(0, unreadCount - 1))
    } catch { /* ignorar */ }
    }, [notifications, setNotifications, unreadCount, setUnreadCount])

  return (
    <div className="min-h-screen flex flex-col bg-muted/30 dark:bg-zinc-950">
      {/* Barra superior */}
      <header className="h-14 border-b bg-white dark:bg-zinc-900 dark:border-zinc-800 flex items-center px-2 sm:px-4 gap-2 sm:gap-4 sticky top-0 z-50">
        {isMobile ? (
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5 dark:text-zinc-300" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 sm:w-64 dark:bg-zinc-900 dark:border-zinc-800 overflow-y-auto">
              <SidebarContent isOpen={true} currentModule={currentModule} onMenuClick={handleMenuClick} />
            </SheetContent>
          </Sheet>
        ) : (
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="relative group"
              title={isOpen ? 'Contraer sidebar (Ctrl+B)' : 'Expandir sidebar (Ctrl+B)'}
            >
              <span className="transition-transform duration-300 group-hover:scale-110">
                {isOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </span>
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                {isOpen ? 'Contraer' : 'Expandir'}
              </span>
            </Button>
            <div className={`h-6 w-px bg-border mx-1 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`} />
          </div>
        )}

        <div className="flex-1 flex items-center gap-4">
          <button
            ref={searchBtnRef}
            onClick={() => setSearchOpen(true)}
            className="relative hidden sm:flex items-center flex-1 max-w-md h-9 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Search className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Buscar módulos...</span>
            <kbd className="ml-auto hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-muted rounded">
              <Command className="h-3 w-3" />K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="dark:text-yellow-400">
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 dark:text-zinc-300" />
                {unreadCount > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    style={{ backgroundColor: config?.accentColor || '#f59e0b' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-96">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notificaciones</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{unreadCount} sin leer</Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="max-h-80">
                {notifications && notifications.length > 0 ? (
                  notifications.slice(0, 10).map((notif: Notification) => (
                    <DropdownMenuItem
                      key={notif.id}
                      className={`flex items-start gap-3 p-3 cursor-pointer ${!notif.isRead ? 'bg-muted/50' : ''}`}
                      onClick={() => {
                        if (!notif.isRead) handleMarkAsRead(notif.id)
                        handleMenuClick(getModuleFromNotif(notif.type))
                      }}
                    >
                      <div className="flex-shrink-0 mt-0.5">{getNotifIcon(notif.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{getNotifLabel(notif.type)}</p>
                          {!notif.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="p-4 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Sin notificaciones</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Las notificaciones aparecerán aquí</p>
                  </div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-1 sm:gap-2 px-2 sm:px-4">
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                  <AvatarFallback style={{ backgroundColor: primaryColor, color: 'white' }}>
                    {user ? getInitials(user.fullName) : '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm">{user?.fullName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 sm:w-56">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleMenuClick('perfil')}>
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="flex flex-1 min-h-0">
        {!isMobile && (
          <aside
            className={`border-r bg-white dark:bg-zinc-900 dark:border-zinc-800 transition-all duration-300 overflow-hidden h-full ${isOpen ? 'w-64' : 'w-16'}`}
          >
            <SidebarContent isOpen={isOpen} currentModule={currentModule} onMenuClick={handleMenuClick} />
          </aside>
        )}

        <main ref={mainRef} className="flex-1 overflow-auto h-full">
          <div className="p-5 md:p-8 mx-auto w-full max-w-7xl space-y-6">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      <footer className="h-10 border-t bg-white dark:bg-zinc-900 dark:border-zinc-800 flex items-center justify-center px-4 text-sm text-muted-foreground dark:text-zinc-500">
        {config?.footerText || `© ${new Date().getFullYear()} ${config?.institutionName || 'Almacén Institucional'} - Ayacucho, Perú`}
      </footer>

      <OfflineIndicator />

      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />

      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-4 right-4 z-50 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        title="Atajos de teclado"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    </div>
  )
}
