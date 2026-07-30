'use client'

import { Warehouse, Package } from 'lucide-react'

interface DefaultLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  showText?: boolean
  institutionName?: string
  className?: string
}

const sizes = {
  sm: { icon: 24, container: 40, text: 'text-sm' },
  md: { icon: 32, container: 56, text: 'text-base' },
  lg: { icon: 48, container: 80, text: 'text-xl' },
  xl: { icon: 64, container: 96, text: 'text-2xl' },
}

export function DefaultLogo({ 
  size = 'md', 
  color = '#1e40af', 
  showText = false, 
  institutionName = 'Almacén Institucional',
  className = ''
}: DefaultLogoProps) {
  const sizeConfig = sizes[size]
  
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div 
        className="relative rounded-2xl flex items-center justify-center shadow-lg"
        style={{ 
          width: sizeConfig.container, 
          height: sizeConfig.container,
          backgroundColor: color,
        }}
      >
        {/* Icono principal de almacén */}
        <Warehouse 
          size={sizeConfig.icon} 
          className="text-white drop-shadow-md" 
          strokeWidth={1.5}
        />
        
        {/* Icono pequeño de paquete en esquina */}
        <div 
          className="absolute -bottom-1 -right-1 rounded-full p-1 shadow-md"
          style={{ backgroundColor: 'white' }}
        >
          <Package 
            size={sizeConfig.icon * 0.4} 
            style={{ color: color }}
            strokeWidth={2}
          />
        </div>
      </div>
      
      {showText && (
        <span 
          className={`font-bold text-center ${sizeConfig.text}`}
          style={{ color: color }}
        >
          {institutionName}
        </span>
      )}
    </div>
  )
}

  // Versión invertida/blanca (usada sobre fondos de color)
export function DefaultLogoInverted({ 
  size = 'md', 
  color = '#1e40af', 
  showText = false, 
  institutionName = 'Almacén Institucional',
  className = ''
}: DefaultLogoProps) {
  const sizeConfig = sizes[size]
  
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div 
        className="relative rounded-2xl flex items-center justify-center shadow-xl"
        style={{ 
          width: sizeConfig.container, 
          height: sizeConfig.container,
          backgroundColor: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Warehouse 
          size={sizeConfig.icon} 
          className="text-white drop-shadow-lg" 
          strokeWidth={1.5}
        />
        
        {/* Icono pequeño de paquete */}
        <div className="absolute -bottom-1 -right-1 rounded-full p-1.5 bg-white shadow-lg">
          <Package 
            size={sizeConfig.icon * 0.35} 
            style={{ color: color }}
            strokeWidth={2.5}
          />
        </div>
      </div>
      
      {showText && (
        <span className={`font-bold text-white text-center drop-shadow-md ${sizeConfig.text}`}>
          {institutionName}
        </span>
      )}
    </div>
  )
}

  // Versión solo icono
export function DefaultLogoIcon({ 
  size = 'md', 
  color = '#1e40af',
  className = ''
}: Omit<DefaultLogoProps, 'showText' | 'institutionName'>) {
  const sizeConfig = sizes[size]
  
  return (
    <div 
      className={`relative rounded-xl flex items-center justify-center shadow-md ${className}`}
      style={{ 
        width: sizeConfig.container * 0.6, 
        height: sizeConfig.container * 0.6,
        backgroundColor: color,
      }}
    >
      <Warehouse 
        size={sizeConfig.icon * 0.7} 
        className="text-white" 
        strokeWidth={1.5}
      />
    </div>
  )
}

  // Generador de favicon - devuelve SVG como data URL
export function generateFavicon(color: string = '#1e40af'): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="12" fill="${color}"/>
      <rect x="12" y="22" width="40" height="30" rx="4" stroke="white" stroke-width="2.5" fill="none"/>
      <rect x="20" y="22" width="24" height="12" rx="2" fill="white" opacity="0.3"/>
      <path d="M24 34L24 50" stroke="white" stroke-width="2"/>
      <path d="M40 34L40 50" stroke="white" stroke-width="2"/>
      <rect x="16" y="38" width="32" height="12" rx="2" stroke="white" stroke-width="2" fill="none"/>
      <circle cx="32" cy="44" r="3" fill="white"/>
      <path d="M32 42L32 46M30 44L34 44" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
