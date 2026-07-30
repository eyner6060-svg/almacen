'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store'
import { useConfigStore } from '@/store'
import { DefaultLogo, DefaultLogoInverted } from '@/components/ui/default-logo'
import { Loader2, Mail, Lock, Sparkles, Shield, Zap, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import Image from 'next/image'
import { PasswordRecoveryForm } from './PasswordRecoveryForm'
import { apiFetch } from '@/lib/http'

interface LoginFormProps {
  onSuccess: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  
  const setUser = useAuthStore(s => s.setUser)
  const config = useConfigStore(s => s.config)

  const primaryColor = config?.primaryColor || '#1e40af'
  const secondaryColor = config?.secondaryColor || '#3b82f6'
  const accentColor = config?.accentColor || '#f59e0b'
  const institutionName = config?.institutionName || 'Almacén Institucional'
  const tabTitle = config?.tabTitle || institutionName

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passwordValid = password.length >= 8
  const canSubmit = emailValid && passwordValid && !isLoading

  // Actualizar título dinámicamente
  useEffect(() => {
    document.title = tabTitle
  }, [tabTitle])

  // Inicializar CSRF token al cargar el formulario
  useEffect(() => {
    fetch('/api/auth/login', { method: 'GET' }).catch(() => {})
  }, [])



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }

      setUser(data.user)
      onSuccess()
    } catch {
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  if (showRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <PasswordRecoveryForm onBack={() => setShowRecovery(false)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
        {/* Lado izquierdo - Decorativo */}
      <div 
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-[length:400%_400%] animate-[gradientAnimation_15s_ease_infinite]"
        style={{ 
          background: `linear-gradient(-45deg, ${primaryColor}, ${secondaryColor}, ${accentColor}, ${primaryColor})`,
        }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzAtMS4xLS45LTItMi0ycy0yIC45LTIgMiAuOSAyIDIgMiAyLS45IDItMnptLTEyIDBjMC0xLjEtLjktMi0yLTJzLTIgLjktMiAyIC45IDIgMiAyIDItLjkgMi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/10 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-white/20 rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-4 h-4 bg-white/30 rounded-full animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-white/20 rounded-full animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '1s' }} />
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 xl:p-20 text-white animate-fadeIn">
          <div className="mb-8 transform transition-all duration-700 hover:scale-105">
            {config?.logoUrl ? (
              <Image 
                src={config.logoUrl} 
                alt="Logo" 
                className="h-28 xl:h-32 w-auto object-contain drop-shadow-2xl brightness-0 invert" 
                width={200}
                height={128}
              />
            ) : (
              <DefaultLogoInverted 
                size="xl" 
                color={primaryColor}
                showText={true}
                institutionName={institutionName}
              />
            )}
          </div>
          
          {!config?.logoUrl && (
            <h1 className="text-3xl xl:text-4xl font-bold text-center mb-4 drop-shadow-lg mt-4 opacity-0 animate-fadeIn" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              {institutionName}
            </h1>
          )}
          <p className="text-lg xl:text-xl text-white/80 text-center max-w-md opacity-0 animate-fadeIn" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
            Sistema de Gestión de Almacén
          </p>
          
          <div className="mt-12 xl:mt-16 grid grid-cols-3 gap-8 xl:gap-12 text-center opacity-0 animate-fadeIn" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
            <div className="flex flex-col items-center group">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3 transition-all duration-300 group-hover:bg-white/30 group-hover:scale-110">
                <Sparkles className="h-7 w-7" />
              </div>
              <span className="text-sm xl:text-base text-white/70 font-medium group-hover:text-white/90 transition-colors">Control Total</span>
            </div>
            <div className="flex flex-col items-center group">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3 transition-all duration-300 group-hover:bg-white/30 group-hover:scale-110">
                <Shield className="h-7 w-7" />
              </div>
              <span className="text-sm xl:text-base text-white/70 font-medium group-hover:text-white/90 transition-colors">Seguro</span>
            </div>
            <div className="flex flex-col items-center group">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3 transition-all duration-300 group-hover:bg-white/30 group-hover:scale-110">
                <Zap className="h-7 w-7" />
              </div>
              <span className="text-sm xl:text-base text-white/70 font-medium group-hover:text-white/90 transition-colors">Rápido</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lado derecho - Formulario de inicio de sesión */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-6 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="w-full max-w-lg animate-fadeIn" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
          {/* Logo móvil */}
          <div className="lg:hidden text-center mb-8">
            {config?.logoUrl ? (
              <Image 
                src={config.logoUrl} 
                alt="Logo" 
                className="h-20 w-auto mx-auto mb-4 object-contain" 
                width={160}
                height={80}
              />
            ) : (
              <DefaultLogo 
                size="lg" 
                color={primaryColor}
                showText={true}
                institutionName={institutionName}
                className="mb-4"
              />
            )}
          </div>

          {/* Tarjeta de formulario */}
          <div className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/20 dark:border-slate-700/50 transition-all duration-500 hover:shadow-3xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Bienvenido</h2>
              <p className="text-slate-500 dark:text-slate-400">Inicie sesión para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-medium text-sm">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${emailTouched && email ? (emailValid ? 'text-green-500' : 'text-red-400') : 'text-slate-400'}`} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@institucion.gob.pe"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    required
                    disabled={isLoading}
                    className={`pl-12 pr-10 h-14 text-base rounded-2xl border-2 transition-all duration-200 ${
                      emailTouched && email
                        ? emailValid
                          ? 'border-green-300 dark:border-green-700 focus:border-green-500 focus:ring-green-500/20'
                          : 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 dark:focus:border-slate-500'
                    } dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500 focus:ring-4 outline-none`}
                  />
                  {emailTouched && email && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {emailValid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                {emailTouched && email && !emailValid && (
                  <p className="text-xs text-red-500 mt-1 ml-1">Ingrese un correo electrónico válido</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium text-sm">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${passwordTouched && password ? (passwordValid ? 'text-green-500' : 'text-red-400') : 'text-slate-400'}`} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    required
                    disabled={isLoading}
                    className={`pl-12 pr-12 h-14 text-base rounded-2xl border-2 transition-all duration-200 ${
                      passwordTouched && password
                        ? passwordValid
                          ? 'border-green-300 dark:border-green-700 focus:border-green-500 focus:ring-green-500/20'
                          : 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-slate-400 dark:focus:border-slate-500'
                    } dark:bg-slate-800/50 dark:text-slate-100 dark:placeholder-slate-500 focus:ring-4 outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                  {passwordTouched && password && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {passwordValid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                {passwordTouched && password && !passwordValid && (
                  <p className="text-xs text-red-500 mt-1 ml-1">La contraseña debe tener al menos 8 caracteres</p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowRecovery(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-all hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {error && (
                <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 animate-fadeIn">
                  <XCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-14 text-white text-base font-semibold rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ backgroundColor: canSubmit ? primaryColor : undefined }}
                disabled={!canSubmit}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
          </div>

          {/* Pie de página */}
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8 opacity-0 animate-fadeIn" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
            {config?.footerText || `© ${new Date().getFullYear()} ${institutionName} - Ayacucho, Perú`}
          </p>
        </div>
      </div>
    </div>
  )
}
