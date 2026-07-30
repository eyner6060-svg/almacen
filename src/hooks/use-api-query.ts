'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/http'

type ApiQueryKey = [string, URLSearchParams?] | [string, ...unknown[]]

const FIVE_MINUTES = 5 * 60 * 1000

function buildUrl(path: string, params?: URLSearchParams): string {
  const qs = params?.toString()
  return qs ? `${path}?${qs}` : path
}

interface ApiQueryOptions<TData> extends Omit<UseQueryOptions<TData, Error, TData, ApiQueryKey>, 'queryKey' | 'queryFn'> {
  staleTime?: number
}

export function useApiQuery<TData = unknown>(
  path: string,
  params?: URLSearchParams | Record<string, string>,
  options?: ApiQueryOptions<TData>
) {
  const paramsObj = params instanceof URLSearchParams ? params : params ? new URLSearchParams(params) : undefined
  const paramsStr = paramsObj?.toString()
  const queryKey: ApiQueryKey = paramsStr ? [path, paramsStr] : [path]

  return useQuery<TData, Error, TData, ApiQueryKey>({
    queryKey,
    queryFn: async () => {
      const res = await apiFetch(buildUrl(path, paramsObj))
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Error ${res.status}`)
      }
      return res.json()
    },
    staleTime: options?.staleTime ?? FIVE_MINUTES,
    ...options,
  })
}

export function useApiMutation<TVariables = unknown, TData = unknown>(
  method: string,
  path: string,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>
) {
  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const isFormData = variables instanceof FormData
      const res = await apiFetch(path, {
        method,
        headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        body: isFormData ? variables : JSON.stringify(variables),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Error ${res.status}`)
      }
      return res.json()
    },
    ...options,
  })
}

export function useInvalidateQueries() {
  const queryClient = useQueryClient()
  return {
    invalidate: (keys: string[]) => {
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
    },
    invalidatePrefix: (prefix: string) => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] ?? '').startsWith(prefix) })
    },
    refetchQueries: (keys: string[]) => {
      keys.forEach(key => queryClient.refetchQueries({ queryKey: [key] }))
    },
  }
}

export const queryKeys = {
  items: '/api/items',
  itemCategories: '/api/items-categories',
  warehouses: '/api/warehouses',
  offices: '/api/offices',
  orders: '/api/orders',
  users: '/api/users',
  vehicles: '/api/vehicles',
  dashboard: '/api/dashboard',
  estados: '/api/estados',
  notifications: '/api/notifications',
  assignedAssets: '/api/assigned-assets',
  fuelInventory: '/api/fuel-inventory',
  fuelRequests: '/api/fuel-requests',
  loans: '/api/loans',
  assetRequests: '/api/assignment-requests',
  patrimonialCodes: '/api/items/patrimonial-codes',
}