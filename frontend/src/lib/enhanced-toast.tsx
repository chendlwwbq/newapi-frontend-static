/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { toast as sonnerToast } from 'sonner'

interface ToastOptions {
  duration?: number
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * Enhanced toast notifications with consistent styling
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    sonnerToast.success(message, {
      ...options,
      className: 'glass-enhanced border-success/20',
      duration: options?.duration || 4000,
    })
  },

  error: (message: string, options?: ToastOptions) => {
    sonnerToast.error(message, {
      ...options,
      className: 'glass-enhanced border-destructive/20',
      duration: options?.duration || 5000,
    })
  },

  warning: (message: string, options?: ToastOptions) => {
    sonnerToast.warning(message, {
      ...options,
      className: 'glass-enhanced border-warning/20',
      duration: options?.duration || 4500,
    })
  },

  info: (message: string, options?: ToastOptions) => {
    sonnerToast.info(message, {
      ...options,
      className: 'glass-enhanced border-info/20',
      duration: options?.duration || 4000,
    })
  },

  loading: (message: string, options?: ToastOptions) => {
    return sonnerToast.loading(message, {
      ...options,
      className: 'glass-enhanced',
    })
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: Error) => string)
    },
    options?: ToastOptions
  ) => {
    return sonnerToast.promise(promise, {
      ...options,
      ...messages,
      className: 'glass-enhanced',
    })
  },

  custom: (message: React.ReactNode, options?: ToastOptions) => {
    return sonnerToast.custom(() => <>{message}</>, {
      ...options,
      className: 'glass-enhanced',
    })
  },

  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId)
  },
}
