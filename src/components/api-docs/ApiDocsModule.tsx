'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useConfigStore, useAuthStore } from '@/store'
import { apiFetch } from '@/lib/http'
import { normalizeText } from '@/lib/utils'
import {
  Copy,
  Check,
  Book,
  Key,
  Webhook,
  Terminal,
  FileJson,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'

interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    description: string
    version: string
  }
  paths: Record<string, Record<string, EndpointInfo>>
  tags: Array<{ name: string; description: string }>
}

interface EndpointInfo {
  tags: string[]
  summary: string
  description?: string
  parameters?: Array<{
    name: string
    in: string
    required?: boolean
    description?: string
    schema: { type: string; enum?: string[] }
  }>
  requestBody?: {
    required: boolean
    content: {
      'application/json': {
        schema: Record<string, unknown>
      }
    }
  }
  responses: Record<string, { description: string }>
}

interface WebhookConfig {
  id: number
  name: string
  url: string
  events: string[]
  isActive: boolean
  secret: string
}

const HTTP_METHOD_COLORS: Record<string, string> = {
  get: 'bg-green-500',
  post: 'bg-blue-500',
  put: 'bg-yellow-500',
  patch: 'bg-orange-500',
  delete: 'bg-red-500'
}

const AVAILABLE_EVENTS = [
  'order.created',
  'order.updated',
  'order.completed',
  'order.rejected',
  'item.created',
  'item.updated',
  'item.low_stock',
  'user.created',
  'user.updated',
  'sync.completed',
  'sync.failed'
]

