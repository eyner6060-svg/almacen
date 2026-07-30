import { db } from '@/lib/db'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

interface WebhookPayload {
  event: string
  timestamp: string
  data: Record<string, unknown>
}

interface WebhookConfig {
  id: number
  name: string
  url: string
  secret: string
  events: string[]
  isActive: boolean
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 15000]

// Lista negra de IPs/bloques internos para prevenir SSRF
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
]

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const hostname = parsed.hostname
    for (const pattern of BLOCKED_HOSTS) {
      if (pattern.test(hostname)) return false
    }
    return true
  } catch {
    return false
  }
}

async function getWebhooksForEvent(event: string): Promise<WebhookConfig[]> {
  const webhooks = await db.webhook.findMany({
    where: { isActive: true }
  })

  return webhooks
    .filter(webhook => {
      const events = JSON.parse(webhook.events) as string[]
      return events.includes(event) || events.includes('*')
    })
    .map(webhook => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret,
      events: JSON.parse(webhook.events) as string[],
      isActive: webhook.isActive
    }))
}

function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

async function deliverWebhook(
  webhook: WebhookConfig,
  payload: WebhookPayload,
  attempt: number = 1
): Promise<{ success: boolean; responseCode?: number; error?: string }> {
  const payloadString = JSON.stringify(payload)
  const signature = generateSignature(payloadString, webhook.secret)

  // Validar URL contra ataque SSRF
  if (!isValidWebhookUrl(webhook.url)) {
    return { success: false, error: 'URL de webhook no válida o apunta a red interna' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': payload.event,
        'X-Webhook-Delivery': crypto.randomUUID(),
        'User-Agent': 'SistemaAlmacen-Webhook/1.0'
      },
      body: payloadString,
      signal: controller.signal
    })

    clearTimeout(timeout)

    return {
      success: response.ok,
      responseCode: response.status
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'

    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]))
      return deliverWebhook(webhook, payload, attempt + 1)
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}

async function logDelivery(
  webhookId: number,
  event: string,
  payload: WebhookPayload,
  success: boolean,
  responseCode?: number,
  attempts: number = 1
): Promise<void> {
  await db.webhookDelivery.create({
    data: {
      webhookId,
      event,
      payload: JSON.stringify(payload),
      responseCode,
      success,
      attempts
    }
  })

  await db.webhook.update({
    where: { id: webhookId },
    data: { lastTriggeredAt: new Date() }
  })
}

async function deliverWebhooksSync(
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const webhooks = await getWebhooksForEvent(event)
  if (webhooks.length === 0) return

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data
  }

  const results = await Promise.allSettled(
    webhooks.map(async (webhook) => {
      let attempts = 1
      const result = await deliverWebhook(webhook, payload)
      if (!result.success) attempts = MAX_RETRIES
      await logDelivery(webhook.id, event, payload, result.success, result.responseCode, attempts)
      return { webhook: webhook.name, ...result }
    })
  )

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const { webhook, success, error } = result.value
      if (!success) {
        logger.error(`[Webhook] ${webhook}: Entrega fallida - ${error}`)
      }
    } else {
      logger.error(`[Webhook] Error de entrega para ${webhooks[index]!.name}:`, result.reason)
    }
  })
}

export { deliverWebhooksSync }
