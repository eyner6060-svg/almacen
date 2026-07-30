'use client'

import { useEffect } from 'react'
import { useConfigStore } from '@/store'

// Generar favicon SVG como data URL
function generateFaviconSvg(color: string): string {
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

// Actualizar favicon en el documento
function updateFavicon(url: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/svg+xml'
    document.head.appendChild(link)
  }
  link.href = url

  let appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']")
  if (!appleLink) {
    appleLink = document.createElement('link')
    appleLink.rel = 'apple-touch-icon'
    document.head.appendChild(appleLink)
  }
  appleLink.href = url
}

// Actualizar título de página
function updatePageTitle(title: string, institutionName: string) {
  document.title = title || institutionName || 'Sistema de Almacén'
}

export function DynamicFavicon() {
  const config = useConfigStore(s => s.config)

  useEffect(() => {
    if (typeof window === 'undefined' || !config) return

    const defaultColor = '#1e40af'
    const color = config.primaryColor || defaultColor
    const faviconUrl = config.logoUrl || config.faviconUrl || generateFaviconSvg(color)
    updateFavicon(faviconUrl)
    updatePageTitle(config.tabTitle || '', config.institutionName || 'Sistema de Almacén')
  }, [config])

  return null
}
