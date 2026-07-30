import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encrypt, decrypt, maskDNI, maskPhone, maskEmail, generateSecureToken } from '@/lib/encryption'

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test' }
  process.env.ENCRYPTION_KEY = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe('encrypt and decrypt', () => {
  it('encripta y desencripta correctamente', () => {
    const original = 'datos sensibles'
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toContain(':')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('encripta y desencripta texto vacío', () => {
    expect(encrypt('')).toBe('')
    expect(decrypt('')).toBe('')
  })

  it('encripta y desencripta objetos JSON', () => {
    const data = JSON.stringify({ role: 'ADMIN', name: 'Test' })
    const encrypted = encrypt(data)
    const decrypted = decrypt(encrypted)
    expect(JSON.parse(decrypted)).toEqual({ role: 'ADMIN', name: 'Test' })
  })

  it('lanza error con clave inválida', () => {
    process.env.ENCRYPTION_KEY = 'ab'
    expect(() => encrypt('test')).toThrow('32 caracteres')
  })

  it('retorna texto original si no tiene formato encriptado', () => {
    const result = decrypt('texto-sin-formato-encriptado')
    expect(result).toBe('texto-sin-formato-encriptado')
  })

  it('lanza error con datos corruptos', () => {
    expect(() => decrypt('iv:data')).toThrow('Error al descifrar')
  })

  it('encriptación produce diferentes resultados cada vez', () => {
    const text = 'mismo texto'
    const enc1 = encrypt(text)
    const enc2 = encrypt(text)
    expect(enc1).not.toBe(enc2)
    expect(decrypt(enc1)).toBe(text)
    expect(decrypt(enc2)).toBe(text)
  })
})

describe('maskDNI', () => {
  it('enmascara DNI peruano', () => {
    expect(maskDNI('12345678')).toBe('12****678')
  })

  it('retorna el mismo valor si no es DNI válido', () => {
    expect(maskDNI('')).toBe('')
    expect(maskDNI('123')).toBe('123')
    expect(maskDNI('123456789')).toBe('123456789')
  })
})

describe('maskPhone', () => {
  it('enmascara teléfono de 9 dígitos', () => {
    const masked = maskPhone('987654321')
    expect(masked.length).toBe(9)
    expect(masked.slice(0, 2)).toBe('98')
    expect(masked.slice(-3)).toBe('321')
    expect(masked).toMatch(/98\*\*\*\*321/)
  })

  it('retorna igual si es muy corto', () => {
    expect(maskPhone('1234')).toBe('1234')
  })

  it('retorna vacío si está vacío', () => {
    expect(maskPhone('')).toBe('')
  })
})

describe('maskEmail', () => {
  it('enmascara email', () => {
    expect(maskEmail('juan.perez@institucion.gob.pe')).toMatch(/^ju\*+@institucion/)
  })

  it('retorna igual si no tiene @', () => {
    expect(maskEmail('invalido')).toBe('invalido')
  })

  it('retorna vacío si está vacío', () => {
    expect(maskEmail('')).toBe('')
  })
})

describe('generateSecureToken', () => {
  it('genera token hexadecimal', () => {
    const token = generateSecureToken()
    expect(token).toBeTruthy()
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('genera token con longitud específica', () => {
    const token = generateSecureToken(16)
    expect(token.length).toBe(32)
  })

  it('genera tokens únicos', () => {
    const t1 = generateSecureToken()
    const t2 = generateSecureToken()
    expect(t1).not.toBe(t2)
  })
})
