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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

interface ProgressIndicatorProps {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  variant?: 'default' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const variantStyles = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
}

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

export function ProgressIndicator({
  value,
  max = 100,
  label,
  showPercentage = true,
  variant = 'default',
  size = 'md',
  className,
}: ProgressIndicatorProps) {
  const { t } = useTranslation()
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-sm">
          {label && <span className="text-muted-foreground font-medium">{label}</span>}
          {showPercentage && <span className="font-semibold tabular-nums">{percentage.toFixed(0)}%</span>}
        </div>
      )}
      <div
        className={cn('w-full rounded-full bg-secondary overflow-hidden', sizeStyles[size])}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label || t('Progress')}
      >
        <div className={cn('h-full transition-all duration-500 ease-out', variantStyles[variant])} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  variant?: 'default' | 'success' | 'warning' | 'error'
  showLabel?: boolean
  className?: string
}

const circularVariantColors = {
  default: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  error: 'stroke-destructive',
}

export function CircularProgress({
  value,
  max = 100,
  size = 80,
  strokeWidth = 6,
  variant = 'default',
  showLabel = true,
  className,
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn('relative inline-flex', className)}>
      <svg width={size} height={size} className="transform -rotate-90" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        {/* Background circle */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-secondary" strokeWidth={strokeWidth} />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn('transition-all duration-500 ease-out', circularVariantColors[variant])}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold tabular-nums">{percentage.toFixed(0)}%</span>
        </div>
      )}
    </div>
  )
}

interface StepProgressProps {
  steps: { label: string; completed: boolean }[]
  currentStep: number
  className?: string
}

export function StepProgress({ steps, currentStep, className }: StepProgressProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center flex-1">
            {/* Step indicator */}
            <div
              className={cn(
                'flex items-center justify-center size-8 rounded-full border-2 transition-all duration-300',
                index < currentStep
                  ? 'bg-primary border-primary text-primary-foreground'
                  : index === currentStep
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-muted border-border text-muted-foreground'
              )}
            >
              {step.completed ? (
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            {/* Step label */}
            <span
              className={cn(
                'mt-2 text-xs text-center transition-colors duration-300',
                index <= currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn('absolute top-4 h-0.5 transition-all duration-300', index < currentStep ? 'bg-primary' : 'bg-border')}
                style={{
                  left: `${(100 / steps.length) * (index + 0.5)}%`,
                  width: `${100 / steps.length}%`,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
