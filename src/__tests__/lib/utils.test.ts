import { describe, it, expect } from 'vitest'
import { cn, normalizeText } from '@/lib/utils'

describe('cn', () => {
  it('combina clases', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('maneja clases condicionales', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('elimina clases duplicadas (tailwind-merge)', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })

  it('maneja undefined y null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })

  it('maneja strings vacías', () => {
    expect(cn('a', '', 'b')).toBe('a b')
  })
})

describe('normalizeText', () => {
  it('elimina tildes', () => {
    expect(normalizeText('José María')).toBe('jose maria')
  })

  it('convierte a minúsculas', () => {
    expect(normalizeText('ALMACÉN')).toBe('almacen')
  })

  it('maneja texto sin tildes', () => {
    expect(normalizeText('Hello World')).toBe('hello world')
  })

  it('elimina diéresis', () => {
    expect(normalizeText('pingüino')).toBe('pinguino')
  })

  it('maneja string vacío', () => {
    expect(normalizeText('')).toBe('')
  })
})
