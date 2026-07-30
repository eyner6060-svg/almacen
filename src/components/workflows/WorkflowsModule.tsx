'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { useConfigStore } from '@/store'
import {
  Zap,
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  Loader2,
  Download,
  Search,
  FileText,
  FileSpreadsheet,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { WorkflowRule, WorkflowExecution, WorkflowTriggerType } from '@/types'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'
import { normalizeText } from '@/lib/utils'

interface WorkflowRuleWithExecutions extends WorkflowRule {
  executions?: WorkflowExecution[]
  _count?: {
    executions: number
  }
}

const triggerTypeLabels: Record<WorkflowTriggerType, { label: string; description: string }> = {
  ORDER_CREATED: {
    label: 'Pedido Creado',
    description: 'Cuando se crea un nuevo pedido',
  },
  STOCK_LOW: {
    label: 'Stock Bajo',
    description: 'Cuando el stock de un bien cae por debajo del mínimo',
  },
  ITEM_STATUS_CHANGED: {
    label: 'Cambio de Estado',
    description: 'Cuando el estado de un bien cambia',
  },
}

const actionTypeLabels: Record<string, { label: string; description: string }> = {
  auto_approve: {
    label: 'Auto-aprobar',
    description: 'Aprueba automáticamente el pedido',
  },
  send_notification: {
    label: 'Enviar Notificación',
    description: 'Envía una notificación a usuarios específicos',
  },
  escalate: {
    label: 'Escalar',
    description: 'Escala a un nivel superior de autorización',
  },
  create_task: {
    label: 'Crear Tarea',
    description: 'Crea una tarea de seguimiento',
  },
}

export function WorkflowsModule() {
  const { config } = useConfigStore()
  
  const [workflows, setWorkflows] = useState<WorkflowRuleWithExecutions[]>([])
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [triggerFilter, setTriggerFilter] = useState('all')
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowRuleWithExecutions | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowRuleWithExecutions | null>(null)
  const [activeTab, setActiveTab] = useState<'workflows' | 'history'>('workflows')

  // Estado del formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerType: 'ORDER_CREATED' as WorkflowTriggerType,
    conditions: [] as { field: string; operator: string; value: string }[],
    actions: [] as { type: string; config: Record<string, unknown> }[],
    isActive: true,
    priority: 0,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [workflowsRes, executionsRes] = await Promise.all([
        apiFetch('/api/workflows'),
        apiFetch('/api/workflows/executions?limit=20'),
      ])
      
      if (workflowsRes.ok) {
        const data = await workflowsRes.json()
        setWorkflows(data.workflows || [])
      }
      
      if (executionsRes.ok) {
        const data = await executionsRes.json()
        setExecutions(data.executions || [])
      }
    } catch (error) {
      console.error('Error al obtener workflows:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveWorkflow = async () => {
    if (!formData.name) {
      toast.error('El nombre es requerido')
      return
    }

    setIsSaving(true)
    try {
      const url = editingWorkflow ? `/api/workflows/${editingWorkflow.id}` : '/api/workflows'
      const method = editingWorkflow ? 'PUT' : 'POST'
      
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          conditions: JSON.stringify(formData.conditions),
          actions: JSON.stringify(formData.actions),
        }),
      })
      
      if (response.ok) {
        toast.success('El flujo de trabajo se ha guardado exitosamente')
        setIsDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        throw new Error('Error al guardar')
      }
    } catch (error) {
      console.error('Error al guardar workflow:', error)
      toast.error('No se pudo guardar el flujo de trabajo')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleWorkflow = async (workflow: WorkflowRuleWithExecutions) => {
    try {
      const response = await apiFetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !workflow.isActive }),
      })
      
      if (response.ok) {
        setWorkflows(prev =>
          prev.map(w => w.id === workflow.id ? { ...w, isActive: !w.isActive } : w)
        )
        toast.success(`El flujo "${workflow.name}" ha sido ${workflow.isActive ? 'desactivado' : 'activado'}`)
      }
    } catch (error) {
      console.error('Error al cambiar estado del flujo:', error)
    }
  }

  const handleDeleteClick = (workflow: WorkflowRuleWithExecutions) => {
    setWorkflowToDelete(workflow)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!workflowToDelete) return
    const response = await apiFetch(`/api/workflows/${workflowToDelete.id}`, { method: 'DELETE' })
    if (!response.ok) {
      throw new Error('Error al eliminar')
    }
    setWorkflows(prev => prev.filter(w => w.id !== workflowToDelete.id))
    setWorkflowToDelete(null)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      triggerType: 'ORDER_CREATED',
      conditions: [],
      actions: [],
      isActive: true,
      priority: 0,
    })
    setEditingWorkflow(null)
  }

  const openEditDialog = (workflow: WorkflowRuleWithExecutions) => {
    setEditingWorkflow(workflow)
    setFormData({
      name: workflow.name,
      description: workflow.description || '',
      triggerType: workflow.triggerType as WorkflowTriggerType,
      conditions: Array.isArray(workflow.conditions) ? workflow.conditions as { field: string; operator: string; value: string }[] : [],
      actions: Array.isArray(workflow.actions) ? workflow.actions : [],
      isActive: workflow.isActive,
      priority: workflow.priority,
    })
    setIsDialogOpen(true)
  }

  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'equals', value: '' }],
    }))
  }

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'send_notification', config: {} }],
    }))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Éxito</Badge>
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const filteredWorkflows = workflows.filter(w => {
    const matchesSearch = normalizeText(w.name).includes(normalizeText(search))
    const matchesTrigger = triggerFilter === 'all' || w.triggerType === triggerFilter
    return matchesSearch && matchesTrigger
  })

  if (isLoading) {
    return <ModuleSkeleton variant="cards" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flujos de Trabajo</h1>
          <p className="text-muted-foreground">
            Automatiza procesos y tareas del sistema
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: config?.primaryColor }} onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Flujo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingWorkflow ? 'Editar Flujo' : 'Nuevo Flujo de Trabajo'}
              </DialogTitle>
              <DialogDescription>
                Configura el disparador, condiciones y acciones del flujo
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Información Básica */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre del flujo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción del flujo"
                />
              </div>
              
              {/* Tipo de Disparador */}
              <div className="space-y-2">
                <Label>Disparador</Label>
                <Select
                  value={formData.triggerType}
                  onValueChange={(v) => setFormData({ ...formData, triggerType: v as WorkflowTriggerType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(triggerTypeLabels).map(([type, info]) => (
                      <SelectItem key={type} value={type}>
                        <div>
                          <p className="font-medium">{info.label}</p>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Condiciones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Condiciones</Label>
                  <Button variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                
                {formData.conditions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin condiciones. El flujo se ejecutará para todos los casos.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formData.conditions.map((condition, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Campo"
                          value={condition.field}
                          onChange={(e) => {
                            const newConditions = [...formData.conditions]
                            newConditions[index]!.field = e.target.value
                            setFormData({ ...formData, conditions: newConditions })
                          }}
                          className="flex-1"
                        />
                        <Select
                          value={condition.operator}
                          onValueChange={(v) => {
                            const newConditions = [...formData.conditions]
                            newConditions[index]!.operator = v
                            setFormData({ ...formData, conditions: newConditions })
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Igual a</SelectItem>
                            <SelectItem value="not_equals">Diferente de</SelectItem>
                            <SelectItem value="greater_than">Mayor que</SelectItem>
                            <SelectItem value="less_than">Menor que</SelectItem>
                            <SelectItem value="contains">Contiene</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Valor"
                          value={condition.value}
                          onChange={(e) => {
                            const newConditions = [...formData.conditions]
                            newConditions[index]!.value = e.target.value
                            setFormData({ ...formData, conditions: newConditions })
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newConditions = formData.conditions.filter((_, i) => i !== index)
                            setFormData({ ...formData, conditions: newConditions })
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Acciones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Acciones</Label>
                  <Button variant="outline" size="sm" onClick={addAction}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
                
                {formData.actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Agrega al menos una acción para el flujo.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formData.actions.map((action, index) => (
                      <div key={index} className="flex gap-2 items-center p-3 border rounded-lg">
                        <Select
                          value={action.type}
                          onValueChange={(v) => {
                            const newActions = [...formData.actions]
                            newActions[index]!.type = v
                            setFormData({ ...formData, actions: newActions })
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(actionTypeLabels).map(([type, info]) => (
                              <SelectItem key={type} value={type}>
                                {info.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground flex-1">
                          {actionTypeLabels[action.type]?.description}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newActions = formData.actions.filter((_, i) => i !== index)
                            setFormData({ ...formData, actions: newActions })
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Activar/Desactivar */}
              <div className="flex items-center justify-between">
                <Label>Activo</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveWorkflow} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToCSV(filteredWorkflows, [
              { key: 'name', label: 'Nombre' },
              { key: 'description', label: 'Descripción' },
              { key: 'triggerType', label: 'Disparador' },
              { key: 'isActive', label: 'Activo' },
              { key: 'priority', label: 'Prioridad' },
            ], `workflows-${new Date().toISOString().slice(0, 10)}`)}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToExcel(filteredWorkflows, [
              { key: 'name', label: 'Nombre' },
              { key: 'description', label: 'Descripción' },
              { key: 'triggerType', label: 'Disparador' },
              { key: 'isActive', label: 'Activo' },
              { key: 'priority', label: 'Prioridad' },
            ], `workflows-${new Date().toISOString().slice(0, 10)}`)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={triggerFilter} onValueChange={setTriggerFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Disparador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los disparadores</SelectItem>
                {Object.entries(triggerTypeLabels).map(([type, info]) => (
                  <SelectItem key={type} value={type}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pestañas */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'workflows'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('workflows')}
        >
          <Zap className="h-4 w-4 inline mr-2" />
          Flujos Activos
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('history')}
        >
          <History className="h-4 w-4 inline mr-2" />
          Historial de Ejecuciones
        </button>
      </div>

      {activeTab === 'workflows' && (
        <div className="grid gap-4">
          {filteredWorkflows.length === 0 ? (
            <EmptyState icon={Zap} title={search || triggerFilter !== 'all' ? 'No se encontraron flujos con los filtros actuales' : 'No hay flujos de trabajo'} description={search || triggerFilter !== 'all' ? 'Intente ajustar los filtros' : 'Crea tu primer flujo para automatizar procesos'} />
          ) : (
            filteredWorkflows.map((workflow) => (
              <Card key={workflow.id} className={!workflow.isActive ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${config?.primaryColor}20` }}
                      >
                        <Zap className="h-5 w-5" style={{ color: config?.primaryColor }} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{workflow.name}</CardTitle>
                        <CardDescription>{workflow.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                        {workflow.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Badge variant="outline">
                        {triggerTypeLabels[workflow.triggerType as WorkflowTriggerType]?.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Prioridad: {workflow.priority} | Ejecuciones: {workflow._count?.executions || 0}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleWorkflow(workflow)}
                      >
                        {workflow.isActive ? (
                          <>
                            <Pause className="h-4 w-4 mr-1" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" />
                            Activar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(workflow)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(workflow)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial de Ejecuciones</CardTitle>
            <CardDescription>Últimas ejecuciones de flujos de trabajo</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {executions.length === 0 ? (
                <EmptyState icon={History} title="No hay ejecuciones registradas" />
              ) : (
                <div className="space-y-2">
                  {executions.map((execution) => {
                    const workflow = workflows.find(w => w.id === execution.ruleId)
                    return (
                      <div
                        key={execution.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Zap className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{workflow?.name || 'Flujo eliminado'}</p>
                            <p className="text-xs text-muted-foreground">
                              {execution.entityType} #{execution.entityId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(execution.status)}
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(execution.executedAt), { addSuffix: true, locale: es })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="¿Eliminar flujo?"
        description={`Esta acción no se puede deshacer. El flujo "${workflowToDelete?.name}" será eliminado permanentemente.`}
        itemName={workflowToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        undoable={false}
      />
    </div>
  )
}
