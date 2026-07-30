'use client'

import { create } from 'zustand'
import type { Item, Order, Office, Warehouse, Notification, Vehicle, FuelInventory, FuelRequest, SignatureConfig, User, Loan } from '@/types'

interface ItemsState {
  items: Item[]
  categories: string[]
  setItems: (items: Item[]) => void
  setCategories: (categories: string[]) => void
  addItem: (item: Item) => void
  updateItem: (id: number, item: Partial<Item>) => void
  removeItem: (id: number) => void
}

export const useItemsStore = create<ItemsState>((set) => ({
  items: [],
  categories: [],
  setItems: (items) => set({ items }),
  setCategories: (categories) => set({ categories }),
  addItem: (item) => set((state) => ({ items: [item, ...state.items] })),
  updateItem: (id, updatedItem) => set((state) => ({
    items: state.items.map((item) =>
      item.id === id ? { ...item, ...updatedItem } : item
    )
  })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id)
  }))
}))

export interface CartItem {
  item: Item
  quantity: number
  patrimonialUnitId?: number | null
  patrimonialCode?: string | null
  location?: string | null
}

interface CartState {
  items: CartItem[]
  addItem: (item: Item, quantity: number, patrimonialUnitId?: number | null, patrimonialCode?: string | null, location?: string | null) => void
  removeItem: (itemId: number, patrimonialUnitId?: number | null) => void
  updateQuantity: (itemId: number, quantity: number, patrimonialUnitId?: number | null) => void
  updateLocation: (itemId: number, patrimonialUnitId: number | null, location: string) => void
  clearCart: () => void
  getTotalItems: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (item, quantity, patrimonialUnitId = null, patrimonialCode = null, location = null) => set((state) => {
    if (item.itemType === 'PATRIMONIAL' && patrimonialUnitId) {
      const existing = state.items.find(i =>
        i.item.id === item.id && i.patrimonialUnitId === patrimonialUnitId
      )
      if (existing) return state
      return { items: [...state.items, { item, quantity: 1, patrimonialUnitId, patrimonialCode, location }] }
    }
    const existing = state.items.find(i => i.item.id === item.id && !i.patrimonialUnitId)
    if (existing) {
      return {
        items: state.items.map(i =>
          i.item.id === item.id && !i.patrimonialUnitId
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      }
    }
    return { items: [...state.items, { item, quantity, patrimonialUnitId, patrimonialCode, location }] }
  }),
  removeItem: (itemId, patrimonialUnitId) => set((state) => ({
    items: state.items.filter(i => {
      if (i.item.id !== itemId) return true
      if (patrimonialUnitId != null) {
        return i.patrimonialUnitId !== patrimonialUnitId
      }
      return false
    })
  })),
  updateQuantity: (itemId, quantity, patrimonialUnitId?) => set((state) => ({
    items: state.items.map(i =>
      i.item.id === itemId && (patrimonialUnitId == null || i.patrimonialUnitId === patrimonialUnitId) ? { ...i, quantity } : i
    )
  })),
  updateLocation: (itemId, patrimonialUnitId, location) => set((state) => ({
    items: state.items.map(i =>
      i.item.id === itemId && i.patrimonialUnitId === patrimonialUnitId
        ? { ...i, location }
        : i
    )
  })),
  clearCart: () => set({ items: [] }),
  getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0)
}))

interface OrdersState {
  orders: Order[]
  setOrders: (orders: Order[]) => void
  addOrder: (order: Order) => void
  updateOrder: (id: number, order: Partial<Order>) => void
  removeOrder: (id: number) => void
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  setOrders: (orders) => set({ orders }),
  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
  updateOrder: (id, updatedOrder) => set((state) => ({
    orders: state.orders.map((order) =>
      order.id === id ? { ...order, ...updatedOrder } : order
    )
  })),
  removeOrder: (id) => set((state) => ({
    orders: state.orders.filter((order) => order.id !== id)
  }))
}))

interface OfficesState {
  offices: Office[]
  setOffices: (offices: Office[]) => void
  addOffice: (office: Office) => void
  updateOffice: (id: number, office: Partial<Office>) => void
  removeOffice: (id: number) => void
}

export const useOfficesStore = create<OfficesState>((set) => ({
  offices: [],
  setOffices: (offices) => set({ offices }),
  addOffice: (office) => set((state) => ({ offices: [office, ...state.offices] })),
  updateOffice: (id, updatedOffice) => set((state) => ({
    offices: state.offices.map((office) =>
      office.id === id ? { ...office, ...updatedOffice } : office
    )
  })),
  removeOffice: (id) => set((state) => ({
    offices: state.offices.filter((office) => office.id !== id)
  }))
}))

interface WarehousesState {
  warehouses: Warehouse[]
  setWarehouses: (warehouses: Warehouse[]) => void
  addWarehouse: (warehouse: Warehouse) => void
  updateWarehouse: (id: number, warehouse: Partial<Warehouse>) => void
  removeWarehouse: (id: number) => void
}

export const useWarehousesStore = create<WarehousesState>((set) => ({
  warehouses: [],
  setWarehouses: (warehouses) => set({ warehouses }),
  addWarehouse: (warehouse) => set((state) => ({ warehouses: [warehouse, ...state.warehouses] })),
  updateWarehouse: (id, updatedWarehouse) => set((state) => ({
    warehouses: state.warehouses.map((warehouse) =>
      warehouse.id === id ? { ...warehouse, ...updatedWarehouse } : warehouse
    )
  })),
  removeWarehouse: (id) => set((state) => ({
    warehouses: state.warehouses.filter((warehouse) => warehouse.id !== id)
  }))
}))

interface UsersState {
  users: User[]
  setUsers: (users: User[]) => void
  addUser: (user: User) => void
  updateUser: (id: number, user: Partial<User>) => void
  removeUser: (id: number) => void
}

