import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('renderiza texto', () => {
    render(<Badge>Pendiente</Badge>)
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('renderiza con variante default', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge).toBeInTheDocument()
  })

  it('aplica className adicional', () => {
    const { container } = render(<Badge className="custom-class">Test</Badge>)
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge?.className).toContain('custom-class')
  })
})
