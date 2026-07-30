import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, addTransport } from '@/lib/logger'

describe('logger enhanced', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('debug llama console.debug', () => {
    logger.debug('test debug')
    expect(console.debug).toHaveBeenCalled()
  })

  it('info llama console.info', () => {
    logger.info('test info')
    expect(console.info).toHaveBeenCalled()
  })

  it('warn llama console.warn', () => {
    logger.warn('test warn')
    expect(console.warn).toHaveBeenCalled()
  })

  it('error llama console.error', () => {
    logger.error('test error')
    expect(console.error).toHaveBeenCalled()
  })

  it('error formatea Error object', () => {
    logger.error('algo falló', new Error('mensaje de error'))
    expect(console.error).toHaveBeenCalled()
    const call = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(call).toContain('ERROR')
    expect(call).toContain('algo falló')
  })

  it('incluye módulo en el mensaje', () => {
    logger.info('mensaje', null, 'test-module')
    const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(call).toContain('[test-module]')
  })

  it('addTransport agrega transporte adicional', () => {
    const customTransport = { log: vi.fn() }
    addTransport(customTransport)
    logger.info('test transport')
    expect(customTransport.log).toHaveBeenCalled()
  })
})
