import { db } from '@/lib/db'

interface AssignmentRequestItem {
  itemId: number
  itemName: string
  quantity: number
}

interface AssignmentRequest {
  id: number
  userId: number
  userName: string
  userOffice: string
  items: AssignmentRequestItem[]
  notes: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  processedAt?: string
  processedBy?: string
  rejectionReason?: string
}

export async function createRequest(data: Omit<AssignmentRequest, 'id' | 'status' | 'createdAt'>): Promise<AssignmentRequest> {
  const result = await db.assignmentRequest.create({
    data: {
      userId: data.userId,
      userName: data.userName,
      userOffice: data.userOffice,
      items: JSON.stringify(data.items),
      notes: data.notes,
    },
  })

  return {
    id: result.id,
    userId: result.userId,
    userName: result.userName,
    userOffice: result.userOffice,
    items: JSON.parse(result.items) as AssignmentRequestItem[],
    notes: result.notes || '',
    status: result.status as AssignmentRequest['status'],
    createdAt: result.createdAt.toISOString(),
    processedAt: result.processedAt?.toISOString(),
    processedBy: undefined,
    rejectionReason: result.rejectionReason || undefined,
  }
}

export async function getRequests(userId?: number, page = 1, perPage = 50): Promise<{ requests: AssignmentRequest[]; total: number }> {
  const where: Record<string, unknown> = {}
  if (userId !== undefined) {
    where.userId = userId
  }

  const [results, total] = await Promise.all([
    db.assignmentRequest.findMany({
      where,
      select: { id: true, userId: true, userName: true, userOffice: true, items: true, notes: true, status: true, createdAt: true, processedAt: true, rejectionReason: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.assignmentRequest.count({ where }),
  ])

  return {
    requests: results.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      userOffice: r.userOffice,
      items: JSON.parse(r.items) as AssignmentRequestItem[],
      notes: r.notes || '',
      status: r.status as AssignmentRequest['status'],
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString(),
      processedBy: undefined,
      rejectionReason: r.rejectionReason || undefined,
    })),
    total,
  }
}

export async function getRequestById(id: number): Promise<AssignmentRequest | null> {
  const result = await db.assignmentRequest.findUnique({
    where: { id },
    select: { id: true, userId: true, userName: true, userOffice: true, items: true, notes: true, status: true, createdAt: true, processedAt: true, rejectionReason: true },
  })

  if (!result) return null

  return {
    id: result.id,
    userId: result.userId,
    userName: result.userName,
    userOffice: result.userOffice,
    items: JSON.parse(result.items) as AssignmentRequestItem[],
    notes: result.notes || '',
    status: result.status as AssignmentRequest['status'],
    createdAt: result.createdAt.toISOString(),
    processedAt: result.processedAt?.toISOString(),
    processedBy: undefined,
    rejectionReason: result.rejectionReason || undefined,
  }
}

export async function updateRequest(id: number, updates: Partial<AssignmentRequest>): Promise<AssignmentRequest | null> {
  const dbUpdates: Record<string, unknown> = {}

  if (updates.status) dbUpdates.status = updates.status
  if (updates.rejectionReason !== undefined) dbUpdates.rejectionReason = updates.rejectionReason
  if (updates.processedAt !== undefined) dbUpdates.processedAt = new Date(updates.processedAt)
  if (updates.processedBy !== undefined) {
    const user = await db.user.findFirst({ where: { fullName: updates.processedBy }, select: { id: true } })
    if (user) dbUpdates.processedById = user.id
  }

  const result = await db.assignmentRequest.update({
    where: { id },
    data: dbUpdates,
  })

  return {
    id: result.id,
    userId: result.userId,
    userName: result.userName,
    userOffice: result.userOffice,
    items: JSON.parse(result.items) as AssignmentRequestItem[],
    notes: result.notes || '',
    status: result.status as AssignmentRequest['status'],
    createdAt: result.createdAt.toISOString(),
    processedAt: result.processedAt?.toISOString(),
    processedBy: updates.processedBy,
    rejectionReason: result.rejectionReason || undefined,
  }
}
