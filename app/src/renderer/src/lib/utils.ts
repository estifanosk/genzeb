import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

/** Format a number as $1,234.56 */
export function fmtCurrency(amount: number): string {
  return currencyFmt.format(amount)
}

/** Tailwind text colour class for a signed amount */
export function amountClass(amount: number): string {
  if (amount > 0) return 'text-green-400'
  if (amount < 0) return 'text-red-400'
  return ''
}

/** Format a YYYY-MM-DD date string, substituting "Today" / "Yesterday" for recent dates */
export function fmtDate(dateStr: string): string {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  if (dateStr === todayStr) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'
  return dateStr
}
