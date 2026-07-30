import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '@/components/ui/empty-state'
import { Package } from 'lucide-react'

describe('EmptyState', () => {
  it('muestra titulo y descripcion', () => {
    render(<EmptyState title="Sin datos" description="No hay elementos para mostrar" />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.getByText('No hay elementos para mostrar')).toBeInTheDocument()
  })

  it('muestra slot de accion cuando se provee', () => {
    render(
      <EmptyState title="Vacio" description="Agrega un elemento" action={<button>Crear</button>} />
    )
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument()
  })

  it('muestra icono personalizado', () => {
    const { container } = render(
      <EmptyState title="Test" description="Test" icon={Package} />
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
