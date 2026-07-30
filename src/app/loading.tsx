import { Building2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e40af] to-[#1e3a8a]">
      <div className="text-center text-white space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
          <Building2 className="h-8 w-8" />
        </div>
        <div>
          <p className="text-xl font-semibold tracking-tight">Almacén Institucional</p>
          <p className="text-sm text-white/70 mt-1">Cargando...</p>
        </div>
        <div className="flex justify-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce [animation-delay:0ms]" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce [animation-delay:150ms]" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
