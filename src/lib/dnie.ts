'use client'

/**
 * Soporte para la Firma Electrónica con el DNI Electrónico (DNIE) del Perú.
 *
 * El DNIE es emitido por RENIEC y contiene certificados digitales (autenticación
 * y firma) dentro de un chip de tarjeta inteligente. Para firmar desde una app web
 * se requiere un puente local (middleware / aplicación de escritorio / extensión de
 * navegador que acceda al chip vía PC/SC) que exponga `window.__dnieBridge.sign()`.
 *
 * Estructura del puente esperado:
 *   window.__dnieBridge = {
 *     isAvailable: () => Promise<boolean> | boolean,
 *     sign: (payload: string) => Promise<{ signatureBase64: string; certData: string }>
 *   }
 *
 * `signatureBase64` es la firma PKCS#1 en base64 sobre el hash del contenido y
 * `certData` es el certificado X.509 del titular en base64 (para su verificación
 * contra la cadena de confianza de RENIEC).
 */

export type DnieSignMethod = 'DNIE' | 'MANUSCRITA'

export interface DnieSignResult {
  signatureBase64: string
  certData: string
}

interface DnieBridge {
  isAvailable?: () => boolean | Promise<boolean>
  sign: (payload: string) => Promise<DnieSignResult> | DnieSignResult
}

declare global {
  interface Window {
    __dnieBridge?: DnieBridge
  }
}

export function isDnieAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return typeof window.__dnieBridge?.sign === 'function'
}

export async function signWithDnie(payload: string): Promise<DnieSignResult> {
  if (typeof window === 'undefined') {
    throw new Error('La firma DNIE solo está disponible en el navegador')
  }

  const bridge = window.__dnieBridge
  if (!bridge || typeof bridge.sign !== 'function') {
    throw new Error(
      'Firma con DNI Electrónico no disponible. Instale y configure el middleware de RENIEC ' +
      'y el lector de tarjetas para poder firmar con su DNIE.'
    )
  }

  try {
    if (typeof bridge.isAvailable === 'function') {
      const available = await bridge.isAvailable()
      if (!available) {
        throw new Error('No se detectó el DNI Electrónico. Inserte su DNIE en el lector e intente nuevamente.')
      }
    }
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith('Firma con DNI')) {
      throw error
    }
  }

  return bridge.sign(payload)
}

export function buildDnieCertSummary(certData: string): { subject: string; issuer: string; serial: string } | null {
  if (!certData) return null
  try {
    const parsed = JSON.parse(certData) as { subject?: string; issuer?: string; serial?: string }
    return {
      subject: parsed.subject || 'DNI Electrónico (RENIEC)',
      issuer: parsed.issuer || 'RENIEC',
      serial: parsed.serial || '',
    }
  } catch {
    return null
  }
}
