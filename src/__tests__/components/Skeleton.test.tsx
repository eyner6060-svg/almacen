import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton } from '@/components/ui/skeleton'

describe('Skeleton', () => {
  it('renderiza elemento div', () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.querySelector('[data-slot="skeleton"]')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton?.tagName).toBe('DIV')
  })

  it('tiene clase animate-pulse', () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.querySelector('[data-slot="skeleton"]')
    expect(skeleton?.className).toContain('animate-pulse')
  })

  it('aplica className adicional', () => {
    const { container } = render(<Skeleton className="h-10 w-full" />)
    const skeleton = container.querySelector('[data-slot="skeleton"]')
    expect(skeleton?.className).toContain('h-10')
    expect(skeleton?.className).toContain('w-full')
  })
})