export function ApiDocsModule() {
  const { config } = useConfigStore()
  const { user } = useAuthStore()
  const [spec, setSpec] = useState<OpenAPISpec | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: ''
  })

  useEffect(() => {
    fetchSpec()
    fetchWebhooks()
  }, [])

  const fetchSpec = async () => {
    try {
      const response = await apiFetch('/api/api-docs')
      if (response.ok) {
        const data = await response.json()
        setSpec(data)
        // Establecer el primer tag como seleccionado
        if (data.tags?.length > 0) {
          setSelectedTag(data.tags[0].name)
        }
      }
    } catch (error) {
      console.error('Error al obtener la especificación API:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWebhooks = async () => {
    try {
      const response = await apiFetch('/api/config')
      if (response.ok) {
        // Los webhooks se obtendrían de un endpoint dedicado
        setWebhooks([])
      }
    } catch (error) {
      console.error('Error al obtener webhooks:', error)
    }
  }

  const toggleEndpoint = (path: string, method: string) => {
    const key = `${method}:${path}`
    const newExpanded = new Set(expandedEndpoints)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedEndpoints(newExpanded)
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(key)
    setTimeout(() => setCopiedCode(null), 2000)
    toast.success('Copiado al portapapeles')
  }

  const generateCodeExample = (path: string, method: string, endpoint: EndpointInfo) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const fullUrl = `${baseUrl}/api${path}`

    const jsCode = `// JavaScript (fetch)
const response = await apiFetch('${fullUrl}', {
  method: '${method.toUpperCase()}',
  headers: {
    'Content-Type': 'application/json',
    // Incluir credenciales para peticiones autenticadas
    credentials: 'include'
  }${method !== 'get' && endpoint.requestBody ? `,
  body: JSON.stringify({
// Cuerpo de la petición aquí
  })` : ''}
});
 
const data = await response.json();`

    const pythonCode = `# Python (requests)
import requests
 
url = '${fullUrl}'
headers = {
    'Content-Type': 'application/json'
}
${method !== 'get' && endpoint.requestBody ? `data = {
    # Cuerpo de la petición aquí
}

response = requests.${method.toLowerCase()}(url, json=data, headers=headers)` : `response = requests.${method.toLowerCase()}(url, headers=headers)`}

print(response.json())`

    const curlCode = `# cURL
curl -X ${method.toUpperCase()} '${fullUrl}' \\
  -H 'Content-Type: application/json'${method !== 'get' && endpoint.requestBody ? ` \\
  -d '{
    "key": "value"
  }'` : ''}`

    return { jsCode, pythonCode, curlCode }
  }

  const filteredEndpoints = () => {
    if (!spec) return []

    return Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.entries(methods)
        .filter(([_method, endpoint]) => {
          const q = normalizeText(searchTerm)
          const matchesSearch = searchTerm === '' ||
            normalizeText(path).includes(q) ||
            normalizeText(endpoint.summary).includes(q)
          const matchesTag = !selectedTag || endpoint.tags.includes(selectedTag)
          return matchesSearch && matchesTag
        })
        .map(([method, endpoint]) => ({ path, method, endpoint }))
    )
  }

  const handleCreateWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast.error('Complete todos los campos requeridos')
      return
    }

    try {
      const response = await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'webhook',
          ...newWebhook
        })
      })

      if (response.ok) {
        toast.success('Webhook creado exitosamente')
        setNewWebhook({ name: '', url: '', events: [], secret: '' })
        fetchWebhooks()
      } else {
        toast.error('Error al crear webhook')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Documentación API</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Book className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Documentación API
          </h1>
          <p className="text-muted-foreground">
            Explora y prueba los endpoints de la API REST
          </p>
        </div>
        <Button variant="outline" onClick={fetchSpec}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints">
            <Terminal className="h-4 w-4 mr-2" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="authentication">
            <Key className="h-4 w-4 mr-2" />
            Autenticación
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="h-4 w-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="schemas">
            <FileJson className="h-4 w-4 mr-2" />
            Esquemas
          </TabsTrigger>
        </TabsList>

        {/* Pestaña de Endpoints */}
        <TabsContent value="endpoints" className="space-y-4">
          {/* Búsqueda y Filtro */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar endpoints..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={selectedTag || ''} onValueChange={setSelectedTag}>
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Filtrar por categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {spec?.tags?.map((tag) => (
                      <SelectItem key={tag.name} value={tag.name}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Endpoints */}
          <Card>
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {filteredEndpoints().map(({ path, method, endpoint }) => {
                  const key = `${method}:${path}`
                  const isExpanded = expandedEndpoints.has(key)
                  const codes = generateCodeExample(path, method, endpoint)

                  return (
                    <div key={key} className="p-4">
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => toggleEndpoint(path, method)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Badge className={`${HTTP_METHOD_COLORS[method]} text-white uppercase`}>
                          {method}
                        </Badge>
                        <code className="text-sm font-mono flex-1">{path}</code>
                        <span className="text-sm text-muted-foreground hidden md:block">
                          {endpoint.summary}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 ml-8 space-y-4">
                          {endpoint.description && (
                            <p className="text-sm text-muted-foreground">
                              {endpoint.description}
                            </p>
                          )}

                          {endpoint.parameters && endpoint.parameters.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Parámetros</h4>
                              <div className="bg-muted p-3 rounded-lg">
                                <Table responsiveCards>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Nombre</TableHead>
                                      <TableHead>Ubicación</TableHead>
                                      <TableHead hideOnMobile>Tipo</TableHead>
                                      <TableHead hideOnMobile>Requerido</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {endpoint.parameters.map((param, i) => (
                                      <TableRow key={i}>
                                        <TableCell className="font-mono">{param.name}</TableCell>
                                        <TableCell>{param.in}</TableCell>
                                        <TableCell hideOnMobile>{param.schema.type}</TableCell>
                                        <TableCell hideOnMobile>
                                          {param.required ? (
                                            <Badge variant="default">Sí</Badge>
                                          ) : (
                                            <Badge variant="outline">No</Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}

                          <div>
                            <h4 className="font-medium mb-2">Respuestas</h4>
                            <div className="space-y-1">
                              {Object.entries(endpoint.responses).map(([status, resp]) => (
                                <div key={status} className="flex items-center gap-2 text-sm">
                                  <Badge variant={status.startsWith('2') ? 'default' : 'destructive'}>
                                    {status}
                                  </Badge>
                                  <span className="text-muted-foreground">{resp.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium mb-2">Ejemplos de Código</h4>
                            <Tabs defaultValue="js">
                              <TabsList>
                                <TabsTrigger value="js">JavaScript</TabsTrigger>
                                <TabsTrigger value="python">Python</TabsTrigger>
                                <TabsTrigger value="curl">cURL</TabsTrigger>
                              </TabsList>
                              <TabsContent value="js">
                                <div className="relative">
                                  <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm">
                                    {codes.jsCode}
                                  </pre>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-2 right-2"
                                    onClick={() => copyToClipboard(codes.jsCode, 'js')}
                                  >
                                    {copiedCode === 'js' ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TabsContent>
                              <TabsContent value="python">
                                <div className="relative">
                                  <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm">
                                    {codes.pythonCode}
                                  </pre>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-2 right-2"
                                    onClick={() => copyToClipboard(codes.pythonCode, 'python')}
                                  >
                                    {copiedCode === 'python' ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TabsContent>
                              <TabsContent value="curl">
                                <div className="relative">
                                  <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm">
                                    {codes.curlCode}
                                  </pre>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-2 right-2"
                                    onClick={() => copyToClipboard(codes.curlCode, 'curl')}
                                  >
                                    {copiedCode === 'curl' ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Pestaña de Autenticación */}
        <TabsContent value="authentication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Autenticación por Sesión
              </CardTitle>
              <CardDescription>
                La API utiliza autenticación basada en cookies de sesión
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Flujo de Autenticación</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Realiza una petición POST a /api/auth/login con email y contraseña</li>
                  <li>El servidor establece una cookie de sesión segura (httpOnly)</li>
                  <li>Las peticiones subsequentes incluyen automáticamente la cookie</li>
                  <li>La sesión expira después de 8 horas de inactividad</li>
                </ol>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Ejemplo de Login</h4>
                <pre className="text-sm overflow-x-auto">
{`const response = await apiFetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'usuario@ejemplo.com',
    password: 'tu_contraseña'
  }),
  credentials: 'include'
});

const { user } = await response.json();`}
                </pre>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Roles y Permisos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <Badge className="mb-1">ADMINISTRADOR</Badge>
                    <p className="text-sm text-muted-foreground">
                      Acceso completo a todos los endpoints
                    </p>
                  </div>
                  <div>
                    <Badge className="mb-1" variant="secondary">ALMACENERO</Badge>
                    <p className="text-sm text-muted-foreground">
                      Gestión de inventario y pedidos
                    </p>
                  </div>
                  <div>
                    <Badge className="mb-1" variant="outline">JEFE_OFICINA</Badge>
                    <p className="text-sm text-muted-foreground">
                      Autorización de pedidos de su oficina
                    </p>
                  </div>
                  <div>
                    <Badge className="mb-1" variant="outline">TRABAJADOR</Badge>
                    <p className="text-sm text-muted-foreground">
                      Creación de pedidos y consulta
                    </p>
                  </div>
                </div>
              </div>

              {user && (
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Sesión Activa</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Autenticado como: {user.fullName} ({user.role})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Webhooks */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Webhooks</CardTitle>
              <CardDescription>
                Recibe notificaciones en tiempo real cuando ocurren eventos en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Webhooks Existentes */}
              {webhooks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Webhooks Configurados</h4>
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{webhook.name}</span>
                        <Switch checked={webhook.isActive} />
                      </div>
                      <code className="text-sm text-muted-foreground block mb-2">{webhook.url}</code>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Crear Nuevo Webhook */}
              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Crear Nuevo Webhook</h4>
                <div className="space-y-4">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      placeholder="Mi Webhook"
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>URL del Endpoint</Label>
                    <Input
                      placeholder="https://mi-servidor.com/webhook"
                      value={newWebhook.url}
                      onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Secret (opcional)</Label>
                    <Input
                      type="password"
                      placeholder="Secreto para verificar firmas"
                      value={newWebhook.secret}
                      onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Eventos a escuchar</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {AVAILABLE_EVENTS.map((event) => (
                        <label key={event} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newWebhook.events.includes(event)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewWebhook({
                                  ...newWebhook,
                                  events: [...newWebhook.events, event]
                                })
                              } else {
                                setNewWebhook({
                                  ...newWebhook,
                                  events: newWebhook.events.filter((e) => e !== event)
                                })
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleCreateWebhook}>
                    <Webhook className="h-4 w-4 mr-2" />
                    Crear Webhook
                  </Button>
                </div>
              </div>

              {/* Ejemplo de Datos de Webhook */}
              <div className="border-t pt-6">
                <h4 className="font-medium mb-2">Ejemplo de Payload</h4>
                <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "event": "order.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "orderId": 123,
    "orderNumber": "PED-2024-001",
    "status": "COMPLETADO",
    "requestedBy": {
      "id": 1,
      "fullName": "Juan Pérez",
      "email": "juan@ejemplo.com"
    },
    "items": [
      { "itemId": 45, "name": "Laptop", "quantity": 1 }
    ]
  },
  "signature": "sha256=..."
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Esquemas */}
        <TabsContent value="schemas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Esquemas de Datos</CardTitle>
              <CardDescription>
                Estructuras de datos utilizadas en las peticiones y respuestas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    name: 'User',
                    description: 'Información del usuario',
                    schema: {
                      id: 'number',
                      fullName: 'string',
                      email: 'string',
                      role: 'ADMINISTRADOR | ALMACENERO | JEFE_OFICINA | TRABAJADOR',
                      officeId: 'number | null',
                      isActive: 'boolean'
                    }
                  },
                  {
                    name: 'Item',
                    description: 'Bien del inventario',
                    schema: {
                      id: 'number',
                      name: 'string',
                      code: 'string',
                      itemType: 'CONSUMIBLE | PATRIMONIAL',
                      category: 'string',
                      quantity: 'number',
                      minStock: 'number',
                      status: 'OPERATIVO | AVERIADO | BAJA',
                      warehouseId: 'number'
                    }
                  },
                  {
                    name: 'Order',
                    description: 'Pedido de bienes',
                    schema: {
                      id: 'number',
                      orderNumber: 'string',
                      status: 'PENDIENTE | AUTORIZADO_JEFE | AUTORIZADO_ALMACENERO | COMPLETADO | RECHAZADO',
                      requestedById: 'number',
                      officeId: 'number',
                      items: 'OrderItem[]',
                      createdAt: 'DateTime'
                    }
                  }
                ].map((schema) => (
                  <div key={schema.name} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-1">{schema.name}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{schema.description}</p>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      {JSON.stringify(schema.schema, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enlace OpenAPI */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileJson className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Especificación OpenAPI 3.0</p>
                <p className="text-sm text-muted-foreground">
                  Descarga la especificación completa en formato JSON
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <a href="/api/api-docs" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver JSON
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