export const useUsersStore = create<UsersState>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
  addUser: (user) => set((state) => ({ users: [user, ...state.users] })),
  updateUser: (id, updatedUser) => set((state) => ({
    users: state.users.map((user) =>
      user.id === id ? { ...user, ...updatedUser } : user
    )
  })),
  removeUser: (id) => set((state) => ({
    users: state.users.filter((user) => user.id !== id)
  }))
}))

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  setNotifications: (notifications: Notification[]) => void
  setUnreadCount: (count: number) => void
  markAsRead: (id: number) => void
  markAllAsRead: () => void
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) => set({ notifications }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  markAsRead: (id) => set((state) => {
    const wasAlreadyRead = state.notifications.find(n => n.id === id)?.isRead
    return {
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: wasAlreadyRead ? state.unreadCount : Math.max(0, state.unreadCount - 1)
    }
  }),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, isRead: true })),
    unreadCount: 0
  }))
}))

interface VehiclesState {
  vehicles: Vehicle[]
  setVehicles: (vehicles: Vehicle[]) => void
  addVehicle: (vehicle: Vehicle) => void
  updateVehicle: (id: number, vehicle: Partial<Vehicle>) => void
  removeVehicle: (id: number) => void
}

export const useVehiclesStore = create<VehiclesState>((set) => ({
  vehicles: [],
  setVehicles: (vehicles) => set({ vehicles }),
  addVehicle: (vehicle) => set((state) => ({ vehicles: [vehicle, ...state.vehicles] })),
  updateVehicle: (id, updatedVehicle) => set((state) => ({
    vehicles: state.vehicles.map((vehicle) =>
      vehicle.id === id ? { ...vehicle, ...updatedVehicle } : vehicle
    )
  })),
  removeVehicle: (id) => set((state) => ({
    vehicles: state.vehicles.filter((vehicle) => vehicle.id !== id)
  }))
}))

interface FuelInventoryState {
  inventory: FuelInventory[]
  setInventory: (inventory: FuelInventory[]) => void
  updateInventory: (fuelType: string, quantity: number) => void
}

export const useFuelInventoryStore = create<FuelInventoryState>((set) => ({
  inventory: [],
  setInventory: (inventory) => set({ inventory }),
  updateInventory: (fuelType, quantity) => set((state) => ({
    inventory: state.inventory.map((inv) =>
      inv.fuelType === fuelType ? { ...inv, quantity } : inv
    )
  }))
}))

interface FuelRequestsState {
  fuelRequests: FuelRequest[]
  setFuelRequests: (fuelRequests: FuelRequest[]) => void
  addFuelRequest: (fuelRequest: FuelRequest) => void
  updateFuelRequest: (id: number, fuelRequest: Partial<FuelRequest>) => void
  removeFuelRequest: (id: number) => void
}

export const useFuelRequestsStore = create<FuelRequestsState>((set) => ({
  fuelRequests: [],
  setFuelRequests: (fuelRequests) => set({ fuelRequests }),
  addFuelRequest: (fuelRequest) => set((state) => ({ fuelRequests: [fuelRequest, ...state.fuelRequests] })),
  updateFuelRequest: (id, updatedFuelRequest) => set((state) => ({
    fuelRequests: state.fuelRequests.map((fuelRequest) =>
      fuelRequest.id === id ? { ...fuelRequest, ...updatedFuelRequest } : fuelRequest
    )
  })),
  removeFuelRequest: (id) => set((state) => ({
    fuelRequests: state.fuelRequests.filter((fuelRequest) => fuelRequest.id !== id)
  }))
}))

interface SignatureConfigState {
  signatureConfigs: SignatureConfig[]
  setSignatureConfigs: (signatureConfigs: SignatureConfig[]) => void
  addSignatureConfig: (signatureConfig: SignatureConfig) => void
  updateSignatureConfig: (id: number, signatureConfig: Partial<SignatureConfig>) => void
  removeSignatureConfig: (id: number) => void
}

export const useSignatureConfigStore = create<SignatureConfigState>((set) => ({
  signatureConfigs: [],
  setSignatureConfigs: (signatureConfigs) => set({ signatureConfigs }),
  addSignatureConfig: (signatureConfig) => set((state) => ({ signatureConfigs: [...state.signatureConfigs, signatureConfig] })),
  updateSignatureConfig: (id, updatedSignatureConfig) => set((state) => ({
    signatureConfigs: state.signatureConfigs.map((signatureConfig) =>
      signatureConfig.id === id ? { ...signatureConfig, ...updatedSignatureConfig } : signatureConfig
    )
  })),
  removeSignatureConfig: (id) => set((state) => ({
    signatureConfigs: state.signatureConfigs.filter((signatureConfig) => signatureConfig.id !== id)
  }))
}))

// =============================================
// Gestor de Préstamos
// =============================================

interface LoansState {
  loans: Loan[]
  total: number
  setLoans: (loans: Loan[]) => void
  setTotal: (total: number) => void
  addLoan: (loan: Loan) => void
  updateLoan: (id: number, loan: Partial<Loan>) => void
  removeLoan: (id: number) => void
}

export const useLoansStore = create<LoansState>((set) => ({
  loans: [],
  total: 0,
  setLoans: (loans) => set({ loans }),
  setTotal: (total) => set({ total }),
  addLoan: (loan) => set((state) => ({ loans: [loan, ...state.loans] })),
  updateLoan: (id, updatedLoan) => set((state) => ({
    loans: state.loans.map((loan) => (loan.id === id ? { ...loan, ...updatedLoan } : loan)),
  })),
  removeLoan: (id) => set((state) => ({
    loans: state.loans.filter((loan) => loan.id !== id),
  })),
}))
