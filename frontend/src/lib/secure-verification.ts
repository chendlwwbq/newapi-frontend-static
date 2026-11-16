import { ApiError } from '@/lib/api/client'

export class AuthOperationError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message)
  }
  static from(error: unknown) {
    if (error instanceof AuthOperationError) return error
    if (error instanceof ApiError) return new AuthOperationError(error.message, error.code)
    return new AuthOperationError(error instanceof Error ? error.message : 'Verification failed')
  }
}
