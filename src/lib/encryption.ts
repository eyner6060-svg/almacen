import crypto from 'crypto'
import { logger } from '@/lib/logger'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

const ENCRYPTION_KEY_ENV = 'ENCRYPTION_KEY'

function throwMissingKey(): never {
  throw new Error(
    `[ENCRYPTION] La variable de entorno ${ENCRYPTION_KEY_ENV} es obligatoria. ` +
    `Genere una con: openssl rand -hex 32`
  )
}

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_ENCRYPTION === 'true') {
      const devKey = process.env.DEV_ENCRYPTION_KEY
      if (!devKey || devKey.length < 32) {
        throw new Error(
          `[ENCRYPTION] En desarrollo con ALLOW_DEV_ENCRYPTION=true, debe configurar DEV_ENCRYPTION_KEY ` +
          `(mín. 32 caracteres). Genere una con: openssl rand -hex 32`
        )
      }
      return crypto.scryptSync(devKey, 'almacen-encryption-salt-v2', 32, { N: 16384 })
    }
    throwMissingKey()
  }

  if (key.length < 32) {
    throw new Error(`[ENCRYPTION] ENCRYPTION_KEY debe tener al menos 32 caracteres (tiene ${key.length})`)
  }

  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex')
  }

  return crypto.scryptSync(key, 'almacen-encryption-salt-v2', 32, { N: 16384 })
}

export function encrypt(text: string): string {
  if (!text) return text
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText
  if (!encryptedText.includes(':')) return encryptedText
  try {
    const key = getEncryptionKey()
    const parts = encryptedText.split(':')
    if (parts.length !== 3) throw new Error('Formato de datos cifrados inválido')
    const [ivBase64, ciphertext, authTagBase64] = parts
    const iv = Buffer.from(ivBase64!, 'base64')
    const authTag = Buffer.from(authTagBase64!, 'base64')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(ciphertext!, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    logger.error('[ENCRYPTION] Error al descifrar:', error)
    throw new Error('Error al descifrar los datos')
  }
}

export function maskDNI(dni: string): string {
  if (!dni || dni.length !== 8) return dni
  return `${dni.slice(0, 2)}****${dni.slice(-3)}`
}

export function maskPhone(phone: string): string {
  if (!phone) return phone
  if (phone.length <= 4) return phone
  const visibleStart = Math.min(2, Math.floor(phone.length / 3))
  const visibleEnd = Math.min(3, Math.floor(phone.length / 3))
  const maskedLength = phone.length - visibleStart - visibleEnd
  return `${phone.slice(0, visibleStart)}${'*'.repeat(maskedLength)}${phone.slice(-visibleEnd)}`
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email
  const [localPart, domain] = email.split('@')
  const visibleChars = Math.min(2, Math.floor(localPart!.length / 2))
  const maskedLength = localPart!.length - visibleChars
  return `${localPart!.slice(0, visibleChars)}${'*'.repeat(maskedLength)}@${domain!}`
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}
