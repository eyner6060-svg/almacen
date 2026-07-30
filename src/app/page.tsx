'use client'

import { useEffect, useState, Suspense, type ComponentType } from 'react'
import { useAuthStore, useModuleStore } from '@/store'
import { apiFetch } from '@/lib/http'
import { AnimatePresence, motion } from 'framer-motion'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { Building2 } from 'lucide-react'
import type { Module } from '@/store'
import dynamic from 'next/dynamic'

type ModuleProps = { onNavigate?: (m: string) => void }

const MODULE_MAP: Record<string, () => Promise<{ default: ComponentType<ModuleProps> }>> = {
  dashboard: () => import('@/components/dashboard/DashboardModule').then(m => ({ default: m.DashboardModule as ComponentType<ModuleProps> })),
  inventario: () => import('@/components/inventario/InventarioModule').then(m => ({ default: m.InventarioModule })),
  catalogo: () => import('@/components/catalogo/CatalogManagementModule').then(m => ({ default: m.CatalogManagementModule })),
  pedidos: () => import('@/components/pedidos/PedidosModule').then(m => ({ default: m.PedidosModule })),
  ingresos: () => import('@/components/ingresos/IngresosModule').then(m => ({ default: m.IngresosModule })),
  usuarios: () => import('@/components/usuarios/UsuariosModule').then(m => ({ default: m.UsuariosModule })),
  vehiculos: () => import('@/components/vehiculos/VehiculosModule').then(m => ({ default: m.VehiculosModule })),
  oficinas: () => import('@/components/oficinas/OficinasModule').then(m => ({ default: m.OficinasModule })),
  almacenes: () => import('@/components/almacenes/AlmacenesModule').then(m => ({ default: m.AlmacenesModule })),
  configuracion: () => import('@/components/configuracion/ConfiguracionModule').then(m => ({ default: m.ConfiguracionModule })),
  perfil: () => import('@/components/perfil/PerfilModule').then(m => ({ default: m.PerfilModule })),
  combustible: () => import('@/components/combustible/CombustibleModule').then(m => ({ default: m.CombustibleModule })),
  firmas: () => import('@/components/firmas/SignatureConfigModule').then(m => ({ default: m.SignatureConfigModule })),
  reportes: () => import('@/components/reportes/ReportesModule').then(m => ({ default: m.ReportesModule })),
  notificaciones: () => import('@/components/notificaciones/NotificacionesModule').then(m => ({ default: m.NotificacionesModule })),
  workflows: () => import('@/components/workflows/WorkflowsModule').then(m => ({ default: m.WorkflowsModule })),
  traceability: () => import('@/components/traceability/TraceabilityModule').then(m => ({ default: m.TraceabilityModule })),
  garantias: () => import('@/components/garantias/GarantiasModule').then(m => ({ default: m.GarantiasModule })),
  'api-docs': () => import('@/components/api-docs/ApiDocsModule').then(m => ({ default: m.ApiDocsModule })),
  predicciones: () => import('@/components/predicciones/PrediccionesModule').then(m => ({ default: m.PrediccionesModule })),
  sincronizacion: () => import('@/components/sincronizacion/SincronizacionModule').then(m => ({ default: m.SincronizacionModule })),
  'auditoria-forense': () => import('@/components/auditoria-forense/AuditoriaForenseModule').then(m => ({ default: m.AuditoriaForenseModule })),
  'firma-digital': () => import('@/components/firma-digital/FirmaDigitalModule').then(m => ({ default: m.FirmaDigitalModule })),
  'bienes-asignados': () => import('@/components/bienes-asignados/BienesAsignadosModule').then(m => ({ default: m.BienesAsignadosModule })),
  prestamos: () => import('@/components/prestamos/PrestamosModule').then(m => ({ default: m.PrestamosModule })),
  autorizadores: () => import('@/components/autorizadores/AutorizadoresModule').then(m => ({ default: m.AutorizadoresModule })),
  backups: () => import('@/components/backups/BackupsModule').then(m => ({ default: m.BackupsModule })),
  retorno: () => import('@/components/retorno/RetornoModule').then(m => ({ default: m.RetornoModule })),
  tdr: () => import('@/components/tdr/TDRModule').then(m => ({ default: m.TDRModule })),
  papelera: () => import('@/components/trash/PapeleraModule').then(m => ({ default: m.PapeleraModule })),
}

const DynamicModules: Record<string, ComponentType<any>> = {}
for (const [key, loader] of Object.entries(MODULE_MAP)) {
  DynamicModules[key] = dynamic(loader as any, {
    ssr: false,
    loading: () => <ModuleSkeleton variant="cards" />,
  })
}

const LoginForm = dynamic(() => import('@/components/auth/LoginForm').then(m => ({ default: m.LoginForm })), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e40af] via-[#1e3a8a] to-[#172554]"><div className="text-white text-xl">Cargando...</div></div>,
})

const MainLayout = dynamic(() => import('@/components/layout/MainLayout').then(m => ({ default: m.MainLayout })), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Cargando...</div></div>,
})

const moduleVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' as const } },
}

export default function Home() {
  const user = useAuthStore(s => s.user)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const isLoading = useAuthStore(s => s.isLoading)
  const setUser = useAuthStore(s => s.setUser)
  const logout = useAuthStore(s => s.logout)
  const currentModule = useModuleStore(s => s.currentModule)
  const setModule = useModuleStore(s => s.setModule)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ready && !isLoading) {
      const verify = async () => {
        try {
          const response = await fetch('/api/auth/me')
          if (response.ok) {
            const data = await response.json()
            if (data.user) setUser(data.user)
          } else {
            setUser(null)
          }
        } catch {
          setUser(null)
        }
        setReady(true)
      }
      verify()
    }
  }, [ready, isLoading, setUser])

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Forzar logout local aunque falle la petición
    } finally {
      setModule('dashboard')
      logout()
    }
  }

  const handleNavigate = (module: string) => {
    setModule(module as Module)
  }

  useEffect(() => {
    if (isAuthenticated && user) {
      const params = new URLSearchParams(window.location.search)
      const mod = params.get('module')
      if (mod && MODULE_MAP[mod]) {
        setModule(mod as Module)
      }
    }
  }, [isAuthenticated, user, setModule])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e40af] via-[#1e3a8a] to-[#172554]">
        <div className="text-center text-white space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight">Almacén Institucional</p>
            <p className="text-sm text-white/70 mt-1">Sistema de Gestión de Activos</p>
          </div>
          <div className="flex justify-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce [animation-delay:0ms]" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce [animation-delay:150ms]" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-xs text-white/50 mt-4">Inicializando sistema...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <LoginForm onSuccess={() => setReady(true)} />
  }

  const ModuleComponent = (DynamicModules[currentModule] ?? DynamicModules.dashboard) as ComponentType<any>

  return (
    <MainLayout onLogout={handleLogout}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentModule}
          variants={moduleVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <Suspense fallback={<ModuleSkeleton variant="cards" />}>
            <ModuleComponent onNavigate={handleNavigate} />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </MainLayout>
  )
}