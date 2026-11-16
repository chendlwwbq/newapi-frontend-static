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
import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const enhancedCardVariants = cva('rounded-xl transition-all duration-300 ease-out', {
  variants: {
    variant: {
      default: 'bg-card border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5',
      glass: 'glass-2 backdrop-blur-xl hover:shadow-lg hover:-translate-y-1',
      elevated: 'bg-card border border-border shadow-md hover:shadow-xl hover:-translate-y-1',
      flat: 'bg-card border border-border',
      gradient: 'bg-gradient-to-br from-card to-card/80 border border-border/50 shadow-sm hover:shadow-md hover:from-card hover:to-card/90',
    },
    hover: {
      true: '',
      false: 'hover:transform-none hover:shadow-none',
    },
    interactive: {
      true: 'cursor-pointer active:scale-[0.98]',
      false: '',
    },
    padding: {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
      xl: 'p-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    hover: true,
    interactive: false,
    padding: 'md',
  },
})

interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof enhancedCardVariants> {
  children: ReactNode
  asChild?: boolean
}

export function EnhancedCard({ className, variant, hover, interactive, padding, children, ...props }: EnhancedCardProps) {
  return (
    <div
      data-slot="card"
      data-card-hover={hover}
      className={cn(enhancedCardVariants({ variant, hover, interactive, padding }), className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5 pb-4', className)} {...props}>
      {children}
    </div>
  )
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export function CardTitle({ className, children, as: Component = 'h3', ...props }: CardTitleProps) {
  return (
    <Component className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props}>
      {children}
    </Component>
  )
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode
}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  )
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn('pt-0', className)} {...props}>
      {children}
    </div>
  )
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div className={cn('flex items-center pt-4 border-t border-border/50', className)} {...props}>
      {children}
    </div>
  )
}
