import { describe, it, expect, beforeEach } from 'vitest'
import {
  useItemsStore,
  useCartStore,
  useOrdersStore,
  useOfficesStore,
  useWarehousesStore,
  useUsersStore,
  useNotificationsStore,
  useVehiclesStore,
  useFuelInventoryStore,
  useFuelRequestsStore,
  useLoansStore,
} from '@/store'

function createMockItem(overrides = {}) {
  return {
    id: 1,
    name: 'Laptop',
    model: 'ThinkPad X1',
    brand: 'Lenovo',
    color: null,
    series: null,
    code: 'LAP-001',
    patrimonialCode: null,
    patrimonialCodes: null,
    category: 'Equipos',
    itemType: 'CONSUMIBLE' as const,
    quantity: 10,
    minStock: 2,
    unit: 'unidad',
    imageUrl: null,
    warehouseId: 1,
    warehouse: { id: 1, name: 'Almacén Central', location: 'Principal', description: null, isActive: true, managerId: null, manager: null, createdAt: new Date().toISOString() },
    qrCode: null,
    barcodeData: null,
    technicalSpecs: null,
    supportDocumentUrl: null,
    isDeleted: false,
    deletedAt: null,
    status: 'DISPONIBLE',
    location: 'Estante A',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('useItemsStore', () => {
  beforeEach(() => {
    useItemsStore.setState({ items: [], categories: [] })
  })

  it('inicializa vacío', () => {
    const state = useItemsStore.getState()
    expect(state.items).toHaveLength(0)
  })

  it('setItems establece items', () => {
    const items = [createMockItem(), createMockItem({ id: 2, name: 'Mouse' })]
    useItemsStore.getState().setItems(items)
    expect(useItemsStore.getState().items).toHaveLength(2)
  })

  it('addItem agrega al inicio', () => {
    useItemsStore.getState().setItems([createMockItem({ id: 2 })])
    useItemsStore.getState().addItem(createMockItem({ id: 1 }))
    expect(useItemsStore.getState().items[0]!.id).toBe(1)
  })

  it('updateItem actualiza parcialmente', () => {
    useItemsStore.getState().setItems([createMockItem()])
    useItemsStore.getState().updateItem(1, { quantity: 5 })
    expect(useItemsStore.getState().items[0]!.quantity).toBe(5)
  })

  it('removeItem elimina por id', () => {
    useItemsStore.getState().setItems([createMockItem(), createMockItem({ id: 2 })])
    useItemsStore.getState().removeItem(1)
    expect(useItemsStore.getState().items).toHaveLength(1)
    expect(useItemsStore.getState().items[0]!.id).toBe(2)
  })

  it('setCategories establece categorías', () => {
    useItemsStore.getState().setCategories(['Equipos', 'Muebles'])
    expect(useItemsStore.getState().categories).toHaveLength(2)
  })
})

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] })
  })

  it('inicializa vacío', () => {
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('addItem agrega item consumible', () => {
    const item = createMockItem()
    useCartStore.getState().addItem(item, 3)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0]!.quantity).toBe(3)
  })

  it('addItem acumula cantidades del mismo consumible', () => {
    const item = createMockItem()
    useCartStore.getState().addItem(item, 3)
    useCartStore.getState().addItem(item, 2)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0]!.quantity).toBe(5)
  })

  it('addItem agrega item patrimonial con unitId', () => {
    const item = createMockItem({ itemType: 'PATRIMONIAL' })
    useCartStore.getState().addItem(item, 1, 100)
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('addItem no duplica patrimonial con mismo unitId', () => {
    const item = createMockItem({ itemType: 'PATRIMONIAL' })
    useCartStore.getState().addItem(item, 1, 100)
    useCartStore.getState().addItem(item, 1, 100)
    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('removeItem elimina por itemId', () => {
    useCartStore.getState().addItem(createMockItem(), 1)
    useCartStore.getState().removeItem(1)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('removeItem elimina solo el item patrimonial con unitId específico', () => {
    const item = createMockItem({ itemType: 'PATRIMONIAL' })
    useCartStore.getState().addItem(item, 1, 100)
    useCartStore.getState().addItem(item, 1, 101)
    expect(useCartStore.getState().items).toHaveLength(2)
    useCartStore.getState().removeItem(1, 100)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0]!.patrimonialUnitId).toBe(101)
  })

  it('removeItem sin patrimonialUnitId elimina todos los patrimoniales del mismo item', () => {
    const item = createMockItem({ itemType: 'PATRIMONIAL' })
    useCartStore.getState().addItem(item, 1, 100)
    useCartStore.getState().addItem(item, 1, 101)
    useCartStore.getState().removeItem(1)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('updateQuantity actualiza cantidad', () => {
    useCartStore.getState().addItem(createMockItem(), 1)
    useCartStore.getState().updateQuantity(1, 10)
    expect(useCartStore.getState().items[0]!.quantity).toBe(10)
  })

  it('updateQuantity con patrimonialUnitId actualiza solo ese item', () => {
    const item = createMockItem({ itemType: 'PATRIMONIAL' })
    useCartStore.getState().addItem(item, 1, 100)
    useCartStore.getState().addItem(item, 1, 101)
    useCartStore.getState().updateQuantity(1, 5, 100)
    const item100 = useCartStore.getState().items.find(i => i.patrimonialUnitId === 100)
    const item101 = useCartStore.getState().items.find(i => i.patrimonialUnitId === 101)
    expect(item100?.quantity).toBe(5)
    expect(item101?.quantity).toBe(1)
  })

  it('updateQuantity sin patrimonialUnitId actualiza todos los coincidentes', () => {
    const item = createMockItem({ itemType: 'PATRIMONIAL' })
    useCartStore.getState().addItem(item, 1, 100)
    useCartStore.getState().addItem(item, 1, 101)
    useCartStore.getState().updateQuantity(1, 3)
    expect(useCartStore.getState().items[0]!.quantity).toBe(3)
    expect(useCartStore.getState().items[1]!.quantity).toBe(3)
  })

  it('clearCart vacía el carrito', () => {
    useCartStore.getState().addItem(createMockItem(), 1)
    useCartStore.getState().addItem(createMockItem({ id: 2 }), 2)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('getTotalItems suma cantidades', () => {
    useCartStore.getState().addItem(createMockItem(), 3)
    useCartStore.getState().addItem(createMockItem({ id: 2 }), 7)
    expect(useCartStore.getState().getTotalItems()).toBe(10)
  })
})

describe('useOrdersStore', () => {
  beforeEach(() => {
    useOrdersStore.setState({ orders: [] })
  })

  it('CRUD básico', () => {
    const order = { id: 1, status: 'PENDIENTE' as const, items: [], createdAt: new Date().toISOString() }
    useOrdersStore.getState().addOrder(order as any)
    expect(useOrdersStore.getState().orders).toHaveLength(1)

    useOrdersStore.getState().updateOrder(1, { status: 'COMPLETADO' })
    expect(useOrdersStore.getState().orders[0]!.status).toBe('COMPLETADO')

    useOrdersStore.getState().removeOrder(1)
    expect(useOrdersStore.getState().orders).toHaveLength(0)
  })
})

describe('useOfficesStore', () => {
  beforeEach(() => {
    useOfficesStore.setState({ offices: [] })
  })

  it('CRUD básico', () => {
    const office = { id: 1, name: 'Oficina Admin', code: 'OFI-001', isActive: true, description: null, createdAt: new Date().toISOString() }
    useOfficesStore.getState().addOffice(office)
    expect(useOfficesStore.getState().offices).toHaveLength(1)

    useOfficesStore.getState().updateOffice(1, { name: 'Nuevo Nombre' })
    expect(useOfficesStore.getState().offices[0]!.name).toBe('Nuevo Nombre')

    useOfficesStore.getState().removeOffice(1)
    expect(useOfficesStore.getState().offices).toHaveLength(0)
  })
})

describe('useWarehousesStore', () => {
  it('CRUD básico', () => {
    const wh = { id: 1, name: 'Almacén', location: 'Ubicación', description: null, isActive: true }
    useWarehousesStore.getState().addWarehouse(wh as any)
    expect(useWarehousesStore.getState().warehouses).toHaveLength(1)
    useWarehousesStore.getState().setWarehouses([])
    expect(useWarehousesStore.getState().warehouses).toHaveLength(0)
  })
})

describe('useUsersStore', () => {
  it('CRUD básico', () => {
    const user = {
      id: 1, fullName: 'Test', dni: '12345678', phone: null, position: 'Test',
      email: 'test@test.com', role: 'TRABAJADOR' as const, isActive: true,
      officeId: null, office: null, isDriver: false,
      canAuthorizeOrders: false, canAuthorizeFuel: false, canAuthorizeAssignments: false, canAuthorizeLoans: false,
      vehicle: null, createdAt: new Date().toISOString(),
    }
    useUsersStore.getState().addUser(user)
    expect(useUsersStore.getState().users).toHaveLength(1)
    useUsersStore.getState().updateUser(1, { role: 'ALMACENERO' })
    expect(useUsersStore.getState().users[0]!.role).toBe('ALMACENERO')
    useUsersStore.getState().removeUser(1)
    expect(useUsersStore.getState().users).toHaveLength(0)
  })
})

describe('useNotificationsStore', () => {
  beforeEach(() => {
    useNotificationsStore.setState({ notifications: [], unreadCount: 0 })
  })

  it('markAsRead reduce contador no leídos', () => {
    useNotificationsStore.getState().setNotifications([
      { id: 1, isRead: false, message: 'Test', type: 'STOCK_BAJO', createdAt: new Date().toISOString() },
    ] as any)
    useNotificationsStore.getState().setUnreadCount(1)
    useNotificationsStore.getState().markAsRead(1)
    const state = useNotificationsStore.getState()
    expect(state.notifications[0]!.isRead).toBe(true)
    expect(state.unreadCount).toBe(0)
  })

  it('markAsRead en notificación ya leída no reduce contador', () => {
    useNotificationsStore.getState().setNotifications([
      { id: 1, isRead: true, message: 'Test', type: 'STOCK_BAJO', createdAt: new Date().toISOString() },
    ] as any)
    useNotificationsStore.getState().setUnreadCount(0)
    useNotificationsStore.getState().markAsRead(1)
    const state = useNotificationsStore.getState()
    expect(state.unreadCount).toBe(0)
    expect(state.notifications[0]!.isRead).toBe(true)
  })

  it('markAllAsRead marca todo como leído', () => {
    useNotificationsStore.getState().setNotifications([
      { id: 1, isRead: false, message: 'A', type: 'STOCK_BAJO', createdAt: '' },
      { id: 2, isRead: false, message: 'B', type: 'STOCK_BAJO', createdAt: '' },
    ] as any)
    useNotificationsStore.getState().setUnreadCount(2)
    useNotificationsStore.getState().markAllAsRead()
    const state = useNotificationsStore.getState()
    expect(state.notifications.every(n => n.isRead)).toBe(true)
    expect(state.unreadCount).toBe(0)
  })
})

describe('useVehiclesStore', () => {
  it('CRUD básico', () => {
    const vehicle = { id: 1, name: 'Toyota', plate: 'ABC-123', description: null, isActive: true, driverId: null, driver: null, createdAt: '' }
    useVehiclesStore.getState().addVehicle(vehicle as any)
    expect(useVehiclesStore.getState().vehicles).toHaveLength(1)
    useVehiclesStore.getState().removeVehicle(1)
    expect(useVehiclesStore.getState().vehicles).toHaveLength(0)
  })
})

describe('useFuelInventoryStore', () => {
  it('updateInventory actualiza por fuelType', () => {
    useFuelInventoryStore.getState().setInventory([
      { fuelType: 'GASOLINA', quantity: 100 },
      { fuelType: 'PETROLEO', quantity: 50 },
    ] as any)
    useFuelInventoryStore.getState().updateInventory('GASOLINA', 80)
    const inv = useFuelInventoryStore.getState().inventory
    expect(inv.find(i => i.fuelType === 'GASOLINA')?.quantity).toBe(80)
    expect(inv.find(i => i.fuelType === 'PETROLEO')?.quantity).toBe(50)
  })
})

describe('useFuelRequestsStore', () => {
  it('CRUD básico', () => {
    const req = { id: 1, status: 'PENDIENTE', fuelType: 'GASOLINA', quantity: 20 } as any
    useFuelRequestsStore.getState().addFuelRequest(req)
    expect(useFuelRequestsStore.getState().fuelRequests).toHaveLength(1)
    useFuelRequestsStore.getState().updateFuelRequest(1, { status: 'AUTORIZADO' })
    expect(useFuelRequestsStore.getState().fuelRequests[0]!.status).toBe('AUTORIZADO')
    useFuelRequestsStore.getState().removeFuelRequest(1)
    expect(useFuelRequestsStore.getState().fuelRequests).toHaveLength(0)
  })
})

describe('useLoansStore', () => {
  beforeEach(() => {
    useLoansStore.setState({ loans: [], total: 0 })
  })

  it('CRUD con total', () => {
    const loan = { id: 1, status: 'ACTIVO' } as any
    useLoansStore.getState().addLoan(loan)
    useLoansStore.getState().setTotal(1)
    expect(useLoansStore.getState().loans).toHaveLength(1)
    expect(useLoansStore.getState().total).toBe(1)

    useLoansStore.getState().updateLoan(1, { status: 'DEVUELTO' })
    expect(useLoansStore.getState().loans[0]!.status).toBe('DEVUELTO')

    useLoansStore.getState().removeLoan(1)
    expect(useLoansStore.getState().loans).toHaveLength(0)
  })
})
