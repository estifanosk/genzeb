import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'

export function LoadingState({
  label = 'Loading...',
  className
}: {
  label?: string
  className?: string
}) {
  return (
    <div className={cn('flex min-h-56 flex-1 items-center justify-center rounded-lg border border-dashed', className)}>
      <div className="text-center text-muted-foreground">
        <RefreshCw className="mx-auto mb-3 h-7 w-7 animate-spin opacity-60" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: {
  icon?: React.ElementType
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-56 flex-1 items-center justify-center rounded-lg border border-dashed', className)}>
      <div className="max-w-sm text-center text-muted-foreground">
        {Icon && <Icon className="mx-auto mb-4 h-10 w-10 opacity-45" />}
        <p className="text-base font-medium text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

export function InlineAlert({
  children,
  variant = 'danger',
  className
}: {
  children: React.ReactNode
  variant?: 'danger' | 'warning' | 'info'
  className?: string
}) {
  const styles = {
    danger: 'border-destructive/40 bg-destructive/10 text-destructive',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-400'
  }

  return <div className={cn('rounded-md border p-3 text-sm', styles[variant], className)}>{children}</div>
}
