import { describe, it, expect } from 'vitest'
import {
  createUserSchema,
  updateUserSchema,
  createItemSchema,
  createOrderSchema,
  createWarehouseSchema,
  createOfficeSchema,
  createVehicleSchema,
  createFuelRequestSchema,
  createIngressSchema,
  createAssignedAssetSchema,
  createWarrantySchema,
  updateFuelRequestSchema,
} from '@/lib/validations'

describe('createUserSchema', () => {
  it('valida datos correctos', () => {
    const data = {
      fullName: 'Juan Pérez',
      email: 'juan@institucion.gob.pe',
      password: 'SecurePass1!',
      dni: '12345678',
      role: 'ALMACENERO' as const,
    }
    const result = createUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rechaza email inválido', () => {
    const result = createUserSchema.safeParse({
      fullName: 'Test',
      email: 'not-email',
      password: 'SecurePass1!',
      dni: '12345678',
      role: 'TRABAJADOR',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza DNI incorrecto', () => {
    const result = createUserSchema.safeParse({
      fullName: 'Test',
      email: 'test@test.com',
      password: 'SecurePass1!',
      dni: '1234',
      role: 'TRABAJADOR',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza rol inválido', () => {
    const result = createUserSchema.safeParse({
      fullName: 'Test',
      email: 'test@test.com',
      password: 'SecurePass1!',
      dni: '12345678',
      role: 'INVALID_ROLE',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza datos vacíos', () => {
    const result = createUserSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('acepta campos opcionales', () => {
    const result = createUserSchema.safeParse({
      fullName: 'Test',
      email: 'test@test.com',
      password: 'SecurePass1!',
      dni: '12345678',
      role: 'ADMINISTRADOR',
      phone: '999888777',
      position: 'Jefe',
      isActive: true,
      isDriver: false,
      pin: '1234',
    })
    expect(result.success).toBe(true)
  })
})

describe('updateUserSchema', () => {
  it('acepta actualización parcial', () => {
    const result = updateUserSchema.safeParse({ fullName: 'Nuevo Nombre' })
    expect(result.success).toBe(true)
  })

  it('rechaza campos extra (strict)', () => {
    const result = updateUserSchema.safeParse({ fullName: 'Test', extraField: 'no' })
    expect(result.success).toBe(false)
  })

  it('acepta objeto vacío', () => {
    const result = updateUserSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('createItemSchema', () => {
  const validItem = {
    name: 'Laptop',
    code: 'LAP-001',
    category: 'Equipos',
    itemType: 'CONSUMIBLE' as const,
    warehouseId: 1,
  }

  it('valida ítem correcto', () => {
    const result = createItemSchema.safeParse(validItem)
    expect(result.success).toBe(true)
  })

  it('rechaza ítem sin nombre', () => {
    const result = createItemSchema.safeParse({ ...validItem, name: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza itemType inválido', () => {
    const result = createItemSchema.safeParse({ ...validItem, itemType: 'OTRO' })
    expect(result.success).toBe(false)
  })

  it('rechaza warehouseId no positivo', () => {
    const result = createItemSchema.safeParse({ ...validItem, warehouseId: 0 })
    expect(result.success).toBe(false)
  })

  it('acepta campos opcionales', () => {
    const result = createItemSchema.safeParse({
      ...validItem,
      quantity: 10,
      minStock: 2,
      description: 'Descripción',
    })
    expect(result.success).toBe(true)
  })
})

describe('createOrderSchema', () => {
  const validOrder = {
    items: [{ itemId: 1, quantity: 5 }],
    officeId: 1,
  }

  it('valida orden correcta', () => {
    const result = createOrderSchema.safeParse(validOrder)
    expect(result.success).toBe(true)
  })

  it('rechaza orden sin items', () => {
    const result = createOrderSchema.safeParse({ ...validOrder, items: [] })
    expect(result.success).toBe(false)
  })

  it('rechaza orden con quantity 0', () => {
    const result = createOrderSchema.safeParse({
      items: [{ itemId: 1, quantity: 0 }],
      officeId: 1,
    })
    expect(result.success).toBe(false)
  })

  it('acepta notas opcionales', () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      notes: 'Entrega inmediata',
    })
    expect(result.success).toBe(true)
  })
})

describe('createWarehouseSchema', () => {
  it('valida almacén correcto', () => {
    const result = createWarehouseSchema.safeParse({
      name: 'Almacén Central',
      location: 'Av. Principal 123',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza almacén sin ubicación', () => {
    const result = createWarehouseSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(false)
  })
})

describe('createOfficeSchema', () => {
  it('valida oficina correcta', () => {
    const result = createOfficeSchema.safeParse({
      name: 'Oficina de Administración',
      code: 'OFI-001',
    })
    expect(result.success).toBe(true)
  })
})

describe('createVehicleSchema', () => {
  it('valida vehículo correcto', () => {
    const result = createVehicleSchema.safeParse({
      plate: 'ABC-123',
      name: 'Toyota Hilux',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza vehículo sin placa', () => {
    const result = createVehicleSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(false)
  })
})

describe('createFuelRequestSchema', () => {
  const valid = {
    fuelType: 'GASOLINA' as const,
    quantity: 20,
    reason: 'Viaje oficial',
    destinations: 'Lima - Huaraz',
    vehicleId: 1,
  }

  it('valida solicitud correcta', () => {
    const result = createFuelRequestSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rechaza tipo de combustible inválido', () => {
    const result = createFuelRequestSchema.safeParse({ ...valid, fuelType: 'DIESEL' })
    expect(result.success).toBe(false)
  })

  it('rechaza cantidad negativa', () => {
    const result = createFuelRequestSchema.safeParse({ ...valid, quantity: -5 })
    expect(result.success).toBe(false)
  })
})

describe('createIngressSchema', () => {
  it('valida ingreso correcto', () => {
    const result = createIngressSchema.safeParse({
      items: [{ itemId: 1, quantity: 10 }],
      warehouseId: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rechaza ingreso sin items', () => {
    const result = createIngressSchema.safeParse({
      items: [],
      warehouseId: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('createAssignedAssetSchema', () => {
  it('valida asignación correcta con userId numérico', () => {
    const result = createAssignedAssetSchema.safeParse({
      userId: '1',
      assignmentDocNumber: 'DOC-001',
      itemId: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rechaza userId no numérico', () => {
    const result = createAssignedAssetSchema.safeParse({
      userId: 'abc',
      assignmentDocNumber: 'DOC-001',
    })
    expect(result.success).toBe(false)
  })
})

describe('createWarrantySchema', () => {
  const validWarranty = {
    itemId: 1,
    supplierName: 'Proveedor S.A.',
    supplierContact: 'contacto@proveedor.com',
    purchaseDate: '2024-01-15',
    expiryDate: '2026-01-15',
    warrantyTerms: 'Cobertura total por 2 años',
    documentUrl: 'https://docs.example.com/warranty.pdf',
    notes: 'Garantía estándar',
    status: 'ACTIVE' as const,
  }

  it('valida garantía correcta', () => {
    const result = createWarrantySchema.safeParse(validWarranty)
    expect(result.success).toBe(true)
  })

  it('rechaza sin supplierName', () => {
    const result = createWarrantySchema.safeParse({ ...validWarranty, supplierName: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza sin supplierName (campo faltante)', () => {
    const result = createWarrantySchema.safeParse({
      itemId: 1,
      purchaseDate: '2024-01-15',
      expiryDate: '2026-01-15',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza itemId no positivo', () => {
    const result = createWarrantySchema.safeParse({ ...validWarranty, itemId: 0 })
    expect(result.success).toBe(false)
  })

  it('rechaza purchaseDate inválida', () => {
    const result = createWarrantySchema.safeParse({ ...validWarranty, purchaseDate: 'not-a-date' })
    expect(result.success).toBe(false)
  })

  it('rechaza status inválido', () => {
    const result = createWarrantySchema.safeParse({ ...validWarranty, status: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('acepta campos opcionales ausentes', () => {
    const result = createWarrantySchema.safeParse({
      itemId: 1,
      supplierName: 'Proveedor',
      purchaseDate: '2024-01-15',
      expiryDate: '2026-01-15',
    })
    expect(result.success).toBe(true)
  })

  it('acepta warrantyTerms con máximo 1000 caracteres', () => {
    const result = createWarrantySchema.safeParse({
      ...validWarranty,
      warrantyTerms: 'A'.repeat(1000),
    })
    expect(result.success).toBe(true)
  })

  it('rechaza warrantyTerms con más de 1000 caracteres', () => {
    const result = createWarrantySchema.safeParse({
      ...validWarranty,
      warrantyTerms: 'A'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})

describe('updateFuelRequestSchema', () => {
  it('valida acción authorize', () => {
    const result = updateFuelRequestSchema.safeParse({
      id: 1,
      action: 'authorize',
      pin: '1234',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza acción inválida', () => {
    const result = updateFuelRequestSchema.safeParse({
      id: 1,
      action: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})
