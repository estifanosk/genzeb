import type { LedgerBoxAPI } from '@core/types/ipc'

declare global {
  interface Window {
    api: LedgerBoxAPI
  }
}
