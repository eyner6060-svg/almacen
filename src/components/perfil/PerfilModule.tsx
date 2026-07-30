'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useAuthStore, useConfigStore } from '@/store'
import { User, Mail, Phone, Building2, Shield, Save, Key, Check, X, Eye, EyeOff, Smartphone, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { QRCodeSVG } from 'qrcode.react'
import { AnimatedContainer } from '@/components/ui/animated-container'

const roleConfig = {
  ADMINISTRADOR: { label: 'Administrador', color: 'bg-purple-100 text-purple-800' },
  ALMACENERO: { label: 'Almacenero', color: 'bg-blue-100 text-blue-800' },
  JEFE_OFICINA: { label: 'Jefe de Oficina', color: 'bg-green-100 text-green-800' },
  TRABAJADOR: { label: 'Trabajador', color: 'bg-gray-100 text-gray-800' },
}

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Al menos una mayúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Al menos una minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Al menos un número', test: (p) => /[0-9]/.test(p) },
  { label: 'Al menos un carácter especial (!@#$%^&*)', test: (p) => /[!@#$%^&*]/.test(p) },
]

export function PerfilModule() {
  const { user, setUser } = useAuthStore()
  const { config } = useConfigStore()
  
  const [isSaving, setIsSaving] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    position: user?.position || '',
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Verificar requisitos de contraseña
  const getPasswordStrength = (password: string) => {
    const passed = passwordRequirements.filter(req => req.test(password)).length
    return {
      passed,
      total: passwordRequirements.length,
      percentage: (passed / passwordRequirements.length) * 100
    }
  }

  const passwordStrength = getPasswordStrength(passwordData.newPassword)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const response = await apiFetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        setUser({ ...user, ...data.user })
        toast.success('Perfil actualizado correctamente')
      } else {
        toast.error('Error al actualizar el perfil')
      }
    } catch {
      toast.error('Error al actualizar el perfil')
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    // Verificar todos los requisitos de contraseña
    const allRequirementsMet = passwordRequirements.every(req => req.test(passwordData.newPassword))
    if (!allRequirementsMet) {
      toast.error('La contraseña no cumple con todos los requisitos de seguridad')
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await apiFetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordData.newPassword }),
      })

      if (response.ok) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        toast.success('Contraseña actualizada correctamente')
      } else {
        toast.error('Error al actualizar la contraseña')
      }
    } catch (error) {
      console.error('Error al cambiar contraseña:', error)
      toast.error('Error al actualizar la contraseña')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorSecret, setTwoFactorSecret] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [isSetting2FA, setIsSetting2FA] = useState(false)

  const [hasPin, setHasPin] = useState(!!user?.pin)
  const [pinCurrent, setPinCurrent] = useState('')
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [isChangingPin, setIsChangingPin] = useState(false)

  useEffect(() => {
    if (user) {
      setHasPin(!!user.pin)
    }
  }, [user])

  const handleSetup2FA = useCallback(async () => {
    setIsSetting2FA(true)
    try {
      const response = await apiFetch('/api/auth/2fa', {
        method: 'POST',
        body: JSON.stringify({ action: 'setup' }),
      })
      if (response.ok) {
        const data = await response.json()
        setQrCodeUrl(data.qrCodeUrl)
        setTwoFactorSecret(data.secret)
        setShowQr(true)
      } else {
        const err = await response.json()
        toast.error(err.error || 'Error al iniciar configuración 2FA')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setIsSetting2FA(false)
    }
  }, [])

  const handleVerify2FA = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/2fa', {
        method: 'POST',
        body: JSON.stringify({ action: 'enable', code: twoFactorCode, secret: twoFactorSecret }),
      })
      if (response.ok) {
        setTwoFactorEnabled(true)
        setShowQr(false)
        setTwoFactorCode('')
        setQrCodeUrl('')
        toast.success('Autenticación en dos pasos activada')
      } else {
        const err = await response.json()
        toast.error(err.error || 'Código inválido. Intente nuevamente.')
      }
    } catch {
      toast.error('Error al verificar código')
    }
  }, [twoFactorCode, twoFactorSecret])

  const handleDisable2FA = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/2fa', {
        method: 'POST',
        body: JSON.stringify({ action: 'disable' }),
      })
      if (response.ok) {
        setTwoFactorEnabled(false)
        toast.success('Autenticación en dos pasos desactivada')
      } else {
        const err = await response.json()
        toast.error(err.error || 'Error al desactivar 2FA')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }, [])

  if (!user) return null

  const roleInfo = roleConfig[user.role as keyof typeof roleConfig]

  return (
    <AnimatedContainer className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground">Administre su información personal</p>
      </div>

      {/* Tarjeta de Perfil */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div 
              className="h-16 w-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: config?.primaryColor }}
            >
              {user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <CardTitle>{user.fullName}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge className={roleInfo.color}>
                  <Shield className="h-3 w-3 mr-1" />
                  {roleInfo.label}
                </Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">DNI</p>
                <p className="font-medium font-mono">{user.dni}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="font-medium">{user.phone || 'No registrado'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Oficina</p>
                <p className="font-medium">{user.office?.name || 'Sin asignar'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editar Perfil */}
      <Card>
        <CardHeader>
          <CardTitle>Editar Información</CardTitle>
          <CardDescription>Actualice su información personal</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Cargo</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                type="submit" 
                style={{ backgroundColor: config?.primaryColor }}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Cambiar Contraseña */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Cambiar Contraseña
          </CardTitle>
          <CardDescription>Actualice su contraseña de acceso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                
                {/* Indicador de fortaleza de contraseña - Siempre visible */}
                <div className="space-y-2 mt-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Fortaleza de la contraseña</span>
                    <span className="text-xs font-medium">
                      {passwordStrength.passed}/{passwordStrength.total} requisitos cumplidos
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${passwordStrength.percentage}%`,
                        backgroundColor: passwordStrength.percentage === 100 ? '#22c55e' : 
                                       passwordStrength.percentage >= 60 ? '#eab308' : '#ef4444'
                      }}
                    />
                  </div>
                  
                  {/* Lista de Requisitos */}
                  <div className="grid grid-cols-1 gap-1.5 mt-2">
                    {passwordRequirements.map((req, idx) => {
                      const isMet = req.test(passwordData.newPassword)
                      return (
                        <div 
                          key={idx}
                          className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${
                            isMet ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-50'
                          }`}
                        >
                          {isMet ? (
                            <Check className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <X className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span>{req.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                />
                {passwordData.confirmPassword && passwordData.newPassword && (
                  <div className={`flex items-center gap-1.5 text-xs ${
                    passwordData.newPassword === passwordData.confirmPassword 
                      ? 'text-green-600' 
                      : 'text-red-500'
                  }`}>
                    {passwordData.newPassword === passwordData.confirmPassword ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Las contraseñas coinciden</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        <span>Las contraseñas no coinciden</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                type="submit" 
                variant="outline"
                disabled={isChangingPassword || passwordStrength.passed < passwordStrength.total}
              >
                <Key className="h-4 w-4 mr-2" />
                {isChangingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Cambiar PIN de Autorización */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            PIN de Autorización
          </CardTitle>
          <CardDescription>
            Establezca o cambie su PIN de 4 dígitos usado para autorizar operaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (pinNew !== pinConfirm) {
                toast.error('Los PIN no coinciden')
                return
              }
              setIsChangingPin(true)
              try {
                const res = await apiFetch('/api/auth/pin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    currentPin: hasPin ? pinCurrent : undefined,
                    newPin: pinNew,
                  }),
                })
                const data = await res.json()
                if (res.ok) {
                  toast.success(data.message)
                  setPinCurrent('')
                  setPinNew('')
                  setPinConfirm('')
                  setHasPin(true)
                } else {
                  toast.error(data.error || 'Error al cambiar PIN')
                }
              } catch {
                toast.error('Error de conexión')
              } finally {
                setIsChangingPin(false)
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 max-w-md">
              {hasPin && (
                <div className="space-y-2">
                  <Label htmlFor="pinCurrent">PIN Actual</Label>
                  <Input
                    id="pinCurrent"
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    pattern="\d*"
                    value={pinCurrent}
                    onChange={(e) => setPinCurrent(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    className="text-center text-lg tracking-widest font-mono"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="pinNew">{hasPin ? 'Nuevo PIN' : 'PIN'}</Label>
                <Input
                  id="pinNew"
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="\d*"
                  value={pinNew}
                  onChange={(e) => setPinNew(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  className="text-center text-lg tracking-widest font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pinConfirm">Confirmar PIN</Label>
                <Input
                  id="pinConfirm"
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="\d*"
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  className="text-center text-lg tracking-widest font-mono"
                  required
                />
                {pinConfirm && pinNew && (
                  <div className={`flex items-center gap-1.5 text-xs ${
                    pinNew === pinConfirm ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {pinNew === pinConfirm ? (
                      <><Check className="h-3 w-3" /><span>Los PIN coinciden</span></>
                    ) : (
                      <><X className="h-3 w-3" /><span>Los PIN no coinciden</span></>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                disabled={isChangingPin || !pinNew || pinNew !== pinConfirm}
              >
                <Key className="h-4 w-4 mr-2" />
                {isChangingPin ? 'Guardando...' : hasPin ? 'Cambiar PIN' : 'Establecer PIN'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Autenticación de Dos Factores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              <div>
                <CardTitle>Autenticación en Dos Pasos</CardTitle>
                <CardDescription>
                  Añada una capa extra de seguridad a su cuenta
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={(checked) => {
                if (checked) handleSetup2FA()
                else handleDisable2FA()
              }}
              disabled={isSetting2FA}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFactorEnabled ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">Protección activa</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  La autenticación en dos pasos está habilitada para su cuenta.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Al activar esta opción, se le solicitará un código de verificación adicional
              al iniciar sesión, además de su contraseña.
            </p>
          )}

          {showQr && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-medium">Escanee el código QR</p>
                  <p>Use su aplicación de autenticación (Google Authenticator, Authy, etc.) para escanear el código y luego ingrese el código de verificación.</p>
                </div>
              </div>

              {qrCodeUrl && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG value={qrCodeUrl} size={192} />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="twoFactorCode">Código de verificación</Label>
                <div className="flex gap-2">
                  <Input
                    id="twoFactorCode"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                  <Button onClick={handleVerify2FA} disabled={twoFactorCode.length < 6}>
                    <Check className="h-4 w-4 mr-2" />
                    Verificar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AnimatedContainer>
  )
}
