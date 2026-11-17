'use client'

'use client'
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
import { Input as InputPrimitive } from '@base-ui/react/input'
import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

import { cn } from '@/lib/utils'

const inputClasses = [
  'border-input file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50',
  'disabled:bg-input/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80',
  'dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 h-10 w-full min-w-0 rounded-xl border bg-transparent',
  'px-3 py-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent',
  'file:text-sm file:font-medium',
  'focus-visible:ring-3 focus-visible:ring-inset disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:ring-3 aria-invalid:ring-inset text-sm',
]

function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const { t } = useTranslation()
  const [visible, setVisible] = React.useState(false)
  return (
    <div data-slot="password-field" className="relative flex w-full items-center">
      <InputPrimitive type={visible ? 'text' : 'password'} data-slot="input" className={cn(...inputClasses, 'pr-10', className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={props.disabled}
        aria-label={t(visible ? 'Hide password' : 'Show password')}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="text-muted-foreground hover:text-foreground absolute right-2.5 flex size-7 items-center justify-center rounded-md transition-colors"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </Button>
    </div>
  )
}

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  if (type === 'password') {
    return <PasswordInput className={className} {...props} />
  }
  return <InputPrimitive type={type} data-slot="input" className={cn(...inputClasses, className)} {...props} />
}

export { Input, PasswordInput }
