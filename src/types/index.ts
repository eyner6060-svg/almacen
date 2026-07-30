export type Role = 'ADMINISTRADOR' | 'ALMACENERO' | 'JEFE_OFICINA' | 'TRABAJADOR'

export type ItemType = 'CONSUMIBLE' | 'PATRIMONIAL'

export type ItemStatus = string

export interface ItemStatusEnum {
  id: number
  name: string
  label: string
  color: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type OrderStatus = 'PENDIENTE' | 'AUTORIZADO_JEFE' | 'AUTORIZADO_ALMACENERO' | 'COMPLETADO' | 'RECHAZADO'

export type NotifType = 'STOCK_BAJO' | 'PEDIDO_PENDIENTE' | 'PEDIDO_AUTORIZADO' | 'PEDIDO_RECHAZADO' | 'BIEN_VENCIDO' | 'REPORTE_MENSUAL' | 'GARANTIA_PROXIMA_VENCER' | 'ITEM_MOVIMIENTO' | 'WORKFLOW_EJECUTADO' | 'SOLICITUD_COMBUSTIBLE' | 'PRESTAMO_CREADO'

export type AuthMethod = 'PIN' | 'FIRMA_FISICA'

export type FuelType = 'GASOLINA' | 'PETROLEO'

export type FuelRequestStatus = 'PENDIENTE' | 'AUTORIZADO' | 'COMPLETADO' | 'RECHAZADO'

export type SignatureType = 'FUEL_VOUCHER' | 'PATRIMONIAL_EXIT'

export type WarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'CLAIMED' | 'VOID'

export type AssignmentStatus = 'ASIGNADO' | 'DEVUELTO' | 'PERDIDO'

export type WorkflowTriggerType = 'ORDER_CREATED' | 'STOCK_LOW' | 'ITEM_STATUS_CHANGED'

export type WorkflowExecutionStatus = 'SUCCESS' | 'FAILED' | 'PENDING'

export type TDRStatus = 'BORRADOR' | 'GENERADO' | 'APROBADO' | 'OBSERVADO'
export type TDRType = 'BIENES' | 'COMBUSTIBLE' | 'DEVOLUCION'

export interface TDRItem {
  itemId: number
  name: string
  code: string
  quantity: number
  unit: string
  technicalSpecs: string | null
  currentStock: number
  minStock: number
  category: string
}

export interface TDR {
  id: number
  tdrNumber: string
  tdrType: TDRType
  category: string
  title: string
  justification: string
  objective: string
  items: TDRItem[]
  requirements: string
  deliverySchedule: string
  lugarEntrega: string
  formaPago: string
  presupuesto: string
  penalidades: string
  marcoLegal: string
  riesgos: string
  anticorrupcion: string
  adicional: string
  status: TDRStatus
  fileUrl: string | null
  generatedById: number
  isAutomatic: boolean
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  generatedBy?: { id: number; fullName: string; email: string }
}

// Catálogo de artículos para selección rápida
export interface ItemCatalog {
  id: number
  name: string
  brand: string
  model: string
  category: string
  itemType: ItemType
  unit: string
  technicalSpecs: string | null
  defaultMinStock: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Office {
  id: number
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: string
}

export interface Vehicle {
  id: number
  name: string
  plate: string
  description: string | null
  isActive: boolean
  driverId: number | null
  driver: User | null
  createdAt: string
}

export interface User {
  id: number
  fullName: string
  dni: string
  phone: string | null
  position: string
  email: string
  role: Role
  isActive: boolean
  officeId: number | null
  office: Office | null
  isDriver: boolean
  canAuthorizeOrders: boolean
  canAuthorizeFuel: boolean
  canAuthorizeAssignments: boolean
  canAuthorizeLoans: boolean
  vehicle: Vehicle | null
  twoFactorEnabled?: boolean
  twoFactorSecret?: string | null
  pin?: string | null
  hasPin?: boolean
  createdAt: string
}

export interface Warehouse {
  id: number
  name: string
  location: string
  description: string | null
  isActive: boolean
  managerId: number | null
  manager: User | null
  createdAt: string
}

export interface Item {
  id: number
  name: string
  model: string
  brand: string
  color: string | null
  series: string | null
  code: string
  patrimonialCode: string | null
  patrimonialCodes: string | null  // Cadena JSON con un arreglo de códigos
  itemType: ItemType
  category: string
  unit: string
  imageUrl: string | null
  quantity: number
  minStock: number
  status: ItemStatus
  location: string | null
  warehouseId: number
  warehouse: Warehouse
  qrCode: string | null
  barcodeData: string | null
  technicalSpecs: string | null
  supportDocumentUrl: string | null
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  patrimonialUnits?: PatrimonialUnit[]
  warranty?: Warranty
}

export interface OrderItem {
  id: number
  orderId: number
  order: Order
  itemId: number
  item: Item
  quantity: number
  patrimonialCode: string | null
  patrimonialUnitId: number | null
  patrimonialUnit?: PatrimonialUnit | null
  issueDate: string | null
  expectedReturnDate: string | null
  returnDate: string | null
  actualReturnDate: string | null
  currentLocation: string | null
  isOverdue: boolean
  notes: string | null
}

export interface PatrimonialUnit {
  id: number
  itemId: number
  item: Item
  patrimonialCode: string
  status: ItemStatus
  currentHolderId: number | null
  isAvailable: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderAuthorization {
  id: number
  orderId: number
  order: Order
  userId: number
  user: User
  role: Role
  authorizedAt: string
  method: AuthMethod
  ipAddress: string | null
}

export interface Order {
  id: number
  orderNumber: string
  status: OrderStatus
  requestedById: number
  requestedBy: User
  officeId: number
  office: Office
  notes: string | null
  pdfUrl: string | null
  signedPdfUrl: string | null
  issueDate: string
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  authorizations: OrderAuthorization[]
  patrimonialExitDocument: PatrimonialExitDocument | null
}

export interface Notification {
  id: number
  userId: number
  user: User
  title: string
  message: string
  type: NotifType
  isRead: boolean
  relatedId: number | null
  createdAt: string
}

export interface SystemConfig {
  id: number
  institutionName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  faviconUrl: string | null
  tabTitle: string
  footerText: string | null
  force2FA: boolean
  exemptedRoles: string[]
  maxPinAttempts: number
  pinLockoutMinutes: number
  updatedAt: string
}

// Ingreso de Combustible
export interface FuelEntry {
  id: number
  entryNumber: string
  fuelType: FuelType
  quantity: number
  previousStock: number
  newStock: number
  supplier: string | null
  documentNumber: string | null
  notes: string | null
  receivedById: number
  receivedBy: { id: number; fullName: string; email: string }
  fuelInventoryId: number
  createdAt: string
}

// Inventario de Combustible
export interface FuelInventory {
  id: number
  fuelType: FuelType
  quantity: number
  minStock: number
  updatedAt: string
}

// Firma de Solicitud de Combustible
export interface FuelRequestSignature {
  id: number
  fuelRequestId: number
  fuelRequest: FuelRequest
  order: number
  position: string
  signerName: string | null
  signedAt: string | null
  signatureType: string | null
}

// Solicitud de Combustible
export interface FuelRequest {
  id: number
  requestNumber: string
  fuelType: FuelType
  quantity: number
  reason: string
  destinations: string
  requestDate: string
  status: FuelRequestStatus
  requestedById: number
  requestedBy: User
  vehicleId: number
  vehicle: Vehicle
  pdfUrl: string | null
  signedPdfUrl: string | null
  createdAt: string
  updatedAt: string
  signatures: FuelRequestSignature[]
}

// Configuración de Firmas
export interface SignatureConfig {
  id: number
  type: SignatureType
  position: number
  title: string
  isRequired: boolean
  isActive: boolean
}

// Firma de Salida Patrimonial
export interface PatrimonialExitSignature {
  id: number
  patrimonialExitDocumentId: number
  patrimonialExitDocument: PatrimonialExitDocument
  order: number
  position: string
  signerName: string | null
  signedAt: string | null
}

// Documento de Salida Patrimonial
export interface PatrimonialExitDocument {
  id: number
  orderId: number
  order: Order
  requesterName: string
  exitReason: string
  exitDate: string
  pdfUrl: string | null
  signedPdfUrl: string | null
  createdAt: string
  signatures: PatrimonialExitSignature[]
}

// =============================================
// NUEVOS TIPOS - FUNCIONALIDADES AVANZADAS
// =============================================

// Preferencias de Notificación
export interface NotificationPreference {
  id?: number
  userId?: number
  notifType: string
  emailEnabled: boolean
  pushEnabled: boolean
  smsEnabled: boolean
}

// Reglas de Workflow
export interface WorkflowRule {
  id: number
  name: string
  description: string | null
  triggerType: WorkflowTriggerType
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

export interface WorkflowCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
  value: string | number
}

export interface WorkflowAction {
  type: 'auto_approve' | 'send_notification' | 'escalate' | 'create_task'
  config: Record<string, unknown>
}

// Ejecución de Workflow
export interface WorkflowExecution {
  id: number
  ruleId: number
  rule: WorkflowRule
  entityType: string
  entityId: number
  status: WorkflowExecutionStatus
  executedAt: string
  result: Record<string, unknown> | null
}

// Movimiento de Artículos
export interface ItemMovement {
  id: number
  patrimonialCode: string
  itemId: number
  item: Item
  fromLocation: string | null
  toLocation: string
  fromUserId: number | null
  toUserId: number | null
  movedById: number
  movedBy: User
  reason: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  createdAt: string
}

// Registro de Escaneo QR
export interface QRScanLog {
  id: number
  itemId: number | null
  code: string
  scanType: 'ITEM' | 'PATRIMONIAL' | 'LOCATION'
  scannedById: number
  scannedBy: User
  latitude: number | null
  longitude: number | null
  deviceInfo: string | null
  createdAt: string
}

// Garantía
export interface Warranty {
  id: number
  itemId: number
  item: Item
  purchaseDate: string
  expiryDate: string
  documentUrl: string | null
  supplierName: string | null
  supplierContact: string | null
  warrantyTerms: string | null
  status: WarrantyStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

// Firma Digital
export interface DigitalSignature {
  id: number
  documentType: 'ORDER' | 'PATRIMONIAL_EXIT' | 'FUEL_REQUEST'
  documentId: number
  userId: number
  user: User
  signatureData: string
  signedAt: string
  ipAddress: string | null
  userAgent: string | null
  certData: string | null
}

// Bien Asignado
export interface AssignedAsset {
  id: number
  userId: number
  user: User
  itemId: number
  item: Item
  patrimonialUnitId: number | null
  patrimonialUnit: PatrimonialUnit | null
  quantity: number
  assignmentDate: string
  assignmentDocNumber: string
  assignmentDocUrl: string | null
  returnDate: string | null
  returnDocNumber: string | null
  returnDocUrl: string | null
  status: AssignmentStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

// Estadísticas del tablero
export interface DashboardStats {
  totalItems: number
  lowStockItems: Item[]
  monthlyOrders: number
  pendingOrders: number
  patrimonialItemsOnLoan: Array<{
    item: Item
    order: Order
  }>
  usersWithMostOrders: Array<{
    user: User | undefined
    count: number
  }>
  mostRequestedItems: Array<{
    item: Item | undefined
    totalQuantity: number | null
  }>
  ordersByStatus: Array<{
    status: OrderStatus
    _count: { id: number }
  }>
  itemsByCategory: Array<{
    category: string
    _count: { id: number }
  }>
  // Tendencias de inventario
  inventoryTrends?: Array<{
    date: string
    ingresos: number
    salidas: number
  }>
  // Consumo por oficina
  consumptionByOffice?: Array<{
    office: Office
    count: number
    totalItems: number
  }>
  // Niveles de stock
  stockLevels?: Array<{
    category: string
    current: number
    minimum: number
  }>
  // Alertas de garantía
  warrantyAlerts?: Array<{
    item: Item
    warranty: Warranty
    daysRemaining: number
  }>
  // Estadísticas de combustible
  fuelInventory?: Array<{
    fuelType: FuelType
    quantity: number
    minStock: number
  }>
  usersWithMostFuelRequests?: Array<{
    user: User | undefined
    totalGallons: number
  }>
  fuelRequestsByMonth?: Array<{
    month: string
    gasoline: number
    petroleum: number
  }>
  // Estadísticas de workflow
  activeWorkflows?: number
  workflowExecutionsToday?: number
  // Estadísticas de API
  totalApiKeys?: number
  activeWebhooks?: number
  // Estadísticas de unidades patrimoniales
  totalPatrimonialUnits?: number
  patrimonialUnitsOut?: number
  patrimonialUnitsOverdue?: number
  patrimonialUnitsByStatus?: Array<{
    status: string
    _count: { id: number }
  }>
}

// Tipos de datos de reporte
export interface ReportData {
  title: string
  generatedAt: string
  generatedBy: User
  filters?: Record<string, unknown>
  data: unknown[]
  summary?: Record<string, unknown>
}

// Dashboard widgets
export type WidgetId = string

export interface WidgetConfig {
  id: WidgetId
  title: string
  type: 'kpi' | 'chart' | 'table' | 'badges'
  component: string
  defaultVisible: boolean
  defaultRow: number
  defaultWidth: 'full' | 'half' | 'third'
  minHeight?: number
}

export interface WidgetSettings {
  customTitle?: string
  width?: 'full' | 'half' | 'third'
  chartType?: 'bar' | 'line' | 'area' | 'pie'
  timeRange?: '7d' | '30d' | '90d' | '1y'
}

export interface DashboardLayout {
  widgets: WidgetId[]
  hiddenWidgets: WidgetId[]
  widgetSettings?: Record<WidgetId, Partial<WidgetSettings>>
}

// =============================================
// RASTREO Y RETORNO
// =============================================

export interface WhereaboutsUnit {
  patrimonialCode: string
  status: string
  currentLocation: string | null
  currentHolder: string | null
  holderDni: string | null
  reason: string
  referenceType: 'ORDER' | 'LOAN' | 'ASSIGNMENT'
  referenceId: number
  referenceNumber: string
  since: string
}

export interface WhereaboutsResponse {
  totalUnits: number
  availableUnits: number
  unavailableUnits: WhereaboutsUnit[]
}

export interface AvailableUnit {
  id: number
  patrimonialCode: string
  status: string
  itemId: number
  itemName: string
  itemCode: string
  itemCategory: string
  itemBrand: string
  itemModel: string
  currentLocation: string | null
  currentHolder: string | null
  holderDni: string | null
  reason: string
  referenceType: 'ORDER' | 'LOAN' | 'ASSIGNMENT'
  referenceId: number
  referenceNumber: string
  since: string
}

// =============================================
// PRÉSTAMOS
// =============================================

export type LoanStatus = 'PENDIENTE' | 'AUTORIZADO_ALMACENERO' | 'AUTORIZADO_JEFE' | 'PRESTADO' | 'DEVUELTO' | 'RECHAZADO'

export interface LoanItem {
  id: number
  loanId: number
  itemId: number
  item: Item
  quantity: number
  patrimonialUnitId: number | null
  patrimonialUnit: PatrimonialUnit | null
  itemName: string
  itemCode: string
  itemBrand: string
  itemModel: string
  itemCategory: string | null
  patrimonialCode: string | null
  itemType: string
}

export interface Loan {
  id: number
  documentNumber: string
  documentLabel: string
  borrowerName: string
  borrowerDni: string | null
  borrowerPhone: string | null
  borrowerAddress: string | null
  loanDate: string
  expectedReturnDate: string
  actualReturnDate: string | null
  reason: string
  status: LoanStatus
  almaceneroAuthId: number | null
  almaceneroAuthAt: string | null
  almaceneroAuth: User | null
  jefeAuthId: number | null
  jefeAuthAt: string | null
  jefeAuth: User | null
  rejectionReason: string | null
  rejectionAuthId: number | null
  rejectionAt: string | null
  rejectionAuth: User | null
  pdfUrl: string | null
  signedPdfUrl: string | null
  deletedAt: string | null
  createdById: number
  createdBy: User
  items: LoanItem[]
  createdAt: string
  updatedAt: string
}
