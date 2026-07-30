'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConfigStore } from '@/store'
import Image from 'next/image'
import { DefaultLogo, generateFavicon } from '@/components/ui/default-logo'
import { Save, Building2, Palette, FileText, Upload, X, Loader2, Trash2, Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'

export function ConfiguracionModule() {
  const { config, setConfig } = useConfigStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    institutionName: '',
    logoUrl: '',
    primaryColor: '#1e40af',
    secondaryColor: '#3b82f6',
    accentColor: '#f59e0b',
    tabTitle: 'Almacén',
    footerText: '',
    force2FA: false,
    exemptedRoles: [] as string[],
  })
  const roles: string[] = ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR']

  const fetchConfig = useCallback(async () => {
    try {
      const response = await apiFetch('/api/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
        if (data.config) {
          setFormData({
            institutionName: data.config.institutionName || '',
            logoUrl: data.config.logoUrl || '',
            primaryColor: data.config.primaryColor || '#1e40af',
            secondaryColor: data.config.secondaryColor || '#3b82f6',
            accentColor: data.config.accentColor || '#f59e0b',
            tabTitle: data.config.tabTitle || 'Almacén',
            footerText: data.config.footerText || '',
            force2FA: data.config.force2FA ?? false,
            exemptedRoles: data.config.exemptedRoles ?? [],
          })
        }
      }
    } catch (error) {
      console.error('Error al obtener config:', error)
      toast.error('Error al cargar la configuración')
    } finally {
      setIsLoading(false)
    }
  }, [setConfig])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Actualizar título dinámicamente

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp', 'image/x-icon', 'image/ico']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de archivo no permitido. Use PNG, JPG, SVG, GIF, ICO o WebP')
      return
    }

    // Validar tamaño de archivo (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande. Máximo 5MB')
      return
    }

    setIsUploading(true)

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('type', 'logo')

      const response = await apiFetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      let data: { url?: string; error?: string; code?: string }

      // Intentar parsear como JSON aunque el content-type no sea application/json
      try {
        const text = await response.text()
        data = JSON.parse(text)
      } catch {
        console.error('Respuesta no JSON del servidor:', {
          status: response.status,
          statusText: response.statusText
        })

        // Error específico de autenticación
        if (response.status === 401) {
          toast.error('Su sesión ha expirado. Por favor inicie sesión nuevamente.')
          setTimeout(() => {
            window.location.href = '/'
          }, 2000)
          return
        }

        // Error 404 - ruta no encontrada
        if (response.status === 404) {
          toast.error('Error de configuración del servidor. Contacte al administrador.')
          return
        }

        // Otros errores
        toast.error(`Error del servidor (${response.status}). Intente nuevamente.`)
        return
      }

      // Manejar error de autenticación
      if (response.status === 401 || data.code === 'UNAUTHORIZED') {
        toast.error('Su sesión ha expirado. Por favor inicie sesión nuevamente.')
        // Redirigir a login después de un breve delay
        setTimeout(() => {
          window.location.href = '/'
        }, 2000)
        return
      }

      if (response.ok && data.url) {
        setFormData({ ...formData, logoUrl: data.url })
        toast.success('Logo cargado correctamente')
      } else {
        toast.error(data.error || 'Error al subir el archivo')
      }
    } catch (error) {
      console.error('Error de subida:', error)
      // Verificar si es un error de red
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Error de conexión. Verifique su conexión a internet.')
      } else {
        toast.error('Error al subir el archivo. Intente nuevamente.')
      }
    } finally {
      setIsUploading(false)
      // Reiniciar input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveLogo = () => {
    setFormData({ ...formData, logoUrl: '' })
    toast.success('Logo eliminado. Se usará el logo por defecto.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Incluir faviconUrl igual que logoUrl
      const dataToSave = {
        ...formData,
        faviconUrl: formData.logoUrl || null,
        force2FA: formData.force2FA,
        exemptedRoles: formData.exemptedRoles,
      }

      const response = await apiFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
        toast.success('Configuración guardada correctamente')
        
        // Actualizar título inmediatamente
        if (formData.tabTitle) {
          document.title = formData.tabTitle
        }
        
        // Actualizar favicon inmediatamente - eliminar iconos existentes primero
        const existingLinks = document.querySelectorAll("link[rel*='icon']")
        existingLinks.forEach(link => link.remove())
        
        // Crear nuevo link de favicon
        const newLink = document.createElement('link')
        newLink.rel = 'icon'
        newLink.type = 'image/svg+xml'
        if (formData.logoUrl) {
          newLink.href = formData.logoUrl
        } else {
          newLink.href = generateFavicon(formData.primaryColor)
        }
        document.head.appendChild(newLink)
        
        // Agregar también apple-touch-icon
        const appleLink = document.createElement('link')
        appleLink.rel = 'apple-touch-icon'
        appleLink.href = formData.logoUrl || generateFavicon(formData.primaryColor)
        document.head.appendChild(appleLink)
      } else {
        toast.error('Error al guardar la configuración')
      }
    } catch (error) {
      console.error('Error al guardar config:', error)
      toast.error('Error al guardar la configuración')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: config?.primaryColor }} />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración Institucional</h1>
        <p className="text-muted-foreground">Personalice la apariencia del sistema</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información de la Institución */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" style={{ color: config?.primaryColor }} />
              Información de la Institución
            </CardTitle>
            <CardDescription>Datos generales de la institución que aparecerán en todo el sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="institutionName">Nombre de la Institución</Label>
                <Input
                  id="institutionName"
                  value={formData.institutionName}
                  onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                  placeholder="Almacén Institucional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tabTitle">Título de la Pestaña del Navegador</Label>
                <Input
                  id="tabTitle"
                  value={formData.tabTitle}
                  onChange={(e) => setFormData({ ...formData, tabTitle: e.target.value })}
                  placeholder="Almacén"
                />
              </div>
            </div>
            
            {/* Sección de Carga de Logo */}
            <div className="space-y-3">
              <Label>Logo de la Institución</Label>
              <p className="text-sm text-muted-foreground">
                Si no carga un logo, se usará el logo por defecto que cambiará de color según la configuración.
              </p>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 bg-slate-50/50">
                <div className="flex flex-col items-center gap-6">
{/* Vista Previa */}
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground font-medium">Vista previa:</p>
                    {formData.logoUrl ? (
                      <div className="relative group">
                        <Image 
                          src={formData.logoUrl} 
                          alt="Logo actual" 
                          className="h-24 w-auto object-contain rounded-lg shadow-sm"
                          width={200}
                          height={96}
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar logo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <DefaultLogo 
                        size="lg" 
                        color={formData.primaryColor}
                        showText={true}
                        institutionName={formData.institutionName || 'Almacén Institucional'}
                      />
                    )}
                    {formData.logoUrl ? (
                      <p className="text-xs text-slate-500">
                        Logo personalizado cargado
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Logo por defecto (cambia de color con el sistema)
                      </p>
                    )}
                  </div>
                  
                  {/* Botón de subida */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/gif,image/webp,image/x-icon,image/ico"
                    className="hidden"
                    id="logo-upload"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="gap-2"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {formData.logoUrl ? 'Cambiar Logo' : 'Cargar Logo Personalizado'}
                        </>
                      )}
                    </Button>
                    {formData.logoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveLogo}
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                        Usar Logo por Defecto
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-400 text-center">
                    Formatos: PNG, JPG, SVG, GIF, ICO, WebP. Máximo 5MB.
                  </p>
                </div>
              </div>
              
              {/* Alternativa: entrada de URL */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-500">o ingrese una URL</span>
                </div>
              </div>
              <Input
                id="logoUrl"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://ejemplo.com/logo.png"
              />
            </div>
          </CardContent>
        </Card>

        {/* Colores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" style={{ color: config?.accentColor }} />
              Colores del Sistema
            </CardTitle>
            <CardDescription>Personalice los colores de la interfaz. El logo por defecto usará el color primario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Color Primario</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Color Secundario</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondaryColor}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Color de Acento</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Vista Previa */}
            <div className="mt-6 p-6 border rounded-xl bg-slate-50/50">
              <p className="text-sm text-muted-foreground mb-4 font-medium">Vista previa de colores y logo:</p>
              <div className="flex flex-col items-center gap-4">
                <DefaultLogo 
                  size="lg" 
                  color={formData.primaryColor}
                  showText={true}
                  institutionName={formData.institutionName || 'Almacén Institucional'}
                />
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button style={{ backgroundColor: formData.primaryColor }}>
                    Botón Primario
                  </Button>
                  <Button style={{ backgroundColor: formData.secondaryColor }}>
                    Botón Secundario
                  </Button>
                  <Button style={{ backgroundColor: formData.accentColor }}>
                    Botón Acento
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pie de Página */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: config?.primaryColor }} />
              Texto del Pie de Página
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="footerText">Texto del Footer</Label>
              <Input
                id="footerText"
                value={formData.footerText}
                onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
                placeholder="© 2024 Almacén Institucional - Ayacucho, Perú"
              />
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: config?.primaryColor }} />
              Autenticación de Dos Factores
            </CardTitle>
            <CardDescription>Configura los requisitos de 2FA para los usuarios del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Exigir 2FA Obligatorio</Label>
                <p className="text-sm text-muted-foreground">Forzar a todos los usuarios a configurar 2FA</p>
              </div>
              <Switch checked={formData.force2FA} onCheckedChange={(c) => setFormData({ ...formData, force2FA: c })} />
            </div>
            {formData.force2FA && (
              <div className="space-y-2">
                <Label>Roles exceptuados</Label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(role => (
                    <div key={role} className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.exemptedRoles.includes(role)}
                        onCheckedChange={() => {
                          setFormData(prev => ({
                            ...prev,
                            exemptedRoles: prev.exemptedRoles.includes(role)
                              ? prev.exemptedRoles.filter(r => r !== role)
                              : [...prev.exemptedRoles, role]
                          }))
                        }}
                      />
                      <Label className="text-sm">{role}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botón de Guardar */}
        <div className="flex justify-end">
          <Button 
            type="submit" 
            style={{ backgroundColor: config?.primaryColor }}
            disabled={isSaving}
            className="min-w-[180px] h-11"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
