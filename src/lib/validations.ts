import { z } from 'zod'

const itemTypeEnum = z.enum(['CONSUMIBLE', 'PATRIMONIAL'])
const itemStatusEnum = z.string().min(1, 'Estado es requerido')
const roleEnum = z.enum(['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'])
const fuelTypeEnum = z.enum(['GASOLINA', 'PETROLEO'])

export const createUserSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  dni: z.string().regex(/^\d{8}$/),
  role: roleEnum,
  officeId: z.coerce.number().int().positive().optional(),
  phone: z.string().max(20).optional(),
  position: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  isDriver: z.boolean().optional(),
  vehicleId: z.coerce.number().int().positive().optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
})

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  email: z.string().email().max(200).optional(),
  dni: z.string().max(20).optional(),
  role: roleEnum.optional(),
  officeId: z.coerce.number().int().positive().optional(),
  phone: z.string().max(20).optional(),
  position: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  isDriver: z.boolean().optional(),
  vehicleId: z.coerce.number().int().positive().optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  canAuthorizeOrders: z.boolean().optional(),
  canAuthorizeFuel: z.boolean().optional(),
  canAuthorizeAssignments: z.boolean().optional(),
  canAuthorizeLoans: z.boolean().optional(),
}).strict()

export const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  itemType: itemTypeEnum,
  quantity: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  warehouseId: z.number().int().positive(),
  status: itemStatusEnum.optional(),
})

export const updateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  model: z.string().max(200).optional(),
  brand: z.string().max(200).optional(),
  color: z.string().max(100).optional(),
  series: z.string().max(200).optional(),
  itemType: itemTypeEnum.optional(),
  category: z.string().min(1).max(100).optional(),
  unit: z.string().max(50).optional(),
  quantity: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  status: itemStatusEnum.optional(),
  location: z.string().max(300).optional(),
  technicalSpecs: z.string().max(2000).optional(),
  supportDocumentUrl: z.string().max(500).nullish(),
  patrimonialCode: z.string().max(100).optional(),
}).strict()

export const createOrderSchema = z.object({
  items: z.array(z.object({
    itemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    patrimonialUnitId: z.number().int().positive().nullable().optional(),
    patrimonialCode: z.string().nullable().optional(),
  })).min(1),
  officeId: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
})

export const createWarehouseSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.string().min(1).max(300),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  managerId: z.number().int().positive().nullable().optional(),
})



export const createOfficeSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
})



export const createVehicleSchema = z.object({
  plate: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  isActive: z.boolean().optional(),
  driverId: z.number().int().positive().optional(),
})

export const updateVehicleSchema = createVehicleSchema.partial()

export const createWarrantySchema = z.object({
  itemId: z.number().int().positive(),
  supplierName: z.string().min(1).max(200),
  supplierContact: z.string().max(200).optional(),
  purchaseDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  warrantyTerms: z.string().max(1000).optional(),
  documentUrl: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CLAIMED', 'VOID']).optional(),
})

export const createFuelRequestSchema = z.object({
  fuelType: fuelTypeEnum,
  quantity: z.number().positive(),
  reason: z.string().min(1).max(500),
  destinations: z.string().min(1).max(500),
  vehicleId: z.number().int().positive(),
  estimatedDistance: z.number().positive().optional(),
})

export const syncConfigSchema = z.object({
  entityType: z.enum(['items', 'offices', 'patrimonial_codes', 'catalog']),
  forceFull: z.boolean().optional(),
})

export const createIngressSchema = z.object({
  items: z.array(z.object({
    itemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    patrimonialCodes: z.array(z.string().min(1)).optional(),
  })).min(1),
  warehouseId: z.number().int().positive(),
  supplier: z.string().max(200).nullable().optional(),
  documentNumber: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  receiptUrl: z.string().max(500).nullable().optional(),
})

export const createAssignedAssetSchema = z.object({
  userId: z.union([z.string(), z.number()]).transform(val => Number(val)).pipe(z.number().int().positive()),
  assignmentDocNumber: z.string().min(1).max(100),
  assignmentDocUrl: z.string().max(500).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  itemId: z.number().int().positive().optional(),
  patrimonialUnitId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  items: z.array(z.object({
    itemId: z.string().min(1),
    patrimonialUnitId: z.string().optional(),
    quantity: z.string().optional(),
  })).optional(),
})

export const updateFuelRequestSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(['authorize', 'reject', 'complete', 'upload_signed_pdf']),
  pin: z.string().regex(/^\d{4}$/).optional(),
  signedPdfUrl: z.string().max(500).optional(),
})
