import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renderiza con texto', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('llama onClick al hacer clic', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('está deshabilitado cuando se pasa disabled', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('no llama onClick cuando está deshabilitado', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Click</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('aplica className adicional', () => {
    const { container } = render(<Button className="custom-class">Test</Button>)
    const button = container.querySelector('[data-slot="button"]')
    expect(button?.className).toContain('custom-class')
  })

  it('renderiza como child usando asChild', () => {
    const { container } = render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>
    )
    expect(container.querySelector('a')).toBeInTheDocument()
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/test')
  })
})
