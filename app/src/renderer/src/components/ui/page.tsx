import * as React from 'react'
import { cn } from '../../lib/utils'

export function PageShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-6', className)}
      {...props}
    />
  )
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  className
}: {
  title: string
  description?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5 flex shrink-0 flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-2xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
}
