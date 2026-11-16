'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { gatewayAddress } from './api-examples'

export function useGatewayAddress() {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(location.origin), [])
  const query = useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => api<{ server_address?: string }>('/api/status', { anonymous: true, signal }),
  })
  let address = '',
    error: Error | null = query.error
  try {
    address = gatewayAddress(query.data?.server_address, origin)
  } catch (failure) {
    error = failure as Error
  }
  return { address, error, retry: () => query.refetch() }
}
